/**
 * Camera Raw Enhance Node - Frontend Interactive Interface
 * Implements texture, clarity, and dehaze enhancement features
 */

import { app } from "../../scripts/app.js";

// Global node output cache
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// Camera Raw Enhancement Editor Class
class CameraRawEnhanceEditor {
    constructor(node, options = {}) {
        this.node = node;
        this.isOpen = false;
        this.modal = null;
        this.previewCanvas = null;
        this.previewContext = null;
        this.currentImage = null;
        this.currentMask = null;
        this.sliders = {};
        
        // Camera Raw Enhancement Parameters
        this.enhanceData = {
            // Exposure Adjustments
            exposure: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            // Color Adjustments
            temperature: 0.0,
            tint: 0.0,
            vibrance: 0.0,
            saturation: 0.0,
            // Basic Adjustments
            contrast: 0.0,
            // Enhancement Features
            texture: 0.0,
            clarity: 0.0,
            dehaze: 0.0,
            // Blend Control
            blend: 100.0,
            overall_strength: 1.0
        };
        
        this.createModal();
    }
    
    createModal() {
        // Create modal popup
        this.modal = document.createElement("div");
        this.modal.className = "camera-raw-enhance-modal";
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
        container.className = "camera-raw-enhance-container";
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
        content.className = "camera-raw-enhance-content";
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
        header.className = "camera-raw-enhance-header";
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
        title.textContent = "📷 Camera Raw Enhancement - Texture, Clarity, Dehaze";
        header.appendChild(title);
        
        // 按钮容器
        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;
        
        // 预设控制容器
        const presetContainer = document.createElement("div");
        presetContainer.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
            margin-right: 20px;
        `;
        
        // 预设下拉菜单
        const presetSelect = document.createElement('select');
        presetSelect.className = 'camera-raw-enhance-preset-select';
        presetSelect.style.cssText = `
            padding: 4px 8px;
            background: #333;
            border: 1px solid #555;
            color: #fff;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            min-width: 120px;
        `;
        presetSelect.innerHTML = '<option value="">Select Preset...</option>';
        
        // 加载预设列表
        this.loadCameraRawPresetList(presetSelect);
        
        // 预设选择事件
        presetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadCameraRawPreset(e.target.value);
            }
        });
        
        // 保存预设按钮
        const savePresetBtn = document.createElement('button');
        savePresetBtn.style.cssText = `
            padding: 4px 12px;
            font-size: 12px;
            background: #4a7c4e;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
        `;
        savePresetBtn.innerHTML = '💾 Save';
        savePresetBtn.onclick = () => this.saveCameraRawPreset(presetSelect);
        
        // 管理预设按钮
        const managePresetBtn = document.createElement('button');
        managePresetBtn.style.cssText = `
            padding: 4px 12px;
            font-size: 12px;
            background: #555;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
        `;
        managePresetBtn.innerHTML = '⚙️ Manage';
        managePresetBtn.onclick = () => this.showCameraRawPresetManager(presetSelect);
        
        presetContainer.appendChild(presetSelect);
        presetContainer.appendChild(savePresetBtn);
        presetContainer.appendChild(managePresetBtn);
        
        // 设置按钮
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "camera-raw-enhance-settings";
        settingsBtn.style.cssText = `
            background-color: #95a5a6;
            color: white;
            border: none;
            border-radius: 5px;
            padding: 8px 15px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        `;
        settingsBtn.textContent = "Settings";
        settingsBtn.addEventListener('mouseenter', () => settingsBtn.style.backgroundColor = '#7f8c8d');
        settingsBtn.addEventListener('mouseleave', () => settingsBtn.style.backgroundColor = '#95a5a6');
        settingsBtn.addEventListener('click', () => this.showSettings());
        
        // 重置按钮
        const resetBtn = document.createElement("button");
        resetBtn.className = "camera-raw-enhance-reset";
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
        resetBtn.textContent = "Reset";
        resetBtn.addEventListener('mouseenter', () => resetBtn.style.backgroundColor = '#2980b9');
        resetBtn.addEventListener('mouseleave', () => resetBtn.style.backgroundColor = '#3498db');
        resetBtn.addEventListener('click', () => this.resetParameters());
        
        // 应用按钮
        const applyBtn = document.createElement("button");
        applyBtn.className = "camera-raw-enhance-apply";
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
        applyBtn.textContent = "Apply";
        applyBtn.addEventListener('mouseenter', () => applyBtn.style.backgroundColor = '#229954');
        applyBtn.addEventListener('mouseleave', () => applyBtn.style.backgroundColor = '#27ae60');
        applyBtn.addEventListener('click', () => this.applyChanges());
        
        // 关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.className = "camera-raw-enhance-close";
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
        closeBtn.textContent = "Close";
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#ff3838');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = '#ff4757');
        closeBtn.addEventListener('click', () => this.close());
        
        buttonContainer.appendChild(presetContainer);
        buttonContainer.appendChild(settingsBtn);
        buttonContainer.appendChild(resetBtn);
        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(closeBtn);
        header.appendChild(buttonContainer);
        
        return header;
    }
    
    createPreviewSection() {
        const section = document.createElement("div");
        section.className = "camera-raw-enhance-preview-section";
        section.style.cssText = `
            flex: 1;
            padding: 20px;
            background-color: #1a1a1a;
            display: flex;
            flex-direction: column;
        `;
        
        
        // 预览画布容器
        const canvasContainer = document.createElement("div");
        canvasContainer.style.cssText = `
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #333;
            border-radius: 8px;
            overflow: hidden;
            position: relative;
        `;
        
        // 预览画布
        this.previewCanvas = document.createElement("canvas");
        this.previewCanvas.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            border-radius: 4px;
        `;
        this.previewContext = this.previewCanvas.getContext("2d");
        
        canvasContainer.appendChild(this.previewCanvas);
        section.appendChild(canvasContainer);
        
        return section;
    }
    
