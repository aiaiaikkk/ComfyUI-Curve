/**
 * PhotoshopHistogramNode - 前端交互界面
 * 实现PS风格的直方图显示和色阶调整功能
 */

import { app } from "../../scripts/app.js";

console.log("🔄 PhotoshopHistogramNode.js 开始加载...");

// 全局节点输出缓存
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// Histogram & Levels 编辑器类
class HistogramLevelsEditor {
    constructor(node, options = {}) {
        this.node = node;
        this.isOpen = false;
        this.modal = null;
        this.previewCanvas = null;
        this.previewContext = null;
        this.histogramCanvas = null;
        this.histogramContext = null;
        this.currentImage = null;
        
        // 色阶参数
        this.levelsData = {
            channel: 'RGB',
            input_black: 0,
            input_white: 255,
            input_midtones: 1.0,
            output_black: 0,
            output_white: 255,
            auto_levels: false,
            auto_contrast: false,
            clip_percentage: 0.1
        };
        
        this.createModal();
    }
    
    createModal() {
        // 创建模态弹窗
        this.modal = document.createElement("div");
        this.modal.className = "histogram-levels-modal";
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
        container.className = "histogram-levels-container";
        container.style.cssText = `
            background-color: #2a2a2a;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            width: 95%;
            max-width: 1200px;
            height: 85%;
            max-height: 800px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        
        // 标题栏
        const header = this.createHeader();
        container.appendChild(header);
        
        // 主内容区域
        const content = document.createElement("div");
        content.className = "histogram-levels-content";
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
        header.className = "histogram-levels-header";
        header.style.cssText = `
            background-color: #333333;
            padding: 15px 20px;
            border-bottom: 1px solid #555555;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const title = document.createElement("h3");
        title.style.cssText = `
            color: #ffffff;
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        `;
        title.textContent = "📊 直方图与色阶";
        
        const buttonGroup = document.createElement("div");
        buttonGroup.style.cssText = `
            display: flex;
            gap: 10px;
        `;
        
        // 重置按钮
        const resetBtn = document.createElement("button");
        resetBtn.textContent = "重置";
        resetBtn.style.cssText = `
            background-color: #e74c3c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        resetBtn.onclick = () => this.resetAllValues();
        
        // 关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.style.cssText = `
            background-color: #666666;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
        `;
        closeBtn.onclick = () => this.hide();
        
        buttonGroup.appendChild(resetBtn);
        buttonGroup.appendChild(closeBtn);
        
        header.appendChild(title);
        header.appendChild(buttonGroup);
        
        return header;
    }
    
    createPreviewSection() {
        const section = document.createElement("div");
        section.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 20px;
            background-color: #1e1e1e;
        `;
        
        // 预览标题
        const title = document.createElement("h4");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 15px 0;
            font-size: 14px;
        `;
        title.textContent = "图像预览";
        
        // 预览画布容器
        const canvasContainer = document.createElement("div");
        canvasContainer.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #000000;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
        `;
        
        // 预览画布
        this.previewCanvas = document.createElement("canvas");
        this.previewCanvas.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        `;
        this.previewContext = this.previewCanvas.getContext('2d');
        
        // 加载提示
        const loadingText = document.createElement("div");
        loadingText.className = "loading-text";
        loadingText.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #cccccc;
            font-size: 14px;
            display: block;
        `;
        loadingText.textContent = "加载图像中...";
        
        canvasContainer.appendChild(this.previewCanvas);
        canvasContainer.appendChild(loadingText);
        
        section.appendChild(title);
        section.appendChild(canvasContainer);
        
        return section;
    }
    
    createControlSection() {
        const section = document.createElement("div");
        section.style.cssText = `
            width: 450px;
            display: flex;
            flex-direction: column;
            padding: 20px;
            background-color: #2a2a2a;
            border-left: 1px solid #555555;
            overflow-y: auto;
        `;
        
        // 通道选择
        const channelControl = this.createChannelSelector();
        section.appendChild(channelControl);
        
        // 直方图显示区域
        const histogramSection = this.createHistogramSection();
        section.appendChild(histogramSection);
        
        // 色阶控制区域
        const levelsSection = this.createLevelsSection();
        section.appendChild(levelsSection);
        
        // 自动调整区域
        const autoSection = this.createAutoSection();
        section.appendChild(autoSection);
        
        return section;
    }
    
