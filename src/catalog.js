/* 参考功能目录：对公开工具箱网站的 96 个功能点做事实性登记。
   只记录功能名称与分类等事实，不复制其描述文案、题目、数据或素材。
   tier: native(浏览器原生可做) | library(需第三方库) | online(需联网/Key) | excluded(授权排除)
   status 由 core/registry.js 根据实际实现动态计算，不在此写死。 */

export const REFERENCE_CATALOG = [
  {
    "id": "pdf-to-image",
    "name": "PDF 转图片",
    "refCategory": "pdf",
    "tier": "library",
    "note": "本地 pdf.js 逐页渲染为 PNG/JPEG 并打包（图片型，不含文本层）",
    "downgrade": true
  },
  {
    "id": "merge-pdf",
    "name": "合并 PDF",
    "refCategory": "pdf",
    "tier": "library",
    "note": "需 PDF 结构库，本项目使用本地 MIT 库实现",
    "localLibrary": true
  },
  {
    "id": "compress-pdf",
    "name": "压缩 PDF",
    "refCategory": "pdf",
    "tier": "library",
    "note": "重渲染为 JPEG 后用 pdf-lib 重组（有损，丢失文本层与矢量图形）",
    "downgrade": true
  },
  {
    "id": "pdf-to-word",
    "name": "PDF 转 Word",
    "refCategory": "pdf",
    "tier": "library",
    "note": "独立实现：pdf.js 读文本层与坐标 → 自写版面重排 → 自写 OOXML → JSZip 打包 docx；扫描页转为图片嵌入",
    "independent": true,
    "downgrade": true
  },
  {
    "id": "word-to-pdf",
    "name": "Word 转 PDF",
    "refCategory": "pdf",
    "tier": "library",
    "note": "JSZip 读 docx 段落文字 → Canvas 按 A4 排版 → 图片型 PDF（简化实现）",
    "downgrade": true
  },
  {
    "id": "photo-motion-maker",
    "name": "图片镜头动画",
    "refCategory": "image",
    "tier": "native",
    "note": "Canvas 逐帧运镜 + MediaRecorder 录为 WebM 片段",
    "downgrade": true
  },
  {
    "id": "ai-image-metadata-viewer",
    "name": "AI 图片元数据查看器",
    "refCategory": "image",
    "tier": "native",
    "note": "解析 PNG 文本块与 JPEG 注释段，不做 OCR"
  },
  {
    "id": "image-to-pdf",
    "name": "图片转 PDF",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "localLibrary": true
  },
  {
    "id": "image-stitcher",
    "name": "图片拼接长图",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "image-stitch"
  },
  {
    "id": "compress-image",
    "name": "压缩图片",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "jpg-to-png",
    "name": "JPG 转 PNG",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "image-convert"
  },
  {
    "id": "png-to-jpg",
    "name": "PNG 转 JPG",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "jpg-to-webp",
    "name": "JPG 转 WebP",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "png-to-webp",
    "name": "PNG 转 WebP",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "webp-to-jpg",
    "name": "WebP 转 JPG",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "webp-to-png",
    "name": "WebP 转 PNG",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "image-grid-split",
    "name": "图片九宫格切割",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "carousel-splitter",
    "name": "无缝切图",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "image-crop",
    "name": "裁剪图片",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "image-crop"
  },
  {
    "id": "image-resizer",
    "name": "调整图片大小",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "background-remover",
    "name": "移除背景",
    "refCategory": "image",
    "tier": "library",
    "note": "按颜色容差做色键抠图，纯色背景有效，非 AI 分割模型",
    "downgrade": true
  },
  {
    "id": "heic-to-jpg",
    "name": "HEIC 转 JPG",
    "refCategory": "image",
    "tier": "library",
    "note": "本地 heic2any（MIT，自带内联 worker）解码，不上传照片"
  },
  {
    "id": "flip-image",
    "name": "翻转和旋转图片",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "ai-to-png",
    "name": "AI 转 PNG",
    "refCategory": "image",
    "tier": "library",
    "note": "提取 .ai 内嵌的 PDF 兼容预览流，渲染第一页为 PNG",
    "downgrade": true
  },
  {
    "id": "circle-crop",
    "name": "圆形裁剪",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "subtitle-repair",
    "name": "字幕检查与同步修复",
    "refCategory": "video",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "compress-video",
    "name": "压缩视频",
    "refCategory": "video",
    "tier": "library",
    "note": "Canvas 逐帧绘制 + 浏览器原生编码器重录为 WebM",
    "downgrade": true
  },
  {
    "id": "video-to-gif",
    "name": "视频转 GIF",
    "refCategory": "video",
    "tier": "library",
    "note": "逐帧取样后用本项目自写的 GIF89a / LZW 编码器导出"
  },
  {
    "id": "video-screenshot",
    "name": "视频截图",
    "refCategory": "video",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "video-to-audio",
    "name": "视频转音频",
    "refCategory": "video",
    "tier": "native",
    "note": "decodeAudioData 导出 WAV；失败时可实时录制为 WebM",
    "downgrade": true
  },
  {
    "id": "mp3-to-wav",
    "name": "MP3 转 WAV",
    "refCategory": "audio",
    "tier": "native",
    "note": "浏览器自带解码器 → 16 位 PCM WAV（能否解码取决于浏览器）"
  },
  {
    "id": "wav-to-mp3",
    "name": "WAV 转 MP3",
    "refCategory": "audio",
    "tier": "library",
    "note": "浏览器原生 MediaRecorder 输出 WebM/Opus 或 MP4/AAC",
    "downgrade": true
  },
  {
    "id": "metronome",
    "name": "节拍器",
    "refCategory": "audio",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "bpm-detector",
    "name": "BPM 检测器",
    "refCategory": "audio",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "noise-generator",
    "name": "噪音生成器",
    "refCategory": "audio",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "lyric-visualizer",
    "name": "歌词波形播放器",
    "refCategory": "audio",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "character-counter",
    "name": "字数统计",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "text-stats"
  },
  {
    "id": "extract-text",
    "name": "提取文本",
    "refCategory": "text",
    "tier": "library",
    "note": "读取 PDF 文本层 / Office XML / 纯文本；扫描件不做 OCR",
    "downgrade": true
  },
  {
    "id": "lorem-ipsum-generator",
    "name": "Lorem Ipsum 生成器",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "fancy-text-generator",
    "name": "花式文字生成器",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "morse-code-translator",
    "name": "摩斯电码翻译器",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "json-formatter",
    "name": "JSON 格式化",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "json-format"
  },
  {
    "id": "invoice-generator",
    "name": "发票生成器",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "markdown-editor",
    "name": "Markdown 编辑器",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "markdown-preview"
  },
  {
    "id": "text-diff",
    "name": "文本对比",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "hash-generator",
    "name": "哈希生成器",
    "refCategory": "text",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "hash"
  },
  {
    "id": "text-to-speech",
    "name": "文本转语音",
    "refCategory": "text",
    "tier": "online",
    "note": "原功能依赖联网 AI 服务 / API Key，本项目提供本地等价替代",
    "substitute": "浏览器内置 speechSynthesis 本地语音合成（非神经音色）"
  },
  {
    "id": "text-animation-maker",
    "name": "文字动画制作器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "age-calculator",
    "name": "年龄计算器",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "unit-converter",
    "name": "单位换算",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "percentage-calculator",
    "name": "百分比计算器",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "bmi-calculator",
    "name": "BMI 计算器",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "tip-calculator",
    "name": "小费计算器",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "mortgage-calculator",
    "name": "房贷计算器",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "mortgage"
  },
  {
    "id": "meeting-cost-calculator",
    "name": "会议成本计算器",
    "refCategory": "calculator",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "typing-test",
    "name": "打字速度测试",
    "refCategory": "time",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "stopwatch",
    "name": "秒表",
    "refCategory": "time",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "countdown-timer",
    "name": "倒计时器",
    "refCategory": "time",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "world-clock",
    "name": "世界时钟",
    "refCategory": "time",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "pomodoro-timer",
    "name": "番茄钟",
    "refCategory": "time",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "timestamp-converter",
    "name": "时间戳转换",
    "refCategory": "time",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "timestamp"
  },
  {
    "id": "emoji-finder",
    "name": "Emoji 搜索",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "whiteboard",
    "name": "白板",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "what-to-eat",
    "name": "今天吃什么？",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "ask-fate",
    "name": "问命运",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "keyboard-tester",
    "name": "键盘测试",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "random-spinner",
    "name": "随机转盘",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "reaction-time-test",
    "name": "反应速度测试",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "cps-test",
    "name": "CPS 测试",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "aim-trainer",
    "name": "瞄准训练",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "mic-camera-test",
    "name": "麦克风与摄像头测试",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "qr-code-generator",
    "name": "二维码生成器",
    "refCategory": "creative",
    "tier": "library",
    "note": "二维码纠错编码算法较复杂，本项目使用本地 MIT 库实现",
    "localLibrary": true
  },
  {
    "id": "pixel-art-converter",
    "name": "像素画转换器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "coin-flip",
    "name": "抛硬币",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "dice-roller",
    "name": "掷骰子",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "password-generator",
    "name": "密码生成器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "password"
  },
  {
    "id": "color-picker",
    "name": "取色器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现",
    "alias": "color"
  },
  {
    "id": "gradient-generator",
    "name": "渐变生成器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "daily-planner",
    "name": "日程规划",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "signature-maker",
    "name": "签名生成器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "flashcard-maker",
    "name": "闪卡生成器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "chart-maker",
    "name": "CSV 图表生成器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "holidays",
    "name": "世界节日",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "item-locator",
    "name": "物品定位器",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "ascii-art",
    "name": "ASCII 艺术",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "ascii-banner",
    "name": "ASCII 横幅",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "midi-keyboard",
    "name": "MIDI 键盘",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "silk-screen",
    "name": "丝网印刷滤镜",
    "refCategory": "image",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "spin-the-dare",
    "name": "大冒险轮盘",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "breathing-relaxation",
    "name": "呼吸放松指南",
    "refCategory": "creative",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "ai-trajectory",
    "name": "AI 人生轨迹",
    "refCategory": "ai",
    "tier": "online",
    "note": "原功能依赖联网 AI 服务 / API Key，本项目提供本地等价替代",
    "substitute": "本地问卷 + 路径推演模板"
  },
  {
    "id": "ai-tarot",
    "name": "AI 塔罗牌",
    "refCategory": "ai",
    "tier": "online",
    "note": "原功能依赖联网 AI 服务 / API Key，本项目提供本地等价替代",
    "substitute": "本地抽牌 + 自写牌义文本，不做 AI 解读"
  },
  {
    "id": "ex-ai-chat",
    "name": "AI 前任聊天",
    "refCategory": "ai",
    "tier": "online",
    "note": "原功能依赖联网 AI 服务 / API Key，本项目提供本地等价替代",
    "substitute": "改为聊天文本风格分析（本地统计），不复刻他人语气"
  },
  {
    "id": "ai-text-adventure",
    "name": "AI 文字冒险",
    "refCategory": "ai",
    "tier": "online",
    "note": "原功能依赖联网 AI 服务 / API Key，本项目提供本地等价替代",
    "substitute": "本地分支剧情状态机 + 自写剧本"
  },
  {
    "id": "emotional-neglect-test",
    "name": "情感漠视测试",
    "refCategory": "selftest",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  },
  {
    "id": "quit-smoking-tracker",
    "name": "戒烟追踪器",
    "refCategory": "selftest",
    "tier": "native",
    "note": "浏览器原生 API 可独立实现"
  }
];
