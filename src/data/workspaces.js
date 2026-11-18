/* 站点分区数据：公开版只有三个一级入口——首页 / 工具箱 / 博客。
   工具集群（门类）由 core/registry.js 的 categories 定义，这里不重复登记。
   工具本身仍由 src/tools 注册，这里只做编排，不重复实现。 */

export const SECTIONS = [
  {
    id: 'home',
    name: '首页',
    icon: 'home',
    path: '#/',
    desc: '站点总览：热门工具、集群入口与隐私承诺。',
  },
  {
    id: 'toolbox',
    name: '工具箱',
    icon: 'toolbox',
    path: '#/toolbox',
    desc: '全量工具库，按集群检索：文档、图片、文本、开发者、计算、音视频与创意。',
  },
  {
    id: 'blog',
    name: '博客',
    icon: 'pen',
    path: '#/blog',
    desc: '指南与笔记：本地处理的原理、验证方法与能力边界。',
  },
];

/* 信任页：公开上线必需的说明页面，挂在页脚与侧栏底部 */
export const TRUST_PAGES = [
  { id: 'verify', name: '亲自验证', icon: 'shield', path: '#/verify' },
  { id: 'about', name: '关于我们', icon: 'book', path: '#/about' },
  { id: 'privacy', name: '隐私政策', icon: 'shield', path: '#/privacy' },
  { id: 'terms', name: '服务条款', icon: 'rows', path: '#/terms' },
];