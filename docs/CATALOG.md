# 功能蓝图 · 96 项对照表

> 本文件由 `node scripts/gen-catalog.mjs` 自动生成，状态来自 `src/core/registry.js` 的真实注册结果，请勿手改。

参考目录只登记**功能名称与分类**这类事实，不包含对方的描述文案、题目、数据或素材；每个工具的实现均为本项目独立编写。

## 进度

| 指标 | 数量 |
| --- | --- |
| 参考功能点 | 96 |
| 已实现 | 91 |
| 待开发（原生可实现） | 2 |
| 本地替代待开发 | 3 |
| 授权排除 | 0 |
| 独立实现（替代原授权排除项） | 1 |
| 降级实现（可运行但能力有差异） | 11 |
| xiaoyuTools 实际工具总数 | 118 |

实际工具数会大于「参考目录已实现数」，因为还包含一批本项目自写、不在参考目录里的工具。

## 原生可实现（78 项）

| 功能点 | 参考分类 | 状态 | 说明 / 本地替代 | 实现 id |
| --- | --- | --- | --- | --- |
| 图片镜头动画 | image | 已实现 | ⚠ 降级 · Canvas 逐帧运镜 + MediaRecorder 录为 WebM 片段 | photo-motion-maker |
| AI 图片元数据查看器 | image | 已实现 | 解析 PNG 文本块与 JPEG 注释段，不做 OCR | ai-image-metadata-viewer |
| 图片转 PDF | image | 已实现 | 浏览器原生 API 可独立实现 | image-to-pdf |
| 图片拼接长图 | image | 已实现 | 浏览器原生 API 可独立实现 | image-stitch |
| 压缩图片 | image | 已实现 | 浏览器原生 API 可独立实现 | compress-image |
| JPG 转 PNG | image | 已实现 | 浏览器原生 API 可独立实现 | image-convert |
| PNG 转 JPG | image | 已实现 | 浏览器原生 API 可独立实现 | png-to-jpg |
| JPG 转 WebP | image | 已实现 | 浏览器原生 API 可独立实现 | jpg-to-webp |
| PNG 转 WebP | image | 已实现 | 浏览器原生 API 可独立实现 | png-to-webp |
| WebP 转 JPG | image | 已实现 | 浏览器原生 API 可独立实现 | webp-to-jpg |
| WebP 转 PNG | image | 已实现 | 浏览器原生 API 可独立实现 | webp-to-png |
| 图片九宫格切割 | image | 已实现 | 浏览器原生 API 可独立实现 | image-grid-split |
| 无缝切图 | image | 已实现 | 浏览器原生 API 可独立实现 | carousel-splitter |
| 裁剪图片 | image | 已实现 | 浏览器原生 API 可独立实现 | image-crop |
| 调整图片大小 | image | 已实现 | 浏览器原生 API 可独立实现 | image-resizer |
| 翻转和旋转图片 | image | 已实现 | 浏览器原生 API 可独立实现 | flip-image |
| 圆形裁剪 | image | 已实现 | 浏览器原生 API 可独立实现 | circle-crop |
| 字幕检查与同步修复 | video | 已实现 | 浏览器原生 API 可独立实现 | subtitle-repair |
| 视频截图 | video | 已实现 | 浏览器原生 API 可独立实现 | video-screenshot |
| 视频转音频 | video | 已实现 | ⚠ 降级 · decodeAudioData 导出 WAV；失败时可实时录制为 WebM | video-to-audio |
| MP3 转 WAV | audio | 已实现 | 浏览器自带解码器 → 16 位 PCM WAV（能否解码取决于浏览器） | mp3-to-wav |
| 节拍器 | audio | 已实现 | 浏览器原生 API 可独立实现 | metronome |
| BPM 检测器 | audio | 已实现 | 浏览器原生 API 可独立实现 | bpm-detector |
| 噪音生成器 | audio | 已实现 | 浏览器原生 API 可独立实现 | noise-generator |
| 歌词波形播放器 | audio | 已实现 | 浏览器原生 API 可独立实现 | lyric-visualizer |
| 字数统计 | text | 已实现 | 浏览器原生 API 可独立实现 | text-stats |
| Lorem Ipsum 生成器 | text | 已实现 | 浏览器原生 API 可独立实现 | lorem-ipsum-generator |
| 花式文字生成器 | text | 已实现 | 浏览器原生 API 可独立实现 | fancy-text-generator |
| 摩斯电码翻译器 | text | 已实现 | 浏览器原生 API 可独立实现 | morse-code-translator |
| JSON 格式化 | text | 已实现 | 浏览器原生 API 可独立实现 | json-format |
| 发票生成器 | text | 已实现 | 浏览器原生 API 可独立实现 | invoice-generator |
| Markdown 编辑器 | text | 已实现 | 浏览器原生 API 可独立实现 | markdown-preview |
| 文本对比 | text | 已实现 | 浏览器原生 API 可独立实现 | text-diff |
| 哈希生成器 | text | 已实现 | 浏览器原生 API 可独立实现 | hash |
| 文字动画制作器 | creative | 已实现 | 浏览器原生 API 可独立实现 | text-animation-maker |
| 年龄计算器 | calculator | 已实现 | 浏览器原生 API 可独立实现 | age-calculator |
| 单位换算 | calculator | 已实现 | 浏览器原生 API 可独立实现 | unit-converter |
| 百分比计算器 | calculator | 已实现 | 浏览器原生 API 可独立实现 | percentage-calculator |
| BMI 计算器 | calculator | 已实现 | 浏览器原生 API 可独立实现 | bmi-calculator |
| 小费计算器 | calculator | 已实现 | 浏览器原生 API 可独立实现 | tip-calculator |
| 房贷计算器 | calculator | 已实现 | 浏览器原生 API 可独立实现 | mortgage |
| 会议成本计算器 | calculator | 已实现 | 浏览器原生 API 可独立实现 | meeting-cost-calculator |
| 打字速度测试 | time | 已实现 | 浏览器原生 API 可独立实现 | typing-test |
| 秒表 | time | 已实现 | 浏览器原生 API 可独立实现 | stopwatch |
| 倒计时器 | time | 已实现 | 浏览器原生 API 可独立实现 | countdown-timer |
| 世界时钟 | time | 已实现 | 浏览器原生 API 可独立实现 | world-clock |
| 番茄钟 | time | 已实现 | 浏览器原生 API 可独立实现 | pomodoro-timer |
| 时间戳转换 | time | 已实现 | 浏览器原生 API 可独立实现 | timestamp |
| Emoji 搜索 | creative | 已实现 | 浏览器原生 API 可独立实现 | emoji-finder |
| 白板 | creative | 已实现 | 浏览器原生 API 可独立实现 | whiteboard |
| 今天吃什么？ | creative | 已实现 | 浏览器原生 API 可独立实现 | what-to-eat |
| 问命运 | creative | 已实现 | 浏览器原生 API 可独立实现 | ask-fate |
| 键盘测试 | creative | 已实现 | 浏览器原生 API 可独立实现 | keyboard-tester |
| 随机转盘 | creative | 已实现 | 浏览器原生 API 可独立实现 | random-spinner |
| 反应速度测试 | creative | 已实现 | 浏览器原生 API 可独立实现 | reaction-time-test |
| CPS 测试 | creative | 已实现 | 浏览器原生 API 可独立实现 | cps-test |
| 瞄准训练 | creative | 已实现 | 浏览器原生 API 可独立实现 | aim-trainer |
| 麦克风与摄像头测试 | creative | 已实现 | 浏览器原生 API 可独立实现 | mic-camera-test |
| 像素画转换器 | creative | 已实现 | 浏览器原生 API 可独立实现 | pixel-art-converter |
| 抛硬币 | creative | 已实现 | 浏览器原生 API 可独立实现 | coin-flip |
| 掷骰子 | creative | 已实现 | 浏览器原生 API 可独立实现 | dice-roller |
| 密码生成器 | creative | 已实现 | 浏览器原生 API 可独立实现 | password |
| 取色器 | creative | 已实现 | 浏览器原生 API 可独立实现 | color |
| 渐变生成器 | creative | 已实现 | 浏览器原生 API 可独立实现 | gradient-generator |
| 日程规划 | creative | 已实现 | 浏览器原生 API 可独立实现 | daily-planner |
| 签名生成器 | creative | 已实现 | 浏览器原生 API 可独立实现 | signature-maker |
| 闪卡生成器 | creative | 已实现 | 浏览器原生 API 可独立实现 | flashcard-maker |
| CSV 图表生成器 | creative | 已实现 | 浏览器原生 API 可独立实现 | chart-maker |
| 世界节日 | creative | 已实现 | 浏览器原生 API 可独立实现 | holidays |
| 物品定位器 | creative | 已实现 | 浏览器原生 API 可独立实现 | item-locator |
| ASCII 艺术 | creative | 已实现 | 浏览器原生 API 可独立实现 | ascii-art |
| ASCII 横幅 | creative | 已实现 | 浏览器原生 API 可独立实现 | ascii-banner |
| MIDI 键盘 | creative | 已实现 | 浏览器原生 API 可独立实现 | midi-keyboard |
| 丝网印刷滤镜 | image | 已实现 | 浏览器原生 API 可独立实现 | silk-screen |
| 大冒险轮盘 | creative | 已实现 | 浏览器原生 API 可独立实现 | spin-the-dare |
| 呼吸放松指南 | creative | 已实现 | 浏览器原生 API 可独立实现 | breathing-relaxation |
| 情感漠视测试 | selftest | 待开发 | 浏览器原生 API 可独立实现 | — |
| 戒烟追踪器 | selftest | 待开发 | 浏览器原生 API 可独立实现 | — |

