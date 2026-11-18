/* 应用外壳：侧栏（一级入口 + 工具集群）+ 顶栏 + hash 路由。
   页面本身都在 src/pages/ 下，这里只负责选页、面包屑、检索与主题。 */
import { el, toast } from './core/ui.js';
import { glyphNode, CATEGORY_GLYPH } from './core/icons.js';
import { tools, toolsById, categories, toolsInCategory, catalog } from './core/registry.js';
import {
  getTheme, setTheme, toggleFavorite, markRecent, isFavorite,
} from './core/store.js';
import { SECTIONS, TRUST_PAGES } from './data/workspaces.js';
import { POSTS } from './data/posts.js';
import { renderHome } from './pages/home.js';
import { renderToolbox, renderSearch } from './pages/toolbox.js';
import { renderBlog, renderPost } from './pages/blog.js';
import { renderAbout, renderPrivacy, renderTerms, renderVerify } from './pages/trust.js';
import { sectionHead, toolGrid } from './core/components.js';

const app = document.getElementById('app');

/* 各分区的副标题与计数：数字由真实注册表算出来，不写死 */
const SECTION_META = {
  toolbox: { caption: '全量工具库', count: () => tools.length },
  blog: { caption: '指南与笔记', count: () => POSTS.length },
};

let viewRef;
let navRef;
let crumbRef;
let searchRef;
let sidebarRef;
let backdropRef;
let liveRef;
let railFill;
let themeButtons = [];

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 路由 ---------- */

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(queryPart || '');
  const [head, tail] = segments;

  if (!head) return { name: 'home' };
  if (head === 'toolbox') return { name: 'toolbox', filter: tail || params.get('filter') || 'all' };
  if (head === 'blog') return tail ? { name: 'post', slug: tail } : { name: 'blog', tag: params.get('tag') || 'all' };
  if (head === 'tool') return { name: 'tool', id: tail || '' };
  if (head === 'search') return { name: 'search', query: segments.slice(1).join('/') };
  if (['about', 'privacy', 'terms', 'verify'].includes(head)) return { name: head };
  /* 旧版个人分区已下线，旧链接统一回工具箱 */
  if (head === 'finance' || head === 'leisure') return { name: 'toolbox', filter: 'all' };
  return { name: 'home' };
}

function go(hash) {
  if (location.hash === hash) renderRoute();
  else location.hash = hash;
}

/* 面包屑：[首页] / [分区] / [当前页] */
function crumbsFor(route) {
  const trail = [];
  if (route.name === 'home') return [{ label: '首页' }];
  trail.push({ label: '首页', href: '#/' });

  const trust = TRUST_PAGES.find(item => item.id === route.name);
  if (trust) {
    trail.push({ label: trust.name });
    return trail;
  }

  const sectionId = { toolbox: 'toolbox', blog: 'blog', post: 'blog' }[route.name];
  const section = SECTIONS.find(item => item.id === sectionId);
  if (section) {
    trail.push({ label: section.name, href: section.path });
  } else {
    trail.push({ label: '工具箱', href: '#/toolbox' });
  }

  if (route.name === 'tool') {
    const tool = toolsById.get(route.id);
    trail.push({ label: tool ? tool.name : '未找到' });
  } else if (route.name === 'post') {
    const post = POSTS.find(item => item.slug === route.slug);
    trail.push({ label: post ? post.title : '未找到' });
  } else if (route.name === 'search') {
    trail.push({ label: `检索「${route.query}」` });
  } else if (route.name === 'toolbox' && route.filter !== 'all') {
    const category = categories.find(c => c.id === route.filter);
    trail.push({ label: route.filter === 'fav' ? '我的收藏' : route.filter === 'recent' ? '最近使用' : (category?.name || '分类') });
  }
  return trail;
}

/* ---------- 页面上下文 ---------- */

function onFavorite(id) {
  const on = toggleFavorite(id);
  toast(on ? '已加入收藏' : '已取消收藏', 'ok');
  /* 就地更新所有同名星标，避免整页重绘导致滚动跳动 */
  document.querySelectorAll(`[data-fav-for="${id}"]`).forEach(button => {
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', `${on ? '取消收藏' : '加入收藏'}：${toolsById.get(id)?.name || ''}`);
    pop(button);
  });
  if (viewRef.querySelector('.deck')) renderView();
}

