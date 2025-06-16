/**
 * Color Grading Node - 前端交互界面
 * 实现Lightroom风格的色彩分级功能，包含三个色轮：阴影、中间调、高光
 */

import { app } from "../../scripts/app.js";

// 全局节点输出缓存
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// Color Grading编辑器类
class ColorGradingEditor {
    constructor(node, options = {}) {
        this.node = node;
        this.isOpen = false;
        this.modal = null;
        this.canvasContainers = {};
        this.colorWheels = {};
        this.previewCanvas = null;
        this.previewContext = null;
        this.currentImage = null;
        this.currentMask = null;
        
        // 色彩分级参数
        this.gradingData = {
            shadows: { hue: 0, saturation: 0, luminance: 0 },
            midtones: { hue: 0, saturation: 0, luminance: 0 },
            highlights: { hue: 0, saturation: 0, luminance: 0 },
            blend_mode: 'normal',
            overall_strength: 1.0
        };
        
        this.createModal();
    }
    
    createModal() {
        // 创建模态弹窗
        this.modal = document.createElement("div");
        this.modal.className = "color-grading-modal";
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: none;
            justify-content: center;
            align-items: center;
        `;
        
        // 创建主容器
        const container = document.createElement("div");
        container.className = "color-grading-container";
        container.style.cssText = `
            background-color: #2a2a2a;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            width: 95%;
            max-width: 1400px;
            height: 90%;
            max-height: 900px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        
        // 标题栏
        const header = this.createHeader();
        container.appendChild(header);
        
        // 主内容区域
        const content = document.createElement("div");
        content.className = "color-grading-content";
        content.style.cssText = `
            display: flex;
            flex: 1;
            overflow: hidden;
        `;
        
        // 左侧预览区域
        const previewSection = this.createPreviewSection();
        content.appendChild(previewSection);
        
        // 右侧控制区域
        const controlSection = this.createControlSection();
        content.appendChild(controlSection);
        
        container.appendChild(content);
        this.modal.appendChild(container);
        
        this.setupEventListeners();
    }
    
    createHeader() {
        const header = document.createElement("div");
        header.className = "color-grading-header";
        header.style.cssText = `
            padding: 15px 20px;
            background-color: #1a1a1a;
            border-bottom: 1px solid #404040;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        // 标题
        const title = document.createElement("h3");
        title.style.cssText = `
            color: #ffffff;
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        `;
        title.textContent = "🎨 Color Grading Wheels";
        header.appendChild(title);
        
        // 按钮容器
        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;
        
        // 重置按钮
        const resetBtn = document.createElement("button");
        resetBtn.className = "color-grading-reset";
        resetBtn.style.cssText = `
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        `;
        resetBtn.textContent = "重置";
        resetBtn.addEventListener('mouseenter', () => resetBtn.style.backgroundColor = '#2980b9');
        resetBtn.addEventListener('mouseleave', () => resetBtn.style.backgroundColor = '#3498db');
        resetBtn.addEventListener('click', () => this.resetAllValues());
        
        // 应用按钮
        const applyBtn = document.createElement("button");
        applyBtn.className = "color-grading-apply";
        applyBtn.style.cssText = `
            background-color: #27ae60;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        `;
        applyBtn.textContent = "应用";
        applyBtn.addEventListener('mouseenter', () => applyBtn.style.backgroundColor = '#229954');
        applyBtn.addEventListener('mouseleave', () => applyBtn.style.backgroundColor = '#27ae60');
        applyBtn.addEventListener('click', () => this.applyChanges());
        
        // 关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.className = "color-grading-close";
        closeBtn.style.cssText = `
            background-color: #ff4757;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        `;
        closeBtn.textContent = "关闭";
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#ff3838');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = '#ff4757');
        
        buttonContainer.appendChild(resetBtn);
        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(closeBtn);
        header.appendChild(buttonContainer);
        
        return header;
    }
    
    createPreviewSection() {
        const section = document.createElement("div");
        section.className = "preview-section";
        section.style.cssText = `
            flex: 1;
            padding: 20px;
            background-color: #1e1e1e;
            border-right: 1px solid #404040;
            display: flex;
            flex-direction: column;
        `;
        
        // 预览标题
        const title = document.createElement("h4");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 15px 0;
            font-size: 16px;
            font-weight: 500;
        `;
        title.textContent = "实时预览";
        section.appendChild(title);
        
        // 预览画布容器
        const canvasContainer = document.createElement("div");
        canvasContainer.style.cssText = `
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #0a0a0a;
            border-radius: 8px;
            border: 2px solid #333333;
            position: relative;
            overflow: hidden;
        `;
        
        // 预览画布
        this.previewCanvas = document.createElement("canvas");
        this.previewCanvas.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 5px;
        `;
        this.previewContext = this.previewCanvas.getContext('2d');
        canvasContainer.appendChild(this.previewCanvas);
        
        // 加载提示
        const loadingText = document.createElement("div");
        loadingText.className = "loading-text";
        loadingText.style.cssText = `
            position: absolute;
            color: #888888;
            font-size: 14px;
            pointer-events: none;
        `;
        loadingText.textContent = "等待图像数据...";
        canvasContainer.appendChild(loadingText);
        
        section.appendChild(canvasContainer);
        
        return section;
    }
    
