#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 开始构建 Web批量下载助手...\n');

// 检查必要文件
const requiredFiles = [
    'manifest.json',
    'src/popup/popup.html',
    'src/popup/popup.css',
    'src/popup/popup.js',
    'src/content/content.js',
    'src/content/content.css',
    'src/background/background.js'
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

console.log('✅ 所有必要文件都存在');

// 检查资源文件
const assetDirs = ['assets/icons'];
let assetsOk = true;

assetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.error(`❌ 缺少资源目录: ${dir}`);
        assetsOk = false;
    }
});

if (!assetsOk) {
    process.exit(1);
}

console.log('✅ 资源文件检查通过');

// 读取并验证 manifest.json
try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    console.log(`✅ Manifest 验证通过 - 版本: ${manifest.version}`);
} catch (error) {
    console.error('❌ Manifest 文件格式错误:', error.message);
    process.exit(1);
}

console.log('\n🎉 构建检查完成！扩展已准备就绪。');
console.log('\n📦 安装说明:');
console.log('1. 打开 Chrome 浏览器');
console.log('2. 访问 chrome://extensions/');
console.log('3. 开启"开发者模式"');
console.log('4. 点击"加载已解压的扩展程序"');
console.log('5. 选择此项目文件夹');
console.log('');
console.log('🎉 享受批量下载的便利吧！'); 