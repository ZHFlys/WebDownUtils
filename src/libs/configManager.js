// 统一配置管理器
class ConfigManager {
    constructor() {
        // 统一的配置结构定义
        this.DEFAULT_CONFIG = {
            // 基础设置
            basic: {
                savePath: {
                    value: 'Downloads/WebDownUtils',
                    element: 'save-path',
                    type: 'text'
                },
                fileNaming: {
                    value: 'timestamp',
                    element: 'file-naming',
                    type: 'select'
                },
                createFolders: {
                    value: true,
                    element: 'create-folders',
                    type: 'checkbox'
                }
            },
            // 下载限制
            limits: {
                maxFiles: {
                    value: 50,
                    element: 'max-files',
                    type: 'number'
                },
                fileSizeLimit: {
                    value: 100,
                    element: 'file-size-limit',
                    type: 'number'
                },
                zipThreshold: {
                    value: 3,
                    element: 'zip-threshold',
                    type: 'number'
                },
                downloadDelay: {
                    value: 0.5,
                    element: 'download-delay',
                    type: 'number'
                }
            },
            // 界面设置
            ui: {
                showFormatFilter: {
                    value: true,
                    element: 'show-format-filter',
                    type: 'checkbox'
                },
                imageCropMode: {
                    value: 'contain',
                    element: 'image-crop-mode',
                    type: 'select'
                }
            },
            // 格式转换设置
            conversion: {
                enableFormatConversion: {
                    value: false,
                    element: 'enable-format-conversion',
                    type: 'checkbox'
                },
                targetFormat: {
                    value: 'jpg',
                    element: 'target-format',
                    type: 'select'
                },
                conversionQuality: {
                    value: 0.8,
                    element: 'conversion-quality',
                    type: 'range'
                }
            },
            // 文件格式支持
            formats: {
                // 图片格式
                image: {
                    jpg: { value: true, element: 'format-jpg' },
                    png: { value: true, element: 'format-png' },
                    gif: { value: true, element: 'format-gif' },
                    webp: { value: true, element: 'format-webp' },
                    svg: { value: true, element: 'format-svg' }
                },
                // 视频格式
                video: {
                    mp4: { value: true, element: 'format-mp4' },
                    webm: { value: true, element: 'format-webm' },
                    avi: { value: true, element: 'format-avi' },
                    mov: { value: true, element: 'format-mov' },
                    mkv: { value: true, element: 'format-mkv' }
                },
                // 音频格式
                audio: {
                    mp3: { value: true, element: 'format-mp3' },
                    wav: { value: true, element: 'format-wav' },
                    flac: { value: true, element: 'format-flac' },
                    aac: { value: true, element: 'format-aac' },
                    ogg: { value: true, element: 'format-ogg' },
                    m4a: { value: true, element: 'format-m4a' }
                },
                // 文档格式
                document: {
                    pdf: { value: true, element: 'format-pdf' },
                    doc: { value: true, element: 'format-doc' },
                    docx: { value: true, element: 'format-docx' },
                    xls: { value: true, element: 'format-xls' },
                    xlsx: { value: true, element: 'format-xlsx' },
                    ppt: { value: true, element: 'format-ppt' },
                    pptx: { value: true, element: 'format-pptx' }
                }
            }
        };
        
        this.currentConfig = this.deepClone(this.DEFAULT_CONFIG);
    }
    
