# 第三方库清单（本地化）

本项目运行时**只读取本目录内的文件**，不加载任何 CDN、不发起外部请求。以下库由 `npm pack` 下载后原样取出浏览器构建与许可文本，**未做任何修改**。

| 库 | 版本 | 许可 | 用途 | 本地文件 | 上游 |
| --- | --- | --- | --- | --- | --- |
| qrcode-generator | 1.4.4 | MIT | 二维码生成（含 UTF-8 中文补丁） | `qrcode-generator/qrcode.js`、`qrcode_UTF8.js` | <https://www.npmjs.com/package/qrcode-generator> |
| pdf-lib | 1.17.1 | MIT | 创建 / 合并 PDF、图片转 PDF | `pdf-lib/pdf-lib.min.js` | <https://www.npmjs.com/package/pdf-lib> |
| pdfjs-dist | 3.11.174 | Apache-2.0 | PDF 页面渲染与文本层提取 | `pdfjs/pdf.min.js`、`pdf.worker.min.js` | <https://www.npmjs.com/package/pdfjs-dist> |
| jszip | 3.10.1 | MIT（双许可，取 MIT） | 读取 docx/xlsx/pptx、打包多图 | `jszip/jszip.min.js` | <https://www.npmjs.com/package/jszip> |
| heic2any | 0.0.4 | MIT | HEIC / HEIF 解码（自带内联 worker） | `heic2any/heic2any.min.js` | <https://www.npmjs.com/package/heic2any> |

## 许可文本

- `pdf-lib/LICENSE.md`：上游原样附带的 MIT License 全文，版权归 Andrew Dillon (c) 2019。
- `qrcode-generator/LICENSE.md`：依据上游源码文件头的版权与 MIT 许可声明整理，版权归 Kazuhiko Arase (c) 2009 / 2011。上游 npm 包未单独附 LICENSE 文件，其 `package.json` 的 `license` 字段为 `MIT`，源码头部亦明确标注 MIT。
- `qrcode-generator/README.upstream.md`：上游 README 原样保留，便于核对。
- `pdfjs/LICENSE`：上游 Apache License 2.0 全文，版权归 Mozilla Foundation。
- `jszip/LICENSE.markdown`：上游双许可说明（MIT 与 GPLv3 二选一），本项目**选择 MIT**。
- `heic2any/LICENSE.md`：上游 MIT License 全文，版权归 Alex Corvi (c) 2020。

## 引入方式

`index.html` 用普通 `<script defer>` 依次加载 UMD 构建，暴露 `window.qrcode`、`window.PDFLib`、`window.pdfjsLib`、`window.JSZip`、`window.heic2any`。工具模块只在使用到时检查对应全局是否存在，缺失时给出提示，不影响其他工具。`pdf.js` 的 worker 也指向本目录内的 `pdf.worker.min.js`，同源加载，不联网。

## 选择原则

只纳入 **MIT / Apache-2.0 / BSD** 这类宽松许可、且带独立浏览器构建的库。GPL / LGPL、需要编译或带模型权重、需要联网 SDK 的库一律不纳入，避免引入额外许可义务与运行时依赖。

据此，MP3 编码器（常见实现为 LGPL）**未纳入**：WAV 压缩改用浏览器原生 `MediaRecorder` 输出 WebM/Opus，界面中明确标注为降级而非 MP3。GIF 编码器、WAV 编码器由本项目自行实现，见 `src/tools/modules/shared.js`。若以后新增库，请同时更新本表并把许可全文放进对应目录。
