import { app } from "../../scripts/app.js";

/*
 * PhotoshopCurveNode.js - Curve Adjustment Node
 * 
 * Fix Content:
 * 1. Fixed the issue where double-clicking node couldn't open popup
 * 2. Fixed the issue where reset button wasn't showing
 * 3. Simplified modal popup creation and event handling
 * 4. Improved curve editor creation process
 */


// Global node output cache
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// Add global node execution listener
function setupGlobalNodeOutputCache() {
    
    if (app.api) {
        
        // Listen to executed event
        app.api.addEventListener("executed", ({ detail }) => {
            const nodeId = String(detail.node); // Ensure nodeId is string
            const outputData = detail.output;
            
            
            if (nodeId && outputData && outputData.images) {
                window.globalNodeCache.set(nodeId, outputData);
                
                // Also update to app.nodeOutputs
                if (!app.nodeOutputs) {
                    app.nodeOutputs = {};
                }
                app.nodeOutputs[nodeId] = outputData;
                
                // Update node's imgs property
                const node = app.graph.getNodeById(nodeId);
                if (node && outputData.images && outputData.images.length > 0) {
                    // Convert image data to URL format
                    const convertToImageUrl = (imageData) => {
                        if (typeof imageData === 'string') {
                            return imageData;
                        }
                        if (imageData && typeof imageData === 'object' && imageData.filename) {
                            const baseUrl = window.location.origin;
                            let url = `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}`;
                            if (imageData.subfolder) {
                                url += `&subfolder=${encodeURIComponent(imageData.subfolder)}`;
                            }
                            if (imageData.type) {
                                url += `&type=${encodeURIComponent(imageData.type)}`;
                            }
                            return url;
                        }
                        return imageData;
                    };
                    
                    // Store converted image URLs to custom property, avoiding impact on original system
                    node._curveNodeImageUrls = outputData.images.map(img => convertToImageUrl(img));
                    
                    // If it's PS Curve node, save output image and trigger histogram update
                    if (node.type === "PhotoshopCurveNode") {
                        node._lastOutputImage = convertToImageUrl(outputData.images[0]);
                        
                        // 如果节点有曲线编辑器，触发直方图更新
                        if (node.curveEditor) {
                            node.curveEditor._histogramDrawn = false;
                            node.curveEditor._cachedHistogram = null;
                            node.curveEditor.drawHistogram();
                        }
                        
                        // 如果模态弹窗打开，也更新模态的直方图
                        if (node.curveEditorModal && node.curveEditorModal.isOpen && node.curveEditorModal.curveEditor) {
                            node.curveEditorModal.curveEditor._histogramDrawn = false;
                            node.curveEditorModal.curveEditor._cachedHistogram = null;
                            node.curveEditorModal.curveEditor.drawHistogram();
                        }
                    }
                }
                
                // 更新连接的下游节点缓存（支持PS Curve和HSL节点）
                const graph = app.graph;
                if (graph && graph.links) {
                    Object.values(graph.links).forEach(link => {
                        if (link && String(link.origin_id) === nodeId) {
                            const targetNode = graph.getNodeById(link.target_id);
                            // 支持PS Curve和HSL节点
                            if (targetNode && (targetNode.type === "PhotoshopCurveNode" || targetNode.type === "PhotoshopHSLNode")) {
                                if (outputData.images && outputData.images.length > 0) {
                                    const convertToImageUrl = (imageData) => {
                                        if (typeof imageData === 'string') {
                                            return imageData;
                                        }
                                        if (imageData && typeof imageData === 'object' && imageData.filename) {
                                            const baseUrl = window.location.origin;
                                            let url = `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}`;
                                            if (imageData.subfolder) {
                                                url += `&subfolder=${encodeURIComponent(imageData.subfolder)}`;
                                            }
                                            if (imageData.type) {
                                                url += `&type=${encodeURIComponent(imageData.type)}`;
                                            }
                                            return url;
                                        }
                                        return imageData;
                                    };
                                    
                                    targetNode._lastInputImage = convertToImageUrl(outputData.images[0]);
                                    
                                    // PS Curve节点需要imgs属性
                                    if (targetNode.type === "PhotoshopCurveNode" && targetNode.imgs) {
                                        // 只有在节点已经有imgs属性时才更新
                                        targetNode.imgs = outputData.images.map(imageData => ({ 
                                            src: convertToImageUrl(imageData)
                                        }));
                                    }
                                    
                                    console.log(`🎨 PS Curve节点更新了下游${targetNode.type}节点 ${targetNode.id} 的输入图像`);
                                }
                                if (outputData.masks && outputData.masks.length > 0) {
                                    targetNode._lastInputMask = outputData.masks[0];
                                }
                            }
                        }
                    });
                }
            }
        });
        
        // 监听progress事件
        app.api.addEventListener("progress", ({ detail }) => {
        });
        
        // 监听execution_cached事件
        app.api.addEventListener("execution_cached", ({ detail }) => {
            if (detail && detail.nodes) {
                detail.nodes.forEach(nodeId => {
                    const nodeIdStr = String(nodeId);
                    
                    const node = app.graph.getNodeById(nodeIdStr);
                    if (node) {
                        if (node.imgs && node.imgs.length > 0) {
                            console.log(`🎨 缓存节点 ${nodeIdStr} 已有imgs数据`);
                        } else {
                            console.log(`🎨 缓存节点 ${nodeIdStr} 需要获取输出数据`);
                            
                            // Try to get from last_node_outputs
                            if (app.graph.last_node_outputs && app.graph.last_node_outputs[nodeIdStr]) {
                                const outputs = app.graph.last_node_outputs[nodeIdStr];
                                if (outputs.images && outputs.images.length > 0) {
                                    const convertToImageUrl = (imageData) => {
                                        if (typeof imageData === 'string') {
                                            return imageData;
                                        }
                                        if (imageData && typeof imageData === 'object' && imageData.filename) {
                                            const baseUrl = window.location.origin;
                                            let url = `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}`;
                                            if (imageData.subfolder) {
                                                url += `&subfolder=${encodeURIComponent(imageData.subfolder)}`;
                                            }
                                            if (imageData.type) {
                                                url += `&type=${encodeURIComponent(imageData.type)}`;
                                            }
                                            return url;
                                        }
                                        return imageData;
                                    };
                                    
                                    // 将转换后的图像URL存储到自定义属性
                                    node._curveNodeImageUrls = outputs.images.map(img => convertToImageUrl(img));
                                    console.log(`🎨 已从last_node_outputs为缓存节点 ${nodeIdStr} 设置 _curveNodeImageUrls`);
                                    
                                    // 同时更新全局缓存
                                    window.globalNodeCache.set(nodeIdStr, outputs);
                                    if (!app.nodeOutputs) {
                                        app.nodeOutputs = {};
                                    }
                                    app.nodeOutputs[nodeIdStr] = outputs;
                                }
                            }
                        }
                    }
                });
            }
        });
        
        // 监听executing事件 - 在节点开始执行时触发
        app.api.addEventListener("executing", ({ detail }) => {
            if (detail) {
                console.log(`🎨 节点 ${detail} 开始执行`);
            }
        });
        
        // 备用方案：直接拦截WebSocket消息
        if (app.api.socket) {
            const originalOnMessage = app.api.socket.onmessage;
            app.api.socket.onmessage = function(event) {
                // 调用原始处理函数
                if (originalOnMessage) {
                    originalOnMessage.call(this, event);
                }
                
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'executed' && message.data) {
                        const nodeId = String(message.data.node); // 确保nodeId是字符串
                        const outputData = message.data.output;
                        
                        console.log(`🎨 WebSocket拦截到执行消息 - 节点 ${nodeId}:`, outputData);
                        
                        if (nodeId && outputData && outputData.images) {
                            console.log(`🎨 WebSocket全局缓存节点 ${nodeId} 的输出图像:`, outputData.images.length, "个");
                            window.globalNodeCache.set(nodeId, outputData);
                            
                            if (!app.nodeOutputs) {
                                app.nodeOutputs = {};
                            }
                            app.nodeOutputs[nodeId] = outputData;
                        }
                    }
                } catch (e) {
                    // 忽略非JSON消息
                }
            };
        }
    }
}

// 立即设置全局缓存，如果API还未准备好则延迟设置
setupGlobalNodeOutputCache();

// 延迟设置（确保API完全初始化）
setTimeout(() => {
    console.log("🎨 延迟设置全局缓存监听器...");
    setupGlobalNodeOutputCache();
}, 1000);

// 在app.setup后再次设置
if (app.setup) {
    const originalSetup = app.setup;
    app.setup = function() {
        const result = originalSetup.apply(this, arguments);
        console.log("🎨 app.setup完成后设置全局缓存监听器...");
        setupGlobalNodeOutputCache();
        return result;
    };
}

// 添加photoshop_curve_preview事件监听器
function setupPhotoshopCurvePreviewListener() {
    if (app.api) {
        console.log("🎨 设置photoshop_curve_preview事件监听器...", app.api);
        
        // 检查是否已经有同样的监听器
        if (!app.api._curvePreviewListenerAdded) {
            console.log("🎨 添加新的photoshop_curve_preview监听器");
            app.api._curvePreviewListenerAdded = true;
            
            // 监听后端发送的预览图像
            app.api.addEventListener("photoshop_curve_preview", ({ detail }) => {
            if (detail) {
                const nodeId = detail.node_id;
                const imageData = detail.image;
                const maskData = detail.mask;
                
                console.log(`🎨 收到photoshop_curve_preview事件 - 节点 ${nodeId}`);
                
                // 查找对应的节点
                const node = app.graph.getNodeById(nodeId);
                if (node && node.type === "PhotoshopCurveNode") {
                    // 存储图像数据到节点
                    node._previewImageUrl = imageData;
                    node._previewMaskUrl = maskData;
                    
                    console.log(`🎨 已存储预览图像到节点 ${nodeId}`);
                    
                    // 如果模态弹窗已打开，立即更新图像
                    if (node._curveModal && node._curveModal.isOpen) {
                        console.log("🎨 模态弹窗已打开，立即更新图像");
                        node._curveModal.setInputImage(imageData);
                        if (maskData) {
                            node._curveModal.setMaskData(maskData);
                        }
                    }
                }
            }
            });
        } else {
            console.log("🎨 photoshop_curve_preview监听器已存在，跳过添加");
        }
    } else {
        console.log("🎨 app.api不可用，无法设置photoshop_curve_preview监听器");
    }
}

// 立即设置监听器
setupPhotoshopCurvePreviewListener();

// 延迟设置（确保API完全初始化）
setTimeout(() => {
    console.log("🎨 延迟重新设置photoshop_curve_preview监听器...");
    setupPhotoshopCurvePreviewListener();
}, 1000);

// 多次延迟设置确保可靠性
setTimeout(() => {
    console.log("🎨 再次延迟设置photoshop_curve_preview监听器...");
    setupPhotoshopCurvePreviewListener();
}, 3000);

// 模态弹窗类 - 重新实现
class CurveEditorModal {
    constructor(node, options = {}) {
        console.log("🎨 创建CurveEditorModal实例");
        
        this.node = node;
        
        // 使用自适应屏幕尺寸，而不是固定尺寸
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // 计算可用的最大尺寸（考虑边距）
        const maxWidth = Math.min(1600, screenWidth * 0.95);
        const maxHeight = Math.min(1200, screenHeight * 0.95);
        
        // 使用自适应尺寸
        // 宽度和高度均为屏幕的95%
        const width = screenWidth * 0.95;  // 自适应宽度
        const height = screenHeight * 0.95; // 自适应高度
        
        // 记录实际使用的尺寸
        console.log(`🎨 屏幕尺寸: ${screenWidth}x${screenHeight}, 使用弹窗尺寸: ${width}x${height}`);
        
        // 创建选项对象，保留options中的其他属性
        this.options = { ...options };
        
        // 使用自适应的宽度和高度
        this.options.width = width;
        this.options.height = height;
        this.options.title = options.title || "Curve Editor";
        
        // 记录实际使用的尺寸
        console.log("🎨 模态弹窗尺寸:", this.options.width, "x", this.options.height);
        
        this.inputImage = null;
        this.maskData = null; // 添加遮罩数据属性
        this.isOpen = false;
        this.curveEditor = null;
        this.showMaskOverlay = false; // 添加控制遮罩显示的开关
        
        try {
            console.log("🎨 检查节点ID:", this.node.id);
            
            // 检查是否已存在相同ID的模态弹窗
            const existingModal = document.getElementById(`curve-editor-modal-${this.node.id}`);
            if (existingModal) {
                console.log("🎨 移除已存在的模态弹窗");
                existingModal.remove();
            }
            
            console.log("🎨 开始创建模态弹窗");
            // 创建新的模态弹窗
            this.createModal();
            console.log("🎨 模态弹窗创建完成");
            
            console.log("🎨 开始绑定事件");
            this.bindEvents();
            console.log("🎨 事件绑定完成");
            
            console.log("🎨 CurveEditorModal创建完成");
        } catch (error) {
            console.error("🎨 CurveEditorModal创建失败:", error);
            console.error("🎨 错误堆栈:", error.stack);
            throw error; // 重新抛出错误
        }
    }
    
    createModal() {
        console.log("🎨 创建模态弹窗");
        
        // 创建模态弹窗容器
        this.modal = document.createElement('dialog');
        this.modal.className = 'curve-editor-modal';
        
        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .curve-editor-modal {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 0;
                max-width: 90vw;
                max-height: 90vh;
                width: 1200px;
                height: 800px;
                display: flex;
                flex-direction: column;
                color: #fff;
                font-family: Arial, sans-serif;
            }
            
            .curve-editor-modal::backdrop {
                background: rgba(0, 0, 0, 0.8);
            }
            
            .curve-editor-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 20px;
                background: #2a2a2a;
                border-bottom: 1px solid #333;
            }
            
            .curve-editor-title {
                font-size: 16px;
                font-weight: bold;
                color: #fff;
            }
            
            .curve-editor-close {
                background: none;
                border: none;
                color: #fff;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            }
            
            .curve-editor-close:hover {
                background: #333;
            }
            
            .curve-editor-body {
                display: flex;
                flex: 1;
                overflow: hidden;
                padding: 20px;
                gap: 20px;
            }
            
            .preview-container {
                flex: 1.5;
                position: relative;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #2a2a2a;
                border-radius: 8px;
                overflow: hidden;
                min-width: 500px;
            }
            
            .preview-image {
                width: 100%;
                height: 100%;
                object-fit: contain;
                background: #1a1a1a;
            }
            
            .curve-editor-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                background: #2a2a2a;
                border-radius: 8px;
                padding: 20px;
                min-width: 300px;
                max-width: 400px;
            }
            
            .curve-editor-help {
                padding: 8px;
                background: #333;
                border-radius: 4px;
                margin-bottom: 10px;
                text-align: center;
                color: #fff;
                font-size: 12px;
            }
            
