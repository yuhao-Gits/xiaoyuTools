# xiaoyuTools

**免费在线工具站**：把日常零散操作收进一个网页，全部在浏览器里完成，不联网处理、不上传文件。免注册、无水印、不限次数。

当前 **118 件工具 / 9 个集群**，信息架构参考 MinoPDF 一类隐私优先工具站的通用语汇：落地式首页（Hero / 链式处理 / 热门工具 / 集群浏览 / 隐私卖点 / FAQ）、工具集群目录、博客指南，以及公开上线必需的信任页（**关于 / 隐私政策 / 服务条款 / 亲自验证**）。图片集群对齐 BulkPicTools 的功能面：目标体积压缩、证件照、AI 抠图（本地模型）、GIF 系列、水印、EXIF / DPI、调色、打码等。

核心卖点：

- **本地处理**：文件从拖入到下载始终留在用户设备上，站点没有接收文件的后端接口
- **链式处理**：PDF / 文档工具的结果可直接交给下一个兼容工具，不必反复选文件（`src/core/handoff.js`）
- **可验证**：「亲自验证」页内置实时请求计数器与本地处理演示；断网后所有工具照常可用
- **诚实标注**：11 项降级实现在工具页顶部明示能力边界，不假装与云端方案等价

界面为黑白两色工作台设计系统：深色近黑底、圆角面板、左侧固定菜单、白色药丸高亮，支持浅 / 深主题与 `prefers-reduced-motion`。

## 运行

```powershell
Set-Location D:\AiDemo\xiaoyuTools
npm start
```

打开 <http://localhost:5173>。`npm run dev` 同义；换端口用 `$env:PORT=8080`（端口被占用时务必换端口，避免连到别的应用）。运行页面本身不需要 `npm install`，改完代码刷新即可；只有跑自动化测试需要先 `npm install` 装 `playwright-core`。

> 必须走静态服务，不能直接双击 `index.html`——浏览器会拦截 `file://` 下的 ES Module。

环境：Node ≥ 18。无 Rust、无后端、无数据库、无构建步骤。

## 测试

```bash
npm start          # 终端 A：起静态服务
npm test           # 终端 B：跑全部六套测试
```

测试分六层，逐层加严（端口不是 5173 时用 `$env:BASE_URL` 指定）：

| 脚本 | 覆盖 | 判据 |
| --- | --- | --- |
| `npm run test:clicks` | 卡片点击连通性 | 整卡热区命中跳转层；点「打开」文案、标题、右下留白都能进详情页；星标独立可点且不误跳；键盘回车可打开；首页集群卡可进分区，共 8 项 |
| `npm run test:tools` | 分区 / 信任页 + 118 件工具 | 渲染非空、无控制台报错；50 余件工具做输入 → 输出断言 |
| `npm run test:interactions` | 118 件工具 | 自动填样例、点安全按钮；快照含 innerText、HTML、输入框值、画布像素指纹 |
| `npm run test:gestures` | 20 项手势 / 设备 / 音频 | 画板与签名拖拽出墨、键盘高亮、文字冒险推进、反应 / CPS / 瞄准 / 打字记分、MIDI 发声、番茄钟、呼吸、噪音 / 朗读 / 节拍器 / BPM Tap、设备被拒提示 |
| `npm run test:files` | 40 件需要文件的工具 | 逐个上传真实素材（PNG / JPEG / WebP / PDF / DOCX / WAV / TXT / CSV / SRT），检查结果与报错 |
| `npm run test:downloads` | 12 件下载类工具 | 真点按钮、真接下载，校验文件头（ZIP / PDF / PNG / GIF / WAV / WebM / DOCX）与体积 |

首次运行前需要 `npm install` 装 `playwright-core`；脚本会自动找本机 Edge / Chrome，也可以用 `CHROME_PATH` 指定。测试素材在 `fixtures/` 下，测试产物写入 `fixtures/out/`（已 gitignore，可随时删除）。

## 架构（为二次开发准备）

