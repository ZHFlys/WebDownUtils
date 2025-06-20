// 平台优化策略模块
class PlatformStrategies {
    constructor() {
        this.strategies = {
            xiaohongshu: new XiaohongshuStrategy(),
            weibo: new WeiboStrategy(),
            instagram: new InstagramStrategy(),
            twitter: new TwitterStrategy(),
            pinterest: new PinterestStrategy(),
            default: new DefaultStrategy()
        };
    }
    
    getStrategy(url) {
        if (url.includes('xiaohongshu.com')) {
            return this.strategies.xiaohongshu;
        } else if (url.includes('weibo.com')) {
            return this.strategies.weibo;
        } else if (url.includes('instagram.com')) {
            return this.strategies.instagram;
        } else if (url.includes('twitter.com') || url.includes('x.com')) {
            return this.strategies.twitter;
        } else if (url.includes('pinterest.com')) {
            return this.strategies.pinterest;
        }
        return this.strategies.default;
    }
}

// 小红书优化策略
class XiaohongshuStrategy {
    async scanPage(settings) {
        const files = [];
        
        try {
            // 等待页面加载完成
            await this.waitForContent();
            
            // 小红书专用选择器
            const selectors = {
                images: [
                    '.note-item .cover img',
                    '.note-detail .carousel img',
                    '.note-detail .single-image img',
                    '.swiper-slide img',
                    '.pic-item img',
                    '[class*="imageContainer"] img',
                    '[class*="NoteImage"] img'
                ],
                videos: [
                    '.note-item video',
                    '.note-detail video',
                    '.video-container video'
                ]
            };
            
            if (settings.includeImages) {
                const images = await this.scanImages(selectors.images);
                files.push(...images);
            }
            
            if (settings.includeVideos) {
                const videos = await this.scanVideos(selectors.videos);
                files.push(...videos);
            }
            
            return { files: this.filterFiles(files, settings) };
        } catch (error) {
            console.error('小红书扫描失败:', error);
            return { files: [], error: error.message };
        }
    }
    
    async scanImages(selectors) {
        const images = [];
        let index = 0;
        
        for (const selector of selectors) {
            const imgElements = document.querySelectorAll(selector);
            
            for (const img of imgElements) {
                const originalSrc = await this.getOriginalImageUrl(img);
                if (originalSrc) {
                    images.push({
                        type: 'image',
                        url: originalSrc,
                        name: `xiaohongshu_image_${index}`,
                        element: img,
                        platform: '小红书',
                        quality: 'original'
                    });
                    index++;
                }
            }
        }
        
        return images;
    }
    
    async getOriginalImageUrl(img) {
        let src = img.src || img.dataset.src || img.dataset.original;
        
        if (!src) return null;
        
        // 小红书图片URL优化规则
        if (src.includes('ci.xiaohongshu.com')) {
            // 移除尺寸和质量参数，获取原图
            src = src.split('?')[0];
            
            // 如果URL包含尺寸标识，尝试获取更高分辨率
            if (src.includes('/spectrum/')) {
                // spectrum后面的参数控制图片质量
                src = src.replace(/\/spectrum\/.*?\//, '/spectrum/1040/');
            }
            
            // 移除可能的尺寸后缀
            src = src.replace(/_\d+x\d+/, '');
        }
        
        return src;
    }
    
    async scanVideos(selectors) {
        const videos = [];
        let index = 0;
        
        for (const selector of selectors) {
            const videoElements = document.querySelectorAll(selector);
            
            for (const video of videoElements) {
                const src = video.src || video.currentSrc;
                if (src) {
                    videos.push({
                        type: 'video',
                        url: src,
                        name: `xiaohongshu_video_${index}`,
                        element: video,
                        platform: '小红书'
                    });
                    index++;
                }
                
                // 检查source元素
                const sources = video.querySelectorAll('source');
                for (const source of sources) {
                    if (source.src) {
                        videos.push({
                            type: 'video',
                            url: source.src,
                            name: `xiaohongshu_video_${index}_source`,
                            element: video,
                            platform: '小红书'
                        });
                    }
                }
            }
        }
        
        return videos;
    }
    
    async waitForContent() {
        return new Promise((resolve) => {
            const checkContent = () => {
                const hasImages = document.querySelectorAll('img').length > 0;
                const hasLoaded = document.readyState === 'complete';
                
                if (hasImages && hasLoaded) {
                    resolve();
                } else {
                    setTimeout(checkContent, 500);
                }
            };
            checkContent();
        });
    }
    
    filterFiles(files, settings) {
        // 去重
        const uniqueFiles = [];
        const urlSet = new Set();
        
        for (const file of files) {
            if (!urlSet.has(file.url)) {
                urlSet.add(file.url);
                uniqueFiles.push(file);
            }
        }
        
        return uniqueFiles.slice(0, settings.maxFiles);
    }
}

// 微博优化策略
class WeiboStrategy {
    async scanPage(settings) {
        const files = [];
        
        const selectors = {
            images: [
                '.WB_pic img',
                '.media_box img',
                '.picture img',
                '.WB_expand_media img'
            ],
            videos: [
                '.WB_video video',
                '.media_box video'
            ]
        };
        
        if (settings.includeImages) {
            files.push(...this.scanBySelectors(selectors.images, 'image', 'weibo'));
        }
        
        if (settings.includeVideos) {
            files.push(...this.scanBySelectors(selectors.videos, 'video', 'weibo'));
        }
        
        return { files };
    }
    