            .curve-editor-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 10px 20px;
                background: #2a2a2a;
                border-top: 1px solid #333;
            }
            
            .curve-editor-button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
            }
            
            .curve-editor-button.secondary {
                background: #333;
                color: #fff;
                border: 1px solid #555;
            }
            
            .curve-editor-button.secondary:hover {
                background: #444;
            }
            
            .curve-editor-button.mask-toggle-button {
                background: #333;
                color: #fff;
                border: 1px solid #555;
            }
            
            .curve-editor-button.mask-toggle-button:hover {
                background: #444;
            }
            
            .curve-editor-button.primary {
                background: #4a90e2;
                color: white;
            }
            
            .curve-editor-button.primary:hover {
                background: #357abd;
            }
            
            .curve-editor-button.secondary {
                background: #666;
                color: white;
            }
            
            .curve-editor-button.secondary:hover {
                background: #555;
            }
            
            .curve-editor-button.danger {
                background: #e25c5c;
                color: white;
            }
            
            .curve-editor-button.danger:hover {
                background: #c44c4c;
            }
        `;
        document.head.appendChild(style);
        
        // 创建标题栏
        const header = document.createElement('div');
        header.className = 'curve-editor-header';
        
        const title = document.createElement('div');
        title.className = 'curve-editor-title';
        title.textContent = 'Curve Editor';
        
        // 创建控制按钮容器
        const headerControls = document.createElement('div');
        headerControls.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;
        
        // 创建预设相关按钮
        this.createPresetControls(headerControls);
        
        // 创建遮罩显示切换按钮（只在有遮罩时显示）
        const maskToggleButton = document.createElement('button');
        maskToggleButton.className = 'curve-editor-button mask-toggle-button';
        maskToggleButton.style.cssText = `
            padding: 4px 12px;
            font-size: 12px;
            background: #333;
            border: 1px solid #555;
            display: none;
            margin-right: 10px;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
        `;
        maskToggleButton.textContent = 'Show Mask Border';
        maskToggleButton.onclick = (e) => {
            // 阻止事件冒泡和默认行为
            e.stopPropagation();
            e.preventDefault();
            
            console.log("🎨 切换遮罩显示状态");
            this.showMaskOverlay = !this.showMaskOverlay;
            maskToggleButton.textContent = this.showMaskOverlay ? 'Hide Mask Border' : 'Show Mask Border';
            
            const maskCanvas = this.modal.querySelector('.preview-mask-canvas');
            if (maskCanvas) {
                if (this.showMaskOverlay && this.originalMask) {
                    console.log("🎨 显示遮罩边界");
                    this.renderMaskOverlay();
                    maskCanvas.style.display = 'block';
                } else {
                    console.log("🎨 隐藏遮罩边界");
                    maskCanvas.style.display = 'none';
                }
            }
            
            return false; // 额外的保险，防止事件继续传播
        };
        this.maskToggleButton = maskToggleButton; // 保存引用以便后续使用
        console.log("🎨 遮罩切换按钮已创建并保存引用");
        
        const closeButton = document.createElement('button');
        closeButton.className = 'curve-editor-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.close();
        
        header.appendChild(title);
        headerControls.appendChild(maskToggleButton);
        headerControls.appendChild(closeButton);
        header.appendChild(headerControls);
        
        // 创建主体内容区
        const body = document.createElement('div');
        body.className = 'curve-editor-body';
        
        // 创建预览容器
        const previewContainer = document.createElement('div');
        previewContainer.className = 'preview-container';
        
        const previewImage = document.createElement('img');
        previewImage.className = 'preview-image';
        previewImage.style.display = 'none';
        previewContainer.appendChild(previewImage);
        
        const maskCanvas = document.createElement('canvas');
        maskCanvas.className = 'preview-mask-canvas';
        maskCanvas.style.cssText = `
            display: none;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999;
            mix-blend-mode: multiply;
            opacity: 0.5;
        `;
        previewContainer.appendChild(maskCanvas);
        
        // 创建曲线编辑器容器
        const editorContainer = document.createElement('div');
        editorContainer.className = 'curve-editor-container';
        
        // 将预览容器和编辑器容器添加到主体
        body.appendChild(previewContainer);
        body.appendChild(editorContainer);
        
        // 创建底部按钮区
        const footer = document.createElement('div');
        footer.className = 'curve-editor-footer';
        
        const resetButton = document.createElement('button');
        resetButton.className = 'curve-editor-button secondary';
        resetButton.textContent = 'Reset';
        resetButton.onclick = () => {
            if (this.curveEditor) {
                this.curveEditor.resetCurve();
                this.updatePreview();
            }
        };
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'curve-editor-button secondary';
        cancelButton.textContent = 'Cancel';
        cancelButton.onclick = () => this.cancel();
        
        const applyButton = document.createElement('button');
        applyButton.className = 'curve-editor-button primary';
        applyButton.textContent = 'Apply';
        applyButton.onclick = () => this.apply();
        
        footer.appendChild(resetButton);
        footer.appendChild(cancelButton);
        footer.appendChild(applyButton);
        
        // 组装模态弹窗
        this.modal.appendChild(header);
        this.modal.appendChild(body);
        this.modal.appendChild(footer);
        
        // 添加到文档中
        document.body.appendChild(this.modal);
        
        // 绑定事件
        this.bindEvents();
        
        // 防止 dialog 被意外关闭
        this.modal.addEventListener('cancel', (e) => {
            console.log("🎨 模态弹窗收到 cancel 事件", e);
            // 允许ESC键关闭
        });
        
        // 监听 close 事件用于调试
        this.modal.addEventListener('close', (e) => {
            console.log("🎨 模态弹窗被关闭", e);
        });
        
        console.log("🎨 模态弹窗创建完成");
    }
    
    bindEvents() {
        console.log("🎨 绑定模态弹窗事件");
        
        // 关闭按钮
        const closeBtn = this.modal.querySelector('.curve-editor-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log("🎨 关闭按钮被点击");
                this.close();
            });
        }
        
        // 取消按钮 - 使用更精确的选择器
        const cancelBtn = this.modal.querySelector('.curve-editor-footer .curve-editor-button.secondary:nth-child(2)');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                console.log("🎨 取消按钮被点击");
                this.close();
            });
        }
        
        // 应用按钮
        const applyBtn = this.modal.querySelector('.curve-editor-button.primary');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                console.log("🎨 应用按钮被点击");
                this.apply();
            });
        }
        
        // 预览缩放
        const zoomSlider = this.modal.querySelector('.preview-zoom');
        const zoomValue = this.modal.querySelector('.zoom-value');
        if (zoomSlider && zoomValue) {
            zoomSlider.addEventListener('input', (e) => {
                const zoom = parseFloat(e.target.value);
                zoomValue.textContent = `${Math.round(zoom * 100)}%`;
                
                const previewImg = this.modal.querySelector('.preview-image');
                if (previewImg) {
                    previewImg.style.transform = `scale(${zoom})`;
                }
            });
        }
        
        console.log("🎨 模态弹窗事件绑定完成");
    }
    
    async open(inputImage, maskImage) {
        console.log("🎨 开始打开模态弹窗");
        console.log("🎨 输入图像数据类型:", typeof inputImage);
        console.log("🎨 输入图像内容:", inputImage);
        console.log("🎨 遮罩数据:", maskImage ? "存在" : "不存在");
        
        if (!inputImage) {
            console.error("🎨 没有提供输入图像");
            return;
        }
        
        // 检查图像数据是否为有效的URL
        if (typeof inputImage !== 'string') {
            console.error("🎨 输入图像不是字符串类型:", typeof inputImage, inputImage);
            return;
        }
        
        if (!inputImage.startsWith('data:') && !inputImage.startsWith('http') && !inputImage.startsWith('/')) {
            console.error("🎨 输入图像不是有效的URL格式:", inputImage);
            return;
        }
        
        this.inputImage = inputImage;
        this.maskData = maskImage; // 保存遮罩数据
        this.isOpen = true;
        
        // 如果有遮罩数据，立即显示遮罩切换按钮
        if (maskImage && this.maskToggleButton) {
            console.log("🎨 检测到遮罩，显示遮罩切换按钮");
            this.maskToggleButton.style.display = 'inline-block';
        }
        
        try {
            // 显示模态弹窗
            this.modal.showModal();
            console.log("🎨 模态弹窗已显示");
            
            // 设置预览图像
            const previewImg = this.modal.querySelector('.preview-image');
            if (!previewImg) {
                console.error("🎨 找不到预览图像元素");
                return;
            }
            
            console.log("🎨 设置预览图像:", typeof inputImage === 'string' ? inputImage.substring(0, 50) + "..." : inputImage);
            
            // 预先加载图像以确保它能正确显示
            this.originalImage = new Image();
            this.originalImage.crossOrigin = "Anonymous";
            
            // 使用Promise等待图像加载
            await new Promise((resolve, reject) => {
                this.originalImage.onload = () => {
                    console.log("🎨 原始图像加载完成，尺寸:", this.originalImage.width, "x", this.originalImage.height);
                    resolve();
                };
                this.originalImage.onerror = (err) => {
                    console.error("🎨 原始图像加载失败:", err);
                    reject(err);
                };
                this.originalImage.src = inputImage;
            });
            
            // 如果有遮罩，加载遮罩图像
            if (this.maskData) {
                console.log("🎨 开始加载遮罩图像:", this.maskData.substring(0, 50) + "...");
                this.originalMask = new Image();
                this.originalMask.crossOrigin = "Anonymous";
                
                // 使用Promise等待遮罩图像加载
                await new Promise((resolve, reject) => {
                    this.originalMask.onload = () => {
                        console.log("🎨 遮罩图像加载完成，尺寸:", this.originalMask.width, "x", this.originalMask.height);
                        
                        // 显示遮罩切换按钮
                        if (this.maskToggleButton) {
                            console.log("🎨 显示遮罩切换按钮");
                            this.maskToggleButton.style.display = 'inline-block';
                        } else {
                            console.error("🎨 找不到遮罩切换按钮引用");
                        }
                        
                        // 默认不显示遮罩边界，让用户手动开启
                        const maskCanvas = this.modal.querySelector('.preview-mask-canvas');
                        if (maskCanvas) {
                            maskCanvas.style.display = 'none';
                        }
                        
                        // 添加调试 - 在控制台显示遮罩图像的前几个像素
                        try {
                            const debugCanvas = document.createElement('canvas');
                            debugCanvas.width = this.originalMask.width;
                            debugCanvas.height = this.originalMask.height;
                            const debugCtx = debugCanvas.getContext('2d');
                            debugCtx.drawImage(this.originalMask, 0, 0);
                            const maskData = debugCtx.getImageData(0, 0, 10, 10).data;
                            console.log("🎨 遮罩数据样本 (前10个像素):", Array.from(maskData).slice(0, 40));
                        } catch (e) {
                            console.error("🎨 调试遮罩数据失败:", e);
                        }
                        
                        resolve();
                    };
                    this.originalMask.onerror = (err) => {
                        console.error("🎨 遮罩图像加载失败:", err);
                        this.originalMask = null; // 清除遮罩引用
                        resolve(); // 继续执行，不因遮罩加载失败而中断
                    };
                    this.originalMask.src = this.maskData;
                }).catch(err => {
                    console.error("🎨 等待遮罩图像加载失败:", err);
                    this.originalMask = null;
                });
            }
            
            // 设置预览图像的初始显示
            previewImg.src = inputImage;
            previewImg.style.display = 'block';
            
            // 获取曲线编辑器容器
            const editorContainer = this.modal.querySelector('.curve-editor-container');
            if (!editorContainer) {
                console.error("🎨 找不到编辑器容器");
                return;
            }
            
            // 清空容器
            while (editorContainer.firstChild) {
                editorContainer.removeChild(editorContainer.firstChild);
            }
            
            // 添加操作提示 - 简化版本
            const helpTip = document.createElement('div');
            helpTip.className = 'curve-editor-help';
            helpTip.innerHTML = 'Click: Add Point | Right-click: Delete Point | Drag: Move Point | <span style="color: #4ecdc4; cursor: pointer;" onclick="this.parentElement.parentElement.querySelector(\'.quick-input-container\').style.display = this.parentElement.parentElement.querySelector(\'.quick-input-container\').style.display === \'none\' ? \'block\' : \'none\'">🎯 Numeric Input</span>';
            helpTip.style.cssText = `
                padding: 6px;
                background: #333;
                border-radius: 4px;
                margin-bottom: 8px;
                text-align: center;
                color: #fff;
                font-size: 11px;
            `;
            editorContainer.appendChild(helpTip);

            // 创建简化的快速输入区域 - 默认隐藏
            const quickInputContainer = document.createElement('div');
            quickInputContainer.className = 'quick-input-container';
            quickInputContainer.style.cssText = `
                display: none;
                background: #2a2a2a;
                border-radius: 4px;
                padding: 8px;
                margin-bottom: 6px;
                border: 1px solid #444;
            `;

            // 简化的输入行
            const inputRow = document.createElement('div');
            inputRow.style.cssText = `
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
            `;

            // 简化输入控件
            const xInput = document.createElement('input');
            xInput.type = 'number';
            xInput.min = '0';
            xInput.max = '255';
            xInput.placeholder = 'X';
            xInput.style.cssText = `
                width: 45px;
                padding: 3px 4px;
                background: #1a1a1a;
                border: 1px solid #555;
                border-radius: 2px;
                color: #fff;
                font-size: 11px;
            `;

            const yInput = document.createElement('input');
            yInput.type = 'number';
            yInput.min = '0';
            yInput.max = '255';
            yInput.placeholder = 'Y';
            yInput.style.cssText = `
                width: 45px;
                padding: 3px 4px;
                background: #1a1a1a;
                border: 1px solid #555;
                border-radius: 2px;
                color: #fff;
                font-size: 11px;
            `;

            const addBtn = document.createElement('button');
            addBtn.textContent = 'Add';
            addBtn.style.cssText = `
                padding: 3px 8px;
                background: #0078d4;
                color: #fff;
                border: none;
                border-radius: 2px;
                font-size: 11px;
                cursor: pointer;
            `;

            const batchBtn = document.createElement('button');
            batchBtn.textContent = 'Batch';
            batchBtn.style.cssText = `
                padding: 3px 8px;
                background: #6b3fa0;
                color: #fff;
                border: none;
                border-radius: 2px;
                font-size: 11px;
                cursor: pointer;
            `;

            inputRow.appendChild(document.createTextNode('Coordinates: '));
            inputRow.appendChild(xInput);
            inputRow.appendChild(document.createTextNode(','));
            inputRow.appendChild(yInput);
            inputRow.appendChild(addBtn);
            inputRow.appendChild(batchBtn);
            quickInputContainer.appendChild(inputRow);
            editorContainer.appendChild(quickInputContainer);
            
            // 创建曲线编辑器
            console.log("🎨 在模态弹窗中创建曲线编辑器");
            
            // 计算编辑器容器的尺寸
            const containerWidth = editorContainer.clientWidth - 20; // 减去padding
            const containerHeight = editorContainer.clientHeight - 100; // 减去其他元素的高度
            
            // 创建一个新的曲线编辑器实例，专门用于模态弹窗
            // 创建一个假节点对象，但需要包含必要的widgets
            const fakeNode = {
                id: this.node.id + '_modal',
                widgets: [],
                graph: null // 没有graph，避免触发更新
            };
            
            // 添加必要的widget以便曲线编辑器能正确初始化
            fakeNode.widgets.push({
                name: 'RGB Curve',
                value: '[[0,0],[255,255]]',
                type: 'string'
            });
            fakeNode.widgets.push({
                name: 'R Curve',
                value: '[[0,0],[255,255]]',
                type: 'string'
            });
            fakeNode.widgets.push({
                name: 'G Curve',
                value: '[[0,0],[255,255]]',
                type: 'string'
            });
            fakeNode.widgets.push({
                name: 'B Curve',
                value: '[[0,0],[255,255]]',
                type: 'string'
            });
            
            const modalCurveEditor = new PhotoshopCurveNodeWidget(fakeNode, {
                addToNode: false,
                isModal: true,
                width: containerWidth,
                height: containerHeight,
                style: {
                    backgroundColor: '#1a1a1a',
                    borderRadius: '4px',
                    padding: '10px',
                    margin: '0 auto',
                    display: 'block'
                },
                svgStyle: {
                    background: '#1a1a1a',
                    borderRadius: '4px',
                    display: 'block',
                    margin: '0 auto',
                    cursor: 'crosshair'
                },
                pointStyle: {
                    fill: '#fff',
                    stroke: '#000',
                    strokeWidth: '2',
                    cursor: 'pointer'
                },
                curveStyle: {
                    stroke: '#0ff',
                    strokeWidth: '2',
                    fill: 'none'
                },
                gridStyle: {
                    stroke: '#444',
                    strokeWidth: '1.5'
                }
            });
            
            // 设置真实节点引用，以便访问输出图像
            modalCurveEditor.realNode = this.node;
            
            // 设置对模态弹窗的引用，以便访问原始图像
            modalCurveEditor.node.curveEditorModal = this;
            
            this.curveEditor = modalCurveEditor;
            
            // 保存真实节点的引用
            this.realNode = this.node;
            
            // 同步原始编辑器的曲线数据到模态编辑器
            if (this.node.curveEditor && this.node.curveEditor.channelCurves) {
                console.log("🎨 同步原始编辑器曲线数据到模态编辑器");
                
                // 复制通道曲线数据
                modalCurveEditor.channelCurves = JSON.parse(JSON.stringify(this.node.curveEditor.channelCurves));
                
                // 设置RGB通道为当前通道的控制点（弹窗总是从RGB开始）
                modalCurveEditor.currentChannel = 'RGB';
                modalCurveEditor.controlPoints = modalCurveEditor.channelCurves['RGB'].map(p => ({x: p[0], y: p[1]}));
                
                console.log("🎨 模态编辑器初始通道: RGB");
                console.log("🎨 模态编辑器通道曲线数据:", modalCurveEditor.channelCurves);
            }
            
            // 将曲线编辑器的容器添加到模态弹窗中
            if (modalCurveEditor.container) {
                editorContainer.appendChild(modalCurveEditor.container);
                
                // 确保曲线编辑器被正确初始化
                if (modalCurveEditor.drawCurve) {
                    modalCurveEditor.drawCurve();
                }
                
                // 尝试绘制直方图（如果有图像可用）
                if (modalCurveEditor.drawHistogram) {
                    setTimeout(() => {
                        modalCurveEditor.drawHistogram();
                    }, 100);
                }
                
                // 添加曲线编辑器的事件监听
                this.setupEditorEvents();
            } else {
                console.error("🎨 曲线编辑器容器未创建");
            }
            
            // 立即更新预览
            await this.updatePreview();
            
            console.log("🎨 模态弹窗打开完成");
        } catch (error) {
            console.error("🎨 打开模态弹窗失败:", error);
        }
    }
    
    // 添加新方法，设置曲线编辑器事件
    setupEditorEvents() {
        if (!this.curveEditor) {
            console.error("🎨 无法设置事件: 曲线编辑器不存在");
            return;
        }
        
        console.log("🎨 设置曲线编辑器事件");
        
        // 保存原始的updatePointsWidget方法
        const originalUpdatePointsWidget = this.curveEditor.updatePointsWidget;
        
        // 覆盖updatePointsWidget方法，添加预览更新
        this.curveEditor.updatePointsWidget = () => {
            // 调用原始方法
            originalUpdatePointsWidget.call(this.curveEditor);
            
            // 延迟一点更新预览，确保curveEditor状态已更新
            setTimeout(() => {
                this.updatePreview();
            }, 10);
        };
        
        // 保存原始的drawCurve方法
        const originalDrawCurve = this.curveEditor.drawCurve;
        
        // 添加防抖定时器
        let updatePreviewTimer = null;
        
        // 添加防止无限循环的标志
        let isUpdatingPreview = false;
        
        // 覆盖drawCurve方法，添加防抖的预览更新
        this.curveEditor.drawCurve = (...args) => {
            // 调用原始方法
            originalDrawCurve.apply(this.curveEditor, args);
            
            // 防止无限循环：如果正在更新预览，不再触发新的预览更新
            if (isUpdatingPreview) {
                console.log("🎨 防止drawCurve无限循环，跳过预览更新");
                return;
            }
            
            // 使用防抖机制更新预览，避免拖动时频繁更新
            if (updatePreviewTimer) {
                clearTimeout(updatePreviewTimer);
            }
            updatePreviewTimer = setTimeout(() => {
                isUpdatingPreview = true;
                try {
                    this.updatePreview();
                } finally {
                    isUpdatingPreview = false;
                }
            }, 100); // 100ms 防抖延迟
        };
        
        // 监听控制点相关事件
        if (this.curveEditor.svg) {
            // 鼠标移动事件结束时更新预览
            const originalOnMouseUp = this.curveEditor.onMouseUp;
            this.curveEditor.onMouseUp = (e) => {
                if (originalOnMouseUp) {
                    originalOnMouseUp.call(this.curveEditor, e);
                }
                // 延迟更新预览，确保状态已更新
                setTimeout(() => {
                    this.updatePreview();
                }, 20);
            };
            
            // 添加/删除点时更新预览
            const originalAddPoint = this.curveEditor.addPoint;
            if (originalAddPoint) {
                this.curveEditor.addPoint = (pos) => {
                    originalAddPoint.call(this.curveEditor, pos);
                    this.updatePreview();
                };
            }
            
            const originalRemovePoint = this.curveEditor.removePoint;
            if (originalRemovePoint) {
                this.curveEditor.removePoint = (index) => {
                    originalRemovePoint.call(this.curveEditor, index);
                    this.updatePreview();
                };
            }
            
            // 重置曲线时更新预览
            const originalResetCurve = this.curveEditor.resetCurve;
            if (originalResetCurve) {
                this.curveEditor.resetCurve = () => {
                    originalResetCurve.call(this.curveEditor);
                    this.updatePreview();
                };
            }
        }
        
        // 监听通道选择变化
        if (this.curveEditor.channelButtons) {
            const originalSelectChannel = this.curveEditor.selectChannel;
            if (originalSelectChannel) {
                // 覆盖selectChannel方法
                this.curveEditor.selectChannel = (channelId) => {
                    console.log(`🎨 弹窗内切换到通道: ${channelId}`);
                    console.log(`🎨 切换前currentChannel: ${this.curveEditor.currentChannel}`);
                    
                    // 手动执行selectChannel的逻辑，确保正确的上下文
                    const curveEditor = this.curveEditor;
                    
                    // Save current channel的曲线
                    if (curveEditor.channelCurves && curveEditor.currentChannel) {
                        curveEditor.channelCurves[curveEditor.currentChannel] = curveEditor.controlPoints.map(p => [p.x, p.y]);
                    }
                    
                    // 切换到新通道
                    curveEditor.currentChannel = channelId;
                    console.log(`🎨 手动设置后currentChannel: ${curveEditor.currentChannel}`);
                    
                    // 清除直方图缓存，确保切换通道时重新绘制
                    curveEditor._histogramDrawn = false;
                    curveEditor._lastHistogramChannel = null;
                    
                    // Update channel button state
                    if (typeof curveEditor.updateChannelButtons === 'function') {
                        curveEditor.updateChannelButtons();
                    }
                    
                    // 加载新通道的曲线
                    if (curveEditor.channelCurves && curveEditor.channelCurves[channelId]) {
                        curveEditor.controlPoints = curveEditor.channelCurves[channelId].map(p => ({x: p[0], y: p[1]}));
                    }
                    
                    // 确保调用原始的drawCurve方法，而不是被覆盖的版本
                    console.log(`🎨 调用drawCurve前的currentChannel: ${curveEditor.currentChannel}`);
                    
                    // 临时保存被覆盖的方法
                    const overriddenDrawCurve = curveEditor.drawCurve;
                    
                    // 临时恢复原始方法
                    curveEditor.drawCurve = originalDrawCurve;
                    
                    try {
                        // 调用原始的drawCurve
                        curveEditor.drawCurve();
                        console.log(`🎨 原始drawCurve调用完成，当前通道: ${curveEditor.currentChannel}`);
                    } finally {
                        // 恢复被覆盖的方法
                        curveEditor.drawCurve = overriddenDrawCurve;
                    }
                    
                    // 检查所有通道是否都为默认对角线，如果是则不更新预览
                    const allChannelsDefault = this.areAllChannelsDefault();
                    console.log("🎨 所有通道是否为默认状态:", allChannelsDefault);
                    
                    if (!allChannelsDefault) {
                        this.updatePreview();
                    }
                };
                
                // 重新绑定通道按钮的点击事件
                Object.entries(this.curveEditor.channelButtons).forEach(([channelId, button]) => {
                    // 移除旧的事件监听器
                    const newButton = button.cloneNode(true);
                    button.parentNode.replaceChild(newButton, button);
                    this.curveEditor.channelButtons[channelId] = newButton;
                    
                    // 添加新的事件监听器
                    newButton.addEventListener('click', () => {
                        console.log(`🎨 通道按钮被点击: ${channelId}`);
                        this.curveEditor.selectChannel(channelId);
                    });
                    
                    // 保留悬停效果
                    newButton.addEventListener('mouseenter', () => {
                        if (!newButton.classList.contains('active')) {
                            newButton.style.transform = 'scale(1.1)';
                            newButton.style.borderColor = '#4ecdc4';
                        }
                    });
                    
                    newButton.addEventListener('mouseleave', () => {
                        if (!newButton.classList.contains('active')) {
                            newButton.style.transform = 'scale(1)';
                            newButton.style.borderColor = '#444';
                        }
                    });
                });
            }
        }
        
        console.log("🎨 曲线编辑器事件设置完成");
        
        // 设置数值输入功能
        this.setupPointInputControls();
    }
    
    // 检查是否为默认对角线曲线
    isDefaultDiagonalCurve(points) {
        // 默认对角线应该只有两个点：(0,0) 和 (255,255)
        if (!points || points.length !== 2) {
            return false;
        }
        
        const tolerance = 1; // 允许1像素的误差
        const firstPoint = points[0];
        const lastPoint = points[1];
        
        return (
            Math.abs(firstPoint.x - 0) <= tolerance &&
            Math.abs(firstPoint.y - 0) <= tolerance &&
            Math.abs(lastPoint.x - 255) <= tolerance &&
            Math.abs(lastPoint.y - 255) <= tolerance
        );
    }
    
    // 检查所有通道是否都为默认对角线
    areAllChannelsDefault() {
        if (!this.curveEditor || !this.curveEditor.channelCurves) {
            return true; // 如果没有数据，认为是默认状态
        }
        
        const channels = ['RGB', 'R', 'G', 'B'];
        
        for (const channel of channels) {
            const curveData = this.curveEditor.channelCurves[channel];
            if (!curveData) continue;
            
            // 将数组格式转换为点对象格式
            const points = curveData.map(p => ({x: p[0], y: p[1]}));
            
            const isDefault = this.isDefaultDiagonalCurve(points);
            console.log(`🎨 检查通道 ${channel} 是否为默认状态:`, isDefault, points);
            
            if (!isDefault) {
                console.log(`🎨 通道 ${channel} 不是默认状态，阻止预览更新`);
                return false; // 有任何一个通道不是默认状态
            }
        }
        
        console.log("🎨 所有通道都是默认状态，跳过预览更新");
        return true; // 所有通道都是默认状态
    }
    
    // 设置简化的数值输入功能
    setupPointInputControls() {
        console.log("🎨 设置简化数值输入控件");
        
        // 获取简化的输入控件
        const quickContainer = this.modal.querySelector('.quick-input-container');
        if (!quickContainer) {
            console.error("🎨 无法找到快速输入容器");
            return;
        }
        
        const inputs = quickContainer.querySelectorAll('input[type="number"]');
        const xInput = inputs[0];
        const yInput = inputs[1];
        const buttons = quickContainer.querySelectorAll('button');
        const addBtn = buttons[0];
        const batchBtn = buttons[1];
        
        if (!xInput || !yInput || !addBtn || !batchBtn) {
            console.error("🎨 无法找到输入控件");
            return;
        }
        
        // 添加点功能 - 简化版
        const addPointFromInput = () => {
            if (!this.curveEditor) return;
            
            const x = parseInt(xInput.value);
            const y = parseInt(yInput.value);
            
            if (isNaN(x) || isNaN(y) || x < 0 || x > 255 || y < 0 || y > 255) {
                alert('Please enter valid coordinates (0-255)');
                return;
            }
            
            // 检查重复X坐标
            const existingPoint = this.curveEditor.controlPoints.find(p => Math.abs(p.x - x) < 2);
            if (existingPoint) {
                existingPoint.y = y;
            } else {
                this.curveEditor.controlPoints.push({x, y});
                this.curveEditor.controlPoints.sort((a, b) => a.x - b.x);
            }
            
            // 更新通道数据
            if (this.curveEditor.channelCurves && this.curveEditor.currentChannel) {
                this.curveEditor.channelCurves[this.curveEditor.currentChannel] = 
                    this.curveEditor.controlPoints.map(p => [p.x, p.y]);
            }
            
            this.curveEditor.drawCurve();
            this.updatePreview();
            
            // 清空输入框
            xInput.value = '';
            yInput.value = '';
            
            console.log(`🎨 添加控制点: (${x}, ${y})`);
        };
        
        // 批量输入功能 - 保持原有
        const openBatchInput = () => {
            const currentPoints = this.curveEditor.controlPoints.map(p => `${p.x},${p.y}`).join(';');
            const input = prompt(
                'Batch Input Control Points\nFormat: x1,y1;x2,y2;x3,y3...\nExample: 0,0;64,80;128,128;192,200;255,255',
                currentPoints
            );
            
            if (input === null) return;
            
            try {
                const points = input.split(';').map(pointStr => {
                    const [x, y] = pointStr.trim().split(',').map(v => parseInt(v.trim()));
                    if (isNaN(x) || isNaN(y) || x < 0 || x > 255 || y < 0 || y > 255) {
                        throw new Error(`Invalid coordinates: ${pointStr}`);
                    }
                    return {x, y};
                });
                
                if (points.length < 2) {
                    throw new Error('At least 2 control points required');
                }
                
                points.sort((a, b) => a.x - b.x);
                this.curveEditor.controlPoints = points;
                
                if (this.curveEditor.channelCurves && this.curveEditor.currentChannel) {
                    this.curveEditor.channelCurves[this.curveEditor.currentChannel] = 
                        this.curveEditor.controlPoints.map(p => [p.x, p.y]);
                }
                
                this.curveEditor.drawCurve();
                this.updatePreview();
                
                console.log(`🎨 批量设置: ${points.length}个点`);
                
            } catch (error) {
                alert(`Input error: ${error.message}`);
            }
        };
        
        // 绑定事件
        addBtn.onclick = addPointFromInput;
        batchBtn.onclick = openBatchInput;
        
        // 回车键添加点
        xInput.onkeypress = yInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                addPointFromInput();
            }
        };
        
        console.log("🎨 简化数值输入控件设置完成");
    }
    
    async updatePreview() {
        console.log("🎨 开始更新预览图像");
        
        if (!this.inputImage || !this.node) {
            console.error("🎨 预览更新失败: 没有输入图像或节点");
            return;
        }
        
        try {
            // 获取当前曲线设置 - 从curveEditor获取
            if (!this.curveEditor) {
                console.error("🎨 没有curveEditor实例");
                return;
            }
            
            // 获取当前通道和对应的曲线数据
            const channel = this.curveEditor.currentChannel || 'RGB';
            const curvePoints = this.curveEditor.controlPoints || [{x: 0, y: 0}, {x: 255, y: 255}];
            const curveType = this.node.widgets.find(w => w.name === 'curve_type')?.value || 'cubic';
            
            console.log(`🎨 预览参数: 通道=${channel}, 插值=${curveType}, 点数=${curvePoints.length}`);
            
            // 获取预览图像元素
            const previewImg = this.modal.querySelector('.preview-image');
            if (!previewImg) {
                console.error("🎨 预览更新失败: 找不到预览图像元素");
                return;
            }
            
            // 确保预览容器可见
            const previewWrapper = this.modal.querySelector('.preview-container');
            if (previewWrapper) {
                previewWrapper.style.position = 'relative';
                previewWrapper.style.display = 'flex';
                previewWrapper.style.visibility = 'visible';
                previewWrapper.style.opacity = '1';
            }
            
            // 确保原始图像已加载
            if (!this.originalImage || !this.originalImage.complete || this.originalImage.naturalWidth === 0) {
                console.log("🎨 重新加载原始图像");
                this.originalImage = new Image();
                this.originalImage.crossOrigin = "Anonymous";
                
                // 使用Promise等待图像加载
                await new Promise((resolve, reject) => {
                    this.originalImage.onload = () => {
                        console.log("🎨 原始图像加载完成，尺寸:", this.originalImage.width, "x", this.originalImage.height);
                        resolve();
                    };
                    this.originalImage.onerror = (err) => {
                        console.error("🎨 原始图像加载失败:", err);
                        reject(err);
                    };
                    // 添加时间戳防止缓存
                    this.originalImage.src = this.inputImage + (this.inputImage.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
                }).catch(err => {
                    console.error("🎨 等待原始图像加载失败:", err);
                    // 显示占位图像
                    previewImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
                    previewImg.style.display = 'block';
                    return;
                });
            }
            
            // 应用效果
            this.applyPreviewEffect(curvePoints, curveType, channel);
            
            // 注意：直方图更新已移到applyPreviewEffect的onload回调中
            // 以确保基于更新后的图像计算直方图
            
        } catch (error) {
            console.error("🎨 预览更新失败:", error);
            
            // 尝试恢复显示
            try {
                const previewImg = this.modal.querySelector('.preview-image');
                if (previewImg) {
                    previewImg.src = this.inputImage || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
                    previewImg.style.display = 'block';
                }
                
                const previewWrapper = this.modal.querySelector('.preview-container');
                if (previewWrapper) {
                    previewWrapper.style.position = 'relative';
                    previewWrapper.style.display = 'flex';
                    previewWrapper.style.visibility = 'visible';
                }
            } catch (e) {
                console.error("🎨 恢复预览显示失败:", e);
            }
        }
    }
    
    // 新增方法：应用预览效果
    applyPreviewEffect(curvePoints, curveType, channel) {
            console.log("🎨 应用预览效果，参数:", {curvePoints, curveType, channel});
            
        if (!this.originalImage) {
            console.error("🎨 没有原始图像可用");
            return;
        }
        
        // 保存this引用，以便在回调中使用
        const modalInstance = this;
        
        try {
            // 获取预览图像元素
            const previewImg = this.modal.querySelector('.preview-image');
            if (!previewImg) {
                console.error("🎨 找不到预览图像元素");
                return;
            }
            
            // 获取预览容器
            const previewWrapper = this.modal.querySelector('.preview-container');
            
            // 创建画布以处理图像
            const canvas = document.createElement('canvas');
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            
            console.log("🎨 Canvas尺寸:", canvas.width, "x", canvas.height);
            
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            // 将原始图像绘制到画布上
            ctx.drawImage(this.originalImage, 0, 0);
            
            // 获取图像数据以便处理
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // curvePoints已经是对象数组，直接使用
            const points = curvePoints;
            
            // 检查是否有遮罩图像
            const hasMask = this.originalMask !== null && this.originalMask !== undefined;
            let maskCtx = null;
            
            // 如果有遮罩，创建遮罩画布
            if (hasMask) {
                console.log("🎨 检测到遮罩数据，准备处理遮罩");
                
                // 创建遮罩画布
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = canvas.width;
                maskCanvas.height = canvas.height;
                maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
                
                // 绘制遮罩
                maskCtx.drawImage(this.originalMask, 0, 0);
                
                try {
                    // 尝试获取遮罩数据以验证其可用性
                    const testData = maskCtx.getImageData(0, 0, 1, 1);
                    if (testData) {
                        console.log("🎨 成功获取遮罩数据");
                    }
                } catch (e) {
                    console.error("🎨 无法获取遮罩数据:", e);
                    maskCtx = null;
                }
            }
            
            // 应用曲线调整
            console.log("🎨 图像数据大小:", data.length);
            
            // 创建查找表 - 使用传入的curveType参数
            const lookupTable = this.createLookupTable(points, curveType);
            
            // 调试输出
            console.log(`🎨 处理通道: ${channel}, 控制点数: ${points.length}`);
            console.log(`🎨 控制点:`, points);
            console.log(`🎨 LUT前5个值:`, lookupTable.slice(0, 5));
            console.log(`🎨 LUT后5个值:`, lookupTable.slice(-5));
            
            // 检查是否为恒等曲线
            let isIdentity = true;
            for (let i = 0; i < 256; i++) {
                if (Math.abs(lookupTable[i] - i) > 1) {
                    isIdentity = false;
                    break;
                }
            }
            console.log(`🎨 是否为恒等曲线: ${isIdentity}`);
            
            // 如果是恒等曲线并且没有遮罩，直接显示原图
            if (isIdentity && !hasMask) {
                console.log("🎨 检测到恒等曲线且无遮罩，直接显示原图");
                previewImg.src = this.inputImage;
                previewImg.style.display = 'block';
                return;
            }
            
            // 应用查找表到图像数据
            if (channel === 'RGB') {
                // 应用到所有颜色通道
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = lookupTable[data[i]];         // R
                    data[i + 1] = lookupTable[data[i + 1]]; // G
                    data[i + 2] = lookupTable[data[i + 2]]; // B
                }
            } else if (channel === 'R') {
                // 只应用到红色通道
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = lookupTable[data[i]]; // R
                }
            } else if (channel === 'G') {
                // 只应用到绿色通道
                for (let i = 0; i < data.length; i += 4) {
                    data[i + 1] = lookupTable[data[i + 1]]; // G
                }
            } else if (channel === 'B') {
                // 只应用到蓝色通道
                for (let i = 0; i < data.length; i += 4) {
                    data[i + 2] = lookupTable[data[i + 2]]; // B
                }
            }
            
            console.log(`🎨 处理了 ${data.length/4} 个像素`);
            
            // 将处理后的数据放回画布
            ctx.putImageData(imageData, 0, 0);
            
            // 处理遮罩混合
            if (hasMask && maskCtx) {
                console.log("🎨 使用遮罩混合原始图像和处理后的图像");
                
                // 1. 准备画布和上下文
                // 原始图像
                const originalCanvas = document.createElement('canvas');
                originalCanvas.width = canvas.width;
                originalCanvas.height = canvas.height;
                const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
                originalCtx.drawImage(this.originalImage, 0, 0);
                
                // 最终输出
                const outputCanvas = document.createElement('canvas');
                outputCanvas.width = canvas.width;
                outputCanvas.height = canvas.height;
                const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true });
                
                // 2. 获取图像数据
                // 原始图像数据
                const originalImageData = originalCtx.getImageData(0, 0, canvas.width, canvas.height);
                const originalData = originalImageData.data;
                
                // 处理后的图像数据
                const processedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const processedData = processedImageData.data;
                
                // 遮罩数据
                const maskImageData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
                const maskData = maskImageData.data;
                
                // 输出图像数据
                const outputImageData = outputCtx.createImageData(canvas.width, canvas.height);
                const outputData = outputImageData.data;
                
                // 3. 分析遮罩
                console.log("🎨 遮罩数据大小:", maskData.length);
                console.log("🎨 遮罩数据样本 (前40个值):", Array.from(maskData).slice(0, 40));
                
                // 检查遮罩类型
                let transparentMaskPixels = 0;
                let nonWhitePixels = 0;
                
                // 遍历样本像素分析遮罩特性
                for (let i = 0; i < Math.min(4000, maskData.length); i += 4) {
                    // 检查是否有透明像素 (Alpha < 255)
                    if (maskData[i + 3] < 255) {
                        transparentMaskPixels++;
                    }
                    
                    // 检查是否有非白色像素
                    if (maskData[i] < 255 || maskData[i + 1] < 255 || maskData[i + 2] < 255) {
                        nonWhitePixels++;
                    }
                }
                
                console.log("🎨 遮罩分析: 透明像素数=", transparentMaskPixels, "非白像素数=", nonWhitePixels);
                
                // 4. 确定遮罩处理策略
                // 测试多种混合策略找出最适合的一种
                
                // 计算遮罩像素的平均亮度
                let totalLuminance = 0;
                let sampleCount = Math.min(4000, maskData.length / 4);
                
                for (let i = 0; i < sampleCount * 4; i += 4) {
                    totalLuminance += (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
                }
                
                const avgLuminance = totalLuminance / sampleCount;
                console.log("🎨 遮罩平均亮度:", avgLuminance.toFixed(3), "透明像素数:", transparentMaskPixels, "非白像素数:", nonWhitePixels);
                
                // 调试模式：直接显示遮罩本身，按顺序测试不同的可视化模式
                const DEBUG_MASK = false; // 设置为true启用调试模式
                const DEBUG_MODE = 0; // 0=遮罩亮度，1=反转遮罩亮度，2=原始遮罩
                
                if (DEBUG_MASK) {
                    console.log("🎨 调试模式: 显示遮罩本身，模式=", DEBUG_MODE);
                    
                    // 创建一个用于显示遮罩的canvas
                    const debugCanvas = document.createElement('canvas');
                    debugCanvas.width = canvas.width;
                    debugCanvas.height = canvas.height;
                    const debugCtx = debugCanvas.getContext('2d', { willReadFrequently: true });
                    
                    // 获取遮罩数据
                    const debugData = new Uint8ClampedArray(maskData.length);
                    
                    // 转换遮罩数据为可视格式
                    for (let i = 0; i < maskData.length; i += 4) {
                        const luminance = (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114);
                        
                        if (DEBUG_MODE === 0) {
                            // 模式0: 显示亮度
                            debugData[i] = luminance;
                            debugData[i + 1] = luminance;
                            debugData[i + 2] = luminance;
                        } else if (DEBUG_MODE === 1) {
                            // 模式1: 显示反转亮度
                            debugData[i] = 255 - luminance;
                            debugData[i + 1] = 255 - luminance;
                            debugData[i + 2] = 255 - luminance;
                        } else {
                            // 模式2: 原始遮罩
                            debugData[i] = maskData[i];
                            debugData[i + 1] = maskData[i + 1];
                            debugData[i + 2] = maskData[i + 2];
                        }
                        
                        debugData[i + 3] = 255; // 完全不透明
                    }
                    
                    // 创建图像数据并显示
                    const debugImageData = new ImageData(debugData, canvas.width, canvas.height);
                    debugCtx.putImageData(debugImageData, 0, 0);
                    
                    // 将调试遮罩图像转换为数据URL并显示
                    try {
                        const dataURL = debugCanvas.toDataURL('image/jpeg', 0.9);
                        previewImg.src = dataURL;
                        previewImg.style.display = 'block';
                        console.log("🎨 显示遮罩调试图像");
                        return; // 直接返回，不进行正常处理
                    } catch (e) {
                        console.error("🎨 无法创建遮罩调试图像:", e);
                    }
                }
                
                // 根据遮罩特性选择最佳策略
                let usedStrategy = "";
                
                // 策略D: 黑色遮罩区域的特殊处理 (黑色区域为遮罩，白色区域为背景)
                if (nonWhitePixels > 10 && avgLuminance > 0.9) {
                    usedStrategy = "D";
                    console.log("🎨 使用策略D: 颜色遮罩 (白色区域为有效遮罩)");
                    
                    // 创建一个副本canvas用于反转图像
                    const invertedMaskCanvas = document.createElement('canvas');
                    invertedMaskCanvas.width = canvas.width;
                    invertedMaskCanvas.height = canvas.height;
                    const invertedMaskCtx = invertedMaskCanvas.getContext('2d', { willReadFrequently: true });
                    
                    // 绘制原始遮罩
                    invertedMaskCtx.drawImage(this.originalMask, 0, 0);
                    
                    // 获取遮罩数据
                    const invertedMaskData = invertedMaskCtx.getImageData(0, 0, canvas.width, canvas.height);
                    const invertedData = invertedMaskData.data;
                    
                    // 逐像素处理
                    let nonZeroMaskCount = 0;
                    
                    for (let i = 0; i < processedData.length; i += 4) {
                        // 计算像素亮度 (0-1范围)
                        const pixelLuminance = (invertedData[i] * 0.299 + invertedData[i + 1] * 0.587 + invertedData[i + 2] * 0.114) / 255;
                        
                        // 修复：白色区域应该应用曲线调整，黑色区域保持原图
                        // 亮度值越高，遮罩效果越强
                        const maskFactor = pixelLuminance; // 直接使用亮度作为因子
                        
                        if (maskFactor > 0.5) {
                            nonZeroMaskCount++;
                        }
                        
                        // 混合原始图像和处理后的图像
                        // 使用 maskFactor 作为处理图像的权重
                        // 增强遮罩区域的对比度，使其变化更加明显
                        const enhancedFactor = Math.pow(maskFactor, 0.6); // 增强遮罩效果
                        outputData[i] = originalData[i] * (1 - enhancedFactor) + processedData[i] * enhancedFactor; // R
                        outputData[i + 1] = originalData[i + 1] * (1 - enhancedFactor) + processedData[i + 1] * enhancedFactor; // G
                        outputData[i + 2] = originalData[i + 2] * (1 - enhancedFactor) + processedData[i + 2] * enhancedFactor; // B
                        outputData[i + 3] = 255; // 完全不透明
                    }
                    
                    console.log("🎨 策略D: 有效遮罩像素数:", nonZeroMaskCount);
                }
                // 策略A: 如果是全白遮罩但有透明度，使用反转的Alpha通道
                else if (nonWhitePixels < 10 && transparentMaskPixels > 0) {
                    usedStrategy = "A";
                    console.log("🎨 使用策略A: Alpha通道作为遮罩 (不透明区域应用调整)");
                    
                    let nonZeroMaskCount = 0;
                    
                    // 逐像素混合
                    for (let i = 0; i < processedData.length; i += 4) {
                        // 修复：直接使用Alpha值作为混合因子
                        const alphaMask = maskData[i + 3] / 255.0;
                        
                        if (alphaMask > 0.01) {
                            nonZeroMaskCount++;
                        }
                        
                        // 混合原始图像和处理后的图像
                        outputData[i] = originalData[i] * (1 - alphaMask) + processedData[i] * alphaMask; // R
                        outputData[i + 1] = originalData[i + 1] * (1 - alphaMask) + processedData[i + 1] * alphaMask; // G
                        outputData[i + 2] = originalData[i + 2] * (1 - alphaMask) + processedData[i + 2] * alphaMask; // B
                        outputData[i + 3] = 255; // 完全不透明
                    }
                    
                    console.log("🎨 策略A: 非零遮罩值计数:", nonZeroMaskCount);
                } 
                // 策略B: 如果有非白像素，使用亮度作为遮罩
                else if (nonWhitePixels > 10) {
                    usedStrategy = "B";
                    console.log("🎨 使用策略B: 亮度作为遮罩 (白色区域应用调整)");
                    
                    // 记录一些遮罩像素的亮度值，用于调试
                    const maskLuminanceValues = [];
                    
                    // 逐像素混合
                    for (let i = 0; i < processedData.length; i += 4) {
                        // 使用亮度作为混合因子 (非白色区域应该是遮罩区域)
                        // 白色亮度为1，黑色亮度为0
                        const maskLuminance = (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
                        
                        // 修复：白色区域应该应用曲线调整，黑色区域保持原图
                        // 白色(亮度=1)区域应该应用处理，黑色(亮度=0)区域保持原图
                        const maskFactor = maskLuminance; // 直接使用亮度作为因子
                        
                        // 收集样本数据用于调试
                        if (i < 4000 && maskFactor > 0.1) {
                            maskLuminanceValues.push({
                                pos: i/4,
                                luminance: maskLuminance,
                                factor: maskFactor,
                                color: [maskData[i], maskData[i+1], maskData[i+2]]
                            });
                        }
                        
                        // 混合原始图像和处理后的图像
                        // 使用 maskFactor 作为处理图像的权重
                        // 增强遮罩区域的对比度，使其变化更加明显
                        const enhancedFactor = Math.pow(maskFactor, 0.6); // 增强遮罩效果
                        outputData[i] = originalData[i] * (1 - enhancedFactor) + processedData[i] * enhancedFactor; // R
                        outputData[i + 1] = originalData[i + 1] * (1 - enhancedFactor) + processedData[i + 1] * enhancedFactor; // G
                        outputData[i + 2] = originalData[i + 2] * (1 - enhancedFactor) + processedData[i + 2] * enhancedFactor; // B
                        outputData[i + 3] = 255; // 完全不透明
                    }
                    
                    // 打印收集的样本数据
                    if (maskLuminanceValues.length > 0) {
                        console.log("🎨 遮罩亮度样本(有效遮罩区域):", maskLuminanceValues.slice(0, 5));
                    } else {
                        console.log("🎨 没有找到有效的遮罩区域(亮度因子>0.1)");
                    }
                } 
                // 策略C: 直接使用Alpha通道作为遮罩
                else {
                    usedStrategy = "C";
                    console.log("🎨 使用策略C: Alpha通道作为遮罩");
                    
                    let nonZeroMaskCount = 0;
                    
                    // 逐像素混合
                    for (let i = 0; i < processedData.length; i += 4) {
                        // 使用Alpha通道作为混合因子
                        const alphaMask = maskData[i + 3] / 255.0;
                        
                        if (alphaMask > 0.01) {
                            nonZeroMaskCount++;
                        }
                        
                        // 混合原始图像和处理后的图像
                        outputData[i] = originalData[i] * (1 - alphaMask) + processedData[i] * alphaMask; // R
                        outputData[i + 1] = originalData[i + 1] * (1 - alphaMask) + processedData[i + 1] * alphaMask; // G
                        outputData[i + 2] = originalData[i + 2] * (1 - alphaMask) + processedData[i + 2] * alphaMask; // B
                        outputData[i + 3] = 255; // 完全不透明
                    }
                    
                    console.log("🎨 策略C: 非满值遮罩计数:", nonZeroMaskCount);
                }
                
                // 5. 将处理结果应用到输出canvas
                outputCtx.putImageData(outputImageData, 0, 0);
                
                // 6. 转换为dataURL并显示
                try {
                    const dataURL = outputCanvas.toDataURL('image/jpeg', 0.9);
                    
                    previewImg.onload = () => {
                        console.log("🎨 带遮罩的预览图像已更新，使用策略", usedStrategy);
                        previewImg.style.display = 'block';
                        
                        if (previewWrapper) {
                            previewWrapper.style.display = 'flex';
                            previewWrapper.style.visibility = 'visible';
                            previewWrapper.style.opacity = '1';
                        }
                        
                        // 只在用户开启遮罩显示时渲染
                        if (this.showMaskOverlay) {
                            this.renderMaskOverlay();
                        }
                        
                        // 注释掉实时直方图更新，避免性能问题和循环调用
                        // 直方图将显示原始图像数据，作为参考背景
                        // if (modalInstance.updateHistogramAfterCurveChange) {
                        //     modalInstance.updateHistogramAfterCurveChange();
                        // }
                    };
                    
                    previewImg.onerror = () => {
                        console.error("🎨 带遮罩的预览图像加载失败");
                        previewImg.src = this.inputImage;
                        previewImg.style.display = 'block';
                        if (previewWrapper) {
                            previewWrapper.style.display = 'flex';
                            previewWrapper.style.visibility = 'visible';
                            previewWrapper.style.opacity = '1';
                        }
                        // 只在用户开启遮罩显示时渲染
                        if (this.showMaskOverlay) {
                            this.renderMaskOverlay();
                        }
                    };
                    
                    previewImg.src = dataURL;
                } catch (error) {
                    console.error("🎨 更新带遮罩的预览图像失败:", error);
                    previewImg.src = this.inputImage;
                    previewImg.style.display = 'block';
                }
            } else {
                // 无遮罩情况下的普通更新
            try {
                const dataURL = canvas.toDataURL('image/jpeg', 0.9);
                console.log(`🎨 生成预览图像 DataURL，长度: ${dataURL.length}`);
                
                previewImg.onload = () => {
                    console.log("🎨 普通预览图像已更新，尺寸:", previewImg.naturalWidth, "x", previewImg.naturalHeight);
                    previewImg.style.display = 'block';
                    
                    if (previewWrapper) {
                            previewWrapper.style.display = 'flex';
                        previewWrapper.style.visibility = 'visible';
                        previewWrapper.style.opacity = '1';
                    }
                    
                    // 只在用户开启遮罩显示时渲染
                    if (this.showMaskOverlay) {
                        setTimeout(() => {
                            this.renderMaskOverlay();
                        }, 50);
                    }
                    
                    // 注释掉实时直方图更新，避免性能问题和循环调用
                    // 直方图将显示原始图像数据，作为参考背景
                    // if (modalInstance.updateHistogramAfterCurveChange) {
                    //     modalInstance.updateHistogramAfterCurveChange();
                    // }
                };
                
                previewImg.onerror = () => {
                        console.error("🎨 普通预览图像加载失败");
                    previewImg.src = this.inputImage;
                    previewImg.style.display = 'block';
                };
                
                previewImg.src = dataURL;
            } catch (error) {
                    console.error("🎨 更新普通预览图像失败:", error);
                previewImg.src = this.inputImage;
                previewImg.style.display = 'block';
                }
            }
        } catch (error) {
            console.error("🎨 应用预览效果失败:", error);
            
            // 如果处理失败，恢复原始图像
            try {
                const previewImg = this.modal.querySelector('.preview-image');
                if (previewImg) {
                    previewImg.src = this.inputImage;
                    previewImg.style.display = 'block';
                }
                
                // 确保预览容器可见
                const previewWrapper = this.modal.querySelector('.preview-container');
                if (previewWrapper) {
                    previewWrapper.style.display = 'flex';
                    previewWrapper.style.visibility = 'visible';
                    previewWrapper.style.opacity = '1';
                }
            } catch (e) {
                console.error("🎨 恢复原始图像也失败:", e);
            }
        }
    }
    
    parseCurvePoints(curvePointsStr) {
        // 解析曲线点字符串 "x1,y1;x2,y2" 到对象数组 [{x:x1, y:y1}, {x:x2, y:y2}]
        const points = [];
        if (!curvePointsStr) return points;
        
        const pairs = curvePointsStr.split(';');
        for (const pair of pairs) {
            const [x, y] = pair.split(',').map(v => parseFloat(v));
            if (!isNaN(x) && !isNaN(y)) {
                points.push({ x, y });
            }
        }
        
        // 确保按x排序
        points.sort((a, b) => a.x - b.x);
        
        return points;
    }
    
    createLookupTable(points, curveType) {
        // 确保至少有两个点
        if (points.length < 2) {
            points = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
        }
        
        // 创建256个值的查找表
        const lut = new Uint8Array(256);
        
        if (curveType === 'linear') {
            // 线性插值
        for (let i = 0; i < 256; i++) {
                // 找到i所在的区间
                let j = 0;
                while (j < points.length - 1 && points[j + 1].x < i) {
                    j++;
                }
                
                if (j >= points.length - 1) {
                    lut[i] = Math.min(255, Math.max(0, Math.round(points[points.length - 1].y)));
                } else if (points[j].x === i) {
                    lut[i] = Math.min(255, Math.max(0, Math.round(points[j].y)));
                } else {
                    const x0 = points[j].x;
                    const x1 = points[j + 1].x;
                    const y0 = points[j].y;
                    const y1 = points[j + 1].y;
                    
                    // 线性插值公式: y = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
                    const t = (i - x0) / (x1 - x0);
                    lut[i] = Math.min(255, Math.max(0, Math.round(y0 + t * (y1 - y0))));
                }
            }
        } else {
            // 检查是否为简单的两点对角线（特殊优化）
            if (points.length === 2 && 
                points[0].x === 0 && points[0].y === 0 && 
                points[1].x === 255 && points[1].y === 255) {
                // 直接创建恒等LUT
                for (let i = 0; i < 256; i++) {
                    lut[i] = i;
                }
            } else {
                // 立方或单调插值 - 使用简化的三次样条
                // 首先，将所有点映射到查找表
                for (let i = 0; i < points.length; i++) {
                    const x = Math.round(points[i].x);
                    const y = Math.round(points[i].y);
                    if (x >= 0 && x < 256) {
                        lut[x] = Math.min(255, Math.max(0, y));
                    }
                }
                
                // 然后，填充中间的值
                let lastX = -1;
                for (let i = 0; i < points.length; i++) {
                    const x = Math.round(points[i].x);
                    if (x >= 0 && x < 256) {
                        if (lastX !== -1 && lastX < x - 1) {
                            const lastY = lut[lastX];
                            const y = lut[x];
                            // 在两点之间进行平滑插值
                            for (let j = lastX + 1; j < x; j++) {
                                const t = (j - lastX) / (x - lastX);
                                // 使用更平滑的插值
                                const smooth = t * t * (3 - 2 * t); // 平滑步进函数
                                lut[j] = Math.min(255, Math.max(0, Math.round(lastY + smooth * (y - lastY))));
                            }
                        }
                        lastX = x;
                    }
                }
                
                // 填充开头和结尾
                if (points[0].x > 0) {
                    const y = Math.round(points[0].y);
                    for (let i = 0; i < points[0].x; i++) {
                        lut[i] = Math.min(255, Math.max(0, y));
                    }
                }
                
                if (points[points.length - 1].x < 255) {
                    const y = Math.round(points[points.length - 1].y);
                    for (let i = Math.round(points[points.length - 1].x) + 1; i < 256; i++) {
                        lut[i] = Math.min(255, Math.max(0, y));
                    }
                }
            }
        }
        
        return lut;
    }
    
    close() {
        console.log("🎨 关闭模态弹窗");
        
        try {
            this.isOpen = false;
            
            if (this.modal) {
                // 使用close方法关闭模态弹窗
                this.modal.close();
                
                // 移除模态弹窗元素
                setTimeout(() => {
                    if (this.modal && this.modal.parentNode) {
                        this.modal.parentNode.removeChild(this.modal);
                        console.log("🎨 模态弹窗元素已移除");
                    }
                }, 100);
            }
        } catch (error) {
            console.error("🎨 关闭模态弹窗失败:", error);
        }
    }
    
    cancel() {
        console.log("🎨 取消曲线编辑");
        this.close();
    }
    
    async apply() {
        console.log("🎨 应用曲线编辑");
        
        try {
            // 使用真实节点
            const node = this.realNode || this.node;
            
            if (!node) {
                console.error("🎨 无法应用更改: 节点不存在");
                return;
            }
            
            // 获取当前曲线设置
            if (this.curveEditor) {
                // 确保曲线编辑器的更改已经应用到节点上
                this.curveEditor.updatePointsWidget();
                
                // 同步到节点上的曲线编辑器
                if (node.curveEditor) {
                    // 复制所有通道的曲线数据
                    node.curveEditor.channelCurves = JSON.parse(JSON.stringify(this.curveEditor.channelCurves));
                    node.curveEditor.currentChannel = this.curveEditor.currentChannel;
                    node.curveEditor.controlPoints = JSON.parse(JSON.stringify(this.curveEditor.controlPoints));
                    
                    // 同步黑点和白点
                    node.curveEditor.blackPointX = this.curveEditor.blackPointX;
                    node.curveEditor.whitePointX = this.curveEditor.whitePointX;
                    
                    // 更新节点上的曲线编辑器
                    node.curveEditor.updatePointsWidget();
                    node.curveEditor.drawCurve();
                }
            }
            
            console.log(`🎨 应用曲线编辑，所有通道数据已更新`);
            
            // 通知后端处理图像
            const result = await this.processImage(curvePoints, interpolation, channel);
            
            // 关闭模态弹窗
            this.close();
            
            // 如果节点有graph，触发重新执行
            if (node.graph) {
                console.log("🎨 触发节点重新执行");
                node.graph.setDirtyCanvas(true, true);
                
                // 尝试触发节点执行
                if (typeof node.onExecuted === 'function') {
                    // 创建一个模拟消息
                    const message = { refresh: true };
                    node.onExecuted(message);
                }
            }
            
            console.log("🎨 曲线编辑应用成功");
        } catch (error) {
            console.error("🎨 应用曲线编辑失败:", error);
        }
    }
    
    async processImage(curvePoints, interpolation, channel) {
        // 请求后端处理图像
        try {
            const response = await app.graphToPrompt();
            return true;
        } catch (error) {
            console.error("🎨 处理图像失败:", error);
            return false;
        }
    }

    renderMaskOverlay() {
        // 修正版本：正确显示遮罩区域
        if (!this.originalMask) {
            return;
        }
        
        const maskCanvas = this.modal.querySelector('.preview-mask-canvas');
        if (!maskCanvas) {
            console.error("🎨 找不到遮罩预览画布");
            return;
        }
        
        // 设置画布尺寸
        maskCanvas.width = this.originalImage.width;
        maskCanvas.height = this.originalImage.height;
        
        // 确保画布显示
        maskCanvas.style.display = 'block';
        
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        // 创建一个临时画布来获取遮罩数据
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskCanvas.width;
        tempCanvas.height = maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 绘制遮罩到临时画布
        tempCtx.drawImage(this.originalMask, 0, 0);
        const maskImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const maskData = maskImageData.data;
        
        // 分析遮罩数据，判断白色还是黑色是遮罩区域
        let whitePixels = 0;
        let blackPixels = 0;
        const sampleSize = Math.min(10000, maskData.length / 4);
        for (let i = 0; i < sampleSize * 4; i += 4) {
            const luminance = (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
            if (luminance > 0.9) whitePixels++;
            else if (luminance < 0.1) blackPixels++;
        }
        
        // 判断遮罩类型（假设较少的颜色是遮罩区域）
        const isWhiteMask = whitePixels < blackPixels;
        console.log(`🎨 遮罩分析: 白色像素=${whitePixels}, 黑色像素=${blackPixels}, 白色是遮罩=${isWhiteMask}`);
        
        // 创建输出图像数据
        const outputImageData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
        const outputData = outputImageData.data;
        
        // 根据遮罩类型显示半透明覆盖
        for (let i = 0; i < maskData.length; i += 4) {
            // 获取遮罩的亮度值
            const luminance = (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
            
            // 判断是否为遮罩区域
            const isInMask = isWhiteMask ? (luminance > 0.5) : (luminance < 0.5);
            
            if (isInMask) {
                // 遮罩区域：显示半透明的绿色（更容易看清下面的图像）
                outputData[i] = 0;       // R
                outputData[i + 1] = 255; // G
                outputData[i + 2] = 0;   // B
                outputData[i + 3] = 80;  // A (较低的不透明度，约30%)
            } else {
                // 非遮罩区域：完全透明
                outputData[i + 3] = 0;
            }
        }
        
        // 将处理后的数据绘制到遮罩画布
        maskCtx.putImageData(outputImageData, 0, 0);
        
        // 绘制遮罩边界线（简化版）
        // 使用描边而不是逐像素检测
        maskCtx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // 黄色边框
        maskCtx.lineWidth = 2;
        
        // 可选：绘制简单的边界框（如果需要更精确的边界，可以使用边缘检测）
        // 这里我们只绘制一个提示性的边框
        if (isWhiteMask) {
            // 如果白色是遮罩，在有白色像素的区域周围绘制边框
            // 这是一个简化的实现，实际项目中可能需要更复杂的边缘检测
        }
        
        // 添加标记
        maskCtx.fillStyle = "rgba(255, 255, 0, 0.8)";
        maskCtx.font = "bold 16px Arial";
        maskCtx.fillText("MASK", 10, 25);
        
        console.log("🎨 遮罩可视化已渲染");
    }
    
    // 创建预设控制按钮
    createPresetControls(container) {
        // 预设下拉菜单
        const presetSelect = document.createElement('select');
        presetSelect.className = 'curve-preset-select';
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
        
        // 加载预设列表
        this.loadPresetList(presetSelect);
        
        // 预设选择事件
        presetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadPreset(e.target.value);
            }
        });
        
        // 保存预设按钮
        const savePresetBtn = document.createElement('button');
        savePresetBtn.className = 'curve-editor-button';
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
        savePresetBtn.onclick = () => this.savePreset();
        
        // 管理预设按钮
        const managePresetBtn = document.createElement('button');
        managePresetBtn.className = 'curve-editor-button';
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
        managePresetBtn.onclick = () => this.showPresetManager();
        
        container.appendChild(presetSelect);
        container.appendChild(savePresetBtn);
        container.appendChild(managePresetBtn);
        
        // 保存引用
        this.presetSelect = presetSelect;
    }
    
    // 加载预设列表
    async loadPresetList(selectElement) {
        try {
            const response = await fetch('/curve_presets/list');
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
            console.error('加载预设列表失败:', error);
        }
    }
    
    // 获取分类标签
    getCategoryLabel(category) {
        const labels = {
            'default': 'Default Presets',
            'cinematic': 'Cinematic Style',
            'portrait': 'Portrait',
            'landscape': 'Landscape',
            'custom': 'Custom'
        };
        return labels[category] || category;
    }
    
    // 保存预设
    async savePreset() {
        const name = prompt('Please enter preset name:');
        if (!name) return;
        
        const description = prompt('Please enter preset description (optional):') || '';
        
        try {
            console.log('Starting to save preset...');
            
            // 获取当前曲线数据
            let curves = {};
            try {
                curves = {
                    'RGB': this.getCurveForChannel('RGB') || '0,0;255,255',
                    'R': this.getCurveForChannel('R') || '0,0;255,255',
                    'G': this.getCurveForChannel('G') || '0,0;255,255',
                    'B': this.getCurveForChannel('B') || '0,0;255,255'
                };
                console.log('Curve data retrieved successfully:', curves);
            } catch (e) {
                console.error('Failed to retrieve curve data:', e);
                curves = {
                    'RGB': '0,0;255,255',
                    'R': '0,0;255,255',
                    'G': '0,0;255,255',
                    'B': '0,0;255,255'
                };
            }
            
            // 获取强度值
            const strengthWidget = this.node.widgets.find(w => w.name === 'strength');
            const strength = strengthWidget ? strengthWidget.value : 100;
            console.log('Strength value:', strength);
            
            // Temporarily skip thumbnail generation
            const thumbnail = '';
            
            const presetData = {
                name,
                description,
                curves,
                strength,
                thumbnail,
                category: 'custom',
                tags: []
            };
            
            console.log('Preset data:', presetData);
            
            const response = await fetch('/curve_presets/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(presetData)
            });
            
            // Check response status
            if (!response.ok) {
                console.error('API response error:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error details:', errorText);
                alert(`Save failed: ${response.status} ${response.statusText}`);
                return;
            }
            
            const result = await response.json();
            if (result.success) {
                alert('Preset saved successfully!');
                // Reload preset list
                this.loadPresetList(this.presetSelect);
            } else {
                alert('Save failed: ' + result.error);
            }
        } catch (error) {
            console.error('Save preset failed:', error);
            console.error('Error stack:', error.stack);
            alert('Error saving preset: ' + error.message);
        }
    }
    
    // 加载预设
    async loadPreset(presetId) {
        try {
            const response = await fetch(`/curve_presets/load/${presetId}`);
            const data = await response.json();
            
            if (data.success) {
                const preset = data.preset;
                
                // Apply curve data
                if (preset.curves) {
                    // Save current channel
                    const currentChannel = this.curveEditor.currentChannel || 'RGB';
                    
                    // Apply curves for each channel
                    ['RGB', 'R', 'G', 'B'].forEach(channel => {
                        if (preset.curves[channel]) {
                            try {
                                let curveData;
                                
                                console.log(`🎨 解析${channel}通道预设数据:`, preset.curves[channel]);
                                
                                // Parse curve data - support multiple formats
                                if (typeof preset.curves[channel] === 'string') {
                                    // Check if it's semicolon-separated format "0,0;64,60;128,135"
                                    if (preset.curves[channel].includes(';')) {
                                        curveData = preset.curves[channel].split(';').map(point => {
                                            const [x, y] = point.split(',').map(Number);
                                            return [x, y];
                                        });
                                    } else {
                                        // Try JSON parse
                                        curveData = JSON.parse(preset.curves[channel]);
                                    }
                                } else {
                                    curveData = preset.curves[channel];
                                }
                                
                                console.log(`🎨 ${channel}通道解析后的曲线数据:`, curveData);
                                
                                // Store to channel curve data
                                this.curveEditor.channelCurves[channel] = curveData;
                                
                                // If it's current channel, update control points
                                if (channel === currentChannel) {
                                    console.log(`🎨 更新当前通道${channel}的控制点`);
                                    this.curveEditor.controlPoints = curveData.map(p => ({x: p[0], y: p[1]}));
                                    // Redraw curve
                                    this.curveEditor.drawCurve();
                                }
                            } catch (e) {
                                console.error(`Failed to parse ${channel} channel curve:`, e);
                            }
                        }
                    });
                    
                    // Ensure current channel is displayed correctly
                    if (this.curveEditor.channelCurves[currentChannel]) {
                        this.curveEditor.controlPoints = this.curveEditor.channelCurves[currentChannel].map(p => ({
                            x: p[0], 
                            y: p[1]
                        }));
                    }
                    
                    // Update interface and widgets
                    this.curveEditor.updatePointsWidget();
                    this.curveEditor.drawCurve();
                    
                    // Update channel button state
                    if (this.curveEditor.updateChannelButtons) {
                        this.curveEditor.updateChannelButtons();
                    }
                }
                
                // Apply strength
                if (preset.strength !== undefined) {
                    const strengthWidget = this.node.widgets.find(w => w.name === 'strength');
                    if (strengthWidget) {
                        strengthWidget.value = preset.strength;
                    }
                }
                
                // Update preview
                this.updatePreview();
                
                console.log('Preset loaded:', preset.name);
                
                // Show loaded preset name in dropdown
                if (this.presetSelect) {
                    this.presetSelect.value = presetId;
                }
            }
        } catch (error) {
            console.error('Failed to load preset:', error);
            alert('Error loading preset');
        }
    }
    
    // 获取指定通道的曲线数据
    getCurveForChannel(channel) {
        // If it's current channel, return current control points directly
        if (this.curveEditor.currentChannel === channel) {
            const points = this.curveEditor.controlPoints || [];
            return JSON.stringify(points.map(p => [p.x, p.y]));
        }
        
        // Otherwise get from stored curve data
        const curves = this.curveEditor.channelCurves[channel] || [[0,0],[255,255]];
        return JSON.stringify(curves);
        
        // Restore original channel
        if (this.curveEditor.channel) {
            this.curveEditor.channel.value = currentChannel;
        }
        
        return points;
    }
    
    // 生成缩略图
    async generateThumbnail() {
        try {
            // 创建小尺寸画布
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // 如果有预览图像，绘制缩略图
            const previewImg = this.modal.querySelector('.preview-image');
            if (previewImg && previewImg.complete && previewImg.naturalWidth > 0) {
                ctx.drawImage(previewImg, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.8);
            }
        } catch (error) {
            console.error('生成缩略图失败:', error);
        }
        return '';
    }
    
    // 显示预设管理器
    showPresetManager() {
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
            z-index: 100000;
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
        title.textContent = 'Curve Preset Manager';
        title.style.marginBottom = '20px';
        managerContent.appendChild(title);
        
        // 预设列表
        const presetList = document.createElement('div');
        presetList.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
            margin-bottom: 20px;
        `;
        
        // 加载预设列表
        this.loadPresetListForManager(presetList);
        
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
                
                const response = await fetch('/curve_presets/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: text })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Preset imported successfully!');
                    managerModal.remove();
                    this.loadPresetList(this.presetSelect);
                } else {
                    alert('Import failed: ' + result.error);
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
        closeBtn.onclick = () => managerModal.remove();
        managerContent.appendChild(closeBtn);
        
        managerModal.appendChild(managerContent);
        
        // 将预设管理器添加到dialog内部而不是body
        this.modal.appendChild(managerModal);
        
        // Click background to close
        managerModal.addEventListener('click', (e) => {
            if (e.target === managerModal) {
                managerModal.remove();
            }
        });
    }
    
    // 为管理器加载预设列表
    async loadPresetListForManager(container) {
        try {
            const response = await fetch('/curve_presets/list');
            const data = await response.json();
            
            if (data.success) {
                // 清空容器
                container.innerHTML = '';
                
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
                                    const delResponse = await fetch(`/curve_presets/delete/${preset.id}`, {
                                        method: 'DELETE'
                                    });
                                    const delResult = await delResponse.json();
                                    
                                    if (delResult.success) {
                                        presetItem.remove();
                                        this.loadPresetList(this.presetSelect);
                                    } else {
                                        alert('Delete failed: ' + delResult.error);
                                    }
                                } catch (error) {
                                    alert('Delete failed: ' + error.message);
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
                            const expResponse = await fetch(`/curve_presets/export/${preset.id}`);
                            const expResult = await expResponse.json();
                            
                            if (expResult.success) {
                                // Create download
                                const blob = new Blob([expResult.content], {
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
                    container.appendChild(presetItem);
                });
                
                if (data.presets.length === 0) {
                    container.innerHTML = '<p style="color: #888; text-align: center;">No presets available</p>';
                }
            }
        } catch (error) {
            console.error('加载预设列表失败:', error);
            container.innerHTML = '<p style="color: #f88; text-align: center;">Failed to load presets</p>';
        }
    }
    
}

