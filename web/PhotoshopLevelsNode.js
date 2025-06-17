/**
 * PhotoshopLevelsNode - 前端交互界面
 * 实现色阶调整功能，界面风格与ColorGradingNode保持一致
 */

import { app } from "../../scripts/app.js";

console.log("📊 PhotoshopLevelsNode.js 开始加载...");

// 全局节点输出缓存
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// Levels编辑器类
class LevelsEditor {
    constructor(node, options = {}) {
        this.node = node;
        this.isOpen = false;
        this.modal = null;
        this.previewCanvas = null;
        this.previewContext = null;
        this.histogramCanvas = null;
        this.histogramContext = null;
        this.currentImage = null;
        this.isDragging = false;
        this.dragElement = null;
        this.histogramData = null;
        
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
        // 创建模态弹窗（与ColorGradingNode一致的风格）
        this.modal = document.createElement("div");
        this.modal.className = "levels-modal";
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
        container.className = "levels-container";
        container.style.cssText = `
            background-color: #2a2a2a;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            width: 95%;
            max-width: 1200px;
            height: 90%;
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
        content.className = "levels-content";
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
        header.className = "levels-header";
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
        title.textContent = "📊 色阶调整 (Levels)";
        header.appendChild(title);
        
        // 按钮容器
        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;
        
        // 自动按钮
        const autoBtn = document.createElement("button");
        autoBtn.className = "levels-auto";
        autoBtn.style.cssText = `
            background-color: #f39c12;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        `;
        autoBtn.textContent = "自动";
        autoBtn.addEventListener('mouseenter', () => autoBtn.style.backgroundColor = '#e67e22');
        autoBtn.addEventListener('mouseleave', () => autoBtn.style.backgroundColor = '#f39c12');
        autoBtn.addEventListener('click', () => this.applyAutoLevels());
        
        // 重置按钮
        const resetBtn = document.createElement("button");
        resetBtn.className = "levels-reset";
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
        applyBtn.className = "levels-apply";
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
        closeBtn.className = "levels-close";
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
        closeBtn.addEventListener('click', () => this.hide());
        
        buttonContainer.appendChild(autoBtn);
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
        title.textContent = "图像预览";
        
        // 预览画布容器
        const canvasContainer = document.createElement("div");
        canvasContainer.style.cssText = `
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #111111;
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
            color: #888888;
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
            background-color: #252525;
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
            background-color: #1e1e1e;
            border-radius: 8px;
            padding: 15px;
        `;
        
        const label = document.createElement("label");
        label.style.cssText = `
            color: #cccccc;
            font-size: 14px;
            display: block;
            margin-bottom: 10px;
            font-weight: 500;
        `;
        label.textContent = "通道选择";
        
        const selector = document.createElement("select");
        selector.id = "channel-selector";
        selector.style.cssText = `
            width: 100%;
            background-color: #2a2a2a;
            color: #ffffff;
            border: 1px solid #404040;
            border-radius: 5px;
            padding: 10px;
            font-size: 14px;
            cursor: pointer;
            transition: border-color 0.2s;
        `;
        
        const channels = [
            { value: 'RGB', text: 'RGB 混合' },
            { value: 'R', text: '红色通道' },
            { value: 'G', text: '绿色通道' },
            { value: 'B', text: '蓝色通道' },
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
        
        selector.addEventListener('focus', () => selector.style.borderColor = '#3498db');
        selector.addEventListener('blur', () => selector.style.borderColor = '#404040');
        
        container.appendChild(label);
        container.appendChild(selector);
        
        return container;
    }
    
    createHistogramSection() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-bottom: 20px;
            background-color: #1e1e1e;
            border-radius: 8px;
            padding: 15px;
        `;
        
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #cccccc;
            margin: 0 0 15px 0;
            font-size: 14px;
            font-weight: 500;
        `;
        title.textContent = "直方图";
        
        // 直方图画布容器
        const histogramContainer = document.createElement("div");
        histogramContainer.style.cssText = `
            position: relative;
            background-color: #111111;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
        `;
        
        // 直方图画布
        this.histogramCanvas = document.createElement("canvas");
        this.histogramCanvas.width = 380;
        this.histogramCanvas.height = 120;
        this.histogramCanvas.style.cssText = `
            width: 100%;
            height: 120px;
            background: #000000;
            border-radius: 3px;
            cursor: crosshair;
        `;
        this.histogramContext = this.histogramCanvas.getContext('2d');
        
        // 色阶指示器容器（在直方图下方）
        const levelsIndicator = document.createElement("div");
        levelsIndicator.className = "levels-indicator";
        levelsIndicator.style.cssText = `
            position: relative;
            height: 30px;
            background: linear-gradient(90deg, #000000 0%, #ffffff 100%);
            border-radius: 5px;
            margin-top: 10px;
            cursor: pointer;
        `;
        
        // 色阶滑块（可拖拽）
        this.createLevelsSliders(levelsIndicator);
        
        histogramContainer.appendChild(this.histogramCanvas);
        container.appendChild(title);
        container.appendChild(histogramContainer);
        container.appendChild(levelsIndicator);
        
        return container;
    }
    
