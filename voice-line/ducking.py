"""
Optional Spotify ducking (Windows).

The macOS version of this spec used AppleScript to ask Spotify for its own
playback volume. Windows has no equivalent "ask the app" hook, but it has
something that maps just as cleanly onto "duck it while I talk": Core
Audio's per-application session volume -- the same sliders in the Windows
Volume Mixer. While the assistant speaks, if Spotify's session volume is
above 30%, it's dropped to max(30%, current * 0.6) via pycaw, and restored
after a 1.2s debounce so back-to-back sentence chunks don't make the volume
yo-yo between them. Spotify is never launched if it isn't running: pycaw
only reports a session for it while it's actually running.

If pycaw (or its Win32 COM dependency) isn't available -- e.g. this got
imported on a non-Windows box -- every method here becomes a silent no-op.
Ducking is a nice-to-have; it must never be able to break a voice turn.
"""

from __future__ import annotations

import threading
from typing import Optional

try:
    from pycaw.pycaw import AudioUtilities

    _PYCAW_AVAILABLE = True
except Exception:
    _PYCAW_AVAILABLE = False

DUCK_THRESHOLD = 0.30
DUCK_FACTOR = 0.6
RESTORE_DEBOUNCE_SECONDS = 1.2


def _find_spotify_volume():
    """The pycaw SimpleAudioVolume interface for Spotify's session, or None."""
    if not _PYCAW_AVAILABLE:
        return None
    try:
        for session in AudioUtilities.GetAllSessions():
            proc = session.Process
            if proc is not None and proc.name().lower() == "spotify.exe":
                return session.SimpleAudioVolume
    except Exception:
        pass
    return None


class SpotifyDucker:
    """
    Call duck() when a sentence starts playing, release() when it stops.
    release() only restores the volume after RESTORE_DEBOUNCE_SECONDS with
    no further duck() calls, so consecutive sentence chunks in one reply
    don't cause the volume to bounce between them.
    """

    def __init__(self) -> None:
        self._original_volume: Optional[float] = None
        self._restore_timer: Optional[threading.Timer] = None
        self._lock = threading.Lock()

    def duck(self) -> None:
        if not _PYCAW_AVAILABLE:
            return
        with self._lock:
            if self._restore_timer is not None:
                self._restore_timer.cancel()
                self._restore_timer = None
            volume_iface = _find_spotify_volume()
            if volume_iface is None:
                return  # not running -- never launch it just to duck it
            try:
                current = volume_iface.GetMasterVolume()
            except Exception:
                return
            if self._original_volume is None:
                self._original_volume = current
            if current > DUCK_THRESHOLD:
                target = max(DUCK_THRESHOLD, current * DUCK_FACTOR)
                try:
                    volume_iface.SetMasterVolume(target, None)
                except Exception:
                    pass

    def release(self) -> None:
        if not _PYCAW_AVAILABLE:
            return
        with self._lock:
            if self._restore_timer is not None:
                self._restore_timer.cancel()
            timer = threading.Timer(RESTORE_DEBOUNCE_SECONDS, self._restore)
            timer.daemon = True
            self._restore_timer = timer
            timer.start()

    def _restore(self) -> None:
        with self._lock:
            self._restore_timer = None
            original, self._original_volume = self._original_volume, None
        if original is None:
            return
        volume_iface = _find_spotify_volume()
        if volume_iface is None:
            return
        try:
            volume_iface.SetMasterVolume(original, None)
        except Exception:
            pass