class PhotoshopCurveNodeWidget {
    constructor(node, options = {}) {
        console.log("🎨 PhotoshopCurveNodeWidget 构造函数被调用");
        
        // 保存节点引用
        if (!node) {
            console.error("🎨 构造函数接收到无效节点:", node);
            // 创建一个最小化的节点对象以避免错误
            this.node = { widgets: [], id: "unknown" };
        } else {
            this.node = node;
            console.log("🎨 节点ID:", node.id);
        }
        
        // 保存选项
        this.options = Object.assign({
            addToNode: true, // 默认添加到节点
            isModal: false   // 默认不是模态弹窗模式
        }, options);
        
        // 查找widgets
        this.rgbCurve = null;
        this.redCurve = null;
        this.greenCurve = null;
        this.blueCurve = null;
        this.curveType = null;
        
        // 初始化端点滑块值
        this.blackPointX = 0;
        this.whitePointX = 255;
        this.isDraggingBlackSlider = false;
        this.isDraggingWhiteSlider = false;
        
        // 初始化历史记录
        this.history = [];
        this.historyIndex = -1;
        
        // 当前编辑的通道
        this.currentChannel = 'RGB';
        
        // 存储每个通道的曲线点
        this.channelCurves = {
            'RGB': [[0,0],[255,255]],
            'R': [[0,0],[255,255]],
            'G': [[0,0],[255,255]],
            'B': [[0,0],[255,255]]
        };
        
        // 确保widgets已初始化
        if (node && node.widgets && Array.isArray(node.widgets)) {
            this.rgbCurve = node.widgets.find(w => w.name === 'rgb_curve');
            this.redCurve = node.widgets.find(w => w.name === 'red_curve');
            this.greenCurve = node.widgets.find(w => w.name === 'green_curve');
            this.blueCurve = node.widgets.find(w => w.name === 'blue_curve');
            this.curveType = node.widgets.find(w => w.name === 'curve_type');
            
            console.log("🎨 找到的widgets", {
                rgbCurve: !!this.rgbCurve,
                redCurve: !!this.redCurve,
                greenCurve: !!this.greenCurve,
                blueCurve: !!this.blueCurve,
                curveType: !!this.curveType
            });
            
            // 初始化曲线数据
            if (this.rgbCurve) {
                this.channelCurves.RGB = this.parseCurveString(this.rgbCurve.value);
                // 确保有默认值
                if (!this.rgbCurve.value) {
                    this.rgbCurve.value = '[[0,0],[255,255]]';
                    if (this.rgbCurve.callback) {
                        this.rgbCurve.callback(this.rgbCurve.value);
                    }
                }
            }
            if (this.redCurve) {
                this.channelCurves.R = this.parseCurveString(this.redCurve.value);
                if (!this.redCurve.value) {
                    this.redCurve.value = '[[0,0],[255,255]]';
                    if (this.redCurve.callback) {
                        this.redCurve.callback(this.redCurve.value);
                    }
                }
            }
            if (this.greenCurve) {
                this.channelCurves.G = this.parseCurveString(this.greenCurve.value);
                if (!this.greenCurve.value) {
                    this.greenCurve.value = '[[0,0],[255,255]]';
                    if (this.greenCurve.callback) {
                        this.greenCurve.callback(this.greenCurve.value);
                    }
                }
            }
            if (this.blueCurve) {
                this.channelCurves.B = this.parseCurveString(this.blueCurve.value);
                if (!this.blueCurve.value) {
                    this.blueCurve.value = '[[0,0],[255,255]]';
                    if (this.blueCurve.callback) {
                        this.blueCurve.callback(this.blueCurve.value);
                    }
                }
            }
        } else {
            console.warn("🎨 节点widgets未初始化");
        }
        
        // 初始化控制点数据 - 使用当前通道的曲线
        this.controlPoints = this.channelCurves[this.currentChannel].map(p => ({x: p[0], y: p[1]}));
        this.selectedPoint = -1;
        this.isDragging = false;
        
        try {
            console.log("🎨 开始创建曲线编辑器UI");
            this.createWidget();
            this.setupEventListeners();
            this.setupWidgetCallbacks();
            this.drawCurve();
            console.log("🎨 曲线编辑器初始化完成");
        } catch (error) {
            console.error("🎨 曲线编辑器初始化错误", error);
        }
    }
    
