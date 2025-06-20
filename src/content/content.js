// 内容脚本 - 负责页面扫描和区域选择
class ContentScanner {
    constructor() {
        this.isSelectionMode = false;
        this.selectionOverlay = null;
        this.selectionBox = null;
        this.startX = 0;
        this.startY = 0;
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
}

// 初始化内容脚本
new ContentScanner(); 