```text
xiaoyuTools/
├── index.html            入口；按顺序加载本地 vendor 库与 main.js
├── server.js             Node 内置模块写的静态服务器（仅本地开发用）
├── scripts/
│   ├── new-tool.mjs      新工具脚手架（生成模块 + 自动登记）
│   ├── dump-tools.mjs    导出全部工具清单（调试用）
│   ├── test-*.mjs        六层回归测试
│   └── gen-catalog.mjs   根据真实注册状态重生成功能蓝图文档
├── docs/CATALOG.md       参考功能对照表（自动生成，仅开发参考，不在站内展示）
├── fixtures/             回归测试素材（图片 / PDF / 音视频 / 文本）
├── vendor/               本地化的宽松许可库与许可全文
├── src/
│   ├── catalog.js        参考功能目录（事实性登记 + 实现说明 / 降级标记）
│   ├── main.js           应用外壳：侧栏 / 面包屑 / hash 路由 / 检索 / 主题 / 工具页增强
│   ├── styles.css        工作台设计系统（深色为主 + 浅色反相）
│   ├── core/
│   │   ├── registry.js   合并实现与参考目录，计算工具列表与集群
│   │   ├── components.js 页头 / 分组标题 / 筛选胶囊 / 工具卡片
│   │   ├── handoff.js    链式处理：结果在标签页内存中传递给兼容工具
│   │   ├── icons.js      内联线性图标与集群映射
│   │   ├── markdown.js   Markdown 渲染器（博客与预览工具共用）
│   │   ├── ui.js         通用 DOM / 复制 / 下载 / 文件读取助手
│   │   ├── store.js      localStorage 封装（收藏 / 最近 / 主题 / 工具数据）
│   │   └── ai-adapter.js 默认关闭的可选 AI 适配器接口
│   ├── pages/
│   │   ├── home.js       落地式首页（Hero / 链式演示 / 热门 / 集群 / 卖点 / FAQ / CTA）
│   │   ├── toolbox.js    全量工具库 + 检索结果
│   │   ├── blog.js       博客列表与单篇
│   │   └── trust.js      关于 / 隐私政策 / 服务条款 / 亲自验证
│   ├── data/
│   │   ├── workspaces.js 一级入口与信任页登记
│   │   └── posts.js      公开向博客文章（Markdown 存在代码里）
│   └── tools/
│       ├── index.js      实现汇总：import 一个模块即自动注册
│       ├── dev.js / text.js / calc.js / image.js   首批合集模块
│       └── modules/      后续工具（按主题分文件）
│           ├── shared.js        公共助手：Canvas、CSV、字幕、WAV、GIF LZW、PDF 渲染
│           ├── pdf.js / pdf-extra.js / pdf-to-word.js   PDF / 文档工具（含链式处理）
│           └── ...
```

### 加一个新工具（推荐）

```powershell
node scripts/new-tool.mjs csv-to-json dev "CSV 转 JSON" "把 CSV 转成 JSON 数组"
```

会生成 `src/tools/modules/csv-to-json.js`，并自动在 `src/tools/index.js` 登记。卡片、搜索、路由、收藏、分类计数**全部自动生效**。

手写也可以，工具对象只需：

```js
{
  id: 'my-tool', name: '我的工具', category: 'dev',
  desc: '一句话说明', keywords: ['别名'],
  steps: ['使用步骤…'], faq: [['问题？', '回答。']],   // 可选，工具页自动渲染
  render(root) { root.append(/* DOM */); },
}
```

分类：`dev | text | calc | image | time | creative | audio | video | pdf`。公共助手在 `src/core/ui.js`（`el`、`panel`、`inp`、`txt`、`sel`、`btn`、`actions`、`resultBox`、`copyText`、`downloadBlob`…）与 `src/tools/modules/shared.js`。

### 链式处理

`src/core/handoff.js` 维护一个**只存在当前标签页内存**的结果位：

