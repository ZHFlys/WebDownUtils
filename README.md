# Web批量下载助手 🚀

一个功能强大的Chrome扩展，用于智能批量下载网页内容，支持多种下载模式和平台优化。

## ✨ 主要功能

### 🌐 三种下载模式
- **整页下载**: 一键下载当前页面所有图片、视频和文档
- **区域选择**: 精确选择页面特定区域进行下载  
- **平台优化**: 针对小红书等平台的智能识别和优化下载

### 🎯 特定平台支持
- **小红书**: 专门优化的扫描策略，支持获取原图
- **微博**: 智能识别微博内容
- **Instagram**: 社交媒体内容下载
- **Pinterest**: 图片批量下载
- **通用网站**: 兼容所有网站

### ⚙️ 智能设置
- **保存路径**: 自定义下载文件夹
- **文件命名**: 支持原名、时间戳前缀、序号前缀
- **文件夹管理**: 可按网站自动创建文件夹
- **下载限制**: 设置最大文件数和文件大小限制
- **文件类型**: 选择性下载图片、视频、文档

## 🚀 快速开始

### 🌐 浏览器支持
- ✅ **Chrome/Edge/Brave** (推荐) - 使用 `manifest.json`
- ✅ **Firefox** - 使用 `manifest-firefox.json`

### Chrome/Edge 安装步骤
1. 打开Chrome/Edge浏览器，进入 `chrome://extensions/` 或 `edge://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录
5. 开始使用！

### Firefox 安装步骤
1. 打开Firefox浏览器，进入 `about:debugging`
2. 点击"此 Firefox"
3. 点击"临时载入附加元件"
4. 选择项目中的 `manifest-firefox.json` 文件
5. 开始使用！

📖 详细安装指南：[多浏览器安装指南](docs/安装指南.md)

### 基础使用
1. 点击浏览器工具栏的扩展图标
2. 选择下载模式：整页、区域选择或平台优化
3. 配置下载选项（图片、视频、文档）
4. 点击开始下载

## 📁 项目结构

```
WebDownUtils/
├── manifest.json                    # 扩展配置文件
├── README.md                        # 项目说明
├── LICENSE                          # 许可证
├── src/                            # 源代码目录
│   ├── popup/                      # 弹窗界面
│   │   ├── popup.html             # 弹窗HTML
│   │   ├── popup.css              # 弹窗样式
│   │   └── popup.js               # 弹窗逻辑
│   ├── content/                    # 内容脚本
│   │   ├── content.js             # 页面扫描脚本
│   │   └── content.css            # 内容脚本样式
│   ├── background/                 # 后台服务
│   │   └── background.js          # 后台逻辑
│   └── strategies/                 # 平台策略
│       └── platform-strategies.js # 平台优化策略
├── assets/                         # 静态资源
│   ├── icons/                     # 图标文件
│   └── styles/                    # 公共样式（预留）
└── docs/                          # 项目文档
    ├── README.md                  # 详细说明文档
    ├── 安装指南.md                 # 安装指南
    └── 项目总结.md                 # 项目总结
```

## 🎨 技术架构

- **Manifest V3**: 采用最新的Chrome扩展规范
- **模块化设计**: 功能模块独立，易于维护和扩展
- **平台策略模式**: 支持不同平台的专门优化
- **响应式UI**: 现代化的用户界面设计

## 🔧 开发说明

### 文件职责
- `src/popup/`: 扩展弹窗界面相关文件
- `src/content/`: 页面内容扫描和交互
- `src/background/`: 后台下载管理和生命周期
- `src/strategies/`: 不同平台的优化策略
- `assets/`: 样式等静态资源
- `docs/`: 项目文档和说明

### 添加新平台支持
1. 在 `src/strategies/platform-strategies.js` 中添加新的策略类
2. 实现 `scanPage(settings)` 方法
3. 在 `PlatformStrategies` 类中注册新策略

## 🛡️ 隐私安全

- 所有数据在本地处理，不上传到服务器
- 仅在用户操作时访问页面内容
- 下载的文件直接保存到用户指定位置
- 设置信息使用Chrome同步存储

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

---

📖 更多详细信息请查看 [docs/](docs/) 文件夹中的文档。 