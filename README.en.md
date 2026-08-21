# dsh-session-assistant

A Session-scoped product layer for discussing a request by voice, maintaining the current composer draft, and explicitly submitting the final text to the primary Agent.

## Architecture

- Host registers the DSH Settings namespace `session-assistant` with live application and the composition `Config` as its base layer.
- The first run may import `~/.dsh/session-assistant.json`, `talk-to-text.json`, or `chatvoice.json` only when no user overrides exist. Legacy files are never written.
- A strict plugin-owned Typert Remote exposes revision-fenced settings plus an optional, bounded Personal Knowledge context projection.
- Client UI is registered in `conversation.input.right`, `conversation.input.dock`, `conversation.chat.assistant-actions`, and `settings.section`.
- Client copy is registered in one Host locale namespace and switches live with the global Chinese/English preference; the Chinese section title is “会话助手”.
- `dsh-realtime-voice` owns browser/provider media transports and exposes the provider-neutral `realtimeVoice` Client service.
- The current Session microphone responds to `dsh-pet-assistant:activate` and projects only public lifecycle/transcript fields through `dsh-pet-assistant:state`; the pet and composer affordances share one `VoiceController`.

The voice model can only call `update_working_draft`, `submit_to_agent`, or `end_voice_session`. Draft changes use `inputActions.setDraft(fullText)` and submission uses `inputActions.submit()`. Each controller remains bound to the Slot `sessionId`; disposed or closed controllers reject late tool application.

OpenAI and Doubao route/profile/voice choices remain settings, but this plugin consumes only normalized voice events. Settings expose two distinct previews: the assistant-voice preview opens a receive-only Realtime session for the current model/voice without microphone access (and may consume a small amount of Provider quota), while the reply read-aloud preview enumerates browser voices and uses the current unsaved language, voice, and speed. Read-aloud resolves finalized message text from Session state by `messageId`, never from rendered DOM.

## Verification

```bash
npm run check
```
