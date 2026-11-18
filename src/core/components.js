/* 页面共用组件：页头、分组标题、筛选胶囊、工具卡片、空状态。
   各分区页面只组合这些块，不各写一套卡片样式。 */
import { el } from './ui.js';
import { glyphNode, CATEGORY_GLYPH } from './icons.js';
import { categories } from './registry.js';
import { isFavorite } from './store.js';

export const categoryName = id => (categories.find(c => c.id === id) || {}).name || '工具';

export function pageHead({ eyebrow = '', title = '', lead = '', meta = [], actions = null }) {
  const node = el('header', { class: 'page-head' },
    eyebrow ? el('span', { class: 'eyebrow' }, el('i'), el('span', { text: eyebrow })) : null,
    el('h1', { text: title }),
    lead ? el('p', { class: 'page-lead', text: lead }) : null,
    meta.length
      ? el('div', { class: 'page-meta' }, ...meta.map(([label, value]) => el('span', {},
        el('b', { text: String(value) }),
        el('span', { text: ` ${label}` }))))
      : null,
    actions);
  return node;
}

export function sectionHead({ title, desc = '', count = null, link = null }) {
  return el('div', { class: 'section-head' },
    el('div', {},
      el('h2', { text: title }),
      desc ? el('p', { text: desc }) : null),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
      count !== null ? el('span', { class: 'section-count', text: count }) : null,
      link || null));
}

export function textLink(label, href, icon = 'arrow') {
  return el('a', { class: 'section-link', href },
    el('span', { text: label }), glyphNode(icon));
}

export function chipRow(options, activeId, onSelect) {
  const row = el('div', { class: 'chips', role: 'group', 'aria-label': '分类筛选' });
  for (const option of options) {
    const active = option.id === activeId;
    row.append(el('button', {
      class: `chip ${active ? 'is-active' : ''}`,
      type: 'button',
      'aria-pressed': String(active),
      onclick: () => onSelect(option.id),
    },
      option.icon ? glyphNode(option.icon) : null,
      el('span', { text: option.name }),
      option.count !== undefined ? el('span', { class: 'chip-count', text: String(option.count) }) : null));
  }
  return row;
}

export function toolCard(tool, { onFavorite = null, index = null } = {}) {
  const favOn = isFavorite(tool.id);
  const favBtn = el('button', {
    class: `card-fav ${favOn ? 'is-on' : ''}`,
    type: 'button',
    'data-fav-for': tool.id,
    'aria-label': `${favOn ? '取消收藏' : '加入收藏'}：${tool.name}`,
    'aria-pressed': String(favOn),
    title: favOn ? '取消收藏' : '加入收藏',
    onclick: event => {
      event.preventDefault();
      event.stopPropagation();
      if (onFavorite) onFavorite(tool.id);
    },
  }, glyphNode('star'));

  return el('article', { class: 'card tool-card' },
    el('div', { class: 'card-top' },
      el('span', { class: 'card-icon' }, glyphNode(CATEGORY_GLYPH[tool.category] || 'grid')),
      index !== null ? el('span', { class: 'card-index', text: String(index).padStart(3, '0') }) : null),
    el('div', { class: 'card-name', text: tool.name }),
    el('span', { class: 'card-desc', text: tool.desc }),
    el('div', { class: 'card-foot' },
      el('span', { text: categoryName(tool.category) }),
      el('span', { class: 'card-action' }, el('span', { text: '打开' }), glyphNode('arrow'))),
    el('a', {
      class: 'card-open', href: `#/tool/${tool.id}`,
      'aria-label': `打开 ${tool.name}`,
    }),
    favBtn);
}

export function toolGrid(list, options = {}) {
  if (!list.length) return emptyBox(options.emptyText || '这里还没有内容');
  return el('div', { class: 'grid' },
    ...list.map((tool, i) => toolCard(tool, { ...options, index: (tool.index ?? i) + 1 })));
}

export function emptyBox(text) {
  return el('div', { class: 'empty', text });
}