    createControlSection() {
        const section = document.createElement("div");
        section.className = "camera-raw-enhance-control-section";
        section.style.cssText = `
            width: 350px;
            padding: 20px;
            background-color: #2a2a2a;
            overflow-y: auto;
            border-left: 1px solid #444;
        `;
        
        // 控制面板标题
        const title = document.createElement("h3");
        title.textContent = "Enhancement Controls";
        title.style.cssText = `
            color: white;
            margin: 0 0 20px 0;
            font-size: 16px;
        `;
        section.appendChild(title);
        
        // === Exposure Adjustment Section ===
        const exposureTitle = this.createSectionTitle("📸 Exposure Adjustment");
        section.appendChild(exposureTitle);
        
        const exposureGroup = this.createSliderGroup("Exposure", "exposure", -5, 5, 0, 
            "Exposure adjustment, controls overall brightness", 0.1);
        section.appendChild(exposureGroup);
        
        const highlightsGroup = this.createSliderGroup("Highlights", "highlights", -100, 100, 0, 
            "Highlights adjustment, controls overexposed areas");
        section.appendChild(highlightsGroup);
        
        const shadowsGroup = this.createSliderGroup("Shadows", "shadows", -100, 100, 0, 
            "Shadow adjustment, brightens dark detail areas");
        section.appendChild(shadowsGroup);
        
        const whitesGroup = this.createSliderGroup("Whites", "whites", -100, 100, 0, 
            "Whites adjustment, adjusts white point");
        section.appendChild(whitesGroup);
        
        const blacksGroup = this.createSliderGroup("Blacks", "blacks", -100, 100, 0, 
            "Blacks adjustment, adjusts black point");
        section.appendChild(blacksGroup);
        
        // === Color Adjustment Section ===
        const colorTitle = this.createSectionTitle("🎨 Color Adjustment");
        section.appendChild(colorTitle);
        
        const temperatureGroup = this.createSliderGroup("Temperature", "temperature", -100, 100, 0, 
            "Temperature adjustment, controls warm/cool tone");
        section.appendChild(temperatureGroup);
        
        const tintGroup = this.createSliderGroup("Tint", "tint", -100, 100, 0, 
            "Tint adjustment, green/magenta balance");
        section.appendChild(tintGroup);
        
        const vibranceGroup = this.createSliderGroup("Vibrance", "vibrance", -100, 100, 0, 
            "Vibrance, intelligent saturation adjustment");
        section.appendChild(vibranceGroup);
        
        const saturationGroup = this.createSliderGroup("Saturation", "saturation", -100, 100, 0, 
            "Saturation adjustment, overall saturation");
        section.appendChild(saturationGroup);
        
        // === Basic Adjustment Section ===
        const basicTitle = this.createSectionTitle("⚙️ Basic Adjustment");
        section.appendChild(basicTitle);
        
        const contrastGroup = this.createSliderGroup("Contrast", "contrast", -100, 100, 0, 
            "Contrast adjustment, overall contrast");
        section.appendChild(contrastGroup);
        
        // === Enhancement Features Section ===
        const enhanceTitle = this.createSectionTitle("✨ Enhancement Features");
        section.appendChild(enhanceTitle);
        
        const textureGroup = this.createSliderGroup("Texture", "texture", -100, 100, 0, 
            "Enhances contrast in medium-sized details");
        section.appendChild(textureGroup);
        
        const clarityGroup = this.createSliderGroup("Clarity", "clarity", -100, 100, 0, 
            "Enhances midtone contrast");
        section.appendChild(clarityGroup);
        
        const dehazeGroup = this.createSliderGroup("Dehaze", "dehaze", -100, 100, 0, 
            "Reduces or adds atmospheric haze effect");
        section.appendChild(dehazeGroup);
        
        // === Blend Control Section ===
        const mixTitle = this.createSectionTitle("🔧 Blend Control");
        section.appendChild(mixTitle);
        
        const blendGroup = this.createSliderGroup("Blend", "blend", 0, 100, 100, 
            "Controls the blend amount of enhancement effects");
        section.appendChild(blendGroup);
        
        const strengthGroup = this.createSliderGroup("Overall Strength", "overall_strength", 0, 2, 1, 
            "Overall strength of enhancement effects", 0.1);
        section.appendChild(strengthGroup);
        
        
        return section;
    }
    
    createSectionTitle(titleText) {
        const title = document.createElement("h4");
        title.textContent = titleText;
        title.style.cssText = `
            color: #ffffff;
            margin: 25px 0 15px 0;
            font-size: 14px;
            font-weight: 600;
            padding: 8px 12px;
            background: linear-gradient(45deg, #2c3e50, #34495e);
            border-radius: 6px;
            border-left: 4px solid #3498db;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        `;
        return title;
    }
    
