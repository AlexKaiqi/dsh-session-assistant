# Session Assistant 发布验收

这里维护 `dsh-session-assistant` 当前产品边界和可复核的发布证据。旧的“宠物 + 文本助手”产品设想保存在 `archive/`，不再参与发布判定。

## 发布门

- `release`：发布前必须在最新 run 中全部为 `passed`，并达到用例声明的最低证据等级。
- `benchmark`：真实 Provider 全双工和 30 分钟 soak 等高成本验证；可以是 `not-run` 或 `blocked`，但必须如实记录原因，不能计入 release 通过数。
- `L1` 是静态契约/纯函数证据，`L2` 是跨模块或本地传输证据，`L3` 是真实 DSH GUI、Session 或隔离 profile 证据，`L4` 是真实 Realtime Provider 音频证据。

Session Assistant 持有会话上下文、任务路由、产品 prompt、五个受控动作和 UI；`dsh-realtime-voice` 持有 Provider 与媒体传输；主 Agent 执行真正任务；可选 Personal Knowledge Base 持有知识投影、整理和提案授权。缺少可选知识插件时必须无损降级。

## 使用

```sh
npm run eval:check
```

校验器会验证 suite 与所有当前 run 的结构，并只用文件名排序后的最新 run 判定发布门。新增或修改产品能力时，应同步更新用例和一份新的真实 run；不要覆盖历史证据。
