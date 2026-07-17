"""
Sentence-chunked TTS via local Kokoro (port 8880), cancellable playback.

A queue of sentences is synthesized one at a time and played back to back.
Interrupting (mouth.interrupt()) clears the queue and stops the speaker
immediately -- it's what makes hold-to-talk speaker-safe with no headphones:
pressing the key while the assistant is talking cuts it off mid-word.

Thread-safety note: interrupt() is called directly from the pynput listener
thread (for the lowest possible latency stopping the speaker -- see ptt.py /
main.py), not from the asyncio loop. asyncio.Queue is not thread-safe, so
interrupt() only touches thread-safe primitives itself (a lock-guarded
generation counter, a direct PortAudio abort) and marshals the actual queue
drain onto the event loop via call_soon_threadsafe.
"""

from __future__ import annotations

import asyncio
import os
import threading
from typing import Optional

import httpx
import numpy as np
import sounddevice as sd

import ducking
import signals

KOKORO_URL = os.environ.get("VOICE_LINE_KOKORO_URL", "http://127.0.0.1:8880/v1/audio/speech")
KOKORO_VOICE = os.environ.get("VOICE_LINE_KOKORO_VOICE", "bm_lewis")

SAMPLE_RATE = 24000
CHANNELS = 1
_BLOCK_SAMPLES = SAMPLE_RATE // 100  # 10ms blocks: fine-grained enough that an
                                      # abort() from another thread is felt almost
                                      # instantly, and frequent enough to feed the
                                      # waveform bus (which throttles itself to 15Hz).


class Mouth:
    def __init__(self) -> None:
        self._queue: "asyncio.Queue[tuple[int, str]]" = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        self._gen_lock = threading.Lock()
        self._generation = 0
        self._turn_done_generation = -1

        self._stream_lock = threading.Lock()
        self._current_stream: Optional[sd.OutputStream] = None
        self._speaking_something = False
        self._ducker = ducking.SpotifyDucker()

    # ---- lifecycle ------------------------------------------------------

    def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._worker_task = asyncio.ensure_future(self._run())

    async def aclose(self) -> None:
        if self._worker_task is not None:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        self._abort_stream_now()

    # ---- public API -------------------------------------------------------

    def _current_generation(self) -> int:
        with self._gen_lock:
            return self._generation

    @property
    def is_speaking(self) -> bool:
        return self._speaking_something or not self._queue.empty()

    async def wait_idle(self, timeout: float = 15.0) -> None:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout
        while self.is_speaking:
            if loop.time() > deadline:
                return
            await asyncio.sleep(0.05)

    def enqueue(self, sentence: str) -> None:
        """Call only from the asyncio loop thread (e.g. from brain's on_sentence)."""
        sentence = sentence.strip()
        if sentence:
            self._queue.put_nowait((self._current_generation(), sentence))

    def notify_turn_complete(self) -> None:
        """
        Call once brain.send() has finished streaming -- i.e. no more
        sentences are coming for this turn. If playback has already caught
        up and gone silent, this is what flips the state to idle; otherwise
        the worker will do it itself once it finishes the last sentence.
        """
        gen = self._current_generation()
        self._turn_done_generation = gen
        if self._queue.empty() and not self._speaking_something:
            signals.write_state("idle")

    def interrupt(self) -> None:
        """
        Thread-safe. Stops the speaker NOW and drops every queued sentence.
        Safe to call from the pynput listener thread or the asyncio loop.
        """
        with self._gen_lock:
            self._generation += 1
        self._abort_stream_now()
        signals.write_state("idle")
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self._drain_queue_on_loop)

    def _drain_queue_on_loop(self) -> None:
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        self._speaking_something = False

    def _abort_stream_now(self) -> None:
        with self._stream_lock:
            stream, self._current_stream = self._current_stream, None
        if stream is not None:
            try:
                stream.abort()
                stream.close()
            except Exception:
                pass

    # ---- worker -----------------------------------------------------------

    async def _run(self) -> None:
        while True:
            gen, sentence = await self._queue.get()
            if gen != self._current_generation():
                continue  # stale: interrupted before we got to it

            try:
                pcm = await self._synthesize(sentence)
            except Exception as exc:
                print(f"[mouth] kokoro request failed: {exc}")
                continue

            if gen != self._current_generation():
                continue

            self._speaking_something = True
            await self._play(pcm, gen)
            self._speaking_something = False

            if (
                gen == self._current_generation()
                and self._queue.empty()
                and gen == self._turn_done_generation
            ):
                signals.write_state("idle")

    async def _synthesize(self, sentence: str) -> bytes:
        payload = {
            "model": "kokoro",
            "voice": KOKORO_VOICE,
            "input": sentence,
            "response_format": "pcm",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(KOKORO_URL, json=payload)
            resp.raise_for_status()
            return resp.content

    async def _play(self, pcm: bytes, gen: int) -> None:
        if not pcm:
            return
        samples = np.frombuffer(pcm, dtype=np.int16)
        if samples.size == 0:
            return

        stream = sd.OutputStream(samplerate=SAMPLE_RATE, channels=CHANNELS, dtype="int16")
        with self._stream_lock:
            self._current_stream = stream
        stream.start()
        self._ducker.duck()

        first_block = True
        try:
            for i in range(0, samples.size, _BLOCK_SAMPLES):
                if gen != self._current_generation():
                    break  # interrupted
                block = samples[i:i + _BLOCK_SAMPLES]
                if first_block:
                    signals.write_state("speaking")
                    first_block = False
                try:
                    stream.write(block)
                except Exception:
                    break  # stream was aborted mid-write from another thread
                signals.write_waveform(block)
                await asyncio.sleep(0)
        finally:
            self._ducker.release()
            with self._stream_lock:
                if self._current_stream is stream:
                    self._current_stream = None
            try:
                stream.stop()
                stream.close()
            except Exception:
                pass
