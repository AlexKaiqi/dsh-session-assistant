# dsh-session-assistant

A Session-scoped product layer for discussing a request by voice, maintaining the current composer draft, and explicitly submitting the final text to the primary Agent.

## Architecture

- Host registers the DSH Settings namespace `session-assistant` with live application and the composition `Config` as its base layer.
- The first run may import `~/.dsh/session-assistant.json`, `talk-to-text.json`, or `chatvoice.json` only when no user overrides exist. Legacy files are never written.
- A strict plugin-owned Typert Remote exposes revision-fenced settings plus an optional, bounded Personal Knowledge context projection.
- Client UI is registered in `conversation.input.right`, `conversation.input.dock`, `conversation.chat.assistant-actions`, and `settings.section`; its microphone and status remain scoped to the current Session.
- Client copy is registered in one Host locale namespace and switches live with the global Chinese/English preference; the Chinese section title is “会话助手”.
- `dsh-realtime-voice` exposes one product capability: start a full-duplex voice conversation with an Agent. Provider protocols, browser media, interruption, and audio-input arbitration stay behind that boundary.
- Each Session starts a `VoiceConversation` as `session-assistant:<sessionId>` and registers product actions with `voiceAgent.registerActions` under the same owner prefix. This plugin still owns every authorization gate; if the global Pet Assistant or another voice product owns the microphone, startup fails explicitly instead of capturing in parallel.
- An empty Realtime route means automatic selection: both normal conversations and previews choose the first available route for the selected Provider protocol instead of passing an empty route to the unified voice runtime.
- **Knowledge-curation delegation**: the voice model can call `organize_notes` — when the user asks to organize, save, or remember the discussion, the tool settles immediately (the model keeps speaking) while the draft and recent session increments are handed to the dedicated text-model curator agent (the personal-knowledge maintainer, via the `sessionAssistantSettings/curate` Remote). On completion the dock shows the outcome and it is announced aloud: current-work projection updated plus durable-knowledge proposals. The curator only proposes; confirmation stays on the knowledge-base boundary.
- Session Assistant neither listens for nor emits pet events, and it does not own global standby, wake-word, or pet-personality behavior. Those capabilities belong to the independent Pet Assistant.

The voice model can only call `update_working_draft`, `submit_to_agent`, `end_voice_session`, or `organize_notes`; this plugin registers their executors with the runtime while keeping the product boundaries: draft changes use `inputActions.setDraft(fullText)`, submission uses `inputActions.submit()`, and curation is delegated to the curator agent. Each controller remains bound to the Slot `sessionId`; disposed or closed controllers reject late tool application.

OpenAI and Doubao route/profile/voice choices remain settings, but this plugin consumes only normalized voice events. Settings expose two distinct previews: the assistant-voice preview opens a receive-only Realtime session for the current model/voice without microphone access (and may consume a small amount of Provider quota), while the reply read-aloud preview enumerates browser voices and uses the current unsaved language, voice, and speed. Read-aloud resolves finalized message text from Session state by `messageId`, never from rendered DOM.

## Verification

```bash
npm run check
```

Run `npm run test:e2e:live` only after explicitly authorizing a billable Provider call. It sends generated speech through a browser virtual microphone, the unified `voiceAgent`, and the real Realtime Provider, then asserts that the actual Session Assistant draft executor updates the draft without submitting it.
