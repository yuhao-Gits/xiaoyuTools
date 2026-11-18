/* 工具箱：全量工具库。分类胶囊切换用 hash 表达，刷新和分享都能还原现场。 */
import { el } from '../core/ui.js';
import { glyphNode, CATEGORY_GLYPH } from '../core/icons.js';
import {
  tools, toolsById, categories, toolsInCategory, searchTools,
} from '../core/registry.js';
import { getFavorites, getRecents } from '../core/store.js';
import {
  pageHead, sectionHead, textLink, chipRow, toolGrid, emptyBox,
} from '../core/components.js';

export function renderToolbox(ctx, categoryId = 'all') {
  const view = el('div', { class: 'tool-index' });
  const favs = getFavorites().map(id => toolsById.get(id)).filter(Boolean);
  const recents = getRecents().map(id => toolsById.get(id)).filter(Boolean);

  const options = [
    { id: 'all', name: '全部', icon: 'grid', count: tools.length },
    { id: 'fav', name: '我的收藏', icon: 'star', count: favs.length },
    { id: 'recent', name: '最近使用', icon: 'clock', count: recents.length },
    ...categories
      .filter(category => toolsInCategory(category.id).length)
      .map(category => ({
        id: category.id,
        name: category.name,
        icon: CATEGORY_GLYPH[category.id] || 'grid',
        count: toolsInCategory(category.id).length,
      })),
  ];

  const active = options.some(option => option.id === categoryId) ? categoryId : 'all';

  view.append(
    pageHead({
      eyebrow: 'TOOLBOX · 全部在本机运行',
      title: '工具箱',
      lead: '按集群检索：文档 PDF、图片、文本、开发者、计算换算、音频、视频、时间专注与创意娱乐。每件工具都是独立的页面，打开即用，文件不上传。',
      meta: [
        ['件工具', tools.length],
        ['个集群', categories.length],
        ['已收藏', favs.length],
      ],
    }),
    el('div', { class: 'toolbar' }, chipRow(options, active, id => ctx.go(`#/toolbox/${id}`))),
  );

  if (active === 'fav') {
    view.append(el('section', {},
      sectionHead({ title: '我的收藏', desc: '收藏状态只保存在本机浏览器', count: `${favs.length} 件` }),
      favs.length ? toolGrid(favs, { onFavorite: ctx.onFavorite }) : emptyBox('还没有收藏。打开任意工具后点右上角星标即可加入。')));
  } else if (active === 'recent') {
    view.append(el('section', {},
      sectionHead({ title: '最近使用', desc: '最多记录最近 8 件', count: `${recents.length} 件` }),
      recents.length ? toolGrid(recents, { onFavorite: ctx.onFavorite }) : emptyBox('还没有使用记录，随便翻开一件吧。')));
  } else if (active !== 'all') {
    const category = categories.find(c => c.id === active);
    const list = toolsInCategory(active);
    view.append(el('section', {},
      sectionHead({ title: category?.name || '工具', desc: category?.desc || '', count: `${list.length} 件` }),
      toolGrid(list, { onFavorite: ctx.onFavorite })));
  } else {
    categories.filter(c => toolsInCategory(c.id).length).forEach(category => {
      const list = toolsInCategory(category.id);
      view.append(el('section', { class: 'section' },
        sectionHead({
          title: category.name,
          desc: category.desc,
          count: `${list.length} 件`,
          link: textLink(`只看${category.name}`, `#/toolbox/${category.id}`),
        }),
        toolGrid(list, { onFavorite: ctx.onFavorite })));
    });
  }

  view.append(el('div', { class: 'tool-foot' },
    el('span', { text: `${tools.length} 件工具，分 ${categories.length} 个集群。` }),
    el('span', { text: '所有处理在浏览器内完成，不上传任何文件' })));
  return view;
}

export function renderSearch(ctx, query) {
  const q = query.trim();
  const hits = searchTools(q);
  const view = el('div');
  view.append(pageHead({
    eyebrow: 'SEARCH',
    title: `检索「${q}」`,
    lead: hits.length
      ? `按名称、说明与关键词命中 ${hits.length} 件工具。`
      : '没有匹配的工具。试试更短的关键词，或者从下面的门类直接进。',
    meta: [['命中', hits.length], ['全库', tools.length]],
  }));

  if (hits.length) {
    view.append(toolGrid(hits, { onFavorite: ctx.onFavorite }));
  } else {
    view.append(emptyBox('没有匹配结果。可以按门类翻阅：'));
    view.append(el('div', { class: 'chips', style: { marginTop: '14px' } },
      ...categories
        .filter(category => toolsInCategory(category.id).length)
        .map(category => el('a', {
          class: 'chip',
          href: `#/toolbox/${category.id}`,
        }, glyphNode(CATEGORY_GLYPH[category.id] || 'grid'),
          el('span', { text: category.name }),
          el('span', { class: 'chip-count', text: String(toolsInCategory(category.id).length) })))));
  }
  return view;
}