## 需第三方库（13 项）

| 功能点 | 参考分类 | 状态 | 说明 / 本地替代 | 实现 id |
| --- | --- | --- | --- | --- |
| PDF 转图片 | pdf | 已实现 | ⚠ 降级 · 本地 pdf.js 逐页渲染为 PNG/JPEG 并打包（图片型，不含文本层） | pdf-to-image |
| 合并 PDF | pdf | 已实现 | 需 PDF 结构库，本项目使用本地 MIT 库实现 | merge-pdf |
| 压缩 PDF | pdf | 已实现 | ⚠ 降级 · 重渲染为 JPEG 后用 pdf-lib 重组（有损，丢失文本层与矢量图形） | compress-pdf |
| PDF 转 Word | pdf | 已实现 | ⚠ 降级 · 独立实现：pdf.js 读文本层与坐标 → 自写版面重排 → 自写 OOXML → JSZip 打包 docx；扫描页转为图片嵌入 | pdf-to-word |
| Word 转 PDF | pdf | 已实现 | ⚠ 降级 · JSZip 读 docx 段落文字 → Canvas 按 A4 排版 → 图片型 PDF（简化实现） | word-to-pdf |
| 移除背景 | image | 已实现 | ⚠ 降级 · 按颜色容差做色键抠图，纯色背景有效，非 AI 分割模型 | background-remover |
| HEIC 转 JPG | image | 已实现 | 本地 heic2any（MIT，自带内联 worker）解码，不上传照片 | heic-to-jpg |
| AI 转 PNG | image | 已实现 | ⚠ 降级 · 提取 .ai 内嵌的 PDF 兼容预览流，渲染第一页为 PNG | ai-to-png |
| 压缩视频 | video | 已实现 | ⚠ 降级 · Canvas 逐帧绘制 + 浏览器原生编码器重录为 WebM | compress-video |
| 视频转 GIF | video | 已实现 | 逐帧取样后用本项目自写的 GIF89a / LZW 编码器导出 | video-to-gif |
| WAV 转 MP3 | audio | 已实现 | ⚠ 降级 · 浏览器原生 MediaRecorder 输出 WebM/Opus 或 MP4/AAC | wav-to-mp3 |
| 提取文本 | text | 已实现 | ⚠ 降级 · 读取 PDF 文本层 / Office XML / 纯文本；扫描件不做 OCR | extract-text |
| 二维码生成器 | creative | 已实现 | 二维码纠错编码算法较复杂，本项目使用本地 MIT 库实现 | qr-code-generator |