    createLevelsSection() {
        const container = document.createElement("div");
        container.style.cssText = `
            margin-bottom: 20px;
        `;
        
        // 输入色阶组
        const inputGroup = this.createInputLevelsGroup();
        container.appendChild(inputGroup);
        
        // 输出色阶组
        const outputGroup = this.createOutputLevelsGroup();
        container.appendChild(outputGroup);
        
        return container;
    }
    
    createInputLevelsGroup() {
        const group = document.createElement("div");
        group.style.cssText = `
            margin-bottom: 15px;
            background-color: #1e1e1e;
            border-radius: 8px;
            padding: 15px;
        `;
        
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #cccccc;
            margin: 0 0 15px 0;
            font-size: 14px;
            font-weight: 500;
        `;
        title.textContent = "输入色阶";
        
        // 数值输入栏
        const valuesContainer = document.createElement("div");
        valuesContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        `;
        
        // 黑场点输入
        const blackContainer = this.createLabeledInput('黑场', 'input_black', 0, 254, 0);
        
        // 中间调输入
        const midtonesContainer = this.createLabeledInput('中间调', 'input_midtones', 0.1, 9.99, 1.0, 0.01);
        
        // 白场点输入
        const whiteContainer = this.createLabeledInput('白场', 'input_white', 1, 255, 255);
        
        valuesContainer.appendChild(blackContainer);
        valuesContainer.appendChild(midtonesContainer);
        valuesContainer.appendChild(whiteContainer);
        
        group.appendChild(title);
        group.appendChild(valuesContainer);
        
        return group;
    }
    
    createOutputLevelsGroup() {
        const group = document.createElement("div");
        group.style.cssText = `
            margin-bottom: 15px;
            background-color: #1e1e1e;
            border-radius: 8px;
            padding: 15px;
        `;
        
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #cccccc;
            margin: 0 0 15px 0;
            font-size: 14px;
            font-weight: 500;
        `;
        title.textContent = "输出色阶";
        
        // 数值输入栏
        const valuesContainer = document.createElement("div");
        valuesContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;
        
        // 输出黑场点输入
        const outputBlackContainer = this.createLabeledInput('输出黑场', 'output_black', 0, 254, 0);
        
        // 输出白场点输入
        const outputWhiteContainer = this.createLabeledInput('输出白场', 'output_white', 1, 255, 255);
        
        valuesContainer.appendChild(outputBlackContainer);
        valuesContainer.appendChild(outputWhiteContainer);
        
        group.appendChild(title);
        group.appendChild(valuesContainer);
        
        return group;
    }
    
    createAutoSection() {
        const container = document.createElement("div");
        container.style.cssText = `
            background-color: #1e1e1e;
            border-radius: 8px;
            padding: 15px;
        `;
        
        const title = document.createElement("h5");
        title.style.cssText = `
            color: #cccccc;
            margin: 0 0 15px 0;
            font-size: 14px;
            font-weight: 500;
        `;
        title.textContent = "自动调整选项";
        
        // 复选框容器
        const checkboxContainer = document.createElement("div");
        checkboxContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 15px;
        `;
        
        // 自动色阶复选框
        const autoLevelsCheck = this.createCheckbox('auto_levels', '启用自动色阶');
        
        // 自动对比度复选框
        const autoContrastCheck = this.createCheckbox('auto_contrast', '启用自动对比度');
        
        checkboxContainer.appendChild(autoLevelsCheck);
        checkboxContainer.appendChild(autoContrastCheck);
        
        // 裁剪百分比
        const clipContainer = this.createLabeledInput('裁剪百分比 (%)', 'clip_percentage', 0, 5, 0.1, 0.1);
        
        container.appendChild(title);
        container.appendChild(checkboxContainer);
        container.appendChild(clipContainer);
        
        return container;
    }
    
