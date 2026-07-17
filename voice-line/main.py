"""
Entry point: the turn loop, hold-to-talk wiring, typed input, warmup.

    mic -> ears -> whisper (2022) -> brain (warm Claude Agent SDK session)
        -> mouth -> Kokoro (8880) -> speakers

Half-duplex: the mic is gated while the mouth is speaking so the system
never hears itself. No barge-in on open speakers -- interrupting happens by
pressing the PTT key or typing, which cuts the mouth off immediately.

Run this from Terminal / PowerShell / Windows Terminal directly. Never run
it as a background service -- nobody wants a 24/7 open mic, and on Windows,
mic + global-hotkey permission prompts need a real foreground console
session to grant anyway.
"""

from __future__ import annotations

import argparse
import asyncio
import ctypes
import os
import re
import sys
import threading
import time
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlsplit

import brain as brain_module
import ears as ears_module
import mouth as mouth_module
import ptt as ptt_module
import signals

try:
    import msvcrt
except ImportError:
    msvcrt = None  # voice-line targets Windows; typed input needs msvcrt

MIN_HOLD_SECONDS = 0.25
TAIL_SECONDS = 0.18
LONG_PASTE_ECHO_THRESHOLD = 60

_LINE_NUMBER_GUTTER_RE = re.compile(r"^\s{0,4}\d{1,6}[:\|\)]\s?")
_BLOCKQUOTE_GUTTER_RE = re.compile(r"^\s{0,4}>\s?")


# --------------------------------------------------------------------------
# Typed input: raw-mode line editor
# --------------------------------------------------------------------------


def _enable_vt_input() -> Optional[int]:
    """
    Turn on VT/ANSI escape-sequence input on the console (Windows Terminal,
    ConEmu, etc. honor this) so a bracketed paste arrives as a
    \\x1b[200~ ... \\x1b[201~ wrapped sequence we can detect, the same way a
    Unix tty would deliver one. Returns the original console mode so it can
    be restored on exit, or None if this couldn't be set (older conhost) --
    typed input still works, pastes just won't be paste-detected.
    """
    if msvcrt is None:
        return None
    try:
        kernel32 = ctypes.windll.kernel32
        STD_INPUT_HANDLE = -10
        ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200
        handle = kernel32.GetStdHandle(STD_INPUT_HANDLE)
        original = ctypes.c_uint32()
        if not kernel32.GetConsoleMode(handle, ctypes.byref(original)):
            return None
        kernel32.SetConsoleMode(handle, original.value | ENABLE_VIRTUAL_TERMINAL_INPUT)
        return original.value
    except Exception:
        return None


def _restore_console_mode(original: Optional[int]) -> None:
    if original is None or msvcrt is None:
        return
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-10)
        kernel32.SetConsoleMode(handle, original)
    except Exception:
        pass


def _scrub_pasted_text(text: str) -> str:
    """Strip line-number/blockquote gutters and collapse hard-wrapped lines
    back into flowing paragraphs, keeping blank-line paragraph breaks."""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    cleaned = []
    for line in lines:
        line = _LINE_NUMBER_GUTTER_RE.sub("", line)
        line = _BLOCKQUOTE_GUTTER_RE.sub("", line)
        cleaned.append(line.rstrip())

    paragraphs: list[str] = []
    current: list[str] = []
    for line in cleaned:
        if line.strip() == "":
            if current:
                paragraphs.append(" ".join(current))
                current = []
        else:
            current.append(line.strip())
    if current:
        paragraphs.append(" ".join(current))
    return ("\n\n".join(paragraphs) if len(paragraphs) > 1 else "".join(paragraphs)).strip()


