import {
  el, txt, sel, btn, panel, actions, resultBox, copyText, downloadText,
  hint, filePicker, formatBytes, toast,
} from '../core/ui.js';

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value.replace(/\s/g, ''));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function encodeUtf8(text) {
  return bytesToBase64(new TextEncoder().encode(text));
}

function decodeUtf8(value) {
  return new TextDecoder().decode(base64ToBytes(value));
}

function base64UrlToJson(segment) {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - segment.length % 4) % 4);
  return JSON.parse(new TextDecoder().decode(base64ToBytes(padded)));
}

async function digestHex(algorithm, data) {
  const buffer = await crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

function timestampLine(label, value) {
  if (typeof value !== 'number') return null;
  const date = new Date(value * 1000);
  return `${label}: ${value} → ${Number.isNaN(date.getTime()) ? '无效时间' : date.toLocaleString('zh-CN')}`;
}

export const devTools = [
  {
    id: 'json-format',
    name: 'JSON 格式化 / 校验',
    category: 'dev',
    desc: '美化、压缩并检查 JSON 是否合法',
    keywords: ['json', '格式化', '压缩', '校验', 'format'],
    render(root) {
      const input = txt({ rows: 11, placeholder: '在这里粘贴 JSON…' });
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const run = indent => {
        const raw = input.value.trim();
        if (!raw) {
          status.textContent = '请先输入内容';
          status.className = 'status';
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          output.set(JSON.stringify(parsed, null, indent));
          status.textContent = '校验通过 · JSON 合法';
          status.className = 'status ok';
        } catch (error) {
          output.clear();
          status.textContent = `解析失败：${error.message}`;
          status.className = 'status bad';
        }
      };

      root.append(
        panel('输入 JSON', input),
        actions(
          btn('格式化（2 空格）', () => run(2), 'primary'),
          btn('格式化（4 空格）', () => run(4)),
          btn('压缩为一行', () => run(0)),
          btn('复制结果', () => copyText(output.node.textContent)),
          btn('下载 .json', () => downloadText(output.node.textContent, 'xiaoyuTools.json', 'application/json')),
          btn('清空', () => { input.value = ''; output.clear(); status.textContent = ''; }),
        ),
        status,
        hint('解析完全在本地完成，内容不会离开浏览器。'),
        panel('输出', output.node),
      );
    },
  },
  {
    id: 'base64',
    name: 'Base64 编解码',
    category: 'dev',
    desc: '文本与文件的 Base64 转换，正确处理中文',
    keywords: ['base64', '编码', '解码', '文件'],
    render(root) {
      const input = txt({ rows: 8, placeholder: '输入要编码的文本，或粘贴要解码的 Base64…' });
      const output = resultBox();
      const picker = filePicker({ accept: '*/*' });
      const status = el('div', { class: 'status' });
      let fileResult = '';

      picker.addEventListener('change', async () => {
        const file = picker.files[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        fileResult = bytesToBase64(new Uint8Array(buffer));
        output.set(fileResult);
        status.textContent = `已读取 ${file.name}（${formatBytes(file.size)}）`;
        status.className = 'status ok';
      });

      root.append(
        panel('输入', input),
        actions(
          btn('编码文本', () => {
            try {
              output.set(encodeUtf8(input.value));
              status.textContent = '已按 UTF-8 编码';
              status.className = 'status ok';
            } catch (error) {
              status.textContent = `编码失败：${error.message}`;
              status.className = 'status bad';
            }
          }, 'primary'),
          btn('解码为文本', () => {
            try {
              const value = decodeUtf8(fileResult && !input.value.trim() ? fileResult : input.value);
              output.set(value);
              status.textContent = '已按 UTF-8 解码';
              status.className = 'status ok';
            } catch (error) {
              status.textContent = `解码失败：不是合法的 Base64（${error.message}）`;
              status.className = 'status bad';
            }
          }),
          btn('复制结果', () => copyText(output.node.textContent)),
          btn('清空', () => { input.value = ''; fileResult = ''; picker.value = ''; output.clear(); status.textContent = ''; }),
        ),
        status,
        panel('文件转 Base64（可选）', picker, hint('选择本地文件后直接给出其 Base64 文本，不做上传。')),
        panel('输出', output.node),
      );
    },
  },
  {
    id: 'url-codec',
    name: 'URL 编解码',
    category: 'dev',
    desc: '对参数或整段 URL 做百分号编码 / 解码',
    keywords: ['url', 'uri', 'encode', 'decode', '百分号'],
    render(root) {
      const input = txt({ rows: 7, placeholder: '输入文本或 URL…' });
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const wrap = fn => () => {
        try {
          output.set(fn(input.value));
          status.textContent = '转换完成';
          status.className = 'status ok';
        } catch (error) {
          status.textContent = `转换失败：${error.message}`;
          status.className = 'status bad';
        }
      };

      root.append(
        panel('输入', input),
        actions(
          btn('编码参数', wrap(value => encodeURIComponent(value)), 'primary'),
          btn('解码参数', wrap(value => decodeURIComponent(value))),
          btn('编码整段 URL', wrap(value => encodeURI(value))),
          btn('解码整段 URL', wrap(value => decodeURI(value))),
          btn('复制结果', () => copyText(output.node.textContent)),
          btn('清空', () => { input.value = ''; output.clear(); status.textContent = ''; }),
        ),
        status,
        hint('「编码参数」用于 query 值；「编码整段 URL」会保留 : / ? & = 等结构字符。'),
        panel('输出', output.node),
      );
    },
  },
  {
    id: 'uuid',
    name: 'UUID 生成器',
    category: 'dev',
    desc: '用系统加密随机源批量生成 UUID v4',
    keywords: ['uuid', 'guid', '随机', 'id'],
    render(root) {
      const quantity = sel([
        { value: '1', label: '1 个' }, { value: '5', label: '5 个' },
        { value: '10', label: '10 个' }, { value: '20', label: '20 个' },
        { value: '50', label: '50 个' },
      ], '5');
      const output = resultBox();

      const generate = () => {
        const count = Number(quantity.value);
        output.set(Array.from({ length: count }, () => crypto.randomUUID()).join('\n'));
      };

      root.append(
        panel('生成设置', el('div', { class: 'inline-fields' },
          el('label', { class: 'field' }, el('span', { class: 'field-label', text: '数量' }), quantity),
          btn('重新生成', generate, 'primary'))),
        actions(
          btn('复制全部', () => copyText(output.node.textContent)),
          btn('下载 .txt', () => downloadText(output.node.textContent, 'xiaoyuTools-uuid.txt')),
        ),
        hint('基于 crypto.randomUUID()，使用操作系统提供的加密级随机数。'),
        panel('结果', output.node),
      );
      generate();
    },
  },
  {
    id: 'hash',
    name: '文本 / 文件哈希',
    category: 'dev',
    desc: '一次算出 SHA-1、256、384、512 摘要',
    keywords: ['hash', 'sha256', 'md5', '摘要', '校验'],
    render(root) {
      const input = txt({ rows: 7, placeholder: '输入要计算摘要的文本…' });
      const picker = filePicker({ accept: '*/*' });
      const output = resultBox();
      const status = el('div', { class: 'status' });
      let selectedFile = null;

      picker.addEventListener('change', () => {
        selectedFile = picker.files[0] || null;
        status.textContent = selectedFile
          ? `已选择 ${selectedFile.name}（${formatBytes(selectedFile.size)}），将计算文件摘要`
          : '';
      });

      const run = async () => {
        const source = selectedFile
          ? await selectedFile.arrayBuffer()
          : new TextEncoder().encode(input.value);
        if (!source.byteLength) {
          status.textContent = '请输入文本或选择文件';
          status.className = 'status';
          return;
        }
        const names = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
        const values = await Promise.all(names.map(name => digestHex(name, source)));
        output.set(names.map((name, i) => `${name.padEnd(8)} ${values[i]}`).join('\n'));
        status.textContent = `计算完成 · ${formatBytes(source.byteLength)}`;
        status.className = 'status ok';
      };

      root.append(
        panel('文本输入', input),
        panel('或选择文件', picker, hint('选择文件后优先计算文件摘要。')),
        actions(
          btn('计算摘要', () => run().catch(error => toast(error.message, 'warn')), 'primary'),
          btn('复制结果', () => copyText(output.node.textContent)),
          btn('清空', () => { input.value = ''; picker.value = ''; selectedFile = null; output.clear(); status.textContent = ''; }),
        ),
        status,
        hint('使用 Web Crypto API。仅支持 SHA 系列，不提供已不安全的 MD5。'),
        panel('输出', output.node),
      );
    },
  },
  {
    id: 'jwt-view',
    name: 'JWT 解析',
    category: 'dev',
    desc: '本地拆开 header / payload，查看过期时间',
    keywords: ['jwt', 'token', 'bearer', '解析'],
    render(root) {
      const input = txt({ rows: 6, placeholder: '粘贴 xxxxx.yyyyy.zzzzz 形式的 token…' });
      const output = resultBox();
      const status = el('div', { class: 'status' });

      const run = () => {
        const parts = input.value.trim().split('.');
        if (parts.length !== 3) {
          status.textContent = '格式不对：JWT 应由三段用点号分隔';
          status.className = 'status bad';
          return;
        }
        try {
          const header = base64UrlToJson(parts[0]);
          const payload = base64UrlToJson(parts[1]);
          const notes = [
            timestampLine('exp 过期时间', payload.exp),
            timestampLine('iat 签发时间', payload.iat),
            timestampLine('nbf 生效时间', payload.nbf),
          ].filter(Boolean);
          output.set([
            '— header —', JSON.stringify(header, null, 2),
            '', '— payload —', JSON.stringify(payload, null, 2),
            '', '— 时间字段 —', ...(notes.length ? notes : ['（无标准时间字段）']),
            '', '— signature —', parts[2],
          ].join('\n'));
          status.textContent = '解析成功 · 注意：这里不验证签名';
          status.className = 'status ok';
        } catch (error) {
          status.textContent = `解析失败：${error.message}`;
          status.className = 'status bad';
        }
      };

      root.append(
        panel('输入 token', input),
        actions(
          btn('解析', run, 'primary'),
          btn('复制结果', () => copyText(output.node.textContent)),
          btn('清空', () => { input.value = ''; output.clear(); status.textContent = ''; }),
        ),
        status,
        hint('仅做本地解码展示，不校验签名真伪，也不发送 token 到任何地方。'),
        panel('输出', output.node),
      );
    },
  },
];
