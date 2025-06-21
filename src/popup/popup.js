// 插件主要逻辑
class WebDownloadHelper {
    constructor() {
        this.currentTab = null;
        this.isDownloading = false;
        this.downloadQueue = [];
        this.settings = {};
        this.foundFiles = [];
        this.selectedFiles = [];
        this.currentFilter = 'all';
        
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        await this.getCurrentTab();
        this.setupEventListeners();
        this.setupMessageListeners();
        this.detectPlatform();
        this.updateUI();
    }
    
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
    }
    
    async loadSettings() {
        const defaultSettings = {
            savePath: 'Downloads/WebDownUtils',
            fileNaming: 'original',
            createFolders: true,
            autoDetectPlatform: true,
            maxFiles: 50,
            fileSizeLimit: 100,
            includeImages: true,
            includeVideos: true,
            includeDocuments: true
        };
        
        const stored = await chrome.storage.sync.get(defaultSettings);
        this.settings = stored;
    }
    
    setupMessageListeners() {
        // 监听来自content script的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'startDownload':
                    this.startDownloadFromPreview(request.selectedFiles);
                    sendResponse({ success: true });
                    break;
            }
        });
    }
    
    async saveSettings() {
        await chrome.storage.sync.set(this.settings);
        this.showNotification('设置已保存', 'success');
        
        // 保存后自动打开一次预览
        setTimeout(() => {
            this.openPreviewFromSettings();
        }, 500);
    }
    
    async openPreviewFromSettings() {
        // 模拟扫描页面获取文件
        this.updateProgress('正在扫描页面...', 0, 0);
        this.showProgress(true);
        
        try {
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'scanPage',
                settings: this.settings
            });
            
            if (response && response.files && response.files.length > 0) {
                await this.downloadFiles(response.files);
            } else {
                this.showProgress(false);
                this.showNotification('未找到可下载的文件', 'warning');
            }
        } catch (error) {
            this.showProgress(false);
            this.showNotification('扫描页面时出错: ' + error.message, 'error');
        }
    }
    
    setupEventListeners() {
        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
        
        // 下载模式按钮
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleDownloadMode(e.target.dataset.mode);
            });
        });
        

        
        // 设置页面
        document.getElementById('save-path').addEventListener('input', (e) => {
            this.settings.savePath = e.target.value;
        });
        
        document.getElementById('file-naming').addEventListener('change', (e) => {
            this.settings.fileNaming = e.target.value;
        });
        
        document.getElementById('create-folders').addEventListener('change', (e) => {
            this.settings.createFolders = e.target.checked;
        });
        
        document.getElementById('auto-detect-platform').addEventListener('change', (e) => {
            this.settings.autoDetectPlatform = e.target.checked;
        });
        
        document.getElementById('max-files').addEventListener('input', (e) => {
            this.settings.maxFiles = parseInt(e.target.value);
        });
        
        document.getElementById('file-size-limit').addEventListener('input', (e) => {
            this.settings.fileSizeLimit = parseInt(e.target.value);
        });
        
        // 设置按钮
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('reset-settings').addEventListener('click', () => {
            this.resetSettings();
        });
        
        document.getElementById('preview-files').addEventListener('click', () => {
            this.openPreviewFromSettings();
        });
        

        

    }
    
    switchTab(tabName) {
        // 更新标签按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 显示对应内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = content.id === `${tabName}-tab` ? 'block' : 'none';
        });
    }
    
    async detectPlatform() {
        if (!this.currentTab) return;
        
        const url = this.currentTab.url;
        let platform = '通用网站';
        
        if (url.includes('xiaohongshu.com')) {
            platform = '小红书';
        } else if (url.includes('weibo.com')) {
            platform = '微博';
        } else if (url.includes('instagram.com')) {
            platform = 'Instagram';
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
            platform = 'Twitter/X';
        } else if (url.includes('pinterest.com')) {
            platform = 'Pinterest';
        }
        
        document.getElementById('detected-platform').textContent = platform;
    }
    
    updateUI() {
        // 更新设置
        document.getElementById('save-path').value = this.settings.savePath;
        document.getElementById('file-naming').value = this.settings.fileNaming;
        document.getElementById('create-folders').checked = this.settings.createFolders;
        document.getElementById('auto-detect-platform').checked = this.settings.autoDetectPlatform;
        document.getElementById('max-files').value = this.settings.maxFiles;
        document.getElementById('file-size-limit').value = this.settings.fileSizeLimit;
    }
    
    async handleDownloadMode(mode) {
        if (this.isDownloading) {
            this.showNotification('下载正在进行中，请等待完成', 'warning');
            return;
        }
        
        this.isDownloading = true;
        this.showProgress(true);
        
        try {
            switch (mode) {
                case 'full-page':
                    await this.downloadFullPage();
                    break;
                case 'area-select':
                    await this.startAreaSelection();
                    break;
                case 'platform':
                    await this.downloadWithPlatformOptimization();
                    break;
            }
        } catch (error) {
            console.error('下载出错:', error);
            this.showNotification('下载出错: ' + error.message, 'error');
        } finally {
            this.isDownloading = false;
            this.showProgress(false);
        }
    }
    
    async downloadFullPage() {
        this.updateProgress('正在扫描页面...', 0, 0);
        
        // 向content script发送消息
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'scanPage',
            settings: this.settings
        });
        
        if (response && response.files) {
            await this.downloadFiles(response.files);
        }
    }
    
    async startAreaSelection() {
        // 激活区域选择模式
        await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'startAreaSelection'
        });
        
        this.showNotification('请在页面上选择要下载的区域', 'info');
        window.close(); // 关闭popup让用户选择
    }
    
    async downloadWithPlatformOptimization() {
        const url = this.currentTab.url;
        let strategy = 'default';
        
        if (url.includes('xiaohongshu.com')) {
            strategy = 'xiaohongshu';
        }
        
        this.updateProgress('正在使用平台优化策略扫描...', 0, 0);
        
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'scanWithStrategy',
            strategy: strategy,
            settings: this.settings
        });
        
        if (response && response.files) {
            await this.downloadFiles(response.files);
        }
    }
    
    async downloadFiles(files) {
        if (!files || files.length === 0) {
            this.showNotification('未找到可下载的文件', 'warning');
            return;
        }
        
        // 保存找到的文件并显示预览
        this.foundFiles = files.slice(0, this.settings.maxFiles);
        this.selectedFiles = [...this.foundFiles]; // 默认全选
        this.showPreview();
    }
    
    showPreview() {
        // 隐藏进度区域
        this.showProgress(false);
        
        // 发送消息给content script显示预览面板
        chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'showPreview',
            files: this.foundFiles,
            selectedFiles: this.selectedFiles
        });
        
        // 关闭popup
        window.close();
    }
    
    hidePreview() {
        // 发送消息给content script隐藏预览面板
        chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'hidePreview'
        });
        
        this.foundFiles = [];
        this.selectedFiles = [];
    }
    

    
    async startDownloadFromPreview(selectedFiles) {
        if (!selectedFiles || selectedFiles.length === 0) {
            this.showNotification('请至少选择一个文件', 'warning');
            return;
        }
        
        this.showProgress(true);
        this.updateProgress('开始下载...', 0, selectedFiles.length);
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            try {
                this.updateProgress(`正在下载: ${file.name}`, i, selectedFiles.length);
                
                const filename = this.generateFilename(file, i);
                const folder = this.settings.createFolders ? this.getFolderName() : '';
                const fullPath = folder ? `${this.settings.savePath}/${folder}/${filename}` : `${this.settings.savePath}/${filename}`;
                
                await chrome.downloads.download({
                    url: file.url,
                    filename: fullPath,
                    conflictAction: 'uniquify'
                });
                
                successCount++;
            } catch (error) {
                console.error(`下载失败: ${file.name}`, error);
                failCount++;
            }
            
            // 添加延迟避免请求过快
            await this.delay(200);
        }
        
        this.updateProgress('下载完成', selectedFiles.length, selectedFiles.length);
        this.showNotification(`下载完成！成功: ${successCount}, 失败: ${failCount}`, 'success');
        
        // 通知content script隐藏预览
        chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'hidePreview'
        });
        
        // 重置状态
        setTimeout(() => {
            this.showProgress(false);
        }, 2000);
    }
    
    generateFilename(file, index) {
        const extension = file.url.split('.').pop().split('?')[0];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        switch (this.settings.fileNaming) {
            case 'timestamp':
                return `${timestamp}_${file.name || `file_${index}`}.${extension}`;
            case 'sequential':
                return `${String(index + 1).padStart(3, '0')}_${file.name || `file`}.${extension}`;
            default:
                return file.name || `file_${index}.${extension}`;
        }
    }
    
    getFolderName() {
        const hostname = new URL(this.currentTab.url).hostname;
        return hostname.replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    showProgress(show) {
        document.getElementById('progress-section').style.display = show ? 'block' : 'none';
    }
    
    updateProgress(text, current, total) {
        document.getElementById('progress-text').textContent = text;
        document.getElementById('progress-count').textContent = `${current}/${total}`;
        
        const percentage = total > 0 ? (current / total) * 100 : 0;
        document.getElementById('progress-fill').style.width = `${percentage}%`;
    }
    
    showNotification(message, type = 'info') {
        // 简单的通知实现，可以后续改进
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 创建临时通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            max-width: 250px;
            word-wrap: break-word;
        `;
        
        // 根据类型设置颜色
        switch (type) {
            case 'success':
                notification.style.background = '#10b981';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.background = '#ef4444';
                notification.style.color = 'white';
                break;
            case 'warning':
                notification.style.background = '#f59e0b';
                notification.style.color = 'white';
                break;
            default:
                notification.style.background = '#3b82f6';
                notification.style.color = 'white';
        }
        
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);
        
        // 3秒后自动移除
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    async resetSettings() {
        const defaultSettings = {
            savePath: 'Downloads/WebDownUtils',
            fileNaming: 'original',
            createFolders: true,
            autoDetectPlatform: true,
            maxFiles: 50,
            fileSizeLimit: 100,
            includeImages: true,
            includeVideos: true,
            includeDocuments: true
        };
        
        this.settings = defaultSettings;
        await this.saveSettings();
        this.updateUI();
        this.showNotification('设置已重置为默认值', 'success');
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new WebDownloadHelper();
}); 