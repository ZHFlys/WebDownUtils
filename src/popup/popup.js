// 扩展弹窗脚本
class WebDownloadHelper {
    constructor() {
        this.currentTab = null;
        this.configManager = new ConfigManager();
        this.init();
    }
    
    async init() {
        await this.getCurrentTab();
        await this.loadSettings();
        this.setupEventListeners();
        this.setupTabSwitching();
    }
    
    async getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        this.currentTab = tab;
    }
    
    // 获取兼容的settings对象
    get settings() {
        return this.configManager.getFlatConfig();
    }
    
    setupEventListeners() {
        // 下载模式按钮
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.handleDownloadMode(mode);
            });
        });
        
        // 设置相关按钮
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('reset-settings').addEventListener('click', () => {
            this.resetSettings();
        });
        
        // 格式转换相关事件
        const enableConversionCheckbox = document.getElementById('enable-format-conversion');
        if (enableConversionCheckbox) {
            enableConversionCheckbox.addEventListener('change', (e) => {
                this.configManager.set('enableFormatConversion', e.target.checked);
                this.configManager.toggleConversionOptions();
            });
        }
        
        const targetFormatSelect = document.getElementById('target-format');
        if (targetFormatSelect) {
            targetFormatSelect.addEventListener('change', (e) => {
                this.configManager.set('targetFormat', e.target.value);
                this.configManager.updateQualityVisibility();
            });
        }
        
        const qualitySlider = document.getElementById('conversion-quality');
        if (qualitySlider) {
            qualitySlider.addEventListener('input', (e) => {
                this.configManager.set('conversionQuality', parseFloat(e.target.value));
                this.configManager.updateQualityDisplay();
            });
        }

        // 小红书相关按钮
        const xiaohongshuStartBtn = document.getElementById('xiaohongshu-start');
        if (xiaohongshuStartBtn) {
            xiaohongshuStartBtn.addEventListener('click', () => {
                startXiaohongshuCapture();
            });
        }
        
        const xiaohongshuVisitBtn = document.getElementById('xiaohongshu-visit');
        if (xiaohongshuVisitBtn) {
            xiaohongshuVisitBtn.addEventListener('click', () => {
                window.open('https://www.xiaohongshu.com', '_blank');
            });
        }
    }
    
    setupTabSwitching() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // 更新按钮状态
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 更新内容显示
                tabContents.forEach(content => {
                    content.style.display = content.id === `${targetTab}-tab` ? 'block' : 'none';
                });
            });
        });
    }
    
    async handleDownloadMode(mode) {
        try {
            switch (mode) {
                case 'full-page':
                    await this.downloadFullPage();
                    break;
                case 'area-select':
                    await this.startAreaSelection();
                    break;
                default:
                    console.warn('未知的下载模式:', mode);
            }
        } catch (error) {
            console.error('下载模式处理失败:', error);
            this.showError('操作失败: ' + error.message);
        }
    }
    
    async downloadFullPage() {
        try {
            // 先获取当前页面的文件
            const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'scanPage',
                settings: this.settings
            });
            
            if (response && response.files) {
                // 显示预览面板
                await chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'showPreview',
                    files: response.files,
                    selectedFiles: [],
                    settings: this.settings
                });
                
                // 成功后关闭弹窗
                window.close();
            } else {
                this.showError('未找到可预览的文件');
            }
        } catch (error) {
            console.error('预览文件失败:', error);
            this.showError('预览失败: ' + error.message);
        }
    }
    
    async startAreaSelection() {
        // 关闭弹窗
        window.close();
        
        // 发送消息启动区域选择
        await chrome.tabs.sendMessage(this.currentTab.id, {
            action: 'startAreaSelection'
        });
    }
    
    async downloadFiles(files) {
        if (!files || files.length === 0) {
            this.showError('没有找到文件');
            return;
        }
        
        this.updateProgress('开始下载...', 0, files.length);
        
        for (let i = 0; i < files.length; i++) {
            try {
                await this.downloadSingleFile(files[i], i);
                this.updateProgress(`下载中...`, i + 1, files.length);
            } catch (error) {
                console.error('文件下载失败:', error);
            }
        }
        
        this.hideProgress();
    }
    
    async downloadSingleFile(file, index) {
        const filename = this.generateFilename(file, index);
        
        try {
            await chrome.downloads.download({
                url: file.url,
                filename: filename,
                conflictAction: 'uniquify'
            });
        } catch (error) {
            console.error('下载失败:', error);
            throw error;
        }
    }
    
    generateFilename(file, index) {
        const domain = this.getDomainName();
        const settings = this.settings;
        let filename = file.name;
        
        // 根据命名规则生成文件名
        switch (settings.fileNaming) {
            case 'timestamp':
                const now = new Date();
                const timestamp = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0') + '_' +
                    String(now.getHours()).padStart(2, '0') + 
                    String(now.getMinutes()).padStart(2, '0') + 
                    String(now.getSeconds()).padStart(2, '0');
                filename = `${timestamp}_${filename}`;
                break;
            case 'sequential':
                filename = `${String(index + 1).padStart(3, '0')}_${filename}`;
                break;
            case 'original':
            default:
                break;
        }
        
        // 如果没有文件扩展名，根据类型添加
        if (!this.hasFileExtension(filename)) {
            const ext = this.getFileExtension(file.url) || this.getTypeExtension(file.type);
            if (ext) {
                filename += '.' + ext;
            }
        }
        
        // 如果启用了按网站创建文件夹
        if (settings.createFolders) {
            filename = `${settings.savePath}/${domain}/${filename}`;
        } else {
            filename = `${settings.savePath}/${filename}`;
        }
        
        return filename;
    }
    
    getDomainName() {
        try {
            const url = new URL(this.currentTab.url);
            return url.hostname.replace(/^www\./, '');
        } catch (error) {
            return 'unknown';
        }
    }
    
    hasFileExtension(filename) {
        return /\.[a-zA-Z0-9]+$/.test(filename);
    }
    
    getFileExtension(url) {
        try {
            const pathname = new URL(url).pathname;
            const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    }
    
    getTypeExtension(type) {
        const typeMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'video/avi': 'avi',
            'video/quicktime': 'mov',
            'video/x-msvideo': 'avi'
        };
        return typeMap[type] || null;
    }
    
    updateProgress(text, current, total) {
        const progressSection = document.getElementById('progress-section');
        const progressText = document.getElementById('progress-text');
        const progressCount = document.getElementById('progress-count');
        const progressFill = document.getElementById('progress-fill');
        
        if (progressSection) {
            progressSection.style.display = 'block';
            progressText.textContent = text;
            progressCount.textContent = `${current}/${total}`;
            
            const percentage = total > 0 ? (current / total) * 100 : 0;
            progressFill.style.width = percentage + '%';
        }
    }
    
    hideProgress() {
        const progressSection = document.getElementById('progress-section');
        if (progressSection) {
            progressSection.style.display = 'none';
        }
    }
    
    showError(message) {
        // 简单的错误显示，可以后续改进
        alert(message);
        this.hideProgress();
    }
    
    async loadSettings() {
        await this.configManager.loadFromStorage();
        this.configManager.updateUI();
        this.configManager.toggleConversionOptions();
    }
    
    async saveSettings() {
        // 从UI读取配置
        this.configManager.readFromUI();
        
        // 保存到存储
        const success = await this.configManager.saveToStorage();
        
        if (success) {
            // 显示保存成功提示
            const saveBtn = document.getElementById('save-settings');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '已保存!';
            saveBtn.style.background = '#10b981';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 1500);
        } else {
            this.showError('保存设置失败');
        }
    }
    
    async resetSettings() {
        if (confirm('确定要重置所有设置吗？')) {
            await this.configManager.resetConfig();
            this.configManager.updateUI();
            this.configManager.toggleConversionOptions();
            alert('设置已重置');
        }
    }
}

// 小红书功能
async function startXiaohongshuCapture() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // 检查是否在小红书页面
        if (!tab.url.includes('xiaohongshu.com')) {
            alert('请在小红书页面使用此功能！');
            return;
        }
        
        // 发送消息到content script开始获取
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'startXiaohongshuCapture'
        });
        
        if (response && response.success) {
            // 关闭弹窗
            window.close();
        } else {
            alert('获取失败，请确保页面已完全加载');
        }
    } catch (error) {
        console.error('小红书获取失败:', error);
        alert('获取失败: ' + error.message);
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new WebDownloadHelper();
}); 