    // 创建带标签的输入框
    createLabeledInput(label, id, min, max, defaultValue, step = 1) {
        const container = document.createElement("div");
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 5px;
        `;
        
        const labelElement = document.createElement("label");
        labelElement.style.cssText = `
            color: #999999;
            font-size: 12px;
        `;
        labelElement.textContent = label;
        
        const input = document.createElement("input");
        input.type = "number";
        input.id = id;
        input.min = min;
        input.max = max;
        input.value = defaultValue;
        input.step = step;
        input.style.cssText = `
            background-color: #2a2a2a;
            border: 1px solid #404040;
            border-radius: 5px;
            color: #ffffff;
            padding: 8px 10px;
            font-size: 14px;
            transition: border-color 0.2s;
            width: 100%;
        `;
        
        // 事件监听
        input.addEventListener('input', (e) => {
            let value = parseFloat(e.target.value);
            if (isNaN(value)) value = defaultValue;
            value = Math.max(min, Math.min(max, value));
            
            this.levelsData[id] = value;
            this.updatePreview();
            this.updateLevelsIndicators();
        });
        
        input.addEventListener('focus', () => input.style.borderColor = '#3498db');
        input.addEventListener('blur', () => input.style.borderColor = '#404040');
        
        container.appendChild(labelElement);
        container.appendChild(input);
        return container;
    }
    
    // 创建色阶滑块（可拖拽）
    createLevelsSliders(container) {
        // 黑场点滑块
        const blackSlider = document.createElement("div");
        blackSlider.className = "level-slider black";
        blackSlider.style.cssText = `
            position: absolute;
            bottom: -5px;
            width: 12px;
            height: 40px;
            background: linear-gradient(180deg, #333333 0%, #000000 100%);
            border: 2px solid #ffffff;
            cursor: ew-resize;
            transform: translateX(-6px);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: box-shadow 0.2s;
        `;
        
        // 中间调滑块（灰色，与黑白滑块区分）
        const midtonesSlider = document.createElement("div");
        midtonesSlider.className = "level-slider midtones";
        midtonesSlider.style.cssText = `
            position: absolute;
            bottom: -5px;
            width: 14px;
            height: 44px;
            background: linear-gradient(180deg, #888888 0%, #555555 100%);
            border: 2px solid #cccccc;
            cursor: ew-resize;
            transform: translateX(-7px);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            z-index: 10;
            transition: box-shadow 0.2s;
        `;
        
        // 白场点滑块
        const whiteSlider = document.createElement("div");
        whiteSlider.className = "level-slider white";
        whiteSlider.style.cssText = `
            position: absolute;
            bottom: -5px;
            width: 12px;
            height: 40px;
            background: linear-gradient(180deg, #ffffff 0%, #cccccc 100%);
            border: 2px solid #333333;
            cursor: ew-resize;
            transform: translateX(-6px);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            transition: box-shadow 0.2s;
        `;
        
        container.appendChild(blackSlider);
        container.appendChild(midtonesSlider);
        container.appendChild(whiteSlider);
        
        // 添加拖拽事件
        this.setupSliderDragging(blackSlider, 'input_black', 0, 254);
        this.setupSliderDragging(midtonesSlider, 'input_midtones', 0.1, 9.99, 0.01);
        this.setupSliderDragging(whiteSlider, 'input_white', 1, 255);
        
        // 初始位置（延迟执行确保容器已渲染）
        setTimeout(() => {
            this.updateLevelsIndicators();
        }, 100);
    }
    
    // 设置滑块拖拽事件
    setupSliderDragging(slider, property, min, max, step = 1) {
        let isDragging = false;
        let startX = 0;
        let startValue = 0;
        
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startValue = this.levelsData[property];
            e.preventDefault();
            
            // 高亮当前滑块
            slider.style.boxShadow = '0 0 8px rgba(52, 152, 219, 0.8)';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const containerWidth = slider.parentElement.offsetWidth;
            
            let newValue;
            
            if (property === 'input_midtones') {
                // 中间调特殊处理（非线性）
                const sensitivity = 0.005;
                const delta = deltaX * sensitivity;
                newValue = startValue * Math.exp(delta);
                newValue = Math.max(min, Math.min(max, newValue));
                newValue = parseFloat(newValue.toFixed(2));
            } else {
                // 黑场点和白场点线性处理
                const valueRange = max - min;
                const deltaValue = (deltaX / containerWidth) * valueRange;
                newValue = startValue + deltaValue;
                newValue = Math.max(min, Math.min(max, newValue));
                
                if (step !== 1) {
                    newValue = Math.round(newValue / step) * step;
                    newValue = parseFloat(newValue.toFixed(2));
                } else {
                    newValue = Math.round(newValue);
                }
            }
            
            this.levelsData[property] = newValue;
            
            // 更新对应的输入框
            const input = this.modal.querySelector(`#${property}`);
            if (input) input.value = newValue;
            
            this.updateLevelsIndicators();
            this.updatePreview();
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                // 恢复滑块样式
                slider.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            }
        });
        
        // 悬停效果
        slider.addEventListener('mouseenter', () => {
            if (!isDragging) {
                slider.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
            }
        });
        
        slider.addEventListener('mouseleave', () => {
            if (!isDragging) {
                slider.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            }
        });
    }
    
