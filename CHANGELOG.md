# Changelog

## 0.1.6 (2026-08-16)

- 边听边改（方案 D）：聆听中真实打字立即接管输入框（isTrusted 区分），识别继续累积；停止时只把接管后新识别的文本追加到框尾，不覆盖用户修改；气泡提示「正在打字修改，识别继续…」
- Edit while listening: real keystrokes instantly take over the composer (isTrusted detection); recognition keeps accumulating and only the post-takeover text is appended on stop, never overwriting user edits; bubble hints "Typing, still listening…"

## 0.1.5 (2026-08-16)

- README 恢复标准双文件结构：README.md 纯英文 / README.zh-CN.md 纯中文，每个文件仅顶部一行语言切换链接（不再双语混排）
- README restored to the standard two-file layout: English-only README.md + Chinese-only README.zh-CN.md, with a single top switcher line per file

## 0.1.4 (2026-08-16)

- 自动朗读新增「范围」选项：只读最终结论（默认）/ 全部朗读（思维链+结论），设置页下拉切换
- README 合并为单文件双语版：页内锚点切换语言（不再跳页），EN 段用 demo.en.gif、中文段用 demo.gif
- 演示 GIF 识别文本只保留「你好世界」/「Hello world」（去掉第二句累积）
- Auto-read scope option: final conclusion only (default) or everything including thinking chains
- Single bilingual README with in-page anchor language switching; demo.en.gif for the English section, demo.gif for the Chinese section
- Demo GIFs keep a single final transcript: 你好世界 / Hello world

## 0.1.3 (2026-08-16)

- 自动朗读修复：speak 前 resume + 首次用户交互预热（0 音量空 utterance）解锁浏览器自动播放策略
- 自动朗读只读最终结论（新 UI 的 step/tool-call 交替结构下跳过思维链与中间步骤）
- 语音预览框配色对齐 dsh 风格：灰边框/箭头 + 蓝色光标（麦克风录制红点保留）
- 小喇叭恢复全挂（所有带正文的助手消息，含思维链）
- README 双语 GIF：docs/demo.gif（中文）/ docs/demo.en.gif（英文），保留朗读演示段
- Auto-read fix: resume() + first-interaction warm-up unlock the browser autoplay policy
- Auto-read speaks only the final conclusion (skips thinking chains in the new alternating flow)
- Preview bubble recolored to dsh-neutral (gray border, blue caret; mic recording dot stays red)
- Speaker buttons restored on every assistant message with a body
- Bilingual demo GIFs: docs/demo.gif (zh) / docs/demo.en.gif (en), read-aloud segment kept

## 0.1.2 (2026-08-16)

- 朗读小喇叭只挂在**最终结论**正文右上角（悬浮按钮），思维链/中间步骤不再显示喇叭
- 自动朗读同样只读最终结论，跳过思维链
- Speaker button now appears only on the final conclusion (floating at the top-right of the reply body), never on thinking-chain rows
- Auto-read also skips thinking chains and reads only final conclusions

## 0.1.1 (2026-08-16)

- 连续听写：点一次麦克风持续聆听，多句累积写入输入框，仅手动点击停止（不再说完一句自动停）
- 语音预览框即时化：点击即显「正在聆听…」聆听态（呼吸动画），锚定输入框正上方跟随滚动，停止淡出
- README 拆分中英两版（README.md 英文 / README.zh-CN.md 中文，顶部互链）
- Continuous dictation: mic listens until manually stopped, sentences accumulate in the composer
- Instant preview: "Listening…" state appears immediately on click, anchored above the composer with a fade-out on stop
- README split into English (README.md) and Chinese (README.zh-CN.md) editions with cross-links

## 0.1.0 (2026-08-16)

- MVP: composer 麦克风按钮 + SpeechRecognition 语音输入（中间结果实时上屏、权限/网络错误提示）
- 助手回复小喇叭朗读 + 自动朗读开关（可随时打断）+ Edge 中文自然音色自动选择
- dsh web 设置页 ChatVoice 分组（识别语言 / 自动朗读 / 音色 / 语速），保存即生效
- 非安全上下文 / 浏览器不支持 / 无麦克风权限均有可读提示
