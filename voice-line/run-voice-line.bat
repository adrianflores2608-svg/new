@echo off
REM Double-click convenience wrapper around run-voice-line.ps1.
REM Extra args pass through, e.g.: run-voice-line.bat --open-mic
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-voice-line.ps1" %*
