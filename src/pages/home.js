/* 首页：公开版落地页。一屏回答三个问题——这里能做什么、凭什么信任、从哪开始。
   结构参考通用工具站落地页语汇：Hero → 链式处理 → 热门工具 → 集群 → 隐私卖点 → FAQ。 */
import { el } from '../core/ui.js';
import { glyphNode, CATEGORY_GLYPH } from '../core/icons.js';
import { tools, toolsById, categories, toolsInCategory } from '../core/registry.js';
import { getRecents } from '../core/store.js';
import {
  sectionHead, textLink, toolGrid, emptyBox,
} from '../core/components.js';
import { POSTS } from '../data/posts.js';

/* 首屏数字从 0 滚到真实值，一次就够；关掉动效偏好时直接落位 */
function countUp(node, target, duration = 720) {
  if (!node) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node.textContent = String(target);
    return;
  }
  const started = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - started) / duration);
    node.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(tick);
    else node.textContent = String(target);
  };
  requestAnimationFrame(tick);
}

function hero(ctx) {
  const copy = el('div', { class: 'hero-copy' },
    el('span', { class: 'eyebrow' }, el('i'), el('span', { text: '免费 · 免注册 · 无水印' })),
    el('h1', {},
      el('span', { text: '把文件的事，' }),
      el('br'),
      el('span', { class: 'dim', text: '一次做完。' })),
    el('p', {
      class: 'hero-lead',
      text: `转换、压缩、提取、整理——${tools.length} 件工具全部在浏览器本地运行，文件不上传。兼容的操作可以接着做，不必反复选择文件或下载中间结果。`,
    }),
    el('p', { class: 'hero-feature', text: '图片 ⇄ PDF · Word ⇄ PDF · 合并 / 压缩 / 提取 · 文本 / 计算 / 音视频' }),
    el('div', { class: 'hero-actions' },
      el('a', { class: 'button', href: '#/toolbox' },
        glyphNode('toolbox'), el('span', { text: '开始处理' })),
      el('a', { class: 'button quiet', href: '#/verify' },
        glyphNode('shield'), el('span', { text: '亲自验证（30 秒）' })),
      el('button', {
        class: 'button quiet',
        type: 'button',
        onclick: () => {
          const pool = tools;
          ctx.go(`#/tool/${pool[Math.floor(Math.random() * pool.length)].id}`);
        },
      }, glyphNode('dice'), el('span', { text: '随手翻一件' }))),
    el('p', { class: 'hero-note' },
      glyphNode('bolt'),
      el('span', { text: '页面加载完成后断网也能继续用——打开开发者工具，看着请求数保持为零。' })));
  return copy;
}

function statStrip() {
  const cells = [
    [tools.length, '件工具'],
    [categories.length, '个集群'],
    ['0', '次外部请求'],
    ['0', '元 · 免注册'],
  ];
  const animated = [];
  const node = el('div', { class: 'stat-strip' },
    ...cells.map(([value, label]) => {
      const strong = el('strong', { text: String(value) });
      if (typeof value === 'number' && value > 0) animated.push([strong, value]);
      return el('div', { class: 'stat-cell' }, el('span', { text: label }), strong);
    }));
  requestAnimationFrame(() => animated.forEach(([strong, value]) => countUp(strong, value, 900)));
  return node;
}

/* 链式处理演示：一条真实的工具链，每一步都可点 */
function chainSection() {
  const steps = [
    { id: 'image-to-pdf', label: '图片转 PDF' },
    { id: 'compress-pdf', label: '压缩 PDF' },
    { id: 'extract-text', label: '提取文本' },
    { id: null, label: '下载结果' },
  ];
  return el('section', { class: 'section' },
    sectionHead({
      title: '一次选择，接着处理',
      desc: '完成一个操作后，把结果直接交给下一个兼容工具，不必在每一步之间重复保存和上传。',
      link: textLink('链式处理指南', '#/blog/chain-processing'),
    }),
    el('div', { class: 'chain-strip' },
      ...steps.flatMap((step, i) => {
        const node = step.id
          ? el('a', { class: 'chain-step', href: `#/tool/${step.id}` },
            el('span', { class: 'chain-num', text: String(i + 1) }),
            el('span', { text: step.label }),
            glyphNode('arrow'))
          : el('span', { class: 'chain-step is-end' },
            el('span', { class: 'chain-num', text: String(i + 1) }),
            el('span', { text: step.label }),
            glyphNode('down'));
        return i < steps.length - 1 ? [node, el('span', { class: 'chain-link', 'aria-hidden': 'true' }, glyphNode('chevron'))] : [node];
      })));
}

