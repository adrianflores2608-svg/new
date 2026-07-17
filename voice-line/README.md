# voice-line

Hold a key anywhere on Windows, talk, release it, and hear Claude's reply
through your speakers a couple seconds later.

```
mic -> ears (sounddevice capture)
    -> local whisper.cpp server, port 2022 (/v1/audio/transcriptions)
    -> warm Claude Agent SDK session (streaming, one client for the whole conversation)
    -> mouth (sentence-chunked TTS via local Kokoro, port 8880, cancellable playback)
    -> speakers
```

Half-duplex: the mic is fully closed while the mouth is speaking, so the
system never hears itself. Pressing the key while it's talking cuts it off
immediately -- that's what makes it safe to run on open speakers with no
headphones.

Voice: **Kokoro** (free, fully local, no API key). Default voice `bm_lewis`.

## One-time setup

Requires [uv](https://docs.astral.sh/uv/) and, for the local servers,
Git + CMake + a C++ toolchain (whisper.cpp) and Docker Desktop (Kokoro).

```powershell
cd voice-line
.\setup.ps1
```

This builds/starts whisper.cpp on port 2022, pulls/starts the Kokoro Docker
container on port 8880, and runs `uv sync` for the Python environment. Every
step skips itself if it's already done, so it's safe to re-run any time.

If a step fails (e.g. no C++ compiler installed yet), it prints the exact
command to fix it and stops -- install that, then re-run `.\setup.ps1`.

## Launch

```powershell
cd voice-line
.\run-voice-line.ps1
```

Or double-click `run-voice-line.bat`. Add `--open-mic` for the legacy
continuous-listening mode, or `--project C:\path\to\project` to point the
session at a specific project's `CLAUDE.md`.

**Never run this as a background/scheduled task.** It's a live mic. Run it
in a terminal you can see, and close the terminal to stop it.

The first thing you'll hear is voice-line's own greeting -- that's the
warmup turn paying the prompt-cache toll up front so it doesn't cost you the
first few seconds of silence on your first real question.

## Controls cheat sheet

| Action | What happens |
|---|---|
| Hold `Right Ctrl` | Mic opens (state: listening) |
| Release `Right Ctrl` | Mic closes 0.18s later, transcribes, sends to Claude |
| Tap `Right Ctrl` for < 250ms | Ignored -- not treated as an utterance |
| Press `Right Ctrl` while it's talking | Interrupts playback immediately, starts listening |
| Type a line + Enter | Same as speaking it -- gets a spoken reply |
| Start typing while it's talking | Interrupts playback immediately |
| Paste (any size/shape) | Assembled into one message; long pastes echo as `[pasted N chars]` |
| Say/type "goodbye", "end voice mode", or "hang up" | Speaks a short farewell, ends the session |
| Ctrl-C | Ends the session immediately |

Change the hold key with `$env:VOICE_LINE_PTT_KEY = "f9"` before launching
(any single character, or a pynput key name like `f9`, `pause`, `caps_lock`).

## Environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `VOICE_LINE_PTT_KEY` | `ctrl_r` | Hold-to-talk key |
| `VOICE_LINE_PROJECT_DIR` | current directory | Project whose `CLAUDE.md` defines the assistant's identity |
| `VOICE_LINE_MODEL` | SDK/CLI default | Override the model |
| `VOICE_LINE_PERMISSION_MODE` | unset (project default) | `acceptEdits` or `bypassPermissions` for zero-friction tool use. There's no terminal to answer a permission prompt in a voice session, so a tool call needing approval otherwise just hangs the turn in silence. This is a real safety trade-off, so it's opt-in. |
| `VOICE_LINE_WHISPER_URL` | `http://127.0.0.1:2022/v1/audio/transcriptions` | Whisper server route |
| `VOICE_LINE_KOKORO_URL` | `http://127.0.0.1:8880/v1/audio/speech` | Kokoro server route |
| `VOICE_LINE_KOKORO_VOICE` | `bm_lewis` | Kokoro voice ID |

## The signal bus (for a visualizer)

Plain files written in this project root, throttled and wrapped in
try/except so a watcher glitch can never crash the voice line:

- `.voice_state` -- `idle` / `listening` / `thinking` / `speaking`
- `.voice_waveform` -- `{"ts": <unix float>, "samples": [64 floats]}`, written at most 15x/sec while audio plays
- `.voice_loading_pid` -- reserved for an optional "thinking sound" (see Known limitations)

`.voice_state` self-heals: every waveform write also re-writes state to
`speaking`, so a stray process stomping the state file gets corrected within
about 70ms. `.voice_alert` is never written by this project -- it's reserved
for some other process to flag the visualizer.

## Verify before you trust it

1. `.\setup.ps1` reports both servers up.
2. Full turn: hold the key, speak, release, hear the reply.
3. Press the key mid-reply -- playback stops immediately.
4. Ask something that needs a tool (e.g. "what files are in this folder") --
   you should hear brief filler within a couple seconds, then the answer,
   not dead air followed by both glued together.
5. Nothing plays twice; talking near an open mic while it's your turn to
   listen doesn't get picked up by the transcriber, because the mic is
   closed the rest of the time.

## Known limitations / deliberate omissions

- **ElevenLabs isn't wired in.** Kokoro was the chosen voice. `mouth.py` is
  structured so a second provider could be added behind the same
  `enqueue()`/interrupt API, but no ElevenLabs code exists yet -- ask if you
  want it added later.
- **No thinking-sound audio.** `.voice_loading_pid` is defined in
  `signals.py` for a visualizer contract, but nothing currently plays a
  sound or writes that file, since no audio asset was provided.
- **No arrow-key line editing.** The typed-input reader is a *tiny* editor:
  characters, backspace, Enter, and paste. No cursor movement, no history.
- **Paste detection needs a VT-capable terminal** (Windows Terminal,
  ConEmu). Plain `conhost.exe`/legacy `cmd.exe` windows will still accept
  pastes, they just won't get the "echo as a character count" treatment.
- **ffmpeg isn't required.** It's only needed for ElevenLabs mp3 decoding,
  which isn't wired in. Whisper input is written as WAV directly (Python's
  stdlib `wave` module); Kokoro output is already raw PCM.
