# Changelog

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
