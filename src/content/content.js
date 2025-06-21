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
        this.currentSourceFilter = 'all'; // 一级过滤：来源
        this.currentTypeFilter = 'all';   // 二级过滤：类型
        this.currentSizeFilter = 'all';   // 三级过滤：大小
        this.currentFormatFilter = 'all'; // 四级过滤：格式
        this.currentSortBy = 'time';      // 排序方式：time, size, name
        this.currentSortOrder = 'desc';   // 排序顺序：asc, desc
        this.customSizeRange = {          // 自定义大小范围
            min: 0,
            max: null,
            minUnit: 'MB',
            maxUnit: 'MB'
        };
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.networkRefreshInterval = null;
        this.isFilterCollapsed = false;   // 筛选区域折叠状态
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
                case 'showPreview':
                    this.showPreviewPanel(request.files, request.selectedFiles, request.settings);
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
            // 扫描所有类型的文件
            const images = this.scanImages();
            files.push(...images);
            
            const videos = this.scanVideos();
            files.push(...videos);
            
            const audios = this.scanAudios();
            files.push(...audios);
            
            const documents = this.scanDocuments();
            files.push(...documents);
            
            return { files: this.filterFiles(files, settings) };
        } catch (error) {
            console.error('页面扫描失败:', error);
            return { files: [], error: error.message };
        }
    }
    
    scanImages() {
        const images = [];
        const imgElements = document.querySelectorAll('img');
        const currentTime = new Date();

        imgElements.forEach((img, index) => {
            const src = img.src || img.dataset.src || img.dataset.original;
            if (src && this.isValidUrl(src)) {
                images.push({
                    type: 'image',
                    url: src,
                    name: this.extractFilename(src) || `image_${index}`,
                    element: img,
                    alt: img.alt || '',
                    size: this.getEstimatedSize(img),
                    timestamp: currentTime.getTime(),
                    timeString: this.formatTime(currentTime)
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
                        size: null,
                        timestamp: currentTime.getTime(),
                        timeString: this.formatTime(currentTime)
                    });
                }
            }
        });
        
        return images;
    }
    
    scanVideos() {
        const videos = [];
        const currentTime = new Date();
        
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
                    size: this.getEstimatedSize(video),
                    timestamp: currentTime.getTime(),
                    timeString: this.formatTime(currentTime)
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
                        size: this.getEstimatedSize(video),
                        timestamp: currentTime.getTime(),
                        timeString: this.formatTime(currentTime)
                    });
                }
            });
        });

        return videos;
    }
    
    scanAudios() {
        const audios = [];
        const audioElements = document.querySelectorAll('audio');
        const currentTime = new Date();
        
        audioElements.forEach((audio, index) => {
            const src = audio.src || audio.currentSrc;
            if (src && this.isValidUrl(src)) {
                audios.push({
                    type: 'audio',
                    url: src,
                    name: this.extractFilename(src) || `audio_${index}`,
                    element: audio,
                    size: this.getEstimatedSize(audio),
                    timestamp: currentTime.getTime(),
                    timeString: this.formatTime(currentTime)
                });
            }
            
            // 检查source元素
            const sources = audio.querySelectorAll('source');
            sources.forEach((source, sourceIndex) => {
                if (source.src && this.isValidUrl(source.src)) {
                    audios.push({
                        type: 'audio',
                        url: source.src,
                        name: this.extractFilename(source.src) || `audio_${index}_${sourceIndex}`,
                        element: audio,
                        size: this.getEstimatedSize(audio),
                        timestamp: currentTime.getTime(),
                        timeString: this.formatTime(currentTime)
                    });
                }
            });
        });
        
        // 扫描链接中的音频文件
        const links = document.querySelectorAll('a[href]');
        const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'];
        
        links.forEach((link, index) => {
            const href = link.href;
            if (href && this.isValidUrl(href)) {
                const extension = this.getFileExtension(href);
                if (audioExtensions.includes(extension.toLowerCase())) {
                    audios.push({
                        type: 'audio',
                        url: href,
                        name: this.extractFilename(href) || `audio_link_${index}`,
                        element: link,
                        text: link.textContent.trim(),
                        size: null,
                        timestamp: currentTime.getTime(),
                        timeString: this.formatTime(currentTime)
                    });
                }
            }
        });

        return audios;
    }
    
    scanDocuments() {
        const documents = [];
        const links = document.querySelectorAll('a[href]');
        const currentTime = new Date();
        
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
                        size: null,
                        timestamp: currentTime.getTime(),
                        timeString: this.formatTime(currentTime)
                    });
                }
            }
        });

        return documents;
    }
    
    startAreaSelection() {
        if (this.isSelectionMode) return;
        
        this.isSelectionMode = true;
        this.currentHighlightedElement = null;
        this.createElementSelector();
        this.setupElementSelectorEvents();
    }
    
    createElementSelector() {
        // 创建高亮覆盖层
        this.highlightOverlay = document.createElement('div');
        this.highlightOverlay.id = 'element-highlight-overlay';
        this.highlightOverlay.style.cssText = `
            position: absolute;
            border: 2px solid #4f46e5;
            background: rgba(79, 70, 229, 0.1);
            pointer-events: none;
            z-index: 999998;
            display: none;
            transition: all 0.1s ease;
        `;
        document.body.appendChild(this.highlightOverlay);
        
        // 创建信息提示框
        this.infoBox = document.createElement('div');
        this.infoBox.id = 'element-info-box';
        this.infoBox.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            z-index: 999999;
            pointer-events: none;
            display: none;
            max-width: 300px;
            word-break: break-all;
        `;
        document.body.appendChild(this.infoBox);
        
        // 创建操作提示
        this.tipBox = document.createElement('div');
        this.tipBox.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 1000000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #333;
            border: 2px solid #4f46e5;
        `;
        this.tipBox.innerHTML = `
            <div style="text-align: center;">
                <strong>🎯 元素选择模式</strong><br>
                <span style="font-size: 12px; color: #666;">
                    悬停高亮元素，点击选择区域<br>
                    按 ESC 取消选择
                </span>
            </div>
        `;
        document.body.appendChild(this.tipBox);
        
        // 添加样式覆盖，防止页面滚动
        document.body.style.overflow = 'hidden';
    }
    
    setupElementSelectorEvents() {
        const mouseMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 获取鼠标位置下的元素
            const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            
            if (!elementUnderMouse || 
                elementUnderMouse === this.highlightOverlay || 
                elementUnderMouse === this.infoBox ||
                elementUnderMouse === this.tipBox ||
                elementUnderMouse.closest('#element-highlight-overlay') ||
                elementUnderMouse.closest('#element-info-box')) {
                return;
            }
            
            // 找到合适的父元素（优先选择有内容的容器）
            const targetElement = this.findBestTargetElement(elementUnderMouse);
            
            if (targetElement !== this.currentHighlightedElement) {
                this.highlightElement(targetElement);
                this.updateInfoBox(targetElement, e.clientX, e.clientY);
                this.currentHighlightedElement = targetElement;
            }
        };
        
        const mouseClick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (this.currentHighlightedElement) {
                await this.processSelectedElement(this.currentHighlightedElement);
                this.endAreaSelection();
            }
        };
        
        const keyDown = (e) => {
            if (e.key === 'Escape') {
                this.endAreaSelection();
            }
        };
        
        // 阻止所有页面交互
        const preventDefault = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        
        document.addEventListener('mousemove', mouseMove, true);
        document.addEventListener('click', mouseClick, true);
        document.addEventListener('keydown', keyDown, true);
        document.addEventListener('scroll', preventDefault, true);
        document.addEventListener('wheel', preventDefault, true);
        
        // 保存事件引用以便清理
        this._selectionEvents = { 
            mouseMove, 
            mouseClick, 
            keyDown, 
            preventDefault 
        };
    }
    
    findBestTargetElement(element) {
        // 如果是文本节点，获取父元素
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement;
        }
        
        // 向上查找，寻找有意义的容器元素
        let current = element;
        const meaningfulTags = ['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV'];
        
        // 最多向上查找5层
        for (let i = 0; i < 5 && current && current !== document.body; i++) {
            // 如果是有意义的标签且有一定尺寸
            if (meaningfulTags.includes(current.tagName)) {
                const rect = current.getBoundingClientRect();
                if (rect.width > 50 && rect.height > 50) {
                    return current;
                }
            }
            current = current.parentElement;
        }
        
        // 如果没找到合适的容器，返回原始元素
        return element;
    }
    
    highlightElement(element) {
        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        this.highlightOverlay.style.cssText = `
            position: absolute;
            left: ${rect.left + scrollX}px;
            top: ${rect.top + scrollY}px;
            width: ${rect.width}px;
            height: ${rect.height}px;
            border: 2px solid #4f46e5;
            background: rgba(79, 70, 229, 0.1);
            pointer-events: none;
            z-index: 999998;
            display: block;
            transition: all 0.1s ease;
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
        `;
    }
    
    updateInfoBox(element, mouseX, mouseY) {
        const tagName = element.tagName.toLowerCase();
        const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
        const id = element.id ? `#${element.id}` : '';
        const rect = element.getBoundingClientRect();
        
        // 计算元素内的媒体文件数量
        const images = element.querySelectorAll('img').length;
        const videos = element.querySelectorAll('video').length;
        const audios = element.querySelectorAll('audio').length;
        const links = element.querySelectorAll('a[href*=".pdf"], a[href*=".doc"], a[href*=".docx"]').length;
        
        this.infoBox.innerHTML = `
            <div><strong>${tagName}${id}${className}</strong></div>
            <div>尺寸: ${Math.round(rect.width)} × ${Math.round(rect.height)}</div>
            <div>内容: 图片${images} 视频${videos} 音频${audios} 文档${links}</div>
        `;
        
        // 定位信息框，避免超出屏幕
        let left = mouseX + 10;
        let top = mouseY - 60;
        
        if (left + 300 > window.innerWidth) {
            left = mouseX - 310;
        }
        if (top < 10) {
            top = mouseY + 10;
        }
        
        this.infoBox.style.left = left + 'px';
        this.infoBox.style.top = top + 'px';
        this.infoBox.style.display = 'block';
    }
    
    async processSelectedElement(element) {
        const files = [];
        
        // 在选择的元素内查找所有媒体文件
        const allElements = element.querySelectorAll('*');
        const elementsToCheck = [element, ...Array.from(allElements)];
        
        elementsToCheck.forEach((el, index) => {
            // 检查图片
            if (el.tagName === 'IMG') {
                const src = el.src || el.dataset.src || el.getAttribute('data-original') || el.getAttribute('data-lazy');
                if (src && this.isValidUrl(src)) {
                    files.push({
                        type: 'image',
                        url: src,
                        name: this.extractFilename(src) || `element_image_${index}`,
                        element: el,
                        size: this.getEstimatedSize(el),
                        source: 'page',
                        timestamp: Date.now(),
                        timeString: this.formatTime(new Date())
                    });
                }
            }
            
            // 检查背景图片
            if (el.style && el.style.backgroundImage) {
                const bgMatch = el.style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (bgMatch && this.isValidUrl(bgMatch[1])) {
                    files.push({
                        type: 'image',
                        url: bgMatch[1],
                        name: this.extractFilename(bgMatch[1]) || `element_bg_${index}`,
                        element: el,
                        size: this.getEstimatedSize(el),
                        source: 'page',
                        timestamp: Date.now(),
                        timeString: this.formatTime(new Date())
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
                        name: this.extractFilename(src) || `element_video_${index}`,
                        element: el,
                        size: this.getEstimatedSize(el),
                        source: 'page',
                        timestamp: Date.now(),
                        timeString: this.formatTime(new Date())
                    });
                }
                
                // 检查video标签内的source元素
                const sources = el.querySelectorAll('source');
                sources.forEach((source, sourceIndex) => {
                    if (source.src && this.isValidUrl(source.src)) {
                        files.push({
                            type: 'video',
                            url: source.src,
                            name: this.extractFilename(source.src) || `element_video_${index}_${sourceIndex}`,
                            element: el,
                            size: this.getEstimatedSize(el),
                            source: 'page',
                            timestamp: Date.now(),
                            timeString: this.formatTime(new Date())
                        });
                    }
                });
            }
            
            // 检查音频
            if (el.tagName === 'AUDIO') {
                const src = el.src || el.currentSrc;
                if (src && this.isValidUrl(src)) {
                    files.push({
                        type: 'audio',
                        url: src,
                        name: this.extractFilename(src) || `element_audio_${index}`,
                        element: el,
                        size: this.getEstimatedSize(el),
                        source: 'page',
                        timestamp: Date.now(),
                        timeString: this.formatTime(new Date())
                    });
                }
            }
            
            // 检查链接（文档）
            if (el.tagName === 'A' && el.href) {
                const extension = this.getFileExtension(el.href);
                const docExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'];
                if (docExtensions.includes(extension.toLowerCase())) {
                    files.push({
                        type: 'document',
                        url: el.href,
                        name: this.extractFilename(el.href) || `element_doc_${index}`,
                        element: el,
                        size: null,
                        source: 'page',
                        timestamp: Date.now(),
                        timeString: this.formatTime(new Date())
                    });
                }
            }
        });
        
        // 去重
        const uniqueFiles = [];
        const seenUrls = new Set();
        files.forEach(file => {
            if (!seenUrls.has(file.url)) {
                seenUrls.add(file.url);
                uniqueFiles.push(file);
            }
        });
        
        // 显示预览面板
        if (uniqueFiles.length > 0) {
            // 高亮选中的元素一段时间
            element.style.outline = '3px solid #10b981';
            element.style.outlineOffset = '2px';
            setTimeout(() => {
                element.style.outline = '';
                element.style.outlineOffset = '';
            }, 2000);
            
            this.showPreviewPanel(uniqueFiles, []);
        } else {
            alert('在选择的元素内未找到可下载的文件');
        }
    }
    
    endAreaSelection() {
        this.isSelectionMode = false;
        this.currentHighlightedElement = null;
        
        // 恢复页面滚动
        document.body.style.overflow = '';
        
        // 清理高亮覆盖层
        if (this.highlightOverlay) {
            document.body.removeChild(this.highlightOverlay);
            this.highlightOverlay = null;
        }
        
        // 清理信息框
        if (this.infoBox) {
            document.body.removeChild(this.infoBox);
            this.infoBox = null;
        }
        
        // 清理提示框
        if (this.tipBox) {
            document.body.removeChild(this.tipBox);
            this.tipBox = null;
        }
        
        // 清理事件监听器
        if (this._selectionEvents) {
            document.removeEventListener('mousemove', this._selectionEvents.mouseMove, true);
            document.removeEventListener('click', this._selectionEvents.mouseClick, true);
            document.removeEventListener('keydown', this._selectionEvents.keyDown, true);
            document.removeEventListener('scroll', this._selectionEvents.preventDefault, true);
            document.removeEventListener('wheel', this._selectionEvents.preventDefault, true);
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
    
    hasFileExtension(filename) {
        if (!filename) return false;
        const parts = filename.split('.');
        return parts.length > 1 && parts[parts.length - 1].length > 0;
    }
    
    getTypeExtension(type) {
        switch (type) {
            case 'image': return 'jpg';
            case 'video': return 'mp4';
            case 'audio': return 'mp3';
            case 'document': return 'pdf';
            default: return 'file';
        }
    }
    
    ensureFileExtension(filename, url, type) {
        if (!filename) return 'unknown_file.file';
        
        if (this.hasFileExtension(filename)) {
            return filename;
        }
        
        // 没有后缀，尝试从URL获取后缀
        const extension = this.getFileExtension(url) || this.getTypeExtension(type);
        return `${filename}.${extension}`;
    }
    
    getEstimatedSize(element) {
        if (!element) return null;
        
        // 尝试从元素属性获取尺寸信息
        if (element.tagName === 'IMG') {
            const width = element.naturalWidth || element.width || 0;
            const height = element.naturalHeight || element.height || 0;
            
            if (width && height) {
                // 改进的图片大小估算
                // 根据图片格式和尺寸进行更准确的估算
                const pixels = width * height;
                const src = element.src || '';
                
                if (src.toLowerCase().includes('.jpg') || src.toLowerCase().includes('.jpeg')) {
                    // JPEG压缩率较高，平均每像素0.5字节
                    return Math.round(pixels * 0.5);
                } else if (src.toLowerCase().includes('.png')) {
                    // PNG无损压缩，平均每像素2字节
                    return Math.round(pixels * 2);
                } else if (src.toLowerCase().includes('.gif')) {
                    // GIF有限颜色，平均每像素1字节
                    return Math.round(pixels * 1);
                } else if (src.toLowerCase().includes('.webp')) {
                    // WebP高效压缩，平均每像素0.3字节
                    return Math.round(pixels * 0.3);
                } else {
                    // 默认估算
                    return Math.round(pixels * 1);
                }
            }
        } else if (element.tagName === 'VIDEO') {
            const duration = element.duration || 0;
            const width = element.videoWidth || element.width || 0;
            const height = element.videoHeight || element.height || 0;
            
            if (duration && width && height) {
                // 改进的视频大小估算
                const pixels = width * height;
                const fps = 30; // 假设30帧每秒
                const totalFrames = duration * fps;
                
                // 根据分辨率调整压缩率
                let bytesPerPixel;
                if (width >= 1920) {
                    // 高清视频，压缩率较高
                    bytesPerPixel = 0.05;
                } else if (width >= 1280) {
                    // 中等分辨率
                    bytesPerPixel = 0.08;
                } else {
                    // 低分辨率
                    bytesPerPixel = 0.1;
                }
                
                return Math.round(totalFrames * pixels * bytesPerPixel);
            }
        }
        
        return null;
    }
    
    estimateFileSizeByType(file) {
        // 根据文件类型和URL特征估算文件大小
        const url = file.url || '';
        const type = file.type || 'unknown';
        
        switch (type) {
            case 'image':
                // 根据URL中的图片格式估算
                if (url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg')) {
                    return 200 * 1024; // 200KB
                } else if (url.toLowerCase().includes('.png')) {
                    return 500 * 1024; // 500KB
                } else if (url.toLowerCase().includes('.gif')) {
                    return 1024 * 1024; // 1MB
                } else if (url.toLowerCase().includes('.webp')) {
                    return 150 * 1024; // 150KB
                } else {
                    return 300 * 1024; // 默认300KB
                }
                
            case 'video':
                // 视频文件通常较大
                if (url.toLowerCase().includes('.mp4')) {
                    return 10 * 1024 * 1024; // 10MB
                } else if (url.toLowerCase().includes('.webm')) {
                    return 5 * 1024 * 1024; // 5MB
                } else {
                    return 8 * 1024 * 1024; // 默认8MB
                }
                
            case 'audio':
                // 音频文件大小估算（假设3分钟）
                if (url.toLowerCase().includes('.mp3')) {
                    return 3 * 1024 * 1024; // 3MB
                } else if (url.toLowerCase().includes('.wav')) {
                    return 30 * 1024 * 1024; // 30MB (无损)
                } else if (url.toLowerCase().includes('.flac')) {
                    return 25 * 1024 * 1024; // 25MB (无损)
                } else if (url.toLowerCase().includes('.aac') || url.toLowerCase().includes('.m4a')) {
                    return 2.5 * 1024 * 1024; // 2.5MB
                } else if (url.toLowerCase().includes('.ogg')) {
                    return 2 * 1024 * 1024; // 2MB
                } else if (url.toLowerCase().includes('.wma')) {
                    return 3.5 * 1024 * 1024; // 3.5MB
                } else {
                    return 3 * 1024 * 1024; // 默认3MB
                }
                
            case 'document':
                if (url.toLowerCase().includes('.pdf')) {
                    return 2 * 1024 * 1024; // 2MB
                } else if (url.toLowerCase().includes('.doc') || url.toLowerCase().includes('.docx')) {
                    return 1024 * 1024; // 1MB
                } else if (url.toLowerCase().includes('.zip') || url.toLowerCase().includes('.rar')) {
                    return 5 * 1024 * 1024; // 5MB
                } else {
                    return 500 * 1024; // 默认500KB
                }
                
            default:
                return 1024 * 1024; // 默认1MB
        }
    }
    
    showPreviewPanel(files, selectedFiles, settings) {
        this.foundFiles = files || [];
        this.selectedFiles = selectedFiles || [];
        this.currentSettings = settings || {};
        
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
        
        // 清理定时器
        this.cleanup();
    }
    
    generateFormatFilterHTML() {
        // 如果设置中禁用了格式筛选，返回空字符串
        if (this.currentSettings && this.currentSettings.showFormatFilter === false) {
            return '';
        }
        
        return `
            <div class="filter-row format-filters">
                <div class="filter-group">
                    <label class="filter-label">📄 格式筛选:</label>
                    <select class="format-select" id="format-filter">
                        <option value="all">全部格式</option>
                        <optgroup label="图片格式">
                            <option value="jpg">JPG</option>
                            <option value="png">PNG</option>
                            <option value="gif">GIF</option>
                            <option value="webp">WebP</option>
                            <option value="svg">SVG</option>
                        </optgroup>
                        <optgroup label="视频格式">
                            <option value="mp4">MP4</option>
                            <option value="webm">WebM</option>
                            <option value="avi">AVI</option>
                            <option value="mov">MOV</option>
                            <option value="mkv">MKV</option>
                        </optgroup>
                        <optgroup label="音频格式">
                            <option value="mp3">MP3</option>
                            <option value="wav">WAV</option>
                            <option value="flac">FLAC</option>
                            <option value="aac">AAC</option>
                            <option value="ogg">OGG</option>
                            <option value="m4a">M4A</option>
                        </optgroup>
                        <optgroup label="文档格式">
                            <option value="pdf">PDF</option>
                            <option value="doc">DOC</option>
                            <option value="docx">DOCX</option>
                            <option value="xls">XLS</option>
                            <option value="xlsx">XLSX</option>
                            <option value="ppt">PPT</option>
                            <option value="pptx">PPTX</option>
                        </optgroup>
                    </select>
                </div>
            </div>
        `;
    }

    createPreviewPanel() {
        // 创建主预览面板
        this.previewPanel = document.createElement('div');
        this.previewPanel.id = 'web-download-preview-panel';
        
        this.previewPanel.innerHTML = `
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
                
                <div class="network-monitor-tip">
                    <span class="tip-icon">🔄</span>
                    <span class="tip-text">持续监听网页文件中...</span>
                </div>
                
                <div class="preview-filters">
                    <div class="filter-header" id="filter-header">
                        <div class="filter-header-left">
                            <span class="filter-title">🔍 筛选条件</span>
                            <span class="filter-status" id="filter-status">全部文件</span>
                        </div>
                        <button class="filter-toggle-btn" id="filter-toggle-btn" title="展开/折叠筛选选项">
                            <span class="toggle-icon">▼</span>
                        </button>
                    </div>
                    <div class="filter-content" id="filter-content">
                        <div class="filter-row primary-filters">
                            <div class="filter-group">
                                <button class="filter-btn primary active" data-filter="all">全部</button>
                                <button class="filter-btn primary" data-filter="page">页面文件</button>
                                <button class="filter-btn primary" data-filter="network">网络文件</button>
                            </div>
                        </div>
                        <div class="filter-row secondary-filters">
                            <div class="filter-group">
                                <button class="filter-btn secondary active" data-type="all">全部类型</button>
                                <button class="filter-btn secondary" data-type="image">图片</button>
                                <button class="filter-btn secondary" data-type="video">视频</button>
                                <button class="filter-btn secondary" data-type="audio">音频</button>
                                <button class="filter-btn secondary" data-type="document">文档</button>
                            </div>
                        </div>
                        <div class="filter-row size-filters">
                            <div class="filter-group">
                                <button class="filter-btn size active" data-size="all">全部大小</button>
                                <button class="filter-btn size" data-size="small">小文件(&lt;1MB)</button>
                                <button class="filter-btn size" data-size="medium">中文件(1-10MB)</button>
                                <button class="filter-btn size" data-size="large">大文件(&gt;10MB)</button>
                                <button class="filter-btn size" data-size="custom">自定义范围</button>
                            </div>
                        </div>
                        <div class="filter-row size-range-row" id="size-range-row" style="display: none;">
                            <div class="size-range-container">
                                <div class="range-input-group">
                                    <label>最小:</label>
                                    <input type="number" id="min-size-input" min="0" step="0.1" placeholder="0">
                                    <select id="min-size-unit">
                                        <option value="KB">KB</option>
                                        <option value="MB" selected>MB</option>
                                        <option value="GB">GB</option>
                                    </select>
                                </div>
                                <div class="range-separator">-</div>
                                <div class="range-input-group">
                                    <label>最大:</label>
                                    <input type="number" id="max-size-input" min="0" step="0.1" placeholder="无限制">
                                    <select id="max-size-unit">
                                        <option value="KB">KB</option>
                                        <option value="MB" selected>MB</option>
                                        <option value="GB">GB</option>
                                    </select>
                                </div>
                                <button class="apply-range-btn" id="apply-size-range">应用</button>
                            </div>
                        </div>
                        ${this.generateFormatFilterHTML()}
                        <div class="filter-row sort-filters">
                            <div class="filter-group">
                                <label class="filter-label">🔄 排序方式:</label>
                                <select class="sort-select" id="sort-by">
                                    <option value="time">按时间</option>
                                    <option value="size">按大小</option>
                                    <option value="name">按名称</option>
                                    <option value="type">按类型</option>
                                </select>
                                <select class="sort-order" id="sort-order">
                                    <option value="desc">降序 ↓</option>
                                    <option value="asc">升序 ↑</option>
                                </select>
                            </div>
                        </div>
                        <div class="action-row">
                            <button class="action-btn-small" id="refresh-files-preview">🔄 重新获取</button>
                            <button class="action-btn-small" id="select-all-preview">全选</button>
                            <button class="action-btn-small" id="select-none-preview">全不选</button>
                            <button class="action-btn-small danger" id="clear-all-files">🗑️ 清除全部</button>
                        </div>
                    </div>
                </div>
                
                <div class="file-list-preview" id="file-list-preview">
                    <!-- 文件项会动态添加到这里 -->
                </div>
                
                <div class="preview-footer">
                    <button class="action-btn secondary" id="cancel-download-preview">关闭预览</button>
                    <div class="download-button-group">
                        <button class="action-btn primary" id="confirm-download-preview">
                            <span class="btn-icon">⬇️</span>
                            开始下载 (<span id="download-count-preview">0</span>)
                        </button>
                        <button class="download-mode-toggle" id="download-mode-toggle" title="下载模式选项">
                            <span class="dropdown-arrow">▼</span>
                        </button>
                        <div class="download-mode-menu" id="download-mode-menu">
                            <div class="download-mode-item" data-mode="direct">
                                <span class="mode-icon">💾</span>
                                <div class="mode-info">
                                    <div class="mode-title">直接下载</div>
                                    <div class="mode-desc">浏览器逐个下载文件</div>
                                </div>
                            </div>
                            <div class="download-mode-item" data-mode="links">
                                <span class="mode-icon">📋</span>
                                <div class="mode-info">
                                    <div class="mode-title">保存链接列表</div>
                                    <div class="mode-desc">生成文本文件，一行一个链接</div>
                                </div>
                            </div>
                            <div class="download-mode-item" data-mode="markdown">
                                <span class="mode-icon">📝</span>
                                <div class="mode-info">
                                    <div class="mode-title">保存为Markdown</div>
                                    <div class="mode-desc">生成带预览的Markdown文档</div>
                                </div>
                            </div>
                            <div class="download-mode-item" data-mode="python">
                                <span class="mode-icon">🐍</span>
                                <div class="mode-info">
                                    <div class="mode-title">Python下载脚本</div>
                                    <div class="mode-desc">生成Python批量下载代码</div>
                                </div>
                            </div>
                            <div class="download-mode-item" data-mode="batch">
                                <span class="mode-icon">⚡</span>
                                <div class="mode-info">
                                    <div class="mode-title">批处理脚本</div>
                                    <div class="mode-desc">生成Windows批处理下载命令</div>
                                </div>
                            </div>
                            <div class="download-mode-item" data-mode="curl">
                                <span class="mode-icon">🌐</span>
                                <div class="mode-info">
                                    <div class="mode-title">cURL命令</div>
                                    <div class="mode-desc">生成cURL批量下载脚本</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                

            </div>
        `;
        
        this.addPreviewStyles();
        document.body.appendChild(this.previewPanel);
        this.setupPreviewEvents();
        
        // 自动启动网络监听
        this.startNetworkMonitoring();
        
        // 设置定时刷新网络文件
        this.setupNetworkFileRefresh();
    }
    
    addPreviewStyles() {
        if (document.getElementById('web-download-preview-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'web-download-preview-styles';
        styles.textContent = `
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
            
            .network-monitor-tip {
                padding: 8px 20px;
                background: linear-gradient(90deg, #f0f9ff, #e0f2fe);
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: #0369a1;
                flex-shrink: 0;
            }
            
            .network-monitor-tip .tip-icon {
                font-size: 12px;
                animation: spin 2s linear infinite;
            }
            
            .network-monitor-tip .tip-text {
                font-weight: 500;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            .preview-filters {
                background: white;
                border-bottom: 1px solid #e2e8f0;
                flex-shrink: 0;
            }
            
            .filter-header {
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
                transition: all 0.3s ease;
                border-bottom: 1px solid #f1f5f9;
            }
            
            .filter-header:hover {
                background: #f8fafc;
            }
            
            .filter-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .filter-title {
                font-size: 13px;
                font-weight: 600;
                color: #374151;
            }
            
            .filter-status {
                font-size: 11px;
                color: #6b7280;
                background: #f3f4f6;
                padding: 2px 8px;
                border-radius: 12px;
                font-weight: 500;
            }
            
            .filter-toggle-btn {
                width: 28px;
                height: 28px;
                border: none;
                background: #f1f5f9;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                color: #64748b;
            }
            
            .filter-toggle-btn:hover {
                background: #e2e8f0;
                color: #475569;
                transform: scale(1.05);
            }
            
            .toggle-icon {
                font-size: 12px;
                font-weight: bold;
                transition: transform 0.3s ease;
            }
            
            .filter-toggle-btn.collapsed .toggle-icon {
                transform: rotate(-90deg);
            }
            
            .filter-content {
                padding: 12px 20px;
                transition: all 0.3s ease;
                overflow: hidden;
            }
            
            .filter-content.collapsed {
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
            }
            
            .filter-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .filter-row:last-of-type {
                margin-bottom: 0;
            }
            
            .primary-filters {
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 8px;
            }
            
            .secondary-filters {
                padding-top: 4px;
            }
            
            .size-filters {
                padding-top: 4px;
                border-top: 1px solid #f1f5f9;
            }
            
            .format-filters, .sort-filters {
                padding-top: 4px;
                border-top: 1px solid #f1f5f9;
            }
            
            .filter-label {
                font-size: 11px;
                font-weight: 500;
                color: #555;
                white-space: nowrap;
                margin-right: 4px;
            }
            
            .format-select, .sort-select, .sort-order {
                padding: 4px 6px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 11px;
                background: white;
                cursor: pointer;
                color: #64748b;
            }
            
            .format-select {
                min-width: 100px;
            }
            
            .sort-select {
                min-width: 70px;
            }
            
            .sort-order {
                min-width: 65px;
            }
            
            .format-select:focus, .sort-select:focus, .sort-order:focus {
                outline: none;
                border-color: #4f46e5;
                box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
            }
            
            .action-row {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                justify-content: flex-start;
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #f1f5f9;
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
            
            .filter-btn.primary {
                font-weight: 600;
                border-radius: 6px;
            }
            
            .filter-btn.secondary {
                font-size: 10px;
                border-radius: 12px;
                background: #f8fafc;
            }
            
            .filter-btn.active {
                color: white;
            }
            
            .filter-btn.primary.active {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                border-color: #4f46e5;
            }
            
            .filter-btn.secondary.active {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border-color: #10b981;
            }
            
            .filter-btn.size {
                font-size: 9px;
                border-radius: 10px;
                background: #fef3c7;
                border-color: #f59e0b;
                color: #92400e;
            }
            
            .filter-btn.size.active {
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                border-color: #f59e0b;
                color: white;
            }
            
            .size-range-row {
                padding: 8px 0 4px 0;
                border-top: 1px solid #f1f5f9;
            }
            
            .size-range-container {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .range-input-group {
                display: flex;
                align-items: center;
                gap: 4px;
                min-width: 120px;
            }
            
            .range-input-group label {
                font-size: 10px;
                color: #64748b;
                font-weight: 500;
                min-width: 30px;
            }
            
            .range-input-group input {
                width: 60px;
                padding: 2px 4px;
                border: 1px solid #d1d5db;
                border-radius: 3px;
                font-size: 10px;
                text-align: center;
            }
            
            .range-input-group input:focus {
                outline: none;
                border-color: #f59e0b;
                box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.1);
            }
            
            .range-input-group select {
                padding: 2px 3px;
                border: 1px solid #d1d5db;
                border-radius: 3px;
                font-size: 9px;
                background: white;
                cursor: pointer;
            }
            
            .range-input-group select:focus {
                outline: none;
                border-color: #f59e0b;
            }
            
            .range-separator {
                font-size: 12px;
                color: #64748b;
                font-weight: bold;
                margin: 0 4px;
            }
            
            .apply-range-btn {
                padding: 4px 8px;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 40px;
            }
            
            .apply-range-btn:hover {
                background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
            }
            
            .filter-btn:hover:not(.active) {
                background: #f1f5f9;
                border-color: #94a3b8;
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
            
            .action-btn-small:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            #refresh-files-preview {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border-color: #10b981;
                font-weight: 500;
            }
            
            #refresh-files-preview:hover:not(:disabled) {
                background: linear-gradient(135deg, #059669 0%, #047857 100%);
                border-color: #059669;
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
            }
            
            #clear-all-files {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
                border-color: #ef4444;
                font-weight: 500;
            }
            
            #clear-all-files:hover:not(:disabled) {
                background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                border-color: #dc2626;
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
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
             
             .file-source {
                 font-size: 8px;
                 padding: 1px 4px;
                 border-radius: 2px;
                 font-weight: 500;
                 text-transform: uppercase;
             }
             
             .file-source.page {
                 background: #dbeafe;
                 color: #1e40af;
             }
             
             .file-source.network {
                 background: #d1fae5;
                 color: #065f46;
             }
             
             .file-source.both {
                 background: #fef3c7;
                 color: #92400e;
             }
             
             .file-source-info {
                 display: flex;
                 align-items: center;
                 gap: 4px;
                 flex-wrap: wrap;
             }
             
             .file-source-badge {
                 margin-top: 2px;
             }
             
             .file-time {
                 font-size: 8px;
                 padding: 1px 4px;
                 border-radius: 2px;
                 font-weight: 500;
                 background: #f1f5f9;
                 color: #475569;
                 margin-left: 4px;
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
            
            .download-button-group {
                position: relative;
                display: flex;
                align-items: center;
            }
            
            .download-mode-toggle {
                padding: 8px 6px;
                border: none;
                border-radius: 0 6px 6px 0;
                background: linear-gradient(135deg, #3730a3 0%, #6b21a8 100%);
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-left: -1px;
                border-left: 1px solid rgba(255, 255, 255, 0.2);
                min-width: 32px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .download-mode-toggle:hover {
                background: linear-gradient(135deg, #312e81 0%, #581c87 100%);
                transform: translateY(-1px);
            }
            
            .dropdown-arrow {
                font-size: 10px;
                transition: transform 0.3s ease;
            }
            
            .download-mode-toggle.active .dropdown-arrow {
                transform: rotate(180deg);
            }
            
            .action-btn.primary {
                border-radius: 6px 0 0 6px;
            }
            
            .download-mode-menu {
                position: absolute;
                bottom: 100%;
                right: 0;
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                border: 1px solid #e2e8f0;
                min-width: 280px;
                z-index: 1000000;
                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: all 0.3s ease;
                margin-bottom: 8px;
            }
            
            .download-mode-menu.show {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            
            .download-mode-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: all 0.3s ease;
                border-bottom: 1px solid #f1f5f9;
            }
            
            .download-mode-item:last-child {
                border-bottom: none;
                border-radius: 0 0 8px 8px;
            }
            
            .download-mode-item:first-child {
                border-radius: 8px 8px 0 0;
            }
            
            .download-mode-item:hover {
                background: #f8fafc;
                transform: translateX(2px);
            }
            
            .mode-icon {
                font-size: 18px;
                width: 24px;
                text-align: center;
                flex-shrink: 0;
            }
            
            .mode-info {
                flex: 1;
            }
            
            .mode-title {
                font-size: 13px;
                font-weight: 600;
                color: #1e293b;
                margin-bottom: 2px;
            }
            
            .mode-desc {
                font-size: 11px;
                color: #64748b;
                line-height: 1.3;
            }
            
            .download-mode-item[data-mode="direct"]:hover {
                background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
            }
            
            .download-mode-item[data-mode="links"]:hover {
                background: linear-gradient(135deg, #d1fae5 0%, #dcfce7 100%);
            }
            
            .download-mode-item[data-mode="markdown"]:hover {
                background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
            }
            
            .download-mode-item[data-mode="python"]:hover {
                background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%);
            }
            
            .download-mode-item[data-mode="batch"]:hover {
                background: linear-gradient(135deg, #fce7f3 0%, #fdf2f8 100%);
            }
            
            .download-mode-item[data-mode="curl"]:hover {
                background: linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%);
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
                 
                 .filter-header {
                     padding: 10px 16px;
                 }
                 
                 .filter-title {
                     font-size: 12px;
                 }
                 
                 .filter-status {
                     font-size: 10px;
                     padding: 1px 6px;
                 }
                 
                 .filter-toggle-btn {
                     width: 24px;
                     height: 24px;
                 }
                 
                 .toggle-icon {
                     font-size: 10px;
                 }
                 
                 .filter-content {
                     padding: 10px 16px;
                 }
                 
                 .filter-row {
                     flex-direction: column;
                     align-items: flex-start;
                     gap: 8px;
                 }
                 
                 .primary-filters {
                     border-bottom: none;
                     padding-bottom: 4px;
                 }
                 
                 .secondary-filters {
                     padding-top: 0;
                 }
                 
                 .filter-group {
                     width: 100%;
                     justify-content: center;
                 }
                 
                 .filter-btn {
                     font-size: 9px;
                     padding: 3px 6px;
                 }
                 
                 .filter-btn.secondary {
                     font-size: 8px;
                     padding: 2px 4px;
                 }
                 
                 .filter-btn.size {
                     font-size: 7px;
                     padding: 2px 3px;
                 }
                 
                 .action-row {
                     justify-content: center;
                 }
                 
                 .action-btn-small {
                     font-size: 9px;
                     padding: 3px 6px;
                 }
                 
                 .file-thumbnail {
                     width: 50px;
                     height: 50px;
                 }
                 
                 .file-item-preview {
                     padding: 10px 12px;
                 }
                 
                 .size-range-container {
                     flex-direction: column;
                     gap: 6px;
                 }
                 
                 .range-input-group {
                     min-width: 100px;
                 }
                 
                 .range-input-group input {
                     width: 50px;
                     font-size: 9px;
                 }
                 
                 .range-input-group select {
                     font-size: 8px;
                 }
                 
                 .apply-range-btn {
                     font-size: 9px;
                     padding: 3px 6px;
                     min-width: 35px;
                 }
                 
                 .download-button-group {
                     flex-direction: column;
                     gap: 4px;
                 }
                 
                 .action-btn.primary {
                     border-radius: 6px;
                     font-size: 11px;
                     padding: 6px 10px;
                 }
                 
                 .download-mode-toggle {
                     border-radius: 6px;
                     margin-left: 0;
                     border-left: none;
                     border-top: 1px solid rgba(255, 255, 255, 0.2);
                     height: 28px;
                     font-size: 10px;
                 }
                 
                 .download-mode-menu {
                     min-width: 260px;
                     right: auto;
                     left: 0;
                 }
                 
                 .download-mode-item {
                     padding: 10px 12px;
                 }
                 
                 .mode-icon {
                     font-size: 16px;
                 }
                 
                 .mode-title {
                     font-size: 12px;
                 }
                 
                 .mode-desc {
                     font-size: 10px;
                 }
                 

             }
        `;
        
        document.head.appendChild(styles);
    }
    
    setupPreviewEvents() {
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
        this.previewPanel.querySelectorAll('.filter-btn.primary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSourceFilter(e.target.dataset.filter);
            });
        });
        
        this.previewPanel.querySelectorAll('.filter-btn.secondary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTypeFilter(e.target.dataset.type);
            });
        });
        
        this.previewPanel.querySelectorAll('.filter-btn.size').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSizeFilter(e.target.dataset.size);
            });
        });
        
        // 全选/全不选
        this.previewPanel.querySelector('#select-all-preview').addEventListener('click', () => {
            this.selectAllPreviewFiles();
        });
        
        this.previewPanel.querySelector('#select-none-preview').addEventListener('click', () => {
            this.selectNoPreviewFiles();
        });
        
        // 重新获取文件
        this.previewPanel.querySelector('#refresh-files-preview').addEventListener('click', () => {
            this.refreshFiles();
        });
        
        // 清除全部文件
        this.previewPanel.querySelector('#clear-all-files').addEventListener('click', () => {
            this.clearAllFiles();
        });
        
        // 自定义范围应用按钮
        this.previewPanel.querySelector('#apply-size-range').addEventListener('click', () => {
            this.applySizeRange();
        });
        
        // 格式筛选（如果存在的话）
        const formatFilter = this.previewPanel.querySelector('#format-filter');
        if (formatFilter) {
            formatFilter.addEventListener('change', (e) => {
                this.switchFormatFilter(e.target.value);
            });
        }
        
        // 排序方式
        this.previewPanel.querySelector('#sort-by').addEventListener('change', (e) => {
            this.switchSortBy(e.target.value);
        });
        
        this.previewPanel.querySelector('#sort-order').addEventListener('change', (e) => {
            this.switchSortOrder(e.target.value);
        });
        
        // 筛选区域折叠按钮
        this.previewPanel.querySelector('#filter-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFilterCollapse();
        });
        
        // 筛选头部点击折叠
        this.previewPanel.querySelector('#filter-header').addEventListener('click', () => {
            this.toggleFilterCollapse();
        });
        
        // 取消和确认按钮
        this.previewPanel.querySelector('#cancel-download-preview').addEventListener('click', () => {
            this.hidePreviewPanel();
        });
        
        this.previewPanel.querySelector('#confirm-download-preview').addEventListener('click', () => {
            this.startDownloadFromPreview('direct');
        });
        
        // 下载模式切换按钮
        this.previewPanel.querySelector('#download-mode-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDownloadModeMenu();
        });
        
        // 下载模式菜单项点击
        this.previewPanel.querySelectorAll('.download-mode-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.startDownloadFromPreview(mode);
                this.hideDownloadModeMenu();
            });
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.download-button-group')) {
                this.hideDownloadModeMenu();
            }
        });
        
        // 使用事件委托处理图片预览和复制链接
        this.previewPanel.addEventListener('click', (e) => {
            // 如果点击的是复选框，不处理其他事件
            if (e.target.type === 'checkbox') {
                return;
            }
            
            // 处理预览（图片和视频）
            if (e.target.closest('.image-thumbnail[data-preview-url]') || e.target.closest('.preview-btn[data-preview-url]')) {
                e.preventDefault();
                e.stopPropagation();
                const element = e.target.closest('[data-preview-url]');
                const previewUrl = element.dataset.previewUrl;
                const previewType = element.dataset.previewType;
                
                if (previewUrl) {
                    if (previewType === 'video') {
                        this.showVideoPreview(previewUrl);
                    } else {
                        this.showImagePreview(previewUrl);
                    }
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
        this.updateFilterStatus();
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
        let files = this.foundFiles;
        
        // 第一级过滤：按来源
        if (this.currentSourceFilter && this.currentSourceFilter !== 'all') {
            if (this.currentSourceFilter === 'page') {
                files = files.filter(file => file.source === 'page' || file.source === 'both');
            } else if (this.currentSourceFilter === 'network') {
                files = files.filter(file => file.source === 'network' || file.source === 'both');
            }
        }
        
        // 第二级过滤：按文件类型
        if (this.currentTypeFilter && this.currentTypeFilter !== 'all') {
            files = files.filter(file => file.type === this.currentTypeFilter);
        }
        
        // 第三级过滤：按文件大小
        if (this.currentSizeFilter && this.currentSizeFilter !== 'all') {
            files = files.filter(file => {
                let size = file.size || 0;
                
                // 对于没有大小信息的文件，根据类型进行估算
                if (size === 0) {
                    size = this.estimateFileSizeByType(file);
                }
                
                switch (this.currentSizeFilter) {
                    case 'small':
                        const sizeInMB = size / (1024 * 1024);
                        return sizeInMB < 1;
                    case 'medium':
                        const sizeInMB2 = size / (1024 * 1024);
                        return sizeInMB2 >= 1 && sizeInMB2 <= 10;
                    case 'large':
                        const sizeInMB3 = size / (1024 * 1024);
                        return sizeInMB3 > 10;
                    case 'custom':
                        // 自定义范围过滤
                        const minBytes = this.convertSizeToBytes(this.customSizeRange.min, this.customSizeRange.minUnit);
                        const maxBytes = this.customSizeRange.max !== null ? 
                            this.convertSizeToBytes(this.customSizeRange.max, this.customSizeRange.maxUnit) : 
                            null;
                        
                        if (maxBytes !== null) {
                            return size >= minBytes && size <= maxBytes;
                        } else {
                            return size >= minBytes;
                        }
                    default:
                        return true;
                }
            });
        }
        
        // 第四级过滤：按格式筛选
        if (this.currentFormatFilter && this.currentFormatFilter !== 'all') {
            files = files.filter(file => {
                const extension = this.getFileExtension(file.url).toLowerCase();
                return extension === this.currentFormatFilter.toLowerCase();
            });
        }
        
        // 排序处理
        files = files.sort((a, b) => {
            let comparison = 0;
            
            switch (this.currentSortBy) {
                case 'time':
                    comparison = (b.timestamp || 0) - (a.timestamp || 0);
                    break;
                case 'size':
                    const sizeA = a.size || this.estimateFileSizeByType(a);
                    const sizeB = b.size || this.estimateFileSizeByType(b);
                    comparison = sizeB - sizeA;
                    break;
                case 'name':
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    comparison = nameA.localeCompare(nameB);
                    break;
                case 'type':
                    const typeA = a.type || '';
                    const typeB = b.type || '';
                    comparison = typeA.localeCompare(typeB);
                    break;
                default:
                    comparison = (b.timestamp || 0) - (a.timestamp || 0);
            }
            
            // 根据排序顺序调整结果
            return this.currentSortOrder === 'asc' ? -comparison : comparison;
        });
        
        return files;
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
                        <div class="file-source-info">
                            <span class="file-source ${file.source || 'page'}">${this.getSourceText(file.source)}</span>
                            <span class="file-time">📅 ${file.timeString || '--:--'}</span>
                            <span class="file-size">${this.formatPreviewFileSize(file.size)}</span>
                        </div>
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
                        <div class="file-source-badge">
                            <span class="file-source ${file.source || 'page'}">${this.getSourceText(file.source)}</span>
                            <span class="file-time">📅 ${file.timeString || '--:--'}</span>
                        </div>
                    </div>
                    <div class="file-actions-preview">
                        <div class="file-size-preview">${this.formatPreviewFileSize(file.size)}</div>
                        ${file.type === 'video' ? `<button class="preview-btn" data-preview-url="${file.url}" data-preview-type="video" title="预览视频">👁️</button>` : ''}
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
            case 'audio': return '🎵';
            case 'document': return '📄';
            default: return '📁';
        }
    }
    
    formatPreviewFileSize(size) {
        if (!size || size === 0) return '未知大小';
        
        const bytes = Number(size);
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
    
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    toggleFilterCollapse() {
        this.isFilterCollapsed = !this.isFilterCollapsed;
        
        const filterContent = this.previewPanel.querySelector('#filter-content');
        const toggleBtn = this.previewPanel.querySelector('#filter-toggle-btn');
        
        if (this.isFilterCollapsed) {
            filterContent.classList.add('collapsed');
            toggleBtn.classList.add('collapsed');
        } else {
            filterContent.classList.remove('collapsed');
            toggleBtn.classList.remove('collapsed');
        }
        
        // 更新筛选状态显示
        this.updateFilterStatus();
    }
    
    updateFilterStatus() {
        const statusElement = this.previewPanel.querySelector('#filter-status');
        const filteredFiles = this.getFilteredPreviewFiles();
        const totalFiles = this.foundFiles.length;
        
        let statusText = '';
        
        if (totalFiles === 0) {
            statusText = '暂无文件';
        } else if (filteredFiles.length === totalFiles) {
            statusText = `全部文件 (${totalFiles})`;
        } else {
            statusText = `${filteredFiles.length}/${totalFiles} 个文件`;
        }
        
        // 添加当前筛选条件的简要描述
        const activeFilters = [];
        
        if (this.currentSourceFilter && this.currentSourceFilter !== 'all') {
            activeFilters.push(this.currentSourceFilter === 'page' ? '页面' : '网络');
        }
        
        if (this.currentTypeFilter && this.currentTypeFilter !== 'all') {
            const typeMap = { 'image': '图片', 'video': '视频', 'audio': '音频', 'document': '文档' };
            activeFilters.push(typeMap[this.currentTypeFilter] || this.currentTypeFilter);
        }
        
        if (this.currentSizeFilter && this.currentSizeFilter !== 'all') {
            const sizeMap = { 
                'small': '小文件', 
                'medium': '中文件', 
                'large': '大文件',
                'custom': '自定义大小'
            };
            activeFilters.push(sizeMap[this.currentSizeFilter] || this.currentSizeFilter);
        }
        
        if (this.currentFormatFilter && this.currentFormatFilter !== 'all') {
            activeFilters.push(this.currentFormatFilter.toUpperCase() + '格式');
        }
        
        // 添加排序信息
        if (this.currentSortBy !== 'time' || this.currentSortOrder !== 'desc') {
            const sortMap = {
                'time': '时间',
                'size': '大小', 
                'name': '名称',
                'type': '类型'
            };
            const orderMap = {
                'desc': '↓',
                'asc': '↑'
            };
            const sortText = `${sortMap[this.currentSortBy] || this.currentSortBy}${orderMap[this.currentSortOrder] || ''}`;
            activeFilters.push(`排序:${sortText}`);
        }
        
        if (activeFilters.length > 0) {
            statusText += ` · ${activeFilters.join(' · ')}`;
        }
        
        statusElement.textContent = statusText;
    }
    
    switchSourceFilter(filter) {
        this.currentSourceFilter = filter;
        
        // 更新按钮状态
        this.previewPanel.querySelectorAll('.filter-btn.primary').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    switchTypeFilter(type) {
        this.currentTypeFilter = type;
        
        // 更新按钮状态
        this.previewPanel.querySelectorAll('.filter-btn.secondary').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    switchSizeFilter(size) {
        this.currentSizeFilter = size;
        
        // 更新按钮状态
        this.previewPanel.querySelectorAll('.filter-btn.size').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === size);
        });
        
        // 显示或隐藏自定义范围输入
        const rangeRow = this.previewPanel.querySelector('#size-range-row');
        if (size === 'custom') {
            rangeRow.style.display = 'block';
            // 设置默认值
            this.previewPanel.querySelector('#min-size-input').value = this.customSizeRange.min || '';
            this.previewPanel.querySelector('#max-size-input').value = this.customSizeRange.max || '';
            this.previewPanel.querySelector('#min-size-unit').value = this.customSizeRange.minUnit;
            this.previewPanel.querySelector('#max-size-unit').value = this.customSizeRange.maxUnit;
        } else {
            rangeRow.style.display = 'none';
        }
        
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    switchFormatFilter(format) {
        this.currentFormatFilter = format;
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    switchSortBy(sortBy) {
        this.currentSortBy = sortBy;
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    switchSortOrder(sortOrder) {
        this.currentSortOrder = sortOrder;
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    applySizeRange() {
        const minInput = this.previewPanel.querySelector('#min-size-input');
        const maxInput = this.previewPanel.querySelector('#max-size-input');
        const minUnitSelect = this.previewPanel.querySelector('#min-size-unit');
        const maxUnitSelect = this.previewPanel.querySelector('#max-size-unit');
        const applyBtn = this.previewPanel.querySelector('#apply-size-range');
        
        // 获取输入值
        const minValue = parseFloat(minInput.value) || 0;
        const maxValue = maxInput.value ? parseFloat(maxInput.value) : null;
        const minUnit = minUnitSelect.value;
        const maxUnit = maxUnitSelect.value;
        
        // 验证输入
        if (maxValue !== null && maxValue <= minValue) {
            alert('最大值必须大于最小值！');
            return;
        }
        
        // 保存范围设置
        this.customSizeRange = {
            min: minValue,
            max: maxValue,
            minUnit: minUnit,
            maxUnit: maxUnit
        };
        
        // 显示应用成功状态
        const originalText = applyBtn.textContent;
        applyBtn.textContent = '✅ 已应用';
        applyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        
        setTimeout(() => {
            applyBtn.textContent = originalText;
            applyBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        }, 1000);
        
        // 重新渲染文件列表
        this.renderPreviewFileList();
        this.updateFilterStatus();
    }
    
    convertSizeToBytes(value, unit) {
        const multipliers = {
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024
        };
        return value * (multipliers[unit] || 1);
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
        this.selectedFiles = [];
        
        // 更新所有复选框状态
        this.previewPanel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.updatePreviewStats();
    }
    
    async refreshFiles() {
        const refreshBtn = this.previewPanel.querySelector('#refresh-files-preview');
        const originalText = refreshBtn.textContent;
        
        // 显示加载状态
        refreshBtn.textContent = '🔄 获取中...';
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.6';
        
        try {
            // 获取当前设置
            const settings = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getSettings' }, resolve);
            });
            
            // 同时获取页面文件和网络文件
            const [pageResult, networkFiles] = await Promise.all([
                this.scanPage(settings),
                new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'getNetworkFiles' }, resolve);
                })
            ]);
            
            // 从scanPage结果中提取文件数组
            const pageFiles = pageResult && pageResult.files ? pageResult.files : [];
            

            
            // 合并文件列表，去重
            const allFiles = this.mergeFiles(pageFiles, networkFiles || []);
            
            if (allFiles && allFiles.length > 0) {
                // 更新文件列表
                this.foundFiles = allFiles;
                
                // 保持之前选中的文件（如果仍然存在）
                const previousSelectedUrls = this.selectedFiles.map(f => f.url);
                this.selectedFiles = this.foundFiles.filter(f => previousSelectedUrls.includes(f.url));
                
                // 更新预览内容
                this.updatePreviewContent();
                
                // 显示成功提示
                const pageCount = Array.isArray(pageFiles) ? pageFiles.length : 0;
                const networkCount = Array.isArray(networkFiles) ? networkFiles.length : 0;
                refreshBtn.textContent = `✅ 已更新 (页面:${pageCount} 网络:${networkCount})`;
                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                }, 2000);
            } else {
                // 没有找到文件
                refreshBtn.textContent = '❌ 无文件';
                setTimeout(() => {
                    refreshBtn.textContent = originalText;
                }, 1500);
            }
        } catch (error) {
            console.error('重新获取文件失败:', error);
            refreshBtn.textContent = '❌ 失败';
            setTimeout(() => {
                refreshBtn.textContent = originalText;
            }, 1500);
        } finally {
            // 恢复按钮状态
            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';
            }, 2000);
        }
    }
    
    mergeFiles(pageFiles, networkFiles) {
        const fileMap = new Map();
        
        // 确保参数是数组
        const safePageFiles = Array.isArray(pageFiles) ? pageFiles : [];
        const safeNetworkFiles = Array.isArray(networkFiles) ? networkFiles : [];
        
        // 添加页面文件
        safePageFiles.forEach(file => {
            file.source = 'page';
            fileMap.set(file.url, file);
        });
        
        // 添加网络文件，如果URL已存在则合并信息
        safeNetworkFiles.forEach(file => {
            if (fileMap.has(file.url)) {
                // 合并信息，优先使用网络文件的大小信息
                const existingFile = fileMap.get(file.url);
                existingFile.source = 'both';
                if (file.size && !existingFile.size) {
                    existingFile.size = file.size;
                }
                if (file.mimeType) {
                    existingFile.mimeType = file.mimeType;
                }
            } else {
                // 新的网络文件
                file.source = 'network';
                fileMap.set(file.url, file);
            }
        });
        
        return Array.from(fileMap.values());
    }
    
    toggleDownloadModeMenu() {
        const menu = this.previewPanel.querySelector('#download-mode-menu');
        const toggle = this.previewPanel.querySelector('#download-mode-toggle');
        
        if (menu.classList.contains('show')) {
            this.hideDownloadModeMenu();
        } else {
            menu.classList.add('show');
            toggle.classList.add('active');
        }
    }
    
    hideDownloadModeMenu() {
        const menu = this.previewPanel.querySelector('#download-mode-menu');
        const toggle = this.previewPanel.querySelector('#download-mode-toggle');
        
        if (menu) {
            menu.classList.remove('show');
            toggle.classList.remove('active');
        }
    }
    
    startDownloadFromPreview(mode = 'direct') {
        if (this.selectedFiles.length === 0) {
            alert('请至少选择一个文件进行下载');
            return;
        }
        
        switch (mode) {
            case 'direct':
                this.startDirectDownload();
                // 只有直接下载才关闭预览窗口
                this.hidePreviewPanel();
                break;
            case 'links':
                this.saveLinksAsText();
                break;
            case 'markdown':
                this.saveAsMarkdown();
                break;
            case 'python':
                this.generatePythonScript();
                break;
            case 'batch':
                this.generateBatchScript();
                break;
            case 'curl':
                this.generateCurlScript();
                break;
            default:
                this.startDirectDownload();
                this.hidePreviewPanel();
        }
    }
    
    startDirectDownload() {
        // 发送消息给background script开始下载
        chrome.runtime.sendMessage({
            action: 'startDownload',
            selectedFiles: this.selectedFiles
        });
    }
    
    saveLinksAsText() {
        const timestamp = new Date().toLocaleString('zh-CN');
        const currentUrl = window.location.href;
        
        let content = `# 文件列表\n`;
        content += `# 生成时间: ${timestamp}\n`;
        content += `# 来源页面: ${currentUrl}\n`;
        content += `# 文件数量: ${this.selectedFiles.length}\n`;
        content += `# ========================================\n\n`;
        
        this.selectedFiles.forEach((file, index) => {
            const fileName = file.name || this.extractFilename(file.url) || `文件_${index + 1}`;
            content += `${file.url}\n`;
            content += `\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `文件列表_${this.formatDateForFilename()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    saveAsMarkdown() {
        const currentUrl = window.location.href;
        const timestamp = new Date().toLocaleString('zh-CN');
        
        let markdown = `# 文件列表\n`;
        markdown += `# 生成时间: ${timestamp}\n`;
        markdown += `# 来源页面: ${currentUrl}\n`;
        markdown += `# 文件数量: ${this.selectedFiles.length}\n`;
        markdown += `# ========================================\n\n`;
        
        // 简单的文件列表格式，和文本文件保持一致
        this.selectedFiles.forEach((file, index) => {
            const fileName = file.name || this.extractFilename(file.url) || `文件_${index + 1}`;
            markdown += `${file.url}\n`;
            markdown += `\n`;
        });
        
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `文件列表_${this.formatDateForFilename()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    generatePythonScript() {
        const timestamp = new Date().toLocaleString('zh-CN');
        const currentUrl = window.location.href;
        const fileName = `批量下载_${this.formatDateForFilename()}.py`;
        const downloadDelay = this.currentSettings?.downloadDelay || 0.5;
        
        let script = `#!/usr/bin/env python3\n`;
        script += `# -*- coding: utf-8 -*-\n`;
        script += `"""\n`;
        script += `WebDownUtils - 批量文件下载脚本\n`;
        script += `\n`;
        script += `官网: https://webdownutils.haoapk.cn\n`;
        script += `联系: haoziu@163.com\n`;
        script += `\n`;
        script += `生成时间: ${timestamp}\n`;
        script += `来源页面: ${currentUrl}\n`;
        script += `文件数量: ${this.selectedFiles.length}\n`;
        script += `"""\n\n`;
        
        script += `import os\n`;
        script += `import requests\n`;
        script += `from urllib.parse import urlparse, unquote\n`;
        script += `import time\n\n`;
        
        script += `def download_file(url, filename, folder='downloads'):\n`;
        script += `    """下载单个文件"""\n`;
        script += `    try:\n`;
        script += `        # 创建下载文件夹\n`;
        script += `        if not os.path.exists(folder):\n`;
        script += `            os.makedirs(folder)\n\n`;
        
        script += `        # 设置请求头\n`;
        script += `        headers = {\n`;
        script += `            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'\n`;
        script += `        }\n\n`;
        
        script += `        print(f"正在下载: {filename}")\n`;
        script += `        response = requests.get(url, headers=headers, stream=True)\n`;
        script += `        response.raise_for_status()\n\n`;
        
        script += `        filepath = os.path.join(folder, filename)\n`;
        script += `        with open(filepath, 'wb') as f:\n`;
        script += `            for chunk in response.iter_content(chunk_size=8192):\n`;
        script += `                f.write(chunk)\n\n`;
        
        script += `        print(f"下载完成: {filepath}")\n`;
        script += `        return True\n\n`;
        
        script += `    except Exception as e:\n`;
        script += `        print(f"下载失败 {filename}: {str(e)}")\n`;
        script += `        return False\n\n`;
        
        script += `def main():\n`;
        script += `    """主函数"""\n`;
        script += `    files = [\n`;
        
        this.selectedFiles.forEach(file => {
            const rawFileName = file.name || this.extractFilename(file.url) || 'unknown_file';
            const fileName = this.ensureFileExtension(rawFileName, file.url, file.type);
            script += `        ("${file.url}", "${fileName}"),\n`;
        });
        
        script += `    ]\n\n`;
        
        script += `    print(f"开始下载 {len(files)} 个文件...")\n`;
        script += `    success_count = 0\n`;
        script += `    \n`;
        script += `    for url, filename in files:\n`;
        script += `        if download_file(url, filename):\n`;
        script += `            success_count += 1\n`;
        script += `        time.sleep(${downloadDelay})  # 避免请求过快\n\n`;
        
        script += `    print(f"\\n下载完成！成功: {success_count}/{len(files)}")\n\n`;
        
        script += `if __name__ == "__main__":\n`;
        script += `    main()\n`;
        
        // 下载文件
        const blob = new Blob([script], { type: 'text/python' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // 复制执行命令到剪贴板
        const command = `python3 ${fileName}`;
        this.copyCommandToClipboard(command, 'Python执行命令已复制到剪贴板');
    }
    
    generateBatchScript() {
        const timestamp = new Date().toLocaleString('zh-CN');
        const currentUrl = window.location.href;
        const fileName = `批量下载_${this.formatDateForFilename()}.bat`;
        const downloadDelay = this.currentSettings?.downloadDelay || 0.5;
        
        let script = `@echo off\n`;
        script += `chcp 65001 >nul\n`;
        script += `rem ========================================\n`;
        script += `rem WebDownUtils - 批量文件下载脚本\n`;
        script += `rem 官网: https://webdownutils.haoapk.cn\n`;
        script += `rem 联系: haoziu@163.com\n`;
        script += `rem ========================================\n`;
        script += `rem 生成时间: ${timestamp}\n`;
        script += `rem 来源页面: ${currentUrl}\n`;
        script += `rem 文件数量: ${this.selectedFiles.length}\n\n`;
        
        script += `echo 开始批量下载文件...\n`;
        script += `echo.\n\n`;
        
        script += `rem 创建下载文件夹\n`;
        script += `if not exist "downloads" mkdir downloads\n\n`;
        
        this.selectedFiles.forEach((file, index) => {
            const rawFileName = file.name || this.extractFilename(file.url) || `file_${index + 1}`;
            const fileName = this.ensureFileExtension(rawFileName, file.url, file.type);
            script += `echo 正在下载: ${fileName}\n`;
            script += `curl -L -o "downloads\\${fileName}" "${file.url}"\n`;
            script += `if %errorlevel% equ 0 (\n`;
            script += `    echo 下载成功: ${fileName}\n`;
            script += `) else (\n`;
            script += `    echo 下载失败: ${fileName}\n`;
            script += `)\n`;
            script += `timeout /t ${Math.ceil(downloadDelay)} >nul\n`;
            script += `echo.\n\n`;
        });
        
        script += `echo 所有下载任务已完成！\n`;
        script += `pause\n`;
        
        // 下载文件
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // 复制执行命令到剪贴板
        const command = `"${fileName}"`;
        this.copyCommandToClipboard(command, '批处理执行命令已复制到剪贴板');
    }
    
    generateCurlScript() {
        const timestamp = new Date().toLocaleString('zh-CN');
        const currentUrl = window.location.href;
        const fileName = `批量下载_${this.formatDateForFilename()}.sh`;
        const downloadDelay = this.currentSettings?.downloadDelay || 0.5;
        
        let script = `#!/bin/bash\n`;
        script += `# ========================================\n`;
        script += `# WebDownUtils - 批量文件下载脚本 (cURL)\n`;
        script += `# 官网: https://webdownutils.haoapk.cn\n`;
        script += `# 联系: haoziu@163.com\n`;
        script += `# ========================================\n`;
        script += `# 生成时间: ${timestamp}\n`;
        script += `# 来源页面: ${currentUrl}\n`;
        script += `# 文件数量: ${this.selectedFiles.length}\n\n`;
        
        script += `echo "开始批量下载文件..."\n`;
        script += `echo ""\n\n`;
        
        script += `# 创建下载文件夹\n`;
        script += `mkdir -p downloads\n\n`;
        
        script += `# 设置变量\n`;
        script += `SUCCESS_COUNT=0\n`;
        script += `TOTAL_COUNT=${this.selectedFiles.length}\n\n`;
        
        this.selectedFiles.forEach((file, index) => {
            const rawFileName = file.name || this.extractFilename(file.url) || `file_${index + 1}`;
            const fileName = this.ensureFileExtension(rawFileName, file.url, file.type);
            script += `echo "正在下载: ${fileName}"\n`;
            script += `if curl -L -o "downloads/${fileName}" "${file.url}"; then\n`;
            script += `    echo "✅ 下载成功: ${fileName}"\n`;
            script += `    ((SUCCESS_COUNT++))\n`;
            script += `else\n`;
            script += `    echo "❌ 下载失败: ${fileName}"\n`;
            script += `fi\n`;
            script += `echo ""\n`;
            script += `sleep ${downloadDelay}\n\n`;
        });
        
        script += `echo "下载完成！成功: $SUCCESS_COUNT/$TOTAL_COUNT"\n`;
        
        // 下载文件
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // 复制执行命令到剪贴板
        const command = `chmod +x ${fileName} && ./${fileName}`;
        this.copyCommandToClipboard(command, 'cURL执行命令已复制到剪贴板');
    }
    
    formatDateForFilename() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}`;
    }
    
    copyCommandToClipboard(command, successMessage) {
        navigator.clipboard.writeText(command).then(() => {
            this.showNotification(successMessage, 'success');
        }).catch(() => {
            // 如果剪贴板API失败，尝试使用传统方法
            try {
                const textArea = document.createElement('textarea');
                textArea.value = command;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification(successMessage, 'success');
            } catch (err) {
                this.showNotification('复制失败，请手动复制命令', 'error');
                console.error('复制到剪贴板失败:', err);
            }
        });
    }
    
    showNotification(message, type = 'info') {
        // 移除现有通知
        const existingNotification = document.getElementById('web-download-notification');
        if (existingNotification) {
            document.body.removeChild(existingNotification);
        }
        
        // 创建新通知
        const notification = document.createElement('div');
        notification.id = 'web-download-notification';
        notification.className = `web-download-notification ${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        // 添加样式
        if (!document.getElementById('web-download-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'web-download-notification-styles';
            styles.textContent = `
                .web-download-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    z-index: 10000000;
                    padding: 12px 16px;
                    border-left: 4px solid #3b82f6;
                    animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
                    max-width: 300px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .web-download-notification.success {
                    border-left-color: #10b981;
                }
                
                .web-download-notification.error {
                    border-left-color: #ef4444;
                }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .notification-icon {
                    font-size: 16px;
                    flex-shrink: 0;
                }
                
                .notification-message {
                    font-size: 13px;
                    color: #374151;
                    line-height: 1.4;
                }
                
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 3000);
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
    
    showVideoPreview(videoUrl) {
        // 移除现有的预览
        const existingPreview = document.getElementById('video-preview-modal');
        if (existingPreview) {
            document.body.removeChild(existingPreview);
        }
        
        // 创建视频预览模态框
        const modal = document.createElement('div');
        modal.id = 'video-preview-modal';
        modal.innerHTML = `
            <div class="video-preview-backdrop"></div>
            <div class="video-preview-container">
                <div class="video-preview-header">
                    <span class="video-preview-title">视频预览</span>
                    <button class="video-preview-close">✕</button>
                </div>
                <div class="video-preview-content">
                    <video src="${videoUrl}" controls preload="metadata" onerror="this.parentElement.innerHTML='<div style=&quot;color:#64748b;font-size:14px;text-align:center;padding:40px;&quot;>视频加载失败</div>'">
                        您的浏览器不支持视频播放。
                    </video>
                </div>
                <div class="video-preview-footer">
                    <button class="video-action-btn copy-video-link" data-url="${videoUrl}">复制链接</button>
                    <button class="video-action-btn open-video-tab" data-url="${videoUrl}">新标签页打开</button>
                </div>
            </div>
        `;
            
        // 添加样式
        if (!document.getElementById('video-preview-styles')) {
            const styles = document.createElement('style');
            styles.id = 'video-preview-styles';
            styles.textContent = `
                #video-preview-modal {
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
                
                .video-preview-backdrop {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(4px);
                    cursor: pointer;
                }
                
                .video-preview-container {
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
                
                .video-preview-header {
                    padding: 16px 20px;
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .video-preview-title {
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .video-preview-close {
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
                
                .video-preview-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.05);
                }
                
                .video-preview-content {
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    min-height: 300px;
                    background: #000;
                }
                
                .video-preview-content video {
                    max-width: 100%;
                    max-height: 70vh;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }
                
                .video-preview-footer {
                    padding: 16px 20px;
                    background: #f8fafc;
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    border-top: 1px solid #e2e8f0;
                }
                
                .video-action-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                    color: white;
                }
                
                .video-action-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
                }
            `;
            document.head.appendChild(styles);
        }
        
        // 添加事件监听器
        modal.addEventListener('click', (e) => {
            // 点击背景关闭
            if (e.target.classList.contains('video-preview-backdrop')) {
                modal.remove();
            }
            
            // 关闭按钮
            if (e.target.classList.contains('video-preview-close')) {
                modal.remove();
            }
            
            // 复制链接
            if (e.target.classList.contains('copy-video-link')) {
                const url = e.target.dataset.url;
                navigator.clipboard.writeText(url).then(() => {
                    e.target.textContent = '✅ 已复制';
                    setTimeout(() => {
                        e.target.textContent = '复制链接';
                    }, 1000);
                });
            }
            
            // 新标签页打开
            if (e.target.classList.contains('open-video-tab')) {
                const url = e.target.dataset.url;
                window.open(url, '_blank');
            }
        });
        
        document.body.appendChild(modal);
    }
    
    getSourceText(source) {
        switch (source) {
            case 'page': return '页面文件';
            case 'network': return '网络文件';
            case 'both': return '页面和网络文件';
            default: return '未知来源';
        }
    }
    
    clearAllFiles() {
        // 显示确认对话框
        if (confirm('确定要清除所有文件吗？此操作不可撤销。')) {
            // 清空所有文件列表
            this.foundFiles = [];
            this.selectedFiles = [];
            
            // 重新启动网络监听（这会清除之前的网络文件数据）
            chrome.runtime.sendMessage({ action: 'startNetworkMonitoring' }, () => {
                console.log('已重新启动网络监听，清除旧数据');
            });
            
            // 更新预览内容
            this.updatePreviewContent();
            
            // 显示清除成功的提示
            const clearBtn = this.previewPanel.querySelector('#clear-all-files');
            const originalText = clearBtn.textContent;
            clearBtn.textContent = '✅ 已清除';
            setTimeout(() => {
                clearBtn.textContent = originalText;
            }, 1500);
        }
    }
    
    startNetworkMonitoring() {
        // 启动网络监听
        chrome.runtime.sendMessage({ action: 'startNetworkMonitoring' }, (response) => {
            if (response && response.success) {
                console.log('网络监听已自动启动');
            }
        });
    }
    
    setupNetworkFileRefresh() {
        // 设置定时器，每3秒刷新一次网络文件
        this.networkRefreshInterval = setInterval(() => {
            this.refreshNetworkFiles();
        }, 3000);
    }
    
    async refreshNetworkFiles() {
        try {
            // 获取最新的网络文件
            const networkFiles = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'getNetworkFiles' }, resolve);
            });
            
            if (networkFiles && networkFiles.length > 0) {
                // 合并现有页面文件和新的网络文件
                const pageFiles = this.foundFiles.filter(file => file.source === 'page' || file.source === 'both');
                const allFiles = this.mergeFiles(pageFiles, networkFiles);
                
                // 检查是否有新文件
                const oldCount = this.foundFiles.length;
                this.foundFiles = allFiles;
                
                // 如果文件数量有变化，更新显示
                if (allFiles.length !== oldCount) {
                    this.updatePreviewContent();
                }
            }
        } catch (error) {
            console.error('刷新网络文件失败:', error);
        }
    }
    
    // 清理定时器
    cleanup() {
        if (this.networkRefreshInterval) {
            clearInterval(this.networkRefreshInterval);
            this.networkRefreshInterval = null;
        }
    }
}

// 初始化内容脚本
const scanner = new ContentScanner();
// 为了调试和访问方便，将实例添加到全局
window.contentScanner = scanner; 