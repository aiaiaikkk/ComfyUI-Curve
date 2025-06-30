import { app } from "../../scripts/app.js";

/*
 * CameraRawToneCurveNode.js - Camera Raw色调曲线节点
 * 
 * 功能特点:
 * 1. 完全对齐Adobe Camera Raw色调曲线
 * 2. 支持Point Curve（点曲线）和Parametric Curve（参数曲线）
 * 3. 内置Linear/Medium Contrast/Strong Contrast预设
 * 4. 实时预览功能
 * 5. 四个区域调整：高光、明亮、暗部、阴影
 */

// 全局节点输出缓存
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// 设置全局节点输出缓存
function setupGlobalNodeOutputCache() {
    if (app.api) {
        app.api.addEventListener("executed", ({ detail }) => {
            const nodeId = String(detail.node);
            const outputData = detail.output;
            
            if (nodeId && outputData && outputData.images) {
                window.globalNodeCache.set(nodeId, outputData);
                
                if (!app.nodeOutputs) {
                    app.nodeOutputs = {};
                }
                app.nodeOutputs[nodeId] = outputData;
                
                const node = app.graph.getNodeById(nodeId);
                if (node && outputData.images && outputData.images.length > 0) {
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
                        return null;
                    };
                    
                    const imageUrls = outputData.images.map(convertToImageUrl).filter(url => url !== null);
                    
                    if (!node.imgs) {
                        node.imgs = [];
                    }
                    node.imgs = imageUrls;
                }
            }
        });
    }
}

// 页面加载时设置缓存
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalNodeOutputCache);
} else {
    setupGlobalNodeOutputCache();
}

