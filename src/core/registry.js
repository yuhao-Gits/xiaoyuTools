/* 注册表：把「已实现的工具模块」与「96 项参考功能目录」合并成界面数据。
   加新工具只需在 src/tools/index.js 里 import 一个模块，其余自动生效。 */
import { REFERENCE_CATALOG } from '../catalog.js';
import { IMPLEMENTATIONS } from '../tools/index.js';

export const categories = [
  { id: 'pdf', name: '文档 PDF', badge: '档', desc: 'PDF 转换、合并、压缩与文本提取' },
  { id: 'image', name: '图片', badge: '图', desc: '压缩、转格式、裁剪与拼接，全部本地处理' },
  { id: 'text', name: '文本', badge: '文', desc: '统计、清洗、对比、预览与提取' },
  { id: 'dev', name: '开发者', badge: '开', desc: '编解码、格式化与校验' },
  { id: 'calc', name: '计算换算', badge: '算', desc: '单位、财务与数值速算' },
  { id: 'audio', name: '音频', badge: '音', desc: 'Web Audio 合成、播放与转换' },
  { id: 'video', name: '视频', badge: '影', desc: '截帧、字幕与转码' },
  { id: 'time', name: '时间专注', badge: '时', desc: '计时、时钟与专注节奏' },
  { id: 'creative', name: '创意娱乐', badge: '创', desc: '画板、生成、随机决策与小游戏' },
];

const badgeOf = id => (categories.find(c => c.id === id) || {}).badge || '具';

export const tools = [...IMPLEMENTATIONS.values()]
  .map((t, index) => ({ ...t, index, badge: badgeOf(t.category) }));

export const toolsById = new Map(tools.map(t => [t.id, t]));

export function toolsInCategory(categoryId) {
  return tools.filter(t => t.category === categoryId);
}

export function searchTools(query) {
  const q = query.trim().toLowerCase();
  if (!q) return tools;
  return tools.filter(t => {
    const haystack = [t.name, t.desc, t.category, ...(t.keywords || [])].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

/* ---- 参考目录：96 项功能的实现状态，供文档生成与自检脚本使用（界面不再展示） ---- */

export const TIER_LABELS = {
  native: '原生可实现',
  library: '需第三方库',
  online: '需联网 / Key',
  excluded: '授权排除',
};

export const STATUS_LABELS = {
  done: '已实现',
  planned: '待开发',
  substitute: '本地替代待开发',
  excluded: '不实现',
};

export const catalog = REFERENCE_CATALOG.map(item => {
  let implId = null;
  if (IMPLEMENTATIONS.has(item.id)) implId = item.id;
  else if (item.alias && IMPLEMENTATIONS.has(item.alias)) implId = item.alias;

  let status = 'planned';
  if (item.tier === 'excluded') status = 'excluded';
  else if (implId) status = 'done';
  else if (item.tier === 'online') status = 'substitute';

  return { ...item, implId, status };
});

export const catalogStats = {
  total: catalog.length,
  done: catalog.filter(c => c.status === 'done').length,
  planned: catalog.filter(c => c.status === 'planned').length,
  substitute: catalog.filter(c => c.status === 'substitute').length,
  excluded: catalog.filter(c => c.status === 'excluded').length,
  downgrade: catalog.filter(c => c.downgrade).length,
  independent: catalog.filter(c => c.independent).length,
  byTier: Object.fromEntries(Object.keys(TIER_LABELS).map(tier => [
    tier, catalog.filter(c => c.tier === tier).length,
  ])),
};