    // 深拷贝方法
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
    }
    
    // 获取扁平化的配置对象（兼容旧版本）
    getFlatConfig() {
        const flatConfig = {};
        
        // 处理基础配置
        Object.keys(this.currentConfig).forEach(section => {
            if (section === 'formats') {
                // 格式配置特殊处理
                flatConfig.formats = {};
                Object.keys(this.currentConfig.formats).forEach(category => {
                    Object.keys(this.currentConfig.formats[category]).forEach(format => {
                        flatConfig.formats[format] = this.currentConfig.formats[category][format].value;
                    });
                });
            } else {
                // 其他配置
                Object.keys(this.currentConfig[section]).forEach(key => {
                    flatConfig[key] = this.currentConfig[section][key].value;
                });
            }
        });
        
        return flatConfig;
    }
    
    // 从存储加载配置
    async loadFromStorage() {
        try {
            const stored = await chrome.storage.sync.get();
            if (stored && Object.keys(stored).length > 0) {
                this.updateFromFlat(stored);
            }
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }
    
    // 从扁平化配置更新
    updateFromFlat(flatConfig) {
        // 更新基础配置
        Object.keys(this.currentConfig).forEach(section => {
            if (section === 'formats') {
                // 格式配置特殊处理
                if (flatConfig.formats) {
                    Object.keys(this.currentConfig.formats).forEach(category => {
                        Object.keys(this.currentConfig.formats[category]).forEach(format => {
                            if (flatConfig.formats[format] !== undefined) {
                                this.currentConfig.formats[category][format].value = flatConfig.formats[format];
                            }
                        });
                    });
                }
            } else {
                // 其他配置
                Object.keys(this.currentConfig[section]).forEach(key => {
                    if (flatConfig[key] !== undefined) {
                        this.currentConfig[section][key].value = flatConfig[key];
                    }
                });
            }
        });
    }
    
    // 保存配置到存储
    async saveToStorage() {
        try {
            const flatConfig = this.getFlatConfig();
            await chrome.storage.sync.set(flatConfig);
            return true;
        } catch (error) {
            console.error('保存配置失败:', error);
            return false;
        }
    }
    
    // 重置配置
    async resetConfig() {
        this.currentConfig = this.deepClone(this.DEFAULT_CONFIG);
        await chrome.storage.sync.clear();
        return true;
    }
    
    // 更新UI显示
    updateUI() {
        // 更新基础配置UI
        Object.keys(this.currentConfig).forEach(section => {
            if (section === 'formats') {
                // 格式配置特殊处理
                Object.keys(this.currentConfig.formats).forEach(category => {
                    Object.keys(this.currentConfig.formats[category]).forEach(format => {
                        const config = this.currentConfig.formats[category][format];
                        const element = document.getElementById(config.element);
                        if (element) {
                            element.checked = config.value;
                        }
                    });
                });
            } else {
                // 其他配置
                Object.keys(this.currentConfig[section]).forEach(key => {
                    const config = this.currentConfig[section][key];
                    const element = document.getElementById(config.element);
                    if (element) {
                        this.updateElementValue(element, config.value, config.type);
                    }
                });
            }
        });
        
        // 更新特殊显示
        this.updateQualityDisplay();
    }
    
    // 从UI读取配置
    readFromUI() {
        Object.keys(this.currentConfig).forEach(section => {
            if (section === 'formats') {
                // 格式配置特殊处理
                Object.keys(this.currentConfig.formats).forEach(category => {
                    Object.keys(this.currentConfig.formats[category]).forEach(format => {
                        const config = this.currentConfig.formats[category][format];
                        const element = document.getElementById(config.element);
                        if (element) {
                            config.value = element.checked;
                        }
                    });
                });
            } else {
                // 其他配置
                Object.keys(this.currentConfig[section]).forEach(key => {
                    const config = this.currentConfig[section][key];
                    const element = document.getElementById(config.element);
                    if (element) {
                        config.value = this.getElementValue(element, config.type);
                    }
                });
            }
        });
    }
    
    // 更新元素值
    updateElementValue(element, value, type) {
        switch (type) {
            case 'text':
            case 'select':
                element.value = value;
                break;
            case 'checkbox':
                element.checked = value;
                break;
            case 'number':
            case 'range':
                element.value = value;
                break;
        }
    }
    
    // 获取元素值
    getElementValue(element, type) {
        switch (type) {
            case 'text':
            case 'select':
                return element.value;
            case 'checkbox':
                return element.checked;
            case 'number':
                return parseInt(element.value) || 0;
            case 'range':
                return parseFloat(element.value) || 0;
            default:
                return element.value;
        }
    }
    
    // 更新质量显示
    updateQualityDisplay() {
        const qualityValue = this.currentConfig.conversion.conversionQuality.value;
        const qualityDisplay = document.getElementById('quality-display');
        if (qualityDisplay) {
            qualityDisplay.textContent = Math.round(qualityValue * 100) + '%';
        }
    }
    
    // 切换格式转换选项显示
    toggleConversionOptions() {
        const enabled = this.currentConfig.conversion.enableFormatConversion.value;
        const conversionOptions = document.getElementById('conversion-options');
        const qualityOptions = document.getElementById('quality-options');
        
        if (conversionOptions) {
            conversionOptions.style.display = enabled ? 'block' : 'none';
        }
        if (qualityOptions) {
            qualityOptions.style.display = enabled ? 'block' : 'none';
        }
        
        if (enabled) {
            this.updateQualityVisibility();
        }
    }
    
    // 更新质量选项可见性
    updateQualityVisibility() {
        const format = this.currentConfig.conversion.targetFormat.value;
        const qualityOptions = document.getElementById('quality-options');
        if (qualityOptions) {
            // 只有JPG和WebP格式支持质量设置
            const showQuality = format === 'jpg' || format === 'webp';
            qualityOptions.style.display = showQuality ? 'block' : 'none';
        }
    }
    
    // 获取配置值
    get(key) {
        const flatConfig = this.getFlatConfig();
        return flatConfig[key];
    }
    
    // 设置配置值
    set(key, value) {
        // 查找并更新对应的配置项
        Object.keys(this.currentConfig).forEach(section => {
            if (section === 'formats') {
                Object.keys(this.currentConfig.formats).forEach(category => {
                    Object.keys(this.currentConfig.formats[category]).forEach(format => {
                        if (format === key) {
                            this.currentConfig.formats[category][format].value = value;
                        }
                    });
                });
            } else {
                Object.keys(this.currentConfig[section]).forEach(configKey => {
                    if (configKey === key) {
                        this.currentConfig[section][configKey].value = value;
                    }
                });
            }
        });
    }
}

// 导出配置管理器（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
} 