const POPULAR_IDS = [
  'pdf-to-word', 'merge-pdf', 'compress-pdf', 'image-to-pdf', 'pdf-to-image',
  'extract-text', 'compress-image', 'image-convert', 'json-format', 'qr-code-generator',
];

function popularSection(ctx) {
  const list = POPULAR_IDS.map(id => toolsById.get(id)).filter(Boolean);
  return el('section', { class: 'section' },
    sectionHead({
      title: '热门工具',
      desc: '选一个直接开始——每一件都在浏览器本地运行。',
      link: textLink('查看所有工具', '#/toolbox'),
    }),
    toolGrid(list, { onFavorite: ctx.onFavorite }));
}

function clusterSection() {
  return el('section', { class: 'section' },
    sectionHead({ title: '按集群浏览', desc: '按你真正要完成的任务把工具分组。' }),
    el('div', { class: 'workspace-grid' },
      ...categories.filter(c => toolsInCategory(c.id).length).map(category => {
        const list = toolsInCategory(category.id);
        return el('a', { class: 'workspace-card', href: `#/toolbox/${category.id}` },
          el('div', { class: 'workspace-top' },
            el('span', { class: 'workspace-icon' }, glyphNode(CATEGORY_GLYPH[category.id] || 'grid')),
            el('span', { class: 'workspace-count', text: `${list.length} 件工具` })),
          el('h3', { text: category.name }),
          el('p', { text: category.desc }),
          el('p', { class: 'workspace-samples', text: list.slice(0, 3).map(t => t.name).join(' · ') }));
      })));
}

function trustSection() {
  const points = [
    ['shield', '本地处理', '所有工具都在浏览器里运行。文件在你的设备上打开、处理并写回。'],
    ['bolt', '绝不上传', '没有接收文件的服务器接口。页面加载完成后断网也能继续用。'],
    ['book', '开源引擎', '渲染与页面操作交给 pdf-lib 与 pdf.js 等久经考验的宽松许可开源库，全部本地化加载。'],
    ['star', '无水印，免注册', '免费使用，不用注册账号，输出文件不加水印，不限次数。'],
    ['clock', '痕迹只留本机', '收藏与最近使用只写浏览器 localStorage；链式处理的中间结果刷新即清空。'],
    ['search', '可动手验证', '「不上传」是结构事实：打开网络面板处理一个文件，或直接断网试试。'],
  ];
  return el('section', { class: 'section' },
    sectionHead({
      title: '靠的是不上传，而不是承诺',
      desc: '从拖入文件到下载结果，文档始终留在你的设备上。',
      link: textLink('查看隐私政策', '#/privacy'),
    }),
    el('div', { class: 'trust-grid' },
      ...points.map(([icon, title, desc]) => el('div', { class: 'trust-card' },
        el('span', { class: 'trust-icon' }, glyphNode(icon)),
        el('h3', { text: title }),
        el('p', { text: desc })))));
}

function recentSection(ctx) {
  const recents = getRecents().map(id => toolsById.get(id)).filter(Boolean);
  if (!recents.length) return null;
  return el('section', { class: 'section' },
    sectionHead({
      title: '最近使用',
      desc: '最多记录最近 8 件，只存在本机',
      count: `${recents.length} 件`,
      link: textLink('全量工具', '#/toolbox'),
    }),
    toolGrid(recents, { onFavorite: ctx.onFavorite }));
}

