// 后台脚本 - 处理下载和扩展生命周期
class BackgroundService {
    constructor() {
        this.downloadQueue = new Map();
        this.activeDownloads = new Set();
        this.init();
    }
    
    init() {
        this.setupMessageListeners();
        this.setupContextMenus();
        this.setupDownloadListeners();
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
            }
        });
    }
    
    setupContextMenus() {
        chrome.runtime.onInstalled.addListener(() => {
            chrome.contextMenus.create({
                id: 'download-image',
                title: '下载此图片',
                contexts: ['image']
            });
            
            chrome.contextMenus.create({
                id: 'download-video',
                title: '下载此视频',
                contexts: ['video']
            });
            
            chrome.contextMenus.create({
                id: 'download-link',
                title: '下载此链接',
                contexts: ['link']
            });
            
            chrome.contextMenus.create({
                id: 'separator1',
                type: 'separator',
                contexts: ['image', 'video', 'link']
            });
            
            chrome.contextMenus.create({
                id: 'scan-page',
                title: '扫描页面所有文件',
                contexts: ['page']
            });
        });
        
        chrome.contextMenus.onClicked.addListener(async (info, tab) => {
            const settings = await this.getSettings();
            
            switch (info.menuItemId) {
                case 'download-image':
                    await this.downloadSingleFile({
                        type: 'image',
                        url: info.srcUrl,
                        name: this.extractFilename(info.srcUrl) || 'image'
                    }, settings);
                    break;
                    
                case 'download-video':
                    await this.downloadSingleFile({
                        type: 'video',
                        url: info.srcUrl,
                        name: this.extractFilename(info.srcUrl) || 'video'
                    }, settings);
                    break;
                    
                case 'download-link':
                    await this.downloadSingleFile({
                        type: 'document',
                        url: info.linkUrl,
                        name: this.extractFilename(info.linkUrl) || 'file'
                    }, settings);
                    break;
                    
                case 'scan-page':
                    // 发送消息给content script扫描页面
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'scanPage',
                        settings: settings
                    }, (response) => {
                        if (response && response.files) {
                            this.downloadFiles(response.files, settings);
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
        
        switch (settings.fileNaming) {
            case 'timestamp':
                return `${timestamp}_${baseName}.${extension}`;
            case 'sequential':
                return `${String(index + 1).padStart(3, '0')}_${baseName}.${extension}`;
            default:
                return file.name || `${baseName}.${extension}`;
        }
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
    
    async getSettings() {
        const defaultSettings = {
            savePath: 'Downloads/WebDownUtils',
            fileNaming: 'original',
            createFolders: true,
            autoDetectPlatform: true,
            maxFiles: 50,
            fileSizeLimit: 100,
            includeImages: true,
            includeVideos: true,
            includeDocuments: false
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
}

// 初始化后台服务
new BackgroundService(); 