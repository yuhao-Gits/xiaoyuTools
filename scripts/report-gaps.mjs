import { catalog, catalogStats, TIER_LABELS, STATUS_LABELS } from '../src/core/registry.js';

console.log('统计:', JSON.stringify({ total: catalogStats.total, done: catalogStats.done, planned: catalogStats.planned, substitute: catalogStats.substitute, excluded: catalogStats.excluded, downgrade: catalogStats.downgrade }));
console.log('\n未实现条目:');
for (const item of catalog.filter(i => i.status !== 'done')) {
  console.log([item.status, item.id, item.name, '| tier=' + item.tier, '| ref=' + item.refCategory, '| alias=' + (item.alias || '-'), '| note=' + (item.substitute || item.note || '')].join(' '));
}
console.log('\n降级实现条目:');
for (const item of catalog.filter(i => i.downgrade)) {
  console.log([item.id, item.name, '| impl=' + item.implId, '| note=' + (item.substitute || item.note || '')].join(' '));
}
