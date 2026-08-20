# dsh-session-assistant

Let a user think with a context-aware model through natural full-duplex speech, continuously maintain an editable draft, and finally submit a mature intent or finished text to the primary Agent.

This is the Session-scoped product and UI plugin. It does not connect to speech providers, read API keys, or execute tasks on behalf of the primary Agent.

## Boundary

- `dsh-session-assistant`: Session context projection, role, three voice operations, and UI.
- `dsh-realtime-voice`: registered-model discovery, credential resolution, OpenAI WebRTC, Doubao WebSocket, and provider session assembly.
- `dsh-personal-knowledge-base`: durable knowledge and current focus; not yet a hard dependency.

The voice model can only replace the complete draft, explicitly submit the final text to the primary Agent, or explicitly close the voice connection. Spoken discussion does not automatically mutate the draft. Agent tools, files, shell, network, and provider credentials are unavailable to the voice model.

Install `dsh-realtime-voice` before this plugin. Configure Realtime models and credentials in the existing DSH model registry; this plugin only selects available registered routes.

Session settings live at `~/.dsh/session-assistant.json`, with one-time fallback reads from the former Talk to Text settings files.
