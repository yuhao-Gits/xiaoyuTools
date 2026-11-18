const PREFIX = 'xiaoyuTools:';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 隐私模式下不可写时静默降级，不影响工具本身使用
  }
}

/* 供各工具持久化自己的小数据（日程、闪卡、物品位置等），统一加前缀。 */
export function loadState(key, fallback) {
  return read('data:' + key, fallback);
}

export function saveState(key, value) {
  write('data:' + key, value);
}

/* 丙版「夜读档案」为默认深色，故换新键，避免旧版写入的浅色偏好覆盖；
   收藏与最近使用仍沿用原键，不受影响。 */
const THEME_KEY = 'theme.v4';

export function getTheme() {
  const value = read(THEME_KEY, 'dark');
  return value === 'light' ? 'light' : 'dark';
}

export function setTheme(value) {
  write(THEME_KEY, value === 'light' ? 'light' : 'dark');
}

/* 目录密度：舒适 / 紧凑。只影响卡片排布，不触碰任何工具模块。 */
const DENSITY_KEY = 'density.v1';

export function getDensity() {
  return read(DENSITY_KEY, 'comfortable') === 'compact' ? 'compact' : 'comfortable';
}

export function setDensity(value) {
  write(DENSITY_KEY, value === 'compact' ? 'compact' : 'comfortable');
}

export function getFavorites() {
  const list = read('favorites', []);
  return Array.isArray(list) ? list : [];
}

export function isFavorite(id) {
  return getFavorites().includes(id);
}

export function toggleFavorite(id) {
  const list = getFavorites();
  const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  write('favorites', next);
  return next.includes(id);
}

export function getRecents() {
  const list = read('recents', []);
  return Array.isArray(list) ? list : [];
}

export function markRecent(id) {
  write('recents', [id, ...getRecents().filter(x => x !== id)].slice(0, 8));
}