    createChannelSelector() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-bottom: 20px;
        `;
        
        const label = document.createElement("label");
        label.style.cssText = `
            color: #cccccc;
            font-size: 12px;
            display: block;
            margin-bottom: 8px;
        `;
        label.textContent = "通道：";
        
        const selector = document.createElement("select");
        selector.id = "channel-selector";
        selector.style.cssText = `
            width: 100%;
            background-color: #333333;
            color: #ffffff;
            border: 1px solid #555555;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
        `;
        
        const channels = [
            { value: 'RGB', text: 'RGB' },
            { value: 'R', text: '红色' },
            { value: 'G', text: '绿色' },
            { value: 'B', text: '蓝色' },
            { value: 'Luminance', text: '亮度' }
        ];
        
        channels.forEach(channel => {
            const option = document.createElement("option");
            option.value = channel.value;
            option.textContent = channel.text;
            selector.appendChild(option);
        });
        
        selector.addEventListener('change', (e) => {
            this.levelsData.channel = e.target.value;
            this.updateHistogram();
            this.updatePreview();
        });
        
        container.appendChild(label);
        container.appendChild(selector);
        
        return container;
    }
    
    createHistogramSection() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-bottom: 20px;
        `;
        
        const title = document.createElement("h4");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 10px 0;
            font-size: 14px;
        `;
        title.textContent = "直方图";
        
        // 直方图画布
        this.histogramCanvas = document.createElement("canvas");
        this.histogramCanvas.width = 410;
        this.histogramCanvas.height = 150;
        this.histogramCanvas.style.cssText = `
            width: 100%;
            height: 150px;
            background-color: #1a1a1a;
            border: 1px solid #555555;
            border-radius: 4px;
        `;
        this.histogramContext = this.histogramCanvas.getContext('2d');
        
        container.appendChild(title);
        container.appendChild(this.histogramCanvas);
        
        return container;
    }
    
    createLevelsSection() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-bottom: 20px;
        `;
        
        const title = document.createElement("h4");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 15px 0;
            font-size: 14px;
        `;
        title.textContent = "色阶调整";
        
        // 输入色阶组
        const inputGroup = this.createInputLevelsGroup();
        container.appendChild(inputGroup);
        
        // 输出色阶组
        const outputGroup = this.createOutputLevelsGroup();
        container.appendChild(outputGroup);
        
        container.appendChild(title);
        container.appendChild(inputGroup);
        container.appendChild(outputGroup);
        
        return container;
    }
    
    createInputLevelsGroup() {
        const group = document.createElement("div");
        group.style.cssText = `
            margin-bottom: 15px;
            padding: 15px;
            background-color: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #404040;
        `;
        
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #e0e0e0;
            margin: 0 0 12px 0;
            font-size: 12px;
            font-weight: 600;
        `;
        title.textContent = "输入色阶";
        
        // 黑场点滑块
        const blackSlider = this.createSlider('input_black', '黑场点', 0, 254, 0, '');
        
        // 中间调滑块
        const midtonesSlider = this.createSlider('input_midtones', '中间调', 0.1, 9.99, 1.0, '', 0.01);
        
        // 白场点滑块
        const whiteSlider = this.createSlider('input_white', '白场点', 1, 255, 255, '');
        
        group.appendChild(title);
        group.appendChild(blackSlider);
        group.appendChild(midtonesSlider);
        group.appendChild(whiteSlider);
        