## 需联网 / Key（5 项）

| 功能点 | 参考分类 | 状态 | 说明 / 本地替代 | 实现 id |
| --- | --- | --- | --- | --- |
| 文本转语音 | text | 已实现 | 浏览器内置 speechSynthesis 本地语音合成（非神经音色） | text-to-speech |
| AI 人生轨迹 | ai | 本地替代待开发 | 本地问卷 + 路径推演模板 | — |
| AI 塔罗牌 | ai | 本地替代待开发 | 本地抽牌 + 自写牌义文本，不做 AI 解读 | — |
| AI 前任聊天 | ai | 本地替代待开发 | 改为聊天文本风格分析（本地统计），不复刻他人语气 | — |
| AI 文字冒险 | ai | 已实现 | 本地分支剧情状态机 + 自写剧本 | ai-text-adventure |

## 本项目自写、不在参考目录内的工具

共 27 项：

- Base64 编解码（`base64` · 开发者）
- URL 编解码（`url-codec` · 开发者）
- UUID 生成器（`uuid` · 开发者）
- JWT 解析（`jwt-view` · 开发者）
- 文本清洗（`text-clean` · 文本）
- 图片配色提取（`palette` · 图片）
- 复利 / 定投计算（`compound-interest` · 计算换算）
- 收支结余测算（`budget-ratio` · 计算换算）
- 压缩到指定大小（`compress-to-size` · 图片）
- 证件照裁剪（`passport-photo` · 图片）
- SVG 转 PNG（`svg-to-png` · 图片）
- 图片转 ICO（`image-to-ico` · 图片）
- 图片调色（`image-adjust` · 图片）
- 图片圆角（`round-corners` · 图片）
- 图片加水印（`image-watermark` · 图片）
- 区域模糊打码（`region-blur` · 图片）
- 故障艺术效果（`glitch-effect` · 图片）
- 图片叠加（`image-overlay` · 图片）
- EXIF 查看 / 清除（`exif-tool` · 图片）
- DPI 检查 / 修改（`dpi-tool` · 图片）
- 多图合成 GIF（`images-to-gif` · 图片）
- GIF 压缩（`gif-compressor` · 图片）
- GIF 拆帧（`gif-frame-extractor` · 图片）
- GIF 编辑（`gif-editor` · 图片）
- GIF 合并（`gif-merger` · 图片）
- GIF 雪碧图（`gif-sprite` · 图片）
- GIF 转视频（`gif-to-video` · 图片）

## 边界

- 参考项目的 PDF 转 Word 引擎适用独立书面授权，本项目**不复刻该引擎**；此功能改用完全独立的实现：pdf.js 读文本层 → 自写规则重排 → 自写 OOXML → JSZip 打包。未阅读、未引用其任何源码或算法文档。
- `online` 组原功能依赖联网 AI 服务 / API Key；本项目提供本地等价替代，接口适配器默认关闭、不发请求。
- `library` 组需要第三方库或编解码器：二维码、PDF 生成 / 合并 / 渲染、HEIC 解码、Office 解压使用本地化的 MIT / Apache-2.0 库；GIF、WAV 编码器由本项目自写；MP3 编码器因 LGPL 许可不纳入。
- 标有「⚠ 降级」的条目可以运行，但输出格式或能力与参考功能不同（例如导出 WebM 而非 MP4 / MP3、图片型 PDF 无可搜索文本层、色键抠图非 AI 分割），详见对应说明。
- 任何条目都不复制对方的源码、样式、图标、插画、文案、问卷题目或数据集。
