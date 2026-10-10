/* ============================================================
   有数 · 共享逻辑层（v1 / v2 / v3 / v4 通用）
   - 所有版本共用同一套功能与示例数据
   - 视觉差异由各 HTML 的 <style> 决定（通过 CSS 变量与类名）
   ============================================================ */
const TODAY = new Date('2026-07-09');
// v1 仅本地存储 + 导出/导入：不接云端、不做订阅，代码里不出现任何订阅/云同步逻辑。
// 未来（v1 之后）的云端同步 / 订阅将作为独立模块（如 store/cloud.js、services/subscription.js）通过
// Repository 抽象 + feature flags 接入，不影响 v1 的本地逻辑与量化计算。

// 分类体系（单一数据源，便于后续扩展）：
// 覆盖目标人群（收纳控+普通消费者）常见物品种类，彼此正交（一件物品只属一类），
// 顺序即展示顺序。当前 10 类，含兜底「其它」。未来增删/排序只需改这里，
// 筛选抽屉与添加页的六宫格会自动跟随，无需改动其它代码。
const EMOJI = {
  '数码':'📱','汽车':'🚗','会员':'🎫','家电':'🔌','家居':'🛋️',
  '服饰':'👕','美妆':'💄','运动':'⚽','珠宝':'💍','其它':'📦'
};
const CATS  = Object.keys(EMOJI).map(k => ({key:k, emoji:EMOJI[k]}));
// 录入页「常用分类」——平铺在添加页、一键直选；其余分类在抽屉里选。
// 后续调整高频常显分类只需改这个数组（顺序即展示顺序），不破坏扩展性原则。
const COMMON_CATS = ['数码','家电','服饰','美妆','家居','运动'];

// 示例数据：16 件在册 + 2 件已归档（演示首页更饱满、归档模块有内容；覆盖各分类）
let ITEMS = [
  {id:1, name:'iPhone 15 Pro',     brand:'Apple',               price:8799, date:'2023-09-15', life:3, cat:'数码', emoji:'📱', archived:false},
  {id:2, name:'AirPods Pro 2',     brand:'Apple',               price:1899, date:'2024-11-01', life:3, cat:'数码', emoji:'📱', archived:false},
  {id:3, name:'索尼 WH-1000XM5',   brand:'Sony',                price:2499, date:'2023-03-15', life:4, cat:'数码', emoji:'📱', archived:false},
  {id:4, name:'行车记录仪',         brand:'70迈',                price:499,  date:'2023-08-10', life:4, cat:'汽车', emoji:'🚗', archived:false},
  {id:5, name:'特斯拉 Model Y 脚垫', brand:'Tesla',               price:899,  date:'2024-03-20', life:5, cat:'汽车', emoji:'🚗', archived:false},
  {id:6, name:'爱奇艺黄金年卡',      brand:'爱奇艺',               price:248,  date:'2025-01-01', life:1, cat:'会员', emoji:'🎫', archived:false},
  {id:7, name:'山姆会员年费',        brand:"Sam's Club",          price:260,  date:'2024-10-01', life:1, cat:'会员', emoji:'🎫', archived:false},
  {id:8, name:'戴森吹风机 HD08',     brand:'Dyson',               price:2990, date:'2024-01-20', life:5, cat:'家电', emoji:'🔌', archived:false},
  {id:9, name:'小米台灯 Pro',       brand:'Xiaomi',              price:199,  date:'2024-08-10', life:5, cat:'家电', emoji:'🔌', archived:false},
  {id:10,name:'宜家收纳箱',          brand:'IKEA',                price:79,   date:'2024-07-01', life:5, cat:'家居', emoji:'🛋️', archived:false},
  {id:11,name:'无印良品香薰机',      brand:'MUJI',                price:299,  date:'2023-11-15', life:4, cat:'家居', emoji:'🛋️', archived:false},
  {id:12,name:'Uniqlo 羽绒服',      brand:'Uniqlo',              price:599,  date:'2023-12-01', life:3, cat:'服饰', emoji:'👕', archived:false},
  {id:13,name:'国家地理双肩包',      brand:'National Geographic', price:899,  date:'2022-03-10', life:5, cat:'服饰', emoji:'👕', archived:false},
  {id:14,name:'雅诗兰黛小棕瓶',      brand:'Estée Lauder',        price:780,  date:'2025-01-05', life:1, cat:'美妆', emoji:'💄', archived:false},
  {id:15,name:'Lululemon 瑜伽垫',    brand:'Lululemon',           price:480,  date:'2023-05-10', life:4, cat:'运动', emoji:'⚽', archived:false},
  {id:16,name:'周大福黄金手链',      brand:'周大福',               price:3680, date:'2022-06-01', life:8, cat:'珠宝', emoji:'💍', archived:false},
  {id:17,name:'旧 iPhone 11',       brand:'Apple',               price:5499, date:'2019-09-20', life:4, cat:'数码', emoji:'📱', archived:true, archivedAt:'2024-12-01'},
  {id:18,name:'戴森扫地机器人',      brand:'Dyson',               price:3990, date:'2020-04-01', life:5, cat:'家电', emoji:'🔌', archived:true, archivedAt:'2024-10-15'},
];
let nextId = 19;