    createControlSection() {
        const section = document.createElement("div");
        section.className = "control-section";
        section.style.cssText = `
            width: 500px;
            padding: 20px;
            background-color: #2a2a2a;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
        `;
        
        // 控制标题
        const title = document.createElement("h4");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 20px 0;
            font-size: 16px;
            font-weight: 500;
        `;
        title.textContent = "色彩分级控制";
        section.appendChild(title);
        
        // 创建三个色轮区域
        const regions = [
            { key: 'shadows', name: '阴影', color: '#4a4a4a' },
            { key: 'midtones', name: '中间调', color: '#808080' },
            { key: 'highlights', name: '高光', color: '#c4c4c4' }
        ];
        
        regions.forEach(region => {
            const wheelContainer = this.createColorWheel(region);
            section.appendChild(wheelContainer);
        });
        
        // 全局控制
        const globalControls = this.createGlobalControls();
        section.appendChild(globalControls);
        
        return section;
    }
    
    createColorWheel(region) {
        const container = document.createElement("div");
        container.className = `color-wheel-container ${region.key}`;
        container.style.cssText = `
            margin-bottom: 25px;
            padding: 15px;
            background-color: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #404040;
        `;
        
        // 区域标题
        const title = document.createElement("h5");
        title.style.cssText = `
            color: ${region.color};
            margin: 0 0 15px 0;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        `;
        title.textContent = region.name;
        container.appendChild(title);
        
        // 色轮和滑块容器
        const controlsContainer = document.createElement("div");
        controlsContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 15px;
        `;
        
        // 色轮画布
        const wheelCanvas = document.createElement("canvas");
        wheelCanvas.width = 120;
        wheelCanvas.height = 120;
        wheelCanvas.style.cssText = `
            border-radius: 50%;
            cursor: crosshair;
            border: 2px solid #555555;
            flex-shrink: 0;
        `;
        
        // 绘制色轮
        this.drawColorWheel(wheelCanvas, region.key);
        
        // 滑块容器
        const slidersContainer = document.createElement("div");
        slidersContainer.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        // 色相滑块
        const hueSlider = this.createSlider(`${region.key}_hue`, '色相', -180, 180, 0, '°');
        slidersContainer.appendChild(hueSlider);
        
        // 饱和度滑块
        const saturationSlider = this.createSlider(`${region.key}_saturation`, '饱和度', -100, 100, 0, '%');
        slidersContainer.appendChild(saturationSlider);
        
        // 明度滑块
        const luminanceSlider = this.createSlider(`${region.key}_luminance`, '明度', -100, 100, 0, '%');
        slidersContainer.appendChild(luminanceSlider);
        
        controlsContainer.appendChild(wheelCanvas);
        controlsContainer.appendChild(slidersContainer);
        container.appendChild(controlsContainer);
        
        // 存储色轮引用
        this.colorWheels[region.key] = {
            canvas: wheelCanvas,
            context: wheelCanvas.getContext('2d'),
            region: region.key
        };
        
        // 添加色轮交互事件
        this.setupColorWheelEvents(wheelCanvas, region.key);
        
        return container;
    }
    
    drawColorWheel(canvas, regionKey) {
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 5;
        
        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制色相环
        for (let angle = 0; angle < 360; angle += 1) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = angle * Math.PI / 180;
            
            // 创建径向渐变（从中心到边缘：灰色到色相）
            const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            gradient.addColorStop(0, '#808080'); // 中心灰色
            gradient.addColorStop(1, `hsl(${angle}, 100%, 50%)`); // 边缘色相
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.arc(centerX, centerY, 0, endAngle, startAngle, true);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
        
        // 绘制中心点
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 绘制当前位置指示器
        this.drawWheelIndicator(canvas, regionKey);
    }
    
