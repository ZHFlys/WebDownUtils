# WebDownUtils - 智能批量下载助手 🚀

一个功能强大的Chrome扩展，专为高效批量下载网页内容而设计。支持页面扫描和网络监听双重获取技术，提供实时文件预览、智能过滤和多种下载模式。

## ✨ 核心特性

### 🎯 双重文件获取技术
- **页面扫描**: 深度分析DOM结构，识别所有显示的媒体文件
- **网络监听**: 实时监听网络请求，捕获动态加载的文件
- **智能合并**: 自动去重，避免重复下载同一文件
- **持续更新**: 网络文件实时刷新，确保获取最新内容

### 🌐 多种下载模式
- **整页下载**: 一键下载当前页面所有文件
- **区域选择**: 精确选择页面特定区域进行下载
- **小红书专属**: 专门优化的小红书图片/视频下载模式

### 🔍 四级智能过滤系统
1. **来源过滤**: [全部] [页面文件] [网络文件]
2. **类型过滤**: [全部类型] [图片] [视频] [音频] [文档]
3. **大小过滤**: [全部大小] [小文件<1MB] [中文件1-10MB] [大文件>10MB] [自定义范围]
4. **格式过滤**: 支持JPG/PNG/GIF/WebP/MP4/WebM/MP3/WAV/PDF等具体格式筛选

### 📊 高级排序功能
- **排序方式**: 按时间、大小、名称、类型排序
- **排序顺序**: 升序/降序可选
- **时间追踪**: 精确记录文件获取时间(HH:MM格式)

### 🎛️ 实时预览面板
- **网格布局**: 图片文件采用卡片网格展示，支持缩略图预览
- **列表布局**: 非图片文件采用详细列表展示
- **即时预览**: 点击图片/视频可即时预览，无需下载
- **批量操作**: 支持全选、反选、清除全部操作
- **拖拽窗口**: 预览面板支持拖拽移动和折叠功能

### 💾 多种下载方式
- **智能下载**: 根据文件数量自动选择直接下载或打包下载
- **ZIP打包**: 多文件自动打包为ZIP压缩包
- **链接列表**: 生成文本文件保存所有文件链接
- **Markdown文档**: 生成带预览的Markdown文档
- **Python脚本**: 生成Python批量下载代码
- **批处理脚本**: 生成Windows BAT批处理文件
- **cURL脚本**: 生成Shell/Bash下载脚本

### 🎨 专属平台优化
- **小红书模式**: 专门优化的小红书内容获取
- **视频监听**: 实时监听视频文件加载
- **图片识别**: 智能过滤头像等无关小图片
- **动态内容**: 支持动态加载的内容获取

## 🎮 使用指南

### 快速开始
1. 点击扩展图标打开控制面板
2. 选择下载模式：
   - **整页扫描**: 扫描当前页面所有文件
   - **区域选择**: 点击后在页面上选择特定区域
   - **小红书专属**: 专门用于小红书内容下载

### 预览模式详解
1. 点击"预览文件"按钮进入预览模式
2. 系统会显示实时文件预览面板，包含：
   - 网络监听提示（持续监听中...）
   - 四级过滤系统（来源→类型→大小→格式）
   - 排序选项（时间/大小/名称/类型，升序/降序）
   - 批量操作按钮（全选/全不选/重新获取/清除全部）

### 文件筛选技巧
- **来源筛选**: 区分页面静态文件和网络动态文件
- **类型筛选**: 快速定位特定类型文件
- **大小筛选**: 避免下载过小的图标或过大的文件
- **格式筛选**: 精确匹配需要的文件格式
- **自定义范围**: 设置精确的文件大小范围（支持KB/MB/GB单位）

### 下载模式选择
- **智能下载**: 系统根据设置的阈值自动选择下载方式
- **打包下载**: 多文件自动压缩为ZIP包
- **脚本生成**: 生成各种平台的批量下载脚本
- **链接导出**: 保存文件链接供后续使用

## ⚙️ 高级设置

### 下载配置
- **保存路径**: 自定义下载文件夹
- **文件命名**: 支持原名、时间戳前缀、序号前缀
- **文件夹管理**: 可选择按网站创建分类文件夹
- **下载限制**: 设置最大文件数量和单文件大小限制
- **智能阈值**: 配置自动打包的文件数量阈值
- **下载延迟**: 设置文件间下载间隔，避免请求过快

### 过滤配置
- **格式筛选开关**: 可选择是否显示格式筛选功能
- **大小估算**: 智能估算文件大小，提供筛选参考
- **时间追踪**: 记录文件获取时间，支持时间排序

## 📁 项目架构

```
WebDownUtils/
├── manifest.json                   # 扩展清单文件(Manifest V3)
├── src/
│   ├── popup/                      # 扩展弹窗界面
│   │   ├── popup.html             # 主界面布局
│   │   ├── popup.css              # 现代化样式设计
│   │   └── popup.js               # 交互逻辑和设置管理
│   ├── content/                    # 内容脚本
│   │   ├── content.js             # 核心功能模块(4377行)
│   │   │                          # - 页面扫描引擎
│   │   │                          # - 区域选择器
│   │   │                          # - 实时预览面板
│   │   │                          # - 四级过滤系统
│   │   │                          # - 小红书专属模式
│   │   └── content.css            # 预览面板样式
│   ├── background/                 # 后台服务
│   │   └── background.js          # 网络监听+下载管理
│   ├── libs/                       # 第三方库
│   │   └── jszip.min.js           # ZIP压缩功能
│   └── strategies/                 # 下载策略(预留)
├── assets/                         # 静态资源
│   ├── icons/                     # 多尺寸图标(32/48/128/256px)
│   └── styles/                    # 公共样式(预留)
├── docs/                          # 项目文档
│   └── 安装指南.md                 # 详细安装说明
├── scripts/                        # 构建脚本
│   ├── build.js                   # 构建检查脚本
│   ├── generate-icons.py          # 图标生成脚本
│   └── requirements.txt           # Python依赖
├── LICENSE                         # Apache 2.0许可证
└── README.md                      # 项目说明文档
```

