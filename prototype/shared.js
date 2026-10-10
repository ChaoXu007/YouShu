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
function fmt0(n){ return '¥' + Number(n).toLocaleString('zh-CN', {maximumFractionDigits:0}); }
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

/* ---------- 首页资产卡（深色高级卡片；容器 #assetWrap 缺失时自动跳过，旧版本不受影响） ---------- */
function renderAsset(){
  const el = document.getElementById('assetWrap');
  if(!el) return;
  const act = activeItems();
  const total = act.reduce((s, it) => s + it.price, 0);
  const tDaily = act.reduce((s, it) => s + daily(it), 0);
  const nArch = ITEMS.length - act.length;
  el.innerHTML = `<div class="asset-card">
    <div class="ac-label">总价值 · 原价</div>
    <div class="ac-num">${fmt0(total).replace('¥', '<small>¥</small>')}</div>
    <div class="ac-row">
      <div class="ac-cell"><div class="t">在册物品</div><div class="v">${act.length}<small> 件</small></div></div>
      <div class="ac-cell"><div class="t">日均总成本</div><div class="v">${fmt(tDaily)}</div></div>
      <div class="ac-cell"><div class="t">已归档</div><div class="v">${nArch}<small> 件</small></div></div>
    </div>
  </div>`;
}

/* ---------- 首页列表 ---------- */
function renderList(){
  renderAsset();
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

/* ---------- 详情：日均价格走势曲线（SVG） ---------- */
// 横轴=持有天数（最小单位：天），纵轴=日均价格。实线=已发生，灰色虚线=预测至回本日；
// 目标日均=灰色横虚线；末端黑点=今天（归档物品=归档日，不画预测虚线）。
// 前 30 天日均过高，自满月起展示；持有不足 30 天则从第 1 天起、不显示截断说明。
function dailyChartSVG(it){
  const h = held(it);                    // 归档物品按归档日冻结（refDate 已处理）
  const lifeDays = Math.max(2, Math.round(it.life * 365));
  const target = it.price / lifeDays;
  const W = 340, H = 175, PL = 40, PR = 12, PT = 16, PB = 24;
  const truncated = h >= 30 && lifeDays > 30;
  const x0 = truncated ? 30 : 1;
  const x1 = lifeDays;
  const ymax = Math.ceil((it.price / x0) / 50) * 50;
  const sx = day => PL + (day - x0) / (x1 - x0) * (W - PL - PR);
  const sy = v => PT + (1 - Math.min(v, ymax) / ymax) * (H - PT - PB);
  const step = Math.max(1, Math.round((x1 - x0) / 70));
  const solid = [], proj = [];
  for(let day = x0; day <= x1; day += step){
    const p = sx(day).toFixed(1) + ',' + sy(it.price / day).toFixed(1);
    (day <= h ? solid : proj).push(p);
  }
  const hh = Math.max(x0, Math.min(h, x1));
  const junction = sx(hh).toFixed(1) + ',' + sy(it.price / hh).toFixed(1);
  solid.push(junction); proj.unshift(junction);
  const grid = [ymax, ymax / 2].map(v =>
    `<line x1="${PL}" y1="${sy(v)}" x2="${W - PR}" y2="${sy(v)}" stroke="#F0EEE8"/>` +
    `<text x="${PL - 6}" y="${(sy(v) + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#B5B2A9">${fmt0(v)}</text>`).join('');
  const xt = [[x0, truncated ? '满月' : '第1天']];
  for(let y = 1; y * 365 <= x1; y++) xt.push([y * 365, y * 365 === x1 ? `${y} 年·回本` : `${y} 年`]);
  if(xt[xt.length - 1][0] !== x1) xt.push([x1, '回本']);
  const xlabels = xt.map(([day, t]) =>
    `<text x="${sx(day).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="9.5" fill="#9A9A93">${t}</text>`).join('');
  const targetLine =
    `<line x1="${PL}" y1="${sy(target).toFixed(1)}" x2="${W - PR}" y2="${sy(target).toFixed(1)}" stroke="#9A9A93" stroke-dasharray="4 4" stroke-width="1"/>` +
    `<text x="${PL + 4}" y="${(sy(target) - 5).toFixed(1)}" font-size="9.5" fill="#9A9A93">目标 ${fmt(target)}</text>`;
  const endDot =
    `<circle cx="${sx(hh).toFixed(1)}" cy="${sy(it.price / hh).toFixed(1)}" r="4" fill="#111"/>` +
    `<text x="${(sx(hh) - 8).toFixed(1)}" y="${(sy(it.price / hh) - 10).toFixed(1)}" text-anchor="end" font-size="10" font-weight="700" fill="#111">${it.archived ? '归档 ' : '今天 '}${fmt(it.price / hh)}</text>`;
  const projLine = (proj.length > 1 && !it.archived)
    ? `<polyline points="${proj.join(' ')}" fill="none" stroke="#B5B2A9" stroke-width="1.6" stroke-dasharray="3 4"/>` : '';
  return {
    truncated,
    svg: `<svg class="svg-box" viewBox="0 0 ${W} ${H}">${grid}${targetLine}` +
         `<polyline points="${solid.join(' ')}" fill="none" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>` +
         `${projLine}${endDot}${xlabels}</svg>`
  };
}

/* ---------- 详情 ---------- */
function openDetail(id){
  const it = ITEMS.find(x => x.id === id);
  detailFrom = it.archived ? 'scr-archive' : 'scr-list';
  const h = held(it), d = daily(it), l = loss(it), r = remain(it), c = lossColor(l);
  document.getElementById('detTitle').textContent = it.name;
  const detEdit = document.getElementById('detEdit');
  if(detEdit) detEdit.onclick = function(){ openEdit(id); };
  const target = it.price / (it.life * 365);
  const diff = (d / target - 1) * 100;
  const actions = it.archived
    ? `<button class="btn-ghost" onclick="restoreItem(${it.id})">恢复</button>
       <button class="btn-danger" onclick="delItem(${it.id})">彻底删除</button>`
    : `<button class="btn-ghost" onclick="archiveItem(${it.id})">归档</button>
       <button class="btn-danger" onclick="delItem(${it.id})">删除</button>`;
  const archRow = it.archived ? `<div class="row"><span>归档时间</span><b>${it.archivedAt || '—'}</b></div>` : '';
  const frozenNote = it.archived
    ? `<div class="frozen-note">⏸ 已归档：日均价格与损耗率已按归档日（${it.archivedAt || '—'}）冻结，不再随时间变化。恢复后恢复正常计算。</div>` : '';
  // 回本进度（原"损耗率"卡改造）：阈值配色不变，新增目标行
  const goalLine = l >= 100
    ? `<div class="goal-line">✅ 已回本 —— 之后每天都是纯赚</div>`
    : `<div class="goal-line">🎯 再用 ${r} 天回本 —— 之后每天都是纯赚</div>`;
  // 日均价格走势曲线卡（对比结论并入，不再单设对比卡）
  const chart = dailyChartSVG(it);
  const verdict = it.archived
    ? `<div class="chart-verdict">⏸ 已归档：日均价格与走势按归档日（${it.archivedAt || '—'}）冻结。</div>`
    : (diff > 0
      ? `<div class="chart-verdict">当前日均比目标高 <b>${diff.toFixed(1)}%</b>，再用 <b>${r}</b> 天追平目标。</div>`
      : `<div class="chart-verdict">当前日均已优于目标 <b>${Math.abs(diff).toFixed(1)}%</b>，用得物超所值。</div>`);
  document.getElementById('detWrap').innerHTML = `
    <div class="card hero">
      <div class="big">${fmt(d)}</div>
      <div class="sub">日均使用价格 · 已持有 ${h} 天${it.archived ? ' · 已冻结' : ''}</div>
    </div>
    <div class="card">
      <div class="loss-head"><span>回本进度（时间维度）</span><b style="color:${c}">${l}%</b></div>
      <div class="loss-bar"><i style="width:${l}%;background:${c}"></i></div>
      <div class="loss-foot">已用 ${h} 天 / 预计 ${it.life} 年 · 剩余约 ${r} 天</div>
      ${goalLine}
    </div>
    <div class="card">
      <div class="sec-title" style="margin-top:0;">日均价格走势</div>
      ${chart.svg}
      <div class="chart-foot">横轴为持有天数（按天）${chart.truncated ? '；前 30 天日均过高，自满月起展示' : ''}${it.archived ? '；已按归档日冻结' : '；虚线为预测走势'}。</div>
      ${verdict}
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

/* ---------- 录入 / 编辑（复用同一表单；editId 有值=编辑模式） ---------- */
let editId = null;
function openEntry(){
  editId = null;
  const t = document.getElementById('eTitle'); if(t) t.textContent = '添加物品';
  const b = document.getElementById('eSaveBtn'); if(b) b.textContent = '保存';
  const n = document.getElementById('eEditNote'); if(n) n.style.display = 'none';
  ['e-name', 'e-price', 'e-brand', 'e-life-custom'].forEach(i => { const el = document.getElementById(i); if(el) el.value = ''; });
  const dEl = document.getElementById('e-date'); if(dEl) dEl.value = isoDate();
  document.querySelectorAll('#e-life span').forEach(s => s.classList.toggle('on', s.dataset.y === '1'));
  chooseCat(selCat); updatePreview();
  showScreen('scr-entry');
}
function openEdit(id){
  const it = ITEMS.find(x => x.id === id);
  if(!it) return;
  editId = id;
  const t = document.getElementById('eTitle'); if(t) t.textContent = '编辑物品';
  const b = document.getElementById('eSaveBtn'); if(b) b.textContent = '保存修改';
  const n = document.getElementById('eEditNote'); if(n) n.style.display = '';
  document.getElementById('e-name').value = it.name;
  document.getElementById('e-price').value = it.price;
  document.getElementById('e-date').value = it.date;
  document.getElementById('e-brand').value = it.brand || '';
  chooseCat(it.cat);
  // 年限：命中快捷 chip 则高亮，否则填入自定义框
  const hit = document.querySelector(`#e-life span[data-y="${it.life}"]`);
  document.querySelectorAll('#e-life span').forEach(s => s.classList.remove('on'));
  const cust = document.getElementById('e-life-custom');
  if(hit){ hit.classList.add('on'); cust.value = ''; } else { cust.value = it.life; }
  updatePreview();
  showScreen('scr-entry');
}
function backFromEntry(){
  if(editId != null){ const id = editId; editId = null; openDetail(id); }
  else showScreen('scr-list');
}
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
  if(editId != null){
    // 编辑分支：原地更新，保留 id / 归档状态 / archivedAt；emoji 随分类联动
    const it = ITEMS.find(x => x.id === editId);
    if(it){
      it.name = name;
      it.brand = document.getElementById('e-brand').value.trim();
      it.price = price; it.date = date; it.life = getLife();
      it.cat = selCat; it.emoji = EMOJI[selCat] || '📦';
    }
    const id = editId; editId = null;
    renderChips(); renderList();
    openDetail(id);
    return;
  }
  ITEMS.unshift({id:nextId++, name, brand:document.getElementById('e-brand').value.trim(),
    price, date, life:getLife(), cat:selCat, emoji:EMOJI[selCat] || '📦', archived:false});
  curCat = '全部'; renderChips(); renderList();
  showScreen('scr-list');
}