    // 更新色阶指示器位置
    updateLevelsIndicators() {
        const indicator = this.modal.querySelector('.levels-indicator');
        if (!indicator) return;
        
        const width = indicator.offsetWidth;
        if (width === 0) return;
        
        const blackSlider = indicator.querySelector('.level-slider.black');
        const midtonesSlider = indicator.querySelector('.level-slider.midtones');
        const whiteSlider = indicator.querySelector('.level-slider.white');
        
        if (blackSlider) {
            const blackPos = (this.levelsData.input_black / 255) * width;
            blackSlider.style.left = blackPos + 'px';
        }
        
        if (whiteSlider) {
            const whitePos = (this.levelsData.input_white / 255) * width;
            whiteSlider.style.left = whitePos + 'px';
        }
        
        if (midtonesSlider) {
            // 中间调位置计算
            const blackPos = (this.levelsData.input_black / 255) * width;
            const whitePos = (this.levelsData.input_white / 255) * width;
            
            const midtonesValue = this.levelsData.input_midtones;
            let normalizedValue;
            if (midtonesValue <= 1.0) {
                normalizedValue = (midtonesValue - 0.1) / (1.0 - 0.1) * 0.5;
            } else {
                normalizedValue = 0.5 + (midtonesValue - 1.0) / (9.99 - 1.0) * 0.5;
            }
            normalizedValue = Math.max(0, Math.min(1, normalizedValue));
            
            const midtonesPos = blackPos + (whitePos - blackPos) * normalizedValue;
            const finalPos = Math.max(blackPos + 7, Math.min(whitePos - 7, midtonesPos));
            
            midtonesSlider.style.left = finalPos + 'px';
        }
    }
    
