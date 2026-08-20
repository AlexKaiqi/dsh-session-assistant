# dsh-session-assistant

让用户通过自然语音与一个上下文感知的模型共同思考，并持续维护一份可编辑草稿，最终将成熟的意图或成品文本提交给主 Agent。

这是坐在当前 Session 上的产品/UI 插件。它不连接语音厂商、不读取 API Key，也不能替主 Agent 执行任务。

## 边界

- `dsh-session-assistant`：当前 Session 的上下文投影、角色、三项语音操作和页面 UI。
- `dsh-realtime-voice`：注册模型发现、凭据解析、OpenAI WebRTC、豆包 WebSocket 和 Provider 会话装配。
- `dsh-personal-knowledge-base`：长期知识及当前 focus；尚未作为本插件的硬依赖。

语音模型只得到以下能力：

1. `update_working_draft`：用完整文本更新当前草稿。
2. `submit_to_agent`：用户明确说“提交/执行”后，将完整文本放入输入区并提交给主 Agent。
3. `end_voice_session`：用户明确要求结束时关闭语音连接；不提交内容。

讨论中的口头回复不会自动进入草稿。语音模型不能访问主 Agent 工具、文件、终端、网络或 Provider 凭据。

## 运行依赖

先安装 `dsh-realtime-voice`，再安装本插件。Realtime 模型及凭据继续在 DSH 模型注册中配置；本插件的设置页只选择已注册的可用路由。

浏览器兜底听写与主 Agent 回复朗读仍保留。Session 配置保存在 `~/.dsh/session-assistant.json`，首次运行会读取旧的 `talk-to-text.json` 作为迁移来源。

## 验证

```bash
pnpm test
pnpm check
```

当前拆分先保持已有可用体验；低成本唤醒/待机、宠物角色和个人知识接入将在此边界稳定后分别设计。
