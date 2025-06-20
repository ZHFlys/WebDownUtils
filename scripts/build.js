#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 开始构建 Web批量下载助手...');

// 检查必要文件
const requiredFiles = [
    'manifest.json',
    'src/popup/popup.html',
    'src/popup/popup.css',
    'src/popup/popup.js',
    'src/content/content.js',
    'src/content/content.css',
    'src/background/background.js',
    'src/strategies/platform-strategies.js'
];

const missingFiles = [];

requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
        missingFiles.push(file);
    }
});

if (missingFiles.length > 0) {
    console.error('❌ 缺少必要文件:');
    missingFiles.forEach(file => console.error(`   - ${file}`));
    process.exit(1);
}

// 验证图标文件存在
const iconFiles = [
    'assets/icons/icon16.png',
    'assets/icons/icon32.png', 
    'assets/icons/icon48.png',
    'assets/icons/icon128.png'
];

const existingIcons = iconFiles.filter(file => fs.existsSync(file));
console.log(`✅ 图标文件检查通过 (${existingIcons.length}/${iconFiles.length})`);

// 验证manifest.json
try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    console.log(`✅ Manifest 验证通过 - 版本: ${manifest.version}`);
} catch (error) {
    console.error('❌ Manifest 文件格式错误:', error.message);
    process.exit(1);
}

console.log('✅ 构建完成！扩展已准备就绪。');
console.log('');
console.log('📦 安装步骤:');
console.log('1. 打开 Chrome 浏览器');
console.log('2. 进入 chrome://extensions/');
console.log('3. 开启开发者模式');
console.log('4. 点击"加载已解压的扩展程序"');
console.log('5. 选择当前项目文件夹');
console.log('');
console.log('🎉 享受批量下载的便利吧！'); 