    scanBySelectors(selectors, type, platform) {
        const files = [];
        let index = 0;
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const src = el.src || el.dataset.src;
                if (src) {
                    files.push({
                        type,
                        url: src,
                        name: `${platform}_${type}_${index}`,
                        element: el,
                        platform
                    });
                    index++;
                }
            });
        }
        
        return files;
    }
}

// Instagram优化策略
class InstagramStrategy {
    async scanPage(settings) {
        const files = [];
        
        const selectors = {
            images: [
                'article img',
                '[role="presentation"] img',
                '.FFVAD img'
            ],
            videos: [
                'article video',
                '.tWeCl video'
            ]
        };
        
        if (settings.includeImages) {
            files.push(...this.scanBySelectors(selectors.images, 'image', 'instagram'));
        }
        
        if (settings.includeVideos) {
            files.push(...this.scanBySelectors(selectors.videos, 'video', 'instagram'));
        }
        
        return { files };
    }
    
    scanBySelectors(selectors, type, platform) {
        const files = [];
        let index = 0;
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const src = el.src || el.dataset.src;
                if (src && src.includes('instagram')) {
                    files.push({
                        type,
                        url: src,
                        name: `${platform}_${type}_${index}`,
                        element: el,
                        platform
                    });
                    index++;
                }
            });
        }
        
        return files;
    }
}

// Twitter/X优化策略
class TwitterStrategy {
    async scanPage(settings) {
        const files = [];
        
        const selectors = {
            images: [
                '[data-testid="tweetPhoto"] img',
                '.css-9pa8cd img',
                'img[src*="pbs.twimg.com"]'
            ],
            videos: [
                '[data-testid="videoPlayer"] video',
                '.css-1dbjc4n video'
            ]
        };
        
        if (settings.includeImages) {
            files.push(...this.scanBySelectors(selectors.images, 'image', 'twitter'));
        }
        
        if (settings.includeVideos) {
            files.push(...this.scanBySelectors(selectors.videos, 'video', 'twitter'));
        }
        
        return { files };
    }
    
    scanBySelectors(selectors, type, platform) {
        const files = [];
        let index = 0;
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                let src = el.src || el.dataset.src;
                if (src) {
                    // Twitter图片URL优化
                    if (type === 'image' && src.includes('pbs.twimg.com')) {
                        src = src.replace(/&name=\w+/, '&name=orig');
                    }
                    
                    files.push({
                        type,
                        url: src,
                        name: `${platform}_${type}_${index}`,
                        element: el,
                        platform
                    });
                    index++;
                }
            });
        }
        
        return files;
    }
}

// Pinterest优化策略
class PinterestStrategy {
    async scanPage(settings) {
        const files = [];
        
        const selectors = {
            images: [
                '[data-test-id="pin-image"]',
                '.GrowthUnauthPinImage img',
                '.pinImage img'
            ]
        };
        
        if (settings.includeImages) {
            files.push(...this.scanBySelectors(selectors.images, 'image', 'pinterest'));
        }
        
        return { files };
    }
    
    scanBySelectors(selectors, type, platform) {
        const files = [];
        let index = 0;
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const src = el.src || el.dataset.src;
                if (src) {
                    files.push({
                        type,
                        url: src,
                        name: `${platform}_${type}_${index}`,
                        element: el,
                        platform
                    });
                    index++;
                }
            });
        }
        
        return files;
    }
}

// 默认策略
class DefaultStrategy {
    async scanPage(settings) {
        const files = [];
        
        if (settings.includeImages) {
            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
                const src = img.src || img.dataset.src;
                if (src && this.isValidUrl(src)) {
                    files.push({
                        type: 'image',
                        url: src,
                        name: `image_${index}`,
                        element: img,
                        platform: 'default'
                    });
                }
            });
        }
        
        if (settings.includeVideos) {
            const videos = document.querySelectorAll('video');
            videos.forEach((video, index) => {
                const src = video.src || video.currentSrc;
                if (src && this.isValidUrl(src)) {
                    files.push({
                        type: 'video',
                        url: src,
                        name: `video_${index}`,
                        element: video,
                        platform: 'default'
                    });
                }
            });
        }
        
        return { files };
    }
    
    isValidUrl(url) {
        try {
            new URL(url, window.location.origin);
            return true;
        } catch {
            return false;
        }
    }
}

// 导出策略管理器
if (typeof window !== 'undefined') {
    window.PlatformStrategies = PlatformStrategies;
} 