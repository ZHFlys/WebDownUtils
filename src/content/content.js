// 内容脚本 - 负责页面扫描和区域选择
class ContentScanner {
    constructor() {
        this.isSelectionMode = false;
        this.selectionOverlay = null;
        this.selectionBox = null;
        this.startX = 0;
        this.startY = 0;
        this.previewPanel = null;
        this.foundFiles = [];
        this.selectedFiles = [];
        this.currentFilter = 'all';
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.init();
    }
    
    init() {
        this.setupMessageListener();
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'scanPage':
                    this.scanPage(request.settings).then(sendResponse);
                    return true; // 异步响应
                case 'startAreaSelection':
                    this.startAreaSelection();
                    sendResponse({ success: true });
                    break;
                case 'scanWithStrategy':
                    this.scanWithStrategy(request.strategy, request.settings).then(sendResponse);
                    return true;
                case 'showPreview':
                    this.showPreviewPanel(request.files, request.selectedFiles);
                    sendResponse({ success: true });
                    break;
                case 'hidePreview':
                    this.hidePreviewPanel();
                    sendResponse({ success: true });
                    break;
            }
        });
    }
    
    async scanPage(settings) {
        const files = [];
        
        try {
            // 扫描图片
            if (settings.includeImages) {
                const images = this.scanImages();
                files.push(...images);
            }
            
            // 扫描视频
            if (settings.includeVideos) {
                const videos = this.scanVideos();
                files.push(...videos);
            }
            
            // 扫描文档
            if (settings.includeDocuments) {
                const documents = this.scanDocuments();
                files.push(...documents);
            }
            
            return { files: this.filterFiles(files, settings) };
        } catch (error) {
            console.error('页面扫描失败:', error);
            return { files: [], error: error.message };
        }
    }
    
    scanImages() {
        const images = [];
        const imgElements = document.querySelectorAll('img');
        
        imgElements.forEach((img, index) => {
            const src = img.src || img.dataset.src || img.dataset.original;
            if (src && this.isValidUrl(src)) {
                images.push({
                    type: 'image',
                    url: src,
                    name: this.extractFilename(src) || `image_${index}`,
                    element: img,
                    alt: img.alt || '',
                    size: this.getEstimatedSize(img)
                });
            }
        });
        
        // 扫描CSS背景图片
        const elementsWithBg = document.querySelectorAll('*');
        elementsWithBg.forEach((el, index) => {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
                if (match && match[1] && this.isValidUrl(match[1])) {
                    images.push({
                        type: 'image',
                        url: match[1],
                        name: this.extractFilename(match[1]) || `bg_image_${index}`,
                        element: el,
                        size: null
                    });
                }
            }
        });
        
        return images;
    }
    
    scanVideos() {
        const videos = [];
        
        // HTML5 视频
        const videoElements = document.querySelectorAll('video');
        videoElements.forEach((video, index) => {
            const src = video.src || video.currentSrc;
            if (src && this.isValidUrl(src)) {
                videos.push({
                    type: 'video',
                    url: src,
                    name: this.extractFilename(src) || `video_${index}`,
                    element: video,
                    size: this.getEstimatedSize(video)
                });
            }
            
            // 检查source元素
            const sources = video.querySelectorAll('source');
            sources.forEach((source, sourceIndex) => {
                if (source.src && this.isValidUrl(source.src)) {
                    videos.push({
                        type: 'video',
                        url: source.src,
                        name: this.extractFilename(source.src) || `video_${index}_${sourceIndex}`,
                        element: video,
                        size: this.getEstimatedSize(video)
                    });
                }
            });
        });
        
        return videos;
    }
    
    scanDocuments() {
        const documents = [];
        const links = document.querySelectorAll('a[href]');
        
        const docExtensions = [
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 
            'txt', 'rtf', 'zip', 'rar', '7z', 'tar', 'gz'
        ];
        
        links.forEach((link, index) => {
            const href = link.href;
            if (href && this.isValidUrl(href)) {
                const extension = this.getFileExtension(href);
                if (docExtensions.includes(extension.toLowerCase())) {
                    documents.push({
                        type: 'document',
                        url: href,
                        name: this.extractFilename(href) || `document_${index}`,
                        element: link,
                        text: link.textContent.trim(),
                        size: null
                    });
                }
            }
        });
        
        return documents;
    }
    
    async scanWithStrategy(strategy, settings) {
        let files = [];
        
        // 使用平台策略模块
        if (window.PlatformStrategies) {
            const strategiesManager = new window.PlatformStrategies();
            const platformStrategy = strategiesManager.getStrategy(window.location.href);
            files = await platformStrategy.scanPage(settings);
        } else {
            // 降级到默认扫描
            files = await this.scanPage(settings);
        }
        
        return files;
    }
    
    async scanXiaohongshu(settings) {
        const files = [];
        
        try {
            // 小红书特定的选择器
            const imageSelectors = [
                '.note-item img',
                '.note-detail img',
                '.swiper-slide img',
                '.pic-item img',
                '[class*="image"] img',
                '[class*="photo"] img'
            ];
            
            const videoSelectors = [
                '.note-item video',
                '.note-detail video',
                '.swiper-slide video'
            ];
            
            // 扫描图片
            if (settings.includeImages) {
                for (const selector of imageSelectors) {
                    const images = document.querySelectorAll(selector);
                    images.forEach((img, index) => {
                        const src = img.src || img.dataset.src || img.dataset.original;
                        if (src && this.isValidUrl(src)) {
                            // 小红书图片通常有多个尺寸，尝试获取原图
                            const originalSrc = this.getXiaohongshuOriginalImage(src);
                            files.push({
                                type: 'image',
                                url: originalSrc,
                                name: `xiaohongshu_${this.extractFilename(originalSrc) || `image_${index}`}`,
                                element: img,
                                platform: '小红书'
                            });
                        }
                    });
                }
            }
            
            // 扫描视频
            if (settings.includeVideos) {
                for (const selector of videoSelectors) {
                    const videos = document.querySelectorAll(selector);
                    videos.forEach((video, index) => {
                        const src = video.src || video.currentSrc;
                        if (src && this.isValidUrl(src)) {
                            files.push({
                                type: 'video',
                                url: src,
                                name: `xiaohongshu_${this.extractFilename(src) || `video_${index}`}`,
                                element: video,
                                platform: '小红书'
                            });
                        }
                    });
                }
            }
            
            return { files: this.filterFiles(files, settings) };
        } catch (error) {
            console.error('小红书扫描失败:', error);
            return { files: [], error: error.message };
        }
    }
    
    getXiaohongshuOriginalImage(src) {
        // 小红书图片URL优化，获取原图
        if (src.includes('ci.xiaohongshu.com')) {
            // 移除尺寸参数，获取原图
            return src.replace(/\?.*$/, '');
        }
        return src;
    }
    
    startAreaSelection() {
        if (this.isSelectionMode) return;
        
        this.isSelectionMode = true;
        this.createSelectionOverlay();
        this.setupSelectionEvents();
    }
    
    createSelectionOverlay() {
        // 创建遮罩层
        this.selectionOverlay = document.createElement('div');
        this.selectionOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.3);
            z-index: 999999;
            cursor: crosshair;
        `;
        
        // 创建选择框
        this.selectionBox = document.createElement('div');
        this.selectionBox.style.cssText = `
            position: absolute;
            border: 2px dashed #4f46e5;
            background: rgba(79, 70, 229, 0.1);
            pointer-events: none;
            display: none;
        `;
        
        this.selectionOverlay.appendChild(this.selectionBox);
        document.body.appendChild(this.selectionOverlay);
        
        // 添加提示信息
        const tip = document.createElement('div');
        tip.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 10px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 1000000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #333;
        `;
        tip.textContent = '拖拽选择要下载的区域，按ESC取消';
        this.selectionOverlay.appendChild(tip);
    }
    
    setupSelectionEvents() {
        const mouseDown = (e) => {
            if (e.target !== this.selectionOverlay) return;
            
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.selectionBox.style.display = 'block';
            this.selectionBox.style.left = this.startX + 'px';
            this.selectionBox.style.top = this.startY + 'px';
            this.selectionBox.style.width = '0px';
            this.selectionBox.style.height = '0px';
        };
        
        const mouseMove = (e) => {
            if (this.selectionBox.style.display === 'none') return;
            
            const currentX = e.clientX;
            const currentY = e.clientY;
            
            const left = Math.min(this.startX, currentX);
            const top = Math.min(this.startY, currentY);
            const width = Math.abs(currentX - this.startX);
            const height = Math.abs(currentY - this.startY);
            
            this.selectionBox.style.left = left + 'px';
            this.selectionBox.style.top = top + 'px';
            this.selectionBox.style.width = width + 'px';
            this.selectionBox.style.height = height + 'px';
        };
        
        const mouseUp = async (e) => {
            if (this.selectionBox.style.display === 'none') return;
            
            const rect = this.selectionBox.getBoundingClientRect();
            await this.processSelectedArea(rect);
            this.endAreaSelection();
        };
        
        const keyDown = (e) => {
            if (e.key === 'Escape') {
                this.endAreaSelection();
            }
        };
        
        this.selectionOverlay.addEventListener('mousedown', mouseDown);
        this.selectionOverlay.addEventListener('mousemove', mouseMove);
        this.selectionOverlay.addEventListener('mouseup', mouseUp);
        document.addEventListener('keydown', keyDown);
        
        // 保存事件引用以便清理
        this._selectionEvents = { mouseDown, mouseMove, mouseUp, keyDown };
    }
    
    async processSelectedArea(rect) {
        const elements = document.elementsFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );
        
        const files = [];
        
        // 在选择区域内查找元素
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el, index) => {
            const elRect = el.getBoundingClientRect();
            
            // 检查元素是否在选择区域内
            if (this.isElementInArea(elRect, rect)) {
                // 检查图片
                if (el.tagName === 'IMG') {
                    const src = el.src || el.dataset.src;
                    if (src && this.isValidUrl(src)) {
                        files.push({
                            type: 'image',
                            url: src,
                            name: this.extractFilename(src) || `area_image_${index}`,
                            element: el,
                            size: this.getEstimatedSize(el)
                        });
                    }
                }
                
                // 检查视频
                if (el.tagName === 'VIDEO') {
                    const src = el.src || el.currentSrc;
                    if (src && this.isValidUrl(src)) {
                        files.push({
                            type: 'video',
                            url: src,
                            name: this.extractFilename(src) || `area_video_${index}`,
                            element: el,
                            size: this.getEstimatedSize(el)
                        });
                    }
                }
                
                // 检查链接
                if (el.tagName === 'A' && el.href) {
                    const extension = this.getFileExtension(el.href);
                    const docExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
                    if (docExtensions.includes(extension.toLowerCase())) {
                        files.push({
                            type: 'document',
                            url: el.href,
                            name: this.extractFilename(el.href) || `area_doc_${index}`,
                            element: el,
                            size: null
                        });
                    }
                }
            }
        });
        
        // 发送结果到后台
        if (files.length > 0) {
            chrome.runtime.sendMessage({
                action: 'areaSelectionComplete',
                files: files
            });
        } else {
            alert('在选择区域内未找到可下载的文件');
        }
    }
    
    isElementInArea(elRect, areaRect) {
        return !(elRect.right < areaRect.left || 
                 elRect.left > areaRect.right || 
                 elRect.bottom < areaRect.top || 
                 elRect.top > areaRect.bottom);
    }
    
    endAreaSelection() {
        this.isSelectionMode = false;
        
        if (this.selectionOverlay) {
            document.body.removeChild(this.selectionOverlay);
            this.selectionOverlay = null;
            this.selectionBox = null;
        }
        
        // 清理事件监听器
        if (this._selectionEvents) {
            document.removeEventListener('keydown', this._selectionEvents.keyDown);
            this._selectionEvents = null;
        }
    }
    
    filterFiles(files, settings) {
        return files.filter(file => {
            // 文件大小过滤 (这里只是示例，实际需要获取文件大小)
            // const sizeLimit = settings.fileSizeLimit * 1024 * 1024; // MB to bytes
            
            // URL有效性检查
            if (!this.isValidUrl(file.url)) return false;
            
            // 去重
            return true;
        }).slice(0, settings.maxFiles);
    }
    
    isValidUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    extractFilename(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            return filename && filename.includes('.') ? filename : null;
        } catch {
            return null;
        }
    }
    
    getFileExtension(url) {
        const filename = this.extractFilename(url);
        if (!filename) return '';
        
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() : '';
    }
    
    getEstimatedSize(element) {
        if (!element) return null;
        
        // 尝试从元素属性获取尺寸信息
        if (element.tagName === 'IMG') {
            const width = element.naturalWidth || element.width || 0;
            const height = element.naturalHeight || element.height || 0;
            
            if (width && height) {
                // 粗略估算图片大小 (假设每像素3字节)
                return width * height * 3;
            }
        } else if (element.tagName === 'VIDEO') {
            const duration = element.duration || 0;
            const width = element.videoWidth || element.width || 0;
            const height = element.videoHeight || element.height || 0;
            
            if (duration && width && height) {
                // 粗略估算视频大小 (假设中等质量)
                return duration * width * height * 0.1;
            }
        }
        
        return null;
    }
    
    showPreviewPanel(files, selectedFiles) {
        this.foundFiles = files || [];
        this.selectedFiles = selectedFiles || [];
        
        if (this.previewPanel) {
            this.hidePreviewPanel();
        }
        
        this.createPreviewPanel();
        this.updatePreviewContent();
    }
    
    hidePreviewPanel() {
        if (this.previewPanel && this.previewPanel.parentNode) {
            document.body.removeChild(this.previewPanel);
            this.previewPanel = null;
        }
        
        // 移除样式
        const styles = document.getElementById('web-download-preview-styles');
        if (styles) {
            styles.remove();
        }
    }
    
    createPreviewPanel() {
        // 创建主预览面板
        this.previewPanel = document.createElement('div');
        this.previewPanel.id = 'web-download-preview-panel';
        this.previewPanel.className = 'collapsed';
        
        this.previewPanel.innerHTML = `
            <div class="preview-toggle" id="preview-toggle">
                <span class="toggle-icon">📋</span>
                <span class="toggle-text">预览</span>
                <span class="toggle-arrow">▶</span>
            </div>
            
            <div class="preview-content">
                <div class="preview-header" id="preview-header">
                    <div class="preview-title">
                        <span class="preview-icon">📋</span>
                        <h3>文件预览</h3>
                        <span class="drag-handle">⋮⋮</span>
                    </div>
                    <div class="preview-stats">
                        <span id="preview-count">已选择 0 个文件</span>
                    </div>
                </div>
                
                <div class="preview-filters">
                    <div class="filter-group">
                        <button class="filter-btn active" data-filter="all">全部</button>
                        <button class="filter-btn" data-filter="image">图片</button>
                        <button class="filter-btn" data-filter="video">视频</button>
                        <button class="filter-btn" data-filter="document">文档</button>
                    </div>
                    <div class="preview-actions">
                        <button class="action-btn-small" id="select-all-preview">全选</button>
                        <button class="action-btn-small" id="select-none-preview">全不选</button>
                    </div>
                </div>
                
                <div class="file-list-preview" id="file-list-preview">
                    <!-- 文件项会动态添加到这里 -->
                </div>
                
                <div class="preview-footer">
                    <button class="action-btn secondary" id="cancel-download-preview">取消</button>
                    <button class="action-btn primary" id="confirm-download-preview">
                        <span class="btn-icon">⬇️</span>
                        开始下载 (<span id="download-count-preview">0</span>)
                    </button>
                </div>
            </div>

        `;
        
        this.addPreviewStyles();
        document.body.appendChild(this.previewPanel);
        this.setupPreviewEvents();
        
        // 延迟展开动画
        setTimeout(() => {
            this.previewPanel.classList.remove('collapsed');
        }, 100);
    }
    
    addPreviewStyles() {
        if (document.getElementById('web-download-preview-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'web-download-preview-styles';
        styles.textContent = `
                         .preview-toggle {
                 position: absolute;
                 left: -40px;
                 top: 50%;
                 transform: translateY(-50%);
                 background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                 color: white;
                 padding: 12px 8px;
                 border-radius: 8px 0 0 8px;
                 cursor: pointer;
                 writing-mode: vertical-lr;
                 text-orientation: mixed;
                 font-size: 12px;
                 font-weight: 500;
                 display: flex;
                 flex-direction: column;
                 align-items: center;
                 gap: 4px;
                 transition: all 0.3s ease;
                 min-height: 100px;
                 justify-content: center;
                 box-shadow: -2px 0 10px rgba(0, 0, 0, 0.15);
                 z-index: 1;
             }
             
             .preview-toggle:hover {
                 left: -42px;
                 box-shadow: -4px 0 15px rgba(0, 0, 0, 0.2);
             }
             
             .toggle-arrow {
                 font-size: 14px;
                 transition: transform 0.3s ease;
             }
             
             #web-download-preview-panel.collapsed .toggle-arrow {
                 transform: scaleX(-1);
             }

             #web-download-preview-panel {
                 position: fixed;
                 top: 10%;
                 right: 0;
                 width: 480px;
                 height: 80vh;
                 max-height: 90vh;
                 min-height: 400px;
                 min-width: 350px;
                 background: white;
                 border-radius: 12px 0 0 12px;
                 box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
                 z-index: 999999;
                 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                 transition: transform 0.3s ease;
                 overflow: hidden;
                 display: flex;
                 flex-direction: column;
                 resize: none;
             }
             
             #web-download-preview-panel.collapsed {
                 transform: translateX(100%);
             }
            
            .preview-content {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            
            .preview-header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                padding: 16px 20px;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                cursor: move;
                user-select: none;
            }
            
            .preview-title {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            
            .drag-handle {
                font-size: 16px;
                margin-left: 8px;
                opacity: 0.7;
                cursor: move;
            }
            
            .preview-title h3 {
                font-size: 14px;
                font-weight: 600;
                margin: 0;
            }
            
            .preview-icon {
                font-size: 16px;
            }
            
            .preview-stats {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.9);
            }
            
            .preview-filters {
                padding: 16px 20px;
                background: white;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .filter-group {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
            }
            
            .filter-btn {
                padding: 4px 8px;
                border: 1px solid #d1d5db;
                background: white;
                border-radius: 16px;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.3s ease;
                color: #64748b;
                white-space: nowrap;
            }
            
            .filter-btn.active {
                background: #4f46e5;
                border-color: #4f46e5;
                color: white;
            }
            
            .filter-btn:hover:not(.active) {
                background: #f1f5f9;
                border-color: #94a3b8;
            }
            
            .preview-actions {
                display: flex;
                gap: 4px;
            }
            
            .action-btn-small {
                padding: 4px 8px;
                border: 1px solid #d1d5db;
                background: white;
                border-radius: 4px;
                font-size: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                color: #64748b;
                white-space: nowrap;
            }
            
            .action-btn-small:hover {
                background: #f1f5f9;
                border-color: #94a3b8;
            }
            
            .file-list-preview {
                flex: 1;
                overflow-y: auto;
                background: white;
                padding: 16px;
                min-height: 200px;
            }
            
            .file-list-preview::-webkit-scrollbar {
                width: 6px;
            }
            
            .file-list-preview::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 3px;
            }
            
            .file-list-preview::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 3px;
            }
            
            .file-list-preview::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
            
                         .file-item-preview {
                 border: 1px solid #e2e8f0;
                 border-radius: 8px;
                 background: white;
                 transition: all 0.3s ease;
                 overflow: hidden;
                 margin-bottom: 12px;
             }
             
             .file-item-preview:hover {
                 border-color: #4f46e5;
                 box-shadow: 0 2px 8px rgba(79, 70, 229, 0.1);
                 transform: translateY(-1px);
             }
             
             .file-item-preview:last-child {
                 margin-bottom: 0;
             }
             
             /* 图片网格容器 */
             .images-grid {
                 display: grid;
                 grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                 gap: 12px;
                 margin-bottom: 16px;
             }
             
             /* 图片卡片样式 */
             .file-item-preview.image-card {
                 margin-bottom: 0;
                 display: flex;
                 flex-direction: column;
                 height: 200px;
             }
             
             .image-checkbox {
                 display: flex;
                 align-items: center;
             }
             
             .image-checkbox input[type="checkbox"] {
                 width: 16px;
                 height: 16px;
                 cursor: pointer;
                 background: rgba(255, 255, 255, 0.9);
                 border-radius: 3px;
                 appearance: none;
                 border: 2px solid #d1d5db;
                 position: relative;
                 transition: all 0.3s ease;
             }
             
             .image-checkbox input[type="checkbox"]:checked {
                 background: #4f46e5;
                 border-color: #4f46e5;
             }
             
             .image-checkbox input[type="checkbox"]:checked::after {
                 content: '✓';
                 position: absolute;
                 color: white;
                 font-size: 10px;
                 top: 50%;
                 left: 50%;
                 transform: translate(-50%, -50%);
             }
             
             .image-thumbnail {
                 width: 100%;
                 height: 120px;
                 overflow: hidden;
                 cursor: pointer;
                 position: relative;
                 background: #f8fafc;
                 display: flex;
                 align-items: center;
                 justify-content: center;
             }
             
             .image-thumbnail:hover {
                 opacity: 0.9;
             }
             
             .image-thumbnail img {
                 width: 100%;
                 height: 100%;
                 object-fit: cover;
             }
             
             .image-error {
                 font-size: 24px;
                 color: #ef4444;
             }
             
             .image-info {
                 padding: 8px;
                 display: flex;
                 flex-direction: column;
                 gap: 4px;
                 flex: 1;
             }
             
             .image-name {
                 font-size: 12px;
                 font-weight: 500;
                 color: #1e293b;
                 line-height: 1.3;
                 overflow: hidden;
                 text-overflow: ellipsis;
                 white-space: nowrap;
             }
             
             .image-url {
                 font-size: 10px;
                 color: #64748b;
                 line-height: 1.2;
                 overflow: hidden;
                 text-overflow: ellipsis;
                 white-space: nowrap;
             }
             
             .image-actions {
                 display: flex;
                 align-items: center;
                 justify-content: space-between;
                 margin-top: 4px;
             }
             
             .image-action-buttons {
                 display: flex;
                 align-items: center;
                 gap: 6px;
             }
             
             .file-size {
                 font-size: 10px;
                 color: #64748b;
             }
             
             /* 非图片文件列表样式 */
             .file-item-preview.list-item {
                 display: flex;
                 align-items: center;
                 padding: 12px 16px;
                 gap: 12px;
             }
             
             .file-thumbnail {
                 width: 60px;
                 height: 60px;
                 border-radius: 6px;
                 overflow: hidden;
                 cursor: pointer;
                 border: 2px solid #e2e8f0;
                 transition: all 0.3s ease;
                 flex-shrink: 0;
             }
             
             .file-thumbnail:hover {
                 border-color: #4f46e5;
                 transform: scale(1.05);
             }
             
             .file-thumbnail img {
                 width: 100%;
                 height: 100%;
                 object-fit: cover;
             }
            
                         .file-checkbox-preview {
                 flex-shrink: 0;
             }
            
            .file-checkbox-preview input[type="checkbox"] {
                appearance: none;
                width: 14px;
                height: 14px;
                border: 2px solid #d1d5db;
                border-radius: 3px;
                position: relative;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .file-checkbox-preview input[type="checkbox"]:checked {
                background: #4f46e5;
                border-color: #4f46e5;
            }
            
            .file-checkbox-preview input[type="checkbox"]:checked::after {
                content: '✓';
                position: absolute;
                color: white;
                font-size: 8px;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .file-info-preview {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
            }
            
            .file-type-icon-preview {
                width: 20px;
                height: 20px;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: 600;
                color: white;
                flex-shrink: 0;
            }
            
            .file-type-icon-preview.image {
                background: #10b981;
            }
            
            .file-type-icon-preview.video {
                background: #f59e0b;
            }
            
            .file-type-icon-preview.document {
                background: #3b82f6;
            }
            
            .file-details-preview {
                flex: 1;
                min-width: 0;
            }
            
            .file-name-preview {
                font-size: 14px;
                color: #1e293b;
                font-weight: 500;
                margin-bottom: 4px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .file-url-preview {
                font-size: 12px;
                color: #64748b;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
                         .file-actions-preview {
                 display: flex;
                 flex-direction: column;
                 align-items: flex-end;
                 gap: 6px;
                 flex-shrink: 0;
             }
             
             .file-size-preview {
                 font-size: 9px;
                 color: #64748b;
                 white-space: nowrap;
             }
             
             .copy-link-btn,
             .preview-btn {
                 padding: 4px 6px;
                 border: none;
                 background: #f1f5f9;
                 color: #475569;
                 border-radius: 4px;
                 cursor: pointer;
                 font-size: 11px;
                 transition: all 0.3s ease;
                 min-width: 24px;
                 height: 24px;
                 display: flex;
                 align-items: center;
                 justify-content: center;
             }
             
             .copy-link-btn:hover,
             .preview-btn:hover {
                 background: #4f46e5;
                 color: white;
                 transform: translateY(-1px);
             }
            
            .preview-footer {
                padding: 8px 16px;
                background: #f8fafc;
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                border-top: 1px solid #e2e8f0;
                flex-shrink: 0;
            }
            
            .action-btn {
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 60px;
            }
            
            .action-btn.primary {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
            }
            
            .action-btn.primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            }
            
            .action-btn.secondary {
                background: #f1f5f9;
                color: #64748b;
                border: 1px solid #e2e8f0;
            }
            
            .action-btn.secondary:hover {
                background: #e2e8f0;
                color: #475569;
            }
            
            .btn-icon {
                margin-right: 4px;
            }
            
                         .file-list-preview.empty {
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 color: #64748b;
                 font-size: 12px;
             }
             

            
                         @media (max-width: 768px) {
                 #web-download-preview-panel {
                     width: 350px;
                 }
                 
                 #web-download-preview-panel.collapsed {
                     transform: translateY(-50%) translateX(310px);
                 }
                 
                 .file-thumbnail {
                     width: 50px;
                     height: 50px;
                 }
                 
                 .file-item-preview {
                     padding: 10px 12px;
                 }
             }
        `;
        
        document.head.appendChild(styles);
    }
    
    setupPreviewEvents() {
        // 切换收缩/展开
        const toggle = this.previewPanel.querySelector('#preview-toggle');
        toggle.addEventListener('click', () => {
            this.previewPanel.classList.toggle('collapsed');
        });
        
        // 拖拽功能
        const header = this.previewPanel.querySelector('#preview-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.drag-handle') || e.target === header) {
                this.startDragging(e);
            }
        });
        

        
        // 全局鼠标事件
        document.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                this.handleDrag(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.stopDragging();
        });
        

        
        // 过滤按钮
        this.previewPanel.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchPreviewFilter(e.target.dataset.filter);
            });
        });
        
        // 全选/全不选
        this.previewPanel.querySelector('#select-all-preview').addEventListener('click', () => {
            this.selectAllPreviewFiles();
        });
        
        this.previewPanel.querySelector('#select-none-preview').addEventListener('click', () => {
            this.selectNoPreviewFiles();
        });
        
        // 取消和确认按钮
        this.previewPanel.querySelector('#cancel-download-preview').addEventListener('click', () => {
            this.hidePreviewPanel();
        });
        
        this.previewPanel.querySelector('#confirm-download-preview').addEventListener('click', () => {
            this.startDownloadFromPreview();
        });
        
        // 使用事件委托处理图片预览和复制链接
        this.previewPanel.addEventListener('click', (e) => {
            // 如果点击的是复选框，不处理其他事件
            if (e.target.type === 'checkbox') {
                return;
            }
            
            // 处理图片预览
            if (e.target.closest('.image-thumbnail[data-preview-url]') || e.target.closest('.preview-btn[data-preview-url]')) {
                e.preventDefault();
                e.stopPropagation();
                const element = e.target.closest('[data-preview-url]');
                const imageUrl = element.dataset.previewUrl;
                if (imageUrl) {
                    this.showImagePreview(imageUrl);
                }
                return;
            }
            
            // 处理复制链接
            if (e.target.closest('.copy-link-btn[data-copy-url]')) {
                e.preventDefault();
                e.stopPropagation();
                const copyBtn = e.target.closest('.copy-link-btn[data-copy-url]');
                const url = copyBtn.dataset.copyUrl;
                if (url) {
                    navigator.clipboard.writeText(url).then(() => {
                        // 临时改变按钮文字显示复制成功
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = '✅';
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                        }, 1000);
                    }).catch(() => {
                        alert('复制失败，请手动复制链接');
                    });
                }
                return;
            }
        });
    }
    
    startDragging(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.previewPanel.offsetLeft;
        this.dragStartY = e.clientY - this.previewPanel.offsetTop;
        this.previewPanel.style.transition = 'none';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    }
    
    handleDrag(e) {
        if (!this.isDragging) return;
        
        const newX = e.clientX - this.dragStartX;
        const newY = e.clientY - this.dragStartY;
        
        // 限制拖拽范围
        const maxX = window.innerWidth - this.previewPanel.offsetWidth;
        const maxY = window.innerHeight - this.previewPanel.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));
        
        this.previewPanel.style.left = constrainedX + 'px';
        this.previewPanel.style.top = constrainedY + 'px';
        this.previewPanel.style.right = 'auto';
    }
    
    stopDragging() {
        if (this.isDragging) {
            this.isDragging = false;
            this.previewPanel.style.transition = '';
            document.body.style.userSelect = '';
        }
    }
    

    

    
    updatePreviewContent() {
        this.updatePreviewStats();
        this.renderPreviewFileList();
    }
    
    updatePreviewStats() {
        const count = this.selectedFiles.length;
        this.previewPanel.querySelector('#preview-count').textContent = `已选择 ${count} 个文件`;
        this.previewPanel.querySelector('#download-count-preview').textContent = count;
        
        // 更新下载按钮状态
        const confirmBtn = this.previewPanel.querySelector('#confirm-download-preview');
        confirmBtn.disabled = count === 0;
        if (count === 0) {
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
        } else {
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }
    
    renderPreviewFileList() {
        const fileList = this.previewPanel.querySelector('#file-list-preview');
        fileList.innerHTML = '';
        
        const filteredFiles = this.getFilteredPreviewFiles();
        
        if (filteredFiles.length === 0) {
            fileList.className = 'file-list-preview empty';
            fileList.innerHTML = '<div>暂无符合条件的文件</div>';
            return;
        }
        
        fileList.className = 'file-list-preview';
        
        // 分离图片和其他文件
        const imageFiles = filteredFiles.filter(file => file.type === 'image');
        const otherFiles = filteredFiles.filter(file => file.type !== 'image');
        
        // 渲染图片网格
        if (imageFiles.length > 0) {
            const imagesGrid = document.createElement('div');
            imagesGrid.className = 'images-grid';
            
            imageFiles.forEach((file, index) => {
                const fileItem = this.createPreviewFileItem(file, index, true);
                imagesGrid.appendChild(fileItem);
            });
            
            fileList.appendChild(imagesGrid);
        }
        
        // 渲染其他文件列表
        otherFiles.forEach((file, index) => {
            const fileItem = this.createPreviewFileItem(file, index + imageFiles.length, false);
            fileList.appendChild(fileItem);
        });
    }
    
    getFilteredPreviewFiles() {
        if (this.currentFilter === 'all') {
            return this.foundFiles;
        }
        return this.foundFiles.filter(file => file.type === this.currentFilter);
    }
    
    createPreviewFileItem(file, index, isImage = false) {
        const item = document.createElement('div');
        
        const isSelected = this.selectedFiles.some(f => f.url === file.url);
        
        if (isImage) {
            // 图片卡片布局
            item.className = 'file-item-preview image-card';
            item.innerHTML = `
                <div class="image-thumbnail" data-preview-url="${file.url}">
                    <img src="${file.url}" alt="${file.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;image-error&quot;>❌</div>'">
                </div>
                <div class="image-info">
                    <div class="image-name" title="${file.name || '未命名'}">${this.truncateText(file.name || '未命名', 12)}</div>
                    <div class="image-url" title="${file.url}">${this.truncateUrl(file.url)}</div>
                    <div class="image-actions">
                        <span class="file-size">${this.formatPreviewFileSize(file.size)}</span>
                        <div class="image-action-buttons">
                            <div class="image-checkbox">
                                <input type="checkbox" ${isSelected ? 'checked' : ''} data-url="${file.url}">
                            </div>
                            <button class="preview-btn" data-preview-url="${file.url}" title="预览图片">👁️</button>
                            <button class="copy-link-btn" data-copy-url="${file.url}" title="复制链接">📋</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 非图片文件列表布局
            item.className = 'file-item-preview list-item';
            item.innerHTML = `
                <div class="file-checkbox-preview">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} data-url="${file.url}">
                </div>
                <div class="file-info-preview">
                    <div class="file-type-icon-preview ${file.type}">
                        ${this.getPreviewTypeIcon(file.type)}
                    </div>
                    <div class="file-details-preview">
                        <div class="file-name-preview" title="${file.name || '未命名'}">${this.truncateText(file.name || '未命名', 20)}</div>
                        <div class="file-url-preview" title="${file.url}">${this.truncateUrl(file.url)}</div>
                    </div>
                    <div class="file-actions-preview">
                        <div class="file-size-preview">${this.formatPreviewFileSize(file.size)}</div>
                        <button class="copy-link-btn" data-copy-url="${file.url}" title="复制链接">📋</button>
                    </div>
                </div>
            `;
        }
        
        // 添加复选框事件监听
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            if (e.target.checked) {
                if (!this.selectedFiles.some(f => f.url === file.url)) {
                    this.selectedFiles.push(file);
                }
            } else {
                const fileIndex = this.selectedFiles.findIndex(f => f.url === file.url);
                if (fileIndex > -1) {
                    this.selectedFiles.splice(fileIndex, 1);
                }
            }
            this.updatePreviewStats();
        });
        
        // 为复选框容器添加点击事件，确保点击复选框区域能触发选择
        const checkboxContainer = item.querySelector('.image-checkbox, .file-checkbox-preview');
        if (checkboxContainer) {
            checkboxContainer.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡到父元素
                if (e.target !== checkbox) {
                    checkbox.click(); // 如果点击的不是复选框本身，则触发复选框点击
                }
            });
        }
        
        return item;
    }
    
    getPreviewTypeIcon(type) {
        switch (type) {
            case 'image': return '🖼️';
            case 'video': return '🎥';
            case 'document': return '📄';
            default: return '📁';
        }
    }
    
    formatPreviewFileSize(size) {
        if (!size) return '未知大小';
        if (size < 1024) return size + ' 字节';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
        return (size / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    truncateUrl(url) {
        if (!url || url.length <= 30) return url;
        try {
            const urlObj = new URL(url);
            const path = urlObj.pathname + urlObj.search;
            if (path.length <= 20) {
                return urlObj.hostname + path;
            }
            return urlObj.hostname + '...' + path.substring(path.length - 15);
        } catch {
            return url.substring(0, 30) + '...';
        }
    }
    
    switchPreviewFilter(filter) {
        this.currentFilter = filter;
        
        // 更新按钮状态
        this.previewPanel.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.renderPreviewFileList();
    }
    
    selectAllPreviewFiles() {
        const filteredFiles = this.getFilteredPreviewFiles();
        filteredFiles.forEach(file => {
            if (!this.selectedFiles.some(f => f.url === file.url)) {
                this.selectedFiles.push(file);
            }
        });
        this.updatePreviewContent();
    }
    
    selectNoPreviewFiles() {
        const filteredFiles = this.getFilteredPreviewFiles();
        filteredFiles.forEach(file => {
            const fileIndex = this.selectedFiles.findIndex(f => f.url === file.url);
            if (fileIndex > -1) {
                this.selectedFiles.splice(fileIndex, 1);
            }
        });
        this.updatePreviewContent();
    }
    
    startDownloadFromPreview() {
        if (this.selectedFiles.length === 0) {
            alert('请至少选择一个文件进行下载');
            return;
        }
        
        // 发送消息给background script开始下载
        chrome.runtime.sendMessage({
            action: 'startDownload',
            selectedFiles: this.selectedFiles
        });
        
        this.hidePreviewPanel();
    }
    
    showImagePreview(imageUrl) {
        // 移除现有的预览
        const existingPreview = document.getElementById('image-preview-modal');
        if (existingPreview) {
            document.body.removeChild(existingPreview);
        }
        
        // 创建图片预览模态框
        const modal = document.createElement('div');
        modal.id = 'image-preview-modal';
        modal.innerHTML = `
            <div class="image-preview-backdrop"></div>
            <div class="image-preview-container">
                <div class="image-preview-header">
                    <span class="image-preview-title">图片预览</span>
                    <button class="image-preview-close">✕</button>
                </div>
                <div class="image-preview-content">
                    <img src="${imageUrl}" alt="预览图片" loading="lazy" onerror="this.parentElement.innerHTML='<div style=&quot;color:#64748b;font-size:14px;&quot;>图片加载失败</div>'">
                </div>
                <div class="image-preview-footer">
                    <button class="image-action-btn copy-image-link" data-url="${imageUrl}">复制链接</button>
                    <button class="image-action-btn open-image-tab" data-url="${imageUrl}">新标签页打开</button>
                </div>
            </div>
        `;
            
            // 添加样式
            if (!document.getElementById('image-preview-styles')) {
                const styles = document.createElement('style');
                styles.id = 'image-preview-styles';
                styles.textContent = `
                    #image-preview-modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        z-index: 9999999;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        animation: fadeIn 0.3s ease;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    
                    .image-preview-backdrop {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.8);
                        backdrop-filter: blur(4px);
                        cursor: pointer;
                    }
                    
                    .image-preview-container {
                        position: relative;
                        max-width: 90vw;
                        max-height: 90vh;
                        background: white;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                        display: flex;
                        flex-direction: column;
                        animation: slideIn 0.3s ease;
                    }
                    
                    @keyframes slideIn {
                        from {
                            opacity: 0;
                            transform: scale(0.9) translateY(-20px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }
                    
                    .image-preview-header {
                        padding: 16px 20px;
                        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                        color: white;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    
                    .image-preview-title {
                        font-size: 16px;
                        font-weight: 600;
                    }
                    
                    .image-preview-close {
                        width: 32px;
                        height: 32px;
                        border: none;
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        transition: all 0.3s ease;
                    }
                    
                    .image-preview-close:hover {
                        background: rgba(255, 255, 255, 0.3);
                        transform: scale(1.05);
                    }
                    
                    .image-preview-content {
                        padding: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex: 1;
                        min-height: 200px;
                    }
                    
                    .image-preview-content img {
                        max-width: 100%;
                        max-height: 60vh;
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    }
                    
                    .image-preview-footer {
                        padding: 16px 20px;
                        background: #f8fafc;
                        display: flex;
                        gap: 12px;
                        justify-content: center;
                        border-top: 1px solid #e2e8f0;
                    }
                    
                    .image-action-btn {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                        color: white;
                    }
                    
                    .image-action-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                    }
                `;
                document.head.appendChild(styles);
            }
        
        // 添加事件监听器
        modal.addEventListener('click', (e) => {
            // 点击背景关闭
            if (e.target.classList.contains('image-preview-backdrop')) {
                modal.remove();
            }
            
            // 关闭按钮
            if (e.target.classList.contains('image-preview-close')) {
                modal.remove();
            }
            
            // 复制链接
            if (e.target.classList.contains('copy-image-link')) {
                const url = e.target.dataset.url;
                navigator.clipboard.writeText(url).then(() => {
                    e.target.textContent = '✅ 已复制';
                    setTimeout(() => {
                        e.target.textContent = '复制链接';
                    }, 1000);
                });
            }
            
            // 新标签页打开
            if (e.target.classList.contains('open-image-tab')) {
                const url = e.target.dataset.url;
                window.open(url, '_blank');
            }
        });
        
        document.body.appendChild(modal);
    }
}

// 初始化内容脚本
const scanner = new ContentScanner();
// 为了调试和访问方便，将实例添加到全局
window.contentScanner = scanner; 