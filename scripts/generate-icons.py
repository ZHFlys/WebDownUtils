#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
from pathlib import Path

def check_dependencies():
    """检查必要的依赖包"""
    try:
        from PIL import Image, ImageDraw
        import cairosvg
        return True
    except ImportError as e:
        print("❌ 缺少必要的依赖包，请先安装：")
        print("pip install Pillow cairosvg")
        print(f"错误详情: {e}")
        return False

def svg_to_png(svg_path, png_path, size):
    """
    将SVG转换为PNG，保持原有颜色
    """
    try:
        import cairosvg
        from PIL import Image
        
        # 使用cairosvg转换SVG到PNG，保持颜色
        cairosvg.svg2png(
            url=svg_path,
            write_to=png_path,
            output_width=size,
            output_height=size,
            background_color='transparent'  # 保持透明背景
        )
        
        # 验证生成的文件
        if os.path.exists(png_path):
            img = Image.open(png_path)
            print(f"✅ 成功生成: {png_path} ({img.size[0]}x{img.size[1]})")
            return True
        else:
            print(f"❌ 文件生成失败: {png_path}")
            return False
            
    except Exception as e:
        print(f"❌ 转换失败 {png_path}: {e}")
        return False

def main():
    """主函数"""
    print("🎨 Web批量下载助手 - Python图标转换工具")
    print("=" * 50)
    
    # 检查依赖
    if not check_dependencies():
        return
    
    # 定义路径
    project_root = Path(__file__).parent.parent
    svg_path = project_root / "assets" / "icons" / "icon.svg"
    icons_dir = project_root / "assets" / "icons"
    
    # 检查SVG文件是否存在
    if not svg_path.exists():
        print(f"❌ SVG文件不存在: {svg_path}")
        return
    
    print(f"📁 SVG源文件: {svg_path}")
    print(f"📁 输出目录: {icons_dir}")
    print("")
    
    # 从32px开始生成图标
    sizes = {
        "icon32.png": 32,
        "icon48.png": 48,
        "icon128.png": 128,
        "icon256.png": 256
    }
    
    success_count = 0
    total_count = len(sizes)
    
    print("🔄 开始转换图标（32px-256px）...")
    print("")
    
    # 转换每个尺寸
    for filename, size in sizes.items():
        png_path = icons_dir / filename
        
        print(f"🔄 正在生成 {filename} ({size}x{size})...")
        
        if svg_to_png(str(svg_path), str(png_path), size):
            success_count += 1
        
        print("")
    
    # 显示结果
    print("=" * 50)
    print(f"📊 转换完成: {success_count}/{total_count}")
    
    if success_count == total_count:
        print("🎉 所有图标生成成功！")
        print("")
        print("📁 生成的文件：")
        for filename in sizes.keys():
            file_path = icons_dir / filename
            if file_path.exists():
                file_size = file_path.stat().st_size
                print(f"   ✅ {filename} ({file_size} bytes)")
        
        print("")
        print("🚀 现在可以运行以下命令测试扩展：")
        print("   npm run build")
        
    else:
        print("⚠️  部分图标生成失败，请检查错误信息")
    
    print("")
    print("💡 提示：从32px开始生成图标，优化小尺寸显示效果")
    print("💡 云朵设计增加了内边距，视觉层次更清晰")

if __name__ == "__main__":
    main() 