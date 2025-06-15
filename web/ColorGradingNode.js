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
        
        header.appendChild(closeBtn);
        
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
            
            // 解析ID以更新对应数据
            const [regionKey, property] = id.split('_');
            if (this.gradingData[regionKey]) {
                this.gradingData[regionKey][property] = value;
                this.updatePreview();
            }
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
        
        // 整体强度滑块
        const strengthSlider = this.createSlider('overall_strength', '强度', 0, 200, 100, '%');
        
        // 修改强度滑块的事件监听
        const slider = strengthSlider.querySelector('input[type="range"]');
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const valueDisplay = strengthSlider.querySelector('span');
            valueDisplay.textContent = value + '%';
            this.gradingData.overall_strength = value / 100.0;
            this.updatePreview();
        });
        
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
        
        // 加载图像
        this.loadImage();
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
        } catch (error) {
            console.error('Color Grading: 加载图像时出错:', error);
            this.showLoadingText('加载图像时出错');
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
        
        // 获取图像数据
        const imageData = this.previewContext.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        const data = imageData.data;
        
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
                    // 将色相和饱和度转换为RGB偏移（近似Lab空间效果）
                    const hueRad = region.data.hue * Math.PI / 180;
                    const satNormalized = region.data.saturation / 100;
                    
                    // 使用色相环计算颜色偏移
                    const hueR = Math.cos(hueRad);
                    const hueG = Math.cos(hueRad - 2.094); // 120度
                    const hueB = Math.cos(hueRad + 2.094); // -120度
                    
                    // 应用饱和度和遮罩
                    const strength = satNormalized * region.mask * this.gradingData.overall_strength;
                    
                    deltaR += hueR * strength * 0.15; // 降低强度以获得更自然的效果
                    deltaG += hueG * strength * 0.15;
                    deltaB += hueB * strength * 0.15;
                }
                
                // 亮度调整
                if (region.data.luminance !== 0) {
                    const lumFactor = region.data.luminance / 100 * region.mask * this.gradingData.overall_strength;
                    // 保持颜色比例的亮度调整
                    deltaR += r * lumFactor * 0.3;
                    deltaG += g * lumFactor * 0.3;
                    deltaB += b * lumFactor * 0.3;
                }
            });
            
            // 应用调整并限制范围
            data[i] = Math.min(255, Math.max(0, (r + deltaR) * 255));
            data[i + 1] = Math.min(255, Math.max(0, (g + deltaG) * 255));
            data[i + 2] = Math.min(255, Math.max(0, (b + deltaB) * 255));
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
    
    updatePreview() {
        // 更新预览效果
        this.updatePreviewCanvas();
        
        // 重绘所有色轮的指示器
        Object.keys(this.colorWheels).forEach(regionKey => {
            this.drawColorWheel(this.colorWheels[regionKey].canvas, regionKey);
        });
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