"""
Global hold-to-talk key listener (pynput).

Works system-wide: the key opens the mic no matter which window has focus.
On Windows this needs no special permission grant (unlike macOS, which needs
Input Monitoring). Some locked-down corporate images restrict low-level
keyboard hooks; if the listener silently never fires, try running the
terminal as Administrator once to confirm it's a permissions issue.

CRITICAL gotcha this module exists to solve: while a key is held down, the
OS fires on_press repeatedly (key-repeat), not once. A naive on_press
handler treats every repeat as a fresh press, which means every replayed
repeat re-opens the mic / re-interrupts playback and the turn never gets a
chance to speak. We track a `_held` flag and only fire on_down on the
False->True edge, and on_up on the True->False edge.
"""

from __future__ import annotations

import os
import threading
import time
from typing import Callable, Optional

from pynput import keyboard

DEFAULT_KEY_NAME = "ctrl_r"


def _resolve_key(name: str):
    name = name.strip().lower()
    special = getattr(keyboard.Key, name, None)
    if special is not None:
        return special
    if len(name) == 1:
        return keyboard.KeyCode.from_char(name)
    raise ValueError(
        f"Unrecognized VOICE_LINE_PTT_KEY value: {name!r}. "
        f"Use a single character or a pynput.keyboard.Key name "
        f"(e.g. ctrl_r, f9, pause, caps_lock)."
    )


class PushToTalk:
    """
    on_down() fires exactly once per physical press (key-repeat filtered).
    on_up(duration_seconds) fires exactly once per matching release.
    Both callbacks run on the pynput listener thread, not the asyncio loop.
    """

    def __init__(
        self,
        on_down: Callable[[], None],
        on_up: Callable[[float], None],
        key_name: Optional[str] = None,
    ):
        self._key = _resolve_key(key_name or os.environ.get("VOICE_LINE_PTT_KEY", DEFAULT_KEY_NAME))
        self._on_down = on_down
        self._on_up = on_up
        self._held = False
        self._press_time = 0.0
        self._lock = threading.Lock()
        self._listener: Optional[keyboard.Listener] = None

    def _matches(self, key) -> bool:
        return key == self._key

    def _handle_press(self, key) -> None:
        if not self._matches(key):
            return
        with self._lock:
            if self._held:
                return  # key-repeat while held; not a new press
            self._held = True
            self._press_time = time.monotonic()
        try:
            self._on_down()
        except Exception:
            pass

    def _handle_release(self, key) -> None:
        if not self._matches(key):
            return
        with self._lock:
            if not self._held:
                return
            self._held = False
            duration = time.monotonic() - self._press_time
        try:
            self._on_up(duration)
        except Exception:
            pass

    def start(self) -> None:
        self._listener = keyboard.Listener(on_press=self._handle_press, on_release=self._handle_release)
        self._listener.start()

    def stop(self) -> None:
        if self._listener is not None:
            self._listener.stop()
            self._listener = None

    @property
    def key_label(self) -> str:
        return getattr(self._key, "name", None) or getattr(self._key, "char", None) or str(self._key)