class LineReader:
    """
    Takes the terminal raw (char-at-a-time, no kernel echo) and runs its own
    tiny line editor, because canonical mode can't host paste-aware input.
    Runs on a background thread (msvcrt reads block); completed lines are
    handed to the asyncio loop via call_soon_threadsafe.

    Any shape of bracketed paste gets assembled invisibly into ONE message:
    gutter glyphs and hard wraps are scrubbed, and it echoes to the terminal
    as a character count instead of the pasted text.
    """

    def __init__(
        self,
        loop: asyncio.AbstractEventLoop,
        on_line: Callable[[str], None],
        on_typing_started: Callable[[], None],
    ):
        if msvcrt is None:
            raise RuntimeError("Typed input needs msvcrt; this build targets Windows.")
        self._loop = loop
        self._on_line = on_line
        self._on_typing_started = on_typing_started
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._original_console_mode: Optional[int] = None

    def start(self) -> None:
        self._original_console_mode = _enable_vt_input()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        _restore_console_mode(self._original_console_mode)

    def _run(self) -> None:
        buf: list[str] = []
        try:
            while not self._stop.is_set():
                if not msvcrt.kbhit():
                    time.sleep(0.01)
                    continue
                ch = msvcrt.getwch()

                if ch == "\x1b":
                    seq = self._read_escape_sequence()
                    if seq == "[200~":
                        if not buf:
                            # a paste is typing too -- interrupts playback
                            # just like the first character of a fresh line
                            try:
                                self._on_typing_started()
                            except Exception:
                                pass
                        raw_paste = self._collect_until_paste_end()
                        self._insert_paste(buf, raw_paste)
                    # other escape sequences (arrow keys, etc.) are swallowed --
                    # this is a tiny editor, not a full line-editing widget
                    continue

                if ch in ("\r", "\n"):
                    sys.stdout.write("\r\n")
                    sys.stdout.flush()
                    line = "".join(buf).strip()
                    buf.clear()
                    if line:
                        self._loop.call_soon_threadsafe(self._on_line, line)
                    continue

                if ch in ("\x08", "\x7f"):  # backspace
                    if buf:
                        buf.pop()
                        sys.stdout.write("\b \b")
                        sys.stdout.flush()
                    continue

                if ch == "\x03":  # Ctrl-C, in case console-processed-input is off
                    self._loop.call_soon_threadsafe(self._on_line, "goodbye")
                    continue

                if not buf:
                    # first character of a fresh line: typing while the
                    # assistant talks interrupts playback immediately
                    try:
                        self._on_typing_started()
                    except Exception:
                        pass

                buf.append(ch)
                sys.stdout.write(ch)
                sys.stdout.flush()
        except Exception as exc:
            print(f"\n[voice-line] typed input reader stopped: {exc}")

    def _read_escape_sequence(self) -> str:
        seq = ""
        deadline = time.monotonic() + 0.05
        while time.monotonic() < deadline:
            if msvcrt.kbhit():
                c = msvcrt.getwch()
                seq += c
                if c.isalpha() or c == "~":
                    break
            else:
                time.sleep(0.001)
        return seq

    def _collect_until_paste_end(self) -> str:
        collected: list[str] = []
        while not self._stop.is_set():
            if not msvcrt.kbhit():
                time.sleep(0.001)
                continue
            c = msvcrt.getwch()
            if c == "\x1b":
                seq = self._read_escape_sequence()
                if seq == "[201~":
                    break
                collected.append("\x1b" + seq)
                continue
            collected.append(c)
        return "".join(collected)

    def _insert_paste(self, buf: list[str], raw: str) -> None:
        cleaned = _scrub_pasted_text(raw)
        if not cleaned:
            return
        buf.extend(cleaned)
        if len(cleaned) > LONG_PASTE_ECHO_THRESHOLD:
            sys.stdout.write(f"[pasted {len(cleaned)} chars]")
        else:
            sys.stdout.write(cleaned)
        sys.stdout.flush()


# --------------------------------------------------------------------------
# Startup checks
# --------------------------------------------------------------------------


def _host_port(url: str) -> tuple[str, int]:
    parts = urlsplit(url)
    return parts.hostname or "127.0.0.1", parts.port or 80


