# ComfyUI-Curve

<!-- Language Switch -->
<div align="center">
  <a href="#english">English</a> | <a href="#中文">中文</a>
</div>

---

## English

Professional curve adjustment nodes for ComfyUI with Photoshop-like functionality, 70+ preset styles, advanced mask support, and histogram analysis.

### Features

- **Professional Curve Tool**: Photoshop-style curve adjustment with multiple interpolation methods
- **PS-Style Curve Visualization**: Real-time curve chart with optional histogram background display
- **Advanced Mask Support**: Selective curve adjustment with mask blending and feathering
- **Histogram Analysis & Levels**: Complete histogram analysis with PS-style levels adjustment
- **70+ Preset Styles**: Ready-to-use color grading presets for various photography styles
- **Channel Control**: RGB overall or individual R/G/B channel adjustment
- **Strength Control**: Adjustable curve effect intensity (0-200%)
- **Real-time Preview**: Visual curve preview with recommended channels
- **Batch Processing**: GPU-accelerated batch image processing

### Installation

#### Git Clone (Recommended)
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/your-username/ComfyUI-Curve.git
```

#### Manual Download
1. Download ZIP file
2. Extract to `ComfyUI/custom_nodes/ComfyUI-Curve`
3. Restart ComfyUI

#### Dependencies
- torch>=1.9.0
- numpy>=1.21.0
- scipy>=1.7.0
### Usage

#### Nodes

**🎨 PS Curve (Professional)**
- Professional curve adjustment with precise control
- **PS-style curve visualization**: Real-time curve chart with histogram background (optional)
- Input: image, interpolation method, channel, curve points, strength
- Optional mask support with feathering and opacity control
- **Interactive curve display**: Shows curve with histogram background like Photoshop
- Curve format: `x1,y1;x2,y2;x3,y3` (e.g., `0,0;128,150;255,255`)
- **Dual output**: Processed image + curve chart visualization

**📊 PS Histogram & Levels**
- Complete histogram analysis and levels adjustment
- **可视化直方图显示**: 实时直方图图表，支持彩色通道显示
- Real-time histogram data and statistics output
- **交互式可视化**: Shows input black/white points and gamma curves on chart
- Auto levels and auto contrast functions
- Manual levels control: input black/white, gamma, output black/white
- Channel-specific analysis: RGB, R, G, B, Luminance
- Professional color grading capabilities

**🎨 PS Curve Preset**
- One-click preset styles with visual preview
- 70+ professional color grading presets
- Recommended channel suggestions for each style

### Histogram & Levels Features

- **Real-time Histogram Analysis**: Complete histogram data for all channels
- **Visual Histogram Display**: Professional histogram charts with color-coded channels (RGB/R/G/B/Luminance)
- **Interactive Visualization**: Shows input black/white points and gamma adjustment lines on the chart
- **Statistical Information**: Mean, std dev, min, max, median, percentiles
- **Auto Levels**: Automatic black/white point detection with clip percentage control
- **Auto Contrast**: Intelligent contrast enhancement with gamma adjustment
- **Manual Levels Control**: Precise input/output black/white points and gamma
- **Channel Selection**: RGB combined, individual R/G/B, or Luminance analysis
- **Batch Processing**: Analyze and adjust multiple images simultaneously

#### Histogram Outputs

The histogram node provides four outputs:
1. **Processed Image**: Image with levels adjustment applied
2. **Histogram Image**: Visual histogram chart as an image (can be saved or viewed)
3. **Histogram Data**: Text data with detailed histogram information
4. **Statistics**: Comprehensive statistical analysis of the image

#### Histogram Visualization Features

- **RGB Mode**: Shows overlaid red, green, and blue channel histograms
- **Individual Channels**: Displays single channel histogram in corresponding color
- **Luminance Mode**: Shows grayscale luminance distribution
- **Level Indicators**: Visual lines showing input black/white points and gamma midpoint
- **Professional Styling**: Clean, publication-ready histogram charts

### Mask Usage Guide

#### Mask Support in PS Curve

**🎨 PS Curve (Professional) - Integrated Mask Support**
- Original curve node with optional mask input
- Backward compatible, can work without mask
- Use case: All mask applications with full control

#### Mask Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| **mask_blur** | 0-20 | 0.0 | Mask edge feathering, higher values create softer edges |
| **invert_mask** | True/False | False | Whether to invert the mask area |

#### Mask Sources

- **SAM (Segment Anything Model)**: Automatic segmentation of any object
- **Face/Body Segmentation**: Specialized for portraits with high accuracy
- **Hand-drawn Masks**: Created with drawing software, fully customizable
- **Other ComfyUI Mask Nodes**: CLIPSeg, RemBG, etc.

#### Best Practices

**Mask Blur Recommendations:**
- Portrait skin: 2-4 pixels
- Sky background: 5-10 pixels
- Object edges: 1-3 pixels
- Large areas: 8-15 pixels

**Channel Selection Tips:**
- Skin adjustment: R channel (warming)
- Sky enhancement: B channel (blue)
- Vegetation enhancement: G channel (green)
- Overall grading: RGB channel

**Curve Strength Recommendations:**
- Subtle: 0.3-0.7
- Standard: 0.8-1.2
- Strong: 1.3-2.0

#### Troubleshooting

- **Mask edges too hard**: Increase mask_blur value (recommended 3-8)
- **Effect too strong**: Decrease curve_strength or mask_opacity values
- **Mask area inaccurate**: Use invert_mask or generate more accurate mask
- **Batch processing issues**: Ensure mask count matches image batch count

### Preset Categories

- **Portrait**: Beauty, Texture, Soft Light
- **Landscape**: Enhanced, Natural, Chinese Painting
- **Cinematic**: Film Stock, Cool Tone, Warm Tone
- **Vintage**: Film, Warm Tone, Nostalgic
- **Modern**: Minimal, Tech, Futuristic
- **Japanese**: Fresh, Transparent, Creamy, Forest
- **Hong Kong**: Classic, Dark, Neon
- **Social Media**: Xiaohongshu, Instagram, TikTok
- **Fashion**: Magazine, Premium Gray, Morandi, Milk Tea
- **Artistic**: Oil Painting, Watercolor, Sketch, Print
- **Seasonal**: Spring, Summer, Autumn, Winter
- **Contrast**: High, Ultra High, Soft, Low Key, High Key
- **Extreme**: Brighten, Darken, Invert, S-Curve

### License

MIT License - see [LICENSE](LICENSE) file.

---

## 中文

专业的ComfyUI曲线调整节点，提供类似Photoshop的曲线功能、70+种预设风格、高级遮罩支持和直方图分析。

### 功能特性

- **专业曲线工具**: 类似Photoshop的曲线调整，支持多种插值方式
- **PS风格曲线可视化**: 实时曲线图表，可选直方图背景显示
- **高级遮罩支持**: 选择性曲线调整，支持遮罩混合和羽化效果
- **直方图分析与色阶**: 完整的直方图分析和PS风格的色阶调整
- **70+预设风格**: 涵盖各种摄影风格的现成调色预设
- **通道控制**: 支持RGB整体或单独R/G/B通道调整
- **强度控制**: 可调节曲线效果强度（0-200%）
- **实时预览**: 可视化曲线预览和推荐通道提示
- **批量处理**: GPU加速的批量图像处理

### 安装方法

#### Git克隆（推荐）
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/your-username/ComfyUI-Curve.git
```

