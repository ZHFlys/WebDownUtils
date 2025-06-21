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
            const downloadId = await chrome.downloads.download({
                url: file.url,
                filename: fullPath,
                conflictAction: 'uniquify',
                saveAs: false
            });
            
            this.activeDownloads.add(downloadId);
            this.downloadQueue.set(downloadId, file);
            
            return downloadId;
        } catch (error) {
            throw new Error(`下载失败: ${error.message}`);
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
    
    getFileExtension(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
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
    
    async getSettings() {
        const defaultSettings = {
            savePath: 'Downloads/WebDownUtils',
            fileNaming: 'original',
            createFolders: true,
            autoDetectPlatform: true,
            maxFiles: 50,
            fileSizeLimit: 100,
            downloadDelay: 0.5,
            includeImages: true,
            includeVideos: true,
            includeDocuments: true
        };
        
        const stored = await chrome.storage.sync.get(defaultSettings);
        return stored;
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
        // 监听网络请求
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if (this.isMediaFile(details.url)) {
                    this.addNetworkFile(details.tabId, details.url, details.type);
                }
            },
            { urls: ["<all_urls>"] },
            ["requestBody"]
        );
        
        // 监听响应头，获取文件大小等信息
        chrome.webRequest.onResponseStarted.addListener(
            (details) => {
                if (this.isMediaFile(details.url)) {
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
    
    isMediaFile(url) {
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
            
            return mediaExtensions.some(ext => pathname.endsWith(ext));
        } catch {
            return false;
        }
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
                // 根据MIME类型更新文件类型
                if (contentType.value.startsWith('video/')) {
                    file.type = 'video';
                } else if (contentType.value.startsWith('audio/')) {
                    file.type = 'audio';
                } else if (contentType.value.startsWith('image/')) {
                    file.type = 'image';
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