"""
The warm Claude Agent SDK session -- one ClaudeSDKClient per voice session,
created at launch and held open for the whole conversation so every turn
after the first is fast. The first turn pays a prompt-cache toll of a few
seconds; warmup() burns that toll before you've said a word, disguised as a
spoken greeting.

A word on permission_mode: this is a hands-free interface. There is no
terminal prompt a voice session can answer, so a tool call that needs
approval will just hang the turn in silence. Left at the SDK/project default
(unset here), it inherits whatever your project's own settings say. If you
want zero-friction tool use for voice, set VOICE_LINE_PERMISSION_MODE
(acceptEdits or bypassPermissions) -- that's a real safety trade-off, so it's
opt-in, not the default.
"""

from __future__ import annotations

import re
from typing import Callable, Optional

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    StreamEvent,
)

QUIT_PHRASES = {"goodbye", "end voice mode", "hang up"}

SPOKEN_DISCIPLINE = """
You are in a live voice conversation, spoken aloud through text-to-speech at the user's desk. Write for the ear, not the eye.
Use short, conversational sentences -- talk like you're sitting across the desk, not drafting a report.
Never use markdown: no headers, no bold or italics, no bullet or numbered lists, no code blocks. If you'd normally write a list, say it as flowing sentences instead.
Punctuation is your delivery: TTS performs periods, commas, and question marks as the rhythm of speech, so use them deliberately. Flat, uniform sentences read aloud sound flat and dead -- vary them.
If you're about to use a tool and it will take more than a moment, say something short and natural first, like "let me check" or "one sec, looking," so there's no dead air while it runs.
Only describe code in words unless the user explicitly asks to hear it read out loud.
""".strip()

_SENTENCE_END_RE = re.compile(r'[.!?]+[\'")\]]*\s+')


def is_quit_phrase(text: str) -> bool:
    normalized = text.strip().lower().rstrip(".!? ")
    return normalized in QUIT_PHRASES


class SentenceChunker:
    """
    Turns a stream of text deltas into sentences ready for the mouth.

    The first sentence of a reply ships alone, as fast as possible, so first
    audio lands quickly. After that, sentences ship in pairs ("two-sentence
    breaths"), since lone short sentences played back to back sound flat.

    CRITICAL: flush() must run on every content_block_stop, not only at the
    end of the whole turn. If you only flush on sentence-ending punctuation,
    pre-tool filler like "let me check" sits in the buffer silently for the
    entire tool call and then plays glued to the answer that follows it.
    """

    def __init__(self) -> None:
        self._buf = ""
        self._held: list[str] = []
        self._first_done = False

    def feed(self, text: str) -> list[str]:
        self._buf += text
        out: list[str] = []
        while True:
            match = _SENTENCE_END_RE.search(self._buf)
            if not match:
                break
            sentence = self._buf[: match.end()].strip()
            self._buf = self._buf[match.end():]
            if sentence:
                out.extend(self._commit(sentence))
        return out

    def flush(self) -> list[str]:
        out: list[str] = []
        tail = self._buf.strip()
        self._buf = ""
        if tail:
            out.extend(self._commit(tail))
        if self._held:
            out.append(" ".join(self._held))
            self._held = []
        return out

    def _commit(self, sentence: str) -> list[str]:
        if not self._first_done:
            self._first_done = True
            return [sentence]
        self._held.append(sentence)
        if len(self._held) >= 2:
            chunk = " ".join(self._held)
            self._held = []
            return [chunk]
        return []


class Brain:
    def __init__(
        self,
        cwd: str,
        model: Optional[str] = None,
        permission_mode: Optional[str] = None,
    ) -> None:
        kwargs = {
            "cwd": cwd,
            "system_prompt": {
                "type": "preset",
                "preset": "claude_code",
                "append": SPOKEN_DISCIPLINE,
            },
            "include_partial_messages": True,
        }
        if model:
            kwargs["model"] = model
        if permission_mode:
            kwargs["permission_mode"] = permission_mode
        self._options = ClaudeAgentOptions(**kwargs)
        self._client: Optional[ClaudeSDKClient] = None

    async def __aenter__(self) -> "Brain":
        self._client = ClaudeSDKClient(options=self._options)
        await self._client.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> Optional[bool]:
        if self._client is not None:
            return await self._client.__aexit__(exc_type, exc, tb)
        return None

    async def warmup(self, on_sentence: Callable[[str], None]) -> None:
        await self.send(
            "We're just opening a live voice conversation at my desk. "
            "Greet me in one short, warm sentence. Nothing else.",
            on_sentence,
        )

    async def send(self, text: str, on_sentence: Callable[[str], None]) -> None:
        assert self._client is not None, "Brain used before entering its context"
        chunker = SentenceChunker()

        await self._client.query(text)
        async for message in self._client.receive_response():
            if isinstance(message, StreamEvent):
                event = message.event
                event_type = event.get("type")
                if event_type == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        for sentence in chunker.feed(delta.get("text", "")):
                            on_sentence(sentence)
                elif event_type == "content_block_stop":
                    for sentence in chunker.flush():
                        on_sentence(sentence)
            elif isinstance(message, ResultMessage):
                pass  # turn is done; main.py decides what happens next

        for sentence in chunker.flush():  # safety net for any unflushed tail
            on_sentence(sentence)
