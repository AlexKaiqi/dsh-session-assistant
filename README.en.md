# dsh-session-assistant

A Session-scoped product layer for discussing a request by voice, maintaining the current composer draft, and explicitly submitting the final text to the primary Agent.

## Architecture

- Host registers the DSH Settings namespace `session-assistant` with live application and the composition `Config` as its base layer.
- The first run may import `~/.dsh/session-assistant.json`, `talk-to-text.json`, or `chatvoice.json` only when no user overrides exist. Legacy files are never written.
- A strict plugin-owned Typert Remote exposes only revision-fenced `describe` and `save` operations for that namespace.
- Client UI is registered in `conversation.input.right`, `conversation.input.dock`, `conversation.chat.assistant-actions`, and `settings.section`.
- `dsh-realtime-voice` owns browser/provider media transports and exposes the provider-neutral `realtimeVoice` Client service.

The voice model can only call `update_working_draft`, `submit_to_agent`, or `end_voice_session`. Draft changes use `inputActions.setDraft(fullText)` and submission uses `inputActions.submit()`. Each controller remains bound to the Slot `sessionId`; disposed or closed controllers reject late tool application.

OpenAI and Doubao route/profile/voice choices remain settings, but this plugin consumes only normalized voice events. Read-aloud resolves finalized message text from Session state by `messageId`, never from rendered DOM.

## Verification

```bash
npm run check
```
