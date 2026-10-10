/* ============================================================
   有数 · 应用逻辑层（安卓 Capacitor 版，由 v4 原型移植）
   - 复用 v4 的全部 UI 行为与量化模型
   - 存储：通过 storage.js 适配层（Capacitor Preferences / localStorage 回退）
   - 数据格式与小程序完全一致；id 用 uuid（为未来云同步预留）
   - 分类 v2：分组 + 分类（稳定 ID，支持自定义），物品存 catId
   ============================================================ */
// 核心逻辑来自 core.js（UMD，浏览器全局 YS_CORE）；量化/分类/上限/导入合并在此统一定义
const { MAX_ITEMS, BUILTIN_GROUPS, BUILTIN_CATS, CAT_NAME_TO_ID,
        migrateItems, mergeCats, fixItemCatIds,
        EMOJI, CATS, COMMON_CATS,
        uid, refDate, daysSince, held, daily, loss, remain,
        isoDate, fmt, fmtPrice, esc, lossColor, mergeImport } = YS_CORE;

const APP_VERSION = '1.1.0';

// ===== 分类配置（运行时状态，从 storage 加载或用内置默认） =====
let GROUPS = BUILTIN_GROUPS.map(g => Object.assign({}, g));
let CATS_CFG = BUILTIN_CATS.map(c => Object.assign({}, c));

// 分类查找辅助
function catById(id){ return CATS_CFG.find(c => c.id === id); }
function catName(id){ const c = catById(id); return c ? c.name : '其它'; }
function catEmoji(id){ const c = catById(id); return c ? (c.icon || c.emoji) : '📦'; }
function grpById(id){ return GROUPS.find(g => g.id === id); }
function grpName(id){ const g = grpById(id); return g ? g.name : '其它'; }
// 分组按 order 排序后的列表
function sortedGroups(){ return GROUPS.slice().sort((a,b) => (a.order||0)-(b.order||0)); }
// 某分组下的分类（按 order 排序）
function catsInGroup(gid){ return CATS_CFG.filter(c => c.groupId === gid).sort((a,b) => (a.order||0)-(b.order||0)); }
// 全部分类按「分组顺序 + 组内顺序」扁平化
function sortedCatsFlat(){
  const out = [];
  sortedGroups().forEach(g => { catsInGroup(g.id).forEach(c => out.push(c)); });
  return out;
}

// 首次运行的示例数据（仅在本地无数据时填充）
const DEFAULT_ITEMS = [
  {id:'seed-1', catId:'cat-shuma',    name:'iPhone 15 Pro',      brand:'Apple',                price:8799, date:'2023-09-15', life:3, archived:false},
  {id:'seed-2', catId:'cat-shuma',    name:'AirPods Pro 2',      brand:'Apple',                price:1899, date:'2024-11-01', life:3, archived:false},
  {id:'seed-3', catId:'cat-shuma',    name:'索尼 WH-1000XM5',    brand:'Sony',                 price:2499, date:'2023-03-15', life:4, archived:false},
  {id:'seed-4', catId:'cat-qiche',    name:'行车记录仪',          brand:'70迈',                 price:499,  date:'2023-08-10', life:4, archived:false},
  {id:'seed-5', catId:'cat-qiche',    name:'特斯拉 Model Y 脚垫',  brand:'Tesla',                price:899,  date:'2024-03-20', life:5, archived:false},
  {id:'seed-6', catId:'cat-huiyuan',  name:'爱奇艺黄金年卡',       brand:'爱奇艺',                price:248,  date:'2025-01-01', life:1, archived:false},
  {id:'seed-7', catId:'cat-huiyuan',  name:'山姆会员年费',         brand:"Sam's Club",           price:260,  date:'2024-10-01', life:1, archived:false},
  {id:'seed-8', catId:'cat-jiadian',  name:'戴森吹风机 HD08',      brand:'Dyson',                price:2990, date:'2024-01-20', life:5, archived:false},
  {id:'seed-9', catId:'cat-jiadian',  name:'小米台灯 Pro',        brand:'Xiaomi',               price:199,  date:'2024-08-10', life:5, archived:false},
  {id:'seed-10',catId:'cat-jiaju',    name:'宜家收纳箱',           brand:'IKEA',                 price:79,   date:'2024-07-01', life:5, archived:false},
  {id:'seed-11',catId:'cat-jiaju',    name:'无印良品香薰机',       brand:'MUJI',                 price:299,  date:'2023-11-15', life:4, archived:false},
  {id:'seed-12',catId:'cat-fushi',    name:'Uniqlo 羽绒服',       brand:'Uniqlo',               price:599,  date:'2023-12-01', life:3, archived:false},
  {id:'seed-13',catId:'cat-fushi',    name:'国家地理双肩包',       brand:'National Geographic',  price:899,  date:'2022-03-10', life:5, archived:false},
  {id:'seed-14',catId:'cat-meizhuang',name:'雅诗兰黛小棕瓶',       brand:'Estée Lauder',         price:780,  date:'2025-01-05', life:1, archived:false},
  {id:'seed-15',catId:'cat-yundong',  name:'Lululemon 瑜伽垫',     brand:'Lululemon',            price:480,  date:'2023-05-10', life:4, archived:false},
  {id:'seed-16',catId:'cat-zhubao',   name:'周大福黄金手链',       brand:'周大福',                price:3680, date:'2022-06-01', life:8, archived:false},
  {id:'seed-17',catId:'cat-shuma',    name:'旧 iPhone 11',         brand:'Apple',                price:5499, date:'2019-09-20', life:4, archived:true, archivedAt:'2024-12-01'},
  {id:'seed-18',catId:'cat-jiadian',  name:'戴森扫地机器人',       brand:'Dyson',                price:3990, date:'2020-04-01', life:5, archived:true, archivedAt:'2024-10-15'}
];

let ITEMS = [];
let curCat = 'all';      // 'all' 或 catId
let selCat = 'cat-shuma'; // 录入页当前选择
let isGrid = false;
let isCompact = false;
let detailFrom = 'scr-list';
let statDim = 'price';
let sortKey = 'created';
let sortDir = 'desc';
let editingId = null;
let pendingDel = null;
let pendingArchive = null;
let pendingRestore = null;
let pendingImport = null;
let lastSavedId = null;

/* ---------- 持久化 ---------- */
function persist(){ saveItems(ITEMS); }
function persistCats(){ saveCats(GROUPS, CATS_CFG); }

/* ---------- 未归档物品 ---------- */
function activeItems(){ return ITEMS.filter(i => !i.archived); }

/* ---------- 分类筛选（首页筛选抽屉 + 顶部已选） ---------- */
function buildSheet(){
  const allTile = `<div class="sheet-tile${curCat === 'all' ? ' on' : ''}" onclick="v4setCat('all')">
    <span class="ic">${IC_ALL}</span><span>全部</span></div>`;
  const grpHtml = sortedGroups().map(g => {
    const cats = catsInGroup(g.id);
    if(!cats.length) return '';
    return `<div class="sheet-grp-name">${esc(g.name)}</div>
      <div class="sheet-grid">${cats.map(c => {
        const inner = c.icon
          ? `<span class="e"><img src="${c.icon}"></span>`
          : `<span class="e">${c.emoji}</span>`;
        return `<div class="sheet-tile${c.id === curCat ? ' on' : ''}" onclick="v4setCat('${c.id}')">${inner}<span>${esc(c.name)}</span></div>`;
      }).join('')}</div>`;
  }).join('');
  document.getElementById('sheetGrid').innerHTML =
    `<div class="sheet-grid">${allTile}</div>${grpHtml}`;
}
function updateFilterBar(){
  document.getElementById('fbCur').textContent = curCat === 'all' ? '全部' : catName(curCat);
  document.getElementById('flChip').classList.toggle('on', curCat !== 'all');
  buildSheet();
}
function v4setCat(c){ curCat = c; updateFilterBar(); closeFilterSheet(); renderList(); }
function openFilterSheet(){ buildSheet(); document.getElementById('sheetMask').classList.add('show'); document.getElementById('sheet').classList.add('show'); }
function closeFilterSheet(){ document.getElementById('sheetMask').classList.remove('show'); document.getElementById('sheet').classList.remove('show'); }

