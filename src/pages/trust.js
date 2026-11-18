/* 信任页：关于 / 隐私政策 / 服务条款 / 亲自验证。
   公开上线必需的说明页面。正文用站内 Markdown 渲染器，与博客同一套排版。 */
import { el, toast, formatBytes } from '../core/ui.js';
import { glyphNode } from '../core/icons.js';
import { pageHead } from '../core/components.js';
import { renderMarkdown } from '../core/markdown.js';
import { tools, categories } from '../core/registry.js';

function prosePage({ eyebrow, title, lead, body }) {
  const prose = el('div', { class: 'prose' });
  prose.innerHTML = renderMarkdown(body);
  return el('div', {},
    pageHead({ eyebrow, title, lead }),
    el('article', { class: 'article' }, prose));
}

export function renderAbout() {
  return prosePage({
    eyebrow: 'ABOUT · 关于本站',
    title: '关于 xiaoyuTools',
    lead: '一个把日常零散操作收进一张网页的免费工具站：全部在浏览器本地运行，不上传文件。',
    body: `## 定位

xiaoyuTools 是一个**免费、免注册、无水印**的在线工具站，当前收录 ${tools.length} 件工具、${categories.length} 个集群。它解决的是同一类问题：那些「专门开一个软件不值得、在线工具又不敢传文件」的日常操作——转个格式、压个体积、提段文字、算个数字。

所有工具都在你的浏览器里运行。文件从拖入到下载，始终留在你的设备上。

## 技术栈

站点是纯前端静态应用：没有后端、没有数据库、没有构建步骤。依赖的开源库全部本地化随站点分发，运行时不加载任何 CDN：

| 库 | 许可 | 用途 |
| --- | --- | --- |
| pdf-lib | MIT | 创建 / 合并 / 重组 PDF |
| pdfjs-dist | Apache-2.0 | PDF 页面渲染与文本层提取 |
| jszip | MIT | 读取 docx/xlsx/pptx、打包多图与 docx |
| qrcode-generator | MIT | 二维码生成 |
| heic2any | MIT | HEIC / HEIF 解码 |

GIF 编码、WAV 编码、PDF 转 Word 的版面重排与 OOXML 生成等均为本项目自行实现，未引入需要单独授权的引擎。

## 设计

界面只有黑白两色，质感靠光、层次与节奏堆出来：深色近黑底、圆角面板、指针跟随的卡片高光。支持浅 / 深主题切换，尊重系统的「减少动态效果」偏好。全部效果是 CSS 与少量原生 API，没有动画库、没有外部字体或图片。

## 边界

浏览器沙箱决定了本站做不到一些事：不能后台监控剪贴板、不能遍历磁盘、不能注册全局快捷键。音视频解码能力、语音音色取决于浏览器与操作系统。部分工具是降级实现（如 PDF 压缩会丢文本层），每条边界都在工具页与[降级实现清单](#/blog/honest-limits)里写明。

## 合规

所有工具实现、界面代码、图标、动画与文案均为本项目独立编写；只借鉴「把常用小工具收进一个本地工作台」这一通用产品形态与通用设计手法，未复制任何参考网站的源码、素材或文案。第三方库仅限上表所列宽松许可库，许可全文随站点保留。`,
  });
}

export function renderPrivacy() {
  return prosePage({
    eyebrow: 'PRIVACY · 隐私政策',
    title: '隐私政策',
    lead: '生效日期：2026 年 11 月 18 日。一句话版本：你的文件不上传，你的行为不追踪。',
    body: `## 我们不收集什么

- **不收集文件内容**：所有处理在浏览器本地完成，站点没有接收文件的服务器接口
- **不收集个人信息**：无需注册、登录，不提供邮箱，不设置账号
- **不做行为追踪**：没有统计脚本、没有广告、没有跨站追踪，未启用任何分析服务
- **不加载外部资源**：没有 CDN、外部字体或第三方请求；页面加载完成后断网可继续使用

## 浏览器本地存储

站点只在你的浏览器 \`localStorage\` 里写入三类数据，键前缀统一为 \`xiaoyuTools:\`：

| 数据 | 内容 | 用途 |
| --- | --- | --- |
| 收藏 | 工具 id 列表 | 首页与工具箱的「我的收藏」 |
| 最近使用 | 最近 8 件工具 id | 「最近使用」列表 |
| 偏好与工具数据 | 主题、密度、个别工具的自定义内容 | 记住你的设置 |

这些数据**只存在你的设备上**，不会同步、不会被本站读取。清除浏览器站点数据即可全部删除。链式处理的中间结果只存在当前标签页内存中，刷新即清空，不落盘。

## 权限说明

个别工具需要浏览器权限才能工作：麦克风 / 摄像头测试、文本朗读、MIDI 键盘。权限由浏览器弹窗明示，拒绝后工具会给出提示，不影响其他功能。

## 如何验证

「不上传」是结构事实，可以动手验证：打开开发者工具的 Network 面板处理一个文件，或直接断网后继续使用。详见[亲自验证](#/verify)页与[验证指南](#/blog/verify-zero-upload)。

## 政策变更

本政策如有更新，会在本页注明新的生效日期。继续使用站点即视为了解当前版本。`,
  });
}

