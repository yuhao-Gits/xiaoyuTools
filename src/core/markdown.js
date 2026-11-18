/* 轻量 Markdown 渲染：只覆盖常用语法，渲染前转义 HTML 并限制链接协议。
   被「Markdown 预览」工具与博客文章共用，避免两处实现漂移。 */
import { escapeHtml } from './ui.js';

function inlineMarkdown(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  safe = safe.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, href) => {
    const allowed = /^(https?:\/\/|mailto:|#|\/|\.\/)/i.test(href);
    const target = allowed ? href : '#';
    const external = /^https?:\/\//i.test(target);
    return `<a href="${escapeHtml(target)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  return safe;
}

export function renderMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeLines = [];
  let listType = null;
  let listItems = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listType) {
      html.push(`<${listType}>${listItems.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</${listType}>`);
      listType = null;
      listItems = [];
    }
  };
  const flushAll = () => { flushParagraph(); flushList(); };

  /* 表格：| a | b | 加一行 | --- | --- | 才算表格，否则当普通段落里的竖线 */
  const splitRow = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  const isDivider = line => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      flushAll();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!inCode && line.includes('|') && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushAll();
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(cell => (/^:-+:$/.test(cell) ? 'center' : /-+:$/.test(cell) ? 'right' : 'left'));
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
        rows.push(splitRow(lines[j]));
        j += 1;
      }
      const cell = (tag, text, index) => `<${tag} style="text-align:${aligns[index] || 'left'}">${inlineMarkdown(text)}</${tag}>`;
      html.push([
        '<div class="table-wrap"><table><thead><tr>',
        head.map((text, index) => cell('th', text, index)).join(''),
        '</tr></thead><tbody>',
        rows.map(row => `<tr>${head.map((_, index) => cell('td', row[index] || '', index)).join('')}</tr>`).join(''),
        '</tbody></table></div>',
      ].join(''));
      i = j - 1;
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushAll();
      html.push('<hr>');
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (listType && listType !== type) flushList();
      listType = type;
      listItems.push((bullet || ordered)[1]);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  flushAll();
  return html.join('\n');
}
