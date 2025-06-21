# Web批量下载助手 🚀

一个功能强大的Chrome扩展，用于智能批量下载网页内容。支持页面扫描和网络监听双重获取方式，提供实时文件预览和智能过滤功能。

## ✨ 主要功能

### 🌐 三种下载模式
- **整页下载**: 一键下载当前页面所有图片、视频和文档
- **区域选择**: 精确选择页面特定区域进行下载  
- **平台优化**: 针对小红书等平台的智能识别和优化下载

### 🎯 双重文件获取技术
- **页面扫描**: 分析DOM结构，获取页面上显示的所有媒体文件
- **网络监听**: 实时监听网络请求，捕获动态加载的MP4、图片等媒体文件
- **智能合并**: 自动识别重复文件，避免重复下载
- **实时更新**: 网络文件持续刷新，确保获取最新内容

### 🔍 智能过滤系统
- **两级过滤架构**:
  - **一级过滤**: [全部] [页面文件] [网络文件] - 按文件来源分类
  - **二级过滤**: [全部类型] [图片] [视频] [文档] - 按文件类型筛选
- **时间追踪**: 显示文件获取时间(HH:MM格式)，按时间排序
- **文件统计**: 实时显示各类型文件数量
- **来源标识**: 清晰标识文件来源(页面/网络/重复)

### 🎛️ 文件预览功能
- **实时预览**: 边扫描边显示，无需等待
- **批量操作**: 支持全选、反选、清除全部
- **重新获取**: 一键刷新文件列表，获取最新内容
- **智能排序**: 按获取时间排序，新文件优先显示
- **响应式布局**: 适配不同屏幕尺寸

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
4. 点击开始下载，自动打开预览页面
5. 使用两级过滤系统筛选需要的文件
6. 批量选择后点击下载

### 高级功能
- **网络监听**: 预览页面自动启用，无需手动开关
- **实时刷新**: 网络文件每3秒自动更新
- **时间过滤**: 根据获取时间筛选文件
- **重新获取**: 点击刷新按钮重新扫描页面
- **清除功能**: 一键清除所有文件重新开始

## 📁 项目结构

```
WebDownUtils/
├── manifest.json                    # 扩展配置文件(含webRequest权限)
├── README.md                        # 项目说明
├── LICENSE                          # 许可证
├── src/                            # 源代码目录
│   ├── popup/                      # 弹窗界面
│   │   ├── popup.html             # 弹窗HTML
│   │   ├── popup.css              # 弹窗样式
│   │   └── popup.js               # 弹窗逻辑
│   ├── content/                    # 内容脚本
│   │   ├── content.js             # 页面扫描+预览面板+过滤系统
│   │   └── content.css            # 内容脚本样式
│   ├── background/                 # 后台服务
│   │   └── background.js          # 网络监听+下载管理+后台逻辑
│   └── strategies/                 # 平台策略
│       └── platform-strategies.js # 平台优化策略
├── assets/                         # 静态资源
│   ├── icons/                     # 图标文件
│   └── styles/                    # 公共样式（预留）
└── docs/                          # 项目文档
    └── 安装指南.md                 # 安装指南
```

## 🎨 技术架构

- **Manifest V3**: 采用最新的Chrome扩展规范
- **webRequest API**: 实现网络请求监听功能
- **模块化设计**: 功能模块独立，易于维护和扩展
- **平台策略模式**: 支持不同平台的专门优化
- **响应式UI**: 现代化的用户界面设计
- **实时通信**: background与content script高效消息传递

## 🔧 开发说明

### 核心模块
- **popup**: 扩展弹窗界面，下载模式选择和设置配置
- **content**: 页面内容扫描、预览面板、两级过滤系统
- **background**: 网络监听、文件管理、下载处理
- **strategies**: 不同平台的优化策略

### 关键技术特性
- **网络监听**: 使用webRequest API监听所有网络请求
- **文件去重**: 智能识别页面文件和网络文件的重复项
- **实时更新**: 定时器机制确保网络文件持续刷新
- **两级过滤**: 来源过滤 + 类型过滤的双重筛选机制
- **时间追踪**: 为每个文件记录获取时间并排序

### 添加新平台支持
1. 在 `src/strategies/platform-strategies.js` 中添加新的策略类
2. 实现 `scanPage(settings)` 方法
3. 在 `PlatformStrategies` 类中注册新策略

## 🛡️ 隐私安全

- 所有数据在本地处理，不上传到服务器
- 网络监听仅用于文件发现，不记录敏感信息
- 仅在用户操作时访问页面内容
- 下载的文件直接保存到用户指定位置
- 设置信息使用Chrome同步存储

## 📄 许可证

本项目采用 Apache License 2.0 许可证，详见 [LICENSE](LICENSE) 文件。

```
Copyright 2024 WebDownUtils

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

---

📖 更多详细信息请查看 [docs/](docs/) 文件夹中的文档。 