export function renderTerms() {
  return prosePage({
    eyebrow: 'TERMS · 服务条款',
    title: '服务条款',
    lead: '生效日期：2026 年 11 月 18 日。免费使用，按现状提供，请把输出用在合适的地方。',
    body: `## 服务说明

xiaoyuTools 免费提供浏览器本地工具服务，无需注册，输出文件不加水印，不限使用次数。站点是纯前端静态应用，不设服务端配额。

## 按现状提供

- 工具按「现状」提供，不附带任何明示或暗示的担保，包括对适销性、特定用途适用性的担保
- 浏览器本地处理受设备内存、Canvas 尺寸与浏览器解码能力约束；超大文件建议拆批处理
- 部分工具为降级实现（输出格式或能力与专业软件不同），边界已在工具页逐条标注；对输出有专业要求时请使用专业软件

## 你的责任

- 你应对自己处理的文件拥有合法权利，不得用本站工具处理违法内容
- 计算类工具（房贷、复利、BMI 等）输出为估算，**不构成财务、医疗或法律建议**
- 请在交付前自行核对输出结果；重要文件请保留原件

## 知识产权

站点代码、界面、图标与文案为本项目独立编写。第三方开源库（pdf-lib、pdfjs-dist、jszip、qrcode-generator、heic2any）按其各自许可（MIT / Apache-2.0）使用，许可全文随站点保留。你使用工具生成的输出文件归你所有，本站不主张任何权利。

## 免责与变更

在法律允许的最大范围内，本站不对因使用或无法使用工具而产生的任何直接或间接损失承担责任。站点可能随时调整、新增或移除工具；条款如有更新，会在本页注明新的生效日期。`,
  });
}

/* ---------- 亲自验证：请求计数器 + 本地处理演示 ---------- */

const API_TYPES = new Set(['fetch', 'xmlhttprequest', 'beacon']);

export function renderVerify() {
  let count = performance.getEntriesByType('resource').filter(e => API_TYPES.has(e.initiatorType)).length;
  const countNode = el('strong', { class: 'verify-count', text: String(count) });
  const paint = () => { countNode.textContent = String(count); };

  const observer = new PerformanceObserver(list => {
    if (!countNode.isConnected) { observer.disconnect(); return; }
    count += list.getEntries().filter(e => API_TYPES.has(e.initiatorType)).length;
    paint();
  });
  try { observer.observe({ type: 'resource', buffered: false }); } catch { /* 旧浏览器无 PerformanceObserver 时计数保持初始值 */ }

  const demoStatus = el('div', { class: 'status' });
  const runDemo = async () => {
    const lib = window.PDFLib;
    if (!lib) { toast('本地 PDF 库未加载', 'warn'); return; }
    demoStatus.textContent = '正在本机生成一份 PDF…';
    const before = count;
    try {
      const pdf = await lib.PDFDocument.create();
      const page = pdf.addPage([595, 842]);
      const font = await pdf.embedFont(lib.StandardFonts.Helvetica);
      page.drawText('Generated locally. No upload.', { x: 64, y: 760, size: 18, font });
      page.drawText(new Date().toISOString(), { x: 64, y: 730, size: 11, font });
      const bytes = await pdf.save();
      /* 给网络面板一点时间：如果有任何请求，现在应该已经出现 */
      await new Promise(resolve => setTimeout(resolve, 600));
      const delta = count - before;
      demoStatus.textContent = delta === 0
        ? `演示完成：本地生成 ${formatBytes(bytes.length)} 的 PDF，期间新增网络请求 ${delta} 个。`
        : `演示完成，但期间出现 ${delta} 个网络请求——请检查浏览器扩展是否注入了请求。`;
      if (delta === 0) toast('验证通过：0 个网络请求', 'ok');
    } catch (error) {
      demoStatus.textContent = `演示失败：${error.message}`;
    }
  };

  const meter = el('div', { class: 'verify-meter panel' },
    el('div', { class: 'verify-meter-head' },
      glyphNode('shield'),
      el('div', {},
        el('h3', { text: '实时请求计数器' }),
        el('p', { class: 'hint', text: '监听本页发出的 fetch / XHR / beacon 请求。本站没有任何后端接口，这个数字应该一直是 0。' }))),
    el('div', { class: 'verify-count-line' }, countNode, el('span', { text: '个文件处理类请求' })),
    el('div', { class: 'panel-actions' },
      el('button', { class: 'btn btn-primary', type: 'button', text: '运行一次本地处理演示', onclick: runDemo })),
    demoStatus,
    el('p', { class: 'hint', text: '演示会在本机生成一份小 PDF 并计数前后差值。浏览器扩展注入的请求可能被计入，可用无痕窗口排除。' }));

  const prose = el('div', { class: 'prose' });
  prose.innerHTML = renderMarkdown(`## 30 秒手动验证

1. 按 \`F12\` 打开开发者工具，切到 **Network（网络）** 面板
2. 勾选 **Disable cache**，清空记录
3. 打开任意工具，拖入文件并运行到下载结果
4. 面板里除了本站静态资源，不会出现任何携带文件内容的请求

## 断网验证

页面加载完成后断开网络，再运行任意工具：转换、合并、压缩、提取照常工作。需要联网的工具在断网时不可能运行。

## 为什么敢让你验证

本站没有后端接口、没有统计脚本、没有 CDN——「不上传」不是政策承诺，而是结构事实。第三方库全部本地化，页面加载完成后所有计算都在你的设备上完成。

更多细节见[隐私政策](#/privacy)与[验证指南](#/blog/verify-zero-upload)。`);

  return el('div', {},
    pageHead({
      eyebrow: 'VERIFY · 亲自验证',
      title: '别信承诺，动手验证',
      lead: '文件不上传这件事，可以在 30 秒内被任何人复现验证。下面的计数器实时监听本页请求。',
    }),
    meter,
    el('article', { class: 'article' }, prose));
}