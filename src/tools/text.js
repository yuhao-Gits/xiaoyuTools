import {
  el, txt, sel, btn, panel, actions, copyText, downloadText, hint, escapeHtml,
} from '../core/ui.js';
import { renderMarkdown } from '../core/markdown.js';

function toHalfWidth(value) {
  return value
    .replace(/[\uFF01-\uFF5E]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/\u3000/g, ' ');
}

export const textTools = [
  {
    id: 'text-stats',
    name: '文本统计',
    category: 'text',
    desc: '字符、词数、行数、字节数一屏看全',
    keywords: ['统计', '字数', '字符', '字节'],
    render(root) {
      const input = txt({ rows: 12, placeholder: '粘贴或输入文本，统计会实时更新…' });
      const grid = el('div', { class: 'stat-grid' });

      const update = value => {
        const bytes = new TextEncoder().encode(value).length;
        const lines = value ? value.replace(/\r\n/g, '\n').split('\n') : [];
        const words = (value.match(/[\u4e00-\u9fff]|[A-Za-z0-9_'-]+/g) || []).length;
        const paragraphs = value.split(/\n\s*\n/).filter(part => part.trim()).length;
        const items = [
          ['字符数（含空白）', value.length],
          ['字符数（不含空白）', value.replace(/\s/g, '').length],
          ['中英文词 / 字数', words],
          ['行数', lines.length],
          ['非空行数', lines.filter(line => line.trim()).length],
          ['段落数', paragraphs],
          ['UTF-8 字节数', bytes],
          ['最长行字符数', lines.reduce((max, line) => Math.max(max, line.length), 0)],
        ];
        grid.replaceChildren(...items.map(([label, count]) => el('div', { class: 'stat' },
          el('span', { class: 'stat-label', text: label }),
          el('strong', { text: String(count) }))));
      };

      input.addEventListener('input', () => update(input.value));
      update('');
      root.append(
        panel('输入', input,
          actions(btn('清空', () => { input.value = ''; update(''); }))),
        panel('统计结果', grid),
        hint('中文按单字计，连续英数按一个词计；字节数按 UTF-8 计算。'),
      );
    },
  },
  {
    id: 'text-clean',
    name: '文本清洗',
    category: 'text',
    desc: '按勾选的组合规则批量整理文本',
    keywords: ['清洗', '去重', '排序', '全角', '大小写'],
    render(root) {
      const input = txt({ rows: 9, placeholder: '原始文本…' });
      const output = txt({ rows: 9, placeholder: '处理结果…' });

      const operations = [
        { label: '合并多余空格', checked: true, fn: value => value.replace(/[ \t]{2,}/g, ' ') },
        { label: '去除每行首尾空白', checked: true, fn: value => value.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).join('\n') },
        { label: '删除空行', fn: value => value.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim()).join('\n') },
        { label: '合并连续空行为一个', fn: value => value.replace(/\n{3,}/g, '\n\n') },
        { label: '删除重复行（保留首次）', fn: value => {
          const seen = new Set();
          return value.replace(/\r\n/g, '\n').split('\n').filter(line => {
            if (seen.has(line)) return false;
            seen.add(line);
            return true;
          }).join('\n');
        } },
        { label: '按行排序', fn: value => value.replace(/\r\n/g, '\n').split('\n').sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n') },
        { label: '全角字符转半角', fn: toHalfWidth },
        { label: '去除 HTML 标签', fn: value => value.replace(/<[^>]*>/g, '') },
      ];

      const boxes = operations.map(op => {
        const checkbox = el('input', { type: 'checkbox', checked: Boolean(op.checked) });
        return { op, checkbox, node: el('label', { class: 'check' }, checkbox, el('span', { text: op.label })) };
      });

      const caseMode = sel([
        { value: 'none', label: '不调整大小写' },
        { value: 'upper', label: '全部大写' },
        { value: 'lower', label: '全部小写' },
      ], 'none');

      const run = () => {
        let value = input.value;
        for (const { op, checkbox } of boxes) {
          if (checkbox.checked) value = op.fn(value);
        }
        if (caseMode.value === 'upper') value = value.toUpperCase();
        if (caseMode.value === 'lower') value = value.toLowerCase();
        output.value = value;
      };

      root.append(
        panel('输入', input),
        panel('处理规则',
          el('div', { class: 'check-grid' }, ...boxes.map(item => item.node)),
          el('div', { class: 'inline-fields' },
            el('label', { class: 'field' }, el('span', { class: 'field-label', text: '大小写' }), caseMode))),
        actions(
          btn('应用规则', run, 'primary'),
          btn('复制结果', () => copyText(output.value)),
          btn('下载 .txt', () => downloadText(output.value, 'xiaoyuTools-text.txt')),
          btn('结果放回输入', () => { input.value = output.value; }),
          btn('清空', () => { input.value = ''; output.value = ''; }),
        ),
        hint('规则按列表顺序依次执行，可随时调整勾选组合。'),
        panel('输出', output),
      );
    },
  },
  {
    id: 'markdown-preview',
    name: 'Markdown 预览',
    category: 'text',
    desc: '左侧书写、右侧即时渲染的轻量预览器',
    keywords: ['markdown', 'md', '预览', '渲染'],
    render(root) {
      const input = txt({ rows: 18, placeholder: '# 标题\n\n- 列表项\n\n**加粗** 与 `行内代码`' });
      const preview = el('div', { class: 'markdown-body' });

      const update = () => {
        preview.innerHTML = renderMarkdown(input.value) || '<p class="muted">左侧输入内容后这里会显示预览</p>';
      };
      input.addEventListener('input', update);
      input.value = [
        '# xiaoyuTools',
        '',
        '这是一个**完全本地**的预览器，支持标题、列表、引用、代码块与链接。',
        '',
        '## 支持',
        '',
        '- 标题与分割线',
        '- 无序 / 有序列表',
        '- 行内代码与代码块',
        '',
        '> 输入内容不会上传到任何服务器。',
        '',
        '```js',
        'const greet = () => "hello";',
        '```',
      ].join('\n');
      update();

      root.append(
        panel('编辑 / 预览', el('div', { class: 'split' }, input, preview)),
        actions(
          btn('复制 Markdown', () => copyText(input.value)),
          btn('下载 .md', () => downloadText(input.value, 'xiaoyuTools.md', 'text/markdown;charset=utf-8')),
          btn('清空', () => { input.value = ''; update(); }),
        ),
        hint('轻量实现，覆盖常用语法；渲染前会转义 HTML 并限制链接协议，避免注入。'),
      );
    },
  },
];