#### 手动下载
1. 下载ZIP文件
2. 解压到 `ComfyUI/custom_nodes/ComfyUI-Curve`
3. 重启ComfyUI

#### 依赖要求
- torch>=1.9.0
- numpy>=1.21.0
- scipy>=1.7.0

### 使用方法

#### 节点说明

**🎨 PS Curve (Professional)**
- 专业曲线调整，提供精确控制
- **PS风格曲线可视化**: 实时曲线图表，可选直方图背景显示
- 输入：图像、插值方式、通道、曲线点、强度
- 可选遮罩支持，包含羽化和透明度控制
- **交互式曲线显示**: 像Photoshop一样显示带直方图背景的曲线
- 曲线格式：`x1,y1;x2,y2;x3,y3`（例如：`0,0;128,150;255,255`）
- **双重输出**: 处理后的图像 + 曲线图表可视化

**📊 PS Histogram & Levels**
- 完整的直方图分析和色阶调整
- **可视化直方图显示**: 实时直方图图表，支持彩色通道显示
- 实时直方图数据和统计信息输出
- **交互式可视化**: 在图表上显示输入黑/白场点和伽马曲线
- 自动色阶和自动对比度功能
- 手动色阶控制：输入黑/白场点、伽马、输出黑/白场点
- 通道特定分析：RGB、R、G、B、亮度
- 专业调色功能

