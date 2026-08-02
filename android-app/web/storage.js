/* ============================================================
   有数 · 存储适配层（platform）
   - 优先使用 Capacitor Preferences（真机原生存储）
   - 在桌面浏览器/预览环境下自动回退到 localStorage
   - 导出/导入同理：真机走 Filesystem + Share，浏览器走下载/文件选择
   这套适配让同一份 web/ 既能直接在浏览器跑（便于开发调试），
   又能在打包后的安卓 App 里用原生能力存储与分享。
   ============================================================ */
const STORE_KEY = 'youshu:items';
const CATS_KEY = 'youshu:cats';

function capPlugins() {
  return (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins : null;
}

async function loadItems() {
  try {
    const P = capPlugins();
    if (P && P.Preferences) {
      const { value } = await P.Preferences.get({ key: STORE_KEY });
      if (value) return JSON.parse(value);
    } else if (window.localStorage) {
      const v = window.localStorage.getItem(STORE_KEY);
      if (v) return JSON.parse(v);
    }
  } catch (e) { console.warn('loadItems 失败', e); }
  return null;
}

async function saveItems(items) {
  const value = JSON.stringify(items);
  try {
    const P = capPlugins();
    if (P && P.Preferences) {
      await P.Preferences.set({ key: STORE_KEY, value });
    } else if (window.localStorage) {
      window.localStorage.setItem(STORE_KEY, value);
    }
  } catch (e) { console.warn('saveItems 失败', e); }
}

/* ---------- 分类配置持久化 ---------- */
async function loadCats() {
  try {
    const P = capPlugins();
    if (P && P.Preferences) {
      const { value } = await P.Preferences.get({ key: CATS_KEY });
      if (value) return JSON.parse(value);
    } else if (window.localStorage) {
      const v = window.localStorage.getItem(CATS_KEY);
      if (v) return JSON.parse(v);
    }
  } catch (e) { console.warn('loadCats 失败', e); }
  return null;
}

async function saveCats(groups, cats) {
  const value = JSON.stringify({ groups, cats });
  try {
    const P = capPlugins();
    if (P && P.Preferences) {
      await P.Preferences.set({ key: CATS_KEY, value });
    } else if (window.localStorage) {
      window.localStorage.setItem(CATS_KEY, value);
    }
  } catch (e) { console.warn('saveCats 失败', e); }
}

// 导出：真机用 Filesystem 写文件 + Share 拉起系统分享；浏览器用下载
// 文件名用日期命名，便于一眼看到哪些是最新的
function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
async function exportItems() {
  const payload = JSON.stringify({ items: ITEMS, groups: GROUPS, cats: CATS_CFG }, null, 2);
  const fname = `youshu-${todayStamp()}.json`;
  const P = capPlugins();
  if (P && P.Filesystem) {
    // 真机：先写文件（这一步成功即数据已安全落盘）
    try {
      await P.Filesystem.writeFile({ path: fname, data: payload, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
      const msg = `已导出 ${ITEMS.length} 条物品 + 分类配置（含归档）。\n文件：${fname}\n保存于 Documents 目录。`;
      // 再尝试拉起系统分享（可选，失败/取消不影响导出结果）
      if (P.Share) {
        try {
          const { uri } = await P.Filesystem.getUri({ path: fname, directory: 'DOCUMENTS' });
          await P.Share.share({ title: '有数 数据备份', text: '导出数据', files: [uri] });
        } catch (e) { console.warn('分享失败（不影响导出）', e); }
      }
      alert(msg);
    } catch (e) {
      console.warn('导出失败', e);
      alert('导出失败：' + (e && e.message ? e.message : e));
    }
  } else {
    const blob = new Blob([payload], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    alert(`已导出 ${ITEMS.length} 条物品 + 分类配置（含归档）。\n文件：${fname}`);
  }
}

// 导入入口由 app.js 的 importItems() 接管：真机列出 Documents 目录下 youshu-*.json
// 此处仅保留系统文件选择器兜底（被 app.js 的 importItemsPickFile 调用）
function importItemsLegacy() {
  const el = document.getElementById('fileInput');
  if (el) el.click();
}

// 列出 Documents 目录下的导出文件（按文件名倒序，最新在前）
// 返回 null 表示非真机环境（交由系统选择器兜底）
async function listImportFiles() {
  const P = capPlugins();
  if (!P || !P.Filesystem) return null;
  try {
    const { files } = await P.Filesystem.readdir({ path: '', directory: 'DOCUMENTS' });
    return files
      .filter(f => /^youshu-.*\.json$/i.test(f.name))
      .map(f => f.name)
      .sort()
      .reverse();
  } catch (e) { console.warn('listImportFiles 失败', e); return null; }
}

// 按文件名从 Documents 目录读取导入内容
async function readImportPath(fname) {
  const P = capPlugins();
  if (!P || !P.Filesystem) throw new Error('不支持读取文件');
  const { data } = await P.Filesystem.readFile({ path: fname, directory: 'DOCUMENTS', encoding: 'utf8' });
  // 指定 utf8 后 data 为字符串；兼容万一返回 base64 的兜底
  let text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  if (text && text.charAt(0) !== '[' && text.charAt(0) !== '{') {
    try { text = atob(text); } catch (e) { /* 非 base64，保持原样 */ }
  }
  const parsed = JSON.parse(text);
  return normalizeImport(parsed);
}

async function readImportFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  return normalizeImport(parsed);
}

// 统一导入格式：旧版为 [items] 数组，新版为 {items, groups, cats}
function normalizeImport(parsed) {
  if (Array.isArray(parsed)) {
    return { items: parsed, groups: null, cats: null };   // 旧版只有 items
  }
  if (parsed && Array.isArray(parsed.items)) {
    return { items: parsed.items, groups: parsed.groups || null, cats: parsed.cats || null };
  }
  throw new Error('文件格式不正确');
}
