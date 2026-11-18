/* ESM 包装：imgly 以 import * as ort from "onnxruntime-web" 使用，
   实际实现由按需加载的 UMD 版 ort.wasm.min.js 提供（window.ort）。 */
const ort = globalThis.ort;
if (!ort) throw new Error('onnxruntime UMD 尚未加载');
export const env = ort.env;
export const InferenceSession = ort.InferenceSession;
export const Tensor = ort.Tensor;
export default ort;