## 🔧 技术实现

### 核心技术栈
- **Manifest V3**: 最新Chrome扩展标准
- **webRequest API**: 网络请求监听
- **JSZip**: 客户端ZIP压缩
- **Chrome Storage API**: 设置同步存储
- **Chrome Downloads API**: 文件下载管理

### 关键算法
- **文件去重算法**: 基于URL的智能去重机制
- **大小估算算法**: 根据文件类型和尺寸智能估算文件大小
- **实时更新机制**: 3秒间隔的网络文件刷新
- **响应式布局**: 自适应不同屏幕尺寸的界面设计

### 性能优化
- **并行下载**: 支持多文件并行下载
- **内存管理**: 大文件流式处理，避免内存溢出
- **网络优化**: 智能请求头设置，提高下载成功率
- **UI优化**: 虚拟滚动和懒加载提升大量文件展示性能

## 🌍 支持的文件类型

### 图片格式
- **常见格式**: JPG, JPEG, PNG, GIF, WebP, SVG
- **高级格式**: AVIF, HEIC(部分支持)
- **特殊处理**: CSS背景图片、data:URL图片

### 视频格式  
- **网页视频**: MP4, WebM, AVI, MOV, MKV
- **流媒体**: M3U8, DASH(部分支持)
- **特殊处理**: HTML5 video标签、source元素

### 音频格式
- **无损格式**: WAV, FLAC, APE
- **有损格式**: MP3, AAC, OGG, M4A, WMA
- **特殊处理**: HTML5 audio标签、链接音频文件

### 文档格式
- **办公文档**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- **压缩文件**: ZIP, RAR, 7Z, TAR, GZ
- **文本文件**: TXT, RTF, CSV

## 🚀 安装指南

### 开发版安装
1. 下载项目源码到本地
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目根目录 `WebDownUtils`
6. 安装完成，开始使用！

### 兼容性检查
```bash
# 检查项目完整性
cd WebDownUtils
node scripts/build.js

# 生成图标(可选)
python scripts/generate-icons.py
```

### 浏览器支持
- ✅ **Chrome 88+** (推荐) - 完整功能支持
- ✅ **Edge 88+** - 完整功能支持
- ✅ **Brave 1.20+** - 完整功能支持
- ⚠️ **Opera 74+** - 基本功能支持
- ❌ **Firefox** - 需要WebExtensions转换

## 🛡️ 隐私与安全

### 数据处理原则
- **本地处理**: 所有数据在本地处理，不上传服务器
- **最小权限**: 仅请求必要的浏览器权限
- **透明监听**: 网络监听仅用于文件发现，不记录敏感信息
- **用户控制**: 所有功能均需用户主动触发

### 安全特性
- **权限控制**: 基于Chrome扩展安全模型
- **数据加密**: 设置信息使用Chrome同步存储
- **沙盒隔离**: content script与页面脚本隔离运行
- **HTTPS优先**: 优先处理HTTPS协议的文件

## 🔧 开发指南

### 本地开发
```bash
# 克隆项目
git clone https://github.com/your-repo/WebDownUtils.git
cd WebDownUtils

# 安装Python依赖(图标生成)
pip install -r scripts/requirements.txt

# 检查项目结构
node scripts/build.js

# 加载到Chrome进行测试
# chrome://extensions/ -> 开发者模式 -> 加载已解压的扩展程序
```

### 代码结构
- **popup.js**: 弹窗界面逻辑，设置管理
- **content.js**: 核心功能模块，包含所有主要功能
- **background.js**: 后台服务，网络监听和下载管理
- **content.css**: 预览面板和UI组件样式

### 扩展开发
- 新增文件类型支持：修改 `scanXXX()` 方法
- 新增过滤条件：扩展 `getFilteredPreviewFiles()` 方法  
- 新增下载模式：添加 `generateXXXScript()` 方法
- 新增平台支持：创建专属的获取策略

## 🤝 贡献指南

### 如何贡献
1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用ES6+语法
- 遵循Chrome扩展最佳实践
- 添加必要的注释和文档
- 确保代码通过构建检查

### 问题反馈
- 🐛 Bug报告：使用Issue模板描述问题
- 💡 功能建议：详细说明需求和使用场景
- 📖 文档改进：欢迎改进文档和示例

## 📄 开源协议

本项目采用 **Apache License 2.0** 开源协议。

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

## 🌟 致谢

感谢所有为本项目做出贡献的开发者和用户！

### 技术致谢
- [JSZip](https://stuk.github.io/jszip/) - 客户端ZIP压缩库
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/) - 浏览器扩展API
- [Material Design Icons](https://material.io/icons/) - 图标设计参考

---

📖 更多详细信息请查看 [docs/安装指南.md](docs/安装指南.md) 获取完整安装说明。

🚀 立即开始使用WebDownUtils，体验智能批量下载的便捷！ 