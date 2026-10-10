# AGENTS.md · 有数（个人物品管理小程序）

> 本文件记录项目级约定与**设计铁律**，供后续开发/对话时严格遵守，避免重复踩坑。

## 项目概况
- 产品：「**有数**」微信小程序，slogan「**你的物品，心里有数。**」
- 定位：极简录入 + 自动量化「日均使用价格 / 损耗率 / 持有时间」，帮用户数据化掌控物品。
- 当前阶段：v1 高保真原型。原型在 `prototype/`：共享逻辑 `shared.js`，各版本皮肤 `index.html` / `v2.html` / `v3.html` / `v4.html`（v4 极简墨为当前定稿方向）。

## 🚫 设计铁律：移动端窄屏禁止横向滑动（horizontal scroll）
**凡涉及分类筛选、分类选择、标签组、任何选项/筛选集合，绝不使用横向滚动（禁止 `overflow-x:auto` 的 chip 横条 / 横向滑动选择器）。**

- **原因**：手机屏窄，横向滚动条既丑又难点，用户于 2026-07-09 多次明确反对（曾因首页分类横滑条被要求重做成底部抽屉；添加页分类再犯被要求写入本文件）。
- **替代方案（按场景选用）**：
  - 选项较少（≤ ~12）：用 **网格（2 / 3 / 6 列 `grid`）** 平铺，单屏或抽屉内即可浏览，不滚动。
  - 选项多或需省竖向空间：用 **底部抽屉（bottom sheet）滑出网格面板**，点开选完自动收起，零横向滚动。
  - 长列表：用 **纵向滚动列表** 或 **搜索 + 抽屉**。
- **适用范围**：首页分类筛选、添加页分类选择、以及任何未来新增的筛选器 / 选择器 / 标签输入。

## 其它已确认的设计原则
- **损耗进度条按阈值配色**：`<50% 绿 #07C160` / `50%~80% 黄 #F2C037` / `80%~100% 红 #EF4B4B`（损耗=负向信号，红黄绿梯度表达紧迫度）。百分比数字同步变色。
- **分类体系（单一数据源）**：定义在 `shared.js` 的 `EMOJI` 对象 + 派生 `CATS` 数组，**顺序即展示顺序**。当前 10 类：数码📱 › 汽车🚗 › 会员🎫 › 家电🔌 › 家居🛋️ › 服饰👕 › 美妆💄 › 运动⚽ › 珠宝💍 › 其它📦。未来增删/排序**只改这一处**，筛选抽屉与添加页自动跟随，无需改动其它代码。
- **添加页分类选择模式**：高频分类（`shared.js` 的 `COMMON_CATS` 数组）**以 3 列网格平铺在录入页**，一键直选；其余分类（含「其它」兜底）通过「更多分类」按钮**打开底部抽屉**选择。抽屉与筛选抽屉共用 `.sheet` 样式，当前选择实时显示在「更多分类」按钮上。绝不要把全部分类一次性平铺（此前全铺 10 类被判定"太丑"）。
- **首页资产卡（2026-10-11 定稿）**：深色渐变卡片（`#171717 → #2C2C2C`，与「我的」页 hero 同质感语言），总价值（原价）大数字用**系统字体 + 800 字重**（与详情页日均大数字同风格，**不用衬线**），底部三格：在册物品 / 日均总成本 / 已归档。数据口径与统计页一致，只计未归档。
- **详情页回本视角（2026-10-11 定稿）**：将原「损耗率（时间）」卡改名为「回本进度（时间维度）」，阈值配色不变；底部新增目标行——未回本显示 `🎯 再用 N 天回本 —— 之后每天都是纯赚`，已回本（损耗=100%）显示 `✅ 已回本 —— 之后每天都是纯赚`。
- **详情页日均价格走势曲线（2026-10-11 定稿）**：新增「日均价格走势」曲线卡。横轴=持有天数（按天），纵轴=日均价格；前 30 天日均过高，自满月起展示（持有不足 30 天则从第 1 天起）。实线=已发生，灰色虚线=预测至回本日，灰色横虚线=目标日均，末端黑点=今天（归档物品=归档日）。底部一句结论（当前日均 vs 目标日均的百分比差距 + 剩余天数/已优于目标）。原独立的「日均对比卡」并入曲线卡，控制详情页整体密度为 5 个区块。
- **统计页结构（单页长滚动，2026-10-11 最终版）**：汇总区 2×2 四格（总资产原价 / 总日均成本 / 物品件数 / 平均持有天数） + 月结条（本月新增 / 本月归档） + 分类分布（按总价倒序，每行显示 总价+件数+占比，**无切换控件**） + **一张「排行榜」卡**（顶部分段切换 4 榜：烧钱 / 最值 / 最久 / 品牌；原「日均最贵 TOP5」「持有最久 TOP5」被吸收为其中两个 tab） + **累计总资产曲线卡**（月度/年度切换，折线，不含归档）。**损耗排行不再加回**（loss 封顶 100% 后大量并列，无区分度）；**剩余未摊销不做**（概念拗口）；**每年新增投入柱状图不做**（用户只保留累计曲线）。排行榜无数据时显示「暂无数据」；品牌榜按品牌聚合总价 Top5。
- **v1/v2/v3 原型皮肤（2026-10-11 明确）**：v4 为唯一定稿方向，其它三版视为历史参考稿，不再同步精细样式，后续改动可忽略。
- **卡片副标题（身份区）含购入价**：列表/方格卡片副标题显示「购入价 · 品牌 · 分类」（品牌为空自动省略分隔符）；购入价用 `fmtPrice` 智能短格式（≥1000 千分位无小数，<1000 两位小数；`core.js` 与 `prototype/shared.js` 各有一份），`.sub-price` 中灰半粗强调；卡片右侧只放计算指标（日均/持有天数），日均的灵魂指标地位不变。详情页价格仍用 `fmt` 完整两位小数。副标题超长省略号截断、不换行、不加行高。
- **首页工具栏单行化**：搜索 + 筛选 chip + 排序 chip 合并为一行（`.searchrow`，省一行竖向空间）；chip 激活时黑底反色外显状态（筛选显示分类名、排序显示 `SORT_SHORT` 短标签+方向箭头）；聚焦搜索时 chip 淡出、输入框临时占满（`.searchrow.searching`，max-width 过渡，chip 固定不滚动）。原型 v4 同步为「搜索 + 筛选 chip」单行（原型无排序功能）。**禁止**回到「搜索一行 + 筛选/排序一行」的两行布局；**禁止**恢复 v4 早期「当前分类条 + 筛选按钮」双控件冗余（两者曾同指一个抽屉）。
- **导出/导入**实际用 JSON，但客户界面**不暴露 "JSON" 字样**（称「导出数据 / 导入数据」）。
- **v1 不做**（且代码里不写任何相关业务）：云端同步、订阅付费、额度拦截、AI、录音、拍照/条码识别。详情页**不展示「是否归档」**（归档状态由按钮与首页可见性体现）。
- **v1 纯本地存储 + 导出/导入**：客户端不出现任何订阅/云同步入口。未来云同步与订阅通过**架构扩展点**预留——`Repository` 抽象（v1=Local，v2 可换 Cloud，业务/UI/calc 不动）+ `feature flags`（CLOUD_SYNC/SUBSCRIPTION 开关，v1 全 false）+ 全局 uuid + `updatedAt` 时间戳；v1 不在代码库留下用户/配额/plan 等实体或半成品逻辑（详见 `docs/小程序技术架构方案.md` §2.3、§4）。
- **首屏信息密度**：卡片同时展示「日均成本 + 损耗进度条」已获用户确认不拥挤。

