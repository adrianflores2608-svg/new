"""
The visualizer signal bus.

Writes plain files in the project root that a separate visualizer process
watches. The contract is just files, so anything can read them. Every write
in this module is wrapped in try/except: the bus must never crash the voice
line, no matter what.

Files:
    .voice_state         plain text: idle | listening | thinking | speaking
    .voice_waveform      JSON {"ts": <unix float>, "samples": [64 floats]},
                          written at most 15x/sec while audio plays.
    .voice_loading_pid   exists while an optional thinking sound is playing.

.voice_alert is never written here. It belongs to some other process on the
machine that wants the visualizer's attention.

CRITICAL self-heal rule: every waveform write also re-writes state to
"speaking". This only happens while audio is audibly playing, and it means
any stray process that stomps the state file gets corrected within about
70ms (the 1/15s waveform-write throttle window). Do not remove this.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent

STATE_FILE = ROOT / ".voice_state"
WAVEFORM_FILE = ROOT / ".voice_waveform"
LOADING_PID_FILE = ROOT / ".voice_loading_pid"

_WAVEFORM_MIN_INTERVAL = 1.0 / 15.0
_WAVEFORM_POINTS = 64

_last_waveform_write = 0.0


def _atomic_write_text(path: Path, text: str) -> None:
    """Write via a temp file + replace so a watcher never sees a half-written file."""
    tmp = path.with_suffix(path.suffix + f".tmp{os.getpid()}")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    finally:
        try:
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass


def write_state(state: str) -> None:
    """One of: idle, listening, thinking, speaking."""
    try:
        _atomic_write_text(STATE_FILE, state)
    except Exception:
        pass


def write_waveform(samples) -> bool:
    """
    Downsample `samples` (any length int16-ish array-like) to 64 points and
    write the waveform file, throttled to at most 15 writes/sec.

    Also re-writes state to "speaking" (the self-heal rule). Returns True if
    a write actually happened (useful for callers that want to know whether
    they were throttled).
    """
    global _last_waveform_write
    now = time.time()
    if now - _last_waveform_write < _WAVEFORM_MIN_INTERVAL:
        return False
    _last_waveform_write = now

    try:
        points = _downsample(samples, _WAVEFORM_POINTS)
        payload = json.dumps({"ts": now, "samples": points})
        _atomic_write_text(WAVEFORM_FILE, payload)
        # Self-heal: this only runs while audio is audibly playing, so any
        # stray writer that stomped .voice_state gets corrected within one
        # throttle window (~70ms).
        _atomic_write_text(STATE_FILE, "speaking")
    except Exception:
        pass
    return True


def _downsample(samples, n: int) -> list:
    try:
        length = len(samples)
    except TypeError:
        return [0.0] * n
    if length == 0:
        return [0.0] * n
    bucket = max(1, length // n)
    out = []
    for i in range(n):
        start = i * bucket
        end = start + bucket if i < n - 1 else length
        if start >= length:
            out.append(0.0)
            continue
        chunk = samples[start:end] if end > start else samples[start:start + 1]
        try:
            magnitude = float(max(abs(float(v)) for v in chunk))
        except (ValueError, TypeError):
            magnitude = 0.0
        out.append(magnitude)
    return out


def set_loading(active: bool) -> None:
    """Mark (or clear) presence of an optional thinking sound."""
    try:
        if active:
            _atomic_write_text(LOADING_PID_FILE, str(os.getpid()))
        else:
            if LOADING_PID_FILE.exists():
                LOADING_PID_FILE.unlink()
    except Exception:
        pass


def reset() -> None:
    """Called at startup: go idle, clear any stale loading marker."""
    write_state("idle")
    set_loading(False)