    drawWheelIndicator(canvas, regionKey) {
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 5;
        
        const data = this.gradingData[regionKey];
        if (!data) return;
        
        // 将色相和饱和度转换为坐标
        const hue = data.hue * Math.PI / 180;
        const saturation = Math.abs(data.saturation) / 100; // 归一化到0-1
        
        const x = centerX + Math.cos(hue) * saturation * radius;
        const y = centerY + Math.sin(hue) * saturation * radius;
        
        // 绘制指示器
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    setupColorWheelEvents(canvas, regionKey) {
        let isDragging = false;
        
        const handleMouseEvent = (e) => {
            const rect = canvas.getBoundingClientRect();
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.min(centerX, centerY) - 5;
            
            const x = (e.clientX - rect.left) * (canvas.width / rect.width) - centerX;
            const y = (e.clientY - rect.top) * (canvas.height / rect.height) - centerY;
            
            const distance = Math.sqrt(x * x + y * y);
            if (distance > radius) return;
            
            // 计算色相和饱和度
            const hue = Math.atan2(y, x) * 180 / Math.PI;
            const saturation = Math.min(distance / radius, 1) * 100;
            
            // 更新数据
            this.gradingData[regionKey].hue = hue;
            this.gradingData[regionKey].saturation = saturation;
            
            // 同步更新对应的滑块值
            this.updateSliderValues(regionKey);
            
            // 重绘色轮
            this.drawColorWheel(canvas, regionKey);
            
            // 触发预览更新
            this.updatePreview();
        };
        
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            handleMouseEvent(e);
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                handleMouseEvent(e);
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
        });
    }
    
    createSlider(id, label, min, max, defaultValue, unit = '') {
        const container = document.createElement("div");
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        // 标签
        const labelElement = document.createElement("label");
        labelElement.style.cssText = `
            color: #cccccc;
            font-size: 12px;
            min-width: 40px;
            text-align: right;
        `;
        labelElement.textContent = label;
        container.appendChild(labelElement);
        
        // 滑块
        const slider = document.createElement("input");
        slider.type = "range";
        slider.id = id;
        slider.min = min;
        slider.max = max;
        slider.value = defaultValue;
        slider.step = 1;
        slider.style.cssText = `
            flex: 1;
            height: 4px;
            background: #444444;
            outline: none;
            border-radius: 2px;
        `;
        
        // 数值显示
        const valueDisplay = document.createElement("span");
        valueDisplay.style.cssText = `
            color: #ffffff;
            font-size: 12px;
            min-width: 40px;
            text-align: center;
            background-color: #333333;
            padding: 2px 6px;
            border-radius: 3px;
        `;
        valueDisplay.textContent = defaultValue + unit;
        
        // 事件监听
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            valueDisplay.textContent = value + unit;
            
            // 特殊处理overall_strength
            if (id === 'overall_strength') {
                this.gradingData.overall_strength = value / 100.0;
            } else {
                // 解析ID以更新对应数据
                const [regionKey, property] = id.split('_');
                if (this.gradingData[regionKey]) {
                    this.gradingData[regionKey][property] = value;
                    
                    // 如果是色相或饱和度变化，更新对应的色轮显示
                    if ((property === 'hue' || property === 'saturation') && this.colorWheels[regionKey]) {
                        this.drawColorWheel(this.colorWheels[regionKey].canvas, regionKey);
                    }
                }
            }
            this.updatePreview();
        });
        
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        
        return container;
    }
    
    createGlobalControls() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background-color: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #404040;
        `;
        
        // 标题
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 15px 0;
            font-size: 14px;
            font-weight: 600;
        `;
        title.textContent = "全局控制";
        container.appendChild(title);
        
        // 混合模式选择
        const blendModeContainer = document.createElement("div");
        blendModeContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        `;
        
        const blendLabel = document.createElement("label");
        blendLabel.style.cssText = `
            color: #cccccc;
            font-size: 12px;
            min-width: 60px;
        `;
        blendLabel.textContent = "混合模式";
        
        const blendSelect = document.createElement("select");
        blendSelect.style.cssText = `
            flex: 1;
            background-color: #333333;
            color: #ffffff;
            border: 1px solid #555555;
            border-radius: 4px;
            padding: 5px;
            font-size: 12px;
        `;
        
        const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn'];
        blendModes.forEach(mode => {
            const option = document.createElement("option");
            option.value = mode;
            option.textContent = mode;
            blendSelect.appendChild(option);
        });
        
        blendSelect.addEventListener('change', (e) => {
            this.gradingData.blend_mode = e.target.value;
            this.updatePreview();
        });
        
        blendModeContainer.appendChild(blendLabel);
        blendModeContainer.appendChild(blendSelect);
        container.appendChild(blendModeContainer);
        
        // 整体强度滑块（createSlider已经正确处理overall_strength的事件监听）
        const strengthSlider = this.createSlider('overall_strength', '强度', 0, 200, 100, '%');
        
        container.appendChild(strengthSlider);
        
        return container;
    }
    
    setupEventListeners() {
        // 关闭按钮事件
        const closeBtn = this.modal.querySelector('.color-grading-close');
        closeBtn.addEventListener('click', () => this.hide());
        
        // 点击遮罩关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
        
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.hide();
            }
        });
    }
    
    show() {
        document.body.appendChild(this.modal);
        this.modal.style.display = 'flex';
        this.isOpen = true;
        
        // 从节点widgets加载当前参数值
        this.loadCurrentValues();
        
        // 加载图像
        this.loadImage();
    }
    
    loadCurrentValues() {
        // 从节点的widgets读取当前值
        if (!this.node.widgets) return;
        
        // 重置gradingData为默认值，确保从节点获取最新数据
        this.gradingData = {
            shadows: { hue: 0, saturation: 0, luminance: 0 },
            midtones: { hue: 0, saturation: 0, luminance: 0 },
            highlights: { hue: 0, saturation: 0, luminance: 0 },
            blend_mode: 'normal',
            overall_strength: 1.0
        };
        
        for (const widget of this.node.widgets) {
            switch(widget.name) {
                case 'shadows_hue':
                    this.gradingData.shadows.hue = widget.value;
                    break;
                case 'shadows_saturation':
                    this.gradingData.shadows.saturation = widget.value;
                    break;
                case 'shadows_luminance':
                    this.gradingData.shadows.luminance = widget.value;
                    break;
                case 'midtones_hue':
                    this.gradingData.midtones.hue = widget.value;
                    break;
                case 'midtones_saturation':
                    this.gradingData.midtones.saturation = widget.value;
                    break;
                case 'midtones_luminance':
                    this.gradingData.midtones.luminance = widget.value;
                    break;
                case 'highlights_hue':
                    this.gradingData.highlights.hue = widget.value;
                    break;
                case 'highlights_saturation':
                    this.gradingData.highlights.saturation = widget.value;
                    break;
                case 'highlights_luminance':
                    this.gradingData.highlights.luminance = widget.value;
                    break;
                case 'blend_mode':
                    this.gradingData.blend_mode = widget.value;
                    break;
                case 'overall_strength':
                    this.gradingData.overall_strength = widget.value;
                    break;
            }
        }
        
        console.log("🎨 Color Grading: 加载当前值完成", this.gradingData);
        
        // 更新UI组件以反映当前值
        this.updateUIFromData();
    }
    
    updateUIFromData() {
        // 更新滑块值
        const updateSlider = (id, value) => {
            const slider = this.modal.querySelector(`#${id}`);
            if (slider) {
                slider.value = value;
                const valueDisplay = slider.parentElement.querySelector('span');
                if (valueDisplay) {
                    // 根据滑块类型确定单位
                    let unit = '%';
                    if (id.includes('hue')) {
                        unit = '°';
                    }
                    valueDisplay.textContent = value + unit;
                }
            }
        };
        
        // 更新所有滑块值
        // Shadows区域
        updateSlider('shadows_hue', this.gradingData.shadows.hue);
        updateSlider('shadows_saturation', this.gradingData.shadows.saturation);
        updateSlider('shadows_luminance', this.gradingData.shadows.luminance);
        
        // Midtones区域
        updateSlider('midtones_hue', this.gradingData.midtones.hue);
        updateSlider('midtones_saturation', this.gradingData.midtones.saturation);
        updateSlider('midtones_luminance', this.gradingData.midtones.luminance);
        
        // Highlights区域
        updateSlider('highlights_hue', this.gradingData.highlights.hue);
        updateSlider('highlights_saturation', this.gradingData.highlights.saturation);
        updateSlider('highlights_luminance', this.gradingData.highlights.luminance);
        
        // 特殊处理overall_strength（需要转换为百分比）
        const strengthSlider = this.modal.querySelector('#overall_strength');
        if (strengthSlider) {
            const strengthValue = this.gradingData.overall_strength * 100;
            strengthSlider.value = strengthValue;
            const valueDisplay = strengthSlider.parentElement.querySelector('span');
            if (valueDisplay) {
                valueDisplay.textContent = strengthValue + '%';
            }
        }
        
        // 更新混合模式
        const blendSelect = this.modal.querySelector('select');
        if (blendSelect) {
            blendSelect.value = this.gradingData.blend_mode;
        }
        
        // 重绘所有色轮以显示当前位置
        Object.keys(this.colorWheels).forEach(regionKey => {
            this.drawColorWheel(this.colorWheels[regionKey].canvas, regionKey);
        });
    }
    
    hide() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.isOpen = false;
    }
    
    loadImage() {
        try {
            // 获取图像的方法（多重备用方案）
            const imageUrl = this.getNodeImage();
            const maskUrl = this.getNodeMask();
            
            if (imageUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    this.currentImage = img;
                    this.updatePreviewCanvas();
                    this.hideLoadingText();
                };
                
                img.onerror = () => {
                    console.error('Color Grading: 图像加载失败');
                    this.showLoadingText('图像加载失败');
                };
                
                img.src = imageUrl;
            } else {
                console.warn('Color Grading: 未找到图像数据');
                this.showLoadingText('未找到图像数据');
            }
            
            // 加载遮罩（如果有）
            if (maskUrl) {
                const maskImg = new Image();
                maskImg.crossOrigin = 'anonymous';
                
                maskImg.onload = () => {
                    this.currentMask = maskImg;
                    if (this.currentImage) {
                        this.updatePreviewCanvas();
                    }
                };
                
                maskImg.onerror = () => {
                    console.warn('Color Grading: 遮罩加载失败');
                    this.currentMask = null;
                };
                
                maskImg.src = maskUrl;
            } else {
                this.currentMask = null;
            }
        } catch (error) {
            console.error('Color Grading: 加载图像时出错:', error);
            this.showLoadingText('加载图像时出错');
        }
    }
    
    getNodeMask() {
        try {
            // 从后端推送的遮罩
            if (this.node._previewMaskUrl) {
                console.log('Color Grading: 使用后端推送的遮罩');
                return this.node._previewMaskUrl;
            }
            
            // 其他获取遮罩的方法可以在这里添加
            
            return null;
        } catch (error) {
            console.error('Color Grading: 获取遮罩时出错:', error);
            return null;
        }
    }
    
    getNodeImage() {
        try {
            // 方法1: 后端推送的预览图像
            if (this.node._previewImageUrl) {
                console.log('Color Grading: 使用后端推送的图像');
                return this.node._previewImageUrl;
            }
            
            // 方法2: 从全局缓存获取
            const cached = window.globalNodeCache.get(String(this.node.id));
            if (cached && cached.images && cached.images.length > 0) {
                console.log('Color Grading: 使用缓存的图像');
                return this.convertToImageUrl(cached.images[0]);
            }
            
            // 方法3: 从连接的输入节点获取
            const inputNode = this.findConnectedInputNode();
            if (inputNode && inputNode._curveNodeImageUrls && inputNode._curveNodeImageUrls.length > 0) {
                console.log('Color Grading: 使用输入节点的图像');
                return inputNode._curveNodeImageUrls[0];
            }
            
            // 方法4: 从app.nodeOutputs获取
            if (app.nodeOutputs) {
                const nodeOutput = app.nodeOutputs[this.node.id];
                if (nodeOutput && nodeOutput.images) {
                    console.log('Color Grading: 使用app.nodeOutputs的图像');
                    return this.convertToImageUrl(nodeOutput.images[0]);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Color Grading: 获取图像时出错:', error);
            return null;
        }
    }
    
    convertToImageUrl(imageData) {
        if (typeof imageData === 'string') {
            if (imageData.startsWith('data:')) {
                return imageData;
            }
            return `/view?filename=${imageData}`;
        }
        
        if (imageData && typeof imageData === 'object') {
            const { filename, subfolder = '', type = 'temp' } = imageData;
            return `/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
        }
        
        return null;
    }
    
    findConnectedInputNode() {
        if (!this.node.inputs || this.node.inputs.length === 0) {
            return null;
        }
        
        for (const input of this.node.inputs) {
            if (input.link) {
                const link = app.graph.links[input.link];
                if (link) {
                    const sourceNode = app.graph.getNodeById(link.origin_id);
                    if (sourceNode) {
                        return sourceNode;
                    }
                }
            }
        }
        
        return null;
    }
    
    updatePreviewCanvas() {
        if (!this.currentImage || !this.previewCanvas) return;
        
        // 设置画布尺寸
        const containerRect = this.previewCanvas.parentElement.getBoundingClientRect();
        const maxWidth = containerRect.width - 20;
        const maxHeight = containerRect.height - 20;
        
        // 计算缩放比例
        const scale = Math.min(
            maxWidth / this.currentImage.width,
            maxHeight / this.currentImage.height,
            1
        );
        
        this.previewCanvas.width = this.currentImage.width * scale;
        this.previewCanvas.height = this.currentImage.height * scale;
        
        // 绘制图像
        this.previewContext.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewContext.drawImage(
            this.currentImage, 
            0, 0, 
            this.previewCanvas.width, 
            this.previewCanvas.height
        );
        
        // 应用色彩分级效果（简化版本，实际效果由后端处理）
        this.applyPreviewEffects();
    }
    
    applyPreviewEffects() {
        // 实现更接近Lightroom的前端预览效果
        // 使用类似后端的算法，但在RGB空间中近似Lab效果
        
        if (!this.previewContext || !this.currentImage) return;
        
        // 获取原始图像数据（用于遮罩混合）
        this.previewContext.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        this.previewContext.drawImage(
            this.currentImage, 
            0, 0, 
            this.previewCanvas.width, 
            this.previewCanvas.height
        );
        const originalData = this.previewContext.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        // 获取图像数据
        const imageData = this.previewContext.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        const data = imageData.data;
        
        // 准备遮罩数据（如果有）
        let maskData = null;
        if (this.currentMask) {
            // 创建临时画布来处理遮罩
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = this.previewCanvas.width;
            maskCanvas.height = this.previewCanvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(this.currentMask, 0, 0, maskCanvas.width, maskCanvas.height);
            const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            maskData = maskImageData.data;
        }
        
        // 处理每个像素
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;
            
            // 计算亮度（使用感知亮度公式）
            const luminance = r * 0.299 + g * 0.587 + b * 0.114;
            
            // 创建改进的亮度遮罩（模拟后端的sigmoid函数）
            const shadowsMask = this.createImprovedMask(luminance, 'shadows');
            const midtonesMask = this.createImprovedMask(luminance, 'midtones');
            const highlightsMask = this.createImprovedMask(luminance, 'highlights');
            
            // 计算颜色偏移
            let deltaR = 0, deltaG = 0, deltaB = 0;
            
            // 处理每个区域的色彩调整
            const regions = [
                { mask: shadowsMask, data: this.gradingData.shadows },
                { mask: midtonesMask, data: this.gradingData.midtones },
                { mask: highlightsMask, data: this.gradingData.highlights }
            ];
            
            regions.forEach(region => {
                if (region.data.hue !== 0 || region.data.saturation !== 0) {
                    // 模拟后端的Lab色彩空间处理
                    const hueRad = region.data.hue * Math.PI / 180;
                    const satNormalized = Math.abs(region.data.saturation) / 100;
                    
                    // 模拟Lab空间的a和b通道偏移（与后端保持一致）
                    const maxOffset = 0.3;
                    let offsetA = Math.cos(hueRad) * satNormalized * maxOffset;
                    let offsetB = Math.sin(hueRad) * satNormalized * maxOffset;
                    
                    // 应用颜色敏感度调整（与后端一致）
                    const hueDeg = region.data.hue;
                    if (hueDeg >= -30 && hueDeg <= 30) { // 红色区域
                        offsetA *= 1.1;
                    } else if (hueDeg >= 150 && hueDeg <= 210) { // 青色区域
                        offsetA *= 0.9;
                    } else if (hueDeg >= 60 && hueDeg <= 120) { // 绿色区域
                        offsetB *= 0.95;
                    } else if (hueDeg >= 240 && hueDeg <= 300) { // 蓝色区域
                        offsetB *= 1.05;
                    }
                    
                    // 将Lab偏移转换为RGB调整（近似）
                    // Lab的a通道影响红-绿，b通道影响黄-蓝
                    const strength = region.mask * this.gradingData.overall_strength;
                    
                    // 更精确的Lab到RGB转换近似（基于Lab色彩空间的特性）
                    // a轴: 绿色(-) ← → 红色(+)
                    // b轴: 蓝色(-) ← → 黄色(+)
                    deltaR += (offsetA * 0.6 + offsetB * 0.3) * strength;
                    deltaG += (-offsetA * 0.5 + offsetB * 0.2) * strength;
                    deltaB += (-offsetA * 0.1 - offsetB * 0.8) * strength;
                }
                
                // 亮度调整（与后端保持一致）
                if (region.data.luminance !== 0) {
                    const lumFactor = region.data.luminance / 100 * region.mask * this.gradingData.overall_strength;
                    // 使用加法调整而不是乘法，更接近Lab空间的L通道调整
                    const lumAdjust = lumFactor * 0.2; // 降低强度以获得更自然的效果
                    deltaR += lumAdjust;
                    deltaG += lumAdjust;
                    deltaB += lumAdjust;
                }
            });
            
            // 应用调整
            let processedR = Math.min(1, Math.max(0, r + deltaR));
            let processedG = Math.min(1, Math.max(0, g + deltaG));
            let processedB = Math.min(1, Math.max(0, b + deltaB));
            
            // 应用混合模式（匹配后端）
            // 注意：后端在混合时使用original作为base，processed作为overlay
            const blendedRGB = this.applyBlendMode(
                r, g, b,  // 原始颜色作为base
                processedR, processedG, processedB,  // 处理后颜色作为overlay
                this.gradingData.blend_mode,
                this.gradingData.overall_strength
            );
            
            let finalR = blendedRGB[0] * 255;
            let finalG = blendedRGB[1] * 255;
            let finalB = blendedRGB[2] * 255;
            
            // 如果有遮罩，根据遮罩值混合原始和处理后的颜色
            if (maskData) {
                // 获取遮罩亮度（假设遮罩是灰度的）
                const maskValue = maskData[i] / 255; // 0-1范围
                
                // 混合原始和处理后的颜色（白色遮罩区域应用效果，黑色区域保持原图）
                data[i] = originalData.data[i] * (1 - maskValue) + finalR * maskValue;
                data[i + 1] = originalData.data[i + 1] * (1 - maskValue) + finalG * maskValue;
                data[i + 2] = originalData.data[i + 2] * (1 - maskValue) + finalB * maskValue;
            } else {
                // 没有遮罩，直接应用效果
                data[i] = finalR;
                data[i + 1] = finalG;
                data[i + 2] = finalB;
            }
        }
        
        // 将处理后的数据绘制回画布
        this.previewContext.putImageData(imageData, 0, 0);
    }
    
    createImprovedMask(luminance, region) {
        // 模拟后端的改进遮罩算法
        if (region === 'shadows') {
            const threshold = 0.25;
            const transition = 0.15;
            // Sigmoid函数
            return 1 / (1 + Math.exp(-(threshold - luminance) / transition));
        } else if (region === 'highlights') {
            const threshold = 0.75;
            const transition = 0.15;
            return 1 / (1 + Math.exp(-(luminance - threshold) / transition));
        } else { // midtones
            const center = 0.5;
            const width = 0.35;
            // 高斯函数
            return Math.exp(-0.5 * Math.pow((luminance - center) / width, 2)) * 1.2;
        }
    }
    
    applyBlendMode(baseR, baseG, baseB, overlayR, overlayG, overlayB, blendMode, strength) {
        // 实现后端的混合模式（匹配nodes.py中的_apply_blend_mode方法）
        let resultR, resultG, resultB;
        
        switch (blendMode) {
            case 'normal':
                resultR = overlayR;
                resultG = overlayG;
                resultB = overlayB;
                break;
                
            case 'multiply':
                resultR = baseR * overlayR;
                resultG = baseG * overlayG;
                resultB = baseB * overlayB;
                break;
                
            case 'screen':
                resultR = 1.0 - (1.0 - baseR) * (1.0 - overlayR);
                resultG = 1.0 - (1.0 - baseG) * (1.0 - overlayG);
                resultB = 1.0 - (1.0 - baseB) * (1.0 - overlayB);
                break;
                
            case 'overlay':
                resultR = baseR < 0.5 ? 2.0 * baseR * overlayR : 1.0 - 2.0 * (1.0 - baseR) * (1.0 - overlayR);
                resultG = baseG < 0.5 ? 2.0 * baseG * overlayG : 1.0 - 2.0 * (1.0 - baseG) * (1.0 - overlayG);
                resultB = baseB < 0.5 ? 2.0 * baseB * overlayB : 1.0 - 2.0 * (1.0 - baseB) * (1.0 - overlayB);
                break;
                
            case 'soft_light':
                resultR = overlayR < 0.5 
                    ? baseR - (1.0 - 2.0 * overlayR) * baseR * (1.0 - baseR)
                    : baseR + (2.0 * overlayR - 1.0) * (Math.sqrt(baseR) - baseR);
                resultG = overlayG < 0.5 
                    ? baseG - (1.0 - 2.0 * overlayG) * baseG * (1.0 - baseG)
                    : baseG + (2.0 * overlayG - 1.0) * (Math.sqrt(baseG) - baseG);
                resultB = overlayB < 0.5 
                    ? baseB - (1.0 - 2.0 * overlayB) * baseB * (1.0 - baseB)
                    : baseB + (2.0 * overlayB - 1.0) * (Math.sqrt(baseB) - baseB);
                break;
                
            case 'hard_light':
                resultR = overlayR < 0.5 ? 2.0 * baseR * overlayR : 1.0 - 2.0 * (1.0 - baseR) * (1.0 - overlayR);
                resultG = overlayG < 0.5 ? 2.0 * baseG * overlayG : 1.0 - 2.0 * (1.0 - baseG) * (1.0 - overlayG);
                resultB = overlayB < 0.5 ? 2.0 * baseB * overlayB : 1.0 - 2.0 * (1.0 - baseB) * (1.0 - overlayB);
                break;
                
            case 'color_dodge':
                resultR = overlayR >= 1.0 ? overlayR : baseR / (1.0 - overlayR + 1e-10);
                resultG = overlayG >= 1.0 ? overlayG : baseG / (1.0 - overlayG + 1e-10);
                resultB = overlayB >= 1.0 ? overlayB : baseB / (1.0 - overlayB + 1e-10);
                break;
                
            case 'color_burn':
                resultR = overlayR <= 0.0 ? overlayR : 1.0 - (1.0 - baseR) / (overlayR + 1e-10);
                resultG = overlayG <= 0.0 ? overlayG : 1.0 - (1.0 - baseG) / (overlayG + 1e-10);
                resultB = overlayB <= 0.0 ? overlayB : 1.0 - (1.0 - baseB) / (overlayB + 1e-10);
                break;
                
            default:
                resultR = overlayR;
                resultG = overlayG;
                resultB = overlayB;
        }
        
        // 应用强度混合
        resultR = baseR * (1.0 - strength) + resultR * strength;
        resultG = baseG * (1.0 - strength) + resultG * strength;
        resultB = baseB * (1.0 - strength) + resultB * strength;
        
        // 限制范围
        return [
            Math.max(0, Math.min(1, resultR)),
            Math.max(0, Math.min(1, resultG)),
            Math.max(0, Math.min(1, resultB))
        ];
    }
    
    updatePreview() {
        // 更新预览效果
        this.updatePreviewCanvas();
        
        // 重绘所有色轮的指示器
        Object.keys(this.colorWheels).forEach(regionKey => {
            this.drawColorWheel(this.colorWheels[regionKey].canvas, regionKey);
        });
    }
    
    updateSliderValues(regionKey) {
        // 同步更新指定区域的滑块值，当色轮交互时调用
        const data = this.gradingData[regionKey];
        if (!data) return;
        
        // 更新色相滑块
        const hueSlider = this.modal.querySelector(`#${regionKey}_hue`);
        if (hueSlider) {
            hueSlider.value = Math.round(data.hue);
            const valueDisplay = hueSlider.parentElement.querySelector('span');
            if (valueDisplay) {
                valueDisplay.textContent = Math.round(data.hue) + '°';
            }
        }
        
        // 更新饱和度滑块
        const saturationSlider = this.modal.querySelector(`#${regionKey}_saturation`);
        if (saturationSlider) {
            saturationSlider.value = Math.round(data.saturation);
            const valueDisplay = saturationSlider.parentElement.querySelector('span');
            if (valueDisplay) {
                valueDisplay.textContent = Math.round(data.saturation) + '%';
            }
        }
    }
    
    showLoadingText(text) {
        const loadingText = this.modal.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = text;
            loadingText.style.display = 'block';
        }
    }
    
    hideLoadingText() {
        const loadingText = this.modal.querySelector('.loading-text');
        if (loadingText) {
            loadingText.style.display = 'none';
        }
    }
    
    resetAllValues() {
        // 重置所有色彩分级参数到默认值
        this.gradingData = {
            shadows: { hue: 0, saturation: 0, luminance: 0 },
            midtones: { hue: 0, saturation: 0, luminance: 0 },
            highlights: { hue: 0, saturation: 0, luminance: 0 },
            blend_mode: 'normal',
            overall_strength: 1.0
        };
        
        // 重置所有滑块
        const sliders = this.modal.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            if (slider.id === 'overall_strength') {
                slider.value = 100; // 强度默认100%
                const valueDisplay = slider.parentElement.querySelector('span');
                if (valueDisplay) valueDisplay.textContent = '100%';
            } else {
                slider.value = 0;
                const valueDisplay = slider.parentElement.querySelector('span');
                if (valueDisplay) {
                    // 根据滑块类型确定单位
                    let unit = '%';
                    if (slider.id.includes('hue')) {
                        unit = '°';
                    }
                    valueDisplay.textContent = '0' + unit;
                }
            }
        });
        
        // 重置混合模式选择
        const blendSelect = this.modal.querySelector('select');
        if (blendSelect) {
            blendSelect.value = 'normal';
        }
        
        // 重绘所有色轮（清除指示器位置）
        Object.keys(this.colorWheels).forEach(regionKey => {
            this.drawColorWheel(this.colorWheels[regionKey].canvas, regionKey);
        });
        
        // 更新预览
        this.updatePreview();
        
        // 显示重置提示
        this.showResetNotification();
    }
    
    showResetNotification() {
        // 创建提示元素
        const notification = document.createElement("div");
        notification.style.cssText = `
            position: absolute;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #27ae60;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            animation: fadeInOut 2s ease-in-out;
        `;
        notification.textContent = "✓ 所有参数已重置";
        
        // 添加淡入淡出动画
        const style = document.createElement("style");
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
        
        // 添加到模态框
        this.modal.querySelector('.color-grading-container').appendChild(notification);
        
        // 2秒后移除
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 2000);
    }
    
    applyChanges() {
        // 同步参数到节点
        if (!this.node.widgets) {
            console.error('Color Grading: 节点没有widgets');
            return;
        }
        
        // 查找并更新对应的widget值
        const widgetMap = {
            'shadows_hue': this.gradingData.shadows.hue,
            'shadows_saturation': this.gradingData.shadows.saturation,
            'shadows_luminance': this.gradingData.shadows.luminance,
            'midtones_hue': this.gradingData.midtones.hue,
            'midtones_saturation': this.gradingData.midtones.saturation,
            'midtones_luminance': this.gradingData.midtones.luminance,
            'highlights_hue': this.gradingData.highlights.hue,
            'highlights_saturation': this.gradingData.highlights.saturation,
            'highlights_luminance': this.gradingData.highlights.luminance,
            'blend_mode': this.gradingData.blend_mode,
            'overall_strength': this.gradingData.overall_strength
        };
        
        for (const widget of this.node.widgets) {
            if (widgetMap.hasOwnProperty(widget.name)) {
                widget.value = widgetMap[widget.name];
                console.log(`更新 ${widget.name} = ${widget.value}`);
            }
        }
        
        // 标记节点需要重新执行
        this.node.setDirtyCanvas(true, true);
        
        // 强制标记节点为已修改，确保重新执行
        if (this.node.graph) {
            this.node.graph._nodes_dirty = true;
            this.node.graph._nodes_executable = null;
        }
        
        // 显示应用成功提示
        this.showApplyNotification();
        
        // 触发图形更新
        if (app.graph) {
            app.graph.setDirtyCanvas(true, true);
            // 强制触发onChange事件
            if (app.canvas) {
                app.canvas.onNodeChanged(this.node);
            }
        }
    }
    
    showApplyNotification() {
        // 创建提示元素
        const notification = document.createElement("div");
        notification.style.cssText = `
            position: absolute;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #2ecc71;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            animation: fadeInOut 2s ease-in-out;
        `;
        notification.textContent = "✓ 参数已应用到节点";
        
        // 添加淡入淡出动画
        const style = document.createElement("style");
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            }
        `;
        document.head.appendChild(style);
        
        // 添加到模态框
        this.modal.querySelector('.color-grading-container').appendChild(notification);
        
        // 2秒后移除
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 2000);
    }
}

// 注册扩展
app.registerExtension({
    name: "ColorGradingNode",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ColorGradingNode") {
            console.log("✅ 注册 ColorGradingNode 扩展");
            
            // 添加双击事件处理
            const origOnDblClick = nodeType.prototype.onDblClick;
            nodeType.prototype.onDblClick = function(e, pos, graphCanvas) {
                console.log(`🎨 双击 Color Grading 节点 ${this.id}`);
                this.showColorGradingModal();
                e.stopPropagation();
                return false;
            };
            
            // 添加右键菜单
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(_, options) {
                if (origGetExtraMenuOptions) {
                    origGetExtraMenuOptions.apply(this, arguments);
                }
                
                options.push({
                    content: "🎨 打开色彩分级编辑器",
                    callback: () => {
                        console.log(`🎨 右键菜单打开 Color Grading 编辑器，节点 ${this.id}`);
                        this.showColorGradingModal();
                    }
                });
            };
            
            // 添加显示模态弹窗的方法
            nodeType.prototype.showColorGradingModal = function() {
                if (!this.colorGradingEditor) {
                    this.colorGradingEditor = new ColorGradingEditor(this);
                }
                this.colorGradingEditor.show();
            };
            
            // 监听后端推送的预览数据
            if (!window.colorGradingPreviewListener) {
                window.colorGradingPreviewListener = true;
                
                console.log("🎨 注册 Color Grading 预览事件监听器");
                app.api.addEventListener("color_grading_preview", ({ detail }) => {
                    console.log("🎨 收到 Color Grading 预览数据:", detail);
                    
                    const node = app.graph.getNodeById(detail.node_id);
                    if (node) {
                        // 存储预览数据
                        node._previewImageUrl = detail.image;
                        node._previewMaskUrl = detail.mask;
                        node._previewGradingData = detail.grading_data;
                        
                        console.log(`✅ Color Grading 节点 ${node.id} 预览数据已缓存`);
                        
                        // 如果编辑器已打开，更新预览
                        if (node.colorGradingEditor && node.colorGradingEditor.isOpen) {
                            node.colorGradingEditor.loadImage();
                        }
                    }
                });
            }
        }
    }
});

// API事件监听 - 缓存节点输出
app.api.addEventListener("executed", ({ detail }) => {
    const nodeId = String(detail.node);
    const outputData = detail.output;
    
    if (outputData) {
        window.globalNodeCache.set(nodeId, outputData);
        console.log(`📦 Color Grading: 缓存节点 ${nodeId} 的输出数据`);
    }
});

// 监听缓存执行事件
app.api.addEventListener("execution_cached", ({ detail }) => {
    const nodeId = String(detail.node);
    
    // 从 last_node_outputs 获取缓存节点的输出
    if (app.ui?.lastNodeOutputs) {
        const cachedOutput = app.ui.lastNodeOutputs[nodeId];
        if (cachedOutput) {
            window.globalNodeCache.set(nodeId, cachedOutput);
            console.log(`📦 Color Grading: 从缓存获取节点 ${nodeId} 的输出数据`);
        }
    }
});

console.log("🎨 ColorGradingNode.js 已加载完成");