/* 新工具脚手架：生成一个独立工具模块，并自动登记到 index.js。
   用法：node scripts/new-tool.mjs <id> <category> "名称" "一句话说明"

   例：node scripts/new-tool.mjs csv-to-json dev "CSV 转 JSON" "把 CSV 表格转成 JSON 数组"
*/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATEGORIES = ['dev', 'text', 'calc', 'image', 'time', 'creative', 'audio', 'video', 'pdf'];

const [id, category, name, desc] = process.argv.slice(2);
if (!id || !category || !name || !desc) {
  console.error('用法: node scripts/new-tool.mjs <id> <category> "名称" "说明"');
  console.error('可用分类:', CATEGORIES.join(', '));
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error('id 只能用小写字母、数字与连字符，例如 csv-to-json');
  process.exit(1);
}
if (!CATEGORIES.includes(category)) {
  console.error('未知分类:', category, '；可用:', CATEGORIES.join(', '));
  process.exit(1);
}

const moduleDir = join(root, 'src', 'tools', 'modules');
const target = join(moduleDir, `${id}.js`);
if (existsSync(target)) {
  console.error('文件已存在，未覆盖:', target);
  process.exit(1);
}
mkdirSync(moduleDir, { recursive: true });

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const exportName = `${camel}Tools`;
const quote = value => JSON.stringify(value);

const template = `/* ${name} —— 由 scripts/new-tool.mjs 生成，可自由改写。
   公共助手见 src/core/ui.js；需要本地库时检查 vendor/ 里的全局对象。 */
import { panel, inp, btn, actions, resultBox, hint } from '../../core/ui.js';

export const ${exportName} = [
  {
    id: ${quote(id)},
    name: ${quote(name)},
    category: ${quote(category)},
    desc: ${quote(desc)},
    keywords: ['${id}'],
    render(root) {
      const input = inp({ type: 'text', placeholder: '在这里输入…' });
      const output = resultBox();

      root.append(panel(${quote(name)},
        input,
        actions(btn('运行', () => {
          output.set(input.value.trim() || '（请输入内容）');
        }, 'primary')),
        output.node,
        hint('在这里补充你的实现。所有计算都在本机浏览器内完成。')));
    },
  },
];
`;
writeFileSync(target, template, 'utf8');

const indexPath = join(root, 'src', 'tools', 'index.js');
let index = readFileSync(indexPath, 'utf8');
const importLine = `import { ${exportName} } from './modules/${id}.js';`;
if (!index.includes(importLine)) {
  index = index.replace('// __NEW_TOOL_IMPORT__', `${importLine}\n// __NEW_TOOL_IMPORT__`);
  index = index.replace('// __NEW_TOOL_GROUP__', `${exportName},\n  // __NEW_TOOL_GROUP__`);
  writeFileSync(indexPath, index, 'utf8');
}

console.log('已创建:', target);
console.log('已登记到: src/tools/index.js');
console.log('接下来：编辑 render()，刷新 http://localhost:5173 即可看到新卡片。');
console.log('提示：若 id 与 src/catalog.js 里的参考条目一致，功能蓝图会自动标记为「已实现」。');
