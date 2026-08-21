# dsh-session-assistant

面向当前 Session 的语音讨论与草稿产品层：与用户讨论请求、维护主输入区草稿，并在用户明确授权后提交给主 Agent。

## 架构

- Host 通过 DSH Settings 注册 `session-assistant` 命名空间，以组合 `Config` 为 base，并声明 `applies: live`。
- 仅当命名空间没有用户覆盖时，首次启动可从 `~/.dsh/session-assistant.json`、`talk-to-text.json` 或 `chatvoice.json` 导入一次；之后不再写这些旧文件。
- 插件自有的严格 Typert Remote 只公开带 revision 防冲突的 `describe` 与 `save`。
- Client UI 精确注册到 `conversation.input.right`、`conversation.input.dock`、`conversation.chat.assistant-actions` 和 `settings.section`。
- `dsh-realtime-voice` 负责浏览器与 Provider 媒体传输，并提供中立的 `realtimeVoice` Client 服务。

语音模型只有 `update_working_draft`、`submit_to_agent` 和 `end_voice_session` 三项操作。草稿修改只调用 `inputActions.setDraft(fullText)`，提交只调用 `inputActions.submit()`。每个 controller 绑定 Slot 提供的 `sessionId`；组件、Session 或连接释放后，迟到的工具调用不会再修改或提交草稿。

OpenAI／豆包路由、Profile、音色、浏览器识别、上下文与朗读选项继续保留，但本插件只消费标准化语音事件。朗读动作通过 finalized `messageId` 从 Session 快照解析正文，不读取页面 DOM。

## 验证

```bash
npm run check
```