    createWidget() {
        console.log("🎨 开始创建编辑器UI组件");
        
        // 创建容器
        this.container = document.createElement('div');
        this.container.id = `curve-editor-${this.node.id || Date.now()}`;
        this.container.style.cssText = `
            width: 100%; 
            height: 444px; 
            background: #2a2a2a; 
            border: 1px solid #555; 
            border-radius: 4px; 
            padding: 10px; 
            box-sizing: border-box;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;
        
        console.log("🎨 容器创建完成, ID:", this.container.id);
        
        // 创建通道选择器 (包含重置按钮)
        this.createChannelSelector();
        
        // 创建SVG
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('viewBox', '0 0 384 384');
        this.svg.style.cssText = `
            width: 384px;
            height: 384px;
            cursor: crosshair;
            background: #1a1a1a;
            border-radius: 2px;
            display: block;
            margin: 8px 0;
        `;
        console.log("🎨 SVG元素创建完成");
        
        // 创建滑块容器和滑块
        this.createSliders();
        console.log("🎨 滑块创建完成");
        
        // 创建状态栏
        this.createStatusBar();
        console.log("🎨 状态栏创建完成");
        
        // 添加到ComfyUI节点
        try {
            console.log("🎨 开始将组件添加到容器");
            
            // 按顺序添加组件到容器
            this.container.appendChild(this.channelSelector);
            this.container.appendChild(this.svg);
            this.container.appendChild(this.sliderContainer);
            this.container.appendChild(this.statusBar);
            
            // 仅当选项指定时才添加到节点
            if (this.options.addToNode) {
                console.log("🎨 正在添加DOM widget到节点:", this.node);
                if (!this.node || !this.node.addDOMWidget) {
                    console.error("🎨 节点对象无效或缺少addDOMWidget方法");
                    return;
                }
                
                this.node.addDOMWidget('curve_editor', 'div', this.container);
                console.log("🎨 DOM widget 添加成功");
            } else {
                console.log("🎨 跳过添加DOM widget到节点");
            }
        } catch (error) {
            console.error("🎨 DOM widget 添加失败", error);
        }
        
        console.log("🎨 UI组件创建完成");
    }
    
    createChannelSelector() {
        console.log("🎨 开始创建通道选择器和重置按钮");
        
        // 确保通道选择器DOM元素被创建
        this.channelSelector = document.createElement('div');
        this.channelSelector.id = `channel-selector-${this.node.id || Date.now()}`;
        this.channelSelector.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            padding: 4px;
            justify-content: center;
            align-items: center;
            width: 100%;
        `;
        
        const channels = [
            { id: 'RGB', label: 'RGB', gradient: 'linear-gradient(135deg, #fff 0%, #000 100%)' },
            { id: 'R', label: 'R', gradient: 'linear-gradient(135deg, #ff0000 0%, #00ffff 100%)' },
            { id: 'G', label: 'G', gradient: 'linear-gradient(135deg, #00ff00 0%, #ff00ff 100%)' },
            { id: 'B', label: 'B', gradient: 'linear-gradient(135deg, #0000ff 0%, #ffff00 100%)' }
        ];
        
        this.channelButtons = {};
        
        channels.forEach(channelData => {
            const button = document.createElement('button');
            button.textContent = channelData.label;
            button.style.cssText = `
                width: 32px;
                height: 32px;
                border: 2px solid #444;
                cursor: pointer;
                border-radius: 50%;
                font-size: 11px;
                font-weight: bold;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                background: ${channelData.gradient};
            `;
            
            button.addEventListener('mouseenter', () => {
                if (!button.classList.contains('active')) {
                    button.style.transform = 'scale(1.1)';
                    button.style.borderColor = '#4ecdc4';
                }
            });
            
            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('active')) {
                    button.style.transform = 'scale(1)';
                    button.style.borderColor = '#444';
                }
            });
            