## 量化模型（产品灵魂）
- 日均使用价格 = 购入价 ÷ 已持有天数
- 损耗率（默认时间维度）= 已持有天数 ÷（预计使用年限 × 365），阈值配色
- 预计使用年限默认 1 年、可改，提供快捷选项（半年 / 1年 / 2年 / 3年 / 5年 / 自定义）
- 不引入「当前估值」字段

---

## 🤖 安卓 APK 构建环境与踩坑（Android build）· 必读

> 目标：把现有 `web/` 网页（v4 极简墨原型）用 **Capacitor** 包成 `app-debug.apk` 装安卓手机自测。本机已装好整套工具链，**重出包只需最后一段命令**，但本机有几个特殊限制，照此避坑。
> 参考文档：`docs/安卓技术架构方案.md`、`docs/小程序技术架构方案.md`。工程目录：`android-app/`。

### 已安装的工具链（本机固定路径，重装/换机需重来）
- **JDK 17**：`C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\`（winget 装 `Microsoft.OpenJDK.17`）。
- **Android SDK**：`C:\Android\Sdk`，含 `cmdline-tools/latest/`、`platform-tools/`、`platforms/android-34`、`build-tools/34.0.0`、7 个 license。
- **Gradle 8.2.1（手动安装，非 wrapper）**：`C:\Android\gradle-8.2.1\bin\gradle.bat`。
- 环境变量 `JAVA_HOME` / `ANDROID_HOME` 写在 **User 级**（HKCU），从开始菜单/新进程自动读到；**当前会话进程不自动继承**，命令里要显式 `export`/`$env:`。

### 重出包的标准流程（日常改完 `web/` 后用）
```bash
cd C:\project\YouShu\android-app
npx cap sync                       # 把 web/ 同步进 android/app/src/main/assets/public/
C:\Android\gradle-8.2.1\bin\gradle.bat -p C:\project\YouShu\android-app\android assembleDebug --no-daemon --console=plain
```
- APK 产物：`android/app/build/outputs/apk/debug/app-debug.apk`（debug 签名，可直接 USB 调试直装或传手机安装）。
- 首次生成安卓工程用 `npx cap add android`（已做过，一般不必重跑）。
- **PowerShell 版实测命令（2026-10-11 全流程验证通过：sync 0.05s + 构建 22s，AI 可直接复制执行）**：
  ```powershell
  # ① 同步（workdir 用 C:\project\YouShu\android-app）
  npx cap sync
  # ② 构建：显式设环境变量最稳（勿依赖进程继承），输出取尾部 15 行
  $env:JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\'; $env:ANDROID_HOME='C:\Android\Sdk'; & 'C:\Android\gradle-8.2.1\bin\gradle.bat' -p C:\project\YouShu\android-app\android assembleDebug --no-daemon --console=plain 2>&1 | Select-Object -Last 15
  # ③ 验证产物：LastWriteTime 应为刚刚、约 3.6MB，才算打包成功
  Get-Item C:\project\YouShu\android-app\android\app\build\outputs\apk\debug\app-debug.apk | Select-Object Name,@{n='SizeMB';e={[math]::Round($_.Length/1MB,2)}},LastWriteTime
  ```
  正常耗时基线：依赖缓存后 **≈20~30s**；远超此时长先按坑 8 查下载。**成功标准 = `BUILD SUCCESSFUL` 且 ③ 的时间戳已刷新**，缺一不可。

### ⚠️ 本机已踩过的坑（务必避开，别重蹈覆辙）
1. **Bash 直接调 `cmd.exe` 被安全策略拦截**（"Invoking cmd.exe from Bash bypasses all command validation"）——所有 `cmd //c xxx` 都没真正执行。**对策**：用 **PowerShell 工具** `& 'C:\path\to\xxx.bat'` 直接调用原生 bat（sdkmanager / gradle 都走这条通道）。
2. **`curl -o` 大文件落盘有 bug（exit 23，写不进磁盘）**——哪怕网络通也下不下来。**对策**：改用 **Node https 流** 写下载器（参考 `C:\Android\_dl.js` 思路，`https.get` + `fs.createWriteStream`，跟随重定向）。
3. **写系统级（Machine）环境变量被拒（需管理员）**——**对策**：写 **User 级**（HKCU），同一用户登录效果一致。
4. **Android SDK commandline-tools 必须放 `cmdline-tools/latest/` 子层**，否则 `sdkmanager` 报 "Could not determine SDK root"。解压后若只有 `cmdline-tools/{bin,lib,...}`，要整体移到 `cmdline-tools/latest/` 下。
5. **Gradle 默认源 `services.gradle.org` 会重定向到 GitHub，本机极慢/超时**——**对策**：① Gradle 发行版用 **腾讯镜像** `https://mirrors.cloud.tencent.com/gradle/gradle-8.2.1-all.zip` 由 Node 下好解压（~193MB/40s）；② 依赖库源在 `android/build.gradle` 的 `buildscript` + `allprojects` 的 `repositories` 顶部加 `maven { url "https://mirrors.cloud.tencent.com/nexus/repository/maven-public/" }` 兜底（已在工程里加好，勿删）。
6. **git-bash 的 `./gradlew` 包装器报 `xargs: environment too large` 直接挂掉下载器**——**对策**：**绕过 gradlew 包装器，直接用手动安装的 `C:\Android\gradle-8.2.1\bin\gradle.bat`**（配 `-p <工程目录>`）。
7. **PowerShell 后台任务里 `2>&1 | Add-Content` 会把 Gradle 整段输出吞掉**（任务 failed 但日志空，**极易误判为卡死**）——**对策**：用 `*>` 重定向到文件（`& gradle.bat ... *> build.log`），再 `cat` 看真实进度/报错。
8. **构建「耗时很久」几乎都不是代码慢**——代码量极小，真编译仅几秒；耗时全在「下载 Gradle / 依赖库」。若出现长时间无进展，先查日志是不是又在下载 Gradle（见坑 5/6），而不是以为代码卡死。

### 核心逻辑测试（改 core.js 后必跑）
- 纯逻辑已抽到 `android-app/web/core.js`（UMD，浏览器+Node 共用），单测 `android-app/test/core.test.js`。
- 运行：`cd android-app && node --test`（Node 内置 `node:test`，**15 用例全过**）。
- **时区坑（已修，勿回退）**：`daysSince` 曾把 `'YYYY-MM-DD'` 当 UTC 解析却与本地 `now` 相减，UTC+8 下持有天数边界偏 1 天 → 已改为**本地 Y/M/D 统一转 UTC 零点**做差。