- 输出端：工具生成结果后调用 `offerNextSteps(box, file, fromId)`，列出接受该格式的下一步工具
- 接收端：工具渲染时调用 `handoffBanner(toolId, picker)`，兼容时显示「已带入上一步结果」横幅，点「载入文件」写进文件选择框
- 兼容关系按 MIME / 扩展名声明；不接受的格式不会自动填入；刷新页面即清空，不落盘、不上传

当前接入：图片转 PDF、合并 PDF、压缩 PDF、PDF 转图片、PDF 转 Word、Word 转 PDF、提取文本。

## 工具清单（118 件 / 9 类）

| 集群 | 包含 |
| --- | --- |
| 文档 PDF | 图片转 PDF、合并 PDF、PDF 转图片、压缩 PDF、Word 转 PDF、PDF 转 Word |
| 图片 | 压缩转格式 / 裁剪缩放 / 主色 / 长图拼接，5 种格式互转、压缩、尺寸、翻转旋转、圆裁、九宫格、无缝切图、丝网滤镜、镜头动画、元数据查看、色键抠图、HEIC 转 JPG、AI 转 PNG |
| 文本 | 统计、清洗、Markdown 预览、文本对比、占位文本、摩斯电码、花式文字、收据生成、多格式文本提取 |
| 开发者 | JSON 格式化校验、Base64、URL 编解码、UUID、SHA 哈希、JWT 解析 |
| 计算换算 | 时间戳、密码、房贷、颜色、单位、百分比、年龄、BMI、小费、会议成本、复利定投、收支结余 |
| 音频 | 节拍器、环境噪音、文本朗读、MP3 转 WAV、BPM 检测、歌词波形、WAV 压缩导出 |
| 视频 | 视频截帧、字幕修复、视频转音频、压缩视频、视频转 GIF |
| 时间专注 | 秒表、倒计时、世界时钟、番茄钟、打字速度测试 |
| 创意娱乐 | 画板、渐变、二维码、文字动画、Emoji 搜索、像素画、日程、签名、闪卡、CSV 图表、节日、物品定位、ASCII 艺术 / 横幅、MIDI 键盘、呼吸放松、麦克风摄像头测试、文字冒险，以及吃什么 / 问命运 / 硬币 / 骰子 / 转盘 / 大冒险与 4 个反应小游戏 |

首页另有热门工具、集群导航、关键词搜索、收藏、最近使用、随手打开一件与浅 / 深主题，状态只写本机 `localStorage`。

## 第三方库与许可

只纳入**宽松许可、带独立浏览器构建**的库，并用 `npm pack` 把文件放到 `vendor/` 本地化——**运行时不加载 CDN、不发外部请求**。

| 库 | 版本 | 许可 | 用途 |
| --- | --- | --- | --- |
| qrcode-generator | 1.4.4 | MIT | 二维码生成（含 UTF-8 中文补丁） |
| pdf-lib | 1.17.1 | MIT | 创建 / 合并 / 重组 PDF |
| pdfjs-dist | 3.11.174 | Apache-2.0 | PDF 页面渲染与文本层提取 |
| jszip | 3.10.1 | MIT（双许可取 MIT） | 读取 docx/xlsx/pptx、打包多图、写出 docx |
| heic2any | 0.0.4 | MIT | HEIC / HEIF 解码（自带内联 worker） |

详情与许可全文见 `vendor/README.md`。**GPL / LGPL、需要模型权重、需要联网 SDK 的库一律不纳入**：MP3 编码器常见实现为 LGPL，因此 WAV 压缩改走浏览器原生编码；GIF89a/LZW 编码器、16 位 PCM WAV 编码器由本项目自行实现。

## PDF 转 Word：独立实现说明

本项目**不复刻任何需要单独书面授权的转换引擎**，也没有阅读、引用其源码、配置或算法文档。技术路径完全独立：

