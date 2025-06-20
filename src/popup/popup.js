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
            includeDocuments: false
        };
        
        const stored = await chrome.storage.sync.get(defaultSettings);
        this.settings = stored;
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
        
        // 下载选项
        document.getElementById('include-images').addEventListener('change', (e) => {
            this.settings.includeImages = e.target.checked;
        });
        
        document.getElementById('include-videos').addEventListener('change', (e) => {
            this.settings.includeVideos = e.target.checked;
        });
        
        document.getElementById('include-documents').addEventListener('change', (e) => {
            this.settings.includeDocuments = e.target.checked;
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
        
        // 预览区域事件监听
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchFilter(e.target.dataset.filter);
            });
        });
        
        document.getElementById('select-all').addEventListener('click', () => {
            this.selectAllFiles();
        });
        
        document.getElementById('select-none').addEventListener('click', () => {
            this.selectNoFiles();
        });
        
        document.getElementById('cancel-download').addEventListener('click', () => {
            this.hidePreview();
        });
        
        document.getElementById('confirm-download').addEventListener('click', () => {
            this.startDownload();
        });
        
        // 弹窗关闭事件
        document.getElementById('close-preview').addEventListener('click', () => {
            this.hidePreview();
        });
        
        document.getElementById('preview-backdrop').addEventListener('click', () => {
            this.hidePreview();
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
        // 更新下载选项
        document.getElementById('include-images').checked = this.settings.includeImages;
        document.getElementById('include-videos').checked = this.settings.includeVideos;
        document.getElementById('include-documents').checked = this.settings.includeDocuments;
        
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
        // 隐藏进度区域，显示预览弹窗
        this.showProgress(false);
        document.getElementById('preview-modal').style.display = 'flex';
        
        this.updatePreviewStats();
        this.renderFileList();
        
        // 阻止主窗口滚动
        document.body.style.overflow = 'hidden';
    }
    
    hidePreview() {
        document.getElementById('preview-modal').style.display = 'none';
        this.foundFiles = [];
        this.selectedFiles = [];
        
        // 恢复主窗口滚动
        document.body.style.overflow = 'auto';
    }
    
    updatePreviewStats() {
        const count = this.selectedFiles.length;
        document.getElementById('preview-count').textContent = `已选择 ${count} 个文件`;
        document.getElementById('download-count').textContent = count;
        
        // 更新下载按钮状态
        const confirmBtn = document.getElementById('confirm-download');
        confirmBtn.disabled = count === 0;
        if (count === 0) {
            confirmBtn.style.opacity = '0.5';
            confirmBtn.style.cursor = 'not-allowed';
        } else {
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }
    
    renderFileList() {
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';
        
        const filteredFiles = this.getFilteredFiles();
        
        if (filteredFiles.length === 0) {
            fileList.className = 'file-list empty';
            fileList.innerHTML = '<div>没有找到符合条件的文件</div>';
            return;
        }
        
        fileList.className = 'file-list';
        filteredFiles.forEach((file, index) => {
            const fileItem = this.createFileItem(file, index);
            fileList.appendChild(fileItem);
        });
    }
    
    getFilteredFiles() {
        if (this.currentFilter === 'all') {
            return this.foundFiles;
        }
        return this.foundFiles.filter(file => file.type === this.currentFilter);
    }
    
    createFileItem(file, index) {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        const isSelected = this.selectedFiles.includes(file);
        
        item.innerHTML = `
            <div class="file-checkbox">
                <input type="checkbox" ${isSelected ? 'checked' : ''} data-index="${index}">
            </div>
            <div class="file-info">
                <div class="file-type-icon ${file.type}">
                    ${this.getTypeIcon(file.type)}
                </div>
                <div class="file-details">
                    <div class="file-name">${file.name || 'unnamed'}</div>
                    <div class="file-url">${file.url}</div>
                </div>
                <div class="file-size">${this.formatFileSize(file.size)}</div>
            </div>
        `;
        
        // 添加复选框事件监听
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!this.selectedFiles.includes(file)) {
                    this.selectedFiles.push(file);
                }
            } else {
                const fileIndex = this.selectedFiles.indexOf(file);
                if (fileIndex > -1) {
                    this.selectedFiles.splice(fileIndex, 1);
                }
            }
            this.updatePreviewStats();
        });
        
        return item;
    }
    
    getTypeIcon(type) {
        switch (type) {
            case 'image': return '🖼️';
            case 'video': return '🎥';
            case 'document': return '📄';
            default: return '📁';
        }
    }
    
    formatFileSize(size) {
        if (!size) return '未知';
        if (size < 1024) return size + 'B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + 'KB';
        return (size / (1024 * 1024)).toFixed(1) + 'MB';
    }
    
    switchFilter(filter) {
        this.currentFilter = filter;
        
        // 更新按钮状态
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.renderFileList();
    }
    
    selectAllFiles() {
        const filteredFiles = this.getFilteredFiles();
        filteredFiles.forEach(file => {
            if (!this.selectedFiles.includes(file)) {
                this.selectedFiles.push(file);
            }
        });
        this.updatePreviewStats();
        this.renderFileList();
    }
    
    selectNoFiles() {
        const filteredFiles = this.getFilteredFiles();
        filteredFiles.forEach(file => {
            const fileIndex = this.selectedFiles.indexOf(file);
            if (fileIndex > -1) {
                this.selectedFiles.splice(fileIndex, 1);
            }
        });
        this.updatePreviewStats();
        this.renderFileList();
    }
    
    async startDownload() {
        if (this.selectedFiles.length === 0) {
            this.showNotification('请至少选择一个文件', 'warning');
            return;
        }
        
        // 隐藏预览，显示进度
        this.hidePreview();
        this.showProgress(true);
        
        const files = this.selectedFiles;
        this.updateProgress('开始下载...', 0, files.length);
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                this.updateProgress(`正在下载: ${file.name}`, i, files.length);
                
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
        
        this.updateProgress('下载完成', files.length, files.length);
        this.showNotification(`下载完成！成功: ${successCount}, 失败: ${failCount}`, 'success');
        
        // 重置状态
        setTimeout(() => {
            this.showProgress(false);
            this.foundFiles = [];
            this.selectedFiles = [];
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
            includeDocuments: false
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