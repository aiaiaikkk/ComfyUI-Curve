/**
 * Camera Raw Enhance Node - 前端交互界面
 * 实现纹理、清晰度、去薄雾三个增强功能
 */

import { app } from "../../scripts/app.js";

// 全局节点输出缓存
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// Camera Raw增强编辑器类
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
        
        // Camera Raw增强参数
        this.enhanceData = {
            texture: 0.0,
            clarity: 0.0,
            dehaze: 0.0,
            blend: 100.0,
            overall_strength: 1.0
        };
        
        this.createModal();
    }
    
    createModal() {
        // 创建模态弹窗
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
        title.textContent = "📷 Camera Raw增强 - 纹理、清晰度、去薄雾";
        header.appendChild(title);
        
        // 按钮容器
        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;
        
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
        settingsBtn.textContent = "设置";
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
        resetBtn.textContent = "重置";
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
        applyBtn.textContent = "应用";
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
        closeBtn.textContent = "关闭";
        closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#ff3838');
        closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = '#ff4757');
        closeBtn.addEventListener('click', () => this.close());
        
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
        title.textContent = "增强控制";
        title.style.cssText = `
            color: white;
            margin: 0 0 20px 0;
            font-size: 16px;
        `;
        section.appendChild(title);
        
        // 纹理控制
        const textureGroup = this.createSliderGroup("纹理 (Texture)", "texture", -100, 100, 0, 
            "增强中等大小细节的对比度");
        section.appendChild(textureGroup);
        
        // 清晰度控制
        const clarityGroup = this.createSliderGroup("清晰度 (Clarity)", "clarity", -100, 100, 0, 
            "增强中间调对比度");
        section.appendChild(clarityGroup);
        
        // 去薄雾控制
        const dehazeGroup = this.createSliderGroup("去薄雾 (Dehaze)", "dehaze", -100, 100, 0, 
            "减少或增加大气雾霾效果");
        section.appendChild(dehazeGroup);
        
        // 分隔线
        const separator = document.createElement("hr");
        separator.style.cssText = `
            border: none;
            border-top: 1px solid #444;
            margin: 20px 0;
        `;
        section.appendChild(separator);
        
        // 混合控制
        const blendGroup = this.createSliderGroup("混合 (Blend)", "blend", 0, 100, 100, 
            "控制增强效果的混合程度");
        section.appendChild(blendGroup);
        
        // 整体强度控制
        const strengthGroup = this.createSliderGroup("整体强度", "overall_strength", 0, 2, 1, 
            "增强效果的整体强度", 0.1);
        section.appendChild(strengthGroup);
        
        
        return section;
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
        alert("Camera Raw增强设置功能即将推出！");
    }
    
    resetParameters() {
        this.enhanceData = {
            texture: 0.0,
            clarity: 0.0,
            dehaze: 0.0,
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
            console.error('Camera Raw Enhance: 节点没有widgets');
            return;
        }
        
        // 查找并更新对应的widget值
        const widgetMap = {
            'texture': this.enhanceData.texture,
            'clarity': this.enhanceData.clarity,
            'dehaze': this.enhanceData.dehaze,
            'blend': this.enhanceData.blend,
            'overall_strength': this.enhanceData.overall_strength
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
        notification.textContent = "↺ 参数已重置";
        
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
        notification.textContent = "✓ 参数已应用到节点";
        
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
        
        // 应用简化的增强效果（仅用于预览反馈）
        if (this.enhanceData.texture !== 0 || this.enhanceData.clarity !== 0 || this.enhanceData.dehaze !== 0) {
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
        const texture = this.enhanceData.texture / 100.0;
        const clarity = this.enhanceData.clarity / 100.0;
        const dehaze = this.enhanceData.dehaze / 100.0;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // 简化的纹理增强（增加对比度）
            if (texture !== 0) {
                const factor = 1 + texture * 0.5;
                r = Math.min(255, Math.max(0, (r - 128) * factor + 128));
                g = Math.min(255, Math.max(0, (g - 128) * factor + 128));
                b = Math.min(255, Math.max(0, (b - 128) * factor + 128));
            }
            
            // 简化的清晰度增强（增加锐化）
            if (clarity !== 0) {
                const factor = 1 + clarity * 0.3;
                r = Math.min(255, Math.max(0, r * factor));
                g = Math.min(255, Math.max(0, g * factor));
                b = Math.min(255, Math.max(0, b * factor));
            }
            
            // 简化的去薄雾效果（调整饱和度和对比度）
            if (dehaze !== 0) {
                const satFactor = 1 + dehaze * 0.2;
                const contrastFactor = 1 + dehaze * 0.1;
                
                // 转换为HSV进行饱和度调整（简化版本）
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                
                if (delta > 0) {
                    const saturation = delta / max * satFactor;
                    const factor = Math.min(1, saturation);
                    
                    r = min + (r - min) * factor;
                    g = min + (g - min) * factor;
                    b = min + (b - min) * factor;
                }
                
                // 应用对比度
                r = Math.min(255, Math.max(0, (r - 128) * contrastFactor + 128));
                g = Math.min(255, Math.max(0, (g - 128) * contrastFactor + 128));
                b = Math.min(255, Math.max(0, (b - 128) * contrastFactor + 128));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
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
        console.log('Camera Raw Enhance: 开始加载图像');
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
        ctx.fillText("等待图像输入...", canvas.width / 2, canvas.height / 2);
    }
    
    updatePreview(data) {
        if (data && data.image) {
            this.displayImage(data.image);
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
                    content: "📷 打开Camera Raw增强编辑器",
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