// 扩展弹窗脚本
class WebDownloadHelper {
    constructor() {
        this.currentTab = null;
        this.settings = {
            savePath: 'Downloads/WebDownUtils',
            fileNaming: 'original',
            createFolders: true,
            maxFiles: 50,
            fileSizeLimit: 100,
            downloadDelay: 0.5,
            showFormatFilter: false,
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
            const file = files[i];
            try {
                await this.downloadSingleFile(file, i + 1);
                this.updateProgress(`正在下载: ${file.name}`, i + 1, files.length);
            } catch (error) {
                console.error(`下载文件失败: ${file.name}`, error);
            }
        }
        
        this.updateProgress('下载完成!', files.length, files.length);
        setTimeout(() => {
            this.hideProgress();
        }, 2000);
    }
    
    async downloadSingleFile(file, index) {
        const filename = this.generateFilename(file, index);
        const savePath = this.settings.createFolders 
            ? `${this.settings.savePath}/${this.getDomainName()}/${filename}`
            : `${this.settings.savePath}/${filename}`;
        
        return new Promise((resolve, reject) => {
            chrome.downloads.download({
                url: file.url,
                filename: savePath,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(downloadId);
                }
            });
        });
    }
    
    generateFilename(file, index) {
        const originalName = file.name || `file_${index}`;
        
        let finalName;
        switch (this.settings.fileNaming) {
            case 'timestamp':
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                finalName = `${timestamp}_${originalName}`;
                break;
            case 'sequential':
                finalName = `${index.toString().padStart(3, '0')}_${originalName}`;
                break;
            default:
                finalName = originalName;
                break;
        }
        
        // 确保文件名有后缀，如果没有就添加合适的后缀
        if (!this.hasFileExtension(finalName)) {
            const extension = this.getFileExtension(file.url) || this.getTypeExtension(file.type);
            finalName = `${finalName}.${extension}`;
        }
        
        return finalName;
    }
    
    getDomainName() {
        try {
            const url = new URL(this.currentTab.url);
            return url.hostname.replace(/^www\./, '');
        } catch {
            return 'unknown';
        }
    }
    
    hasFileExtension(filename) {
        if (!filename) return false;
        const parts = filename.split('.');
        return parts.length > 1 && parts[parts.length - 1].length > 0;
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
    
    updateProgress(text, current, total) {
        const progressSection = document.getElementById('progress-section');
        const progressText = document.getElementById('progress-text');
        const progressCount = document.getElementById('progress-count');
        const progressFill = document.getElementById('progress-fill');
        
        progressSection.style.display = 'block';
        progressText.textContent = text;
        progressCount.textContent = `${current}/${total}`;
        
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
    }
    
    hideProgress() {
        document.getElementById('progress-section').style.display = 'none';
    }
    
    showError(message) {
        // 简单的错误显示，可以后续改进
        alert(message);
        this.hideProgress();
    }
    
    async loadSettings() {
        const result = await chrome.storage.sync.get(this.settings);
        this.settings = { ...this.settings, ...result };
        
        // 更新基础设置UI
        document.getElementById('save-path').value = this.settings.savePath;
        document.getElementById('file-naming').value = this.settings.fileNaming;
        document.getElementById('create-folders').checked = this.settings.createFolders;
        document.getElementById('max-files').value = this.settings.maxFiles;
        document.getElementById('file-size-limit').value = this.settings.fileSizeLimit;
        document.getElementById('download-delay').value = this.settings.downloadDelay;
        document.getElementById('show-format-filter').checked = this.settings.showFormatFilter;
        
        // 更新格式配置UI
        if (this.settings.formats) {
            Object.keys(this.settings.formats).forEach(format => {
                const checkbox = document.getElementById(`format-${format}`);
                if (checkbox) {
                    checkbox.checked = this.settings.formats[format];
                }
            });
        }
    }
    
    async saveSettings() {
        // 从UI获取基础设置
        this.settings.savePath = document.getElementById('save-path').value;
        this.settings.fileNaming = document.getElementById('file-naming').value;
        this.settings.createFolders = document.getElementById('create-folders').checked;
        this.settings.maxFiles = parseInt(document.getElementById('max-files').value);
        this.settings.fileSizeLimit = parseInt(document.getElementById('file-size-limit').value);
        this.settings.downloadDelay = parseFloat(document.getElementById('download-delay').value);
        this.settings.showFormatFilter = document.getElementById('show-format-filter').checked;
        
        // 从UI获取格式配置
        if (this.settings.formats) {
            Object.keys(this.settings.formats).forEach(format => {
                const checkbox = document.getElementById(`format-${format}`);
                if (checkbox) {
                    this.settings.formats[format] = checkbox.checked;
                }
            });
        }
        
        // 保存到Chrome存储
        await chrome.storage.sync.set(this.settings);
        
        // 显示保存成功提示
        const saveBtn = document.getElementById('save-settings');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '已保存!';
        saveBtn.style.background = '#10b981';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '';
        }, 1500);
    }
    
    async resetSettings() {
        if (confirm('确定要重置所有设置吗？')) {
            // 重置为默认值
            this.settings = {
                savePath: 'Downloads/WebDownUtils',
                fileNaming: 'original',
                createFolders: true,
                maxFiles: 50,
                fileSizeLimit: 100,
                downloadDelay: 0.5,
                showFormatFilter: false,
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
            
            // 清除存储的设置
            await chrome.storage.sync.clear();
            
            // 更新UI
            await this.loadSettings();
            
            alert('设置已重置');
        }
    }
    

}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new WebDownloadHelper();
}); 