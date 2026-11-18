/* 根据真实注册状态重新生成 docs/CATALOG.md。
   用法：node scripts/gen-catalog.mjs
   加完新工具后跑一次，功能蓝图与文档会自动同步。 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  catalog, catalogStats, tools, categories, TIER_LABELS, STATUS_LABELS,
} from '../src/core/registry.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = [
  '# 功能蓝图 · 96 项对照表',
  '',
  '> 本文件由 `node scripts/gen-catalog.mjs` 自动生成，状态来自 `src/core/registry.js` 的真实注册结果，请勿手改。',
  '',
  '参考目录只登记**功能名称与分类**这类事实，不包含对方的描述文案、题目、数据或素材；每个工具的实现均为本项目独立编写。',
  '',
  '## 进度',
  '',
  '| 指标 | 数量 |',
  '| --- | --- |',
  `| 参考功能点 | ${catalogStats.total} |`,
  `| 已实现 | ${catalogStats.done} |`,
  `| 待开发（原生可实现） | ${catalogStats.planned} |`,
  `| 本地替代待开发 | ${catalogStats.substitute} |`,
  `| 授权排除 | ${catalogStats.excluded} |`,
  `| 独立实现（替代原授权排除项） | ${catalogStats.independent} |`,
  `| 降级实现（可运行但能力有差异） | ${catalog.filter(item => item.downgrade).length} |`,
  `| xiaoyuTools 实际工具总数 | ${tools.length} |`,
  '',
  '实际工具数会大于「参考目录已实现数」，因为还包含一批本项目自写、不在参考目录里的工具。',
  '',
];

const activeTiers = ['native', 'library', 'online', 'excluded']
  .filter(tier => catalog.some(item => item.tier === tier));
for (const tier of activeTiers) {
  const list = catalog.filter(item => item.tier === tier);
  lines.push(`## ${TIER_LABELS[tier]}（${list.length} 项）`, '', '| 功能点 | 参考分类 | 状态 | 说明 / 本地替代 | 实现 id |', '| --- | --- | --- | --- | --- |');
  for (const item of list) {
    const note = (item.substitute || item.note || '').replace(/\|/g, '\\|');
    const marked = item.downgrade ? `⚠ 降级 · ${note}` : note;
    lines.push(`| ${item.name} | ${item.refCategory} | ${STATUS_LABELS[item.status]} | ${marked} | ${item.implId || '—'} |`);
  }
  lines.push('');
}

const refIds = new Set(catalog.map(item => item.id));
const own = tools.filter(tool => !refIds.has(tool.id) && !catalog.some(item => item.alias === tool.id));
lines.push(
  '## 本项目自写、不在参考目录内的工具', '',
  `共 ${own.length} 项：`, '',
  ...own.map(tool => `- ${tool.name}（\`${tool.id}\` · ${categories.find(c => c.id === tool.category)?.name || tool.category}）`),
  '',
  '## 边界', '',
  '- 参考项目的 PDF 转 Word 引擎适用独立书面授权，本项目**不复刻该引擎**；此功能改用完全独立的实现：pdf.js 读文本层 → 自写规则重排 → 自写 OOXML → JSZip 打包。未阅读、未引用其任何源码或算法文档。',
  '- `online` 组原功能依赖联网 AI 服务 / API Key；本项目提供本地等价替代，接口适配器默认关闭、不发请求。',
  '- `library` 组需要第三方库或编解码器：二维码、PDF 生成 / 合并 / 渲染、HEIC 解码、Office 解压使用本地化的 MIT / Apache-2.0 库；GIF、WAV 编码器由本项目自写；MP3 编码器因 LGPL 许可不纳入。',
  '- 标有「⚠ 降级」的条目可以运行，但输出格式或能力与参考功能不同（例如导出 WebM 而非 MP4 / MP3、图片型 PDF 无可搜索文本层、色键抠图非 AI 分割），详见对应说明。',
  '- 任何条目都不复制对方的源码、样式、图标、插画、文案、问卷题目或数据集。',
  '',
);

const out = join(root, 'docs', 'CATALOG.md');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`已生成 ${out}`);
console.log(`参考目录 ${catalogStats.total} 项，已实现 ${catalogStats.done} 项，实际工具 ${tools.length} 项`);
