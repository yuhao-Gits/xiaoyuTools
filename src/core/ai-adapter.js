/* 可选 AI 适配器 —— 默认关闭，平时不发任何网络请求。
   本项目的工具一律使用本地等价实现；这里只留一个接口位，方便二次开发时
   接入本机 Ollama、兼容 OpenAI 协议的本地服务，或用户自己的接口。
   启用需要在 localStorage 里显式打开并填写 endpoint。 */

const KEY = 'xiaoyuTools:ai-adapter';

const DEFAULTS = {
  enabled: false,
  endpoint: 'http://localhost:11434/v1/chat/completions',
  model: '',
  apiKey: '',
};

export function getAiConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    return { ...DEFAULTS, ...saved, enabled: saved.enabled === true };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setAiConfig(patch) {
  const next = { ...getAiConfig(), ...patch, enabled: patch.enabled === true };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时静默降级
  }
  return next;
}

export function isAiEnabled() {
  return getAiConfig().enabled;
}

/* 只有显式启用后才可能 fetch；默认路径在第一行就抛错返回。 */
export async function aiComplete(messages, { signal, temperature = 0.7 } = {}) {
  const config = getAiConfig();
  if (!config.enabled) {
    throw new Error('AI 适配器默认关闭，本项目工具均使用本地实现；如需接入请在设置里显式启用。');
  }
  if (!config.endpoint || !config.model) {
    throw new Error('请先填写 endpoint 与 model。');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({ model: config.model, messages, temperature }),
  });
  if (!response.ok) throw new Error(`请求失败：HTTP ${response.status}`);

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content ?? data?.response ?? '';
  if (!text) throw new Error('响应里没有可用文本');
  return text;
}