/* ---------- 统计 ---------- */
let rankMode = 'burn';   // 排行榜：burn=烧钱(日均最贵) / value=最值(日均最低) / held=持有最久 / brand=品牌
let cumUnit = 'month';   // 累计总资产：month=月度 / year=年度
function setRankMode(m){
  rankMode = m;
  document.querySelectorAll('#rankSeg span').forEach(s => s.classList.toggle('on', s.dataset.m === m));
  const el = document.getElementById('rankBody'); if(el) el.innerHTML = rankRowsHTML();
}
function setCumUnit(u){
  cumUnit = u;
  document.querySelectorAll('#cumSeg span').forEach(s => s.classList.toggle('on', s.dataset.u === u));
  const el = document.getElementById('cumBody'); if(el) el.innerHTML = cumAssetSVG();
}
function rankRowsHTML(){
  const act = activeItems();
  if(!act.length) return '<div class="empty">暂无数据</div>';
  if(rankMode === 'burn' || rankMode === 'value'){
    const rows = [...act].sort((a, b) => rankMode === 'burn' ? daily(b) - daily(a) : daily(a) - daily(b)).slice(0, 5);
    const mx = Math.max(...rows.map(it => daily(it)), 1e-9);
    const col = rankMode === 'burn' ? 'var(--accent)' : '#07C160';
    return rows.map(it => { const d0 = daily(it);
      return `<div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${Math.max(d0 / mx * 100, 4)}%;background:${col}"></i></span><span class="pc"${rankMode === 'value' ? ` style="color:${col}"` : ''}>${fmt(d0)}<small>/天</small></span></div>`; }).join('');
  }
  if(rankMode === 'held'){
    const rows = [...act].sort((a, b) => held(b) - held(a)).slice(0, 5);
    const mx = Math.max(...rows.map(it => held(it)), 1);
    return rows.map(it => { const hd = held(it);
      return `<div class="rank"><span class="nm">${esc(it.name)}</span><span class="bar"><i style="width:${hd / mx * 100}%;background:var(--accent)"></i></span><span class="pc">${hd.toLocaleString('zh-CN')} 天</span></div>`; }).join('');
  }
  // brand：按品牌聚合总价 Top5
  const byBrand = {};
  act.forEach(it => { const b = it.brand || '未填品牌'; byBrand[b] = byBrand[b] || {price: 0, n: 0}; byBrand[b].price += it.price; byBrand[b].n++; });
  const rows = Object.keys(byBrand).map(b => ({b, price: byBrand[b].price, n: byBrand[b].n})).sort((a, b2) => b2.price - a.price).slice(0, 5);
  const mx = Math.max(...rows.map(r2 => r2.price), 1);
  return rows.map(r2 =>
    `<div class="rank"><span class="nm">${esc(r2.b)}</span><span class="bar"><i style="width:${r2.price / mx * 100}%;background:var(--accent)"></i></span><span class="pc">${fmt0(r2.price)}<small>${r2.n} 件</small></span></div>`).join('');
}
// 累计总资产（原价口径，不含归档）：月度=按购买月累计，年度=按购买年累计
function cumAssetSVG(){
  const act = activeItems();
  if(!act.length) return '<div class="empty">暂无数据</div>';
  const first = new Date(Math.min(...act.map(i => new Date(i.date).getTime())));
  const keys = [], add = {};
  if(cumUnit === 'month'){
    let y = first.getFullYear(), m = first.getMonth();
    while(y < TODAY.getFullYear() || (y === TODAY.getFullYear() && m <= TODAY.getMonth())){
      keys.push(y + '-' + String(m + 1).padStart(2, '0'));
      m++; if(m > 11){ m = 0; y++; }
    }
    act.forEach(it => { const k = it.date.slice(0, 7); add[k] = (add[k] || 0) + it.price; });
  } else {
    for(let y = first.getFullYear(); y <= TODAY.getFullYear(); y++) keys.push(String(y));
    act.forEach(it => { const k = String(new Date(it.date).getFullYear()); add[k] = (add[k] || 0) + it.price; });
  }
  let cum = 0;
  const vals = keys.map(k => (cum += (add[k] || 0)));
  const W = 340, H = 165, PL = 42, PR = 14, PT = 18, PB = 22;
  const vMax = Math.max(...vals, 1);
  const sx = i => PL + (keys.length === 1 ? 0 : i / (keys.length - 1)) * (W - PL - PR);
  const sy = v => PT + (1 - v / vMax) * (H - PT - PB);
  const pts = vals.map((v, i) => sx(i).toFixed(1) + ',' + sy(v).toFixed(1)).join(' ');
  const grid = [vMax, Math.round(vMax / 2)].map(v =>
    `<line x1="${PL}" y1="${sy(v)}" x2="${W - PR}" y2="${sy(v)}" stroke="#F0EEE8"/>` +
    `<text x="${PL - 6}" y="${(sy(v) + 3).toFixed(1)}" text-anchor="end" font-size="9.5" fill="#B5B2A9">${v >= 10000 ? (v / 10000).toFixed(1) + '万' : fmt0(v)}</text>`).join('');
  let xlabels = '';
  if(cumUnit === 'month'){
    keys.forEach((k, i) => { if(k.endsWith('-01')) xlabels += `<text x="${sx(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9.5" fill="#9A9A93">${k.slice(0, 4)}</text>`; });
  } else {
    keys.forEach((k, i) => { xlabels += `<text x="${sx(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9.5" fill="#9A9A93">${k}</text>`; });
  }
  const n = vals.length - 1;
  const endDot = `<circle cx="${sx(n).toFixed(1)}" cy="${sy(vals[n]).toFixed(1)}" r="3.5" fill="#111"/>` +
    `<text x="${(sx(n) - 4).toFixed(1)}" y="${(sy(vals[n]) - 8).toFixed(1)}" text-anchor="end" font-size="10" font-weight="700" fill="#111">${fmt0(vals[n])}</text>`;
  const dots = cumUnit === 'year'
    ? vals.map((v, i) => `<circle cx="${sx(i).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="3" fill="#111"/>`).join('') : '';
  return `<svg class="svg-box" viewBox="0 0 ${W} ${H}">${grid}<polyline points="${pts}" fill="none" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>${dots}${endDot}${xlabels}</svg>`;
}
function renderStats(){
  const act = activeItems();
  const totalAssets = act.reduce((s, it) => s + it.price, 0);
  const totalDaily  = act.reduce((s, it) => s + daily(it), 0);
  const avgHeld = act.length ? Math.round(act.reduce((s, it) => s + held(it), 0) / act.length) : 0;
  // 月结条：本月新增 / 本月归档
  const m = TODAY.getMonth() + 1, y = TODAY.getFullYear();
  const mKey = `${y}-${String(m).padStart(2, '0')}`;
  const mNew = act.filter(it => it.date.startsWith(mKey)).length;
  const mArch = ITEMS.filter(i => i.archived && i.archivedAt && i.archivedAt.startsWith(mKey)).length;
  // 分类分布：按总价倒序，每行同时显示 总价+件数+占比（无切换控件）
  const byPrice = {}, byCount = {};
  act.forEach(it => { byPrice[it.cat] = (byPrice[it.cat] || 0) + it.price; byCount[it.cat] = (byCount[it.cat] || 0) + 1; });
  const catRows = Object.keys(byPrice).map(c => ({c, price: byPrice[c], count: byCount[c] || 0})).sort((a, b) => b.price - a.price);
  const maxCat = Math.max(...catRows.map(r => r.price), 1);
  const catVal = r => `${fmt(r.price)}<small>${r.count} 件 · ${(r.price / (totalAssets || 1) * 100).toFixed(0)}%</small>`;
  // 排行榜分段切换（4 榜）
  const seg = [['burn', '烧钱'], ['value', '最值'], ['held', '最久'], ['brand', '品牌']]
    .map(([k, t]) => `<span data-m="${k}" class="${rankMode === k ? 'on' : ''}" onclick="setRankMode('${k}')">${t}</span>`).join('');
  const cumSeg = [['month', '月度'], ['year', '年度']]
    .map(([k, t]) => `<span data-u="${k}" class="${cumUnit === k ? 'on' : ''}" onclick="setCumUnit('${k}')">${t}</span>`).join('');
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
      <div class="month-strip"><span>📅 本月（${mKey}）</span><b>新增 ${mNew} 件 · 归档 ${mArch} 件</b></div>
    </div>
    <div class="card">
      <div class="sec-title">分类分布</div>
      ${catRows.map(r => `<div class="catbar">
        <span class="nm">${EMOJI[r.c] || '📦'} ${r.c}</span>
        <span class="bar"><i style="width:${r.price / maxCat * 100}%"></i></span>
        <span class="vl">${catVal(r)}</span>
      </div>`).join('')}
    </div>
    <div class="card">
      <div class="sec-title">排行榜</div>
      <div class="seg" id="rankSeg">${seg}</div>
      <div id="rankBody">${rankRowsHTML()}</div>
    </div>
    <div class="card">
      <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span>累计总资产（原价）</span>
        <span class="seg seg-sm" id="cumSeg">${cumSeg}</span>
      </div>
      <div id="cumBody">${cumAssetSVG()}</div>
      <div class="chart-foot">在册物品原价的累计总和，不含已归档物品。</div>
    </div>
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