let curCat = '全部';
let selCat = '数码';
let isGrid = false;                 // 首页视图：false=列表, true=方格(一行两个)
let detailFrom = 'scr-list';

/* ---------- 量化计算 ---------- */
// 归档冻结：已归档且记录了归档时间时，所有时间相关指标（持有天数/日均/损耗）按"归档日"计算，
// 不再随当前时间变化；恢复后 archivedAt 清空，恢复正常计算。
function refDate(it){ return (it.archived && it.archivedAt) ? new Date(it.archivedAt) : TODAY; }
function daysSince(d, ref){ ref = ref || TODAY; return Math.max(0, Math.floor((ref - new Date(d)) / 86400000)); }
function held(it){ return daysSince(it.date, refDate(it)); }
function daily(it){ const h = held(it); return h ? it.price / h : 0; }
function loss(it){ return Math.min(100, Math.round(held(it) / (it.life * 365) * 100)); }
function remain(it){ return Math.max(0, it.life * 365 - held(it)); }
function isoDate(d){ const x = d || TODAY; const y = x.getFullYear(); const m = String(x.getMonth()+1).padStart(2,'0'); const dd = String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function fmt(n){ return '¥' + Number(n).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtPrice(n){ n = Number(n); return n >= 1000 ? '¥' + n.toLocaleString('zh-CN', {maximumFractionDigits:0}) : fmt(n); }
function esc(s){ return (s || '').toString().replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// 损耗进度条配色：<50% 绿 / 50%~80% 黄 / 80%~100% 红（损耗=负向信号）
function lossColor(l){ return l < 50 ? '#07C160' : (l < 80 ? '#F2C037' : '#EF4B4B'); }

// 首页与统计只统计"未归档"物品
function activeItems(){ return ITEMS.filter(i => !i.archived); }

/* ---------- 分类筛选 ---------- */
function renderChips(){
  const cats = ['全部', ...new Set(activeItems().map(i => i.cat))];
  const ico = c => (c === '全部' ? '📋' : (EMOJI[c] || '📦'));
  document.getElementById('catChips').innerHTML = cats.map(c =>
    `<div class="chip ${c === curCat ? 'on' : ''}" onclick="setCat('${c}')">${ico(c)} ${c}</div>`).join('');
}
function setCat(c){ curCat = c; renderChips(); renderList(); }

function renderCatChips(){
  document.getElementById('e-cat-common').innerHTML = COMMON_CATS.map(k =>
    `<div class="cat-tile ${k === selCat ? 'on' : ''}" onclick="chooseCat('${k}')"><span class="e">${EMOJI[k]}</span><span>${k}</span></div>`).join('');
  updateCatMore();
}
function updateCatMore(){
  const ico = EMOJI[selCat] || '📦';
  const el = document.getElementById('e-cat-more');
  if(el) el.innerHTML = `<span class="cm-cur">${ico} ${selCat}</span><span class="cm-go">更多分类 ⌄</span>`;
}
function chooseCat(k){ selCat = k; renderCatChips(); }

/* ---------- 物品卡片（列表 / 方格通用结构，靠 CSS 重排） ---------- */
function itemCard(it, onclick){
  const h = held(it), d = daily(it), l = loss(it), c = lossColor(l);
  return `<div class="card item" onclick="${onclick}">
    <div class="ava">${it.emoji}</div>
    <div class="item-main">
      <div class="item-name">${esc(it.name)}</div>
      <div class="item-sub"><span class="sub-price">${fmtPrice(it.price)}</span>${it.brand ? ' · ' + esc(it.brand) : ''} · ${it.cat}</div>
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
function renderList(){
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const list = activeItems().filter(it =>
    (curCat === '全部' || it.cat === curCat) &&
    (!q || it.name.toLowerCase().includes(q) || (it.brand || '').toLowerCase().includes(q)));
  document.getElementById('listWrap').innerHTML = list.map(it => itemCard(it, `openDetail(${it.id})`)).join('')
    || '<div class="empty">暂无物品，点右下角 ＋ 添加</div>';
}

function toggleView(){
  isGrid = !isGrid;
  document.getElementById('listWrap').classList.toggle('grid', isGrid);
  document.getElementById('viewToggle').textContent = isGrid ? '▤' : '▦';
}

/* ---------- 详情 ---------- */
function openDetail(id){
  const it = ITEMS.find(x => x.id === id);
  detailFrom = it.archived ? 'scr-archive' : 'scr-list';
  const h = held(it), d = daily(it), l = loss(it), r = remain(it), c = lossColor(l);
  document.getElementById('detTitle').textContent = it.name;
  const actions = it.archived
    ? `<button class="btn-ghost" onclick="restoreItem(${it.id})">恢复</button>
       <button class="btn-danger" onclick="delItem(${it.id})">彻底删除</button>`
    : `<button class="btn-ghost" onclick="archiveItem(${it.id})">归档</button>
       <button class="btn-danger" onclick="delItem(${it.id})">删除</button>`;
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
      <div class="row"><span>分类</span><b>${it.cat}</b></div>
      <div class="row"><span>购买价格</span><b>${fmt(it.price)}</b></div>
      <div class="row"><span>购买日期</span><b>${it.date}</b></div>
      <div class="row"><span>预计使用年限</span><b>${it.life} 年</b></div>
      ${archRow}
    </div>
    <div class="actions">${actions}</div>`;
  showScreen('scr-detail');
}
function backFromDetail(){ showScreen(detailFrom); }

function archiveItem(id){ const it = ITEMS.find(x => x.id === id); if(it){ it.archived = true; it.archivedAt = isoDate(); } renderList(); showScreen('scr-list'); }
function restoreItem(id){ const it = ITEMS.find(x => x.id === id); if(it){ it.archived = false; it.archivedAt = null; } renderList(); showScreen('scr-list'); }
let pendingDel = null;
function delItem(id){ pendingDel = id; openDelModal(); }   // 二次确认：先弹确认框，再点"确认删除"才真正删除
function confirmDel(){
  const id = pendingDel; closeDelModal(); pendingDel = null;
  if(id == null) return;
  const it = ITEMS.find(x => x.id === id);
  ITEMS = ITEMS.filter(x => x.id !== id);
  if(it && it.archived){ renderArchive(); showScreen('scr-archive'); }
  else { renderChips(); renderList(); showScreen('scr-list'); }
}

/* ---------- 录入 ---------- */
function openEntry(){ chooseCat(selCat); showScreen('scr-entry'); }
function getLife(){
  const c = parseFloat(document.getElementById('e-life-custom').value);
  if(c > 0) return c;
  const on = document.getElementById('e-life').querySelector('.on');
  return on ? parseFloat(on.dataset.y) : 1;
}
function updatePreview(){
  const p = parseFloat(document.getElementById('e-price').value);
  const dt = document.getElementById('e-date').value;
  const box = document.getElementById('e-preview');
  if(!p || !dt){ box.textContent = '填写价格与日期后，自动预估「日均使用价格」'; return; }
  const h = Math.max(1, daysSince(dt));
  const d = p / h, ly = getLife(), ex = p / (ly * 365);
  box.textContent = `当前日均 ${fmt(d)} · 按 ${ly} 年预计日均 ${fmt(ex)}`;
}
document.getElementById('e-life').addEventListener('click', e => {
  if(e.target.dataset.y){
    document.getElementById('e-life-custom').value = '';
    document.querySelectorAll('#e-life span').forEach(s => s.classList.remove('on'));
    e.target.classList.add('on'); updatePreview();
  }
});
function customLife(){
  if(document.getElementById('e-life-custom').value > 0)
    document.querySelectorAll('#e-life span').forEach(s => s.classList.remove('on'));
  updatePreview();
}
function saveEntry(){
  const name = document.getElementById('e-name').value.trim();
  const price = parseFloat(document.getElementById('e-price').value);
  const date = document.getElementById('e-date').value;
  if(!name || !price || !date){ alert('请至少填写：名称、购买价格、购买日期'); return; }
  ITEMS.unshift({id:nextId++, name, brand:document.getElementById('e-brand').value.trim(),
    price, date, life:getLife(), cat:selCat, emoji:EMOJI[selCat] || '📦', archived:false});
  curCat = '全部'; renderChips(); renderList();
  showScreen('scr-list');
}

/* ---------- 统计 ---------- */
function renderStats(){
  const act = activeItems();
  const totalAssets = act.reduce((s, it) => s + it.price, 0);
  const totalDaily  = act.reduce((s, it) => s + daily(it), 0);
  // 分类分布：按总价倒序，每行同时显示 总价+件数+占比（无切换控件）
  const byPrice = {}, byCount = {};
  act.forEach(it => { byPrice[it.cat] = (byPrice[it.cat] || 0) + it.price; byCount[it.cat] = (byCount[it.cat] || 0) + 1; });
  const catRows = Object.keys(byPrice).map(c => ({c, price: byPrice[c], count: byCount[c] || 0})).sort((a, b) => b.price - a.price);
  const maxCat = Math.max(...catRows.map(r => r.price), 1);
  const catVal = r => `${fmt(r.price)}<small>${r.count} 件 · ${(r.price / (totalAssets || 1) * 100).toFixed(0)}%</small>`;
  const rankDaily = [...act].sort((a, b) => daily(b) - daily(a)).slice(0, 5);
  const rankHeld  = [...act].sort((a, b) => held(b) - held(a)).slice(0, 5);
  const mxD = Math.max(...rankDaily.map(it => daily(it)), 1e-9);
  const mxH = Math.max(...rankHeld.map(it => held(it)), 1e-9);
  const avgHeld = act.length ? Math.round(act.reduce((s, it) => s + held(it), 0) / act.length) : 0;
  // 归档模块
  const arch = ITEMS.filter(i => i.archived);
  const archByCat = {}; arch.forEach(i => archByCat[i.cat] = (archByCat[i.cat] || 0) + 1);
  const archTags = Object.keys(archByCat).length
    ? Object.keys(archByCat).map(c => `<div class="chip">${EMOJI[c] || '📦'} ${c} ${archByCat[c]}</div>`).join('')
    : '<span style="color:#9aa0a6;font-size:13px">暂无归档</span>';
  document.getElementById('statsWrap').innerHTML = `
    <div class="sum-grid">
      <div class="sum"><div class="t">总资产（原价）</div><div class="v">${fmt(totalAssets)}</div></div>
      <div class="sum"><div class="t">总日均成本</div><div class="v">${fmt(totalDaily)}</div></div>
      <div class="sum"><div class="t">物品件数</div><div class="v">${act.length}<small> 件</small></div></div>
      <div class="sum"><div class="t">平均持有</div><div class="v">${avgHeld}<small> 天</small></div></div>
    </div>
    <div class="card">
      <div class="sec-title">分类分布</div>
      ${catRows.map(r => `<div class="catbar">
        <span class="nm">${EMOJI[r.c] || '📦'} ${r.c}</span>
        <span class="bar"><i style="width:${r.price / maxCat * 100}%"></i></span>
        <span class="vl">${catVal(r)}</span>
      </div>`).join('')}
    </div>
    ${rankDaily.length ? `<div class="card">
      <div class="sec-title">日均最贵 TOP5</div>
      ${rankDaily.map(it => { const d = daily(it); return `<div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${d / mxD * 100}%;background:var(--accent)"></i></span><span class="pc">${fmt(d)}</span></div>`; }).join('')}
    </div>` : ''}
    ${rankHeld.length ? `<div class="card">
      <div class="sec-title">持有最久 TOP5</div>
      ${rankHeld.map(it => { const h = held(it); return `<div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${h / mxH * 100}%;background:var(--accent)"></i></span><span class="pc">${h.toLocaleString('zh-CN')} 天</span></div>`; }).join('')}
    </div>` : ''}
    <div class="card arch-card" onclick="openArchive()">
      <div class="loss-head"><span>📦 归档物品</span><b style="color:#9aa0a6">${arch.length} 件 ›</b></div>
      <div class="loss-foot">已归档物品不计入上方统计，点击查看分类与详情</div>
      <div class="arch-tags">${archTags}</div>
    </div>`;
}
function openArchive(){ renderArchive(); showScreen('scr-archive'); }
function renderArchive(){
  const list = ITEMS.filter(i => i.archived);
  document.getElementById('archiveWrap').innerHTML = list.length
    ? list.map(it => itemCard(it, `openDetail(${it.id})`)).join('')
    : '<div class="empty">暂无归档物品</div>';
}

/* ---------- 我的 ---------- */
function renderMine(){
  document.getElementById('mineWrap').innerHTML = `
    <div class="card hero-mine">
      <div class="app-name">有数</div>
      <div class="slogan">你的物品，心里有数。</div>
    </div>
    <div style="height:12px"></div>
    <div class="menu">
      <div class="menu-item" onclick="exportData()">📤 导出数据</div>
      <div class="menu-item">📥 导入数据</div>
      <div class="menu-item">ℹ️ 关于「有数」</div>
    </div>
    <div class="note">数据保存在本机，可随时导出备份。<br>有数 · 让每一件拥有都更清醒。</div>`;
}
function exportData(){
  const blob = new Blob([JSON.stringify(ITEMS, null, 2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'youshu-items.json'; a.click();
  alert('已导出 ' + ITEMS.length + ' 条物品备份（含归档）');
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
  document.querySelector('.screen').scrollTop = 0;
}

/* ---------- 初始化 ---------- */
renderCatChips(); renderChips(); renderList(); showScreen('scr-list');
