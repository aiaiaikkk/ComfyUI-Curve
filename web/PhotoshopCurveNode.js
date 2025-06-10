import { app } from "../../scripts/app.js";

/*
 * PhotoshopCurveNode.js - 曲线调整节点
 * 
 * 修复内容:
 * 1. 修复了双击节点无法打开弹窗的问题
 * 2. 修复了重置按钮不显示的问题
 * 3. 简化了模态弹窗的创建和事件处理
 * 4. 改进了曲线编辑器的创建过程
 */

console.log("🎨 PhotoshopCurveNode.js 开始加载...");

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
        this.options.title = options.title || "曲线编辑器";
        
        // 记录实际使用的尺寸
        console.log("🎨 模态弹窗尺寸:", this.options.width, "x", this.options.height);
        
        this.inputImage = null;
        this.isOpen = false;
        this.curveEditor = null;
        
        try {
            // 检查是否已存在相同ID的模态弹窗
            const existingModal = document.getElementById(`curve-editor-modal-${this.node.id}`);
            if (existingModal) {
                console.log("🎨 移除已存在的模态弹窗");
                existingModal.remove();
            }
            
            // 创建新的模态弹窗
            this.createModal();
            this.bindEvents();
            
            console.log("🎨 CurveEditorModal创建完成");
        } catch (error) {
            console.error("🎨 CurveEditorModal创建失败:", error);
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
                display: flex;
                flex-direction: column;
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
        title.textContent = '曲线编辑器';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'curve-editor-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => this.close();
        
        header.appendChild(title);
        header.appendChild(closeButton);
        
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
        resetButton.textContent = '重置';
        resetButton.onclick = () => {
            if (this.curveEditor) {
                this.curveEditor.resetCurve();
                this.updatePreview();
            }
        };
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'curve-editor-button secondary';
        cancelButton.textContent = '取消';
        cancelButton.onclick = () => this.cancel();
        
        const applyButton = document.createElement('button');
        applyButton.className = 'curve-editor-button primary';
        applyButton.textContent = '应用';
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
        
        // 取消按钮
        const cancelBtn = this.modal.querySelector('.curve-editor-button.secondary');
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
    
    async open(inputImage) {
        console.log("🎨 开始打开模态弹窗");
        
        if (!inputImage) {
            console.error("🎨 没有提供输入图像");
            return;
        }
        
        this.inputImage = inputImage;
        this.isOpen = true;
        
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
            
            console.log("🎨 设置预览图像:", inputImage.substring(0, 50) + "...");
            
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
            
            // 添加操作提示
            const helpTip = document.createElement('div');
            helpTip.className = 'curve-editor-help';
            helpTip.innerHTML = '单击/双击：添加点 | 右键：删除点 | 拖动：移动点';
            helpTip.style.cssText = `
                padding: 8px;
                background: #333;
                border-radius: 4px;
                margin-bottom: 10px;
                text-align: center;
                color: #fff;
                font-size: 12px;
            `;
            editorContainer.appendChild(helpTip);
            
            // 创建曲线编辑器
            console.log("🎨 在模态弹窗中创建曲线编辑器");
            
            // 计算编辑器容器的尺寸
            const containerWidth = editorContainer.clientWidth - 20; // 减去padding
            const containerHeight = editorContainer.clientHeight - 100; // 减去其他元素的高度
            
            // 创建一个新的曲线编辑器实例，专门用于模态弹窗
            const modalCurveEditor = new PhotoshopCurveNodeWidget(this.node, {
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
            
            this.curveEditor = modalCurveEditor;
            
            // 将曲线编辑器的容器添加到模态弹窗中
            if (modalCurveEditor.container) {
                editorContainer.appendChild(modalCurveEditor.container);
                
                // 确保曲线编辑器被正确初始化
                if (modalCurveEditor.drawCurve) {
                    modalCurveEditor.drawCurve();
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
            
            // 更新预览图像
            this.updatePreview();
        };
        
        // 保存原始的drawCurve方法
        const originalDrawCurve = this.curveEditor.drawCurve;
        
        // 覆盖drawCurve方法，添加预览更新
        this.curveEditor.drawCurve = (...args) => {
            // 调用原始方法
            originalDrawCurve.apply(this.curveEditor, args);
            
            // 更新预览图像
            this.updatePreview();
        };
        
        // 监听控制点相关事件
        if (this.curveEditor.svg) {
            // 鼠标移动事件结束时更新预览
            const originalOnMouseUp = this.curveEditor.onMouseUp;
            this.curveEditor.onMouseUp = (e) => {
                if (originalOnMouseUp) {
                    originalOnMouseUp.call(this.curveEditor, e);
                }
                this.updatePreview();
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
                this.curveEditor.selectChannel = (channelId) => {
                    originalSelectChannel.call(this.curveEditor, channelId);
                    this.updatePreview();
                };
            }
        }
        
        console.log("🎨 曲线编辑器事件设置完成");
    }
    
    async updatePreview() {
        console.log("🎨 开始更新预览图像");
        
        if (!this.inputImage || !this.node) {
            console.error("🎨 预览更新失败: 没有输入图像或节点");
            return;
        }
        
        try {
            // 获取当前曲线设置
            const curvePoints = this.node.widgets.find(w => w.name === 'curve_points')?.value || '0,0;255,255';
            const interpolation = this.node.widgets.find(w => w.name === 'interpolation')?.value || 'cubic';
            const channel = this.node.widgets.find(w => w.name === 'channel')?.value || 'RGB';
            
            console.log(`🎨 预览参数: 通道=${channel}, 插值=${interpolation}, 点=${curvePoints}`);
            
            // 获取预览图像元素
            const previewImg = this.modal.querySelector('.preview-image');
            if (!previewImg) {
                console.error("🎨 预览更新失败: 找不到预览图像元素");
                return;
            }
            
            // 确保预览容器可见
            const previewWrapper = this.modal.querySelector('.preview-image-wrapper');
            if (previewWrapper) {
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
            this.applyPreviewEffect(curvePoints, interpolation, channel);
            
        } catch (error) {
            console.error("🎨 预览更新失败:", error);
            
            // 尝试恢复显示
            try {
                const previewImg = this.modal.querySelector('.preview-image');
                if (previewImg) {
                    previewImg.src = this.inputImage || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
                    previewImg.style.display = 'block';
                }
                
                const previewWrapper = this.modal.querySelector('.preview-image-wrapper');
                if (previewWrapper) {
                    previewWrapper.style.display = 'flex';
                    previewWrapper.style.visibility = 'visible';
                }
            } catch (e) {
                console.error("🎨 恢复预览显示失败:", e);
            }
        }
    }
    
    // 新增方法：应用预览效果
    applyPreviewEffect(curvePoints, interpolation, channel) {
        try {
            console.log("🎨 应用预览效果");
            
            // 获取预览图像元素
            const previewImg = this.modal.querySelector('.preview-image');
            if (!previewImg) {
                console.error("🎨 应用预览效果失败: 找不到预览图像元素");
                return;
            }
            
            // 确保预览容器可见
            const previewWrapper = this.modal.querySelector('.preview-image-wrapper');
            if (previewWrapper) {
                previewWrapper.style.display = 'flex';
                previewWrapper.style.visibility = 'visible';
            }
            
            // 检查原始图像是否有效
            if (!this.originalImage || !this.originalImage.complete || !this.originalImage.naturalWidth) {
                console.error("🎨 应用预览效果失败: 原始图像无效");
                previewImg.src = this.inputImage || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                previewImg.style.display = 'block';
                return;
            }
            
            // 创建临时canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 设置canvas大小与原始图像相同
            canvas.width = this.originalImage.width;
            canvas.height = this.originalImage.height;
            
            console.log("🎨 Canvas尺寸:", canvas.width, "x", canvas.height);
            
            // 绘制原始图像到canvas
            ctx.drawImage(this.originalImage, 0, 0);
            
            // 获取图像数据
            let imageData;
            try {
                imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch (error) {
                console.error("🎨 获取图像数据失败:", error);
                
                // 尝试绘制到新的canvas并获取数据
                const newCanvas = document.createElement('canvas');
                newCanvas.width = this.originalImage.width;
                newCanvas.height = this.originalImage.height;
                const newCtx = newCanvas.getContext('2d');
                newCtx.drawImage(this.originalImage, 0, 0);
                
                try {
                    imageData = newCtx.getImageData(0, 0, newCanvas.width, newCanvas.height);
                } catch (e) {
                    console.error("🎨 再次获取图像数据失败:", e);
                    previewImg.src = this.inputImage;
                    previewImg.style.display = 'block';
                    return;
                }
            }
            
            const data = imageData.data;
            console.log("🎨 图像数据大小:", data.length);
            
            // 解析控制点
            const points = curvePoints.split(';')
                .map(s => s.split(',').map(Number))
                .filter(a => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]))
                .map(a => ({ x: Math.max(0, Math.min(255, a[0])), y: Math.max(0, Math.min(255, a[1])) }))
                .sort((a, b) => a.x - b.x);
            
            // 创建查找表 (LUT)
            const lut = this.createLookupTable(points, interpolation);
            
            // 应用曲线到图像数据
            for (let i = 0; i < data.length; i += 4) {
                if (channel === 'RGB' || channel === 'R') {
                    data[i] = lut[data[i]]; // R
                }
                if (channel === 'RGB' || channel === 'G') {
                    data[i + 1] = lut[data[i + 1]]; // G
                }
                if (channel === 'RGB' || channel === 'B') {
                    data[i + 2] = lut[data[i + 2]]; // B
                }
                // 不修改Alpha通道
            }
            
            // 将处理后的图像数据放回canvas
            ctx.putImageData(imageData, 0, 0);
            
            // 更新预览图像
            try {
                const dataURL = canvas.toDataURL('image/jpeg', 0.9);
                
                // 直接设置预览图像，不再使用预加载
                previewImg.onload = () => {
                    console.log("🎨 预览图像已更新");
                    previewImg.style.display = 'block';
                    
                    // 确保预览容器可见
                    if (previewWrapper) {
                        previewWrapper.style.display = 'flex';
                        previewWrapper.style.visibility = 'visible';
                        previewWrapper.style.opacity = '1';
                    }
                };
                
                previewImg.onerror = () => {
                    console.error("🎨 预览图像加载失败");
                    previewImg.src = this.inputImage;
                    previewImg.style.display = 'block';
                };
                
                // 设置源
                previewImg.src = dataURL;
            } catch (error) {
                console.error("🎨 更新预览图像失败:", error);
                previewImg.src = this.inputImage;
                previewImg.style.display = 'block';
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
                const previewWrapper = this.modal.querySelector('.preview-image-wrapper');
                if (previewWrapper) {
                    previewWrapper.style.display = 'flex';
                    previewWrapper.style.visibility = 'visible';
                }
            } catch (e) {
                console.error("🎨 恢复原始图像也失败:", e);
            }
        }
    }
    
    createLookupTable(points, interpolation) {
        // 确保至少有两个点
        if (points.length < 2) {
            points = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
        }
        
        // 创建256个值的查找表
        const lut = new Uint8Array(256);
        
        if (interpolation === 'linear') {
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
            if (!this.node) {
                console.error("🎨 无法应用更改: 节点不存在");
                return;
            }
            
            // 获取当前曲线设置
            if (this.curveEditor) {
                // 确保曲线编辑器的更改已经应用到节点上
                this.curveEditor.updatePointsWidget();
                
                // 同步到节点上的曲线编辑器
                if (this.node.curveEditor) {
                    // 复制控制点
                    this.node.curveEditor.controlPoints = JSON.parse(JSON.stringify(this.curveEditor.controlPoints));
                    
                    // 同步黑点和白点
                    this.node.curveEditor.blackPointX = this.curveEditor.blackPointX;
                    this.node.curveEditor.whitePointX = this.curveEditor.whitePointX;
                    
                    // 更新节点上的曲线编辑器
                    this.node.curveEditor.updatePointsWidget();
                    this.node.curveEditor.drawCurve();
                }
            }
            
            const curvePoints = this.node.widgets.find(w => w.name === 'curve_points')?.value;
            const interpolation = this.node.widgets.find(w => w.name === 'interpolation')?.value;
            const channel = this.node.widgets.find(w => w.name === 'channel')?.value;
            
            console.log(`🎨 应用参数: 通道=${channel}, 插值=${interpolation}, 点=${curvePoints}`);
            
            // 通知后端处理图像
            const result = await this.processImage(curvePoints, interpolation, channel);
            
            // 关闭模态弹窗
            this.close();
            
            // 如果节点有graph，触发重新执行
            if (this.node.graph) {
                console.log("🎨 触发节点重新执行");
                this.node.graph.setDirtyCanvas(true, true);
                
                // 尝试触发节点执行
                if (typeof this.node.onExecuted === 'function') {
                    // 创建一个模拟消息
                    const message = { refresh: true };
                    this.node.onExecuted(message);
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
        this.points = null;
        this.interp = null;
        this.channel = null;
        
        // 初始化端点滑块值
        this.blackPointX = 0;
        this.whitePointX = 255;
        this.isDraggingBlackSlider = false;
        this.isDraggingWhiteSlider = false;
        
        // 初始化历史记录
        this.history = [];
        this.historyIndex = -1;
        
        // 确保widgets已初始化
        if (node && node.widgets && Array.isArray(node.widgets)) {
            this.points = node.widgets.find(w => w.name === 'curve_points');
            this.interp = node.widgets.find(w => w.name === 'interpolation');
            this.channel = node.widgets.find(w => w.name === 'channel');
            
            console.log("🎨 找到的widgets", {
                points: !!this.points,
                interp: !!this.interp,
                channel: !!this.channel
            });
        } else {
            console.warn("🎨 节点widgets未初始化");
        }
        
        // 确保有默认的曲线点值
        if (this.points && (!this.points.value || this.points.value.trim() === '')) {
            this.points.value = '0,0;255,255';
        }
        
        // 初始化控制点数据
        this.controlPoints = this.parsePoints(this.getActiveCurvePoints());
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
        resetButton.textContent = '重置';
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
        if (this.channel) {
            this.channel.value = channelId;
        }
        this.updateChannelButtons();
        this.drawCurve();
        
        // 使用对象直接引用
        const node = this.node;
        if (node && typeof node.onResize === 'function') {
            node.onResize();
        }
    }
    
    updateChannelButtons() {
        const currentChannel = this.channel ? this.channel.value : 'RGB';
        
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
        const defaultPoints = '0,0;255,255';
        return this.points && this.points.value ? this.points.value : defaultPoints;
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
        if (this.points) {
            // 转换为字符串并更新控件
            this.points.value = this.pointsToString(this.controlPoints);
            
            // 触发值更改回调
            const node = this.node;
            if (node) {
                // 如果节点有自定义的值变化回调，调用它
                if (typeof node.onCurveNodeValueChanged === 'function') {
                    node.onCurveNodeValueChanged(this.points, this.points.value);
                }
                
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
    }
    
    drawCurve() {
        try {
            // 清空SVG
            while (this.svg.firstChild) {
                this.svg.removeChild(this.svg.firstChild);
            }
            
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
            bgGradient.setAttribute('y1', '0%');
            bgGradient.setAttribute('x2', '100%');
            bgGradient.setAttribute('y2', '100%');
            
            // 设置渐变色 - 不透明度调整到60%
            const currentChannel = this.channel ? this.channel.value : 'RGB';
            const colors = {
                'RGB': { start: 'rgba(255,255,255,0.6)', end: 'rgba(0,0,0,0.6)' },
                'R': { start: 'rgba(255,0,0,0.6)', end: 'rgba(0,255,255,0.6)' },
                'G': { start: 'rgba(0,255,0,0.6)', end: 'rgba(255,0,255,0.6)' },
                'B': { start: 'rgba(0,0,255,0.6)', end: 'rgba(255,255,0,0.6)' }
            };
            
            const channelColors = colors[currentChannel] || colors['RGB'];
            
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
            this.points = null;
            this.interp = null;
            this.channel = null;
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
            
            // 添加跳过弹窗的选项
            if (!this.widgets.find(w => w.name === 'use_modal')) {
                this.addProperty('use_modal', true, 'boolean');
                const modalWidget = this.addWidget('toggle', '使用弹窗编辑', true, function(v) {
                    this.properties.use_modal = v;
                });
                modalWidget.name = 'use_modal';
                
                // 只添加属性，不添加控件
                if (!this.properties.hasOwnProperty('modal_width')) {
                    this.properties.modal_width = 1600;
                }
                if (!this.properties.hasOwnProperty('modal_height')) {
                    this.properties.modal_height = 1200;
                }
            } else {
                // 确保属性存在，即使在节点重载时也是如此
                if (!this.properties.hasOwnProperty('modal_width')) {
                    this.properties.modal_width = 1600;
                }
                if (!this.properties.hasOwnProperty('modal_height')) {
                    this.properties.modal_height = 1200;
                }
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
        
        // 添加processNode方法，处理节点执行
        nodeType.prototype.onExecuted = async function(message) {
            console.log("🎨 节点执行，接收到消息:", message);
            
            // 检查是否使用模态弹窗
            if (this.properties.use_modal) {
                try {
                    // 从消息中获取图像数据
                    const imageData = message.bg_image || message.image;
                    
                    if (!imageData) {
                        console.error("🎨 消息中没有图像数据");
                        return;
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
                    
                    // 打开模态弹窗
                    console.log("🎨 打开模态弹窗");
                    setTimeout(() => {
                        this.curveEditorModal.open(imageData);
                    }, 50);
                } catch (error) {
                    console.error("🎨 显示模态弹窗失败:", error);
                }
            } else {
                console.log("🎨 跳过模态弹窗，直接处理图像");
                // 直接在节点上编辑
                if (this.curveEditor) {
                    this.curveEditor.activate();
                } else {
                    console.log("🎨 创建节点上的曲线编辑器");
                    this.curveEditor = new PhotoshopCurveNodeWidget(this);
                }
            }
        }

        // 修改右键菜单选项
        nodeType.prototype.getExtraMenuOptions = function(_, options) {
            options.unshift(
                {
                    content: "📊 打开曲线编辑器",
                    callback: () => {
                        // 检查是否使用模态弹窗
                        if (this.properties.use_modal) {
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
                            
                            // 这里应该获取输入图像数据，但简化版本直接打开空弹窗
                            this.curveEditorModal.open("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
                        } else {
                            // 直接激活节点上的编辑器
                            if (this.curveEditor) {
                                this.curveEditor.activate();
                            }
                        }
                    }
                }
            );
            return options;
        };
        
        // 修改双击行为 - 修复这部分代码
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
            
            // 尝试从节点输入获取图像
            if (this.inputs && this.inputs.length > 0) {
                const imageInput = this.inputs[0];
                if (imageInput && imageInput.link) {
                    const linkInfo = app.graph.links[imageInput.link];
                    if (linkInfo) {
                        const originNode = app.graph.getNodeById(linkInfo.origin_id);
                        if (originNode && originNode.imgs && originNode.imgs.length > 0) {
                            imageUrl = originNode.imgs[0].src;
                            console.log("🎨 从输入节点获取图像URL:", imageUrl.substring(0, 50) + "...");
                        }
                    }
                }
            }
            
            // 如果没有找到图像，尝试使用测试图像
            if (!imageUrl) {
                // 使用灰色渐变图像作为默认测试图像
                imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAYAAADL1t+KAAAD0ElEQVR4nO3BgQAAAADDoPlTH+ECVQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8G93YAAD1Pn0QAAAAASUVORK5CYII=";
                console.log("🎨 使用默认测试图像");
            }
            
            // 创建并打开模态弹窗
            console.log("🎨 创建弹窗并加载图像");
            
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
                
            this.curveModal = new CurveEditorModal(this, {
                width: modalWidth,
                height: modalHeight
            });
            this.curveModal.open(imageUrl);
            
            return false; // 阻止事件继续传播
        };
    }
});

console.log("🎨 PhotoshopCurveNode.js 加载完成"); 