function postsSection() {
  return el('section', { class: 'section' },
    sectionHead({
      title: '指南与笔记',
      desc: '关于本地处理的原理、验证方法与能力边界。',
      link: textLink('全部文章', '#/blog'),
    }),
    el('div', { class: 'post-list' },
      ...POSTS.slice(0, 2).map(post => el('a', { class: 'post-item', href: `#/blog/${post.slug}` },
        el('div', {},
          el('div', { class: 'post-meta' },
            el('span', { class: 'post-tag', text: post.tag }),
            el('span', { text: post.date }),
            el('span', { text: `${post.minutes} 分钟` })),
          el('h3', { text: post.title }),
          el('p', { text: post.summary })),
        el('span', { class: 'post-arrow' }, glyphNode('arrow'))))));
}

const FAQ = [
  ['我怎么验证文件确实没有被上传？',
    '打开开发者工具的 Network 面板，往任意工具里拖入文件并运行：除了页面自身的静态资源，不会有任何请求携带你的文件。页面加载完成后断网，所有工具依然可以继续用。也可以直接使用「亲自验证」页的实时请求计数器。'],
  ['为什么选择浏览器本地处理？',
    '隐私安全：文件不上传，从源头避免泄露。速度更快：省去上传与下载，打开页面即可处理。没有服务端配额：不用排队，也没有页数或次数限制。'],
  ['支持哪些浏览器？',
    'Chrome、Edge、Firefox、Safari 等现代浏览器，建议使用最新版本。不支持 IE11 及更旧版本。音视频解码与语音音色取决于浏览器和操作系统。'],
  ['文件大小有限制吗？',
    '没有服务端限制，上限来自设备内存与浏览器 Canvas 尺寸。个别工具有单次处理上限（如 PDF 转 Word 单次 40 页 / 40 MB，PDF 转图片单次 30 页），工具页内均有注明。超大文件建议拆成小批处理。'],
  ['处理后的文件质量会下降吗？',
    '取决于工具。合并、提取等页面级操作保留原始内容；压缩 PDF、Word 转 PDF 等为重渲染的降级实现，会丢失文本层或排版细节——每个工具页都写明了实际做法与能力边界，不假装和云端方案等价。'],
  ['需要注册或登录吗？',
    '不需要。所有工具免费使用，无需注册、登录或提供邮箱，输出文件也不会加水印。'],
  ['我的数据会被追踪或分析吗？',
    '不会。站点没有统计脚本、没有广告、没有外部请求。收藏、最近使用与主题偏好只写在你浏览器的 localStorage 里，键前缀 xiaoyuTools:，清除站点数据即可全部删除。'],
  ['「一次选择，接着处理」是什么意思？',
    '一个操作完成后，可以把结果直接交给下一个兼容的工具，不用重新选择文件。结果只留在当前标签页的内存里，刷新即清空；如果下一个工具不接受这种格式，就不会自动填入。'],
  ['可以批量处理多个文件吗？',
    '可以。图片转 PDF、合并 PDF 等工具支持一次选多个文件；PDF 转图片这类多结果工具支持把结果打包成 ZIP 下载。'],
];

function faqSection() {
  return el('section', { class: 'section' },
    sectionHead({ title: '常见问题', desc: '关于隐私、边界与用法，先说清楚再开始。' }),
    el('div', { class: 'faq-list' },
      ...FAQ.map(([q, a]) => el('details', { class: 'faq-item' },
        el('summary', { text: q }),
        el('p', { text: a })))));
}

function ctaSection() {
  return el('section', { class: 'cta-band' },
    el('h2', { text: '准备好一次做完了吗？' }),
    el('p', { text: '选一次文件，需要下一步时把结果交给下一个兼容工具——全程都在你的浏览器里。' }),
    el('div', { class: 'hero-actions' },
      el('a', { class: 'button', href: '#/toolbox' }, glyphNode('toolbox'), el('span', { text: '查看所有工具' })),
      el('a', { class: 'button quiet', href: '#/tool/pdf-to-word' }, glyphNode('pdf'), el('span', { text: '试试 PDF 转 Word' }))));
}

export function renderHome(ctx) {
  const view = el('div', { class: 'home-landing' });
  view.append(
    el('section', { class: 'hero hero-landing' }, hero(ctx)),
    statStrip(),
    chainSection(),
    popularSection(ctx),
    clusterSection(),
    trustSection(),
    recentSection(ctx),
    postsSection(),
    faqSection(),
    ctaSection(),
  );
  return view;
}