1. 本地 `pdf.js` 读取 PDF 的**文本层**，拿到每个文本片段的文字、坐标、字号与字体名；
2. 本项目**自写的版面重排**（`layoutTextContent`）：按基线聚类成行、按横坐标排序、按间隙还原空格，再依据行距 / 缩进 / 字号 / 列表符号推断段落、标题与列表；
3. 本项目**自写的 OOXML 生成器**（`buildDocxParts`）：产出 `word/document.xml`、`styles.xml`、`[Content_Types].xml`、rels、docProps 等部件；
4. 本地 `JSZip` 打包成 `.docx`。

有文本层的页面输出可编辑文字；扫描件 / 图片型页面不做 OCR，自动整页渲染成图片嵌入。三种模式：自动 / 仅文本 / 整页图片。单次最多 40 页 / 40 MB。这是**近似的版面重建**：多栏、表格、脚注、公式、复杂字距不会完整还原。

## 降级实现（11 项，能力有差异但可运行）

| 功能 | 实际做法 |
| --- | --- |
| WAV 转 MP3 | 导出 WebM/Opus 或 MP4/AAC，不是 MP3 |
| 压缩视频 / 图片镜头动画 | 重录为 WebM，不是 MP4 |
| 视频转音频 | 解码失败时实时录制为 WebM，输出 WAV 取决于浏览器解码能力 |
| PDF 转图片 / 压缩 PDF | 输出图片型 PDF/位图，丢失可搜索文本层与矢量 |
| Word 转 PDF | 只取 docx 段落文字按 A4 排版，不含字体、表格、图片 |
| PDF 转 Word | 基于文本层的近似版面重建；扫描页为图片嵌入、不做 OCR |
| 提取文本 | 只取 PDF 文本层 / Office XML，扫描件不做 OCR |
| 移除背景 | 颜色容差色键，仅纯色背景有效，非 AI 分割模型 |
| AI 转 PNG | 只渲染 .ai 内嵌 PDF 兼容预览的第一页 |
| AI 图片元数据查看器 | 解析 PNG/JPEG 文本块，不做 OCR |

站内对应工具页顶部有「能力边界」提示，博客《降级实现清单》逐条说明。

## 合规与来源说明

- 只借鉴「隐私优先的本地工具站」这一**通用产品形态**、信息架构思路（落地页 / 集群 / 信任页 / 链式处理），以及暗色极简、栅格、Hero、卡片目录这类**通用设计手法**。
- **未复制**参考网站 / 仓库的任何源码、样式表、SVG 插画、图标、截图、描述文案、Logo、标语、数字、问卷题目、Emoji 数据集或节日数据。首页文案、FAQ、信任页与博客文章均为本项目自写。
- **不含任何需要单独授权的第三方引擎**：PDF 转 Word 是从零编写的独立实现；也不含 OCR、离线分割模型、系统级剪贴板监控等依赖专用实现的功能。
- 所有工具实现、界面代码、图标、动画与文案均为本项目独立编写；第三方库仅限上表 5 个宽松许可库，且保留许可全文。
- 不含广告、推广链接、统计脚本；页面不上传文件、不收集数据，默认不发任何外部请求。
- 如需分发、商用或加入新的第三方代码，请自行核对相应许可。

## 已知边界

- 浏览器沙箱限制：不能后台监控剪贴板、遍历磁盘目录、注册全局快捷键；麦克风/摄像头与 Web MIDI 需显式授权。
- 视频 / 音频能否解码、语音有哪些音色、系统字体差异，都取决于浏览器与操作系统；本项目不捆绑编解码器或模型。
- `MediaRecorder` 录制按**实时时长**进行，需保持页面打开；输出容器由浏览器决定（通常 WebM）。
- PDF 重渲染、PDF 转 Word 的版面重建、docx 排版、色键抠图、BPM 检测等均为简化 / 估算实现，不等同专业软件，不构成医疗或财务建议。
- Markdown 预览是轻量实现，不等同完整 GFM；哈希只提供 SHA 系列。
- 图片与视频处理受浏览器内存、Canvas 尺寸上限约束；超大文件建议先缩放或拆批。