/* 星标按下的弹性反馈：一次性 WAAPI 动画，不污染 class 状态 */
function pop(node) {
  if (prefersReduced() || typeof node.animate !== 'function') return;
  node.animate(
    [{ transform: 'scale(.72)' }, { transform: 'scale(1.24)' }, { transform: 'scale(1)' }],
    { duration: 340, easing: 'cubic-bezier(.2,.9,.2,1)' },
  );
}

const ctx = { go, onFavorite };

/* ---------- 工具详情页 ---------- */

/* 能力边界：参考目录里登记为降级实现的工具，在页顶明示真实做法 */
function boundaryNotice(tool) {
  const entry = catalog.find(item => item.implId === tool.id && item.downgrade);
  if (!entry) return null;
  return el('div', { class: 'notice' },
    glyphNode('shield'),
    el('div', {},
      el('strong', { text: '能力边界（降级实现）' }),
      el('p', { text: entry.note })));
}

function toolExtras(tool) {
  const blocks = [];
  if (Array.isArray(tool.steps) && tool.steps.length) {
    blocks.push(el('section', { class: 'panel tool-howto' },
      el('h3', { class: 'panel-title', text: '使用步骤' }),
      el('ol', { class: 'steps' }, ...tool.steps.map(step => el('li', { text: step })))));
  }
  if (Array.isArray(tool.faq) && tool.faq.length) {
    blocks.push(el('section', { class: 'panel tool-howto' },
      el('h3', { class: 'panel-title', text: '常见问题' }),
      ...tool.faq.map(([q, a]) => el('details', { class: 'faq-item' },
        el('summary', { text: q }), el('p', { text: a })))));
  }
  const related = toolsInCategory(tool.category).filter(t => t.id !== tool.id).slice(0, 4);
  if (related.length) {
    blocks.push(el('section', { class: 'section' },
      sectionHead({ title: '同集群工具', desc: '处理完这一步，也许还需要下一步' }),
      toolGrid(related, { onFavorite })));
  }
  return blocks;
}

function renderToolPage(tool) {
  const favOn = isFavorite(tool.id);
  const favButton = el('button', {
    class: `star-btn ${favOn ? 'is-on' : ''}`,
    type: 'button',
    text: favOn ? '已在收藏' : '加入收藏',
    'aria-pressed': String(favOn),
    onclick: () => {
      const on = toggleFavorite(tool.id);
      favButton.textContent = on ? '已在收藏' : '加入收藏';
      favButton.classList.toggle('is-on', on);
      favButton.setAttribute('aria-pressed', String(on));
      pop(favButton);
      toast(on ? '已加入收藏' : '已取消收藏', 'ok');
      renderNav();
    },
  });

  const head = el('div', { class: 'tool-head' },
    el('div', { class: 'tool-head-top' },
      el('button', { class: 'back-btn', type: 'button', onclick: () => go('#/toolbox') },
        glyphNode('back'), el('span', { text: '返回工具箱' })),
      favButton),
    el('div', { class: 'tool-eyebrow' },
      el('span', { class: 'eyebrow' }, el('i'),
        el('span', { text: `第 ${(tool.index ?? 0) + 1} 件 · 全部在本机运行` }))),
    el('div', { class: 'tool-head-main' },
      el('span', { class: 'badge badge-lg' }, glyphNode(CATEGORY_GLYPH[tool.category] || 'grid')),
      el('div', {},
        el('h2', { text: tool.name }),
        el('p', { class: 'tool-desc', text: tool.desc }))),
    el('div', { class: 'tool-badges' },
      el('span', { class: 'mini-badge' }, glyphNode('shield'), el('span', { text: '本地处理' })),
      el('span', { class: 'mini-badge' }, glyphNode('bolt'), el('span', { text: '不上传' })),
      el('span', { class: 'mini-badge' }, glyphNode('star'), el('span', { text: '免费无水印' }))));

  const body = el('div', { class: 'tool-body' });
  const notice = boundaryNotice(tool);
  if (notice) body.append(notice);
  try {
    tool.render(body);
  } catch (error) {
    body.append(el('div', { class: 'empty', text: `工具初始化失败：${error.message}` }));
    console.error(error);
  }

  markRecent(tool.id);
  return el('div', { class: 'tool-page' }, head, body, ...toolExtras(tool));
}

