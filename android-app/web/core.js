/* ============================================================
   有数 · 核心逻辑层（纯函数，无 DOM 依赖）
   - UMD 模式：浏览器 <script> 暴露全局 YS_CORE；Node 端 require 使用
   - 与微信小程序共享同一套量化模型 / 分类 / 上限规则
   - 所有时间相关函数接受可选 today 参数，便于单元测试固定「今天」
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.YS_CORE = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 常量 ---------- */
  // 本地容量硬上限（可靠性防护，非商业额度）
  const MAX_ITEMS = 10000;

  // ===== 分类体系 v2：分组 + 分类（稳定 ID，支持自定义） =====
  // 内置分组（3 个，不可删除，可改名/调序）
  const BUILTIN_GROUPS = [
    { id:'grp-common', name:'常用', builtin:true,  order:0 },
    { id:'grp-life',   name:'生活', builtin:true,  order:1 },
    { id:'grp-other',  name:'其它', builtin:true,  order:2 },
  ];
  // 内置分类（10 个，不可删除，可改名/改图标/调序/换组）
  // 顺序即展示顺序（组内按 order，组间按 group order）
  const BUILTIN_CATS = [
    // 常用组
    { id:'cat-shuma',    name:'数码', emoji:'📱', icon:null, groupId:'grp-common', builtin:true, order:0 },
    { id:'cat-jiadian',  name:'家电', emoji:'🔌', icon:null, groupId:'grp-common', builtin:true, order:1 },
    { id:'cat-fushi',    name:'服饰', emoji:'👕', icon:null, groupId:'grp-common', builtin:true, order:2 },
    { id:'cat-meizhuang',name:'美妆', emoji:'💄', icon:null, groupId:'grp-common', builtin:true, order:3 },
    { id:'cat-jiaju',    name:'家居', emoji:'🛋️', icon:null, groupId:'grp-common', builtin:true, order:4 },
    { id:'cat-yundong',  name:'运动', emoji:'⚽', icon:null, groupId:'grp-common', builtin:true, order:5 },
    // 生活组
    { id:'cat-qiche',    name:'汽车', emoji:'🚗', icon:null, groupId:'grp-life',   builtin:true, order:0 },
    { id:'cat-huiyuan',  name:'会员', emoji:'🎫', icon:null, groupId:'grp-life',   builtin:true, order:1 },
    { id:'cat-zhubao',   name:'珠宝', emoji:'💍', icon:null, groupId:'grp-life',   builtin:true, order:2 },
    // 其它组
    { id:'cat-qita',     name:'其它', emoji:'📦', icon:null, groupId:'grp-other',  builtin:true, order:0 },
  ];
  // 旧数据迁移：cat 名称 → catId
  const CAT_NAME_TO_ID = {};
  BUILTIN_CATS.forEach(c => { CAT_NAME_TO_ID[c.name] = c.id; });

  // ===== 向后兼容派生（旧代码/旧测试仍可用） =====
  const EMOJI = {};
  BUILTIN_CATS.forEach(c => { EMOJI[c.name] = c.emoji; });
  const CATS = BUILTIN_CATS.map(c => ({ key: c.name, emoji: c.emoji }));
  const COMMON_CATS = BUILTIN_CATS.filter(c => c.groupId === 'grp-common').map(c => c.name);

  /* ---------- 分类迁移（v1 cat 字符串 → v2 catId） ---------- */
  function migrateItems(items) {
    return items.map(it => {
      if (it.catId) return it;   // 已迁移
      const m = Object.assign({}, it);
      m.catId = CAT_NAME_TO_ID[it.cat] || 'cat-qita';
      delete m.cat;
      delete m.emoji;
      return m;
    });
  }

  /* ---------- 分类配置合并（导入时） ---------- */
  // 按 id 合并分组与分类：冲突时本地优先，导入独有的追加
  function mergeCats(localGroups, localCats, incGroups, incCats) {
    const groupMap = {};
    localGroups.forEach(g => { groupMap[g.id] = g; });
    incGroups.forEach(g => { if (!groupMap[g.id]) groupMap[g.id] = g; });
    const catMap = {};
    localCats.forEach(c => { catMap[c.id] = c; });
    incCats.forEach(c => { if (!catMap[c.id]) catMap[c.id] = c; });
    return {
      groups: Object.values(groupMap).sort((a, b) => (a.order || 0) - (b.order || 0)),
      cats: Object.values(catMap).sort((a, b) => (a.order || 0) - (b.order || 0)),
    };
  }

  // 修复物品引用的 catId：不存在则归入「其它」
  function fixItemCatIds(items, validCatIds) {
    const set = new Set(validCatIds);
    return items.map(it => {
      if (!it.catId || !set.has(it.catId)) {
        return Object.assign({}, it, { catId: 'cat-qita' });
      }
      return it;
    });
  }

  /* ---------- 唯一 ID（为未来云同步预留 uuid） ---------- */
  function uid() {
    const g = (typeof globalThis !== 'undefined') ? globalThis
      : (typeof window !== 'undefined') ? window : {};
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    return 'id-' + Date.now().toString(16) + Math.random().toString(16).slice(2);
  }

  /* ---------- 量化计算 ---------- */
  // 归档物品按「归档日」冻结统计；未归档按今天
  function refDate(it, today) {
    today = today || new Date();
    return (it.archived && it.archivedAt) ? new Date(it.archivedAt) : today;
  }
  function parseYMD(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    return { y: +m[1], mo: +m[2] - 1, d: +m[3] };
  }
  // 日历天数差：两端都按「本地 Y/M/D」归一化到 UTC 零点再相减，
  // 规避 'YYYY-MM-DD' 被当 UTC 解析、与本地 now 相减产生的时区偏移（如 UTC+8 差 1 天边界）
  function daysSince(d, ref) {
    ref = ref || new Date();
    const a = parseYMD(d);
    if (!a) return 0;
    const bY = ref.getFullYear(), bMo = ref.getMonth(), bD = ref.getDate();
    const ms = Date.UTC(bY, bMo, bD) - Date.UTC(a.y, a.mo, a.d);
    return Math.max(0, Math.floor(ms / 86400000));
  }
  function held(it, today) { return daysSince(it.date, refDate(it, today)); }
  // 日均使用价格 = 购入价 / 已持有天数（未持有按 0）
  function daily(it, today) { const h = held(it, today); return h ? it.price / h : 0; }
  // 损耗率（时间维度）= 已持有天数 / (预计年限 * 365)，截断 100%
  function loss(it, today) {
    return Math.min(100, Math.round(held(it, today) / (it.life * 365) * 100));
  }
  // 剩余天数（不补满，下限 0）
  function remain(it, today) { return Math.max(0, it.life * 365 - held(it, today)); }

  function isoDate(d) {
    const x = d || new Date();
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  function fmt(n) {
    return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // 卡片价格短格式：≥1000 千分位无小数（列表看量级），<1000 沿用 fmt 两位小数
  function fmtPrice(n) {
    n = Number(n);
    return n >= 1000
      ? '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
      : fmt(n);
  }
  function esc(s) {
    return (s || '').toString().replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  // 损耗进度条配色：<50% 绿 / 50%~80% 黄 / 80%~100% 红
  function lossColor(l) {
    return l < 50 ? '#07C160' : (l < 80 ? '#F2C037' : '#EF4B4B');
  }
  // 未归档物品
  function activeItems(items) { return items.filter(i => !i.archived); }

  /* ---------- 导入合并（覆盖按 id，本机有导入没有的保留） ---------- */
  // 纯函数：输入当前列表与导入列表，返回合并结果、覆盖/新增清单、是否超出上限
  function mergeImport(current, incoming) {
    const map = {};
    current.forEach(it => { map[it.id] = it; });
    const overwritten = [], added = [];
    incoming.forEach(it => {
      if (map[it.id]) overwritten.push({ old: map[it.id], neu: it });
      else added.push(it);
    });
    const merged = {};
    current.forEach(it => { merged[it.id] = it; });
    incoming.forEach(it => { merged[it.id] = it; });
    const result = Object.values(merged);
    const exceeds = result.length > MAX_ITEMS;
    return { result, overwritten, added, exceeds };
  }

  return {
    MAX_ITEMS,
    // 分类 v2
    BUILTIN_GROUPS, BUILTIN_CATS, CAT_NAME_TO_ID,
    migrateItems, mergeCats, fixItemCatIds,
    // 向后兼容派生
    EMOJI, CATS, COMMON_CATS,
    uid, refDate, daysSince, held, daily, loss, remain,
    isoDate, fmt, fmtPrice, esc, lossColor, activeItems, mergeImport
  };
}));