            button.addEventListener('click', () => {
                this.selectChannel(channelData.id);
            });
            
            this.channelButtons[channelData.id] = button;
            this.channelSelector.appendChild(button);
        });

        // 添加分隔线
        const separator = document.createElement('div');
        separator.style.cssText = `
            width: 1px;
            height: 24px;
            background: #444;
            margin: 0 8px;
        `;
        this.channelSelector.appendChild(separator);
        
        // 创建重置按钮 - 使用更明显的样式
        const resetButton = document.createElement('button');
        resetButton.id = `reset-button-${this.node.id || Date.now()}`;
        resetButton.textContent = 'Reset';
        resetButton.style.cssText = `
            height: 28px;
            padding: 0 16px;
            background: #4ecdc4;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;
        
        resetButton.addEventListener('mouseenter', () => {
            resetButton.style.background = '#3dbeb6';
            resetButton.style.transform = 'scale(1.05)';
        });
        
        resetButton.addEventListener('mouseleave', () => {
            resetButton.style.background = '#4ecdc4';
            resetButton.style.transform = 'scale(1)';
        });
        
        resetButton.addEventListener('click', () => {
            console.log("🎨 重置按钮被点击");
            this.resetCurve();
        });
        
        this.channelSelector.appendChild(resetButton);
        this.resetButton = resetButton; // 保存引用以便以后使用
        
        console.log("🎨 通道选择器和重置按钮创建完成");
        
        this.updateChannelButtons();
    }
    
    selectChannel(channelId) {
        // 保存当前通道的曲线
        this.channelCurves[this.currentChannel] = this.controlPoints.map(p => [p.x, p.y]);
        
        // 切换到新通道
        this.currentChannel = channelId;
        this.updateChannelButtons();
        
        // 加载新通道的曲线
        this.controlPoints = this.channelCurves[channelId].map(p => ({x: p[0], y: p[1]}));
        
        // 清除直方图缓存以强制重绘
        this._histogramDrawn = false;
        this._lastHistogramChannel = null;
        
        // 重绘曲线（这会触发直方图更新）
        this.drawCurve();
        
        // 使用对象直接引用
        const node = this.node;
        if (node && typeof node.onResize === 'function') {
            node.onResize();
        }
    }
    
    updateChannelButtons() {
        const currentChannel = this.currentChannel;
        
        Object.values(this.channelButtons).forEach(button => {
            button.classList.remove('active');
            button.style.borderColor = '#444';
            button.style.borderWidth = '2px';
            button.style.boxShadow = 'none';
            button.style.transform = 'scale(1)';
        });
        
        if (this.channelButtons[currentChannel]) {
            const activeButton = this.channelButtons[currentChannel];
            activeButton.classList.add('active');
            activeButton.style.borderColor = '#4ecdc4';
            activeButton.style.borderWidth = '3px';
            activeButton.style.boxShadow = '0 0 12px rgba(78, 205, 196, 0.5)';
            activeButton.style.transform = 'scale(1.05)';
        }
    }
    
    getActiveCurvePoints() {
        return this.channelCurves[this.currentChannel];
    }
    
    parseCurveString(str) {
        // 解析字符串格式的曲线数据 "[[0,0],[255,255]]"
        try {
            if (!str || str === '[[0,0],[255,255]]') {
                return [[0,0],[255,255]];
            }
            return JSON.parse(str);
        } catch (e) {
            console.error('解析曲线数据失败:', e);
            return [[0,0],[255,255]];
        }
    }
    
    parsePoints(pointsStr) {
        const points = pointsStr.split(';')
            .map(s => s.split(',').map(Number))
            .filter(a => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]))
            .map(a => ({ x: Math.max(0, Math.min(255, a[0])), y: Math.max(0, Math.min(255, a[1])) }))
            .sort((a, b) => a.x - b.x);
        
        // 如果没有有效的点，返回默认的对角线
        if (points.length === 0) {
            return [{ x: this.blackPointX || 0, y: 0 }, { x: this.whitePointX || 255, y: 255 }];
        }
        
        // 确保至少有两个点，但不要强制起点和终点的位置
        if (points.length < 2) {
            // 如果只有一个点，根据它的位置添加另一个点
            if (points[0].x <= 127) {
                // 如果唯一点在左半边，添加一个右边的点
                points.push({ x: this.whitePointX || 255, y: 255 });
            } else {
                // 如果唯一点在右半边，添加一个左边的点
                points.unshift({ x: this.blackPointX || 0, y: 0 });
            }
        }
        
        return points;
    }
    
    pointsToString(points) {
        return points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
    }
    
    setupEventListeners() {
        // 绑定事件处理函数以便于后续移除
        this._boundOnMouseDown = this.onMouseDown.bind(this);
        this._boundOnMouseMove = this.onMouseMove.bind(this);
        this._boundOnMouseUp = this.onMouseUp.bind(this);
        this._boundOnDoubleClick = this.onDoubleClick.bind(this);
        this._boundOnRightClick = this.onRightClick.bind(this);
        this._boundPreventSelect = e => e.preventDefault();
        
        // 添加事件监听器
        this.svg.addEventListener('mousedown', this._boundOnMouseDown);
        this.svg.addEventListener('mousemove', this._boundOnMouseMove);
        this.svg.addEventListener('mouseup', this._boundOnMouseUp);
        this.svg.addEventListener('mouseleave', this._boundOnMouseUp);
        this.svg.addEventListener('dblclick', this._boundOnDoubleClick);
        this.svg.addEventListener('contextmenu', this._boundOnRightClick);
        this.svg.addEventListener('selectstart', this._boundPreventSelect);
    }
    
    setupWidgetCallbacks() {
        try {
            const self = this;
            const node = this.node;
            
            // 当节点值发生变化时更新UI
            if (node.onCurveNodeValueChanged) {
                console.log("🎨 移除现有回调");
                node.onCurveNodeValueChanged = undefined;
            }
            
            node.onCurveNodeValueChanged = function(widget, value) {
                if (widget.name === 'curve_points') {
                    console.log("🎨 曲线点更新为:", value);
                    self.controlPoints = self.parsePoints(value);
                    self.drawCurve();
                } else if (widget.name === 'channel') {
                    console.log("🎨 通道更新为:", value);
                    self.updateChannelButtons();
                    self.drawCurve();
                } else if (widget.name === 'interpolation') {
                    console.log("🎨 插值方法更新为:", value);
                    self.drawCurve();
                }
            };
        } catch (error) {
            console.error("🎨 设置回调函数错误:", error);
        }
    }
    
    getSVGPoint(e) {
        const rect = this.svg.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 384;
        const y = 384 - ((e.clientY - rect.top) / rect.height) * 384;
        const logicalX = (x / 384) * 255;
        const logicalY = (y / 384) * 255;
        return { x: Math.max(0, Math.min(255, logicalX)), y: Math.max(0, Math.min(255, logicalY)) };
    }
    
    findNearestPoint(pos, threshold = 10) {
        for (let i = 0; i < this.controlPoints.length; i++) {
            const p = this.controlPoints[i];
            const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
            if (dist <= threshold) return i;
        }
        return -1;
    }
    
    onMouseDown(e) {
        e.preventDefault();
        const pos = this.getSVGPoint(e);
        const pointIndex = this.findNearestPoint(pos);
        
        if (pointIndex >= 0) {
            this.selectedPoint = pointIndex;
            this.isDragging = true;
            this.svg.style.cursor = 'move';
        } else if (e.button === 0) {
            this.addPoint(pos);
        }
    }
    
    onMouseMove(e) {
        if (!this.isDragging || this.selectedPoint < 0) {
            const pos = this.getSVGPoint(e);
            const pointIndex = this.findNearestPoint(pos);
            this.svg.style.cursor = pointIndex >= 0 ? 'pointer' : 'crosshair';
            this.updateCoordinates(pos.x, pos.y);
            return;
        }
        
        const pos = this.getSVGPoint(e);
        const point = this.controlPoints[this.selectedPoint];
        
        if (this.selectedPoint === 0) {
            point.x = Math.max(this.blackPointX, Math.min(this.controlPoints[1].x - 1, pos.x));
            point.y = pos.y;
            this.blackPointX = point.x;
            this.updateSliderPositions();
        } else if (this.selectedPoint === this.controlPoints.length - 1) {
            point.x = Math.max(this.controlPoints[this.controlPoints.length - 2].x + 1, 
                Math.min(this.whitePointX, pos.x));
            point.y = pos.y;
            this.whitePointX = point.x;
            this.updateSliderPositions();
        } else {
            const prevX = this.controlPoints[this.selectedPoint - 1].x;
            const nextX = this.controlPoints[this.selectedPoint + 1].x;
            point.x = Math.max(prevX + 1, Math.min(nextX - 1, pos.x));
            point.y = pos.y;
        }
        
        this.updateCoordinates(point.x, point.y);
        this.updatePointsWidget();
        this.drawCurve();
    }
    
    onMouseUp(e) {
        this.isDragging = false;
        this.selectedPoint = -1;
        this.svg.style.cursor = 'crosshair';
    }
    
    onDoubleClick(e) {
        e.preventDefault();
        const pos = this.getSVGPoint(e);
        this.addPoint(pos);
    }
    
    onRightClick(e) {
        e.preventDefault();
        const pos = this.getSVGPoint(e);
        const pointIndex = this.findNearestPoint(pos);
        
        if (pointIndex > 0 && pointIndex < this.controlPoints.length - 1) {
            this.removePoint(pointIndex);
        }
    }
    
    addPoint(pos) {
        let insertIndex = this.controlPoints.length;
        for (let i = 0; i < this.controlPoints.length; i++) {
            if (pos.x < this.controlPoints[i].x) {
                insertIndex = i;
                break;
            }
        }
        
        this.controlPoints.splice(insertIndex, 0, { x: pos.x, y: pos.y });
        this.saveHistory();
        this.updatePointsWidget();
        this.drawCurve();
        this.updateStatus('添加控制点');
    }
    
    removePoint(index) {
        if (index > 0 && index < this.controlPoints.length - 1) {
            this.controlPoints.splice(index, 1);
            this.saveHistory();
            this.updatePointsWidget();
            this.drawCurve();
            this.updateStatus('删除控制点');
        }
    }
    
    updatePointsWidget() {
        // 保存当前通道的曲线点
        this.channelCurves[this.currentChannel] = this.controlPoints.map(p => [p.x, p.y]);
        
        // 更新对应的widget
        const curveStr = JSON.stringify(this.channelCurves[this.currentChannel]);
        
        switch(this.currentChannel) {
            case 'RGB':
                if (this.rgbCurve) {
                    this.rgbCurve.value = curveStr;
                    if (this.rgbCurve.callback) {
                        this.rgbCurve.callback(curveStr);
                    }
                }
                break;
            case 'R':
                if (this.redCurve) {
                    this.redCurve.value = curveStr;
                    if (this.redCurve.callback) {
                        this.redCurve.callback(curveStr);
                    }
                }
                break;
            case 'G':
                if (this.greenCurve) {
                    this.greenCurve.value = curveStr;
                    if (this.greenCurve.callback) {
                        this.greenCurve.callback(curveStr);
                    }
                }
                break;
            case 'B':
                if (this.blueCurve) {
                    this.blueCurve.value = curveStr;
                    if (this.blueCurve.callback) {
                        this.blueCurve.callback(curveStr);
                    }
                }
                break;
        }
        
        // 触发值更改回调
        const node = this.node;
        if (node) {
            // 强制刷新画布
            if (node.graph) {
                node.graph.setDirtyCanvas(true, true);
            }
            
            // 通知节点改变大小以触发重绘
            if (typeof node.onResize === 'function') {
                node.onResize();
            }
        }
    }
    
    drawCurve() {
        try {
            // 清空SVG
            while (this.svg.firstChild) {
                this.svg.removeChild(this.svg.firstChild);
            }
            
            // 重置直方图绘制标记（因为SVG被清空了）
            this._histogramDrawn = false;
            
            // 生成唯一ID以避免多个编辑器之间的ID冲突
            const uniqueId = `curve_${this.node.id || Math.random().toString(36).substring(2, 10)}`;
            
            // 绘制网格
            this.drawGrid();
            
            // 绘制色调标签
            this.drawToneLabels();
            
            // 创建渐变定义
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const bgGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
            bgGradient.setAttribute('id', `channelGradient_${uniqueId}`);
            bgGradient.setAttribute('x1', '0%');
            bgGradient.setAttribute('y1', '0%');    // 从左上开始
            bgGradient.setAttribute('x2', '100%');
            bgGradient.setAttribute('y2', '100%');   // 到右下结束
            
            // 设置渐变色 - 按照Photoshop标准：RGB从左上白色到右下黑色
            const currentChannel = this.currentChannel;
            console.log(`🎨 drawCurve - 当前通道: ${currentChannel}`);
            
            const colors = {
                'RGB': { start: 'rgba(255,255,255,0.6)', end: 'rgba(0,0,0,0.6)' },    // 从白到黑
                'R': { start: 'rgba(255,0,0,0.6)', end: 'rgba(0,255,255,0.6)' },      // 从红色到青色
                'G': { start: 'rgba(0,255,0,0.6)', end: 'rgba(255,0,255,0.6)' },      // 从绿色到品红
                'B': { start: 'rgba(0,0,255,0.6)', end: 'rgba(255,255,0,0.6)' }       // 从蓝色到黄色
            };
            
            const channelColors = colors[currentChannel] || colors['RGB'];
            console.log(`🎨 使用的渐变颜色:`, channelColors);
            
            const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop1.setAttribute('offset', '0%');
            stop1.setAttribute('stop-color', channelColors.start);
            
            const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop2.setAttribute('offset', '100%');
            stop2.setAttribute('stop-color', channelColors.end);
            
            bgGradient.appendChild(stop1);
            bgGradient.appendChild(stop2);
            defs.appendChild(bgGradient);
            this.svg.appendChild(defs);
            
            // 绘制当前通道的渐变背景
            const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            gradient.setAttribute('x', '0');
            gradient.setAttribute('y', '0');
            gradient.setAttribute('width', '384');
            gradient.setAttribute('height', '384');
            gradient.setAttribute('fill', `url(#channelGradient_${uniqueId})`);
            gradient.setAttribute('opacity', '0.15'); // 设置整体不透明度，与渐变色的alpha值结合
            this.svg.appendChild(gradient);
            
            // 对角线参考线
            const diagonal = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            diagonal.setAttribute('x1', '0');
            diagonal.setAttribute('y1', '384');
            diagonal.setAttribute('x2', '384');
            diagonal.setAttribute('y2', '0');
            diagonal.setAttribute('stroke', '#777');
            diagonal.setAttribute('stroke-width', '1');
            diagonal.setAttribute('stroke-dasharray', '4, 4');
            this.svg.appendChild(diagonal);
            
            // 绘制直方图背景（基于原始图像）
            this.drawHistogram();
            
            // 绘制曲线
            this.drawSmoothCurve();
            
            // 绘制控制点
            for (let i = 0; i < this.controlPoints.length; i++) {
                const point = this.controlPoints[i];
                const x = (point.x / 255) * 384;
                const y = 384 - (point.y / 255) * 384;
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', i === this.selectedPoint ? '7' : '5');
                circle.setAttribute('fill', i === this.selectedPoint ? '#4ecdc4' : 'white');
                circle.setAttribute('stroke', '#4ecdc4');
                circle.setAttribute('stroke-width', '2');
                circle.setAttribute('data-index', i);
                this.svg.appendChild(circle);
            }
            
            // 更新滑块位置以匹配曲线端点
            this.updateSliderPositions();
        } catch (error) {
            console.error("🎨 绘制曲线时出错:", error);
        }
    }
    
    drawGrid() {
        // 绘制背景网格线 - 改为4x4网格
        const gridColor = '#444444';
        const gridSize = 96; // 4x4网格
        
        // 添加主网格
        for (let i = 0; i <= 384; i += gridSize) {
            // 垂直线
            const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            vLine.setAttribute('x1', i);
            vLine.setAttribute('y1', 0);
            vLine.setAttribute('x2', i);
            vLine.setAttribute('y2', 384);
            vLine.setAttribute('stroke', gridColor);
            vLine.setAttribute('stroke-width', i % 192 === 0 ? 1 : 0.5);
            vLine.setAttribute('stroke-opacity', i % 192 === 0 ? 0.8 : 0.5);
            this.svg.appendChild(vLine);
            
            // 水平线
            const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.setAttribute('x1', 0);
            hLine.setAttribute('y1', i);
            hLine.setAttribute('x2', 384);
            hLine.setAttribute('y2', i);
            hLine.setAttribute('stroke', gridColor);
            hLine.setAttribute('stroke-width', i % 192 === 0 ? 1 : 0.5);
            hLine.setAttribute('stroke-opacity', i % 192 === 0 ? 0.8 : 0.5);
            this.svg.appendChild(hLine);
        }
        
        // 添加边框
        const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        border.setAttribute('x', 0);
        border.setAttribute('y', 0);
        border.setAttribute('width', 384);
        border.setAttribute('height', 384);
        border.setAttribute('fill', 'none');
        border.setAttribute('stroke', '#555555');
        border.setAttribute('stroke-width', 1);
        this.svg.appendChild(border);
    }
    
    drawToneLabels() {
        // 添加色调标签 - 在网格分割线处显示
        const tones = [
            { x: 24, y: 376, text: "暗部" },
            { x: 128, y: 288, text: "阴影" },
            { x: 192, y: 192, text: "中间调" },
            { x: 256, y: 96, text: "高光" },
            { x: 360, y: 8, text: "亮部" }
        ];
        
        tones.forEach(tone => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', tone.x);
            text.setAttribute('y', tone.y);
            text.setAttribute('fill', '#888');
            text.setAttribute('font-size', '12');
            text.setAttribute('text-anchor', 'middle');
            text.textContent = tone.text;
            this.svg.appendChild(text);
        });
    }
    
    // 计算图像直方图
    calculateHistogram(imageSource) {
        // 如果传入的是字符串URL，需要先创建图像元素
        if (typeof imageSource === 'string') {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = imageSource;
            
            if (!img.complete) {
                // 图像尚未加载，需要等待
                img.onload = () => {
                    // 重新触发直方图绘制
                    this._cachedHistogram = null;
                    this._histogramDrawn = false;
                    this.drawHistogram();
                };
                return null;
            }
            imageSource = img;
        }
        
        if (!imageSource || !imageSource.complete) {
            console.warn("🎨 图像未加载完成，无法计算直方图");
            return null;
        }
        
        try {
            // 创建离屏画布
            const canvas = document.createElement('canvas');
            canvas.width = imageSource.width;
            canvas.height = imageSource.height;
            const ctx = canvas.getContext('2d');
            
            // 绘制图像到画布
            ctx.drawImage(imageSource, 0, 0);
            
            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 初始化直方图数组
            const histogram = {
                RGB: new Array(256).fill(0),
                R: new Array(256).fill(0),
                G: new Array(256).fill(0),
                B: new Array(256).fill(0)
            };
            
            // 计算直方图
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // RGB亮度计算（标准公式）
                const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                
                histogram.R[r]++;
                histogram.G[g]++;
                histogram.B[b]++;
                histogram.RGB[luminance]++;
            }
            
            // 归一化直方图数据
            const totalPixels = canvas.width * canvas.height;
            for (const channel in histogram) {
                const maxCount = Math.max(...histogram[channel]);
                histogram[channel] = histogram[channel].map(count => count / maxCount);
            }
            
            // console.log("🎨 直方图计算完成");
            return histogram;
            
        } catch (error) {
            console.error("🎨 计算直方图时出错:", error);
            return null;
        }
    }
    
    // 绘制直方图背景
    drawHistogram() {
        // 获取图像源
        let imageSource = null;
        let isModal = false;
        
        // 优先使用执行后的图像（工作流运行后的结果）
        if (this.node && this.node._lastOutputImage) {
            imageSource = this.node._lastOutputImage;
        } 
        // 如果有真实节点引用（在模态中），使用真实节点的输出图像
        else if (this.realNode && this.realNode._lastOutputImage) {
            imageSource = this.realNode._lastOutputImage;
            isModal = true;
        }
        // 如果是在模态弹窗中，使用模态的原始图像
        else if (this.node && this.node.curveEditorModal && this.node.curveEditorModal.originalImage) {
            imageSource = this.node.curveEditorModal.originalImage;
            isModal = true;
        }
        // 对于节点上的曲线编辑器，尝试获取输入图像
        else if (this.node && this.node._lastInputImage) {
            imageSource = this.node._lastInputImage;
        }
        // 如果有真实节点引用（在模态中），尝试获取真实节点的输入图像
        else if (this.realNode && this.realNode._lastInputImage) {
            imageSource = this.realNode._lastInputImage;
            isModal = true;
        }
        
        if (!imageSource) {
            // 只在首次尝试时输出日志
            if (!this._histogramWarningShown) {
                console.log("🎨 直方图：无可用图像源");
                this._histogramWarningShown = true;
            }
            return;
        }
        
        // 成功找到图像源后重置警告标记
        this._histogramWarningShown = false;
        
        // 如果图像源改变了，需要重新计算直方图
        if (this._lastHistogramSource !== imageSource) {
            this._histogramDrawn = false;
            this._cachedHistogram = null;
            this._lastHistogramSource = imageSource;
        }
        
        // 获取当前通道
        const currentChannel = this.currentChannel || 'RGB';
        
        // 检查是否需要更新直方图（通道改变或图像改变）
        const needsUpdate = this._lastHistogramChannel !== currentChannel || !this._histogramDrawn;
        
        if (needsUpdate) {
            this._lastHistogramChannel = currentChannel;
            
            // 移除旧的直方图
            const oldHistogram = this.svg.querySelector('.histogram-path');
            if (oldHistogram) {
                oldHistogram.remove();
            }
            
            // 标记需要重绘
            this._histogramDrawn = false;
        }
        
        // 如果已经绘制过且不需要更新，不再重复绘制
        if (this._histogramDrawn && !needsUpdate) {
            return;
        }
        
        // 使用缓存的直方图数据（如果存在）
        let histogram = this._cachedHistogram;
        if (!histogram) {
            // 计算直方图并缓存
            histogram = this.calculateHistogram(imageSource);
            this._cachedHistogram = histogram;
        }
        if (!histogram) {
            return;
        }
        
        // 获取当前通道的直方图数据
        const histogramData = histogram[currentChannel] || histogram.RGB;
        
        // 创建路径数据
        let pathData = 'M0,384';
        for (let i = 0; i < 256; i++) {
            const x = (i / 255) * 384;
            const y = 384 - (histogramData[i] * 200); // 最大高度200像素
            pathData += ` L${x},${y}`;
        }
        pathData += ' L384,384 Z';
        
        // 移除旧的直方图（如果存在）
        const oldHistogram = this.svg.querySelector('.histogram-path');
        if (oldHistogram) {
            oldHistogram.remove();
        }
        
        // 创建直方图路径
        const histogramPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        histogramPath.setAttribute('d', pathData);
        histogramPath.setAttribute('fill', this.getHistogramColor(currentChannel));
        histogramPath.setAttribute('opacity', '0.3');
        histogramPath.setAttribute('stroke', 'none');
        histogramPath.classList.add('histogram-path');
        
        // 添加到SVG（在背景渐变之后，对角线之前）
        const diagonalLine = this.svg.querySelector('line[stroke="#ddd"]');
        if (diagonalLine) {
            this.svg.insertBefore(histogramPath, diagonalLine);
        } else {
            this.svg.appendChild(histogramPath);
        }
        
        // 标记直方图已经绘制
        this._histogramDrawn = true;
    }
    
    // 更新直方图（基于处理后的图像进行实时更新）
    updateHistogramAfterCurveChange() {
        try {
            // 获取处理后的预览图像
            const previewImg = this.modal.querySelector('.preview-image');
            if (!previewImg || !previewImg.src || previewImg.src.includes('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')) {
                console.log("🎨 无有效的预览图像，跳过直方图更新");
                return;
            }
            
            // 获取曲线编辑器
            const curveEditor = this.curveEditor;
            if (!curveEditor || !curveEditor.svg) {
                console.log("🎨 未找到曲线编辑器，跳过直方图更新");
                return;
            }
            
            // 移除现有的直方图路径
            const existingHistogram = curveEditor.svg.querySelector('path[fill*="#ff"][opacity="0.3"], path[fill*="#44"][opacity="0.3"], path[fill="#ffffff"][opacity="0.3"]');
            if (existingHistogram) {
                existingHistogram.remove();
            }
            
            // 基于预览图像重新计算直方图
            const imageElement = new Image();
            imageElement.crossOrigin = 'anonymous';
            
            imageElement.onload = () => {
                try {
                    // 计算新的直方图
                    const histogram = this.calculateHistogram(imageElement);
                    if (!histogram) {
                        console.log("🎨 无法计算处理后图像的直方图");
                        return;
                    }
                    
                    // 获取当前通道
                    const currentChannel = curveEditor.channel ? curveEditor.channel.value : 'RGB';
                    const histogramData = histogram[currentChannel] || histogram.RGB;
                    
                    // 创建新的直方图路径
                    let pathData = 'M0,384';
                    for (let i = 0; i < 256; i++) {
                        const x = (i / 255) * 384;
                        const y = 384 - (histogramData[i] * 200); // 最大高度200像素
                        pathData += ` L${x},${y}`;
                    }
                    pathData += ' L384,384 Z';
                    
                    // 缓存处理后的直方图路径数据
                    curveEditor.processedHistogramPath = pathData;
                    
                    // 直接更新SVG中的直方图，而不是重绘整个曲线编辑器
                    const existingHistogram = curveEditor.svg.querySelector('path[opacity="0.3"]');
                    if (existingHistogram) {
                        // 更新现有直方图的路径
                        existingHistogram.setAttribute('d', pathData);
                        existingHistogram.setAttribute('fill', curveEditor.getHistogramColor(currentChannel));
                        console.log("🎨 直方图实时更新完成，通道:", currentChannel);
                    } else {
                        // 如果没有找到直方图，创建一个新的
                        const histogramPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        histogramPath.setAttribute('d', pathData);
                        histogramPath.setAttribute('fill', curveEditor.getHistogramColor(currentChannel));
                        histogramPath.setAttribute('opacity', '0.3');
                        histogramPath.setAttribute('stroke', 'none');
                        
                        // 插入到适当位置（在对角线之前）
                        const diagonal = curveEditor.svg.querySelector('line[stroke-dasharray]');
                        if (diagonal) {
                            curveEditor.svg.insertBefore(histogramPath, diagonal);
                        } else {
                            // 如果没有对角线，插入到曲线路径之前
                            const curvePath = curveEditor.svg.querySelector('path[stroke="#4ecdc4"]');
                            if (curvePath) {
                                curveEditor.svg.insertBefore(histogramPath, curvePath);
                            } else {
                                curveEditor.svg.appendChild(histogramPath);
                            }
                        }
                        console.log("🎨 新建直方图并更新完成，通道:", currentChannel);
                    }
                    
                } catch (error) {
                    console.error("🎨 计算处理后图像直方图时出错:", error);
                }
            };
            
            imageElement.onerror = () => {
                console.error("🎨 加载预览图像失败，无法更新直方图");
            };
            
            // 开始加载预览图像
            imageElement.src = previewImg.src;
            
        } catch (error) {
            console.error("🎨 更新直方图时出错:", error);
        }
    }
    
    // 获取直方图颜色
    getHistogramColor(channel) {
        const colors = {
            'RGB': '#ffffff',
            'R': '#ff4444',
            'G': '#44ff44',
            'B': '#4444ff'
        };
        return colors[channel] || colors['RGB'];
    }
    
    drawSmoothCurve() {
        if (this.controlPoints.length < 2) return;
        
        // 使用三次样条插值生成曲线点
        const curvePoints = this.generateSplineCurve(this.controlPoints);
        
        if (curvePoints.length < 2) return;
        
        let pathData = `M${curvePoints[0].x},${curvePoints[0].y}`;
        
        // 使用平滑的路径连接所有点
        for (let i = 1; i < curvePoints.length; i++) {
            pathData += ` L${curvePoints[i].x},${curvePoints[i].y}`;
        }
        
        const path = document.createElementNS(this.svg.namespaceURI, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#4ecdc4');
        path.setAttribute('stroke-width', '2');
        this.svg.appendChild(path);
    }
    
    // 生成三次样条曲线点
    generateSplineCurve(points) {
        try {
            const result = [];
            const steps = 384; // 每个像素一个点，确保精确
            
            // 如果只有两个点，使用线性插值
            if (points.length === 2) {
                for (let step = 0; step <= steps; step++) {
                    const t = step / steps;
                    // 注意：这里我们要根据实际点的位置进行插值，而不是假设0-255范围
                    const startX = points[0].x;
                    const endX = points[1].x;
                    const startY = points[0].y;
                    const endY = points[1].y;
                    
                    const x = startX + t * (endX - startX);
                    const y = startY + t * (endY - startY);
                    
                    // 转换到画布坐标
                    const canvasX = (x / 255) * 384;
                    const canvasY = 384 - (y / 255) * 384;
                    const clampedY = Math.max(0, Math.min(384, canvasY));
                    
                    result.push({ x: canvasX, y: clampedY });
                }
                return result;
            }
            
            // 使用自然三次样条插值（类似PS）
            const splineCoeffs = this.calculateNaturalSpline(points);
            
            // 从第一个点到最后一个点进行插值
            const startX = points[0].x;
            const endX = points[points.length - 1].x;
            
            for (let step = 0; step <= steps; step++) {
                // 根据端点的实际位置插值
                const t = step / steps;
                const x = startX + t * (endX - startX);
                const y = this.evaluateNaturalSpline(x, points, splineCoeffs);
                
                // 转换到画布坐标
                const canvasX = (x / 255) * 384;
                const canvasY = 384 - (y / 255) * 384;
                const clampedY = Math.max(0, Math.min(384, canvasY));
                
                result.push({ x: canvasX, y: clampedY });
            }
            
            return result;
        } catch (error) {
            console.error("🎨 生成曲线点失败:", error);
            return [];
        }
    }
    
    // 计算自然三次样条插值系数（更接近PS的算法）
    calculateNaturalSpline(points) {
        const n = points.length;
        if (n < 3) return null;
        
        const h = [];
        const alpha = [];
        const l = [];
        const mu = [];
        const z = [];
        const c = new Array(n).fill(0);
        const b = [];
        const d = [];
        
        // 计算间距
        for (let i = 0; i < n - 1; i++) {
            h[i] = points[i + 1].x - points[i].x;
        }
        
        // 计算alpha值
        for (let i = 1; i < n - 1; i++) {
            alpha[i] = (3 / h[i]) * (points[i + 1].y - points[i].y) - 
                      (3 / h[i - 1]) * (points[i].y - points[i - 1].y);
        }
        
        // 自然边界条件：二阶导数为0
        l[0] = 1;
        mu[0] = 0;
        z[0] = 0;
        
        // 求解三对角矩阵
        for (let i = 1; i < n - 1; i++) {
            l[i] = 2 * (points[i + 1].x - points[i - 1].x) - h[i - 1] * mu[i - 1];
            mu[i] = h[i] / l[i];
            z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
        }
        
        l[n - 1] = 1;
        z[n - 1] = 0;
        c[n - 1] = 0;
        
        // 回代求解
        for (let j = n - 2; j >= 0; j--) {
            c[j] = z[j] - mu[j] * c[j + 1];
            b[j] = (points[j + 1].y - points[j].y) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
            d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
        }
        
        return { b, c, d };
    }
    
    // 计算自然样条函数值
    evaluateNaturalSpline(x, points, coeffs) {
        const n = points.length;
        
        // 边界处理
        if (x <= points[0].x) return points[0].y;
        if (x >= points[n - 1].x) return points[n - 1].y;
        
        // 找到x所在的区间
        let i = 0;
        for (i = 0; i < n - 1; i++) {
            if (x >= points[i].x && x <= points[i + 1].x) {
                break;
            }
        }
        
        // 如果没有系数（只有两个点），使用线性插值
        if (!coeffs) {
            const t = (x - points[i].x) / (points[i + 1].x - points[i].x);
            return points[i].y + t * (points[i + 1].y - points[i].y);
        }
        
        // 计算相对位置
        const dx = x - points[i].x;
        
        // 三次样条公式
        const a = points[i].y;
        const b = coeffs.b[i];
        const c = coeffs.c[i];
        const d = coeffs.d[i];
        
        return a + b * dx + c * dx * dx + d * dx * dx * dx;
    }
    
    // 更新滑块位置
    updateSliderPositions() {
        if (!this.sliderContainer || !this.blackSlider || !this.whiteSlider) return;

        const trackWidth = this.sliderContainer.offsetWidth;
        const blackPoint = this.controlPoints[0];
        const whitePoint = this.controlPoints[this.controlPoints.length - 1];

        if (blackPoint) {
            const blackX = (blackPoint.x / 255) * trackWidth;
            this.blackSlider.style.left = `${blackX}px`;
        }

        if (whitePoint) {
            const whiteX = (whitePoint.x / 255) * trackWidth;
            this.whiteSlider.style.left = `${whiteX}px`;
        }
    }
    
    resetCurve() {
        console.log("🎨 重置曲线开始");
        try {
            // 重置为默认的对角线
            this.controlPoints = [
                { x: 0, y: 0 },
                { x: 255, y: 255 }
            ];
            
            // 重置黑点和白点滑块位置
            this.blackPointX = 0;
            this.whitePointX = 255;
            
            // 更新控件值
            this.updatePointsWidget();
            
            // 重绘曲线
            this.drawCurve();
            
            // 更新状态
            this.updateStatus('重置曲线');
            
            console.log("🎨 曲线已重置为默认状态");
        } catch (error) {
            console.error("🎨 重置曲线失败:", error);
        }
    }
    
    cleanup() {
        try {
            // 移除SVG事件监听器
            if (this.svg) {
                this.svg.removeEventListener('mousedown', this._boundOnMouseDown);
                this.svg.removeEventListener('mousemove', this._boundOnMouseMove);
                this.svg.removeEventListener('mouseup', this._boundOnMouseUp);
                this.svg.removeEventListener('mouseleave', this._boundOnMouseUp);
                this.svg.removeEventListener('dblclick', this._boundOnDoubleClick);
                this.svg.removeEventListener('contextmenu', this._boundOnRightClick);
                this.svg.removeEventListener('selectstart', this._boundPreventSelect);
            }
            
            // 移除滑块事件监听器
            if (this.blackSlider) {
                this.blackSlider.removeEventListener('mousedown', this._boundBlackSliderDrag);
                this.blackSlider.removeEventListener('mouseenter', null);
                this.blackSlider.removeEventListener('mouseleave', null);
            }
            if (this.whiteSlider) {
                this.whiteSlider.removeEventListener('mousedown', this._boundWhiteSliderDrag);
                this.whiteSlider.removeEventListener('mouseenter', null);
                this.whiteSlider.removeEventListener('mouseleave', null);
            }
            document.removeEventListener('mousemove', this._boundBlackSliderDrag);
            document.removeEventListener('mousemove', this._boundWhiteSliderDrag);
            document.removeEventListener('mouseup', this._boundStopSliderDrag);
            
            // 清理其他资源
            this.rgbCurve = null;
            this.redCurve = null;
            this.greenCurve = null;
            this.blueCurve = null;
            this.curveType = null;
            this.channelCurves = null;
            this.currentChannel = null;
            this.controlPoints = null;
            this.selectedPoint = -1;
            this.isDragging = false;
            this.isDraggingBlackSlider = false;
            this.isDraggingWhiteSlider = false;
            
            // 移除DOM元素
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
            
            this.container = null;
            this.channelSelector = null;
            this.channelButtons = null;
            this.svg = null;
            this.sliderContainer = null;
            this.sliderTrack = null;
            this.blackSlider = null;
            this.whiteSlider = null;
            
            console.log("🎨 曲线编辑器已清理");
        } catch (error) {
            console.error("🎨 清理曲线编辑器失败:", error);
        }
    }
    
    // 处理黑点滑块拖动
    handleBlackSliderDrag(e) {
        if (!this.isDraggingBlackSlider) return;
        try {
            const rect = this.sliderContainer.getBoundingClientRect();
            const trackWidth = rect.width; // 现在就是384px
            const minGap = 20; // 最小间距（像素）
            let relativeX = (e.clientX - rect.left) / trackWidth;
            relativeX = Math.max(0, Math.min(relativeX, (this.whitePointX - minGap) / 255));
            const newLeft = relativeX * trackWidth;
            this.blackSlider.style.left = `${newLeft}px`;
            this.blackPointX = Math.round(relativeX * 255);
            if (this.controlPoints.length >= 2) {
                this.controlPoints[0].x = this.blackPointX;
                this.updatePointsWidget();
                this.drawCurve();
            }
        } catch (error) {
            console.error("🎨 处理黑点滑块拖动失败:", error);
        }
    }
    
    // 处理白点滑块拖动
    handleWhiteSliderDrag(e) {
        if (!this.isDraggingWhiteSlider) return;
        try {
            const rect = this.sliderContainer.getBoundingClientRect();
            const trackWidth = rect.width;
            const minGap = 20;
            let relativeX = (e.clientX - rect.left) / trackWidth;
            relativeX = Math.max((this.blackPointX + minGap) / 255, Math.min(relativeX, 1));
            const newLeft = relativeX * trackWidth;
            this.whiteSlider.style.left = `${newLeft}px`;
            this.whiteSlider.style.right = 'auto';
            this.whitePointX = Math.round(relativeX * 255);
            if (this.controlPoints.length >= 2) {
                this.controlPoints[this.controlPoints.length - 1].x = this.whitePointX;
                this.updatePointsWidget();
                this.drawCurve();
            }
        } catch (error) {
            console.error("🎨 处理白点滑块拖动失败:", error);
        }
    }
    
    // 停止滑块拖动
    stopSliderDrag() {
        this.isDraggingBlackSlider = false;
        this.isDraggingWhiteSlider = false;
        // 恢复滑块颜色
        this.blackSlider.style.borderBottomColor = '#4ecdc4';
        this.whiteSlider.style.borderBottomColor = '#4ecdc4';
        document.removeEventListener('mousemove', this._boundBlackSliderDrag);
        document.removeEventListener('mousemove', this._boundWhiteSliderDrag);
        document.removeEventListener('mouseup', this._boundStopSliderDrag);
    }
    
    // 创建滑块容器和滑块
    createSliders() {
        console.log("🎨 创建滑块组件");
        
        // 创建输入范围滑块容器
        this.sliderContainer = document.createElement('div');
        this.sliderContainer.style.cssText = `
            width: 384px;
            height: 30px;
            position: relative;
            background: #1a1a1a;
            border-radius: 2px;
            margin-top: 4px;
            display: block;
        `;

        // 创建黑色滑块
        this.blackSlider = document.createElement('div');
        this.blackSlider.style.cssText = `
            position: absolute;
            width: 12px;
            height: 20px;
            background: #000;
            border: 1px solid #666;
            border-radius: 2px;
            cursor: ew-resize;
            top: 5px;
            left: 0;
        `;

        // 创建白色滑块
        this.whiteSlider = document.createElement('div');
        this.whiteSlider.style.cssText = `
            position: absolute;
            width: 12px;
            height: 20px;
            background: #fff;
            border: 1px solid #666;
            border-radius: 2px;
            cursor: ew-resize;
            top: 5px;
            right: 0;
        `;

        // 添加滑块到容器
        this.sliderContainer.appendChild(this.blackSlider);
        this.sliderContainer.appendChild(this.whiteSlider);
        
        // 设置滑块事件
        this.setupSliderEvents();
        
        console.log("🎨 滑块组件创建完成");
    }
    
    // 设置滑块事件
    setupSliderEvents() {
        console.log("🎨 设置滑块事件");
        
        if (!this.blackSlider || !this.whiteSlider) {
            console.error("🎨 滑块元素未初始化");
            return;
        }
        
        // 绑定事件处理函数
        this._boundBlackSliderDrag = this.handleBlackSliderDrag.bind(this);
        this._boundWhiteSliderDrag = this.handleWhiteSliderDrag.bind(this);
        this._boundStopSliderDrag = this.stopSliderDrag.bind(this);

        // 黑色滑块事件
        this.blackSlider.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isDraggingBlackSlider = true;
            document.addEventListener('mousemove', this._boundBlackSliderDrag);
            document.addEventListener('mouseup', this._boundStopSliderDrag);
            console.log("🎨 黑色滑块开始拖动");
        });

        // 白色滑块事件
        this.whiteSlider.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isDraggingWhiteSlider = true;
            document.addEventListener('mousemove', this._boundWhiteSliderDrag);
            document.addEventListener('mouseup', this._boundStopSliderDrag);
            console.log("🎨 白色滑块开始拖动");
        });

        // 初始化滑块位置
        this.updateSliderPositions();
        
        console.log("🎨 滑块事件设置完成");
    }
    
    createStatusBar() {
        this.statusBar = document.createElement('div');
        this.statusBar.style.cssText = `
            width: 100%;
            height: 20px;
            background: #1a1a1a;
            border-radius: 4px;
            margin-top: 8px;
            padding: 0 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: #888;
        `;

        // 添加状态信息
        this.statusInfo = document.createElement('div');
        this.statusInfo.textContent = '就绪';
        this.statusBar.appendChild(this.statusInfo);

        // 添加坐标信息
        this.coordInfo = document.createElement('div');
        this.coordInfo.textContent = 'X: 0, Y: 0';
        this.statusBar.appendChild(this.coordInfo);
    }

    // 更新状态栏信息
    updateStatus(message) {
        if (this.statusInfo) {
            this.statusInfo.textContent = message;
        }
    }

    // 更新坐标信息
    updateCoordinates(x, y) {
        if (this.coordInfo) {
            this.coordInfo.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
        }
    }

    // 保存历史记录
    saveHistory() {
        if (!this.history) {
            this.history = [];
            this.historyIndex = -1;
        }
        
        // 如果当前不是最新状态，删除后面的历史
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // 保存当前状态
        this.history.push(JSON.parse(JSON.stringify(this.controlPoints)));
        this.historyIndex = this.history.length - 1;
        
        // 限制历史记录数量
        if (this.history.length > 20) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    // 添加激活方法，用于直接在节点上编辑
    activate() {
        console.log("在节点上直接编辑曲线");
        // 如果需要，这里可以添加高亮或其他视觉提示
    }
}