/* ---------- 添加页分类选择（常用组平铺 + 更多分类抽屉） ---------- */
function renderCatChips(){
  // 常用组分类 3 列平铺
  const common = catsInGroup('grp-common');
  document.getElementById('e-cat-common').innerHTML = common.map(c => {
    const inner = c.icon ? `<img src="${c.icon}">` : c.emoji;
    return `<div class="cat-tile ${c.id === selCat ? 'on' : ''}" onclick="chooseCat('${c.id}')"><span class="e">${inner}</span><span>${esc(c.name)}</span></div>`;
  }).join('');
  // 其余组的分类进「更多分类」抽屉
  const otherGrps = sortedGroups().filter(g => g.id !== 'grp-common');
  const otherHtml = otherGrps.map(g => {
    const cats = catsInGroup(g.id);
    if(!cats.length) return '';
    return `<div class="sheet-grp-name">${esc(g.name)}</div>
      <div class="sheet-grid3">${cats.map(c => {
        const inner = c.icon ? `<img src="${c.icon}">` : c.emoji;
        return `<div class="sheet-tile3 ${c.id === selCat ? 'on' : ''}" onclick="pickCat('${c.id}')"><span class="e">${inner}</span><span>${esc(c.name)}</span></div>`;
      }).join('')}</div>`;
  }).join('');
  document.getElementById('catSheetGrid').innerHTML = otherHtml || '<div class="pick-empty">暂无其它分类</div>';
  updateCatMore();
}
function chooseCat(id){ selCat = id; renderCatChips(); entryDirty = true; }
function pickCat(id){ chooseCat(id); closeCatSheet(); }
function updateCatMore(){
  const c = catById(selCat);
  const inner = c ? (c.icon ? `<img src="${c.icon}">` : c.emoji) : '📦';
  const el = document.getElementById('e-cat-more');
  if(el) el.innerHTML = `<span class="cm-cur"><span class="cm-ic">${inner}</span>${esc(catName(selCat))}</span><span class="cm-go">更多分类 ⌄</span>`;
}
function openCatSheet(){ renderCatChips(); document.getElementById('catMask').classList.add('show'); document.getElementById('catSheet').classList.add('show'); }
function closeCatSheet(){ document.getElementById('catMask').classList.remove('show'); document.getElementById('catSheet').classList.remove('show'); }

/* ---------- 物品卡片 ---------- */
function itemCard(it, onclick){
  const h = held(it), d = daily(it), l = loss(it), c = lossColor(l);
  const ico = catEmoji(it.catId);
  const icoHtml = (ico && ico.startsWith('data:')) ? `<img src="${ico}">` : ico;
  // 副标题（身份区）：购入价（中灰半粗）· 品牌 · 分类；品牌为空时自动省略分隔符
  const sub = `<span class="sub-price">${fmtPrice(it.price)}</span>`
            + (it.brand ? ` · ${esc(it.brand)}` : '')
            + ` · ${esc(catName(it.catId))}`;
  if(isGrid){
    return `<div class="card item" data-id="${it.id}" onclick="${onclick}">
      <div class="item-main">
        <div class="gr-head">
          <span class="ava">${icoHtml}</span>
          <span class="item-name">${esc(it.name)}</span>
        </div>
        <div class="daily">${fmt(d)}</div>
        <div class="item-sub">${sub}</div>
        <div class="mini-prog"><i style="width:${l}%;background:${c}"></i></div>
        <div class="gr-foot">
          <span class="item-loss" style="color:${c}">损耗 ${l}%</span>
          <span class="held">持有${h}天</span>
        </div>
      </div>
    </div>`;
  }
  return `<div class="card item" data-id="${it.id}" onclick="${onclick}">
    <div class="ava">${icoHtml}</div>
    <div class="item-main">
      <div class="item-name">${esc(it.name)}</div>
      <div class="item-sub">${sub}</div>
      <div class="mini-prog"><i style="width:${l}%;background:${c}"></i></div>
      <div class="item-loss" style="color:${c}">损耗 ${l}%</div>
    </div>
    <div class="item-right">
      <div class="daily">${fmt(d)}</div>
      <div class="daily-sub">日均</div>
      <div class="held">持有${h}天</div>
    </div>
  </div>`;
}