/* ---------- 侧栏 ---------- */

function renderNav() {
  navRef.replaceChildren();
  navRef.append(el('div', { class: 'side-caption', text: '站点' }));

  const route = parseRoute();
  for (const section of SECTIONS) {
    const active = section.id === route.name
      || (section.id === 'toolbox' && ['tool', 'search'].includes(route.name))
      || (section.id === 'blog' && route.name === 'post');
    const meta = SECTION_META[section.id];
    navRef.append(el('a', {
      class: `nav-item ${active ? 'is-active' : ''}`,
      href: section.path,
      'aria-current': active ? 'page' : null,
    },
      glyphNode(section.icon),
      el('span', { text: section.name }),
      meta ? el('span', { class: 'nav-count', text: String(meta.count()) }) : null));
  }

  navRef.append(el('div', { class: 'nav-divider' }));
  navRef.append(el('div', { class: 'side-caption', text: '工具集群' }));
  for (const category of categories) {
    const count = toolsInCategory(category.id).length;
    if (!count) continue;
    const active = route.name === 'toolbox' && route.filter === category.id;
    navRef.append(el('a', {
      class: `nav-item ${active ? 'is-active' : ''}`,
      href: `#/toolbox/${category.id}`,
      'aria-current': active ? 'page' : null,
    },
      glyphNode(CATEGORY_GLYPH[category.id] || 'grid'),
      el('span', { text: category.name }),
      el('span', { class: 'nav-count', text: String(count) })));
  }

  navRef.append(el('div', { class: 'nav-divider' }));
  navRef.append(el('div', { class: 'side-caption', text: '目录' }));
  navRef.append(
    el('a', {
      class: `nav-item ${route.name === 'toolbox' && route.filter === 'fav' ? 'is-active' : ''}`,
      href: '#/toolbox/fav',
    }, glyphNode('star'), el('span', { text: '我的收藏' })),
    el('a', {
      class: `nav-item ${route.name === 'toolbox' && route.filter === 'recent' ? 'is-active' : ''}`,
      href: '#/toolbox/recent',
    }, glyphNode('clock'), el('span', { text: '最近使用' })));

  navRef.append(el('div', { class: 'nav-divider' }));
  for (const page of TRUST_PAGES) {
    navRef.append(el('a', {
      class: `nav-item ${route.name === page.id ? 'is-active' : ''}`,
      href: page.path,
      'aria-current': route.name === page.id ? 'page' : null,
    }, glyphNode(page.icon), el('span', { text: page.name })));
  }
}

/* ---------- 主视图 ---------- */

let lastRouteKey = null;

function renderView() {
  viewRef.replaceChildren();
  const route = parseRoute();
  const routeKey = [route.name, route.id, route.slug, route.filter, route.tag, route.query].filter(Boolean).join(':');
  const isNewRoute = routeKey !== lastRouteKey;
  lastRouteKey = routeKey;
  let node;

  switch (route.name) {
    case 'tool': {
      const tool = toolsById.get(route.id);
      if (!tool) {
        node = el('div', {},
          el('div', { class: 'page-head' },
            el('span', { class: 'eyebrow' }, el('i'), el('span', { text: 'NOT FOUND' })),
            el('h1', { text: '这件工具还没做' }),
            el('p', { class: 'page-lead', text: `没有找到 id 为「${route.id}」的工具。可能是链接过期，或者它被改名了。` })),
          el('a', { class: 'button', href: '#/toolbox' }, glyphNode('back'), el('span', { text: '回到工具箱' })));
        break;
      }
      node = renderToolPage(tool);
      break;
    }
    case 'toolbox': node = renderToolbox(ctx, route.filter); break;
    case 'blog': node = renderBlog(ctx, route.tag); break;
    case 'post': node = renderPost(ctx, route.slug); break;
    case 'search': node = renderSearch(ctx, route.query); break;
    case 'about': node = renderAbout(); break;
    case 'privacy': node = renderPrivacy(); break;
    case 'terms': node = renderTerms(); break;
    case 'verify': node = renderVerify(); break;
    default: node = renderHome(ctx);
  }

  viewRef.append(node);
  renderCrumbs(route);
  document.title = titleFor(route);
  /* 只有换页才回到顶部；在本页点收藏不打断阅读位置 */
  if (isNewRoute) window.scrollTo({ top: 0, behavior: 'auto' });
}

