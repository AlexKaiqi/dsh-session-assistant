# dsh-session-assistant

Let a user think with a context-aware model through natural full-duplex speech, continuously maintain an editable draft, and finally submit a mature intent or finished text to the primary Agent.

This is the Session-scoped product and UI plugin. It does not connect to speech providers, read API keys, or execute tasks on behalf of the primary Agent.

## Boundary

- `dsh-session-assistant`: binds the focused Session at voice start and owns context projection, role, three voice operations, and UI.
- `dsh-multi-model-provider`: Realtime catalog, selection, credential resolution, profile runtime, and adapter contract.
- `dsh-realtime-voice`: optional GPT Realtime and Doubao Duplex adapters plus browser audio transports.

The voice model can only replace the complete draft, explicitly submit the final text to the primary Agent, or explicitly close the voice connection. Spoken discussion does not automatically mutate the draft. Agent tools, files, shell, network, and provider credentials are unavailable to the voice model.

This plugin depends only on the unified runtime in `dsh-multi-model-provider`. Install `dsh-realtime-voice` when GPT Realtime or Doubao Duplex transport is needed; browser-native dictation does not require it. Configure Realtime models and credentials in the DSH model registry; this plugin only selects available routes.

One voice connection remains bound to the `focusedSessionId` captured at startup. Changing focus never silently retargets draft mutation or submission. A personal knowledge base is not a core dependency.

Session settings live at `~/.dsh/session-assistant.json`, with one-time fallback reads from the former Talk to Text settings files.