async def _port_open(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
    except Exception:
        return False
    writer.close()
    try:
        await writer.wait_closed()
    except Exception:
        pass
    return True


# --------------------------------------------------------------------------
# Open-mic (legacy) loop
# --------------------------------------------------------------------------


async def _open_mic_loop(
    ears_client: ears_module.Ears,
    mouth_client: mouth_module.Mouth,
    start_turn: Callable[[str], "asyncio.Future"],
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        # half-duplex: never listen while the mouth is speaking
        while mouth_client.is_speaking and not stop_event.is_set():
            await asyncio.sleep(0.05)
        if stop_event.is_set():
            break
        signals.write_state("listening")
        pcm = await ears_client.record_vad_utterance()
        if not pcm:
            signals.write_state("idle")
            continue
        signals.write_state("thinking")
        text = await ears_client.transcribe(pcm, strip_markers=True)
        if not text.strip():
            signals.write_state("idle")
            continue
        await start_turn(text)


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="voice-line: talk to Claude out loud at your desk")
    parser.add_argument(
        "--open-mic",
        action="store_true",
        help="Legacy open-mic mode: continuous VAD-endpointed listening instead of hold-to-talk.",
    )
    parser.add_argument(
        "--project",
        type=str,
        default=None,
        help="Project folder whose CLAUDE.md defines the assistant's identity. "
        "Defaults to $VOICE_LINE_PROJECT_DIR or the current directory.",
    )
    return parser.parse_args()


async def main() -> int:
    args = _parse_args()
    signals.reset()

    project_dir = Path(args.project or os.environ.get("VOICE_LINE_PROJECT_DIR") or os.getcwd())
    if not (project_dir / "CLAUDE.md").exists():
        print(
            f"[voice-line] warning: no CLAUDE.md in {project_dir} -- this voice session won't "
            f"automatically share identity/context with your terminal Claude Code sessions there. "
            f"Set VOICE_LINE_PROJECT_DIR or pass --project to point at the right folder."
        )

    whisper_host, whisper_port = _host_port(ears_module.WHISPER_URL)
    kokoro_host, kokoro_port = _host_port(mouth_module.KOKORO_URL)
    whisper_up = await _port_open(whisper_host, whisper_port)
    kokoro_up = await _port_open(kokoro_host, kokoro_port)
    if not whisper_up:
        print(f"[voice-line] whisper server not reachable on port {whisper_port}. Run setup\\setup-whisper.ps1 first.")
    if not kokoro_up:
        print(f"[voice-line] kokoro server not reachable on port {kokoro_port}. Run setup\\setup-kokoro.ps1 first.")
    if not (whisper_up and kokoro_up):
        return 1

    loop = asyncio.get_running_loop()
    speaker = mouth_module.Mouth()
    speaker.start()
    listener_ears = ears_module.Ears()

    key_queue: "asyncio.Queue[tuple[str, float]]" = asyncio.Queue()
    text_queue: "asyncio.Queue[str]" = asyncio.Queue()
    stop_event = asyncio.Event()
    current_turn_task: Optional[asyncio.Task] = None

    def on_key_down() -> None:
        # Runs on the pynput listener thread. Stop the speaker NOW, before
        # any asyncio scheduling delay -- this is what makes hold-to-talk
        # speaker-safe with no headphones.
        speaker.interrupt()
        loop.call_soon_threadsafe(key_queue.put_nowait, ("down", 0.0))

    def on_key_up(duration: float) -> None:
        loop.call_soon_threadsafe(key_queue.put_nowait, ("up", duration))

    def on_line(text: str) -> None:
        text_queue.put_nowait(text)

    def on_typing_started() -> None:
        speaker.interrupt()

    async def _track_turn(coro) -> None:
        """
        Cancel whatever's currently in flight -- a transcription still
        running, or a brain call still streaming -- and replace it with
        `coro` as the one tracked task. Every path that can produce a turn
        (voice capture+transcribe, typed lines, open-mic) goes through this,
        so a fresh key press can never race a stale transcription into
        hijacking a newer turn.
        """
        nonlocal current_turn_task
        if current_turn_task is not None and not current_turn_task.done():
            current_turn_task.cancel()
            try:
                await current_turn_task
            except (asyncio.CancelledError, Exception):
                pass
        current_turn_task = asyncio.ensure_future(coro)

    async def start_turn(text: str) -> None:
        await _track_turn(_run_turn(text))

    async def _run_turn(text: str) -> None:
        if brain_module.is_quit_phrase(text):
            signals.write_state("thinking")
            speaker.enqueue("Goodbye.")
            speaker.notify_turn_complete()
            await speaker.wait_idle()
            stop_event.set()
            return
        signals.write_state("thinking")
        await session.send(text, speaker.enqueue)
        speaker.notify_turn_complete()

    async def handle_key_event(event: tuple[str, float]) -> None:
        kind, duration = event
        if kind == "down":
            if current_turn_task is not None and not current_turn_task.done():
                current_turn_task.cancel()
            signals.write_state("listening")
            listener_ears.begin_capture()
        elif kind == "up":
            if duration < MIN_HOLD_SECONDS:
                listener_ears.abort_capture()
                signals.write_state("idle")
                return

            async def _finish() -> None:
                pcm = await listener_ears.end_capture_with_tail(TAIL_SECONDS)
                signals.write_state("thinking")
                text = await listener_ears.transcribe(pcm)
                if not text.strip():
                    signals.write_state("idle")
                    return
                await _run_turn(text)

            # Tracked from the transcription phase onward, not just the
            # brain call, so a key press during transcription cancels it
            # cleanly instead of letting a stale result land later.
            await _track_turn(_finish())

    model = os.environ.get("VOICE_LINE_MODEL") or None
    permission_mode = os.environ.get("VOICE_LINE_PERMISSION_MODE") or None

    reader: Optional[LineReader] = None
    push_to_talk: Optional[ptt_module.PushToTalk] = None
    vad_task: Optional[asyncio.Task] = None

    async with brain_module.Brain(cwd=str(project_dir), model=model, permission_mode=permission_mode) as session:
        print("[voice-line] warming up the session (hides the first-turn prompt-cache toll behind a greeting)...")
        signals.write_state("thinking")
        await session.warmup(speaker.enqueue)
        speaker.notify_turn_complete()

        reader = LineReader(loop, on_line, on_typing_started)
        reader.start()

        if args.open_mic:
            print("[voice-line] open-mic mode: listening continuously. Ctrl-C, or say/type "
                  "'goodbye' / 'end voice mode' / 'hang up' to stop.")
            vad_task = asyncio.ensure_future(_open_mic_loop(listener_ears, speaker, start_turn, stop_event))
        else:
            push_to_talk = ptt_module.PushToTalk(on_down=on_key_down, on_up=on_key_up)
            push_to_talk.start()
            print(
                f"[voice-line] hold {push_to_talk.key_label} to talk. Typing + Enter also works. "
                f"Ctrl-C, or say/type 'goodbye' / 'end voice mode' / 'hang up' to stop."
            )

        key_task = asyncio.ensure_future(key_queue.get())
        text_task = asyncio.ensure_future(text_queue.get())
        stop_task = asyncio.ensure_future(stop_event.wait())

        try:
            while not stop_event.is_set():
                done, _pending = await asyncio.wait(
                    {key_task, text_task, stop_task}, return_when=asyncio.FIRST_COMPLETED
                )
                if stop_task in done:
                    break
                # Only replace the futures that actually completed -- keep the
                # others alive across iterations, or a slow typed line could
                # get dropped while we wait on a fresh key_queue.get().
                if key_task in done:
                    event = key_task.result()
                    key_task = asyncio.ensure_future(key_queue.get())
                    await handle_key_event(event)
                if text_task in done:
                    line = text_task.result()
                    text_task = asyncio.ensure_future(text_queue.get())
                    # Playback interrupt already happened on the reader thread
                    # the moment typing started (on_typing_started), so this
                    # only needs to start the turn.
                    await start_turn(line)
        except KeyboardInterrupt:
            pass
        finally:
            key_task.cancel()
            text_task.cancel()
            stop_task.cancel()
            if vad_task is not None:
                vad_task.cancel()
            if push_to_talk is not None:
                push_to_talk.stop()
            if reader is not None:
                reader.stop()
            if current_turn_task is not None:
                current_turn_task.cancel()
            await speaker.aclose()
            signals.reset()

    print("[voice-line] session ended.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        signals.reset()
        sys.exit(0)