    createSliderGroup(label, key, min, max, defaultValue, tooltip, step = 1) {
        const group = document.createElement("div");
        group.className = "slider-group";
        group.style.cssText = `
            margin-bottom: 20px;
        `;
        
        // 标签和数值显示
        const labelDiv = document.createElement("div");
        labelDiv.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            color: white;
            font-size: 14px;
        `;
        
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label;
        labelSpan.title = tooltip;
        
        const valueSpan = document.createElement("span");
        valueSpan.textContent = defaultValue;
        valueSpan.style.cssText = `
            background-color: #444;
            padding: 2px 8px;
            border-radius: 3px;
            font-family: monospace;
        `;
        
        labelDiv.appendChild(labelSpan);
        labelDiv.appendChild(valueSpan);
        
        // 滑块
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = defaultValue;
        slider.style.cssText = `
            width: 100%;
            height: 20px;
            background: #444;
            outline: none;
            border-radius: 10px;
            -webkit-appearance: none;
        `;
        
        // 滑块样式
        const style = document.createElement("style");
        style.textContent = `
            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #007acc;
                cursor: pointer;
            }
            input[type="range"]::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #007acc;
                cursor: pointer;
                border: none;
            }
        `;
        document.head.appendChild(style);
        
        // 事件监听
        slider.oninput = (e) => {
            const value = parseFloat(e.target.value);
            valueSpan.textContent = value;
            this.enhanceData[key] = value;
            this.updateNodeParameter(key, value);
            this.applyEnhancement();
        };
        
        group.appendChild(labelDiv);
        group.appendChild(slider);
        
        // 保存滑块引用
        this.sliders[key] = { slider, valueSpan };
        
        return group;
    }
    
    updateNodeParameter(paramName, value) {
        if (this.node && this.node.widgets) {
            const widget = this.node.widgets.find(w => w.name === paramName);
            if (widget) {
                widget.value = value;
                this.node.setDirtyCanvas(true);
            }
        }
    }
    
    showSettings() {
        // 简单的设置弹窗（未来可以扩展）
        alert("Camera Raw Enhancement settings coming soon!");
    }
    
    resetParameters() {
        this.enhanceData = {
            // Exposure Adjustments
            exposure: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            // Color Adjustments
            temperature: 0.0,
            tint: 0.0,
            vibrance: 0.0,
            saturation: 0.0,
            // Basic Adjustments
            contrast: 0.0,
            // Enhancement Features
            texture: 0.0,
            clarity: 0.0,
            dehaze: 0.0,
            // Blend Control
            blend: 100.0,
            overall_strength: 1.0
        };
        
        // 更新UI
        Object.keys(this.sliders).forEach(key => {
            if (this.sliders[key]) {
                this.sliders[key].slider.value = this.enhanceData[key];
                this.sliders[key].valueSpan.textContent = this.enhanceData[key];
            }
        });
        
        this.applyEnhancement();
        this.showResetNotification();
    }
    
    applyChanges() {
        // 同步参数到节点
        if (!this.node.widgets) {
            console.error('Camera Raw Enhance: Node has no widgets');
            return;
        }
        
        // 查找并更新对应的widget值
        const widgetMap = {
            // Exposure Adjustments
            'exposure': this.enhanceData.exposure,
            'highlights': this.enhanceData.highlights,
            'shadows': this.enhanceData.shadows,
            'whites': this.enhanceData.whites,
            'blacks': this.enhanceData.blacks,
            // Color Adjustments
            'temperature': this.enhanceData.temperature,
            'tint': this.enhanceData.tint,
            'vibrance': this.enhanceData.vibrance,
            'saturation': this.enhanceData.saturation,
            // Basic Adjustments
            'contrast': this.enhanceData.contrast,
            // Enhancement Features
            'texture': this.enhanceData.texture,
            'clarity': this.enhanceData.clarity,
            'dehaze': this.enhanceData.dehaze,
            // Blend Control
            'blend': this.enhanceData.blend,
            'overall_strength': this.enhanceData.overall_strength
        };
        
        for (const widget of this.node.widgets) {
            if (widgetMap.hasOwnProperty(widget.name)) {
                widget.value = widgetMap[widget.name];
                console.log(`Updated ${widget.name} = ${widget.value}`);
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
    
    showResetNotification() {
        // 创建提示元素
        const notification = document.createElement("div");
        notification.style.cssText = `
            position: absolute;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            animation: fadeInOut 2s ease-in-out;
        `;
        notification.textContent = "↺ Parameters Reset";
        
        // 添加动画
        this.addNotificationStyle();
        
        // 添加到模态框
        this.modal.querySelector('.camera-raw-enhance-container').appendChild(notification);
        
        // 2秒后移除
        setTimeout(() => {
            notification.remove();
        }, 2000);
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
        notification.textContent = "✓ Parameters Applied to Node";
        
        // 添加动画
        this.addNotificationStyle();
        
        // 添加到模态框
        this.modal.querySelector('.camera-raw-enhance-container').appendChild(notification);
        
        // 2秒后移除
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }
    
    addNotificationStyle() {
        // 检查是否已经添加过样式
        if (!document.getElementById('camera-raw-enhance-notification-style')) {
            const style = document.createElement("style");
            style.id = 'camera-raw-enhance-notification-style';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                    20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    applyEnhancement() {
        if (!this.currentImage) return;
        
        // 在预览画布上应用增强效果（简化版本，仅用于实时反馈）
        const canvas = this.previewCanvas;
        const ctx = this.previewContext;
        
        // 清除画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制原始图像
        ctx.drawImage(this.currentImage, 0, 0, canvas.width, canvas.height);
        
        // 检查是否需要应用增强效果
        const hasAnyAdjustment = (
            this.enhanceData.exposure !== 0 || this.enhanceData.highlights !== 0 || 
            this.enhanceData.shadows !== 0 || this.enhanceData.whites !== 0 || this.enhanceData.blacks !== 0 ||
            this.enhanceData.temperature !== 0 || this.enhanceData.tint !== 0 || 
            this.enhanceData.vibrance !== 0 || this.enhanceData.saturation !== 0 ||
            this.enhanceData.contrast !== 0 || this.enhanceData.texture !== 0 || 
            this.enhanceData.clarity !== 0 || this.enhanceData.dehaze !== 0
        );
        
        // 应用简化的增强效果（仅用于预览反馈）
        if (hasAnyAdjustment) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            this.applySimpleEnhancement(imageData);
            ctx.putImageData(imageData, 0, 0);
        }
        
        // 应用混合
        if (this.enhanceData.blend < 100) {
            ctx.globalAlpha = this.enhanceData.blend / 100.0;
            ctx.drawImage(this.currentImage, 0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
        }
    }
    
    applySimpleEnhancement(imageData) {
        const data = imageData.data;
        
        // 获取所有调整参数
        const exposure = this.enhanceData.exposure;
        const highlights = this.enhanceData.highlights / 100.0;
        const shadows = this.enhanceData.shadows / 100.0;
        const whites = this.enhanceData.whites / 100.0;
        const blacks = this.enhanceData.blacks / 100.0;
        const temperature = this.enhanceData.temperature / 100.0;
        const tint = this.enhanceData.tint / 100.0;
        const vibrance = this.enhanceData.vibrance / 100.0;
        const saturation = this.enhanceData.saturation / 100.0;
        const contrast = this.enhanceData.contrast / 100.0;
        const texture = this.enhanceData.texture / 100.0;
        const clarity = this.enhanceData.clarity / 100.0;
        const dehaze = this.enhanceData.dehaze / 100.0;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255.0;
            let g = data[i + 1] / 255.0;
            let b = data[i + 2] / 255.0;
            
            // === 第一步：曝光调整 ===
            if (exposure !== 0) {
                const exposureFactor = Math.pow(2, exposure);
                r *= exposureFactor;
                g *= exposureFactor;
                b *= exposureFactor;
            }
            
            // 高光调整（简化版）
            if (highlights !== 0) {
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                const highlightMask = Math.pow(luminance, 0.5);
                const factor = 1.0 + highlights * (highlights < 0 ? 0.8 : 0.5);
                r = r * (1 - highlightMask) + r * factor * highlightMask;
                g = g * (1 - highlightMask) + g * factor * highlightMask;
                b = b * (1 - highlightMask) + b * factor * highlightMask;
            }
            
            // 阴影调整（简化版）
            if (shadows !== 0) {
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                const shadowMask = 1.0 - Math.pow(luminance, 0.8);
                if (shadows > 0) {
                    const liftAmount = shadows * 0.6;
                    r += shadowMask * liftAmount;
                    g += shadowMask * liftAmount;
                    b += shadowMask * liftAmount;
                } else {
                    const factor = 1.0 + shadows * 0.4;
                    r = r * (1 - shadowMask) + r * factor * shadowMask;
                    g = g * (1 - shadowMask) + g * factor * shadowMask;
                    b = b * (1 - shadowMask) + b * factor * shadowMask;
                }
            }
            
            // 白色和黑色调整（简化版）
            if (whites !== 0) {
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                const weight = Math.pow(luminance, 1.5);
                const factor = 1.0 + whites * (whites > 0 ? 0.5 : 0.3) * weight;
                r *= factor;
                g *= factor;
                b *= factor;
            }
            
            if (blacks !== 0) {
                const luminance = r * 0.299 + g * 0.587 + b * 0.114;
                const weight = 1.0 - Math.pow(luminance, 0.8);
                if (blacks > 0) {
                    const liftAmount = blacks * 0.3 * weight;
                    r += liftAmount;
                    g += liftAmount;
                    b += liftAmount;
                } else {
                    const factor = 1.0 + blacks * 0.2 * weight;
                    r *= factor;
                    g *= factor;
                    b *= factor;
                }
            }
            
            // === 第二步：色彩调整 ===
            // 白平衡调整（简化版）
            if (temperature !== 0 || tint !== 0) {
                // 色温调整
                if (temperature !== 0) {
                    if (temperature > 0) {
                        r *= 1.0 + temperature * 0.3;
                        g *= 1.0 + temperature * 0.1;
                        b *= 1.0 - temperature * 0.2;
                    } else {
                        r *= 1.0 + temperature * 0.2;
                        g *= 1.0 + temperature * 0.05;
                        b *= 1.0 - temperature * 0.3;
                    }
                }
                
                // 色调调整
                if (tint !== 0) {
                    if (tint > 0) {
                        g *= 1.0 + tint * 0.2;
                        r *= 1.0 - tint * 0.1;
                        b *= 1.0 - tint * 0.1;
                    } else {
                        g *= 1.0 + tint * 0.1;
                        r *= 1.0 - tint * 0.15;
                        b *= 1.0 - tint * 0.15;
                    }
                }
            }
            
            // 自然饱和度调整（简化版）
            if (vibrance !== 0) {
                const maxRGB = Math.max(r, g, b);
                const minRGB = Math.min(r, g, b);
                const currentSat = maxRGB > 0 ? (maxRGB - minRGB) / maxRGB : 0;
                const saturationMask = 1.0 - currentSat * currentSat;
                
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                const vibranceFactor = 1.0 + vibrance * saturationMask;
                r = gray + (r - gray) * vibranceFactor;
                g = gray + (g - gray) * vibranceFactor;
                b = gray + (b - gray) * vibranceFactor;
            }
            
            // 饱和度调整（简化版）
            if (saturation !== 0) {
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                const saturationFactor = 1.0 + saturation;
                r = gray + (r - gray) * saturationFactor;
                g = gray + (g - gray) * saturationFactor;
                b = gray + (b - gray) * saturationFactor;
            }
            
            // === 第三步：基本调整 ===
            // 对比度调整
            if (contrast !== 0) {
                const contrastFactor = 1.0 + contrast;
                r = (r - 0.5) * contrastFactor + 0.5;
                g = (g - 0.5) * contrastFactor + 0.5;
                b = (b - 0.5) * contrastFactor + 0.5;
            }
            
            // === 第四步：增强功能（保持原有简化算法）===
            // 转回255范围进行增强处理
            let r255 = r * 255;
            let g255 = g * 255;
            let b255 = b * 255;
            
            // 简化的纹理增强（增加对比度）
            if (texture !== 0) {
                const factor = 1 + texture * 0.5;
                r255 = Math.min(255, Math.max(0, (r255 - 128) * factor + 128));
                g255 = Math.min(255, Math.max(0, (g255 - 128) * factor + 128));
                b255 = Math.min(255, Math.max(0, (b255 - 128) * factor + 128));
            }
            
            // 简化的清晰度增强（增加锐化）
            if (clarity !== 0) {
                const factor = 1 + clarity * 0.3;
                r255 = Math.min(255, Math.max(0, r255 * factor));
                g255 = Math.min(255, Math.max(0, g255 * factor));
                b255 = Math.min(255, Math.max(0, b255 * factor));
            }
            
            // 转回0-1范围
            r = r255 / 255;
            g = g255 / 255;
            b = b255 / 255;
            
            // Dehaze effect - exact match to backend algorithm
            if (dehaze !== 0) {
                const dehazeStrength = Math.abs(dehaze);
                
                if (dehaze > 0) {
                    // Forward dehaze - exact backend match (_simple_dehaze_frontend_match)
                    const original_r = r, original_g = g, original_b = b;
                    
                    // Step 1: Saturation enhancement (1 + strength * 1.5, max 2.5x)
                    const gray = r * 0.299 + g * 0.587 + b * 0.114;
                    const saturation_boost = 1 + dehazeStrength * 1.5;
                    r = gray + (r - gray) * saturation_boost;
                    g = gray + (g - gray) * saturation_boost;
                    b = gray + (b - gray) * saturation_boost;
                    
                    // Step 2: Brightness reduction (1 - strength * 0.25, minimum 0.75)
                    const brightness_reduction = 1 - dehazeStrength * 0.25;
                    r *= brightness_reduction;
                    g *= brightness_reduction;
                    b *= brightness_reduction;
                    
                    // Step 3: Contrast enhancement (1 + strength * 0.3)
                    const contrast_boost = 1 + dehazeStrength * 0.3;
                    r = (r - 0.5) * contrast_boost + 0.5;
                    g = (g - 0.5) * contrast_boost + 0.5;
                    b = (b - 0.5) * contrast_boost + 0.5;
                    
                    // Step 4: Color balance adjustment
                    r *= 1.0;   // Red remains unchanged
                    g *= 0.98;  // Green slightly reduced
                    b *= 0.88;  // Blue significantly reduced (reduces haze blue tone)
                    
                    // Step 5: Blend with original (blend strength: 0.9 * strength)
                    const blend_strength = 0.9 * dehazeStrength;
                    r = original_r * (1 - blend_strength) + r * blend_strength;
                    g = original_g * (1 - blend_strength) + g * blend_strength;
                    b = original_b * (1 - blend_strength) + b * blend_strength;
                } else {
                    // Negative dehaze (add haze effect) - matches backend _negative_dehaze
                    const hazeStrength = dehazeStrength;
                    
                    // Step 1: Reduce contrast (gamma adjustment)
                    const gamma = 1.0 + hazeStrength * 0.5;
                    r = Math.pow(r, gamma);
                    g = Math.pow(g, gamma);
                    b = Math.pow(b, gamma);
                    
                    // Step 2: Reduce saturation
                    const gray = r * 0.299 + g * 0.587 + b * 0.114;
                    const desaturation = hazeStrength * 0.3;
                    r = r * (1 - desaturation) + gray * desaturation;
                    g = g * (1 - desaturation) + gray * desaturation;
                    b = b * (1 - desaturation) + gray * desaturation;
                    
                    // Step 3: Add atmospheric light
                    const atmosphericLight = 0.8; // Simulate atmospheric light intensity
                    const hazeAmount = hazeStrength * 0.2;
                    r += (atmosphericLight - r) * hazeAmount;
                    g += (atmosphericLight - g) * hazeAmount;
                    b += (atmosphericLight - b) * hazeAmount;
                }
            }
            
            // Final clamping to valid range and convert to 0-255 range
            r = Math.min(1, Math.max(0, r));
            g = Math.min(1, Math.max(0, g));
            b = Math.min(1, Math.max(0, b));
            
            data[i] = r * 255;
            data[i + 1] = g * 255;
            data[i + 2] = b * 255;
        }
    }
    
    setupEventListeners() {
        // 点击背景关闭弹窗
        this.modal.onclick = (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        };
        
        // ESC键关闭弹窗
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    show() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.modal.style.display = "flex";
        document.body.appendChild(this.modal);
        
        // 加载当前图像
        this.loadCurrentImage();
    }
    
    open() {
        this.show();
    }
    
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.modal.style.display = "none";
        if (this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
    }
    
    loadCurrentImage() {
        console.log('Camera Raw Enhance: Starting to load image');
        this.loadImage();
    }
    
    loadImage() {
        const imageUrl = this.getNodeImage();
        if (imageUrl) {
            console.log('Camera Raw Enhance: 找到图像URL:', imageUrl);
            this.loadImageFromUrl(imageUrl);
        } else {
            console.log('Camera Raw Enhance: 未找到图像，显示占位符');
            this.displayPlaceholder();
        }
    }
    
    getNodeImage() {
        try {
            // 方法1: 后端推送的预览图像
            if (this.node._previewImageUrl) {
                console.log('Camera Raw Enhance: 使用后端推送的图像');
                return this.node._previewImageUrl;
            }
            
            // 方法2: 从全局缓存获取
            const cached = window.globalNodeCache.get(String(this.node.id));
            if (cached && cached.images && cached.images.length > 0) {
                console.log('Camera Raw Enhance: 使用缓存的图像');
                return this.convertToImageUrl(cached.images[0]);
            }
            
            // 方法3: 从连接的输入节点获取
            const inputNode = this.findConnectedInputNode();
            if (inputNode) {
                // 3.1: 检查输入节点的_curveNodeImageUrls
                if (inputNode._curveNodeImageUrls && inputNode._curveNodeImageUrls.length > 0) {
                    console.log('Camera Raw Enhance: 使用输入节点的_curveNodeImageUrls');
                    return inputNode._curveNodeImageUrls[0];
                }
                
                // 3.2: 检查输入节点的imgs属性（Load Image节点使用）
                if (inputNode.imgs && inputNode.imgs.length > 0) {
                    console.log('Camera Raw Enhance: 使用输入节点的imgs');
                    return this.convertToImageUrl(inputNode.imgs[0]);
                }
                
                // 3.3: 检查输入节点的imageIndex和images（某些节点使用）
                if (inputNode.imageIndex !== undefined && inputNode.images && inputNode.images.length > 0) {
                    const idx = Math.min(inputNode.imageIndex, inputNode.images.length - 1);
                    console.log('Camera Raw Enhance: 使用输入节点的images[' + idx + ']');
                    return this.convertToImageUrl(inputNode.images[idx]);
                }
                
                // 3.4: 从app.nodeOutputs获取输入节点的输出
                if (app.nodeOutputs && app.nodeOutputs[inputNode.id]) {
                    const inputNodeOutput = app.nodeOutputs[inputNode.id];
                    if (inputNodeOutput.images && inputNodeOutput.images.length > 0) {
                        console.log('Camera Raw Enhance: 使用输入节点的nodeOutputs');
                        return this.convertToImageUrl(inputNodeOutput.images[0]);
                    }
                }
                
                // 3.5: 检查输入节点的widgets中是否有图像数据
                if (inputNode.widgets) {
                    for (const widget of inputNode.widgets) {
                        if (widget.type === 'image' && widget.value) {
                            console.log('Camera Raw Enhance: 使用输入节点的widget图像');
                            return this.convertToImageUrl(widget.value);
                        }
                    }
                }
            }
            
            // 方法4: 从app.nodeOutputs获取
            if (app.nodeOutputs) {
                const nodeOutput = app.nodeOutputs[this.node.id];
                if (nodeOutput && nodeOutput.images) {
                    console.log('Camera Raw Enhance: 使用app.nodeOutputs的图像');
                    return this.convertToImageUrl(nodeOutput.images[0]);
                }
            }
            
            // 方法5: 递归查找图像源节点
            const imageSourceNode = this.findImageSourceNode(inputNode || this.node);
            if (imageSourceNode && imageSourceNode.imgs && imageSourceNode.imgs.length > 0) {
                console.log('Camera Raw Enhance: 通过递归查找到图像源节点');
                return this.convertToImageUrl(imageSourceNode.imgs[0]);
            }
            
            // 方法6: 遍历所有可能的输入链接
            if (this.node.inputs) {
                for (let i = 0; i < this.node.inputs.length; i++) {
                    const input = this.node.inputs[i];
                    if (input.link !== null) {
                        const link = app.graph.links[input.link];
                        if (link && link.origin_id) {
                            const sourceNode = app.graph.getNodeById(link.origin_id);
                            if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                console.log('Camera Raw Enhance: 通过链接找到源节点图像');
                                return this.convertToImageUrl(sourceNode.imgs[0]);
                            }
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Camera Raw Enhance: 获取图像时出错:', error);
            return null;
        }
    }
    
    convertToImageUrl(imageData) {
        if (!imageData) return null;
        
        // 字符串类型
        if (typeof imageData === 'string') {
            if (imageData.startsWith('data:')) {
                return imageData;
            }
            if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
                return imageData;
            }
            // 假设是文件名
            return `/view?filename=${encodeURIComponent(imageData)}&type=input&subfolder=&preview=canvas`;
        }
        
        // 对象类型
        if (imageData && typeof imageData === 'object') {
            // 标准格式 {filename, subfolder, type}
            if (imageData.filename) {
                const { filename, subfolder = '', type = 'input' } = imageData;
                return `/view?filename=${encodeURIComponent(filename)}&type=${type}&subfolder=${encodeURIComponent(subfolder)}&preview=canvas`;
            }
            
            // 可能是{url}格式
            if (imageData.url) {
                return imageData.url;
            }
            
            // 可能是{src}格式
            if (imageData.src) {
                return imageData.src;
            }
            
            // 可能是{image}格式
            if (imageData.image) {
                return this.convertToImageUrl(imageData.image);
            }
        }
        
        // 数组类型（取第一个）
        if (Array.isArray(imageData) && imageData.length > 0) {
            return this.convertToImageUrl(imageData[0]);
        }
        
        return null;
    }
    
    findConnectedInputNode() {
        if (!this.node.inputs || this.node.inputs.length === 0) {
            return null;
        }
        
        // 查找名为"image"的输入
        for (const input of this.node.inputs) {
            if (input.name === "image" && input.link) {
                const link = app.graph.links[input.link];
                if (link) {
                    const sourceNode = app.graph.getNodeById(link.origin_id);
                    if (sourceNode) {
                        return sourceNode;
                    }
                }
            }
        }
        
        // 如果没有找到，尝试第一个有链接的输入
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
    
    findImageSourceNode(node, visited = new Set()) {
        // 防止循环引用
        if (!node || visited.has(node.id)) {
            return null;
        }
        visited.add(node.id);
        
        // 检查当前节点是否有图像
        if (node.imgs && node.imgs.length > 0) {
            return node;
        }
        
        // 检查节点类型
        if (node.type === "LoadImage" || node.type === "LoadImageMask") {
            return node;
        }
        
        // 递归查找上游节点
        if (node.inputs) {
            for (const input of node.inputs) {
                if (input.link) {
                    const link = app.graph.links[input.link];
                    if (link) {
                        const sourceNode = app.graph.getNodeById(link.origin_id);
                        if (sourceNode) {
                            const imageSource = this.findImageSourceNode(sourceNode, visited);
                            if (imageSource) {
                                return imageSource;
                            }
                        }
                    }
                }
            }
        }
        
        return null;
    }
    
    loadImageFromUrl(imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            this.currentImage = img;
            
            // 调整画布大小 - 增大显示尺寸
            const maxWidth = 800;
            const maxHeight = 700;
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            this.previewCanvas.width = width;
            this.previewCanvas.height = height;
            
            // 应用当前增强效果
            this.applyEnhancement();
        };
        img.onerror = () => {
            console.error('Camera Raw Enhance: 图像加载失败:', imageUrl);
            this.displayPlaceholder();
        };
        img.src = imageUrl;
    }
    
    displayImage(imageBase64) {
        if (imageBase64.startsWith('data:')) {
            this.loadImageFromUrl(imageBase64);
        } else {
            this.loadImageFromUrl(`data:image/png;base64,${imageBase64}`);
        }
    }
    
    displayPlaceholder() {
        const canvas = this.previewCanvas;
        const ctx = this.previewContext;
        
        canvas.width = 600;
        canvas.height = 450;
        
        // 绘制占位符
        ctx.fillStyle = "#444";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#888";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Waiting for image input...", canvas.width / 2, canvas.height / 2);
    }
    
    updatePreview(data) {
        if (data && data.image) {
            this.displayImage(data.image);
        }
    }
    
    // Camera Raw预设管理功能
    async loadCameraRawPresetList(selectElement) {
        try {
            const response = await fetch('/camera_raw_presets/list');
            const data = await response.json();
            
            if (data.success) {
                // 清空现有选项
                selectElement.innerHTML = '<option value="">Select Preset...</option>';
                
                // 按类别分组
                const categories = {};
                data.presets.forEach(preset => {
                    const category = preset.category || 'custom';
                    if (!categories[category]) {
                        categories[category] = [];
                    }
                    categories[category].push(preset);
                });
                
                // 添加分组选项
                Object.entries(categories).forEach(([category, presets]) => {
                    const optgroup = document.createElement('optgroup');
                    optgroup.label = this.getCategoryLabel(category);
                    
                    presets.forEach(preset => {
                        const option = document.createElement('option');
                        option.value = preset.id;
                        option.textContent = preset.name;
                        option.dataset.preset = JSON.stringify(preset);
                        optgroup.appendChild(option);
                    });
                    
                    selectElement.appendChild(optgroup);
                });
            }
        } catch (error) {
            console.error('加载Camera Raw预设列表失败:', error);
        }
    }
    
    getCategoryLabel(category) {
        const labels = {
            'default': 'Default Presets',
            'enhance': 'Enhancement',
            'portrait': 'Portrait',
            'landscape': 'Landscape',
            'custom': 'Custom'
        };
        return labels[category] || category;
    }
    
    async loadCameraRawPreset(presetId) {
        try {
            const response = await fetch(`/camera_raw_presets/load/${presetId}`);
            const data = await response.json();
            
            if (data.success && data.preset) {
                const preset = data.preset;
                const parameters = preset.parameters;
                
                // 应用预设参数到enhanceData
                this.enhanceData = {
                    // Exposure Adjustments
                    exposure: parameters.exposure || 0.0,
                    highlights: parameters.highlights || 0.0,
                    shadows: parameters.shadows || 0.0,
                    whites: parameters.whites || 0.0,
                    blacks: parameters.blacks || 0.0,
                    // Color Adjustments
                    temperature: parameters.temperature || 0.0,
                    tint: parameters.tint || 0.0,
                    vibrance: parameters.vibrance || 0.0,
                    saturation: parameters.saturation || 0.0,
                    // Basic Adjustments
                    contrast: parameters.contrast || 0.0,
                    // Enhancement Features
                    texture: parameters.texture || 0.0,
                    clarity: parameters.clarity || 0.0,
                    dehaze: parameters.dehaze || 0.0,
                    // Blend Control
                    blend: parameters.blend || 100.0,
                    overall_strength: parameters.overall_strength || 1.0
                };
                
                // 更新UI控件
                this.updateUIFromEnhanceData();
                
                // 更新预览
                this.applyEnhancement();
                
                console.log('Camera Raw预设加载成功:', preset.name);
            }
        } catch (error) {
            console.error('加载Camera Raw预设失败:', error);
            alert('Failed to load preset: ' + error.message);
        }
    }
    
    updateUIFromEnhanceData() {
        // 更新所有滑块的值
        Object.entries(this.sliders).forEach(([paramName, sliderData]) => {
            const value = this.enhanceData[paramName];
            if (value !== undefined && sliderData.slider) {
                sliderData.slider.value = value;
                if (sliderData.valueSpan) {
                    const unit = paramName === 'blend' ? '%' : '';
                    sliderData.valueSpan.textContent = Math.round(value) + unit;
                }
            }
        });
        
        // 特殊处理overall_strength（转换为百分比）
        if (this.sliders.overall_strength) {
            const strengthValue = this.enhanceData.overall_strength * 100;
            this.sliders.overall_strength.slider.value = strengthValue;
            if (this.sliders.overall_strength.valueSpan) {
                this.sliders.overall_strength.valueSpan.textContent = Math.round(strengthValue) + '%';
            }
        }
    }
    
    async saveCameraRawPreset(presetSelect) {
        const name = prompt('Please enter preset name:');
        if (!name) return;
        
        const description = prompt('Please enter preset description (optional):') || '';
        
        try {
            // 收集当前所有Camera Raw参数
            const parameters = {
                // Exposure Adjustments
                exposure: this.enhanceData.exposure,
                highlights: this.enhanceData.highlights,
                shadows: this.enhanceData.shadows,
                whites: this.enhanceData.whites,
                blacks: this.enhanceData.blacks,
                // Color Adjustments
                temperature: this.enhanceData.temperature,
                tint: this.enhanceData.tint,
                vibrance: this.enhanceData.vibrance,
                saturation: this.enhanceData.saturation,
                // Basic Adjustments
                contrast: this.enhanceData.contrast,
                // Enhancement Features
                texture: this.enhanceData.texture,
                clarity: this.enhanceData.clarity,
                dehaze: this.enhanceData.dehaze,
                // Blend Control
                blend: this.enhanceData.blend,
                overall_strength: this.enhanceData.overall_strength
            };
            
            const presetData = {
                name: name,
                description: description,
                category: 'custom',
                parameters: parameters,
                tags: ['camera_raw', 'enhance', 'custom']
            };
            
            const response = await fetch('/camera_raw_presets/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(presetData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Preset saved successfully!');
                // 重新加载预设列表
                this.loadCameraRawPresetList(presetSelect);
            } else {
                alert('Failed to save preset: ' + result.error);
            }
        } catch (error) {
            console.error('保存Camera Raw预设失败:', error);
            alert('Failed to save preset: ' + error.message);
        }
    }
    
    async showCameraRawPresetManager(presetSelect) {
        try {
            // 获取预设列表
            const response = await fetch('/camera_raw_presets/list');
            const data = await response.json();
            
            if (!data.success) {
                alert('Failed to get preset list');
                return;
            }
            
            // 创建预设管理器模态窗口
            const managerModal = document.createElement('div');
            managerModal.className = 'preset-manager-modal';
            managerModal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10001;
            `;
            
            const managerContent = document.createElement('div');
            managerContent.style.cssText = `
                background: #2b2b2b;
                padding: 20px;
                border-radius: 8px;
                max-width: 600px;
                max-height: 80vh;
                overflow-y: auto;
                color: white;
            `;
            
            const title = document.createElement('h3');
            title.textContent = 'Camera Raw Preset Manager';
            title.style.marginBottom = '20px';
            managerContent.appendChild(title);
            
            // 预设列表
            const presetList = document.createElement('div');
            presetList.style.cssText = `
                max-height: 400px;
                overflow-y: auto;
                margin-bottom: 20px;
            `;
            
            data.presets.forEach(preset => {
                const presetItem = document.createElement('div');
                presetItem.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    border: 1px solid #444;
                    margin-bottom: 5px;
                    border-radius: 4px;
                `;
                
                const presetInfo = document.createElement('div');
                presetInfo.innerHTML = `
                    <strong>${preset.name}</strong><br>
                    <small>${preset.description || 'No description'}</small>
                `;
                
                const presetActions = document.createElement('div');
                presetActions.style.cssText = 'display: flex; gap: 5px;';
                
                if (preset.type === 'user') {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.style.cssText = `
                        padding: 4px 8px;
                        background: #d32f2f;
                        border: none;
                        border-radius: 3px;
                        color: white;
                        cursor: pointer;
                        font-size: 12px;
                    `;
                    deleteBtn.onclick = async () => {
                        if (confirm(`Are you sure you want to delete preset "${preset.name}"?`)) {
                            try {
                                const delResponse = await fetch(`/camera_raw_presets/delete/${preset.id}`, {
                                    method: 'DELETE'
                                });
                                const delResult = await delResponse.json();
                                
                                if (delResult.success) {
                                    presetItem.remove();
                                    this.loadCameraRawPresetList(presetSelect);
                                } else {
                                    alert('Failed to delete: ' + delResult.error);
                                }
                            } catch (error) {
                                alert('Failed to delete: ' + error.message);
                            }
                        }
                    };
                    presetActions.appendChild(deleteBtn);
                }
                
                const exportBtn = document.createElement('button');
                exportBtn.textContent = 'Export';
                exportBtn.style.cssText = `
                    padding: 4px 8px;
                    background: #388e3c;
                    border: none;
                    border-radius: 3px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                `;
                exportBtn.onclick = async () => {
                    try {
                        const expResponse = await fetch(`/camera_raw_presets/export/${preset.id}`);
                        const expResult = await expResponse.json();
                        
                        if (expResult.success) {
                            // 创建下载
                            const blob = new Blob([JSON.stringify(expResult.preset, null, 2)], {
                                type: 'application/json'
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = expResult.filename;
                            a.click();
                            URL.revokeObjectURL(url);
                        }
                    } catch (error) {
                        alert('Export failed: ' + error.message);
                    }
                };
                presetActions.appendChild(exportBtn);
                
                presetItem.appendChild(presetInfo);
                presetItem.appendChild(presetActions);
                presetList.appendChild(presetItem);
            });
            
            managerContent.appendChild(presetList);
            
            // 导入区域
            const importSection = document.createElement('div');
            importSection.style.marginBottom = '20px';
            
            const importTitle = document.createElement('h4');
            importTitle.textContent = 'Import Preset';
            importSection.appendChild(importTitle);
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.marginBottom = '10px';
            
            const importBtn = document.createElement('button');
            importBtn.textContent = 'Import File';
            importBtn.style.cssText = `
                padding: 8px 16px;
                background: #1976d2;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
            `;
            importBtn.onclick = async () => {
                const file = fileInput.files[0];
                if (!file) {
                    alert('Please select a file to import');
                    return;
                }
                
                try {
                    const text = await file.text();
                    const presetData = JSON.parse(text);
                    
                    const impResponse = await fetch('/camera_raw_presets/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ preset_data: presetData })
                    });
                    
                    const impResult = await impResponse.json();
                    
                    if (impResult.success) {
                        alert('Preset imported successfully!');
                        document.body.removeChild(managerModal);
                        this.loadCameraRawPresetList(presetSelect);
                    } else {
                        alert('Import failed: ' + impResult.error);
                    }
                } catch (error) {
                    alert('Import failed: ' + error.message);
                }
            };
            
            importSection.appendChild(fileInput);
            importSection.appendChild(importBtn);
            managerContent.appendChild(importSection);
            
            // 关闭按钮
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = `
                padding: 8px 16px;
                background: #666;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                float: right;
            `;
            closeBtn.onclick = () => document.body.removeChild(managerModal);
            managerContent.appendChild(closeBtn);
            
            managerModal.appendChild(managerContent);
            document.body.appendChild(managerModal);
            
        } catch (error) {
            console.error('显示Camera Raw预设管理器失败:', error);
            alert('Failed to show preset manager: ' + error.message);
        }
    }
}

// 节点注册
app.registerExtension({
    name: "CameraRawEnhance.Node",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CameraRawEnhanceNode") {
            console.log("✅ 注册 CameraRawEnhanceNode 扩展");
            
            // 添加双击事件处理
            const origOnDblClick = nodeType.prototype.onDblClick;
            nodeType.prototype.onDblClick = function(e, pos, graphCanvas) {
                console.log(`📷 双击 Camera Raw Enhance 节点 ${this.id}`);
                this.showCameraRawEnhanceModal();
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
                    content: "📷 Open Camera Raw Enhancement Editor",
                    callback: () => {
                        console.log(`📷 右键菜单打开 Camera Raw Enhance 编辑器，节点 ${this.id}`);
                        this.showCameraRawEnhanceModal();
                    }
                });
            };
            
            // 添加显示模态弹窗的方法
            nodeType.prototype.showCameraRawEnhanceModal = function() {
                if (!this.cameraRawEditor) {
                    this.cameraRawEditor = new CameraRawEnhanceEditor(this);
                }
                this.cameraRawEditor.show();
            };
            
            // 监听后端推送的预览数据
            if (!window.cameraRawEnhancePreviewListener) {
                window.cameraRawEnhancePreviewListener = true;
                
                console.log("📷 注册 Camera Raw Enhance 预览事件监听器");
                app.api.addEventListener("camera_raw_enhance_preview", ({ detail }) => {
                    console.log("📷 收到 Camera Raw Enhance 预览数据:", detail);
                    
                    const node = app.graph.getNodeById(detail.node_id);
                    if (node) {
                        // 存储预览数据
                        node._previewImageUrl = detail.image;
                        node._previewEnhanceData = detail.enhance_data;
                        
                        console.log(`✅ Camera Raw Enhance 节点 ${node.id} 预览数据已缓存`);
                        
                        // 如果编辑器已打开，更新预览
                        if (node.cameraRawEditor && node.cameraRawEditor.isOpen) {
                            node.cameraRawEditor.loadImage();
                        }
                    }
                });
            }
        }
    },
    
    async setup(app) {
        // 监听WebSocket消息
        const originalSetup = app.setup;
        app.setup = function(...args) {
            const result = originalSetup.apply(this, args);
            
            // 监听Camera Raw增强预览更新
            if (app.ws) {
                app.ws.addEventListener("message", (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === "camera_raw_enhance_update" && message.data) {
                            const nodeId = message.data.node_id;
                            const node = app.graph._nodes_by_id[nodeId];
                            
                            if (node && node.cameraRawEditor) {
                                node.cameraRawEditor.updatePreview(message.data);
                            }
                            
                            // 缓存输出
                            window.globalNodeCache.set(nodeId, message.data);
                        }
                    } catch (e) {
                        // 忽略非JSON消息
                    }
                });
            }
            
            return result;
        };
    }
});

// API事件监听 - 缓存节点输出
app.api.addEventListener("executed", ({ detail }) => {
    const nodeId = String(detail.node);
    const outputData = detail.output;
    
    if (outputData) {
        window.globalNodeCache.set(nodeId, outputData);
        console.log(`📦 Camera Raw Enhance: 缓存节点 ${nodeId} 的输出数据`);
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
            console.log(`📦 Camera Raw Enhance: 缓存节点 ${nodeId} 的缓存输出数据`);
        }
    }
});