**🎨 PS Curve Preset**
- 一键应用预设风格，带可视化预览
- 70+种专业调色预设
- 每种风格都有推荐通道建议

### 直方图与色阶功能

- **实时直方图分析**: 所有通道的完整直方图数据
- **可视化直方图显示**: 专业直方图图表，带颜色编码通道（RGB/R/G/B/亮度）
- **交互式可视化**: 在图表上显示输入黑/白场点和伽马调整线
- **统计信息**: 均值、标准差、最小值、最大值、中位数、百分位数
- **自动色阶**: 自动黑/白场点检测，支持裁剪百分比控制
- **自动对比度**: 智能对比度增强，带伽马调整
- **手动色阶控制**: 精确的输入/输出黑/白场点和伽马
- **通道选择**: RGB综合、单独R/G/B或亮度分析
- **批量处理**: 同时分析和调整多张图像

#### 直方图输出

直方图节点提供四个输出：
1. **处理后的图像**: 应用色阶调整后的图像
2. **直方图图像**: 可视化直方图图表作为图像（可以保存或查看）
3. **直方图数据**: 带详细直方图信息的文本数据
4. **统计信息**: 图像的综合统计分析

#### 直方图可视化功能

- **RGB模式**: 显示重叠的红、绿、蓝通道直方图
- **单通道模式**: 以对应颜色显示单通道直方图
- **亮度模式**: 显示灰度亮度分布
- **色阶指示线**: 显示输入黑/白场点和伽马中点的可视化线条
- **专业样式**: 清洁、适合发布的直方图图表

### 遮罩使用指南

#### PS Curve中的遮罩支持

**🎨 PS Curve (Professional) - 集成遮罩支持**
- 原始曲线节点，带可选遮罩输入
- 向后兼容，可以不使用遮罩
- 使用场景：所有遮罩应用，完全控制

#### 遮罩参数

| 参数 | 范围 | 默认值 | 说明 |
|------|------|--------|------|
| **mask_blur** | 0-20 | 0.0 | 遮罩边缘羽化，值越高边缘越柔和 |
| **invert_mask** | True/False | False | 是否反转遮罩区域 |

#### 遮罩来源

- **SAM（Segment Anything Model）**: 自动分割任何对象
- **人脸/身体分割**: 专门用于人像，精度高
- **手绘遮罩**: 使用绘图软件创建，完全可定制
- **其他ComfyUI遮罩节点**: CLIPSeg、RemBG等

#### 最佳实践

**遮罩模糊推荐值：**
- 人像皮肤：2-4像素
- 天空背景：5-10像素
- 物体边缘：1-3像素
- 大面积区域：8-15像素

**通道选择技巧：**
- 皮肤调整：R通道（暖化）
- 天空增强：B通道（蓝色）
- 植被增强：G通道（绿色）
- 整体调色：RGB通道

**曲线强度推荐：**
- 细微：0.3-0.7
- 标准：0.8-1.2
- 强烈：1.3-2.0

#### 故障排除

- **遮罩边缘太硬**: 增加mask_blur值（推荐3-8）
- **效果太强**: 降低curve_strength或mask_opacity值
- **遮罩区域不准确**: 使用invert_mask或生成更准确的遮罩
- **批处理问题**: 确保遮罩数量与图像批次数量匹配

### 预设分类

- **人像摄影**: 美颜、质感、柔光
- **风景摄影**: 增强、自然、山水画意
- **电影风格**: 胶片、冷调、暖调
- **复古风格**: 胶片、暖调、怀旧
- **现代风格**: 简约、科技感、未来主义
- **日系风格**: 清新、通透、奶油、森系
- **港风系列**: 经典、暗调、霓虹
- **社交媒体**: 小红书、Instagram、TikTok
- **时尚摄影**: 杂志、高级灰、莫兰迪、奶茶色
- **艺术风格**: 油画、水彩、素描、版画
- **季节主题**: 春、夏、秋、冬
- **对比度系列**: 高对比、超高对比、柔和、暗调、亮调
- **极端效果**: 提亮、压暗、反转、S型

### 许可证

MIT许可证 - 查看 [LICENSE](LICENSE) 文件。

---

<div align="center">

**如果这个项目对你有帮助，请给个Star支持！**

</div> 