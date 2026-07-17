"""
Mic capture and transcription.

mic (sounddevice) -> local whisper.cpp server on port 2022, OpenAI-style
route /v1/audio/transcriptions. NOT /inference -- that route 404s on the
OpenAI-shaped multipart request this module sends.

Two capture modes:
  - Hold-to-talk (default): caller drives begin_capture()/end_capture_with_tail()
    around a key press/release. The mic is fully opened and fully closed on
    every hold; nothing is captured between holds.
  - Open-mic (--open-mic): record_vad_utterance() does its own continuous
    listen + webrtcvad endpointing and returns one utterance at a time.
"""

from __future__ import annotations

import asyncio
import io
import os
import re
import time
import wave
from typing import Optional

import httpx
import sounddevice as sd
import webrtcvad

SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = "int16"
SAMPLE_WIDTH_BYTES = 2

WHISPER_URL = os.environ.get(
    "VOICE_LINE_WHISPER_URL", "http://127.0.0.1:2022/v1/audio/transcriptions"
)

# Whisper emits these for non-speech audio (silence, breathing, room noise).
# Never let them get spoken back or sent to the brain as if they were words.
_BRACKET_MARKER_RE = re.compile(r"\[[^\]]{0,40}\]")

# Open-mic mode: an utterance with less than this much *voiced* audio is
# noise, not speech, and gets discarded before ever reaching whisper.
MIN_VOICED_MS_OPEN_MIC = 240


def strip_non_speech_markers(text: str) -> str:
    return re.sub(r"\s{2,}", " ", _BRACKET_MARKER_RE.sub("", text)).strip()


class Ears:
    def __init__(self, sample_rate: int = SAMPLE_RATE):
        self.sample_rate = sample_rate
        self._frames: list[bytes] = []
        self._stream: Optional[sd.InputStream] = None
        self._capturing = False

    def _callback(self, indata, frames, time_info, status) -> None:
        if self._capturing:
            self._frames.append(bytes(indata))

    # ---- hold-to-talk -----------------------------------------------

    def begin_capture(self) -> None:
        """Open the mic. Called the instant the PTT key goes down."""
        self._frames = []
        self._capturing = True
        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=CHANNELS,
            dtype=DTYPE,
            callback=self._callback,
        )
        self._stream.start()

    def abort_capture(self) -> None:
        """Discard a capture outright (used for sub-250ms accidental taps)."""
        self._capturing = False
        self._close_stream()
        self._frames = []

    async def end_capture_with_tail(self, tail_seconds: float) -> bytes:
        """
        Keep recording for `tail_seconds` after this is called (the key was
        just released) so the tail of the last word isn't clipped, then
        close the mic fully and return the raw PCM.
        """
        await asyncio.sleep(tail_seconds)
        self._capturing = False
        self._close_stream()
        pcm = b"".join(self._frames)
        self._frames = []
        return pcm

    def _close_stream(self) -> None:
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    # ---- open-mic (legacy) --------------------------------------------

    async def record_vad_utterance(
        self,
        aggressiveness: int = 2,
        frame_ms: int = 30,
        silence_ms: int = 700,
        max_seconds: float = 30.0,
    ) -> bytes:
        """
        Listen continuously and endpoint one utterance using webrtcvad:
        speech starts on the first voiced frame, ends after `silence_ms` of
        trailing silence. Returns b"" if fewer than MIN_VOICED_MS_OPEN_MIC
        of the utterance was actually voiced (room noise / a cough).
        """
        vad = webrtcvad.Vad(aggressiveness)
        frame_bytes = int(self.sample_rate * frame_ms / 1000) * SAMPLE_WIDTH_BYTES
        voiced_ms = 0
        silence_run_ms = 0
        started = False
        collected = bytearray()
        deadline = time.monotonic() + max_seconds

        self._frames = []
        self._capturing = True
        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=CHANNELS,
            dtype=DTYPE,
            callback=self._callback,
        )
        self._stream.start()

        buf = bytearray()
        try:
            while self._capturing and time.monotonic() < deadline:
                await asyncio.sleep(frame_ms / 1000 / 2)
                while self._frames:
                    buf += self._frames.pop(0)
                while len(buf) >= frame_bytes:
                    frame = bytes(buf[:frame_bytes])
                    del buf[:frame_bytes]
                    is_speech = vad.is_speech(frame, self.sample_rate)
                    if is_speech:
                        voiced_ms += frame_ms
                        silence_run_ms = 0
                        started = True
                        collected += frame
                    elif started:
                        silence_run_ms += frame_ms
                        collected += frame
                        if silence_run_ms >= silence_ms:
                            self._capturing = False
                            break
        finally:
            self._capturing = False
            self._close_stream()

        if voiced_ms < MIN_VOICED_MS_OPEN_MIC:
            return b""
        return bytes(collected)

    def stop_open_mic(self) -> None:
        """External signal to end the current record_vad_utterance() early."""
        self._capturing = False

    # ---- transcription --------------------------------------------------

    def _to_wav_bytes(self, pcm: bytes) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(SAMPLE_WIDTH_BYTES)
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm)
        return buf.getvalue()

    async def transcribe(self, pcm: bytes, strip_markers: bool = False) -> str:
        min_bytes = int(self.sample_rate * SAMPLE_WIDTH_BYTES * 0.1)  # <100ms isn't worth sending
        if not pcm or len(pcm) < min_bytes:
            return ""
        wav_bytes = self._to_wav_bytes(pcm)
        files = {"file": ("utterance.wav", wav_bytes, "audio/wav")}
        data = {"language": "en", "response_format": "json"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(WHISPER_URL, files=files, data=data)
            resp.raise_for_status()
            payload = resp.json()
        text = payload.get("text", "") if isinstance(payload, dict) else ""
        text = text.strip()
        if strip_markers:
            text = strip_non_speech_markers(text)
        return text