    createCheckbox(id, label) {
        const container = document.createElement("div");
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = id;
        checkbox.style.cssText = `
            width: 18px;
            height: 18px;
            cursor: pointer;
        `;
        
        const labelElement = document.createElement("label");
        labelElement.htmlFor = id;
        labelElement.style.cssText = `
            color: #cccccc;
            font-size: 14px;
            cursor: pointer;
            user-select: none;
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
        document.body.appendChild(this.modal);
        this.modal.style.display = 'flex';
        this.isOpen = true;
        
        // 从节点widgets加载当前参数值
        this.loadCurrentValues();
        
        // 加载图像
        this.loadImage();
        
        console.log('📊 Levels 编辑器已打开');
        
        // 延迟初始化滑块位置
        setTimeout(() => {
            this.updateLevelsIndicators();
        }, 200);
    }
    
    hide() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.isOpen = false;
        console.log('📊 Levels 编辑器已关闭');
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
        
        console.log("📊 Levels: 加载当前值完成", this.levelsData);
        
        // 更新UI组件以反映当前值
        this.updateUIFromData();
    }
    
    updateUIFromData() {
        // 更新通道选择器
        const channelSelector = this.modal.querySelector('#channel-selector');
        if (channelSelector) {
            channelSelector.value = this.levelsData.channel;
        }
        
        // 更新所有数值输入框和复选框
        Object.keys(this.levelsData).forEach(key => {
            const element = this.modal.querySelector(`#${key}`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.levelsData[key];
                } else if (element.type === 'number') {
                    element.value = this.levelsData[key];
                }
            }
        });
        
        // 更新色阶指示器位置
        setTimeout(() => {
            this.updateLevelsIndicators();
        }, 50);
        
        // 更新直方图和预览
        this.updateHistogram();
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
                    console.log('📊 图像加载成功');
                };
                
                img.onerror = () => {
                    console.error('Levels: 图像加载失败');
                    this.showLoadingText('图像加载失败');
                };
                
                img.src = imageUrl;
            } else {
                console.warn('Levels: 未找到图像数据');
                this.showLoadingText('未找到图像数据');
            }
        } catch (error) {
            console.error('Levels: 加载图像时出错:', error);
            this.showLoadingText('加载图像时出错');
        }
    }
    
    getNodeImage() {
        try {
            // 方法1: 后端推送的预览图像
            if (this.node._previewImageUrl) {
                console.log('Levels: 使用后端推送的图像');
                return this.node._previewImageUrl;
            }
            
            // 方法2: 从全局缓存获取
            const cached = window.globalNodeCache.get(String(this.node.id));
            if (cached && cached.images && cached.images.length > 0) {
                console.log('Levels: 使用缓存的图像');
                return this.convertToImageUrl(cached.images[0]);
            }
            
            // 方法3: 从连接的输入节点获取
            const inputNode = this.findConnectedInputNode();
            if (inputNode) {
                // 先尝试从输入节点的预览URL获取
                if (inputNode._previewImageUrl) {
                    console.log('Levels: 使用输入节点的预览图像');
                    return inputNode._previewImageUrl;
                }
                // 再尝试从输入节点的缓存获取
                const inputCached = window.globalNodeCache.get(String(inputNode.id));
                if (inputCached && inputCached.images && inputCached.images.length > 0) {
                    console.log('Levels: 使用输入节点的缓存图像');
                    return this.convertToImageUrl(inputCached.images[0]);
                }
            }
            
            // 方法4: 从app.nodeOutputs获取
            if (app.nodeOutputs) {
                const nodeOutput = app.nodeOutputs[this.node.id];
                if (nodeOutput && nodeOutput.images) {
                    console.log('Levels: 使用app.nodeOutputs的图像');
                    return this.convertToImageUrl(nodeOutput.images[0]);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Levels: 获取图像时出错:', error);
            return null;
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
        
        // 应用色阶调整
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
        this.histogramContext.fillStyle = '#000000';
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
        const height = this.histogramCanvas.height;
        const barWidth = width / 256;
        
        // 根据通道设置颜色
        const channel = this.levelsData.channel;
        let color = '#cccccc';
        if (channel === 'R') color = '#ff6b6b';
        else if (channel === 'G') color = '#51cf66';
        else if (channel === 'B') color = '#74c0fc';
        
        this.histogramContext.fillStyle = color;
        this.histogramContext.globalAlpha = 0.8;
        
        for (let i = 0; i < 256; i++) {
            const barHeight = (histogram[i] / maxValue) * height;
            const x = i * barWidth;
            const y = height - barHeight;
            
            this.histogramContext.fillRect(x, y, barWidth, barHeight);
        }
        
        this.histogramContext.globalAlpha = 1.0;
    }
    
    updatePreview() {
        // 更新预览效果（实时预览）
        this.updatePreviewCanvas();
        this.updateHistogram();
        this.updateLevelsIndicators();
    }
    
    // 应用自动色阶
    applyAutoLevels() {
        if (!this.currentImage) return;
        
        // 简化的自动色阶算法
        this.levelsData.auto_levels = true;
        this.levelsData.clip_percentage = 0.1;
        
        // 这里可以实现更复杂的自动色阶算法
        this.levelsData.input_black = 5;
        this.levelsData.input_white = 250;
        this.levelsData.input_midtones = 1.2;
        
        this.updateUIFromData();
        this.updatePreview();
        this.showNotification('已应用自动色阶');
    }
    
    // 应用改变到节点
    applyChanges() {
        if (!this.node.widgets) {
            console.error('Levels: 节点没有widgets');
            return;
        }
        
        // 查找并更新对应的widget值
        const widgetMap = {
            'channel': this.levelsData.channel,
            'input_black': this.levelsData.input_black,
            'input_white': this.levelsData.input_white,
            'input_midtones': this.levelsData.input_midtones,
            'output_black': this.levelsData.output_black,
            'output_white': this.levelsData.output_white,
            'auto_levels': this.levelsData.auto_levels,
            'auto_contrast': this.levelsData.auto_contrast,
            'clip_percentage': this.levelsData.clip_percentage
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
        this.showNotification('参数已应用到节点');
        
        // 触发图形更新
        if (app.graph) {
            app.graph.setDirtyCanvas(true, true);
            if (app.canvas) {
                app.canvas.onNodeChanged(this.node);
            }
        }
    }
    
    // 显示通知
    showNotification(text) {
        const notification = document.createElement("div");
        notification.style.cssText = `
            position: absolute;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #27ae60;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10001;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            animation: fadeInOut 2s ease-in-out;
        `;
        notification.textContent = `✓ ${text}`;
        
        // 添加动画
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
        
        this.modal.querySelector('.levels-container').appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 2000);
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
        this.showNotification('所有参数已重置');
    }
}

// 全局编辑器实例存储
const levelsEditors = new Map();

// 监听后端预览数据
app.api.addEventListener("levels_adjustment_preview", (event) => {
    const data = event.detail;
    console.log("📊 收到色阶调整预览数据:", data);
    
    if (data.node_id) {
        const node = app.graph.getNodeById(parseInt(data.node_id));
        if (node) {
            // 缓存图像和数据
            node._previewImageUrl = data.image;
            node._levelsData = data.levels_data;
            
            console.log("📊 已缓存色阶预览数据到节点");
            
            // 如果编辑器已打开，更新预览
            const editor = levelsEditors.get(node.id);
            if (editor && editor.isOpen) {
                editor.loadImage();
            }
        }
    }
});

// 注册节点（使用双击事件）
app.registerExtension({
    name: "Comfy.PhotoshopLevelsNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PhotoshopLevelsNode") {
            console.log("📊 注册 PhotoshopLevelsNode 节点");
            
            // 保存原始的方法
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            // 扩展onNodeCreated方法
            nodeType.prototype.onNodeCreated = function() {
                // 调用原始方法
                if (onNodeCreated) {
                    onNodeCreated.apply(this, arguments);
                }
                
                const node = this;
                
                // 创建编辑器实例
                const editor = new LevelsEditor(node);
                levelsEditors.set(node.id, editor);
                
                // 添加双击事件监听器
                node.onDblClick = function(e) {
                    console.log("📊 双击 PhotoshopLevelsNode 节点");
                    editor.show();
                    return true; // 阻止默认行为
                };
                
                // 添加右键菜单选项
                node.getExtraMenuOptions = function(canvas, options) {
                    options.push({
                        content: "打开色阶编辑器",
                        callback: () => {
                            editor.show();
                        }
                    });
                    return options;
                };
                
                // 节点删除时清理
                const onRemoved = node.onRemoved;
                node.onRemoved = function() {
                    if (onRemoved) {
                        onRemoved.apply(this, arguments);
                    }
                    levelsEditors.delete(node.id);
                    if (editor.isOpen) {
                        editor.hide();
                    }
                };
            };
        }
    }
});

console.log("✅ PhotoshopLevelsNode.js 加载完成 - 带实时预览（ColorGrading风格界面）");