        return group;
    }
    
    createOutputLevelsGroup() {
        const group = document.createElement("div");
        group.style.cssText = `
            margin-bottom: 15px;
            padding: 15px;
            background-color: #1a1a1a;
            border-radius: 8px;
            border: 1px solid #404040;
        `;
        
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #e0e0e0;
            margin: 0 0 12px 0;
            font-size: 12px;
            font-weight: 600;
        `;
        title.textContent = "输出色阶";
        
        // 输出黑场点滑块
        const outputBlackSlider = this.createSlider('output_black', '输出黑场', 0, 254, 0, '');
        
        // 输出白场点滑块
        const outputWhiteSlider = this.createSlider('output_white', '输出白场', 1, 255, 255, '');
        
        group.appendChild(title);
        group.appendChild(outputBlackSlider);
        group.appendChild(outputWhiteSlider);
        
        return group;
    }
    
    createAutoSection() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-bottom: 20px;
        `;
        
        const title = document.createElement("h4");
        title.style.cssText = `
            color: #ffffff;
            margin: 0 0 15px 0;
            font-size: 14px;
        `;
        title.textContent = "自动调整";
        
        // 自动色阶复选框
        const autoLevelsCheck = this.createCheckbox('auto_levels', '自动色阶');
        
        // 自动对比度复选框
        const autoContrastCheck = this.createCheckbox('auto_contrast', '自动对比度');
        
        // 裁剪百分比滑块
        const clipSlider = this.createSlider('clip_percentage', '裁剪百分比', 0, 5, 0.1, '%', 0.1);
        
        container.appendChild(title);
        container.appendChild(autoLevelsCheck);
        container.appendChild(autoContrastCheck);
        container.appendChild(clipSlider);
        
        return container;
    }
    
    createSlider(id, label, min, max, defaultValue, unit = '', step = 1) {
        const container = document.createElement("div");
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        `;
        
        // 标签
        const labelElement = document.createElement("label");
        labelElement.style.cssText = `
            color: #cccccc;
            font-size: 11px;
            min-width: 60px;
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
        slider.step = step;
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
            font-size: 11px;
            min-width: 50px;
            text-align: center;
            background-color: #333333;
            padding: 2px 6px;
            border-radius: 3px;
        `;
        valueDisplay.textContent = defaultValue + unit;
        
        // 事件监听
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            valueDisplay.textContent = value + unit;
            
            // 更新数据
            this.levelsData[id] = value;
            
            this.updatePreview();
        });
        
        container.appendChild(slider);
        container.appendChild(valueDisplay);
        
        return container;
    }
    
    createCheckbox(id, label) {
        const container = document.createElement("div");
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
        `;
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = id;
        checkbox.style.cssText = `
            transform: scale(1.2);
        `;
        
        const labelElement = document.createElement("label");
        labelElement.htmlFor = id;
        labelElement.style.cssText = `
            color: #cccccc;
            font-size: 12px;
            cursor: pointer;
        `;
        labelElement.textContent = label;
        
        checkbox.addEventListener('change', (e) => {
            this.levelsData[id] = e.target.checked;
            this.updatePreview();
        });
        
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        
        return container;
    }
    
    setupEventListeners() {
        // 模态框点击事件
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
        if (!document.body.contains(this.modal)) {
            document.body.appendChild(this.modal);
        }
        
        this.modal.style.display = 'flex';
        this.isOpen = true;
        
        // 加载当前值
        this.loadCurrentValues();
        
        // 获取并显示图像
        this.loadImage();
    }
    
    hide() {
        this.modal.style.display = 'none';
        this.isOpen = false;
    }
    
    loadCurrentValues() {
        // 从节点的widgets读取当前值
        if (!this.node.widgets) return;
        
        // 重置levelsData为默认值
        this.levelsData = {
            channel: 'RGB',
            input_black: 0,
            input_white: 255,
            input_midtones: 1.0,
            output_black: 0,
            output_white: 255,
            auto_levels: false,
            auto_contrast: false,
            clip_percentage: 0.1
        };
        
        for (const widget of this.node.widgets) {
            if (this.levelsData.hasOwnProperty(widget.name)) {
                this.levelsData[widget.name] = widget.value;
            }
        }
        
        console.log("📊 Histogram: 加载当前值完成", this.levelsData);
        
        // 更新UI组件以反映当前值
        this.updateUIFromData();
    }
    
    updateUIFromData() {
        // 更新通道选择器
        const channelSelector = this.modal.querySelector('#channel-selector');
        if (channelSelector) {
            channelSelector.value = this.levelsData.channel;
        }
        
        // 更新所有滑块和复选框
        Object.keys(this.levelsData).forEach(key => {
            const element = this.modal.querySelector(`#${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.levelsData[key];
                } else if (element.type === 'range') {
                    element.value = this.levelsData[key];
                    const valueDisplay = element.parentElement.querySelector('span');
                    if (valueDisplay) {
                        let unit = '';
                        if (key === 'clip_percentage') unit = '%';
                        valueDisplay.textContent = this.levelsData[key] + unit;
                    }
                }
            }
        });
        
        // 更新直方图和预览
        this.updateHistogram();
    }
    
    loadImage() {
        // 尝试多种方式获取图像
        const sourceNode = this.findConnectedInputNode();
        let imageUrl = null;
        
        // 方法1：检查节点是否有预览图像缓存
        if (this.node._previewImageUrl) {
            imageUrl = this.node._previewImageUrl;
            console.log("📊 使用节点预览图像缓存");
        }
        // 方法2：从全局缓存获取
        else if (window.globalNodeCache && sourceNode) {
            const cachedData = window.globalNodeCache.get(sourceNode.id.toString());
            if (cachedData && cachedData.images && cachedData.images.length > 0) {
                imageUrl = this.convertToImageUrl(cachedData.images[0]);
                console.log("📊 使用全局缓存图像");
            }
        }
        
        if (imageUrl) {
            this.loadImageFromUrl(imageUrl);
        } else {
            this.showLoadingText("未找到图像数据");
        }
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
    
    convertToImageUrl(imageInfo) {
        if (typeof imageInfo === 'string') {
            return imageInfo;
        }
        
        if (imageInfo && typeof imageInfo === 'object' && imageInfo.filename) {
            const subfolder = imageInfo.subfolder || '';
            const type = imageInfo.type || 'temp';
            return `/view?filename=${encodeURIComponent(imageInfo.filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
        }
        
        return null;
    }
    
    loadImageFromUrl(imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            this.currentImage = img;
            this.updatePreviewCanvas();
            this.updateHistogram();
            this.hideLoadingText();
            console.log("📊 图像加载成功");
        };
        
        img.onerror = () => {
            console.error("📊 图像加载失败:", imageUrl);
            this.showLoadingText("图像加载失败");
        };
        
        img.src = imageUrl;
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
        
        // 应用色阶效果预览
        this.applyPreviewEffects();
    }
    
    applyPreviewEffects() {
        if (!this.previewContext || !this.currentImage) return;
        
        // 获取图像数据
        const imageData = this.previewContext.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        const data = imageData.data;
        
        // 应用色阶调整（简化版本）
        this.applyLevelsToImageData(data);
        
        // 将处理后的数据绘制回画布
        this.previewContext.putImageData(imageData, 0, 0);
    }
    
    applyLevelsToImageData(data) {
        const { input_black, input_white, input_midtones, output_black, output_white, channel } = this.levelsData;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            if (channel === 'RGB') {
                // 对所有通道应用
                data[i] = this.applyLevelsToChannel(r, input_black, input_white, input_midtones, output_black, output_white);
                data[i + 1] = this.applyLevelsToChannel(g, input_black, input_white, input_midtones, output_black, output_white);
                data[i + 2] = this.applyLevelsToChannel(b, input_black, input_white, input_midtones, output_black, output_white);
            } else if (channel === 'R') {
                data[i] = this.applyLevelsToChannel(r, input_black, input_white, input_midtones, output_black, output_white);
            } else if (channel === 'G') {
                data[i + 1] = this.applyLevelsToChannel(g, input_black, input_white, input_midtones, output_black, output_white);
            } else if (channel === 'B') {
                data[i + 2] = this.applyLevelsToChannel(b, input_black, input_white, input_midtones, output_black, output_white);
            } else if (channel === 'Luminance') {
                // 计算亮度
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                const adjustedLuminance = this.applyLevelsToChannel(luminance, input_black, input_white, input_midtones, output_black, output_white);
                const ratio = luminance > 0 ? adjustedLuminance / luminance : 1;
                
                data[i] = Math.min(255, Math.max(0, r * ratio));
                data[i + 1] = Math.min(255, Math.max(0, g * ratio));
                data[i + 2] = Math.min(255, Math.max(0, b * ratio));
            }
        }
    }
    
    applyLevelsToChannel(value, input_black, input_white, input_midtones, output_black, output_white) {
        // 输入范围调整
        const normalized = Math.max(0, Math.min(1, (value - input_black) / (input_white - input_black)));
        
        // 中间调校正
        const midtones_corrected = Math.pow(normalized, 1.0 / input_midtones);
        
        // 输出范围调整
        const result = midtones_corrected * (output_white - output_black) + output_black;
        
        return Math.max(0, Math.min(255, result));
    }
    
    updateHistogram() {
        if (!this.currentImage || !this.histogramContext) return;
        
        // 清除画布
        this.histogramContext.fillStyle = '#1a1a1a';
        this.histogramContext.fillRect(0, 0, this.histogramCanvas.width, this.histogramCanvas.height);
        
        // 创建临时画布来分析图像
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.currentImage.width;
        tempCanvas.height = this.currentImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.currentImage, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        // 计算直方图
        const histogram = this.calculateHistogram(data, this.levelsData.channel);
        
        // 绘制直方图
        this.drawHistogram(histogram);
        
        // 绘制色阶指示器
        this.drawLevelsIndicators();
    }
    
    calculateHistogram(data, channel) {
        const histogram = new Array(256).fill(0);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            let value;
            if (channel === 'RGB') {
                // RGB平均值
                value = Math.round((r + g + b) / 3);
            } else if (channel === 'R') {
                value = r;
            } else if (channel === 'G') {
                value = g;
            } else if (channel === 'B') {
                value = b;
            } else if (channel === 'Luminance') {
                value = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
            }
            
            histogram[value]++;
        }
        
        return histogram;
    }
    
    drawHistogram(histogram) {
        const maxValue = Math.max(...histogram);
        if (maxValue === 0) return;
        
        const width = this.histogramCanvas.width;
        const height = this.histogramCanvas.height - 20; // 留出底部空间
        const barWidth = width / 256;
        
        // 根据通道设置颜色
        const channel = this.levelsData.channel;
        let color = '#cccccc';
        if (channel === 'R') color = '#ff6b6b';
        else if (channel === 'G') color = '#51cf66';
        else if (channel === 'B') color = '#74c0fc';
        
        this.histogramContext.fillStyle = color;
        
        for (let i = 0; i < 256; i++) {
            const barHeight = (histogram[i] / maxValue) * height;
            const x = i * barWidth;
            const y = height - barHeight;
            
            this.histogramContext.fillRect(x, y, barWidth, barHeight);
        }
    }
    
    drawLevelsIndicators() {
        const width = this.histogramCanvas.width;
        const height = this.histogramCanvas.height;
        
        // 绘制输入色阶指示器
        const blackPos = (this.levelsData.input_black / 255) * width;
        const whitePos = (this.levelsData.input_white / 255) * width;
        const midtonesPos = blackPos + (whitePos - blackPos) * 0.5; // 简化的中间调位置
        
        this.histogramContext.strokeStyle = '#ffffff';
        this.histogramContext.lineWidth = 2;
        
        // 黑场点指示器
        this.histogramContext.beginPath();
        this.histogramContext.moveTo(blackPos, height - 15);
        this.histogramContext.lineTo(blackPos, height);
        this.histogramContext.stroke();
        
        // 白场点指示器
        this.histogramContext.beginPath();
        this.histogramContext.moveTo(whitePos, height - 15);
        this.histogramContext.lineTo(whitePos, height);
        this.histogramContext.stroke();
        
        // 中间调指示器
        this.histogramContext.strokeStyle = '#ffff00';
        this.histogramContext.beginPath();
        this.histogramContext.moveTo(midtonesPos, height - 10);
        this.histogramContext.lineTo(midtonesPos, height);
        this.histogramContext.stroke();
    }
    
    updatePreview() {
        // 更新预览效果
        this.updatePreviewCanvas();
        this.updateHistogram();
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
        // 重置所有色阶参数到默认值
        this.levelsData = {
            channel: 'RGB',
            input_black: 0,
            input_white: 255,
            input_midtones: 1.0,
            output_black: 0,
            output_white: 255,
            auto_levels: false,
            auto_contrast: false,
            clip_percentage: 0.1
        };
        
        // 更新UI
        this.updateUIFromData();
        
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
        this.modal.querySelector('.histogram-levels-container').appendChild(notification);
        
        // 2秒后移除
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 2000);
    }
}

