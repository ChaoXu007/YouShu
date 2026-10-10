/* 有数 · 核心逻辑单元测试（node:test，无需额外依赖）
   运行：node --test test/   或   node --test test/core.test.js
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../web/core.js');

// 固定「今天」，保证时间相关测试可重现
const T = new Date('2026-07-09T00:00:00');
const daysBefore = (n) => new Date(T.getTime() - n * 86400000);
const iso = (d) => core.isoDate(d);

test('uid: 返回字符串且全局唯一', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(core.uid());
  assert.equal(ids.size, 1000, '1000 次生成应全部唯一');
  // Node 22 提供 globalThis.crypto.randomUUID，格式应为标准 uuid
  assert.match(core.uid(), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, '应为标准 uuid v4 格式');
});

test('分类体系：单一数据源，数量/顺序/高频子集正确', () => {
  const keys = Object.keys(core.EMOJI);
  assert.equal(keys.length, 10, '应有 10 个分类');
  // v2: 按分组排列，常用组 6 类 + 生活组 3 类 + 其它组 1 类
  assert.deepEqual(keys, ['数码', '家电', '服饰', '美妆', '家居', '运动', '汽车', '会员', '珠宝', '其它'], '顺序应与展示顺序一致');
  assert.equal(core.CATS.length, 10, 'CATS 派生应同为 10');
  // 高频分类（常用组）应是总分类的子集，且顺序为指定 6 类
  assert.deepEqual(core.COMMON_CATS, ['数码', '家电', '服饰', '美妆', '家居', '运动']);
  core.COMMON_CATS.forEach(c => assert.ok(core.EMOJI[c], `高频分类 ${c} 必须在 EMOJI 中`));
});

test('分类 v2：分组 + 稳定 ID + 迁移', () => {
  // 内置分组 3 个
  assert.equal(core.BUILTIN_GROUPS.length, 3, '应有 3 个内置分组');
  assert.deepEqual(core.BUILTIN_GROUPS.map(g => g.id), ['grp-common', 'grp-life', 'grp-other']);
  assert.ok(core.BUILTIN_GROUPS.every(g => g.builtin), '内置分组 builtin=true');

  // 内置分类 10 个，每个有稳定 id 和 groupId
  assert.equal(core.BUILTIN_CATS.length, 10, '应有 10 个内置分类');
  assert.ok(core.BUILTIN_CATS.every(c => c.id && c.groupId && c.builtin), '每个内置分类有 id/groupId/builtin');

  // 名称 → id 映射
  assert.equal(core.CAT_NAME_TO_ID['数码'], 'cat-shuma');
  assert.equal(core.CAT_NAME_TO_ID['其它'], 'cat-qita');

  // 迁移：旧版 cat 字符串 → catId
  const old = [{ id:'1', cat:'数码', emoji:'📱', name:'test', price:100, date:'2024-01-01', life:1 }];
  const migrated = core.migrateItems(old);
  assert.equal(migrated[0].catId, 'cat-shuma', 'cat 应迁移为 catId');
  assert.ok(!migrated[0].cat && !migrated[0].emoji, '旧 cat/emoji 字段应删除');
  // 未知分类 → cat-qita
  const unknown = [{ id:'2', cat:'不存在的分类', name:'x', price:1, date:'2024-01-01', life:1 }];
  assert.equal(core.migrateItems(unknown)[0].catId, 'cat-qita', '未知分类归入 cat-qita');
  // 已迁移的不重复处理
  const done = [{ id:'3', catId:'cat-shuma', name:'y', price:1, date:'2024-01-01', life:1 }];
  assert.equal(core.migrateItems(done)[0].catId, 'cat-shuma', '已迁移保持不变');

  // mergeCats: 按 id 合并，本地优先
  const localG = [{ id:'grp-a', name:'A', builtin:true, order:0 }];
  const localC = [{ id:'cat-1', name:'C1', emoji:'📱', groupId:'grp-a', builtin:true, order:0 }];
  const incG = [{ id:'grp-a', name:'A-imported', builtin:false, order:0 }, { id:'grp-b', name:'B', builtin:false, order:1 }];
  const incC = [{ id:'cat-1', name:'C1-imported', emoji:'💻', groupId:'grp-a', builtin:false, order:0 }, { id:'cat-2', name:'C2', emoji:'🚗', groupId:'grp-b', builtin:false, order:0 }];
  const merged = core.mergeCats(localG, localC, incG, incC);
  assert.equal(merged.groups.length, 2, '合并后 2 个分组');
  assert.equal(merged.groups.find(g => g.id === 'grp-a').name, 'A', '本地分组优先');
  assert.equal(merged.cats.length, 2, '合并后 2 个分类');
  assert.equal(merged.cats.find(c => c.id === 'cat-1').name, 'C1', '本地分类优先');

  // fixItemCatIds: 无效 catId 归入 cat-qita
  const items = [{ id:'x', catId:'cat-shuma' }, { id:'y', catId:'cat-gone' }, { id:'z', catId: undefined }];
  const fixed = core.fixItemCatIds(items, ['cat-shuma']);
  assert.equal(fixed[0].catId, 'cat-shuma', '有效 catId 保持不变');
  assert.equal(fixed[1].catId, 'cat-qita', '无效 catId 归入 cat-qita');
  assert.equal(fixed[2].catId, 'cat-qita', '缺失 catId 归入 cat-qita');
});

test('daysSince / held: 按固定今天计算天数', () => {
  const it = { date: iso(daysBefore(10)), life: 3 };
  assert.equal(core.daysSince(iso(daysBefore(10)), T), 10);
  assert.equal(core.held(it, T), 10);
  // 未来日期 -> 0（Math.max 防护）
  const future = { date: iso(new Date(T.getTime() + 5 * 86400000)), life: 3 };
  assert.equal(core.held(future, T), 0);
});

test('daily: 日均价格 = 购入价 / 持有天数', () => {
  const it = { date: iso(daysBefore(10)), price: 1000, life: 3 };
  assert.equal(core.daily(it, T), 100); // 1000 / 10
  // 未持有（0 天）不除零，返回 0
  const zero = { date: iso(new Date(T.getTime() + 86400000)), price: 100, life: 3 };
  assert.equal(core.daily(zero, T), 0);
});

test('loss: 时间维度损耗率，上限截断 100%', () => {
  // life=2, held=365 -> 50%
  const l50 = { date: iso(daysBefore(365)), price: 1, life: 2, archived: false };
  assert.equal(core.loss(l50, T), 50);
  // life=1, held=292 -> 80%
  const l80 = { date: iso(daysBefore(292)), price: 1, life: 1, archived: false };
  assert.equal(core.loss(l80, T), 80);
  // 远超上限 -> 截断 100
  const over = { date: iso(daysBefore(9999)), price: 1, life: 1, archived: false };
  assert.equal(core.loss(over, T), 100);
  // 未持有 -> 0
  const zero = { date: iso(new Date(T.getTime() + 86400000)), price: 1, life: 1, archived: false };
  assert.equal(core.loss(zero, T), 0);
});

test('remain: 剩余天数，下限 0', () => {
  const it = { date: iso(daysBefore(10)), price: 1, life: 1 }; // 1年=365天，已持10
  assert.equal(core.remain(it, T), 355);
  const old = { date: iso(daysBefore(9999)), price: 1, life: 1 };
  assert.equal(core.remain(old, T), 0);
});

test('refDate / 归档冻结: archived 按 archivedAt 冻结，未归档按今天', () => {
  const archived = { date: iso(daysBefore(2000)), archived: true, archivedAt: iso(daysBefore(100)) };
  // 冻结：refDate 应是 archivedAt 这一日历日（用 isoDate 比日历日，避免时区瞬间比较）
  assert.equal(core.isoDate(core.refDate(archived, T)), iso(daysBefore(100)));
  // 冻结后持有天数 = 购入到归档（2000 - 100 = 1900 天），不再随时间增长
  assert.equal(core.held(archived, T), 1900);

  const active = { date: iso(daysBefore(2000)), archived: false };
  assert.equal(core.isoDate(core.refDate(active, T)), '2026-07-09');
  assert.equal(core.held(active, T), 2000);
});

test('lossColor: 阈值配色 <50 绿 / 50~80 黄 / 80~100 红', () => {
  assert.equal(core.lossColor(0), '#07C160');
  assert.equal(core.lossColor(49), '#07C160');
  assert.equal(core.lossColor(50), '#F2C037');
  assert.equal(core.lossColor(79), '#F2C037');
  assert.equal(core.lossColor(80), '#EF4B4B');
  assert.equal(core.lossColor(100), '#EF4B4B');
});

test('isoDate: 输出 YYYY-MM-DD', () => {
  assert.equal(core.isoDate(new Date(2026, 0, 5)), '2026-01-05'); // 月份 0 基
  assert.equal(core.isoDate(new Date(2026, 11, 31)), '2026-12-31');
});

test('fmt / esc: 金额格式化与 HTML 转义', () => {
  assert.equal(core.fmt(1234.5), '¥1,234.50');
  assert.equal(core.esc('<b>&x</b>'), '&lt;b&gt;&amp;x&lt;/b&gt;');
  assert.equal(core.esc(''), '');
});

test('fmtPrice: 卡片价格短格式（≥1000 无小数，<1000 两位小数）', () => {
  assert.equal(core.fmtPrice(12999), '¥12,999');
  assert.equal(core.fmtPrice(1000), '¥1,000', '边界 1000 恰好无小数');
  assert.equal(core.fmtPrice(999.5), '¥999.50');
  assert.equal(core.fmtPrice(0), '¥0.00');
  assert.equal(core.fmtPrice(128999.99), '¥129,000', '大额四舍五入到整数');
});

test('activeItems: 过滤已归档物品', () => {
  const items = [
    { id: '1', archived: false },
    { id: '2', archived: true },
    { id: '3', archived: false },
  ];
  assert.deepEqual(core.activeItems(items).map(i => i.id), ['1', '3']);
});

test('MAX_ITEMS: 本地容量硬上限', () => {
  assert.equal(core.MAX_ITEMS, 10000);
});

test('mergeImport: 按 id 覆盖、新增、保留本机独有，并校验上限', () => {
  const current = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ];
  const incoming = [
    { id: 'a', name: 'A2' }, // 覆盖
    { id: 'c', name: 'C' },  // 新增
  ];
  const m = core.mergeImport(current, incoming);
  assert.equal(m.overwritten.length, 1, '应识别 1 件覆盖');
  assert.equal(m.added.length, 1, '应识别 1 件新增');
  assert.equal(m.result.length, 3, '合并后应共 3 件');
  assert.equal(m.exceeds, false);
  const byId = Object.fromEntries(m.result.map(i => [i.id, i]));
  assert.equal(byId['a'].name, 'A2', 'id=a 应被导入值覆盖');
  assert.equal(byId['b'].name, 'B', '本机独有 b 应保留');
  assert.equal(byId['c'].name, 'C', '导入独有 c 应新增');

  // 上限校验：当前 10000 + 导入 1 = 10001 > 上限
  const big = [];
  for (let i = 0; i < 10000; i++) big.push({ id: 'x' + i });
  const over = core.mergeImport(big, [{ id: 'y1' }]);
  assert.equal(over.exceeds, true, '超过 MAX_ITEMS 应标记 exceeds');
  assert.equal(over.result.length, 10001);
});
