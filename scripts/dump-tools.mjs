globalThis.window = globalThis;
globalThis.document = {
  createElement: () => ({ style: {}, append() {}, setAttribute() {}, addEventListener() {}, classList: { add() {}, toggle() {} }, querySelector: () => null, appendChild() {} }),
  addEventListener() {}, body: { append() {} },
};
globalThis.location = { hash: '' };
const { IMPLEMENTATIONS } = await import('file:///D:/AiDemo/xiaoyuTools/src/tools/index.js');
console.log('TOTAL', IMPLEMENTATIONS.size);
for (const t of IMPLEMENTATIONS.values()) console.log([t.id, t.category, t.name, t.desc].join(' ~ '));