// 全局编辑器实例存储
const histogramEditors = new Map();

// 监听后端预览数据
app.api.addEventListener("histogram_levels_preview", (event) => {
    const data = event.detail;
    console.log("📊 收到直方图预览数据:", data);
    
    if (data.node_id) {
        const node = app.graph.getNodeById(parseInt(data.node_id));
        if (node) {
            // 缓存图像和数据
            node._previewImageUrl = data.image;
            node._levelsData = data.levels_data;
            
            console.log("📊 已缓存直方图预览数据到节点");
        }
    }
});

// 节点注册
app.registerExtension({
    name: "PhotoshopHistogramNode",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PhotoshopHistogramNode") {
            console.log("📊 注册 PhotoshopHistogramNode 扩展");
            
            // 添加右键菜单
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function(_, options) {
                if (origGetExtraMenuOptions) {
                    origGetExtraMenuOptions.apply(this, arguments);
                }
                
                options.push({
                    content: "📊 打开直方图和色阶编辑器",
                    callback: () => {
                        let editor = histogramEditors.get(this.id);
                        if (!editor) {
                            editor = new HistogramLevelsEditor(this);
                            histogramEditors.set(this.id, editor);
                        }
                        editor.show();
                    }
                });
            };
            
            // 添加双击事件
            const origOnDblClick = nodeType.prototype.onDblClick;
            nodeType.prototype.onDblClick = function(e) {
                if (origOnDblClick) {
                    origOnDblClick.call(this, e);
                }
                
                let editor = histogramEditors.get(this.id);
                if (!editor) {
                    editor = new HistogramLevelsEditor(this);
                    histogramEditors.set(this.id, editor);
                }
                editor.show();
                
                return true;
            };
            
            // 节点删除时清理编辑器
            const origOnRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                if (origOnRemoved) {
                    origOnRemoved.call(this);
                }
                
                const editor = histogramEditors.get(this.id);
                if (editor) {
                    editor.hide();
                    histogramEditors.delete(this.id);
                }
            };
        }
    }
});

console.log("✅ PhotoshopHistogramNode.js 加载完成");