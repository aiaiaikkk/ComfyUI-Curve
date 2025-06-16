# ComfyUI-Curve

<!-- 语言切换 | Language Switch -->
<div align="center">
  <a href="#中文">中文</a> | <a href="#english">English</a>
</div>

---

## 中文

ComfyUI专业色彩调整扩展，提供类似Photoshop的曲线、HSL、色阶调整功能，支持70+种预设风格、高级遮罩和Lightroom风格的色彩分级功能。
![image](https://github.com/user-attachments/assets/a7e3477f-72b2-4bac-9e9e-5d05a8e9670d)


### 🌟 主要功能
项目介绍视频：https://www.bilibili.com/video/BV1QuMFzRE5i/

#### 🎨 曲线调整 (PS Curve)
![image](https://github.com/user-attachments/assets/262e6a0a-69dd-4b32-8a7b-c2752e412afb)

- 类似Photoshop的专业曲线调整，支持多种插值方式
- **双击节点进入实时调整界面**：在弹出窗口中直接拖动控制点，即刻观察图像变化效果
- 实时曲线图表，可选直方图背景显示
- 支持RGB整体或单独R/G/B通道调整
- 可调曲线效果强度（0-200%）
- **弹窗内调整立即应用**：所有曲线修改无需重新运行工作流即可在弹窗内实时查看效果

#### 🎭 HSL调整 (PS HSL)
![image](https://github.com/user-attachments/assets/3e9e86be-c09c-476f-a23c-03c7eb0ce339)

- 精准控制8个颜色通道：红、橙、黄、绿、浅绿、蓝、紫、品红
- 每个颜色可独立调整色相、饱和度、明度
- **双击节点打开HSL调整弹窗**：在弹出窗口中滑动调节器立即显示颜色变化效果，所见即所得
- 支持遮罩和羽化效果
- **弹窗内实时交互响应**：在弹出界面中调整任何HSL参数都能即时反映在预览图像上

#### 📊 直方图与色阶 (PS Histogram)
- 完整的直方图分析和PS风格的色阶调整
- 实时直方图数据和统计信息
- 自动色阶和自动对比度功能
- 精确控制：输入/输出黑白场点、伽马

#### 🎨 色彩分级 (Color Grading)
![image](https://github.com/user-attachments/assets/fb67b936-1ca3-4ac3-b47e-d5c19591f1ad)

- Lightroom风格的色彩分级轮盘
- 阴影、中间调、高光三区域独立调整
- 每个区域可独立控制色相、饱和度和亮度
- 支持多种混合模式
- 使用改进的Lab色彩空间算法，实现更自然的色彩过渡
- 精确的色相/饱和度映射，保持色彩准确性

#### 🖼️ 预设风格 (PS Curve Preset)
- 70+种专业调色预设
- 涵盖人像、风景、电影、复古等多种风格
- 一键应用，快速实现专业调色效果

#### 🎯 高级遮罩支持
- 选择性调整特定区域
- 遮罩边缘羽化，自然过渡
- 支持遮罩反转

#### 💡 交互式编辑
- **双击节点打开专业调整弹窗**，在弹出界面中实时预览调整效果
- **弹窗内所有调整参数实时同步**，无需重新运行工作流
- **零延迟反馈**：在弹出窗口中调整参数时图像实时更新，像使用专业图像编辑软件一样流畅
- 支持曲线、HSL和色彩分级节点的交互式编辑
- 类似Photoshop的专业编辑体验

### 📥 安装方法

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

### 📝 使用技巧

#### 如何使用弹窗实时预览功能

1. **曲线调整实时预览**：
   - 在工作流中添加PS Curve节点
   - 连接输入图像和遮罩（可选）
   - **双击节点**打开调整弹窗
   - 此时您可以看到弹出窗口中的图像预览区域和曲线编辑区域
   - 在弹窗内曲线上添加控制点：**点击曲线**添加新控制点
   - 在弹窗内拖动控制点：**左键按住并拖动**控制点，观察图像实时变化
   - 在弹窗内删除控制点：**右键点击**控制点
   - 在弹窗内切换通道：点击**RGB、R、G、B**按钮切换不同通道曲线
   - 在弹窗内调整强度：移动**强度滑块**即时查看不同强度效果
   - 完成后点击弹窗中的**应用**按钮，参数将自动同步到节点

2. **HSL调整实时预览**：
   - 在工作流中添加PS HSL节点
   - 连接输入图像和遮罩（可选）
   - **双击节点**打开HSL调整弹窗
   - 在弹出窗口中选择您想调整的颜色通道（红、橙、黄等）
   - 在弹窗内移动**色相滑块**：左右拖动调整该颜色的色相值
   - 在弹窗内移动**饱和度滑块**：左右拖动调整该颜色的饱和度
   - 在弹窗内移动**明度滑块**：左右拖动调整该颜色的明度
   - 弹窗内每个滑块调整都会**实时更新**预览图像
   - 完成后点击弹窗中的**应用**按钮，参数将自动同步到节点

3. **Color Grading调整实时预览**：
   - 在工作流中添加Color Grading节点
   - 连接输入图像和遮罩（可选）
   - **双击节点**打开色彩分级调整弹窗
   - 在弹出窗口中您将看到三个色轮：阴影、中间调和高光
   - 在每个色轮中拖动中心点调整该区域的色相和饱和度
   - 使用每个色轮下方的亮度滑块调整该区域的亮度
   - 调整混合模式和整体强度以控制效果的应用方式
   - 预览窗口实时更新，所见即所得
   - 完成后点击弹窗中的**应用**按钮，参数将自动同步到节点

4. **弹窗预览界面通用操作**：
   - **放大/缩小预览**：在弹窗内使用鼠标滚轮或+/-按钮
   - **平移预览**：在弹窗内按住中键并拖动
   - **对比原图**：在弹窗内按住空格键查看原始图像，释放返回调整后效果
   - **重置参数**：点击弹窗内的重置按钮恢复默认设置
   - **取消编辑**：点击弹窗内的取消按钮放弃当前更改
   - **应用编辑**：点击弹窗内的应用按钮确认更改并同步到节点

#### 曲线调整技巧
- S形曲线：增加对比度
- 反S形：减少对比度
- 上移曲线：提亮图像
- 下移曲线：压暗图像
- 曲线格式：`x1,y1;x2,y2;x3,y3`（例如：`0,0;128,150;255,255`）
- **实时预览技巧**：在弹窗中使用多个控制点微调局部区域，观察实时效果找到最佳调整

#### HSL调整技巧
- 肤色调整：微调红橙色相和饱和度
- 天空增强：调整蓝色和浅绿通道
- 叶绿增强：调整绿色和黄色通道
- 日落效果：增强橙色和品红通道
- **实时预览技巧**：在弹窗中逐个通道调整并观察实时效果，找到理想的颜色平衡点

#### Color Grading技巧
- 电影风格：阴影区域添加蓝色，高光添加暖色
- 复古效果：阴影添加青色，高光添加橙黄色
- 日落效果：阴影添加紫色，高光添加橙色
- 增强氛围：使用soft_light混合模式，微调阴影和高光色轮
- 增强对比：使用overlay混合模式，增加阴影区域饱和度
- 冷暖平衡：阴影区域偏蓝（冷色调），高光区域偏黄（暖色调）

#### 遮罩应用技巧
- 人像皮肤：建议2-4像素羽化
- 天空背景：建议5-10像素羽化
- 物体边缘：建议1-3像素羽化
- 大面积区域：建议8-15像素羽化

### 🆕 最近更新

#### Color Grading功能改进
- 优化了色彩分级算法，使其更接近Adobe Lightroom的效果
- 实现了改进的亮度遮罩算法，使用sigmoid函数创建平滑过渡
- 使用Lab色彩空间处理，保持感知亮度不变
- 改进了色相和饱和度到Lab空间的转换算法
- 添加了多种混合模式支持
- 优化了实时预览性能

### 📄 许可证

MIT许可证 - 查看 [LICENSE](LICENSE) 文件。

---

## English

Professional color adjustment extension for ComfyUI with Photoshop-like Curve, HSL, and Levels adjustment functionality, 70+ preset styles, advanced mask support, and Lightroom-style Color Grading. **The standout feature is the ability to double-click nodes to open popup windows with real-time preview that allows you to color grade with the precision of professional image editing software.**

### 🌟 Key Features

#### 🎨 Curve Adjustment (PS Curve)
- Professional Photoshop-style curve adjustment with multiple interpolation methods
- **Double-click node for real-time adjustment interface**: Directly drag control points in the popup window and instantly see image changes
- Real-time curve chart with optional histogram background display
- Support for RGB overall or individual R/G/B channel adjustment
- Adjustable curve effect intensity (0-200%)
- **Popup window adjustments apply immediately**: All curve modifications can be viewed in real-time within the popup without re-running the workflow

#### 🎭 HSL Adjustment (PS HSL)
- Precise control over 8 color channels: Red, Orange, Yellow, Green, Cyan, Blue, Purple, Magenta
- Independent adjustment of Hue, Saturation, and Lightness for each color
- **Double-click node to open HSL adjustment popup**: Slide controllers in the popup window to immediately see color change effects, WYSIWYG
- Support for masks and feathering effects
- **Real-time interactive response in popup**: Any HSL parameter adjustment in the popup interface instantly reflects in the preview image

#### 📊 Histogram & Levels (PS Histogram)
- Complete histogram analysis with PS-style levels adjustment
- Real-time histogram data and statistics
- Auto levels and auto contrast functions
- Precise control: input/output black/white points, gamma

#### 🎨 Color Grading
- Lightroom-style color grading wheels
- Independent adjustment for shadows, midtones, and highlights
- Control hue, saturation, and luminance for each region
- Support for multiple blend modes
- Improved Lab color space algorithm for more natural color transitions
- Precise hue/saturation mapping for color accuracy

#### 🖼️ Preset Styles (PS Curve Preset)
- 70+ professional color grading presets
- Covers portrait, landscape, cinematic, vintage, and more
- One-click application for quick professional color grading

#### 🎯 Advanced Mask Support
- Selective adjustment of specific areas
- Mask edge feathering for natural transitions
- Support for mask inversion

#### 💡 Interactive Editing
- **Double-click nodes to open professional adjustment popup** with real-time preview in the window
- **All adjustment parameters in the popup sync instantly** without re-running the workflow
- **Zero-delay feedback**: Images update in real-time in the popup window as parameters are adjusted, as smooth as using professional image editing software
- Supports interactive editing for Curve, HSL and Color Grading nodes
- Professional editing experience similar to Photoshop and Lightroom

### 📥 Installation

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

### 📝 Usage Tips

#### How to Use Popup Real-time Preview

1. **Curve Adjustment Real-time Preview**:
   - Add PS Curve node to your workflow
   - Connect input image and mask (optional)
   - **Double-click the node** to open the adjustment popup window
   - You'll see the image preview area and curve editing area in the popup
   - Add control points in the popup: **Click on the curve** to add a new control point
   - Move control points in the popup: **Left-click and drag** a control point to see real-time image changes
   - Delete control points in the popup: **Right-click** on a control point
   - Switch channels in the popup: Click on **RGB, R, G, B** buttons to toggle different channel curves
   - Adjust intensity in the popup: Move the **intensity slider** to instantly see different strength effects
   - When finished, click **Apply** in the popup window and parameters will automatically sync to the node

2. **HSL Adjustment Real-time Preview**:
   - Add PS HSL node to your workflow
   - Connect input image and mask (optional)
   - **Double-click the node** to open the HSL adjustment popup window
   - In the popup window, select the color channel you want to adjust (Red, Orange, Yellow, etc.)
   - Move **Hue slider** in the popup: Drag left/right to adjust the hue value for that color
   - Move **Saturation slider** in the popup: Drag left/right to adjust the saturation
   - Move **Lightness slider** in the popup: Drag left/right to adjust the lightness
   - Each slider adjustment in the popup will **update the preview image in real-time**
   - When finished, click **Apply** in the popup window and parameters will automatically sync to the node

3. **Color Grading Real-time Preview**:
   - Add Color Grading node to your workflow
   - Connect input image and mask (optional)
   - **Double-click the node** to open the color grading popup window
   - In the popup, you'll see three color wheels for shadows, midtones, and highlights
   - Drag the center point in each wheel to adjust hue and saturation for that region
   - Use the luminance slider below each wheel to adjust brightness for that region
   - Adjust blend mode and overall strength to control how the effect is applied
   - The preview window updates in real-time, showing exactly what you'll get
   - When finished, click **Apply** in the popup window and parameters will automatically sync to the node

4. **Popup Preview Interface Common Operations**:
   - **Zoom in/out preview**: Use mouse wheel or +/- buttons in the popup
   - **Pan preview**: Hold middle mouse button and drag in the popup
   - **Compare with original**: Hold spacebar in the popup to view original image, release to return to adjusted effect
   - **Reset parameters**: Click the reset button in the popup to restore default settings
   - **Cancel editing**: Click cancel button in the popup to discard current changes
   - **Apply editing**: Click apply button in the popup to confirm changes and sync to node

#### Curve Adjustment Tips
- S-curve: Increases contrast
- Inverse S-curve: Reduces contrast
- Moving curve up: Brightens image
- Moving curve down: Darkens image
- Curve format: `x1,y1;x2,y2;x3,y3` (e.g., `0,0;128,150;255,255`)
- **Real-time preview tip**: Use multiple control points in the popup window to fine-tune local areas, observe real-time effects to find optimal adjustments

#### HSL Adjustment Tips
- Skin tone adjustment: Fine-tune Red and Orange hue and saturation
- Sky enhancement: Adjust Blue and Cyan channels
- Foliage enhancement: Adjust Green and Yellow channels
- Sunset effect: Enhance Orange and Magenta channels
- **Real-time preview tip**: In the popup window, adjust channels one by one while observing real-time effects to find the ideal color balance

#### Color Grading Tips
- Cinematic look: Add blue to shadows and warm tones to highlights
- Vintage effect: Add cyan to shadows and orange/yellow to highlights
- Sunset effect: Add purple to shadows and orange to highlights
- Enhance mood: Use soft_light blend mode with subtle shadow and highlight wheel adjustments
- Enhance contrast: Use overlay blend mode and increase saturation in shadow region
- Cool-warm balance: Bluish (cool) shadows with yellowish (warm) highlights

#### Mask Application Tips
- Portrait skin: Recommended 2-4 pixel feathering
- Sky background: Recommended 5-10 pixel feathering
- Object edges: Recommended 1-3 pixel feathering
- Large areas: Recommended 8-15 pixel feathering

### 🆕 Recent Updates

#### Color Grading Improvements
- Optimized color grading algorithm to more closely match Adobe Lightroom's effect
- Implemented improved luminance mask algorithm using sigmoid functions for smooth transitions
- Using Lab color space processing to maintain perceived luminance
- Improved hue and saturation to Lab space conversion algorithm
- Added support for multiple blend modes
- Optimized real-time preview performance

### 📄 License

MIT License - See [LICENSE](LICENSE) file.

---

<div align="center">

**如果这个项目对你有帮助，请给个Star支持！**

</div> 