/* ---------- 首页列表 ---------- */
const SORT_LABELS = { created:'创建时间', cat:'分类', price:'价格', loss:'损耗率' };
const SORT_SHORT  = { created:'时间',   cat:'分类', price:'价格', loss:'损耗' }; // chip 短标签
function sortItems(list){
  if(sortKey === 'created'){
    const idx = it => ITEMS.indexOf(it);
    const arr = list.slice();
    if(sortDir === 'asc') arr.sort((a, b) => idx(b) - idx(a));
    return arr;
  }
  if(sortKey === 'cat'){
    // 按分类在管理页的顺序（扁平化顺序）排序
    const flat = sortedCatsFlat();
    const catOrder = {};
    flat.forEach((c, i) => { catOrder[c.id] = i; });
    const dir = sortDir === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => ((catOrder[a.catId] ?? 999) - (catOrder[b.catId] ?? 999)) * dir);
  }
  const dir = sortDir === 'asc' ? 1 : -1;
  const by = (a, b) => {
    switch(sortKey){
      case 'price': return (a.price - b.price) * dir;
      case 'loss': return (loss(a) - loss(b)) * dir;
      default: return 0;
    }
  };
  return list.slice().sort(by);
}
function renderList(){
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const list = activeItems().filter(it =>
    (curCat === 'all' || it.catId === curCat) &&
    (!q || it.name.toLowerCase().includes(q) || (it.brand || '').toLowerCase().includes(q)));
  const sorted = sortItems(list);
  document.getElementById('listWrap').innerHTML = sorted.map(it => itemCard(it, `openDetail('${it.id}')`)).join('')
    || '<div class="empty">暂无物品，点右下角 ＋ 添加</div>';
}
/* ---------- 排序抽屉 ---------- */
function updateSortBar(){
  const arrow = sortDir === 'asc' ? '↑' : '↓';
  document.getElementById('sbCur').textContent = SORT_SHORT[sortKey] + arrow;
  // 非默认排序维度时 chip 黑底外显，默认（创建时间）保持中性
  document.getElementById('sortChip').classList.toggle('on', sortKey !== 'created');
}
function buildSortSheet(){
  const upArr = '<path d="M12 5v14m0-14l-5 5m5-5l5 5"/>';
  const dnArr = '<path d="M12 19V5m0 14l5-5m-5 5l-5-5"/>';
  document.getElementById('sortList').innerHTML = Object.keys(SORT_LABELS).map(k => {
    const active = k === sortKey;
    const arr = active ? (sortDir === 'asc' ? upArr : dnArr) : '';
    return `<div class="sort-row${active ? ' active' : ''}" onclick="setSort('${k}')">
      <span class="sr-name">${SORT_LABELS[k]}</span>
      <svg class="sr-arrow" viewBox="0 0 24 24">${arr}</svg></div>`;
  }).join('');
}
function setSort(k){
  if(k === sortKey){ sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
  else { sortKey = k; sortDir = (k === 'created' || k === 'price' || k === 'loss') ? 'desc' : 'asc'; }
  buildSortSheet(); updateSortBar(); renderList(); closeSortSheet();
}
function openSortSheet(){ buildSortSheet(); document.getElementById('sortMask').classList.add('show'); document.getElementById('sortSheet').classList.add('show'); }
function closeSortSheet(){ document.getElementById('sortMask').classList.remove('show'); document.getElementById('sortSheet').classList.remove('show'); }

/* ---------- 搜索聚焦：筛选/排序 chip 淡出，输入框临时占满整行 ---------- */
function searchFocus(on){
  document.getElementById('searchRow').classList.toggle('searching', on);
}

/* ---------- 长按弹窗（列表+方格统一） ---------- */
let pendingAct = null;
function bindLongPress(){
  const wrap = document.getElementById('listWrap');
  if(wrap.__lpBound) return;
  wrap.__lpBound = true;
  let timer = null, startX = 0, startY = 0, fired = false;
  wrap.addEventListener('touchstart', e => {
    const card = e.target.closest('.card.item');
    if(!card) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; fired = false;
    timer = setTimeout(() => {
      fired = true;
      if(navigator.vibrate) navigator.vibrate(15);
      openActSheet(card.dataset.id);
    }, 480);
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if(!timer) return;
    const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
    if(Math.abs(dx) > 10 || Math.abs(dy) > 10){ clearTimeout(timer); timer = null; }
  }, { passive: true });
  wrap.addEventListener('touchend', () => { if(timer){ clearTimeout(timer); timer = null; } });
  wrap.addEventListener('touchcancel', () => { if(timer){ clearTimeout(timer); timer = null; } });
  wrap.addEventListener('click', e => {
    if(fired){ e.preventDefault(); e.stopPropagation(); fired = false; }
  }, true);
  wrap.addEventListener('contextmenu', e => {
    const card = e.target.closest('.card.item');
    if(card){ e.preventDefault(); openActSheet(card.dataset.id); }
  });
}
const IC_ARCHIVE = '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 21h16"/></svg>';
const IC_RESTORE = '<svg viewBox="0 0 24 24"><path d="M12 21V9m0 0l-4 4m4-4l4 4"/><path d="M4 3h16"/></svg>';
const IC_DELETE = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0v12a1 1 0 001 1h8a1 1 0 001-1V7M10 11v6M14 11v6"/></svg>';
function openActSheet(id){
  const it = ITEMS.find(x => x.id === id);
  if(!it) return;
  pendingAct = { id, archived: !!it.archived };
  const archBtn = it.archived
    ? `<div class="act-item" onclick="actRestore()">${IC_RESTORE}恢复</div>`
    : `<div class="act-item" onclick="actArchive()">${IC_ARCHIVE}归档</div>`;
  const delText = it.archived ? '彻底删除' : '删除';
  document.getElementById('actItems').innerHTML = `
    ${archBtn}
    <div class="act-item danger" onclick="actDelete()">${IC_DELETE}${delText}</div>`;
  document.getElementById('actMask').classList.add('show');
  document.getElementById('actSheet').classList.add('show');
}
function closeActSheet(){ document.getElementById('actMask').classList.remove('show'); document.getElementById('actSheet').classList.remove('show'); pendingAct = null; }
function actArchive(){ const id = pendingAct && pendingAct.id; closeActSheet(); if(id) archiveItem(id); }
function actRestore(){ const id = pendingAct && pendingAct.id; closeActSheet(); if(id) restoreItem(id); }
function actDelete(){ const id = pendingAct && pendingAct.id; closeActSheet(); if(id) delItem(id); }

function toggleView(){
  isGrid = !isGrid;
  document.getElementById('listWrap').classList.toggle('grid', isGrid);
  renderToggleIcons();
  renderList();
}
function toggleDensity(){
  isCompact = !isCompact;
  document.getElementById('listWrap').classList.toggle('compact', isCompact);
  renderToggleIcons();
}
function renderToggleIcons(){
  const gridSvg = isGrid
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>';
  const denseSvg = isCompact
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="3" width="16" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="4" y="17" width="16" height="4" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="3" width="16" height="5" rx="1.5"/><rect x="4" y="10.5" width="16" height="5" rx="1.5"/><rect x="4" y="18" width="16" height="3" rx="1.5"/></svg>';
  document.getElementById('viewToggle').innerHTML = gridSvg;
  document.getElementById('densityToggle').innerHTML = denseSvg;
}

/* ---------- 详情 ---------- */
function openDetail(id){
  const it = ITEMS.find(x => x.id === id);
  if(!it) return;
  detailFrom = it.archived ? 'scr-archive' : 'scr-list';
  const h = held(it), d = daily(it), l = loss(it), r = remain(it), c = lossColor(l);
  document.getElementById('detTitle').textContent = it.name;
  const actions = it.archived
    ? `<button class="btn-ghost" onclick="restoreItem('${it.id}')">恢复</button>
       <button class="btn-danger" onclick="delItem('${it.id}')">彻底删除</button>`
    : `<button class="btn-ghost" onclick="openEdit('${it.id}')">编辑</button>
       <button class="btn-ghost" onclick="archiveItem('${it.id}')">归档</button>
       <button class="btn-danger" onclick="delItem('${it.id}')">删除</button>`;
  const archRow = it.archived ? `<div class="row"><span>归档时间</span><b>${it.archivedAt || '—'}</b></div>` : '';
  const frozenNote = it.archived
    ? `<div class="frozen-note">⏸ 已归档：日均价格与损耗率已按归档日（${it.archivedAt || '—'}）冻结，不再随时间变化。恢复后恢复正常计算。</div>` : '';
  document.getElementById('detWrap').innerHTML = `
    <div class="card hero">
      <div class="big">${fmt(d)}</div>
      <div class="sub">日均使用价格 · 已持有 ${h} 天${it.archived ? ' · 已冻结' : ''}</div>
    </div>
    <div class="card">
      <div class="loss-head"><span>损耗率（时间）</span><b style="color:${c}">${l}%</b></div>
      <div class="loss-bar"><i style="width:${l}%;background:${c}"></i></div>
      <div class="loss-foot">已用 ${h} 天 / 预计 ${it.life} 年 · 剩余约 ${r} 天</div>
    </div>
    ${frozenNote}
    <div class="card">
      <div class="row"><span>品牌</span><b>${esc(it.brand) || '—'}</b></div>
      <div class="row"><span>分类</span><b>${esc(catName(it.catId))}</b></div>
      <div class="row"><span>购买价格</span><b>${fmt(it.price)}</b></div>
      <div class="row"><span>购买日期</span><b>${it.date}</b></div>
      <div class="row"><span>预计使用年限</span><b>${it.life} 年</b></div>
      ${archRow}
    </div>
    <div class="actions">${actions}</div>`;
  showScreen('scr-detail');
}
function backFromDetail(){ showScreen(detailFrom); }

function archiveItem(id){ pendingArchive = id; openArchModal(); }
function confirmArchive(){
  const id = pendingArchive; closeArchModal(); pendingArchive = null;
  if(id == null) return;
  const it = ITEMS.find(x => x.id === id);
  if(it){ it.archived = true; it.archivedAt = isoDate(); persist(); }
  renderList(); showScreen('scr-list');
}
function openArchModal(){ document.getElementById('archMask').classList.add('show'); document.getElementById('archModal').classList.add('show'); }
function closeArchModal(){ document.getElementById('archMask').classList.remove('show'); document.getElementById('archModal').classList.remove('show'); }
function restoreItem(id){ pendingRestore = id; openRestoreModal(); }
function confirmRestore(){
  const id = pendingRestore; closeRestoreModal(); pendingRestore = null;
  if(id == null) return;
  const it = ITEMS.find(x => x.id === id);
  if(it){ it.archived = false; it.archivedAt = null; persist(); }
  renderArchive(); renderList(); showScreen('scr-list');
}
function openRestoreModal(){ document.getElementById('restoreMask').classList.add('show'); document.getElementById('restoreModal').classList.add('show'); }
function closeRestoreModal(){ document.getElementById('restoreMask').classList.remove('show'); document.getElementById('restoreModal').classList.remove('show'); }
function delItem(id){ pendingDel = id; openDelModal(); }
function confirmDel(){
  const id = pendingDel; closeDelModal(); pendingDel = null;
  if(id == null) return;
  const it = ITEMS.find(x => x.id === id);
  ITEMS = ITEMS.filter(x => x.id !== id);
  persist();
  if(it && it.archived){ renderArchive(); showScreen('scr-archive'); }
  else { renderList(); showScreen('scr-list'); }
}

/* ---------- 录入 / 编辑 ---------- */
let entryDirty = false;
function fillEntryForm(it){
  document.getElementById('e-name').value = it ? it.name : '';
  document.getElementById('e-price').value = it ? it.price : '';
  document.getElementById('e-brand').value = it ? (it.brand || '') : '';
  document.getElementById('e-life-custom').value = '';
  const customLabel = document.querySelector('.life-custom');
  if(customLabel) customLabel.classList.remove('on');
  document.getElementById('e-date').value = it ? it.date : isoDate();
  document.querySelectorAll('#e-life>span').forEach(s => s.classList.remove('on'));
  const ly = it ? it.life : 1;
  const match = document.querySelector(`#e-life span[data-y="${ly}"]`);
  if(match) match.classList.add('on');
  else { document.getElementById('e-life-custom').value = ly; if(customLabel) customLabel.classList.add('on'); }
  if(it){ selCat = it.catId; }
  chooseCat(selCat);
  updatePreview();
  entryDirty = false;
}
function openEntry(){
  editingId = null;
  document.querySelector('#scr-entry .navbar').innerHTML = '<span class="back" onclick="backFromEntry()">‹</span>添加物品';
  fillEntryForm(null);
  showScreen('scr-entry');
}
function openEdit(id){
  const it = ITEMS.find(x => x.id === id);
  if(!it) return;
  editingId = id;
  document.querySelector('#scr-entry .navbar').innerHTML = '<span class="back" onclick="backFromEntry()">‹</span>编辑物品';
  fillEntryForm(it);
  showScreen('scr-entry');
}
function backFromEntry(){
  if(entryDirty){
    if(!confirm('当前修改未保存，确定要离开吗？')) return;
  }
  entryDirty = false;
  showScreen(editingId ? 'scr-detail' : 'scr-list');
  if(editingId) openDetail(editingId);
  editingId = null;
}
function getLife(){
  const c = parseFloat(document.getElementById('e-life-custom').value);
  if(c > 0) return c;
  const on = document.getElementById('e-life').querySelector('span[data-y].on');
  return on ? parseFloat(on.dataset.y) : 1;
}
function updatePreview(){
  entryDirty = true;
  const name = document.getElementById('e-name').value.trim();
  const p = parseFloat(document.getElementById('e-price').value);
  const dt = document.getElementById('e-date').value;
  const box = document.getElementById('e-preview');
  const elName = box.querySelector('.ep-name');
  const elBig = box.querySelector('.ep-big');
  const elSub = box.querySelector('.ep-sub');
  const elBar = box.querySelector('.ep-bar>i');
  const elLoss = box.querySelector('.ep-loss');
  elName.textContent = name || '物品名称';
  elName.style.opacity = name ? '1' : '.7';
  if(!p || !dt){
    elBig.textContent = '¥0.00';
    elSub.textContent = '填写价格与日期后，自动预估日均使用价格';
    elBar.style.width = '0%';
    elLoss.innerHTML = '<span>损耗率 —</span><span>预计 — 年</span>';
    return;
  }
  const ly = getLife();
  const h = Math.max(1, daysSince(dt));
  const d = p / h;
  const l = Math.min(100, Math.round(h / (ly * 365) * 100));
  const c = lossColor(l);
  elBig.textContent = fmt(d);
  elSub.textContent = `日均使用价格 · 已持有 ${h} 天`;
  elBar.style.width = l + '%';
  elBar.style.background = c;
  elLoss.innerHTML = `<span>损耗率 ${l}%</span><span>预计 ${ly} 年</span>`;
}
document.getElementById('e-life').addEventListener('click', e => {
  if(e.target.dataset.y){
    document.getElementById('e-life-custom').value = '';
    const cl = document.querySelector('.life-custom');
    if(cl) cl.classList.remove('on');
    document.querySelectorAll('#e-life>span').forEach(s => s.classList.remove('on'));
    e.target.classList.add('on'); updatePreview();
  }
});
function customLife(){
  const inp = document.getElementById('e-life-custom');
  const val = parseFloat(inp.value);
  const label = inp.closest('.life-custom');
  if(val > 0){
    document.querySelectorAll('#e-life>span').forEach(s => s.classList.remove('on'));
    if(label) label.classList.add('on');
  } else {
    if(label) label.classList.remove('on');
  }
  updatePreview();
}
function saveEntry(){
  const name = document.getElementById('e-name').value.trim();
  const price = parseFloat(document.getElementById('e-price').value);
  const date = document.getElementById('e-date').value;
  if(!name || !price || !date){ alert('请至少填写：名称、购买价格、购买日期'); return; }
  if(editingId){
    const it = ITEMS.find(x => x.id === editingId);
    if(!it) return;
    it.name = name; it.brand = document.getElementById('e-brand').value.trim();
    it.price = price; it.date = date; it.life = getLife();
    it.catId = selCat;
    persist();
    entryDirty = false; editingId = null;
    renderList(); renderArchive();
    openDetail(it.id);
    return;
  }
  if(ITEMS.length >= MAX_ITEMS){ alert('已达本地容量上限（' + MAX_ITEMS + ' 条），无法继续添加'); return; }
  const it = {id:uid(), name, brand:document.getElementById('e-brand').value.trim(),
    price, date, life:getLife(), catId:selCat, archived:false};
  ITEMS.unshift(it);
  persist();
  entryDirty = false;
  curCat = 'all'; renderList();
  const d = daily(it), h = held(it);
  lastSavedId = it.id;
  document.getElementById('savedInfo').innerHTML =
    `<b>${esc(it.name)}</b><br>日均使用价格 ${fmt(d)} · 已持有 ${h} 天`;
  document.getElementById('savedViewBtn').onclick = function(){ closeSavedModal(); openDetail(it.id); };
  openSavedModal();
}
function openSavedModal(){ document.getElementById('savedMask').classList.add('show'); document.getElementById('savedModal').classList.add('show'); }
function closeSavedModal(){ document.getElementById('savedMask').classList.remove('show'); document.getElementById('savedModal').classList.remove('show'); }

/* ---------- 统计 ---------- */
function setStatDim(d){ if(statDim === d) return; statDim = d; renderStats(); }
function renderStats(){
  const act = activeItems();
  const totalAssets = act.reduce((s, it) => s + it.price, 0);
  const totalDaily  = act.reduce((s, it) => s + daily(it), 0);
  const byPrice = {}, byCount = {};
  act.forEach(it => {
    const k = it.catId;
    byPrice[k] = (byPrice[k] || 0) + it.price;
    byCount[k] = (byCount[k] || 0) + 1;
  });
  const dimPrice = statDim === 'price';
  const byDim = dimPrice ? byPrice : byCount;
  const totalDim = dimPrice ? totalAssets : act.length;
  // 按分类在管理页的顺序排列
  const flat = sortedCatsFlat();
  const catRows = flat.filter(c => byDim[c.id]).map(c => ({c, v: byDim[c.id], price: byPrice[c.id]||0, count: byCount[c.id]||0}));
  const maxCat = Math.max(...catRows.map(r => r.v), 1);
  const dimLabel = dimPrice ? '总价' : '数量';
  const dimToggle = `<span style="display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;font-size:11px;font-weight:600;flex:0 0 auto;">
    <span onclick="setStatDim('price')" style="padding:4px 13px;cursor:pointer;${dimPrice?'background:var(--accent);color:#fff;':'color:var(--sub);'}">价格</span>
    <span onclick="setStatDim('count')" style="padding:4px 13px;cursor:pointer;${!dimPrice?'background:var(--accent);color:#fff;':'color:var(--sub);'}">数量</span>
  </span>`;
  const catVal = r => dimPrice
    ? `${fmt(r.v)}<small>${(r.v / (totalDim || 1) * 100).toFixed(0)}%</small>`
    : `${r.v} 件<small>${(r.v / (totalDim || 1) * 100).toFixed(0)}%</small>`;
  // ===== 排行榜（各 TOP5；损耗条宽=百分比本身，日均/持有条宽相对组内最大值） =====
  const byLoss  = [...act].sort((a, b) => loss(b) - loss(a)).slice(0, 5);
  const byDaily = [...act].sort((a, b) => daily(b) - daily(a)).slice(0, 5);
  const byHeld  = [...act].sort((a, b) => held(b) - held(a)).slice(0, 5);
  const mxD = Math.max(...byDaily.map(it => daily(it)), 1e-9);
  const mxH = Math.max(...byHeld.map(it => held(it)), 1e-9);
  const rankCard = (title, rows) => rows.length ? `
    <div class="card">
      <div class="sec-title">${title}</div>
      ${rows}
    </div>` : '';
  const lossRows  = byLoss.map(it => { const l = loss(it), c = lossColor(l); return `
    <div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${l}%;background:${c}"></i></span><span class="pc" style="color:${c}">${l}%</span></div>`; }).join('');
  const dailyRows = byDaily.map(it => { const d = daily(it); return `
    <div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${d / mxD * 100}%;background:var(--accent)"></i></span><span class="pc">${fmt(d)}</span></div>`; }).join('');
  const heldRows  = byHeld.map(it => { const h = held(it); return `
    <div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${h / mxH * 100}%;background:var(--accent)"></i></span><span class="pc">${h.toLocaleString('zh-CN')} 天</span></div>`; }).join('');
  const avgHeld = act.length ? Math.round(act.reduce((s, it) => s + held(it), 0) / act.length) : 0;
  document.getElementById('statsWrap').innerHTML = `
    <div class="sum-grid">
      <div class="sum"><div class="t">总资产（原价）</div><div class="v">${fmt(totalAssets)}</div></div>
      <div class="sum"><div class="t">总日均成本</div><div class="v">${fmt(totalDaily)}</div></div>
      <div class="sum"><div class="t">物品件数</div><div class="v">${act.length}<small> 件</small></div></div>
      <div class="sum"><div class="t">平均持有</div><div class="v">${avgHeld}<small> 天</small></div></div>
    </div>
    <div class="card">
      <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span>分类分布</span>${dimToggle}
      </div>
      ${catRows.map(r => `<div class="catbar">
        <span class="nm">${catEmoji(r.c.id)} ${esc(r.c.name)}</span>
        <span class="bar"><i style="width:${r.v / maxCat * 100}%"></i></span>
        <span class="vl">${catVal(r)}</span>
      </div>`).join('')}
    </div>
    ${rankCard('损耗排行 TOP5', lossRows)}
    ${rankCard('日均最贵 TOP5', dailyRows)}
    ${rankCard('持有最久 TOP5', heldRows)}`;
}
function openArchive(){ renderArchive(); showScreen('scr-archive'); }
function renderArchive(){
  const list = ITEMS.filter(i => i.archived);
  document.getElementById('archiveWrap').innerHTML = list.length
    ? list.map(it => itemCard(it, `openDetail('${it.id}')`)).join('')
    : '<div class="empty">暂无归档物品</div>';
}

/* ---------- 我的 ---------- */
function renderMine(){
  const archCount = ITEMS.filter(i => i.archived).length;
  const catCount = CATS_CFG.length;
  document.getElementById('mineWrap').innerHTML = `
    <div class="card hero-mine">
      <div class="app-name">有数</div>
      <div class="slogan">你的物品，心里有数。</div>
    </div>
    <div style="height:12px"></div>
    <div class="menu">
      <div class="menu-item" onclick="openArchive()"><span>归档物品</span><span class="mi-ct">${archCount} 件 ›</span></div>
      <div class="menu-item" onclick="openCatMgmt()"><span>分类管理</span><span class="mi-ct">${catCount} 个 ›</span></div>
      <div class="menu-item" onclick="exportItems()"><span>导出数据</span><span class="mi-ct">›</span></div>
      <div class="menu-item" onclick="importItems()"><span>导入数据</span><span class="mi-ct">›</span></div>
      <div class="menu-item" onclick="openAboutModal()"><span>关于「有数」</span><span class="mi-ct">›</span></div>
    </div>
    <div class="note">数据保存在本机，可随时导出备份。<br>有数 · 让每一件拥有都更清醒。</div>`;
}
function exportData(){ exportItems(); }
function openAboutModal(){ document.getElementById('aboutVer').textContent = APP_VERSION; document.getElementById('aboutMask').classList.add('show'); document.getElementById('aboutModal').classList.add('show'); }
function closeAboutModal(){ document.getElementById('aboutMask').classList.remove('show'); document.getElementById('aboutModal').classList.remove('show'); }

/* ===================================================================
   分类管理
   =================================================================== */
let editingCat = null;       // 当前编辑的分类对象（null=新增）
let editingCatIcon = null;   // 当前选中的图标：{type:'emoji', val:'📱'} 或 {type:'image', val:'data:...'}
let editingCatGroup = null;  // 当前选中的归属分组 id
let pendingDelCat = null;    // 待删除的分类 id

function openCatMgmt(){
  renderCatMgmt();
  showScreen('scr-cat');
}
function renderCatMgmt(){
  const wrap = document.getElementById('catMgmtWrap');
  const grpHtml = sortedGroups().map(g => {
    const cats = catsInGroup(g.id);
    if(!cats.length && g.builtin && g.id !== 'grp-other') return ''; // 空内置组不显示
    const catRows = cats.map(c => {
      const ico = c.icon || c.emoji;
      const icoHtml = c.icon ? `<img src="${c.icon}">` : ico;
      return `<div class="cm-row" data-id="${c.id}">
        <span class="cm-drag">⠿</span>
        <span class="cm-ava">${icoHtml}</span>
        <span class="cm-mid"><span class="cm-name">${esc(c.name)}</span><span class="cm-meta">${countItemsInCat(c.id)} 件物品</span></span>
        ${c.builtin ? '<span class="cm-tag">内置</span>' : ''}
        <span class="cm-go">›</span>
      </div>`;
    }).join('');
    return `<div class="cm-grp">
      <div class="cm-grp-hd"><span class="cm-grp-name">${esc(g.name)}</span>
        <span class="cm-grp-edit" onclick="openGrpSheet()">编辑分组<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span>
      </div>
      <div class="cm-list" data-gid="${g.id}">${catRows}</div>
      <div class="cm-add" onclick="openCatEdit(null,'${g.id}')"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>新增分类</div>
    </div>`;
  }).join('');
  wrap.innerHTML = grpHtml + `<div class="cm-hint">长按 ⠿ 可拖动排序（仅同组内）<br>点分类可编辑名称与图标</div>`;
  bindCatDrag();
}
function countItemsInCat(catId){ return ITEMS.filter(i => i.catId === catId).length; }
function backFromCatMgmt(){ showScreen('scr-mine'); }

/* ----- 分类拖拽排序（touch） ----- */
function bindCatDrag(){
  const wrap = document.getElementById('catMgmtWrap');
  if(wrap.__cdBound) return;
  wrap.__cdBound = true;
  let dragRow = null, dragGid = null, timer = null, startY = 0, moved = false;
  let placeholder = null;
  wrap.addEventListener('touchstart', e => {
    const handle = e.target.closest('.cm-drag');
    const row = e.target.closest('.cm-row');
    if(!handle || !row) return;
    startY = e.touches[0].clientY; moved = false;
    timer = setTimeout(() => {
      dragRow = row;
      dragGid = row.parentElement.dataset.gid;
      moved = true;
      if(navigator.vibrate) navigator.vibrate(15);
      row.classList.add('dragging');
      // 创建占位指示
    }, 350);
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if(!moved && timer){
      const dy = e.touches[0].clientY - startY;
      if(Math.abs(dy) > 10){ clearTimeout(timer); timer = null; }
      return;
    }
    if(!dragRow) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    const list = dragRow.parentElement;
    const rows = [...list.querySelectorAll('.cm-row')].filter(r => r !== dragRow);
    // 找到插入位置
    let before = null;
    for(const r of rows){
      const rect = r.getBoundingClientRect();
      if(y < rect.top + rect.height / 2){ before = r; break; }
    }
    // 移动拖拽行到该位置
    if(before) list.insertBefore(dragRow, before);
    else list.appendChild(dragRow);
  }, { passive: false });
  wrap.addEventListener('touchend', () => {
    if(timer){ clearTimeout(timer); timer = null; }
    if(!dragRow) return;
    dragRow.classList.remove('dragging');
    // 根据新 DOM 顺序更新 CATS_CFG 的 order
    const list = dragRow.parentElement;
    const gid = list.dataset.gid;
    const newOrder = [...list.querySelectorAll('.cm-row')].map(r => r.dataset.id);
    newOrder.forEach((id, i) => {
      const c = catById(id);
      if(c){ c.order = i; c.groupId = gid; }
    });
    persistCats();
    dragRow = null;
    // moved 保持 true，由后续 click 事件消费（touchend 先于 click 触发）
  });
  wrap.addEventListener('touchcancel', () => {
    if(timer){ clearTimeout(timer); timer = null; }
    if(dragRow){ dragRow.classList.remove('dragging'); dragRow = null; }
    moved = false;
  });
  // 点击行 → 编辑
  wrap.addEventListener('click', e => {
    if(moved){ moved = false; return; }
    const row = e.target.closest('.cm-row');
    if(row && !e.target.closest('.cm-drag')){
      const id = row.dataset.id;
      // 点击发生在 touch 拖拽后会被上面的 moved 标记吃掉
      if(!e.detail || e.detail === 1) openCatEdit(id);
    }
  });
}

/* ----- 分组管理抽屉 ----- */
function openGrpSheet(){
  renderGrpSheet();
  document.getElementById('grpMask').classList.add('show');
  document.getElementById('grpSheet').classList.add('show');
}
function closeGrpSheet(){ document.getElementById('grpMask').classList.remove('show'); document.getElementById('grpSheet').classList.remove('show'); }
function renderGrpSheet(){
  const grps = sortedGroups();
  document.getElementById('grpList').innerHTML = grps.map((g, i) => {
    const canUp = i > 0;
    const canDown = i < grps.length - 1;
    return `<div class="ge-row">
      <span class="ge-ava">${i+1}</span>
      <span class="ge-mid"><span class="ge-name" onclick="renameGrp('${g.id}')">${esc(g.name)}</span><span class="ge-meta">${catsInGroup(g.id).length} 个分类</span></span>
      ${g.builtin ? '<span class="ge-tag">内置</span>' : ''}
      <span class="ge-acts">
        <button ${canUp?'':'disabled'} onclick="moveGrp('${g.id}',-1)"><svg viewBox="0 0 24 24"><path d="M12 19V5m0 0l-4 4m4-4l4 4"/></svg></button>
        <button ${canDown?'':'disabled'} onclick="moveGrp('${g.id}',1)"><svg viewBox="0 0 24 24"><path d="M12 5v14m0 0l4-4m-4 4l-4-4"/></svg></button>
      </span>
      <span class="ge-del ${g.builtin?'hidden':''}" onclick="delGrp('${g.id}')">×</span>
    </div>`;
  }).join('');
}
function moveGrp(id, dir){
  const grps = sortedGroups();
  const i = grps.findIndex(g => g.id === id);
  const j = i + dir;
  if(j < 0 || j >= grps.length) return;
  // 交换 order
  const oa = grps[i].order, ob = grps[j].order;
  grps[i].order = ob; grps[j].order = oa;
  persistCats(); renderGrpSheet();
}
function renameGrp(id){
  const g = grpById(id);
  if(!g) return;
  const name = prompt('分组名称', g.name);
  if(name && name.trim()){
    g.name = name.trim();
    persistCats(); renderGrpSheet();
  }
}
function addGrp(){
  const name = prompt('新增分组名称', '');
  if(name && name.trim()){
    const maxOrder = Math.max(...GROUPS.map(g => g.order || 0), -1);
    GROUPS.push({ id: uid(), name: name.trim(), builtin: false, order: maxOrder + 1 });
    persistCats(); renderGrpSheet();
  }
}
function delGrp(id){
  const g = grpById(id);
  if(!g || g.builtin) return;
  const cats = catsInGroup(id);
  if(cats.length){
    alert('该分组下还有分类，请先移走或删除分类后再删除分组');
    return;
  }
  GROUPS = GROUPS.filter(x => x.id !== id);
  persistCats(); renderGrpSheet();
}

/* ----- 新增/编辑分类抽屉 ----- */
function openCatEdit(id, defaultGroup){
  const c = id ? catById(id) : null;
  editingCat = c;
  if(c){
    editingCatIcon = c.icon ? {type:'image', val:c.icon} : {type:'emoji', val:c.emoji};
    editingCatGroup = c.groupId;
    document.getElementById('catEditTitle').textContent = '编辑分类';
    document.getElementById('catEditDel').style.display = c.builtin ? 'none' : 'block';
    document.getElementById('e-cat-name').value = c.name;
    document.getElementById('e-cat-name').dataset.id = c.id;
  } else {
    editingCatIcon = {type:'emoji', val:'📦'};
    editingCatGroup = defaultGroup || 'grp-common';
    document.getElementById('catEditTitle').textContent = '新增分类';
    document.getElementById('catEditDel').style.display = 'none';
    document.getElementById('e-cat-name').value = '';
    document.getElementById('e-cat-name').dataset.id = '';
  }
  renderCatEditPreview();
  renderGrpPick();
  renderIconLib();
  document.getElementById('catEditMask').classList.add('show');
  document.getElementById('catEditSheet').classList.add('show');
}
function closeCatEdit(){ document.getElementById('catEditMask').classList.remove('show'); document.getElementById('catEditSheet').classList.remove('show'); editingCat = null; }
function renderCatEditPreview(){
  const name = document.getElementById('e-cat-name').value.trim() || '分类名称';
  const icon = editingCatIcon;
  const iconHtml = icon.type === 'image'
    ? `<img src="${icon.val}">`
    : icon.val;
  document.getElementById('catEditPreview').innerHTML =
    `<div class="cep-ava">${iconHtml}</div>
     <div><div class="cep-name">${esc(name)}</div><div class="cep-sub">${editingCat ? '已关联 ' + countItemsInCat(editingCat.id) + ' 件物品 · 改名后自动同步' : '将作为新分类加入「' + esc(grpName(editingCatGroup)) + '」分组'}</div></div>`;
}
function renderGrpPick(){
  document.getElementById('grpPick').innerHTML = sortedGroups().map(g =>
    `<span class="gp-chip ${g.id === editingCatGroup ? 'on' : ''}" onclick="pickEditGrp('${g.id}')">${esc(g.name)}</span>`
  ).join('');
}
function pickEditGrp(id){ editingCatGroup = id; renderGrpPick(); renderCatEditPreview(); }
let iconLibTab = 'grp-common';
function renderIconLib(){
  // tab 列表 = 所有分组
  const tabs = sortedGroups();
  if(!tabs.find(g => g.id === iconLibTab)) iconLibTab = tabs[0].id;
  document.getElementById('iconTabs').innerHTML = tabs.map(g =>
    `<span class="${g.id === iconLibTab ? 'on' : ''}" onclick="switchIconTab('${g.id}')">${esc(g.name)}</span>`
  ).join('');
  const lib = (window.YS_ICONLIB || {})[iconLibTab] || [];
  const icons = lib.map(em => {
    const on = editingCatIcon && editingCatIcon.type === 'emoji' && editingCatIcon.val === em;
    return `<div class="icon-tile ${on?'on':''}" onclick="pickEmoji('${em}')">${em}</div>`;
  }).join('');
  const uploadOn = editingCatIcon && editingCatIcon.type === 'image';
  const uploadHtml = `<div class="upload-tile ${uploadOn?'on':''}" onclick="document.getElementById('catIconFile').click()">
    ${uploadOn ? `<img src="${editingCatIcon.val}">` : '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>上传</span>'}
  </div>`;
  document.getElementById('iconGrid').innerHTML = icons + uploadHtml;
}
function switchIconTab(id){ iconLibTab = id; renderIconLib(); }
function pickEmoji(em){
  editingCatIcon = {type:'emoji', val:em};
  renderIconLib(); renderCatEditPreview();
}
// 上传照片 → 预览确认
function onCatIconChosen(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = function(){
    const dataUrl = reader.result;
    // 裁切缩放到 80x80（Canvas 居中裁切方形）
    cropToSquare(dataUrl, 80, function(cropped){
      showIconPreview(cropped);
    });
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}
function cropToSquare(dataUrl, size, cb){
  const img = new Image();
  img.onload = function(){
    const s = Math.min(img.width, img.height);
    const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    cb(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.src = dataUrl;
}
function showIconPreview(dataUrl){
  document.getElementById('iconPreviewBox').innerHTML = `<img src="${dataUrl}">`;
  document.getElementById('iconPreviewMask').classList.add('show');
  document.getElementById('iconPreviewModal').classList.add('show');
  document.getElementById('iconPreviewUse').onclick = function(){
    editingCatIcon = {type:'image', val:dataUrl};
    closeIconPreview();
    renderIconLib(); renderCatEditPreview();
  };
}
function closeIconPreview(){ document.getElementById('iconPreviewMask').classList.remove('show'); document.getElementById('iconPreviewModal').classList.remove('show'); }
function saveCatEdit(){
  const name = document.getElementById('e-cat-name').value.trim();
  if(!name){ alert('请填写分类名称'); return; }
  const icon = editingCatIcon;
  if(editingCat){
    editingCat.name = name;
    editingCat.emoji = icon.type === 'emoji' ? icon.val : '📦';
    editingCat.icon = icon.type === 'image' ? icon.val : null;
    editingCat.groupId = editingCatGroup;
    persistCats();
    closeCatEdit(); renderCatMgmt(); renderCatChips(); updateFilterBar(); renderList();
  } else {
    // 新增：检查重名
    if(CATS_CFG.find(c => c.name === name)){ alert('已存在同名分类'); return; }
    const maxOrder = Math.max(...catsInGroup(editingCatGroup).map(c => c.order || 0), -1);
    CATS_CFG.push({
      id: uid(), name, emoji: icon.type === 'emoji' ? icon.val : '📦',
      icon: icon.type === 'image' ? icon.val : null,
      groupId: editingCatGroup, builtin: false, order: maxOrder + 1
    });
    persistCats();
    closeCatEdit(); renderCatMgmt(); renderCatChips(); updateFilterBar();
    renderMine(); // 更新分类计数
  }
}
// 删除自定义分类 → 迁移弹窗
function delCatFromEdit(){
  if(!editingCat || editingCat.builtin) return;
  pendingDelCat = editingCat.id;
  closeCatEdit();
  const cnt = countItemsInCat(pendingDelCat);
  if(cnt === 0){
    // 无物品直接删
    CATS_CFG = CATS_CFG.filter(c => c.id !== pendingDelCat);
    persistCats(); renderCatMgmt(); renderCatChips(); updateFilterBar(); renderMine();
    pendingDelCat = null;
    return;
  }
  // 有物品 → 弹迁移弹窗
  const sel = document.getElementById('migSelect');
  sel.innerHTML = CATS_CFG.filter(c => c.id !== pendingDelCat).map(c => {
    const ico = c.icon || c.emoji;
    return `<option value="${c.id}">${ico} ${c.name}</option>`;
  }).join('');
  sel.value = 'cat-qita';
  document.getElementById('migCatName').textContent = editingCat.name;
  document.getElementById('migCatCount').textContent = cnt;
  document.getElementById('migMask').classList.add('show');
  document.getElementById('migModal').classList.add('show');
}
function closeMigModal(){ document.getElementById('migMask').classList.remove('show'); document.getElementById('migModal').classList.remove('show'); pendingDelCat = null; }
function confirmMigCat(){
  const target = document.getElementById('migSelect').value;
  if(!target || !pendingDelCat) return;
  // 迁移物品
  ITEMS.forEach(it => { if(it.catId === pendingDelCat) it.catId = target; });
  persist();
  // 删除分类
  CATS_CFG = CATS_CFG.filter(c => c.id !== pendingDelCat);
  persistCats();
  closeMigModal();
  renderCatMgmt(); renderCatChips(); updateFilterBar(); renderList(); renderMine();
}

/* ---------- 导入（含覆盖清单确认 + 分类合并） ---------- */
async function importItems(){
  const files = await listImportFiles();
  if(files === null){ importItemsPickFile(); return; }
  const list = document.getElementById('pickList');
  if(!files.length){
    list.innerHTML = '<div class="pick-empty">未在导出目录找到备份文件<br>可点下方「选择其它文件」</div>';
  }else{
    list.innerHTML = files.map(f =>
      `<div class="pick-item" onclick="pickImportFile('${f}')"><span class="pi-ic">📄</span><span class="pi-nm">${f}</span></div>`).join('');
  }
  document.getElementById('pickMask').classList.add('show');
  document.getElementById('pickModal').classList.add('show');
}
function closePickModal(){ document.getElementById('pickMask').classList.remove('show'); document.getElementById('pickModal').classList.remove('show'); }
function importItemsPickFile(){ const el = document.getElementById('fileInput'); if(el) el.click(); }
async function pickImportFile(fname){
  closePickModal();
  try{
    const incoming = await readImportPath(fname);
    proceedImport(incoming);
  }catch(err){ alert('导入失败：' + err.message); }
}
async function onFileChosen(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  try{ proceedImport(await readImportFile(f)); }
  catch(err){ alert('导入失败：' + err.message); }
  e.target.value = '';
}
function proceedImport(incoming){
  // incoming: {items, groups, cats}
  // 迁移旧版 items（cat → catId）
  const incItems = migrateItems(incoming.items);
  const m = mergeImport(ITEMS, incItems);
  pendingImport = { incoming: incItems, overwritten: m.overwritten, added: m.added, incGroups: incoming.groups, incCats: incoming.cats };
  if(m.overwritten.length) showImportModal(m.overwritten, m.added);
  else applyImport(pendingImport);
}
function showImportModal(overwritten, added){
  document.getElementById('impText').innerHTML =
    `将<b>覆盖 ${overwritten.length} 件</b>、<b>新增 ${added.length} 件</b>。以下为将被覆盖的物品（上=本机，下=导入）：`;
  document.getElementById('impList').innerHTML = overwritten.map(o => `
    <div class="imp-row">
      <div class="imp-old">${esc(o.old.name)} · ${esc(o.old.brand||'')}</div>
      <div class="imp-arrow">↓ 将被替换为</div>
      <div class="imp-new">${esc(o.neu.name)} · ${esc(o.neu.brand||'')}</div>
    </div>`).join('');
  document.getElementById('impMask').classList.add('show');
  document.getElementById('impModal').classList.add('show');
}
function closeImportModal(){ document.getElementById('impMask').classList.remove('show'); document.getElementById('impModal').classList.remove('show'); }
function confirmImport(){ if(pendingImport) applyImport(pendingImport); }
function applyImport(p){
  const m = mergeImport(ITEMS, p.incoming);
  if(m.exceeds){ alert('导入后将超过本地上限（' + MAX_ITEMS + ' 条），已取消'); closeImportModal(); return; }
  ITEMS = m.result;
  persist();
  // 合并分类配置（如有）
  if(p.incGroups && p.incCats){
    const merged = mergeCats(GROUPS, CATS_CFG, p.incGroups, p.incCats);
    GROUPS = merged.groups;
    CATS_CFG = merged.cats;
    // 修复物品引用的 catId
    const validIds = CATS_CFG.map(c => c.id);
    ITEMS = fixItemCatIds(ITEMS, validIds);
    persist(); persistCats();
  }
  renderList(); renderStats(); renderCatChips(); updateFilterBar(); renderCatMgmt(); renderMine();
  alert(`导入完成：覆盖 ${p.overwritten.length} 件，新增 ${p.added.length} 件`);
  closeImportModal();
}

/* ---------- 屏幕切换 ---------- */
function showScreen(id){
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const map = {'scr-list':'tab-list', 'scr-stats':'tab-stats', 'scr-mine':'tab-mine'};
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if(map[id]) document.getElementById(map[id]).classList.add('active');
  document.getElementById('fab').style.display = (id === 'scr-list') ? 'flex' : 'none';
  if(id === 'scr-stats')  renderStats();
  if(id === 'scr-archive') renderArchive();
  if(id === 'scr-mine')    renderMine();
  if(id === 'scr-cat')     renderCatMgmt();
  document.querySelector('.screen').scrollTop = 0;
}

/* ---------- v4 专属：筛选抽屉 / 删除弹窗 ---------- */
const IC_ALL = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></svg>';
function openDelModal(){ document.getElementById('delMask').classList.add('show'); document.getElementById('delModal').classList.add('show'); }
function closeDelModal(){ document.getElementById('delMask').classList.remove('show'); document.getElementById('delModal').classList.remove('show'); }

/* ---------- 初始化 ---------- */
async function initApp(){
  // 加载分类配置
  const savedCats = await loadCats();
  if(savedCats && savedCats.groups && savedCats.cats){
    GROUPS = savedCats.groups;
    CATS_CFG = savedCats.cats;
  }
  // 加载物品
  const loaded = await loadItems();
  if(Array.isArray(loaded) && loaded.length){
    // 迁移旧版数据（cat → catId）
    ITEMS = migrateItems(loaded);
    // 修复无效 catId
    const validIds = CATS_CFG.map(c => c.id);
    ITEMS = fixItemCatIds(ITEMS, validIds);
    persist(); // 落盘迁移后的数据
  } else {
    ITEMS = DEFAULT_ITEMS.slice();
  }
  const dEl = document.getElementById('e-date'); if(dEl) dEl.value = isoDate();
  renderToggleIcons(); bindLongPress();
  renderCatChips(); renderList(); showScreen('scr-list'); updateFilterBar(); updateSortBar();
  bindBackButton();
  if(!loaded) persist();
}

/* ---------- 安卓返回键 ---------- */
function bindBackButton(){
  const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if(!A || !A.addListener) return;
  A.addListener('backButton', () => {
    const popups = [
      ['.sheet.show', () => { closeFilterSheet(); closeCatSheet(); closeSortSheet(); closeGrpSheet(); }],
      ['#catEditMask.show', closeCatEdit],
      ['#iconPreviewMask.show', closeIconPreview],
      ['#migMask.show', closeMigModal],
      ['#delMask.show', closeDelModal],
      ['#archMask.show', closeArchModal],
      ['#restoreMask.show', closeRestoreModal],
      ['#impMask.show', closeImportModal],
      ['#savedMask.show', closeSavedModal],
      ['#aboutMask.show', closeAboutModal],
      ['#pickMask.show', closePickModal]
    ];
    for(const [sel, fn] of popups){
      if(document.querySelector(sel)){ fn(); return; }
    }
    if(document.querySelector('#actMask.show')){ closeActSheet(); return; }
    const cur = document.querySelector('.scr.active');
    if(!cur) return;
    const id = cur.id;
    if(id === 'scr-detail'){ backFromDetail(); return; }
    if(id === 'scr-entry'){ backFromEntry(); return; }
    if(id === 'scr-cat'){ backFromCatMgmt(); return; }
    if(id === 'scr-archive'){ showScreen('scr-mine'); return; }
    if(id === 'scr-stats' || id === 'scr-mine'){ showScreen('scr-list'); return; }
    if(A.exitApp) A.exitApp();
  });
}
initApp();