function titleFor(route) {
  const base = 'xiaoyuTools · 免费在线工具站';
  if (route.name === 'tool') return `${toolsById.get(route.id)?.name || '工具'} · ${base}`;
  if (route.name === 'post') return `${POSTS.find(p => p.slug === route.slug)?.title || '文章'} · ${base}`;
  if (route.name === 'search') return `检索 ${route.query} · ${base}`;
  const trust = TRUST_PAGES.find(item => item.id === route.name);
  if (trust) return `${trust.name} · ${base}`;
  const section = SECTIONS.find(item => item.id === route.name);
  return section ? `${section.name} · ${base}` : base;
}

function renderCrumbs(route) {
  const trail = crumbsFor(route);
  crumbRef.replaceChildren(...trail.flatMap((item, index) => {
    const nodes = [];
    if (index) nodes.push(el('span', { class: 'sep', text: '/' }));
    nodes.push(item.href
      ? el('a', { href: item.href, text: item.label })
      : el('span', { class: 'crumb-current', text: item.label, 'aria-current': 'page' }));
    return nodes;
  }));
}

function renderRoute() {
  renderNav();
  renderView();
  closeSidebar();
  scheduleProgress();
}

/* ---------- 主题 ---------- */

function paintTheme() {
  const dark = getTheme() === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeButtons.forEach(button => {
    button.replaceChildren(glyphNode(dark ? 'sun' : 'moon'));
    button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    button.setAttribute('aria-pressed', String(dark));
    button.title = dark ? '切换到浅色主题' : '切换到深色主题';
  });
}

function toggleTheme(event) {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => { setTheme(next); paintTheme(); };

  /* 支持 View Transition 时，让主题从按钮位置圆形展开；否则直接切换 */
  if (document.startViewTransition && !prefersReduced()) {
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : 0;
    document.documentElement.style.setProperty('--vt-x', `${x}px`);
    document.documentElement.style.setProperty('--vt-y', `${y}px`);
    document.startViewTransition(apply);
  } else {
    apply();
  }
  toast(next === 'dark' ? '已切换到深色' : '已切换到浅色', 'ok');
}

/* ---------- 滚动进度与指针高光 ---------- */

let railFrame = 0;

function paintProgress() {
  railFrame = 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 40 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  railFill?.style.setProperty('--progress', ratio.toFixed(4));
}

function scheduleProgress() {
  if (railFrame) return;
  railFrame = requestAnimationFrame(paintProgress);
}

/* 卡片高光跟随指针：只写被指到的那一张，避免整页卡片同时重算 */
function onPointerMove(event) {
  const card = event.target instanceof Element
    ? event.target.closest('.card, .workspace-card')
    : null;
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${(event.clientX - rect.left).toFixed(1)}px`);
  card.style.setProperty('--my', `${(event.clientY - rect.top).toFixed(1)}px`);
}

/* ---------- 检索 ---------- */

let searchTimer = null;
function onSearchInput(value) {
  clearTimeout(searchTimer);
  const q = value.trim();
  searchTimer = setTimeout(() => {
    if (!q) {
      if (parseRoute().name === 'search') go('#/');
      return;
    }
    const hash = `#/search/${encodeURIComponent(q)}`;
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
      renderNav();
      renderView();
    }
  }, 220);
}

/* ---------- 移动端侧栏 ---------- */

function openSidebar() {
  sidebarRef.classList.add('is-open');
  backdropRef.classList.add('is-on');
}
function closeSidebar() {
  sidebarRef.classList.remove('is-open');
  backdropRef.classList.remove('is-on');
}

/* ---------- 键盘 ---------- */

function onKey(event) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (event.key === '/' && !typing) {
    event.preventDefault();
    searchRef?.focus();
    searchRef?.select();
    return;
  }
  if (event.key === 'Escape') {
    if (document.activeElement === searchRef) {
      event.preventDefault();
      searchRef.value = '';
      searchRef.blur();
      return;
    }
    if (typing) return;
    if (sidebarRef.classList.contains('is-open')) closeSidebar();
  }
}

