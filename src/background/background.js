// 后台脚本 - 处理下载和扩展生命周期
class BackgroundService {
    constructor() {
        this.downloadQueue = new Map();
        this.activeDownloads = new Set();
        this.networkFiles = new Map(); // 存储网络请求捕获的文件
        this.init();
    }
    
    init() {
        this.setupMessageListeners();
        this.setupContextMenus();
        this.setupDownloadListeners();
        this.setupNetworkListeners();
    }
    
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'areaSelectionComplete':
                    this.handleAreaSelectionComplete(request.files, sender.tab);
                    break;
                case 'startDownload':
                    this.handleStartDownload(request.selectedFiles).then(sendResponse);
                    return true;
                case 'downloadFiles':
                    this.downloadFiles(request.files, request.settings).then(sendResponse);
                    return true;
                case 'getSettings':
                    this.getSettings().then(sendResponse);
                    return true;
                case 'getNetworkFiles':
                    this.getNetworkFiles(sender.tab.id).then(sendResponse);
                    return true;
                case 'startNetworkMonitoring':
                    this.startNetworkMonitoring(sender.tab.id);
                    sendResponse({ success: true });
                    break;
                case 'stopNetworkMonitoring':
                    this.stopNetworkMonitoring(sender.tab.id);
                    sendResponse({ success: true });
                    break;
            }
        });
    }
    
    setupContextMenus() {
        chrome.runtime.onInstalled.addListener(() => {
            chrome.contextMenus.create({
                id: 'scan-page',
                title: '扫描页面所有文件',
                contexts: ['page']
            });
        });
        
        chrome.contextMenus.onClicked.addListener(async (info, tab) => {
            const settings = await this.getSettings();
            
            switch (info.menuItemId) {
                case 'scan-page':
                    // 发送消息给content script扫描页面并显示预览窗口
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'scanPage',
                        settings: settings
                    }, (response) => {
                        if (response && response.files) {
                            // 显示预览面板而不是直接下载
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'showPreview',
                                files: response.files,
                                selectedFiles: [],
                                settings: settings
                            });
                        }
                    });
                    break;
            }
        });
    }
    
    setupDownloadListeners() {
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            if (downloadDelta.state && downloadDelta.state.current === 'complete') {
                this.activeDownloads.delete(downloadDelta.id);
                this.notifyDownloadComplete(downloadDelta.id);
            }
            
            if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
                this.activeDownloads.delete(downloadDelta.id);
                this.notifyDownloadError(downloadDelta.id);
            }
        });
    }
    
    async handleAreaSelectionComplete(files, tab) {
        const settings = await this.getSettings();
        await this.downloadFiles(files, settings);
        
        // 通知用户
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: 'Web批量下载助手',
            message: `找到 ${files.length} 个文件，开始下载...`
        });
    }
    
    async handleStartDownload(selectedFiles) {
        if (!selectedFiles || selectedFiles.length === 0) {
            return { success: false, error: '没有选择文件' };
        }
        
        try {
            const settings = await this.getSettings();
            const result = await this.downloadFiles(selectedFiles, settings);
            return { success: true, result };
        } catch (error) {
            console.error('下载失败:', error);
            return { success: false, error: error.message };
        }
    }
    
    async downloadFiles(files, settings) {
        if (!files || files.length === 0) return;
        
        const limitedFiles = files.slice(0, settings.maxFiles);
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < limitedFiles.length; i++) {
            const file = limitedFiles[i];
            
            try {
                await this.downloadSingleFile(file, settings, i);
                successCount++;
            } catch (error) {
                console.error(`下载失败: ${file.name}`, error);
                failCount++;
            }
            
            // 添加延迟避免请求过快
            await this.delay(300);
        }
        
        // 显示完成通知
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon48.png',
            title: '下载完成',
            message: `成功: ${successCount}, 失败: ${failCount}`
        });
        
        return { success: successCount, failed: failCount };
    }
    
    async downloadSingleFile(file, settings, index = 0) {
        const filename = this.generateFilename(file, settings, index);
        const folder = settings.createFolders ? await this.getFolderName() : '';
        const fullPath = folder ? `${settings.savePath}/${folder}/${filename}` : `${settings.savePath}/${filename}`;
        
        try {
            // 如果启用了格式转换且是图片文件，进行转换处理
            if (settings.enableFormatConversion && this.isImageFile(file)) {
                return await this.downloadAndConvertImage(file, fullPath, settings);
            } else {
                // 直接下载
                const downloadId = await chrome.downloads.download({
                    url: file.url,
                    filename: fullPath,
                    conflictAction: 'uniquify',
                    saveAs: false
                });
                
                this.activeDownloads.add(downloadId);
                this.downloadQueue.set(downloadId, file);
                
                return downloadId;
            }
        } catch (error) {
            throw new Error(`下载失败: ${error.message}`);
        }
    }
    
    async downloadAndConvertImage(file, fullPath, settings) {
        try {
            // 获取图片数据
            const response = await fetch(file.url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const blob = await response.blob();
            
            // 转换图片格式
            const convertedBlob = await this.convertImageFormat(blob, settings.targetFormat, settings.conversionQuality);
            
            // 更新文件路径以匹配新格式
            const convertedPath = this.updateFileExtension(fullPath, settings.targetFormat);
            
            // 创建对象URL并下载
            const objectUrl = URL.createObjectURL(convertedBlob);
            
            const downloadId = await chrome.downloads.download({
                url: objectUrl,
                filename: convertedPath,
                conflictAction: 'uniquify',
                saveAs: false
            });
            
            this.activeDownloads.add(downloadId);
            this.downloadQueue.set(downloadId, file);
            
            // 清理对象URL
            setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
            }, 5000);
            
            return downloadId;
            
        } catch (error) {
            console.error('图片转换失败:', error);
            // 转换失败时回退到直接下载
            const downloadId = await chrome.downloads.download({
                url: file.url,
                filename: fullPath,
                conflictAction: 'uniquify',
                saveAs: false
            });
            
            this.activeDownloads.add(downloadId);
            this.downloadQueue.set(downloadId, file);
            
            return downloadId;
        }
    }
    
    generateFilename(file, settings, index) {
        const extension = this.getFileExtension(file.url) || this.getTypeExtension(file.type);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = file.name ? file.name.replace(/\.[^/.]+$/, '') : `file_${index}`;
        
        let finalName;
        switch (settings.fileNaming) {
            case 'timestamp':
                finalName = `${timestamp}_${baseName}.${extension}`;
                break;
            case 'sequential':
                finalName = `${String(index + 1).padStart(3, '0')}_${baseName}.${extension}`;
                break;
            default:
                finalName = file.name || `${baseName}.${extension}`;
                break;
        }
        
        // 确保文件名有后缀，如果没有就添加合适的后缀
        if (!this.hasFileExtension(finalName)) {
            finalName = `${finalName}.${extension}`;
        }
        
        return finalName;
    }
    
    async getFolderName() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            const hostname = new URL(tab.url).hostname;
            return hostname.replace(/[^a-zA-Z0-9]/g, '_');
        }
        return 'unknown_site';
    }
    
    getFileExtension(urlOrFilename) {
        try {
            let filename;
            
            // 如果是URL，提取文件名
            if (urlOrFilename.startsWith('http://') || urlOrFilename.startsWith('https://')) {
                const urlObj = new URL(urlOrFilename);
                const pathname = urlObj.pathname;
                filename = pathname.split('/').pop();
            } else {
                // 如果是文件名，直接使用
                filename = urlOrFilename;
            }
            
            if (filename && filename.includes('.')) {
                return filename.split('.').pop();
            }
        } catch {}
        return '';
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
    
    hasFileExtension(filename) {
        if (!filename) return false;
        const parts = filename.split('.');
        return parts.length > 1 && parts[parts.length - 1].length > 0;
    }
    
    hasProperExtension(filename, mimeType) {
        if (!filename || !mimeType) return false;
        
        const extension = this.getFileExtension(filename);
        if (!extension) return false;
        
        const expectedExtension = this.getExtensionFromMimeType(mimeType);
        return expectedExtension && extension.toLowerCase() === expectedExtension.toLowerCase();
    }
    
    getExtensionFromMimeType(mimeType) {
        if (!mimeType) return null;
        
        const mimeToExt = {
            // 图片格式
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/svg+xml': 'svg',
            'image/tiff': 'tiff',
            'image/ico': 'ico',
            'image/x-icon': 'ico',
            // 视频格式
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/avi': 'avi',
            'video/mov': 'mov',
            'video/quicktime': 'mov',
            'video/wmv': 'wmv',
            'video/flv': 'flv',
            'video/mkv': 'mkv',
            'video/3gp': '3gp',
            // 音频格式
            'audio/mpeg': 'mp3',
            'audio/mp3': 'mp3',
            'audio/wav': 'wav',
            'audio/x-wav': 'wav',
            'audio/flac': 'flac',
            'audio/aac': 'aac',
            'audio/ogg': 'ogg',
            'audio/m4a': 'm4a',
            'audio/wma': 'wma',
            // 文档格式
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-powerpoint': 'ppt',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
            'application/zip': 'zip',
            'application/x-rar': 'rar'
        };
        
        const lowerMimeType = mimeType.toLowerCase().split(';')[0]; // 移除参数部分
        return mimeToExt[lowerMimeType] || null;
    }
    
    async getSettings() {
        const defaultSettings = {
            savePath: 'Downloads/WebDownUtils',
            fileNaming: 'original',
            createFolders: true,
            autoDetectPlatform: true,
            maxFiles: 50,
            fileSizeLimit: 100,
            zipThreshold: 3,
            downloadDelay: 0.5,
            showFormatFilter: false,
            enableFormatConversion: false,
            targetFormat: 'jpg',
            conversionQuality: 0.8,
            includeImages: true,
            includeVideos: true,
            includeDocuments: true,
            formats: {
                // 图片格式
                jpg: true,
                png: true,
                gif: true,
                webp: true,
                svg: true,
                // 视频格式
                mp4: true,
                webm: true,
                avi: true,
                mov: true,
                mkv: true,
                // 音频格式
                mp3: true,
                wav: true,
                flac: true,
                aac: true,
                ogg: true,
                m4a: true,
                // 文档格式
                pdf: true,
                doc: true,
                docx: true,
                xls: true,
                xlsx: true,
                ppt: true,
                pptx: true
            }
        };
        
        const stored = await chrome.storage.sync.get(defaultSettings);
        return stored;
    }
    
    // 图片格式转换相关方法
    isImageFile(file) {
        if (file.type === 'image') return true;
        
        const url = file.url || '';
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        return imageExtensions.some(ext => url.toLowerCase().includes(ext));
    }
    
    updateFileExtension(filePath, newExtension) {
        const lastDotIndex = filePath.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return `${filePath}.${newExtension}`;
        }
        return `${filePath.substring(0, lastDotIndex)}.${newExtension}`;
    }
    
    async convertImageFormat(blob, targetFormat, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                try {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // 绘制图片到canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // 根据目标格式转换
                    let mimeType;
                    switch (targetFormat) {
                        case 'jpg':
                        case 'jpeg':
                            mimeType = 'image/jpeg';
                            break;
                        case 'png':
                            mimeType = 'image/png';
                            break;
                        case 'webp':
                            mimeType = 'image/webp';
                            break;
                        default:
                            mimeType = 'image/jpeg';
                    }
                    
                    // 转换为blob
                    canvas.toBlob((convertedBlob) => {
                        if (convertedBlob) {
                            resolve(convertedBlob);
                        } else {
                            reject(new Error('图片转换失败'));
                        }
                    }, mimeType, quality);
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
            
            // 加载图片
            img.src = URL.createObjectURL(blob);
        });
    }
    
    notifyDownloadComplete(downloadId) {
        const file = this.downloadQueue.get(downloadId);
        if (file) {
            console.log(`下载完成: ${file.name}`);
            this.downloadQueue.delete(downloadId);
        }
    }
    
    notifyDownloadError(downloadId) {
        const file = this.downloadQueue.get(downloadId);
        if (file) {
            console.error(`下载失败: ${file.name}`);
            this.downloadQueue.delete(downloadId);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    setupNetworkListeners() {
        // 监听网络请求 - 先基于URL判断可能的媒体文件
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (this.isPotentialMediaFile(details.url)) {
                    this.addNetworkFile(details.tabId, details.url, details.type);
                }
            },
            { urls: ["<all_urls>"] },
            ["requestBody"]
        );
        
        // 监听响应头，获取文件大小等信息，并基于content-type最终确认
        chrome.webRequest.onResponseStarted.addListener(
            (details) => {
                const contentType = this.getContentTypeFromHeaders(details.responseHeaders);
                
                // 如果是媒体文件的content-type，或者URL看起来像媒体文件
                if (this.isMediaContentType(contentType) || this.isPotentialMediaFile(details.url)) {
                    // 如果之前没有添加过，现在添加
                    if (!this.hasNetworkFile(details.tabId, details.url)) {
                        this.addNetworkFile(details.tabId, details.url, details.type);
                    }
                    // 更新文件信息
                    this.updateNetworkFileInfo(details.tabId, details.url, details.responseHeaders);
                }
            },
            { urls: ["<all_urls>"] },
            ["responseHeaders"]
        );
        
        // 清理标签页关闭时的数据
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.networkFiles.delete(tabId);
        });
    }
    
    isPotentialMediaFile(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            
            // 检查文件扩展名
            const mediaExtensions = [
                // 视频格式
                '.mp4', '.webm', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.m4v', '.3gp',
                // 音频格式
                '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma',
                // 图片格式
                '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff',
                // 文档格式
                '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar'
            ];
            
            // 如果有明确的媒体文件扩展名，直接返回true
            if (mediaExtensions.some(ext => pathname.endsWith(ext))) {
                return true;
            }
            
            // 对于没有扩展名的URL，检查路径特征
            // 比如包含 /images/, /media/, /uploads/ 等路径的可能是媒体文件
            const mediaPathPatterns = [
                '/images/', '/image/', '/img/', '/pics/', '/pictures/',
                '/media/', '/assets/', '/uploads/', '/files/',
                '/video/', '/videos/', '/audio/', '/sounds/',
                '/download/', '/attachment/'
            ];
            
            return mediaPathPatterns.some(pattern => pathname.includes(pattern));
        } catch {
            return false;
        }
    }
    
    isMediaContentType(contentType) {
        if (!contentType) return false;
        
        const mediaTypes = [
            // 图片类型
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 
            'image/bmp', 'image/svg+xml', 'image/tiff', 'image/ico', 'image/x-icon',
            // 视频类型
            'video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/wmv',
            'video/flv', 'video/mkv', 'video/3gp', 'video/quicktime',
            // 音频类型
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 'audio/aac',
            'audio/ogg', 'audio/m4a', 'audio/wma', 'audio/x-wav',
            // 文档类型
            'application/pdf', 'application/msword', 'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint', 'application/zip', 'application/x-rar'
        ];
        
        const lowerContentType = contentType.toLowerCase();
        return mediaTypes.some(type => lowerContentType.includes(type));
    }
    
    getContentTypeFromHeaders(headers) {
        if (!headers) return null;
        
        const contentTypeHeader = headers.find(header => 
            header.name.toLowerCase() === 'content-type'
        );
        
        return contentTypeHeader ? contentTypeHeader.value : null;
    }
    
    hasNetworkFile(tabId, url) {
        const tabFiles = this.networkFiles.get(tabId);
        return tabFiles && tabFiles.has(url);
    }
    
    addNetworkFile(tabId, url, requestType) {
        if (!this.networkFiles.has(tabId)) {
            this.networkFiles.set(tabId, new Map());
        }
        
        const tabFiles = this.networkFiles.get(tabId);
        
        if (!tabFiles.has(url)) {
            const currentTime = new Date();
            const file = {
                url: url,
                name: this.extractFilename(url) || this.generateNameFromUrl(url),
                type: this.getFileTypeFromUrl(url),
                size: null,
                timestamp: currentTime.getTime(),
                timeString: this.formatTime(currentTime),
                requestType: requestType
            };
            
            tabFiles.set(url, file);
        }
    }
    
    updateNetworkFileInfo(tabId, url, responseHeaders) {
        const tabFiles = this.networkFiles.get(tabId);
        if (tabFiles && tabFiles.has(url)) {
            const file = tabFiles.get(url);
            
            // 从响应头获取文件大小
            const contentLength = responseHeaders.find(header => 
                header.name.toLowerCase() === 'content-length'
            );
            if (contentLength) {
                file.size = parseInt(contentLength.value);
            }
            
            // 从响应头获取文件类型
            const contentType = responseHeaders.find(header => 
                header.name.toLowerCase() === 'content-type'
            );
            if (contentType) {
                file.mimeType = contentType.value;
                const mimeType = contentType.value.toLowerCase();
                
                // 根据MIME类型更新文件类型，优先使用MIME类型判断
                if (mimeType.startsWith('image/')) {
                    file.type = 'image';
                } else if (mimeType.startsWith('video/')) {
                    file.type = 'video';
                } else if (mimeType.startsWith('audio/')) {
                    file.type = 'audio';
                } else if (mimeType.includes('pdf') || mimeType.includes('document') || 
                          mimeType.includes('spreadsheet') || mimeType.includes('presentation') ||
                          mimeType.includes('zip') || mimeType.includes('rar')) {
                    file.type = 'document';
                }
                
                // 如果文件名没有合适的扩展名，根据MIME类型添加
                if (!this.hasProperExtension(file.name, mimeType)) {
                    const extension = this.getExtensionFromMimeType(mimeType);
                    if (extension) {
                        // 移除旧扩展名（如果有的话）并添加新的
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                        file.name = `${nameWithoutExt}.${extension}`;
                    }
                }
            }
        }
    }
    
    getFileTypeFromUrl(url) {
        try {
            const pathname = new URL(url).pathname.toLowerCase();
            
            if (pathname.includes('.mp4') || pathname.includes('.webm') || 
                pathname.includes('.avi') || pathname.includes('.mov')) {
                return 'video';
            }
            if (pathname.includes('.mp3') || pathname.includes('.wav') || 
                pathname.includes('.flac') || pathname.includes('.aac')) {
                return 'audio';
            }
            if (pathname.includes('.jpg') || pathname.includes('.png') || 
                pathname.includes('.gif') || pathname.includes('.webp')) {
                return 'image';
            }
            if (pathname.includes('.pdf') || pathname.includes('.doc') || 
                pathname.includes('.zip')) {
                return 'document';
            }
        } catch {}
        
        return 'unknown';
    }
    
    generateNameFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const segments = pathname.split('/').filter(s => s);
            const lastSegment = segments[segments.length - 1];
            
            let filename;
            if (lastSegment && lastSegment.length > 0) {
                filename = lastSegment;
            } else {
                // 如果没有文件名，使用域名和时间戳
                const hostname = urlObj.hostname;
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
                filename = `${hostname}_${timestamp}`;
            }
            
            // 确保文件名有后缀，如果没有就添加合适的后缀
            if (!this.hasFileExtension(filename)) {
                const extension = this.getFileExtension(url) || this.getTypeExtension(this.getFileTypeFromUrl(url));
                filename = `${filename}.${extension}`;
            }
            
            return filename;
        } catch {
            const timestamp = Date.now();
            const extension = this.getFileExtension(url) || 'file';
            return `network_file_${timestamp}.${extension}`;
        }
    }
    
    formatTime(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    async getNetworkFiles(tabId) {
        const tabFiles = this.networkFiles.get(tabId);
        if (!tabFiles) {
            return [];
        }
        
        // 转换为数组并按时间排序（最新的在前）
        const files = Array.from(tabFiles.values()).sort((a, b) => b.timestamp - a.timestamp);
        
        return files;
    }
    
    startNetworkMonitoring(tabId) {
        // 清空之前的记录
        if (this.networkFiles.has(tabId)) {
            this.networkFiles.get(tabId).clear();
        } else {
            this.networkFiles.set(tabId, new Map());
        }
        
        console.log(`开始监听标签页 ${tabId} 的网络请求`);
    }
    
    stopNetworkMonitoring(tabId) {
        // 保留数据，只是停止新的监听
        console.log(`停止监听标签页 ${tabId} 的网络请求`);
    }
}

// 初始化后台服务
new BackgroundService(); 