// 注册扩展
console.log("🎨 开始注册扩展...");

// 注意：直方图不会显示在曲线编辑器中，但会显示在curve_chart输出中
// 这样可以保持UI简洁，同时保留直方图功能

app.registerExtension({
    name: "PhotoshopCurveNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 精确匹配节点名称，确保只修改目标节点
        if (nodeData.name !== "PhotoshopCurveNode") {
            return;
        }
        
        console.log("🎨 注册PhotoshopCurveNode节点处理...");
            
        // 保存节点原始的onNodeCreated方法
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            
        // 修改节点的创建方法
        nodeType.prototype.onNodeCreated = function() {
            console.log("🎨 PhotoshopCurveNode 节点创建开始");
            
            // 调用原始onNodeCreated
            if (originalOnNodeCreated) {
                originalOnNodeCreated.apply(this, arguments);
            }
            
            // 初始化尺寸，确保有足够的空间
            this.size = this.size || [400, 550];
            if (this.size[0] < 400) this.size[0] = 400;
            if (this.size[1] < 550) this.size[1] = 550;
            
            // 设置默认弹窗尺寸
            if (!this.properties.hasOwnProperty('modal_width')) {
                this.properties.modal_width = 1600;
            }
            if (!this.properties.hasOwnProperty('modal_height')) {
                this.properties.modal_height = 1200;
            }
            
            // 删除可能存在的控件（以防刷新后出现）
            const widthWidgetIndex = this.widgets.findIndex(w => w.name === 'modal_width');
            if (widthWidgetIndex !== -1) {
                this.widgets.splice(widthWidgetIndex, 1);
            }
            
            const heightWidgetIndex = this.widgets.findIndex(w => w.name === 'modal_height');
            if (heightWidgetIndex !== -1) {
                this.widgets.splice(heightWidgetIndex, 1);
            }
            
            // 隐藏曲线widgets但保持其可序列化
            ['rgb_curve', 'red_curve', 'green_curve', 'blue_curve'].forEach(widgetName => {
                const widget = this.widgets.find(w => w.name === widgetName);
                if (widget) {
                    // 不改变widget类型，只是视觉上隐藏
                    widget.computeSize = () => [0, -4]; // 让widget不占用空间
                    if (widget.element) {
                        widget.element.style.display = 'none';
                    }
                    // 保存原始类型以确保序列化正常
                    widget._originalType = widget.type;
                    // 添加序列化标记
                    widget.serialize = true;
                }
            });
            
            // 立即创建曲线编辑器，不使用setTimeout
            console.log("🎨 创建曲线编辑器实例");
            try {
                // 检查是否已经有曲线编辑器
                if (!this.curveEditor) {
                    this.curveEditor = new PhotoshopCurveNodeWidget(this);
                    console.log("🎨 节点上的曲线编辑器创建成功");
                    
                    // 强制更新节点尺寸和位置
                    if (this.graph) {
                        this.graph.setDirtyCanvas(true, true);
                    }
                }
            } catch (error) {
                console.error("🎨 创建曲线编辑器失败:", error);
            }
        }
        
        // 添加onExecuted回调来更新连接的下游节点
        const originalOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function(message) {
            console.log("🎨 PhotoshopCurveNode.onExecuted 触发", this.id, message);
            
            // 调用原始的onExecuted
            if (originalOnExecuted) {
                originalOnExecuted.apply(this, arguments);
            }
            
            // 处理输出图像，更新连接的下游节点
            if (message && message.images && message.images.length > 0) {
                const convertToImageUrl = (imageData) => {
                    if (typeof imageData === 'string') {
                        return imageData;
                    }
                    if (imageData && typeof imageData === 'object' && imageData.filename) {
                        const baseUrl = window.location.origin;
                        let url = `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}`;
                        if (imageData.subfolder) {
                            url += `&subfolder=${encodeURIComponent(imageData.subfolder)}`;
                        }
                        if (imageData.type) {
                            url += `&type=${encodeURIComponent(imageData.type)}`;
                        }
                        return url;
                    }
                    return imageData;
                };
                
                const imageUrl = convertToImageUrl(message.images[0]);
                this._lastOutputImage = imageUrl;
                
                // 更新连接到此节点的下游节点（包括HSL节点）
                if (this.outputs && this.outputs[0] && this.outputs[0].links) {
                    this.outputs[0].links.forEach(linkId => {
                        const link = app.graph.links[linkId];
                        if (link) {
                            const targetNode = app.graph.getNodeById(link.target_id);
                            if (targetNode) {
                                console.log(`🎨 PS Curve节点 ${this.id} 更新下游节点 ${targetNode.id} (${targetNode.type})`);
                                
                                // 更新目标节点的输入图像缓存
                                targetNode._lastInputImage = imageUrl;
                                
                                // 如果是PS Curve节点，还需要更新imgs属性
                                if (targetNode.type === "PhotoshopCurveNode" && targetNode.imgs) {
                                    // 只有在节点已经有imgs属性时才更新
                                    targetNode.imgs = message.images.map(img => ({
                                        src: convertToImageUrl(img)
                                    }));
                                }
                                
                                // 如果目标节点有模态弹窗打开，立即更新图像
                                if (targetNode.type === "PhotoshopHSLNode" && targetNode._hslModal && targetNode._hslModal.isOpen) {
                                    console.log("🎨 更新HSL节点的模态弹窗图像");
                                    targetNode._hslModal.setInputImage(imageUrl);
                                }
                            }
                        }
                    });
                }
            }
        };
        
        // 保存原始的onRemoved方法
        const originalOnRemoved = nodeType.prototype.onRemoved;
        
        // 添加清理方法
        nodeType.prototype.onRemoved = function() {
            // 调用原始onRemoved
            if (originalOnRemoved) {
                originalOnRemoved.apply(this, arguments);
            }
            
            // 清理曲线编辑器
            if (this.curveEditor) {
                this.curveEditor.cleanup();
                this.curveEditor = null;
            }
            
            // 清理模态弹窗
            if (this.curveEditorModal) {
                const modal = document.getElementById(`curve-editor-modal-${this.id}`);
                if (modal) {
                    modal.remove();
                }
                this.curveEditorModal = null;
            }
        };
        
        // 修改节点的onDrawBackground方法，确保正确处理曲线编辑器的尺寸
        const originalOnDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function(ctx) {
            if (originalOnDrawBackground) {
                originalOnDrawBackground.apply(this, arguments);
            }
            
            // 调整曲线编辑器大小
            if (this.curveEditor && this.curveEditor.container) {
                const curveEditorWidget = this.widgets.find(w => w.name === 'curve_editor');
                if (curveEditorWidget) {
                    if (this.size[0] < 400) {
                        this.size[0] = 400;
                    }
                    if (this.size[1] < 550) {
                        this.size[1] = 550;
                    }
                    
                    // 调整宽度
                    const width = this.size[0] * 0.9;
                    if (this.curveEditor.container.style.width !== width + "px") {
                        this.curveEditor.container.style.width = width + "px";
                        this.curveEditor.drawCurve();
                    }
                }
            }
        }
        
        // 修改节点的onResize方法，当大小变化时重绘曲线
        const originalOnResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function(size) {
            if (originalOnResize) {
                originalOnResize.apply(this, arguments);
            }
            
            if (this.curveEditor) {
                this.curveEditor.drawCurve();
            }
        }
        
        // 保存原始的onExecuted方法
        const origOnExecuted = nodeType.prototype.onExecuted;
        
        // 添加processNode方法，处理节点执行
        nodeType.prototype.onExecuted = async function(message) {
            console.log("🎨 PS Curve节点执行，接收到消息:", message);
            
            // 调用原始方法（如果存在）
            if (origOnExecuted) {
                origOnExecuted.apply(this, arguments);
            }
            
            // 立即缓存当前消息中的图像数据（关键修复）
            if (message && message.images && message.images.length > 0) {
                // 转换图像数据为URL格式
                const convertToImageUrl = (imageData) => {
                    if (typeof imageData === 'string') {
                        return imageData;
                    }
                    if (imageData && typeof imageData === 'object' && imageData.filename) {
                        const baseUrl = window.location.origin;
                        let url = `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}`;
                        if (imageData.subfolder) {
                            url += `&subfolder=${encodeURIComponent(imageData.subfolder)}`;
                        }
                        if (imageData.type) {
                            url += `&type=${encodeURIComponent(imageData.type)}`;
                        }
                        return url;
                    }
                    return imageData;
                };
                
                this._lastInputImage = convertToImageUrl(message.images[0]);
                this.imgs = message.images.map(imageData => ({ 
                    src: convertToImageUrl(imageData)
                }));
                console.log("🎨 onExecuted立即缓存图像:", message.images.length, "个，转换后URL:", this._lastInputImage);
                
                // 同时更新全局缓存
                if (!app.nodeOutputs) {
                    app.nodeOutputs = {};
                }
                app.nodeOutputs[this.id] = { images: message.images };
                window.globalNodeCache.set(this.id, { images: message.images });
                
                console.log("🎨 已将图像数据同步到全局缓存，节点ID:", this.id);
            }
            
            // 缓存遮罩数据
            if (message && (message.mask || message.masks)) {
                const maskData = message.mask || message.masks[0];
                if (maskData) {
                    this._lastInputMask = maskData;
                    console.log("🎨 onExecuted缓存遮罩数据");
                }
            }
            
            // 始终缓存输入图像和遮罩（不仅仅在模态弹窗模式下）
            if (message) {
                console.log("🎨 onExecuted消息完整内容:", message);
                
                // 对于PS Curve节点，我们需要缓存连接到它的图像数据
                // 这可能来自 LoadImage 或者其他处理节点的输出
                let imageToCache = null;
                
                // 方式1: 传统的输入图像字段
                if (message.bg_image || message.image) {
                    imageToCache = message.bg_image || message.image;
                    console.log("🎨 从 bg_image/image 字段缓存图像");
                }
                // 方式2: 从输出图像数组获取第一个
                else if (message.images && message.images.length > 0) {
                    imageToCache = message.images[0];
                    console.log("🎨 从 images 数组缓存图像");
                }
                
                if (imageToCache) {
                    this._lastInputImage = imageToCache;
                    console.log("🎨 缓存输入图像:", typeof imageToCache, 
                        typeof imageToCache === 'string' ? imageToCache.substring(0, 50) + '...' : imageToCache);
                    
                    // 如果当前节点有输出图像，也存储到imgs中
                    if (message.images && message.images.length > 0) {
                        this.imgs = message.images.map(src => ({ src }));
                        console.log("🎨 存储输出图像到节点imgs:", this.imgs.length, "个图像");
                    }
                }
                
                // 缓存遮罩数据
                const maskData = message.mask || message.masks?.[0];
                if (maskData) {
                    this._lastInputMask = maskData;
                    console.log("🎨 缓存输入遮罩:", typeof maskData);
                }
            }
            
            // 默认使用模态弹窗
            try {
                // 从消息中获取图像数据
                const imageData = message.bg_image || message.image;
                
                if (!imageData) {
                    console.error("🎨 消息中没有图像数据");
                    return;
                }
                
                // 获取遮罩数据（如果有）
                const maskData = message.mask;
                console.log("🎨 遮罩数据:", maskData ? "存在" : "不存在");
                
                // 添加更多的调试信息
                if (maskData) {
                    console.log("🎨 遮罩数据类型:", typeof maskData);
                    if (typeof maskData === 'string' && maskData.startsWith('data:')) {
                        console.log("🎨 遮罩数据是 Data URL, 长度:", maskData.length);
                        console.log("🎨 遮罩数据前缀:", maskData.substring(0, 50) + "...");
                    } else if (maskData instanceof Image) {
                        console.log("🎨 遮罩数据是 Image 对象, 尺寸:", maskData.width, "x", maskData.height);
                    } else {
                        console.log("🎨 遮罩数据是其他类型:", Object.prototype.toString.call(maskData));
                    }
                }
                
                // 如果已经有模态弹窗，先关闭它
                if (this.curveEditorModal && this.curveEditorModal.isOpen) {
                    console.log("🎨 关闭已存在的模态弹窗");
                    this.curveEditorModal.close();
                    // 删除旧的模态弹窗
                    delete this.curveEditorModal;
                    this.curveEditorModal = null;
                }
                
                // 创建模态弹窗（如果不存在）
                console.log("🎨 创建新的模态弹窗");
                
                // 固定使用1600×1200尺寸
                const modalWidth = 1600;
                const modalHeight = 1200;
                
                // 保存这些尺寸供下次使用
                this.properties.modal_width = modalWidth;
                this.properties.modal_height = modalHeight;
                
                // 更新UI小部件的值
                const widgetWidth = this.widgets.find(w => w.name === 'modal_width');
                const widgetHeight = this.widgets.find(w => w.name === 'modal_height');
                if (widgetWidth) widgetWidth.value = modalWidth;
                if (widgetHeight) widgetHeight.value = modalHeight;
                
                this.curveEditorModal = new CurveEditorModal(this, {
                    width: modalWidth,
                    height: modalHeight
                });
                
                // 打开模态弹窗，传递图像和遮罩数据
                console.log("🎨 打开模态弹窗");
                setTimeout(() => {
                    this.curveEditorModal.open(imageData, maskData);
                }, 50);
            } catch (error) {
                console.error("🎨 显示模态弹窗失败:", error);
            }
        }

        // 修改右键菜单选项
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            options.unshift(
                {
                    content: "📊 打开曲线编辑器",
                    callback: () => {
                        // 创建并打开模态弹窗
                        if (!this.curveEditorModal) {
                            // 固定使用1600×1200尺寸
                            const modalWidth = 1600;
                            const modalHeight = 1200;
                            
                            // 保存这些尺寸供下次使用
                            this.properties.modal_width = modalWidth;
                            this.properties.modal_height = modalHeight;
                            
                            // 不再需要更新UI控件，因为它们已被移除
                            // const widgetWidth = this.widgets.find(w => w.name === 'modal_width');
                            // const widgetHeight = this.widgets.find(w => w.name === 'modal_height');
                            // if (widgetWidth) widgetWidth.value = modalWidth;
                            // if (widgetHeight) widgetHeight.value = modalHeight;
                            
                            this.curveEditorModal = new CurveEditorModal(this, {
                                width: modalWidth,
                                height: modalHeight
                            });
                        }
                            
                            // 请求获取输入图像
                            const inputLink = this.getInputLink(0);
                            if (!inputLink) {
                                alert("请先连接输入图像！");
                                return;
                            }
                            
                            // 获取图像URL和遮罩URL
                            let imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
                            let maskUrl = null;
                            
                            // 最高优先级：使用后端发送的预览图像
                            if (this._previewImageUrl && typeof this._previewImageUrl === 'string') {
                                imageUrl = this._previewImageUrl;
                                console.log("🎨 使用后端发送的预览图像:", imageUrl.substring(0, 50) + '...');
                            }
                            // 其次使用缓存的输入图像
                            else if (this._lastInputImage && typeof this._lastInputImage === 'string') {
                                imageUrl = this._lastInputImage;
                                console.log("🎨 使用缓存的输入图像:", imageUrl.substring(0, 50) + '...');
                            }
                            // 最后尝试从节点输入获取图像
                            else if (this.inputs && this.inputs.length > 0) {
                                const imageInput = this.inputs[0];
                                if (imageInput && imageInput.link) {
                                    const linkInfo = app.graph.links[imageInput.link];
                                    if (linkInfo) {
                                        const originNode = app.graph.getNodeById(linkInfo.origin_id);
                                        if (originNode && originNode.imgs && originNode.imgs.length > 0) {
                                            imageUrl = originNode.imgs[0].src;
                                        }
                                    }
                                }
                            }
                            
                            // 优先使用后端发送的预览遮罩
                            if (this._previewMaskUrl && typeof this._previewMaskUrl === 'string') {
                                maskUrl = this._previewMaskUrl;
                                console.log("🎨 使用后端发送的预览遮罩:", maskUrl.substring(0, 50) + '...');
                            }
                            // 其次使用缓存的遮罩
                            else if (this._lastInputMask && typeof this._lastInputMask === 'string') {
                                maskUrl = this._lastInputMask;
                                console.log("🎨 使用缓存的输入遮罩:", maskUrl.substring(0, 50) + '...');
                            }
                            // 最后尝试获取遮罩输入
                            else if (this.inputs) {
                                const maskInput = this.inputs.find(input => input.name === "mask");
                                if (maskInput && maskInput.link) {
                                    const maskLinkInfo = app.graph.links[maskInput.link];
                                    if (maskLinkInfo) {
                                        const maskOriginNode = app.graph.getNodeById(maskLinkInfo.origin_id);
                                        if (maskOriginNode && maskOriginNode.imgs && maskOriginNode.imgs.length > 0) {
                                            maskUrl = maskOriginNode.imgs[0].src;
                                        }
                                    }
                                }
                            }
                            
                            // 打开模态弹窗，传递图像和遮罩
                            this.curveEditorModal.open(imageUrl, maskUrl);
                    }
                }
            );
            return options;
        };
        
        // 修改双击行为 - 修复这部分代码
        // 添加序列化方法确保widget值被保存
        const origSerialize = nodeType.prototype.serialize;
        nodeType.prototype.serialize = function() {
            const data = origSerialize ? origSerialize.apply(this, arguments) : {};
            
            // 确保包含所有曲线widget的值
            if (this.curveEditor && this.curveEditor.channelCurves) {
                // 从curveEditor获取最新的曲线数据
                const curves = this.curveEditor.channelCurves;
                
                // 更新widget值
                const rgbWidget = this.widgets.find(w => w.name === 'rgb_curve');
                const redWidget = this.widgets.find(w => w.name === 'red_curve');
                const greenWidget = this.widgets.find(w => w.name === 'green_curve');
                const blueWidget = this.widgets.find(w => w.name === 'blue_curve');
                
                if (rgbWidget) rgbWidget.value = JSON.stringify(curves.RGB || [[0,0],[255,255]]);
                if (redWidget) redWidget.value = JSON.stringify(curves.R || [[0,0],[255,255]]);
                if (greenWidget) greenWidget.value = JSON.stringify(curves.G || [[0,0],[255,255]]);
                if (blueWidget) blueWidget.value = JSON.stringify(curves.B || [[0,0],[255,255]]);
            }
            
            // 确保widget_values包含所有值
            if (!data.widgets_values) {
                data.widgets_values = [];
            }
            
            // 手动添加曲线widget的值到序列化数据
            this.widgets.forEach((w, i) => {
                if (w.name.includes('curve') && w.value) {
                    data.widgets_values[i] = w.value;
                }
            });
            
            return data;
        };
        
        const origOnDblClick = nodeType.prototype.onDblClick;
        nodeType.prototype.onDblClick = function(e, pos, graphCanvas) {
            console.log("🎨 节点双击事件触发", this.id);
            
            // 调用原始的onDblClick方法
            if (origOnDblClick) {
                origOnDblClick.apply(this, arguments);
            }
            
            // 阻止事件冒泡和默认行为
            e.stopPropagation();
            e.preventDefault();
            
            // 获取图像URL
            let imageUrl = "";
            let maskUrl = null;
            
            // 首先检查是否有缓存的数据
            console.log("🎨 检查缓存数据:", {
                _previewImageUrl: !!this._previewImageUrl,
                _previewMaskUrl: !!this._previewMaskUrl,
                _lastInputImage: !!this._lastInputImage,
                _lastInputMask: !!this._lastInputMask,
                imgs: this.imgs?.length || 0,
                nodeOutputs: Object.keys(app.nodeOutputs || {})
            });
            
            // 最高优先级：使用后端发送的预览图像
            if (this._previewImageUrl && typeof this._previewImageUrl === 'string') {
                imageUrl = this._previewImageUrl;
                console.log("🎨 使用后端发送的预览图像:", imageUrl.substring(0, 50) + '...');
            }
            // 其次使用缓存的输入图像
            else if (this._lastInputImage && typeof this._lastInputImage === 'string') {
                imageUrl = this._lastInputImage;
                console.log("🎨 使用缓存的输入图像:", imageUrl.substring(0, 50) + '...');
            }
            
            // 优先使用后端发送的预览遮罩
            if (this._previewMaskUrl && typeof this._previewMaskUrl === 'string') {
                maskUrl = this._previewMaskUrl;
                console.log("🎨 使用后端发送的预览遮罩:", maskUrl.substring(0, 50) + '...');
            }
            // 其次使用缓存的遮罩
            else if (this._lastInputMask && typeof this._lastInputMask === 'string') {
                maskUrl = this._lastInputMask;
                console.log("🎨 使用缓存的输入遮罩:", maskUrl.substring(0, 50) + '...');
            }
            
            // 尝试从节点输入获取图像
            if (!imageUrl && this.inputs && this.inputs.length > 0) {
                console.log("🎨 节点有输入，开始查找图像源");
                const imageInput = this.inputs[0];
                if (imageInput && imageInput.link) {
                    const linkInfo = app.graph.links[imageInput.link];
                    console.log("🎨 找到链接信息:", linkInfo);
                    if (linkInfo) {
                        const originNode = app.graph.getNodeById(linkInfo.origin_id);
                        console.log("🎨 源节点:", originNode?.type, "ID:", originNode?.id);
                        
                        // 改进的图像获取逻辑，支持所有类型的节点
                        if (originNode) {
                            console.log("🎨 分析源节点类型:", originNode.type, "， 可用属性:", Object.keys(originNode));
                            
                            // 检查节点的小部件是否有图像预览
                            if (originNode.widgets) {
                                originNode.widgets.forEach(widget => {
                                    console.log("🎨 检查小部件:", widget.name, widget.type, widget.value);
                                    if (widget.type === "image" && widget.value) {
                                        console.log("🎨 发现图像小部件:", widget.value);
                                    }
                                });
                            }
                            
                            // 检查是否有image属性
                            if (originNode.image) {
                                console.log("🎨 发现节点image属性:", originNode.image);
                            }
                            
                            // 检查是否有images属性
                            if (originNode.images) {
                                console.log("🎨 发现节点images属性:", originNode.images);
                            }
                            
                            // 辅助函数：安全地显示URL信息
                            const safeUrlLog = (url, source) => {
                                if (typeof url === 'string' && url.length > 0) {
                                    console.log(`🎨 ${source}:`, url.substring(0, 50) + "...");
                                } else {
                                    console.log(`🎨 ${source}:`, typeof url, url);
                                }
                            };
                            
                            // 辅助函数：将ComfyUI文件信息转换为URL
                            const convertToImageUrl = (imageData) => {
                                if (typeof imageData === 'string') {
                                    return imageData; // 已经是URL
                                }
                                if (imageData && typeof imageData === 'object') {
                                    // ComfyUI文件信息格式：{filename: "xxx.png", subfolder: "", type: "temp"}
                                    if (imageData.filename) {
                                        const baseUrl = window.location.origin;
                                        let url = `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}`;
                                        if (imageData.subfolder) {
                                            url += `&subfolder=${encodeURIComponent(imageData.subfolder)}`;
                                        }
                                        if (imageData.type) {
                                            url += `&type=${encodeURIComponent(imageData.type)}`;
                                        }
                                        console.log(`🎨 转换文件信息为URL: ${imageData.filename} -> ${url}`);
                                        return url;
                                    }
                                }
                                return null;
                            };
                            
                            // 方法0: 从我们的自定义属性获取（最高优先级）
                            if (originNode._curveNodeImageUrls && originNode._curveNodeImageUrls.length > 0) {
                                console.log("🎨 发现源节点有_curveNodeImageUrls属性");
                                imageUrl = originNode._curveNodeImageUrls[0];
                                safeUrlLog(imageUrl, "从自定义属性获取图像URL");
                            }
                            // 方法0.1: 从原有的imgs属性获取
                            else if (originNode.imgs && originNode.imgs.length > 0) {
                                console.log("🎨 发现源节点有imgs属性，直接获取");
                                imageUrl = originNode.imgs[0].src;
                                safeUrlLog(imageUrl, "从源节点imgs属性获取图像URL");
                            }
                            // 方法0.5: 从ComfyUI的UI系统获取
                            else if (app.nodeOutputs && app.nodeOutputs[originNode.id]) {
                                const nodeOutput = app.nodeOutputs[originNode.id];
                                if (nodeOutput.images && nodeOutput.images.length > 0) {
                                    imageUrl = convertToImageUrl(nodeOutput.images[0]);
                                    safeUrlLog(imageUrl, "从app.nodeOutputs获取源节点图像");
                                }
                            }
                            // 方法1: 从全局缓存获取（适用于所有处理节点）
                            else if (window.globalNodeCache && window.globalNodeCache.has(String(originNode.id))) {
                                const cachedData = window.globalNodeCache.get(String(originNode.id));
                                if (cachedData.images && cachedData.images.length > 0) {
                                    imageUrl = convertToImageUrl(cachedData.images[0]);
                                    safeUrlLog(imageUrl, "从全局缓存获取图像URL (节点 " + originNode.id + ")");
                                }
                            }
                            // 方法2: 从缓存的输入图像获取（当前节点的缓存）
                            else if (this._lastInputImage) {
                                imageUrl = this._lastInputImage;
                                safeUrlLog(imageUrl, "从缓存的输入图像获取URL");
                            }
                            // 方法4: 从节点的输出数据获取
                            else if (app.nodeOutputs && app.nodeOutputs[originNode.id]) {
                                const nodeOutputs = app.nodeOutputs[originNode.id];
                                console.log("🎨 节点输出数据结构:", nodeOutputs);
                                if (nodeOutputs.images && nodeOutputs.images.length > 0) {
                                    imageUrl = convertToImageUrl(nodeOutputs.images[0]);
                                    safeUrlLog(imageUrl, "从 nodeOutputs 获取图像URL");
                                }
                            }
                            // 方法3.5: 尝试从当前节点本身的输出数据获取
                            else if (app.nodeOutputs && app.nodeOutputs[this.id]) {
                                const thisNodeOutputs = app.nodeOutputs[this.id];
                                console.log("🎨 当前节点输出数据:", thisNodeOutputs);
                                if (thisNodeOutputs.images && thisNodeOutputs.images.length > 0) {
                                    imageUrl = convertToImageUrl(thisNodeOutputs.images[0]);
                                    safeUrlLog(imageUrl, "从当前节点输出获取图像URL");
                                }
                            }
                            // 方法4: 从 last_node_outputs 获取
                            else if (app.graph.last_node_outputs && app.graph.last_node_outputs[originNode.id]) {
                                const outputs = app.graph.last_node_outputs[originNode.id];
                                if (outputs.images && outputs.images.length > 0) {
                                    imageUrl = convertToImageUrl(outputs.images[0]);
                                    safeUrlLog(imageUrl, "从 last_node_outputs 获取图像URL");
                                }
                            }
                            // 方法5: 从源节点的 properties 或其他属性查找
                            else if (originNode.properties && originNode.properties.image) {
                                imageUrl = originNode.properties.image;
                                safeUrlLog(imageUrl, "从节点 properties 获取图像URL");
                            }
                            // 方法6: 尝试从全局历史或缓存中获取 - 但只获取连接的源节点
                            else {
                                console.log("🎨 尝试从全局缓存获取源节点的图像...");
                                console.log("🎨 目标源节点ID:", originNode.id);
                                console.log("🎨 可用的全局缓存节点:", Array.from(window.globalNodeCache?.keys() || []));
                                console.log("🎨 可用的节点输出:", Object.keys(app.nodeOutputs || {}));
                                
                                // 只从连接的源节点获取图像
                                const sourceNodeId = String(originNode.id);
                                
                                // 方法6.1: 主动从last_node_outputs获取（新增）
                                if (app.graph.last_node_outputs && app.graph.last_node_outputs[sourceNodeId]) {
                                    const outputs = app.graph.last_node_outputs[sourceNodeId];
                                    console.log(`🎨 从last_node_outputs找到源节点 ${sourceNodeId} 的数据:`, outputs);
                                    if (outputs.images && outputs.images.length > 0) {
                                        imageUrl = convertToImageUrl(outputs.images[0]);
                                        console.log("🎨 从last_node_outputs获取源节点图像URL (节点", sourceNodeId, "):");
                                        safeUrlLog(imageUrl, "图像数据类型检查");
                                        
                                        // 同时更新缓存
                                        window.globalNodeCache.set(sourceNodeId, outputs);
                                        if (!app.nodeOutputs) {
                                            app.nodeOutputs = {};
                                        }
                                        app.nodeOutputs[sourceNodeId] = outputs;
                                        
                                        // 更新节点的自定义属性
                                        originNode._curveNodeImageUrls = outputs.images.map(img => convertToImageUrl(img));
                                    }
                                }
                                
                                // 方法6.2: 从全局缓存获取源节点的图像
                                if (!imageUrl && window.globalNodeCache && window.globalNodeCache.has(sourceNodeId)) {
                                    const cachedData = window.globalNodeCache.get(sourceNodeId);
                                    console.log(`🎨 找到源节点 ${sourceNodeId} 的缓存数据:`, cachedData);
                                    if (cachedData.images && cachedData.images.length > 0) {
                                        imageUrl = convertToImageUrl(cachedData.images[0]);
                                        console.log("🎨 从全局缓存获取源节点图像URL (节点", sourceNodeId, "):");
                                        safeUrlLog(imageUrl, "图像数据类型检查");
                                    }
                                }
                                
                                // 方法6.3: 从app.nodeOutputs获取
                                if (!imageUrl && app.nodeOutputs && app.nodeOutputs[sourceNodeId]) {
                                    const nodeData = app.nodeOutputs[sourceNodeId];
                                    console.log(`🎨 找到源节点 ${sourceNodeId} 的输出数据:`, nodeData);
                                    if (nodeData.images && nodeData.images.length > 0) {
                                        imageUrl = convertToImageUrl(nodeData.images[0]);
                                        console.log("🎨 从节点输出获取源节点图像URL (节点", sourceNodeId, "):");
                                        safeUrlLog(imageUrl, "图像数据类型检查");
                                    }
                                }
                                
                                // 如果还是没找到，显示调试信息
                                if (!imageUrl) {
                                    console.warn(`🎨 警告：无法从源节点 ${sourceNodeId} 获取图像数据`);
                                    console.log("🎨 全局缓存中是否存在该节点:", window.globalNodeCache?.has(sourceNodeId));
                                    console.log("🎨 app.nodeOutputs中是否存在该节点:", !!app.nodeOutputs?.[sourceNodeId]);
                                    console.log("🎨 last_node_outputs中是否存在该节点:", !!app.graph.last_node_outputs?.[sourceNodeId]);
                                    
                                    // 尝试输出更多调试信息
                                    if (app.graph.last_node_outputs) {
                                        console.log("🎨 last_node_outputs中的所有节点:", Object.keys(app.graph.last_node_outputs));
                                    }
                                    
                                    // 最后的尝试：获取最新的执行历史
                                    console.log("🎨 尝试获取最新的执行历史...");
                                    
                                    // 方法1: 获取最新的历史记录
                                    fetch(`/history`)
                                        .then(res => res.json())
                                        .then(history => {
                                            console.log("🎨 获取到历史记录");
                                            // 找到最新的prompt
                                            const historyArray = Object.entries(history || {});
                                            if (historyArray.length > 0) {
                                                // 按时间戳排序，获取最新的
                                                historyArray.sort((a, b) => {
                                                    const timeA = a[1].timestamp || 0;
                                                    const timeB = b[1].timestamp || 0;
                                                    return timeB - timeA;
                                                });
                                                
                                                const [latestPromptId, latestData] = historyArray[0];
                                                console.log("🎨 最新的prompt ID:", latestPromptId);
                                                
                                                console.log("🎨 检查最新执行的所有节点输出:", Object.keys(latestData.outputs || {}));
                                                
                                                if (latestData && latestData.outputs && latestData.outputs[sourceNodeId]) {
                                                    const nodeOutput = latestData.outputs[sourceNodeId];
                                                    console.log(`🎨 从历史记录找到节点 ${sourceNodeId} 的输出:`, nodeOutput);
                                                    
                                                    if (nodeOutput.images && nodeOutput.images.length > 0) {
                                                        // 立即更新缓存和显示
                                                        const imageUrl = convertToImageUrl(nodeOutput.images[0]);
                                                        console.log("🎨 从历史记录获取到图像URL:", imageUrl);
                                                        
                                                        // 更新节点的自定义属性
                                                        originNode._curveNodeImageUrls = nodeOutput.images.map(img => convertToImageUrl(img));
                                                        
                                                        // 更新全局缓存
                                                        window.globalNodeCache.set(sourceNodeId, nodeOutput);
                                                        if (!app.nodeOutputs) {
                                                            app.nodeOutputs = {};
                                                        }
                                                        app.nodeOutputs[sourceNodeId] = nodeOutput;
                                                        
                                                        // 如果当前弹窗还在等待，立即更新
                                                        if (this.curveEditorModal && this.curveEditorModal.isOpen) {
                                                            console.log("🎨 立即更新弹窗图像");
                                                            this.curveEditorModal.setInputImage(imageUrl);
                                                        }
                                                    }
                                                } else {
                                                    console.log(`🎨 节点 ${sourceNodeId} 在最新执行中没有输出`);
                                                    
                                                    // 尝试查找上游节点
                                                    console.log("🎨 尝试查找节点23的上游节点...");
                                                    const nodeInputs = originNode.inputs;
                                                    if (nodeInputs && nodeInputs.length > 0) {
                                                        const imageInput = nodeInputs[0];
                                                        if (imageInput && imageInput.link) {
                                                            const upstreamLinkInfo = app.graph.links[imageInput.link];
                                                            if (upstreamLinkInfo) {
                                                                const upstreamNodeId = String(upstreamLinkInfo.origin_id);
                                                                console.log(`🎨 找到上游节点: ${upstreamNodeId}`);
                                                                
                                                                if (latestData.outputs && latestData.outputs[upstreamNodeId]) {
                                                                    const upstreamOutput = latestData.outputs[upstreamNodeId];
                                                                    console.log(`🎨 从历史记录找到上游节点 ${upstreamNodeId} 的输出:`, upstreamOutput);
                                                                    
                                                                    if (upstreamOutput.images && upstreamOutput.images.length > 0) {
                                                                        const imageUrl = convertToImageUrl(upstreamOutput.images[0]);
                                                                        console.log("🎨 使用上游节点的图像:", imageUrl);
                                                                        
                                                                        // 如果当前弹窗还在等待，立即更新
                                                                        if (this.curveEditorModal && this.curveEditorModal.isOpen) {
                                                                            console.log("🎨 立即更新弹窗图像（使用上游节点）");
                                                                            this.curveEditorModal.setInputImage(imageUrl);
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        })
                                        .catch(err => console.error("🎨 获取历史记录失败:", err));
                                }
                                
                                // 如果还是没有找到，尝试从 originNode 的其他属性查找
                                if (!imageUrl) {
                                    console.log("🎨 最后尝试: 从originNode的所有属性中查找图像");
                                    for (const [key, value] of Object.entries(originNode)) {
                                        if (key.toLowerCase().includes('image') || key.toLowerCase().includes('img')) {
                                            console.log(`🎨 发现可能的图像属性 ${key}:`, value);
                                            if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http') || value.startsWith('/'))) {
                                                imageUrl = value;
                                                console.log("🎨 使用属性", key, "作为图像URL");
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 尝试获取遮罩输入
                const maskInput = this.inputs.find(input => input.name === "mask");
                if (!maskUrl && maskInput && maskInput.link) {
                    const maskLinkInfo = app.graph.links[maskInput.link];
                    if (maskLinkInfo) {
                        const maskOriginNode = app.graph.getNodeById(maskLinkInfo.origin_id);
                        
                        // 首先尝试从节点的 imgs 属性获取
                        if (maskOriginNode && maskOriginNode.imgs && maskOriginNode.imgs.length > 0) {
                            maskUrl = maskOriginNode.imgs[0].src;
                            console.log("🎨 从输入节点的imgs获取遮罩URL:", maskUrl && typeof maskUrl === 'string' ? maskUrl.substring(0, 50) + "..." : "无或非字符串");
                        }
                        // 如果没有 imgs，尝试从节点的输出数据中获取
                        else if (maskOriginNode && maskOriginNode.id) {
                            const nodeOutputs = app.nodeOutputs?.[maskOriginNode.id];
                            if (nodeOutputs && nodeOutputs.masks && nodeOutputs.masks.length > 0) {
                                maskUrl = nodeOutputs.masks[0];
                                console.log("🎨 从节点输出数据获取遮罩URL:", maskUrl && typeof maskUrl === 'string' ? maskUrl.substring(0, 50) + "..." : "无或非字符串");
                            }
                            else if (app.graph.last_node_outputs && app.graph.last_node_outputs[maskOriginNode.id]) {
                                const outputs = app.graph.last_node_outputs[maskOriginNode.id];
                                if (outputs.masks && outputs.masks.length > 0) {
                                    maskUrl = outputs.masks[0];
                                    console.log("🎨 从last_node_outputs获取遮罩URL:", maskUrl && typeof maskUrl === 'string' ? maskUrl.substring(0, 50) + "..." : "无或非字符串");
                                }
                            }
                        }
                    }
                }
            }
            
            // 如果还没有找到图像，检查当前节点是否有存储的图像
            if (!imageUrl && this.imgs && this.imgs.length > 0) {
                imageUrl = this.imgs[0].src;
                console.log("🎨 从当前节点的imgs获取图像URL:", imageUrl.substring(0, 50) + "...");
            }
            
            // 最后的备用方案：使用缓存的数据
            if (!imageUrl && this._lastInputImage) {
                imageUrl = this._lastInputImage;
                console.log("🎨 使用缓存的最后输入图像:", imageUrl.substring(0, 50) + "...");
            }
            if (!maskUrl && this._lastInputMask) {
                maskUrl = this._lastInputMask;
                console.log("🎨 使用缓存的最后输入遮罩:", maskUrl.substring(0, 50) + "...");
            }
            
            // 确保 imageUrl 是有效的字符串
            if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.length === 0) {
                console.warn("🎨 未找到有效的图像URL，将使用默认测试图像");
                
                // 检查是否连接了处理节点但未执行
                const hasProcessingNodes = this.inputs?.[0]?.link && 
                    app.graph.getNodeById(app.graph.links[this.inputs[0].link].origin_id)?.type !== 'LoadImage';
                
                if (hasProcessingNodes) {
                    // 显示提示用户先执行工作流的图像
                    const svgContent = `<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#ff9500;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#ff6b6b;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <rect width="500" height="500" fill="url(#grad)" />
                        <text x="250" y="220" font-family="Arial" font-size="28" fill="white" text-anchor="middle" dy=".3em">⚠️</text>
                        <text x="250" y="260" font-family="Arial" font-size="20" fill="white" text-anchor="middle" dy=".3em">Please run the workflow first</text>
                        <text x="250" y="290" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dy=".3em">Processing nodes need to be executed</text>
                        <text x="250" y="320" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dy=".3em">to generate images before editing curves</text>
                    </svg>`;
                    imageUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
                    console.log("🎨 显示提示用户先执行工作流的图像");
                } else {
                    // 使用普通的测试图像
                    const svgContent = `<svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
                                <stop offset="50%" style="stop-color:#4ecdc4;stop-opacity:1" />
                                <stop offset="100%" style="stop-color:#45b7d1;stop-opacity:1" />
                            </linearGradient>
                        </defs>
                        <rect width="500" height="500" fill="url(#grad)" />
                        <text x="250" y="250" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">Test Image</text>
                        <text x="250" y="280" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dy=".3em">Please connect a valid image node</text>
                    </svg>`;
                    imageUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent);
                    console.log("🎨 使用默认测试图像（500x500 SVG）");
                }
            } else {
                console.log("🎨 使用获取到的图像URL:", typeof imageUrl === 'string' ? imageUrl.substring(0, 100) + '...' : imageUrl);
            }
            
            // 确保 maskUrl 也是有效的字符串（如果存在）
            if (maskUrl && typeof maskUrl !== 'string') {
                console.log("🎨 遮罩URL不是字符串类型，将其设置为null:", typeof maskUrl, maskUrl);
                maskUrl = null;
            }
            
            // 创建并打开模态弹窗
            console.log("🎨 创建弹窗并加载图像");
            console.log("🎨 最终使用的图像URL类型:", typeof imageUrl);
            console.log("🎨 最终使用的遮罩URL类型:", typeof maskUrl);
            
            // 固定使用1600×1200尺寸
            const modalWidth = 1600;
            const modalHeight = 1200;
            
            // 保存这些尺寸供下次使用
            this.properties.modal_width = modalWidth;
            this.properties.modal_height = modalHeight;
            
            // 不再需要更新UI控件，因为它们已被移除
            // const widgetWidth = this.widgets.find(w => w.name === 'modal_width');
            // const widgetHeight = this.widgets.find(w => w.name === 'modal_height');
            // if (widgetWidth) widgetWidth.value = modalWidth;
            // if (widgetHeight) widgetHeight.value = modalHeight;
                
            // 确保关闭任何已存在的弹窗
            if (this.curveEditorModal && this.curveEditorModal.isOpen) {
                console.log("🎨 关闭已存在的弹窗");
                this.curveEditorModal.close();
            }
            
            try {
                console.log("🎨 开始创建 CurveEditorModal 实例");
                this.curveEditorModal = new CurveEditorModal(this, {
                    width: modalWidth,
                    height: modalHeight
                });
                console.log("🎨 CurveEditorModal 实例创建成功");
                
                console.log("🎨 开始打开弹窗");
                this.curveEditorModal.open(imageUrl, maskUrl);
                console.log("🎨 弹窗打开完成");
            } catch (error) {
                console.error("🎨 创建或打开弹窗失败:", error);
                console.error("🎨 错误堆栈:", error.stack);
                alert("打开曲线编辑器失败：" + error.message);
            }
            
            return false; // 阻止事件继续传播
        };
    }
});

// 添加遮罩处理辅助函数
CurveEditorModal.prototype.shouldApplyMaskPreview = function(avgLuminance, nonWhitePixels, transparentMaskPixels) {
    // 检查是否应该应用遮罩预览
    // 条件：有足够的非白色像素或有透明度变化
    return nonWhitePixels > 10 || transparentMaskPixels > 100 || avgLuminance < 0.95;
};

CurveEditorModal.prototype.calculateMaskFactor = function(maskPixels, index, avgLuminance, transparentMaskPixels) {
    // 计算遮罩因子，支持多种遮罩类型
    let maskFactor = 0;
    
    if (transparentMaskPixels > 100) {
        // 基于Alpha通道的遮罩
        const alpha = maskPixels[index + 3] / 255.0;
        maskFactor = avgLuminance > 0.9 ? (1.0 - alpha) : alpha;
    } else {
        // 基于亮度的遮罩
        const luminance = (maskPixels[index] * 0.299 + maskPixels[index + 1] * 0.587 + maskPixels[index + 2] * 0.114) / 255;
        maskFactor = 1.0 - luminance; // 暗区为遮罩区域
    }
    
    return Math.max(0, Math.min(1, maskFactor));
};

CurveEditorModal.prototype.enhanceMaskBlending = function(maskFactor) {
    // 增强遮罩混合效果，使变化更明显
    if (maskFactor < 0.01) return 0;
    
    // 使用幂函数增强对比度
    const enhanced = Math.pow(maskFactor, 0.7);
    // 放大变化范围
    return Math.min(1.0, enhanced * 1.2);
};

CurveEditorModal.prototype.applyFallbackMaskStrategy = function(originalData, processedData, outputData, maskCtx, canvas, avgLuminance, nonWhitePixels, transparentMaskPixels) {
    // 备用遮罩策略，保持原有逻辑
    const maskImageData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
    const maskData = maskImageData.data;
    
    for (let i = 0; i < processedData.length; i += 4) {
        let maskFactor = 0;
        
        if (transparentMaskPixels > 0) {
            // 使用Alpha通道
            maskFactor = (255 - maskData[i + 3]) / 255.0;
        } else if (nonWhitePixels > 10) {
            // 使用亮度
            const luminance = (maskData[i] * 0.299 + maskData[i + 1] * 0.587 + maskData[i + 2] * 0.114) / 255;
            maskFactor = 1.0 - luminance;
        } else {
            // 直接使用Alpha通道
            maskFactor = maskData[i + 3] / 255.0;
        }
        
        outputData[i] = originalData[i] * (1 - maskFactor) + processedData[i] * maskFactor;
        outputData[i + 1] = originalData[i + 1] * (1 - maskFactor) + processedData[i + 1] * maskFactor;
        outputData[i + 2] = originalData[i + 2] * (1 - maskFactor) + processedData[i + 2] * maskFactor;
        outputData[i + 3] = 255;
    }
};

console.log("🎨 PhotoshopCurveNode.js 加载完成"); 

