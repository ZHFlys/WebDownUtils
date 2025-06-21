# Web批量下载助手 🚀

一个功能强大的Chrome扩展，用于智能批量下载网页内容。支持页面扫描和网络监听双重获取方式，提供实时文件预览和智能过滤功能。

## ✨ 主要功能

### 🌐 两种下载模式
- **整页下载**: 一键下载当前页面所有图片、视频和文档
- **区域选择**: 精确选择页面特定区域进行下载  

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

### ⚙️ 智能设置
- **保存路径**: 自定义下载文件夹
- **文件命名**: 支持原名、时间戳前缀、序号前缀
- **文件夹管理**: 可选择按网站创建分类文件夹
- **下载限制**: 设置最大文件数量和单文件大小限制

## 🎮 使用方法

### 快速开始
1. 安装扩展后，访问任意网页
2. 点击扩展图标打开控制面板
3. 选择下载模式：
   - **整页下载**: 直接点击开始下载
   - **区域选择**: 点击后在页面上选择特定区域

### 预览模式
1. 在设置页面点击"预览文件"
2. 查看实时文件预览面板
3. 使用两级过滤系统筛选文件
4. 选择需要的文件后点击下载

### 高级设置
- 自定义保存路径和文件命名规则
- 设置下载限制避免过多文件
- 开启文件夹分类管理

## 📁 项目结构

```
WebDownUtils/
├── manifest.json                   # 扩展清单文件  
├── src/
│   ├── popup/                      # 扩展弹窗
│   │   ├── popup.html             # 弹窗页面
│   │   ├── popup.css              # 弹窗样式
│   │   └── popup.js               # 弹窗逻辑
│   ├── content/                    # 内容脚本
│   │   ├── content.js             # 页面扫描+预览面板+过滤系统
│   │   └── content.css            # 内容脚本样式
│   └── background/                 # 后台服务
│       └── background.js          # 网络监听+下载管理+后台逻辑
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
- **响应式UI**: 现代化的用户界面设计
- **实时通信**: background与content script高效消息传递

## 🔧 开发说明

### 核心模块
- **popup**: 扩展弹窗界面，下载模式选择和设置配置
- **content**: 页面内容扫描、预览面板、两级过滤系统
- **background**: 网络监听、文件管理、下载处理

### 关键技术特性
- **网络监听**: 使用webRequest API监听所有网络请求
- **文件去重**: 智能识别页面文件和网络文件的重复项
- **实时更新**: 定时器机制确保网络文件持续刷新
- **两级过滤**: 来源过滤 + 类型过滤的双重筛选机制
- **时间追踪**: 为每个文件记录获取时间并排序

## 🚀 安装指南

### 开发版安装
1. 下载或克隆项目到本地
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录

### 构建检查
```bash
cd WebDownUtils
node scripts/build.js
```

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