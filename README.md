# dsh-session-assistant

让用户通过自然语音与一个上下文感知的模型共同思考，并持续维护一份可编辑草稿，最终将成熟的意图或成品文本提交给主 Agent。

这是坐在当前 Session 上的产品/UI 插件。它不连接语音厂商、不读取 API Key，也不能替主 Agent 执行任务。

## 当前实现状态

- 已有：当前草稿、工作区名和最近 6 条可见消息投影；双工语音讨论；改稿、显式提交、结束；切换 Session 防串写。
- 尚未完成：宠物入口/气泡桥接、独立文本助手、新建 Session、文件树/git/终端上下文。因此目前不能声称“宠物已经接入助手或实时语音”。
- 实施门槛：先让文本助手完成问答、草稿、显式提交和会话编排，再让宠物消费中性的 `assistant.*` 状态，最后验证真实双工语音的等价行为。

跨插件的 26 项发布/边界用例维护在 [`evals/suite.json`](evals/suite.json)，首轮真实缺口记录在 [`evals/runs/2026-08-21-baseline.json`](evals/runs/2026-08-21-baseline.json)。

## 边界

- `dsh-session-assistant`：绑定启动时聚焦的 Session，负责上下文投影、角色、三项语音操作和页面 UI。
- `dsh-multi-model-provider`：Realtime 模型目录、选择、凭据解析、Profile runtime 和 adapter contract。
- `dsh-realtime-voice`：可选的 GPT Realtime／豆包 Duplex adapter 与浏览器音频传输实现。

语音模型只得到以下能力：

1. `update_working_draft`：用完整文本更新当前草稿。
2. `submit_to_agent`：用户明确说“提交/执行”后，将完整文本放入输入区并提交给主 Agent。
3. `end_voice_session`：用户明确要求结束时关闭语音连接；不提交内容。

讨论中的口头回复不会自动进入草稿。语音模型不能访问主 Agent 工具、文件、终端、网络或 Provider 凭据。

## 运行依赖

本插件只依赖 `dsh-multi-model-provider` 的统一 runtime。使用 GPT Realtime 或豆包 Duplex 时另装 `dsh-realtime-voice` adapter；浏览器原生听写不需要它。Realtime 模型及凭据统一在 DSH 模型注册中配置，本插件只选择可用路由。

一次语音连接绑定启动时的 `focusedSessionId`。切换 Session 不会悄悄改变草稿或提交目标；切回原 Session 后才允许继续修改或提交。

浏览器兜底听写与主 Agent 回复朗读仍保留。Session 配置保存在 `~/.dsh/session-assistant.json`，首次运行会读取旧的 `talk-to-text.json` 作为迁移来源。

设置页先选择实时语音 Provider，再按能力显示配置：浏览器原生只提供识别语言；OpenAI Realtime 提供已注册模型、官方内置输出音色和上下文范围；豆包 Duplex 直接选择模型目录中已启用的实时音色和上下文范围。主 Agent 回复朗读是独立的浏览器能力，音色下拉来自当前浏览器实际返回的 `speechSynthesis` 音色目录，和实时语音 Provider 不混用。

## 验证

```bash
pnpm test
pnpm check
pnpm eval:check
```

个人知识库不是核心依赖；跨 Session 的长期记忆可在未来作为可选只读增强。