app.registerExtension({
    name: "CameraRawToneCurveNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CameraRawToneCurveNode") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                const result = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                // 添加双击弹窗功能
                this.onDblClick = () => {
                    this.showToneCurveModal();
                    return true;
                };
                
                // 初始化节点数据
                this.toneCurveData = {
                    curve_preset: 'Linear',
                    point_curve: '[[0,0],[255,255]]',
                    highlights: 0.0,
                    lights: 0.0,
                    darks: 0.0,
                    shadows: 0.0,
                    curve_mode: 'Combined'
                };
                
                return result;
            };
            
            // 添加色调曲线弹窗方法
            nodeType.prototype.showToneCurveModal = function() {
                this.createToneCurveModal();
            };
            
            nodeType.prototype.createToneCurveModal = function() {
                // 移除现有弹窗
                const existingModal = document.getElementById('toneCurveModal');
                if (existingModal) {
                    existingModal.remove();
                }
                
                // 创建弹窗
                const modal = document.createElement('div');
                modal.id = 'toneCurveModal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                `;
                
                const content = document.createElement('div');
                content.style.cssText = `
                    background-color: #2b2b2b;
                    border-radius: 10px;
                    padding: 20px;
                    width: 800px;
                    max-width: 90vw;
                    max-height: 90vh;
                    overflow-y: auto;
                    color: white;
                    border: 2px solid #444;
                `;
                
                // 创建内容
                content.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 style="margin: 0; color: #fff;">📈 Camera Raw 色调曲线</h2>
                        <button id="closeToneCurve" style="background: #ff4757; border: none; border-radius: 5px; padding: 8px 15px; color: white; cursor: pointer;">✕ 关闭</button>
                    </div>
                    
                    <!-- 预设选择 -->
                    <div style="margin-bottom: 20px; padding: 15px; background: #3a3a3a; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #0ea5e9;">📋 曲线预设</h3>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button class="preset-btn" data-preset="Linear">Linear</button>
                            <button class="preset-btn" data-preset="Medium Contrast">Medium Contrast</button>
                            <button class="preset-btn" data-preset="Strong Contrast">Strong Contrast</button>
                            <button class="preset-btn" data-preset="Custom">Custom</button>
                        </div>
                    </div>
                    
                    <!-- 曲线模式选择 -->
                    <div style="margin-bottom: 20px; padding: 15px; background: #3a3a3a; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #10b981;">🎛️ 曲线模式</h3>
                        <div style="display: flex; gap: 10px;">
                            <button class="mode-btn" data-mode="Point">点曲线</button>
                            <button class="mode-btn" data-mode="Parametric">参数曲线</button>
                            <button class="mode-btn" data-mode="Combined">组合模式</button>
                        </div>
                    </div>
                    
                    <!-- 曲线编辑器 -->
                    <div style="margin-bottom: 20px; padding: 15px; background: #3a3a3a; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #f59e0b;">📊 曲线编辑器</h3>
                        <div style="display: flex; gap: 20px;">
                            <div style="flex: 1;">
                                <canvas id="toneCurveCanvas" width="400" height="400" style="border: 1px solid #666; border-radius: 5px; background: #1a1a1a; cursor: crosshair;"></canvas>
                            </div>
                            <div style="width: 200px;">
                                <div id="curvePreview" style="width: 200px; height: 200px; border: 1px solid #666; border-radius: 5px; background: #1a1a1a; margin-bottom: 10px;">
                                    <div style="padding: 20px; text-align: center; color: #888;">
                                        图像预览
                                        <br><small>连接图像后显示</small>
                                    </div>
                                </div>
                                <button id="resetCurve" style="width: 100%; background: #3b82f6; border: none; border-radius: 5px; padding: 8px; color: white; cursor: pointer;">重置曲线</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 参数调整 -->
                    <div style="margin-bottom: 20px; padding: 15px; background: #3a3a3a; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #8b5cf6;">🎚️ 参数调整 (Parametric Curve)</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #ff6b6b;">高光 (Highlights)</label>
                                <input type="range" id="highlights" min="-100" max="100" value="0" style="width: 100%;">
                                <span id="highlightsValue" style="color: #ff6b6b; font-weight: bold;">0</span>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #feca57;">明亮 (Lights)</label>
                                <input type="range" id="lights" min="-100" max="100" value="0" style="width: 100%;">
                                <span id="lightsValue" style="color: #feca57; font-weight: bold;">0</span>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #48cae4;">暗部 (Darks)</label>
                                <input type="range" id="darks" min="-100" max="100" value="0" style="width: 100%;">
                                <span id="darksValue" style="color: #48cae4; font-weight: bold;">0</span>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #6c5ce7;">阴影 (Shadows)</label>
                                <input type="range" id="shadows" min="-100" max="100" value="0" style="width: 100%;">
                                <span id="shadowsValue" style="color: #6c5ce7; font-weight: bold;">0</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="applyToneCurve" style="background: #27ae60; border: none; border-radius: 5px; padding: 12px 25px; color: white; cursor: pointer; font-weight: bold;">✅ 应用</button>
                        <button id="resetAllTone" style="background: #e74c3c; border: none; border-radius: 5px; padding: 12px 25px; color: white; cursor: pointer; font-weight: bold;">🔄 重置全部</button>
                    </div>
                `;
                
                modal.appendChild(content);
                document.body.appendChild(modal);
                
                // 初始化曲线编辑器
                this.initializeToneCurveEditor();
                
                // 绑定事件
                this.bindToneCurveEvents();
                
                // 加载当前设置
                this.loadCurrentToneCurveSettings();
            };
            
            nodeType.prototype.initializeToneCurveEditor = function() {
                const canvas = document.getElementById('toneCurveCanvas');
                const ctx = canvas.getContext('2d');
                
                this.toneCurvePoints = [[0, 0], [255, 255]]; // 当前曲线点
                this.selectedPoint = -1;
                this.isDragging = false;
                
                // 绘制曲线
                this.drawToneCurve();
                
                // 绑定鼠标事件
                canvas.addEventListener('mousedown', (e) => this.handleToneCurveMouseDown(e));
                canvas.addEventListener('mousemove', (e) => this.handleToneCurveMouseMove(e));
                canvas.addEventListener('mouseup', (e) => this.handleToneCurveMouseUp(e));
                canvas.addEventListener('dblclick', (e) => this.handleToneCurveDoubleClick(e));
            };
            
            nodeType.prototype.drawToneCurve = function() {
                const canvas = document.getElementById('toneCurveCanvas');
                if (!canvas) return;
                
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                
                // 清空画布
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, width, height);
                
                // 绘制PS风格的网格
                ctx.strokeStyle = '#404040';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                
                // 垂直线
                for (let i = 0; i <= 8; i++) {
                    const x = (i / 8) * width;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                }
                
                // 水平线  
                for (let i = 0; i <= 8; i++) {
                    const y = (i / 8) * height;
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                }
                ctx.stroke();
                
                // 绘制PS风格的对角线（原始色调）
                ctx.strokeStyle = '#808080';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]); // PS风格的虚线
                ctx.beginPath();
                ctx.moveTo(0, height);
                ctx.lineTo(width, 0);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 绘制区域标识
                const regions = [
                    { start: 0, end: 0.25, color: '#6c5ce7', label: '阴影' },
                    { start: 0.25, end: 0.5, color: '#48cae4', label: '暗部' },
                    { start: 0.5, end: 0.75, color: '#feca57', label: '明亮' },
                    { start: 0.75, end: 1.0, color: '#ff6b6b', label: '高光' }
                ];
                
                regions.forEach(region => {
                    const startX = region.start * width;
                    const endX = region.end * width;
                    
                    ctx.fillStyle = region.color + '08'; // 非常淡的区域标识，类似PS
                    ctx.fillRect(startX, 0, endX - startX, height);
                    
                    // 绘制PS风格的区域标签
                    ctx.fillStyle = region.color + 'C0'; // 半透明标签
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(region.label, (startX + endX) / 2, height - 8);
                });
                
                // 生成曲线
                const curvePoints = this.generateCurveFromPoints();
                
                // 绘制PS风格的精细曲线
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5; // PS风格的细线条
                ctx.shadowBlur = 0; // 移除阴影，保持PS简洁风格
                ctx.beginPath();
                
                // 使用高密度采样确保曲线平滑
                const step = 0.25; // 更细致的采样
                for (let x = 0; x < width; x += step) {
                    const inputValue = (x / width) * 255;
                    const outputValue = this.interpolateCurve(inputValue, curvePoints);
                    const y = height - (outputValue / 255) * height;
                    
                    if (x === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                
                // 绘制PS风格的控制点
                this.toneCurvePoints.forEach((point, index) => {
                    const x = (point[0] / 255) * width;
                    const y = height - (point[1] / 255) * height;
                    
                    // PS风格的小圆点
                    const isSelected = index === this.selectedPoint;
                    const radius = isSelected ? 4 : 3;
                    
                    // 外圈（黑色边框）
                    ctx.fillStyle = '#000000';
                    ctx.beginPath();
                    ctx.arc(x, y, radius + 1, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // 内圈（白色填充）
                    ctx.fillStyle = isSelected ? '#ffffff' : '#e0e0e0';
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI);
                    ctx.fill();
                });
            };
            
            nodeType.prototype.generateCurveFromPoints = function() {
                // 应用当前预设和参数调整
                const preset = this.toneCurveData.curve_preset;
                const highlights = this.toneCurveData.highlights;
                const lights = this.toneCurveData.lights;
                const darks = this.toneCurveData.darks;
                const shadows = this.toneCurveData.shadows;
                
                // 生成256点的曲线
                const curve = [];
                for (let i = 0; i < 256; i++) {
                    let output = i; // 基础线性曲线
                    
                    // 应用预设曲线
                    if (preset !== 'Linear') {
                        output = this.applyPresetCurve(i, preset);
                    }
                    
                    // 应用参数调整
                    const inputVal = i / 255.0;
                    
                    // Camera Raw风格的区域权重
                    const shadowWeight = this.cameraRawRegionWeight(inputVal, 0.0, 0.25);
                    const darkWeight = this.cameraRawRegionWeight(inputVal, 0.25, 0.50);
                    const lightWeight = this.cameraRawRegionWeight(inputVal, 0.50, 0.75);
                    const highlightWeight = this.cameraRawRegionWeight(inputVal, 0.75, 1.0);
                    
                    const totalAdjustment = (
                        shadows * shadowWeight * 0.8 +
                        darks * darkWeight * 0.6 +
                        lights * lightWeight * 0.6 +
                        highlights * highlightWeight * 0.8
                    );
                    
                    const curveOffset = totalAdjustment * 1.28;
                    output = Math.min(255, Math.max(0, output + curveOffset));
                    
                    // 应用点曲线
                    if (this.toneCurvePoints.length > 2) {
                        output = this.interpolateCurve(output, this.toneCurvePoints);
                    }
                    
                    curve.push(output);
                }
                
                return curve;
            };
            
            nodeType.prototype.cameraRawRegionWeight = function(inputVal, regionStart, regionEnd) {
                if (inputVal < regionStart || inputVal > regionEnd) {
                    return 0.0;
                }
                
                const regionCenter = (regionStart + regionEnd) / 2;
                const regionWidth = regionEnd - regionStart;
                const distanceFromCenter = Math.abs(inputVal - regionCenter) / (regionWidth / 2);
                
                return Math.exp(-2 * distanceFromCenter * distanceFromCenter);
            };
            
            nodeType.prototype.applyPresetCurve = function(input, preset) {
                const presets = {
                    'Medium Contrast': [
                        [0, 0], [32, 22], [64, 56], [128, 128], 
                        [192, 196], [224, 230], [255, 255]
                    ],
                    'Strong Contrast': [
                        [0, 0], [32, 16], [64, 44], [128, 128], 
                        [192, 208], [224, 240], [255, 255]
                    ]
                };
                
                const presetPoints = presets[preset];
                if (!presetPoints) return input;
                
                return this.interpolateCurve(input, presetPoints);
            };
            
            nodeType.prototype.interpolateCurve = function(x, points) {
                if (points.length < 2) return x;
                
                // 使用平滑插值（三次样条或改进的线性插值）
                if (points.length >= 3) {
                    return this.cubicSplineInterpolate(x, points);
                } else {
                    // 点数不足时使用线性插值
                    return this.linearInterpolate(x, points);
                }
            };
            
            nodeType.prototype.linearInterpolate = function(x, points) {
                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    
                    if (x >= p1[0] && x <= p2[0]) {
                        if (p2[0] === p1[0]) return p1[1];
                        
                        const t = (x - p1[0]) / (p2[0] - p1[0]);
                        return p1[1] + t * (p2[1] - p1[1]);
                    }
                }
                
                if (x < points[0][0]) return points[0][1];
                if (x > points[points.length - 1][0]) return points[points.length - 1][1];
                
                return x;
            };
            
            nodeType.prototype.cubicSplineInterpolate = function(x, points) {
                // PS风格的样条插值 - 调整曲率以匹配PS
                const n = points.length;
                if (n < 3) return this.linearInterpolate(x, points);
                
                // 找到x所在的区间
                let i = 0;
                while (i < n - 1 && x > points[i + 1][0]) {
                    i++;
                }
                
                if (i >= n - 1) return points[n - 1][1];
                if (i <= 0) return points[0][1];
                
                // 获取四个控制点
                const p0 = i > 0 ? points[i - 1] : points[i];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = i < n - 2 ? points[i + 2] : points[i + 1];
                
                // 计算参数t (0到1之间)
                const t = (x - p1[0]) / (p2[0] - p1[0]);
                const t2 = t * t;
                const t3 = t2 * t;
                
                // 调整曲率系数以匹配PS的曲线特性
                const tension = 0.3; // PS风格的张力系数
                const y = 0.5 * (
                    (2 * p1[1]) +
                    (-p0[1] + p2[1]) * t * tension +
                    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 * (1 - tension) +
                    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3 * tension
                );
                
                return Math.max(0, Math.min(255, y));
            };
            
            nodeType.prototype.bindToneCurveEvents = function() {
                // 预设按钮
                document.querySelectorAll('.preset-btn').forEach(btn => {
                    btn.style.cssText = `
                        background: #444; border: none; border-radius: 5px; 
                        padding: 8px 15px; color: white; cursor: pointer; 
                        transition: background 0.3s;
                    `;
                    
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.preset-btn').forEach(b => b.style.background = '#444');
                        btn.style.background = '#0ea5e9';
                        
                        this.toneCurveData.curve_preset = btn.dataset.preset;
                        this.drawToneCurve();
                    });
                });
                
                // 模式按钮
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.style.cssText = `
                        background: #444; border: none; border-radius: 5px; 
                        padding: 8px 15px; color: white; cursor: pointer; 
                        transition: background 0.3s;
                    `;
                    
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.mode-btn').forEach(b => b.style.background = '#444');
                        btn.style.background = '#10b981';
                        
                        this.toneCurveData.curve_mode = btn.dataset.mode;
                        this.drawToneCurve();
                    });
                });
                
                // 参数滑块
                ['highlights', 'lights', 'darks', 'shadows'].forEach(param => {
                    const slider = document.getElementById(param);
                    const valueSpan = document.getElementById(param + 'Value');
                    
                    slider.addEventListener('input', (e) => {
                        const value = parseFloat(e.target.value);
                        this.toneCurveData[param] = value;
                        valueSpan.textContent = value;
                        this.drawToneCurve();
                    });
                });
                
                // 关闭按钮
                document.getElementById('closeToneCurve').addEventListener('click', () => {
                    document.getElementById('toneCurveModal').remove();
                });
                
                // 应用按钮
                document.getElementById('applyToneCurve').addEventListener('click', () => {
                    this.applyToneCurveSettings();
                });
                
                // 重置按钮
                document.getElementById('resetAllTone').addEventListener('click', () => {
                    this.resetToneCurveSettings();
                });
                
                // 重置曲线按钮
                document.getElementById('resetCurve').addEventListener('click', () => {
                    this.toneCurvePoints = [[0, 0], [255, 255]];
                    this.drawToneCurve();
                });
                
                // 点击背景关闭
                document.getElementById('toneCurveModal').addEventListener('click', (e) => {
                    if (e.target.id === 'toneCurveModal') {
                        document.getElementById('toneCurveModal').remove();
                    }
                });
            };
            
            nodeType.prototype.loadCurrentToneCurveSettings = function() {
                // 加载当前节点设置到弹窗
                const widgets = this.widgets || [];
                
                widgets.forEach(widget => {
                    if (widget.name === 'curve_preset') {
                        this.toneCurveData.curve_preset = widget.value;
                        document.querySelector(`[data-preset="${widget.value}"]`)?.click();
                    } else if (widget.name === 'curve_mode') {
                        this.toneCurveData.curve_mode = widget.value;
                        document.querySelector(`[data-mode="${widget.value}"]`)?.click();
                    } else if (['highlights', 'lights', 'darks', 'shadows'].includes(widget.name)) {
                        this.toneCurveData[widget.name] = widget.value;
                        const slider = document.getElementById(widget.name);
                        const valueSpan = document.getElementById(widget.name + 'Value');
                        if (slider && valueSpan) {
                            slider.value = widget.value;
                            valueSpan.textContent = widget.value;
                        }
                    } else if (widget.name === 'point_curve') {
                        try {
                            this.toneCurvePoints = JSON.parse(widget.value);
                        } catch (e) {
                            this.toneCurvePoints = [[0, 0], [255, 255]];
                        }
                    }
                });
                
                this.drawToneCurve();
            };
            
            nodeType.prototype.applyToneCurveSettings = function() {
                // 将弹窗设置应用到节点
                const widgets = this.widgets || [];
                
                // 更新点曲线
                this.toneCurveData.point_curve = JSON.stringify(this.toneCurvePoints);
                
                widgets.forEach(widget => {
                    if (this.toneCurveData.hasOwnProperty(widget.name)) {
                        widget.value = this.toneCurveData[widget.name];
                    }
                });
                
                // 触发节点更新
                if (this.onWidgetChanged) {
                    this.onWidgetChanged('point_curve', this.toneCurveData.point_curve);
                }
                
                // 关闭弹窗
                document.getElementById('toneCurveModal').remove();
                
                console.log('色调曲线设置已应用:', this.toneCurveData);
            };
            
            nodeType.prototype.resetToneCurveSettings = function() {
                // 重置所有设置
                this.toneCurveData = {
                    curve_preset: 'Linear',
                    point_curve: '[[0,0],[255,255]]',
                    highlights: 0.0,
                    lights: 0.0,
                    darks: 0.0,
                    shadows: 0.0,
                    curve_mode: 'Combined'
                };
                
                this.toneCurvePoints = [[0, 0], [255, 255]];
                
                // 更新界面
                document.querySelector('[data-preset="Linear"]')?.click();
                document.querySelector('[data-mode="Combined"]')?.click();
                
                ['highlights', 'lights', 'darks', 'shadows'].forEach(param => {
                    const slider = document.getElementById(param);
                    const valueSpan = document.getElementById(param + 'Value');
                    if (slider && valueSpan) {
                        slider.value = 0;
                        valueSpan.textContent = '0';
                    }
                });
                
                this.drawToneCurve();
            };
            
            // 鼠标事件处理
            nodeType.prototype.handleToneCurveMouseDown = function(e) {
                const canvas = document.getElementById('toneCurveCanvas');
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // 检查是否点击了现有控制点
                this.selectedPoint = -1;
                this.toneCurvePoints.forEach((point, index) => {
                    const px = (point[0] / 255) * canvas.width;
                    const py = canvas.height - (point[1] / 255) * canvas.height;
                    
                    const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                    if (distance < 10) {
                        this.selectedPoint = index;
                        this.isDragging = true;
                    }
                });
                
                if (this.selectedPoint === -1) {
                    // 添加新控制点（排除起点和终点）
                    const newX = Math.round((x / canvas.width) * 255);
                    const newY = Math.round(((canvas.height - y) / canvas.height) * 255);
                    
                    if (newX > 0 && newX < 255) {
                        this.toneCurvePoints.push([newX, newY]);
                        this.toneCurvePoints.sort((a, b) => a[0] - b[0]);
                        this.selectedPoint = this.toneCurvePoints.findIndex(p => p[0] === newX && p[1] === newY);
                        this.isDragging = true;
                    }
                }
                
                this.drawToneCurve();
            };
            
            nodeType.prototype.handleToneCurveMouseMove = function(e) {
                if (!this.isDragging || this.selectedPoint === -1) return;
                
                const canvas = document.getElementById('toneCurveCanvas');
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const newX = Math.round((x / canvas.width) * 255);
                const newY = Math.round(((canvas.height - y) / canvas.height) * 255);
                
                // 限制范围
                const clampedX = Math.max(0, Math.min(255, newX));
                const clampedY = Math.max(0, Math.min(255, newY));
                
                // 防止起点和终点移动
                if (this.selectedPoint === 0) {
                    this.toneCurvePoints[0] = [0, clampedY];
                } else if (this.selectedPoint === this.toneCurvePoints.length - 1) {
                    this.toneCurvePoints[this.selectedPoint] = [255, clampedY];
                } else {
                    this.toneCurvePoints[this.selectedPoint] = [clampedX, clampedY];
                }
                
                this.drawToneCurve();
            };
            
            nodeType.prototype.handleToneCurveMouseUp = function(e) {
                this.isDragging = false;
            };
            
            nodeType.prototype.handleToneCurveDoubleClick = function(e) {
                // 双击删除控制点（除了起点和终点）
                if (this.selectedPoint > 0 && this.selectedPoint < this.toneCurvePoints.length - 1) {
                    this.toneCurvePoints.splice(this.selectedPoint, 1);
                    this.selectedPoint = -1;
                    this.drawToneCurve();
                }
            };
        }
    }
});