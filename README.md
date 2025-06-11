# ComfyUI-Curve

<!-- 语言切换 | Language Switch -->
<div align="center">
  <a href="#中文">中文</a> | <a href="#english">English</a>
</div>

---

## 中文

ComfyUI专业色彩调整扩展，提供类似Photoshop的曲线、HSL、色阶调整功能，支持70+种预设风格和高级遮罩。
![image](https://github.com/user-attachments/assets/3bdd4d7d-8e9a-492a-87d2-9d05576d1f0b)


### 🌟 主要功能

#### 🎨 曲线调整 (PS Curve)
![image](https://github.com/user-attachments/assets/1bb16903-78fd-470d-8e84-f4ad84e4e6c4)

- 类似Photoshop的专业曲线调整，支持多种插值方式
- 实时曲线图表，可选直方图背景显示
- 支持RGB整体或单独R/G/B通道调整
- 可调曲线效果强度（0-200%）

#### 🎭 HSL调整 (PS HSL)
![image](https://github.com/user-attachments/assets/e7389828-c37c-423d-be45-32a572b86d4b)

- 精准控制8个颜色通道：红、橙、黄、绿、浅绿、蓝、紫、品红
- 每个颜色可独立调整色相、饱和度、明度
- 支持遮罩和羽化效果

#### 📊 直方图与色阶 (PS Histogram)
- 完整的直方图分析和PS风格的色阶调整
- 实时直方图数据和统计信息
- 自动色阶和自动对比度功能
- 精确控制：输入/输出黑白场点、伽马

#### 🖼️ 预设风格 (PS Curve Preset)
- 70+种专业调色预设
- 涵盖人像、风景、电影、复古等多种风格
- 一键应用，快速实现专业调色效果

#### 🎯 高级遮罩支持
- 选择性调整特定区域
- 遮罩边缘羽化，自然过渡
- 支持遮罩反转

#### 💡 交互式编辑
- 双击节点打开专业调整界面，实时预览调整效果
- 所有调整参数实时同步到节点，无需重新运行工作流
- 支持曲线和HSL节点的交互式编辑
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

#### 曲线调整技巧
- S形曲线：增加对比度
- 反S形：减少对比度
- 上移曲线：提亮图像
- 下移曲线：压暗图像
- 曲线格式：`x1,y1;x2,y2;x3,y3`（例如：`0,0;128,150;255,255`）

#### HSL调整技巧
- 肤色调整：微调红橙色相和饱和度
- 天空增强：调整蓝色和浅绿通道
- 叶绿增强：调整绿色和黄色通道
- 日落效果：增强橙色和品红通道

#### 遮罩应用技巧
- 人像皮肤：建议2-4像素羽化
- 天空背景：建议5-10像素羽化
- 物体边缘：建议1-3像素羽化
- 大面积区域：建议8-15像素羽化

### 📄 许可证

MIT许可证 - 查看 [LICENSE](LICENSE) 文件。

---

## English

Professional color adjustment extension for ComfyUI with Photoshop-like Curve, HSL, and Levels adjustment functionality, 70+ preset styles, and advanced mask support.

### 🌟 Key Features

#### 🎨 Curve Adjustment (PS Curve)
- Professional Photoshop-style curve adjustment with multiple interpolation methods
- Real-time curve chart with optional histogram background display
- Support for RGB overall or individual R/G/B channel adjustment
- Adjustable curve effect intensity (0-200%)

#### 🎭 HSL Adjustment (PS HSL)
- Precise control over 8 color channels: Red, Orange, Yellow, Green, Cyan, Blue, Purple, Magenta
- Independent adjustment of Hue, Saturation, and Lightness for each color
- Support for masks and feathering effects
- Two-column layout for a clean, compact interface

#### 📊 Histogram & Levels (PS Histogram)
- Complete histogram analysis with PS-style levels adjustment
- Real-time histogram data and statistics
- Auto levels and auto contrast functions
- Precise control: input/output black/white points, gamma

#### 🖼️ Preset Styles (PS Curve Preset)
- 70+ professional color grading presets
- Covers portrait, landscape, cinematic, vintage, and more
- One-click application for quick professional color grading

#### 🎯 Advanced Mask Support
- Selective adjustment of specific areas
- Mask edge feathering for natural transitions
- Support for mask inversion

#### 💡 Interactive Editing
- Double-click nodes to open professional adjustment interface with real-time preview
- All adjustment parameters sync to the node instantly without re-running the workflow
- Supports interactive editing for both Curve and HSL nodes
- Professional editing experience similar to Photoshop

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

#### Curve Adjustment Tips
- S-curve: Increases contrast
- Inverse S-curve: Reduces contrast
- Moving curve up: Brightens image
- Moving curve down: Darkens image
- Curve format: `x1,y1;x2,y2;x3,y3` (e.g., `0,0;128,150;255,255`)

#### HSL Adjustment Tips
- Skin tone adjustment: Fine-tune Red and Orange hue and saturation
- Sky enhancement: Adjust Blue and Cyan channels
- Foliage enhancement: Adjust Green and Yellow channels
- Sunset effect: Enhance Orange and Magenta channels

#### Mask Application Tips
- Portrait skin: Recommended 2-4 pixel feathering
- Sky background: Recommended 5-10 pixel feathering
- Object edges: Recommended 1-3 pixel feathering
- Large areas: Recommended 8-15 pixel feathering

### 📄 License

MIT License - See [LICENSE](LICENSE) file.

---

<div align="center">

**如果这个项目对你有帮助，请给个Star支持！**
![image](https://github.com/user-attachments/assets/3226737e-ae78-4a18-96de-bf8a1c135c18)
                    Buy Me a Coffe

</div> 

