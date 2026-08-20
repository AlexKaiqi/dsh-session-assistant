# Session Assistant model surface

The files here have separate, unique change sources:

- `prompt.js` changes only when the Session Assistant role, execution boundary, or spoken/draft separation policy changes.
- `tool-surface.js#SESSION_ASSISTANT_TOOLS` changes only when the callable UI operation contract changes.
- `tool-surface.js#SESSION_ASSISTANT_TOOL_OUTPUT` changes only when the tool-result contract changes.

The browser executes these UI-local operations. No filesystem, shell, network, Agent tool, or credential is exposed to the voice model. Realtime provider credentials are resolved by `dsh-multi-model-provider`; provider adapters never expose them to the browser model.
