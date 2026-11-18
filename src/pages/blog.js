/* 博客：工作台的说明与变更记录。文章以 Markdown 存在 src/data/posts.js，
   这里只负责列表、标签筛选与单篇渲染，不引入后台或数据库。 */
import { el } from '../core/ui.js';
import { glyphNode } from '../core/icons.js';
import { pageHead, sectionHead, emptyBox } from '../core/components.js';
import { renderMarkdown } from '../core/markdown.js';
import { POSTS, getPost } from '../data/posts.js';

const TAGS = [...new Set(POSTS.map(post => post.tag))];

function postRow(post) {
  return el('a', { class: 'post-item', href: `#/blog/${post.slug}` },
    el('div', {},
      el('div', { class: 'post-meta' },
        el('span', { class: 'post-tag', text: post.tag }),
        el('span', { text: post.date }),
        el('span', { text: `${post.minutes} 分钟` })),
      el('h3', { text: post.title }),
      el('p', { text: post.summary })),
    el('span', { class: 'post-arrow' }, glyphNode('arrow')));
}

export function renderBlog(ctx, tagId = 'all') {
  const view = el('div');
  const active = tagId === 'all' || TAGS.includes(tagId) ? tagId : 'all';
  const list = active === 'all' ? POSTS : POSTS.filter(post => post.tag === active);
  const totalMinutes = POSTS.reduce((sum, post) => sum + post.minutes, 0);

  view.append(pageHead({
    eyebrow: 'NOTES · 指南与笔记',
    title: '博客',
    lead: '本地处理的原理、零上传的验证方法、链式操作的用法与能力边界——都写在这里。写完不改旧文，只追加新的说明。',
    meta: [
      ['篇文章', POSTS.length],
      ['个标签', TAGS.length],
      ['阅读时长', `${totalMinutes} 分钟`],
      ['评论', '不需要'],
    ],
  }));

  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': '标签筛选' },
    ...[{ id: 'all', name: '全部', count: POSTS.length },
      ...TAGS.map(tag => ({ id: tag, name: tag, count: POSTS.filter(p => p.tag === tag).length }))]
      .map(option => el(active === option.id ? 'span' : 'a', {
        class: `chip ${active === option.id ? 'is-active' : ''}`,
        href: option.id === 'all' ? '#/blog' : `#/blog?tag=${encodeURIComponent(option.id)}`,
        'aria-current': active === option.id ? 'page' : null,
      },
        el('span', { text: option.name }),
        el('span', { class: 'chip-count', text: String(option.count) }))));
  view.append(el('div', { class: 'toolbar' }, chips));

  view.append(el('section', {},
    sectionHead({
      title: active === 'all' ? '全部文章' : `标签：${active}`,
      desc: '按时间倒序，最新的一篇在最上面',
      count: `${list.length} 篇`,
    }),
    list.length
      ? el('div', { class: 'post-list' }, ...list.map(postRow))
      : emptyBox('这个标签下还没有文章。')));

  view.append(el('div', { class: 'tool-foot' },
    el('span', { text: '文章随站点一起离线，不加载评论与统计脚本。' }),
    el('a', { href: '#/toolbox', text: '去看工具 →' }),
    el('span', { text: 'Markdown 由站内渲染器转换' })));
  return view;
}

export function renderPost(ctx, slug) {
  const post = getPost(slug);
  if (!post) {
    return el('div', {},
      pageHead({ eyebrow: 'NOT FOUND', title: '这篇还没有写', lead: `没有找到 slug 为「${slug}」的文章。` }),
      el('a', { class: 'button', href: '#/blog' }, glyphNode('back'), el('span', { text: '回到博客列表' })));
  }

  const index = POSTS.indexOf(post);
  const newer = POSTS[index - 1] || null;
  const older = POSTS[index + 1] || null;

  const body = el('div', { class: 'prose' });
  body.innerHTML = renderMarkdown(post.body);

  const view = el('div', {},
    el('div', { class: 'page-top' },
      el('nav', { class: 'crumb', 'aria-label': '位置' },
        el('a', { href: '#/blog', text: '博客' }),
        el('span', { class: 'sep', text: '/' }),
        el('span', { class: 'crumb-current', text: post.tag }))),
    el('article', { class: 'article' },
      el('header', { class: 'article-head' },
        el('span', { class: 'eyebrow' }, el('i'), el('span', { text: `${post.tag} · ${post.date}` })),
        el('h1', { text: post.title }),
        el('div', { class: 'article-meta' },
          el('span', { text: `${post.minutes} 分钟读完` }),
          el('span', { text: `${post.body.replace(/\s/g, '').length} 字` }),
          el('span', { text: '只在本机渲染' }))),
      body,
      el('footer', { class: 'tool-foot' },
        older
          ? el('a', { href: `#/blog/${older.slug}`, text: `← 上一篇：${older.title}` })
          : el('a', { href: '#/blog', text: '← 回到列表' }),
        newer
          ? el('a', { href: `#/blog/${newer.slug}`, text: `下一篇：${newer.title} →` })
          : el('span', { text: '已经是最新一篇' })),
      el('div', { class: 'section' },
        sectionHead({ title: '继续读', desc: '另外几篇指南与笔记' }),
        el('div', { class: 'post-list' },
          ...POSTS.filter(item => item.slug !== post.slug).slice(0, 2).map(postRow)))));
  return view;
}