/* ---------- 构建 ---------- */

function build() {
  paintTheme();

  /* 主题按钮：侧栏和窄屏顶栏各一个，共用同一套绘制逻辑 */
  const makeThemeButton = extra => {
    const button = el('button', {
      class: `icon-btn ${extra || ''}`.trim(), type: 'button',
      onclick: toggleTheme,
    });
    themeButtons.push(button);
    return button;
  };

  searchRef = el('input', {
    class: 'search', type: 'search', id: 'tool-search',
    placeholder: `检索 ${tools.length} 件工具…`, autocomplete: 'off', spellcheck: false,
    'aria-label': '检索工具',
    oninput: event => onSearchInput(event.target.value),
  });

  const searchWrap = el('div', { class: 'search-wrap' },
    el('label', { class: 'sr-only', for: 'tool-search', text: '检索工具' }),
    glyphNode('search', 'search-icon'),
    searchRef,
    el('kbd', { class: 'search-kbd', text: '/', 'aria-hidden': 'true' }));

  navRef = el('nav', { class: 'nav', 'aria-label': '站点导航' });

  sidebarRef = el('aside', { class: 'sidebar', id: 'sidebar' },
    el('div', { class: 'brand' },
      el('div', { class: 'brand-mark', text: 'xy' }),
      el('div', { class: 'brand-text' },
        el('h1', { text: 'xiaoyuTools' }),
        el('p', { text: '免费 · 免注册 · 本地处理' }))),
    searchWrap,
    navRef,
    el('div', { class: 'side-foot' },
      el('div', { class: 'side-status' }, el('i'), el('span', { text: '全部计算留在本机' })),
      el('div', { class: 'side-actions' },
        makeThemeButton())));

  backdropRef = el('div', { class: 'sidebar-backdrop', onclick: closeSidebar });

  const mobileBar = el('div', { class: 'mobile-bar' },
    el('div', { class: 'brand' },
      el('div', { class: 'brand-mark', text: 'xy' }),
      el('div', { class: 'brand-text' },
        el('h1', { text: 'xiaoyuTools' }),
        el('p', { text: '免费在线工具站' }))),
    el('div', { class: 'top-meta' },
      el('a', { class: 'icon-btn', href: '#/toolbox', title: '工具箱' }, glyphNode('toolbox')),
      makeThemeButton(),
      el('button', {
        class: 'icon-btn', type: 'button', 'aria-label': '打开站点菜单', title: '打开站点菜单',
        onclick: openSidebar,
      }, glyphNode('menu'))));

  crumbRef = el('nav', { class: 'crumb', 'aria-label': '位置' });
  const topLine = el('div', { class: 'page-top' },
    crumbRef,
    el('div', { class: 'top-meta' },
      el('span', { class: 'meta-current', text: `${tools.length} 件工具 · 0 次外部请求` })));

  viewRef = el('div', { class: 'view' });
  liveRef = el('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  railFill = el('i');
  const scrollRail = el('div', { class: 'scroll-rail', 'aria-hidden': 'true' }, railFill);

  const footer = el('footer', { class: 'footer' },
    el('div', { class: 'footer-links' },
      ...TRUST_PAGES.map(page => el('a', { href: page.path, text: page.name })),
      el('a', { href: '#/blog', text: '博客' })),
    el('div', { class: 'footer-note' },
      el('span', { text: '所有处理在浏览器本地完成，文件不会发送到任何服务器。' }),
      el('span', { class: 'mono', text: `© ${new Date().getFullYear()} xiaoyuTools · ${tools.length} tools offline` })));

  const content = el('div', { class: 'content', id: 'main', tabindex: '-1' }, topLine, viewRef, footer);

  const shell = el('div', { class: 'shell' }, sidebarRef, backdropRef,
    el('div', { class: 'main' }, mobileBar, content));

  app.replaceChildren(shell, liveRef, scrollRail);
  paintTheme();
  renderRoute();
  scheduleProgress();
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('keydown', onKey);
window.addEventListener('scroll', scheduleProgress, { passive: true });
window.addEventListener('resize', scheduleProgress);
document.addEventListener('pointermove', onPointerMove, { passive: true });
build();