# 有数 (YouShu)

> **你的物品，心里有数。**

「有数」是一款**个人物品管理**工具，主打极简录入 + 自动量化「日均使用价格 / 损耗率 / 持有时间」，帮你用数据掌控自己的每一件物品。

## 当前形态

- **Web 高保真原型**（`prototype/`，含 v1–v4 多版视觉对比，定稿方向为 v4「极简墨」），可直接用浏览器打开 `prototype/v4.html` 预览。
- **安卓 APK**（`android-app/`，Capacitor 壳 + v4 UI），可在本机安卓手机自测。

> 注：v1 为**纯本地存储 + 导出/导入**，不含云端同步与订阅；云同步与订阅作为架构扩展点预留，未来同版本上线。

## 目录结构

```
YouShu/
├── docs/                     # 产品设计 / 架构方案文档
│   ├── 个人物品管理小程序_产品调研报告.md
│   ├── 个人物品管理小程序_产品定位与MVP规划.md
│   ├── 小程序技术架构方案.md
│   └── 安卓技术架构方案.md
├── prototype/                # Web 高保真原型（v1–v4 视觉对比 + 设计探索稿）
│   └── archive/              # 已弃用的探索稿
├── android-app/              # 安卓 APK 工程（Capacitor）
│   ├── web/                  # 前端应用源码（Capacitor 的 webDir）
│   ├── android/              # 原生安卓工程（构建产物已 gitignore）
│   ├── test/                 # 核心逻辑单测（node --test）
│   ├── capacitor.config.json
│   └── install.bat / install.sh
├── AGENTS.md                 # 项目约定与设计铁律（开发必读）
├── README.md
└── LICENSE
```

## 本地开发

Web 原型可直接用浏览器打开 `prototype/v4.html` 预览，无需任何构建。

### 构建安卓 APK

前置：Node、JDK 17、Android SDK（本机已配好，详见 `docs/安卓技术架构方案.md`）。

```bash
cd android-app
npm install
npx cap sync            # 将 web/ 同步进原生工程
gradle -p android assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

或用一键脚本（需手机 USB 调试已开启）：

```bash
bash android-app/install.sh      # 或双击 android-app/install.bat
```

### 核心逻辑测试

```bash
cd android-app && node --test
```

## 文档

- [产品调研报告](docs/个人物品管理小程序_产品调研报告.md)
- [产品定位与 MVP 规划](docs/个人物品管理小程序_产品定位与MVP规划.md)
- [小程序技术架构方案](docs/小程序技术架构方案.md)
- [安卓技术架构方案](docs/安卓技术架构方案.md)

## License

[MIT](LICENSE)
