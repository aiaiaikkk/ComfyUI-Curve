import { app } from "../../scripts/app.js";

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
                
                // 初始化图像处理相关属性
                this.currentImage = null;
                this.previewCanvas = null;
                this.previewContext = null;
                this.isImageLoaded = false;
                this.preventInvalidDraw = true;
                
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
                    background: #1e1e1e;
                    border-radius: 8px;
                    border: 1px solid #333;
                    overflow: hidden;
                    padding: 0;
                    max-width: 90vw;
                    max-height: 90vh;
                    width: 1200px;
                    height: 800px;
                    display: flex;
                    flex-direction: column;
                    color: #fff;
                    font-family: Arial, sans-serif;
                `;
                
                // 创建标题栏
                const header = document.createElement('div');
                header.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 20px;
                    background: #2a2a2a;
                    border-bottom: 1px solid #333;
                `;
                
                const title = document.createElement('div');
                title.style.cssText = `
                    font-size: 16px;
                    font-weight: bold;
                    color: #fff;
                `;
                title.textContent = '📈 Camera Raw 色调曲线';
                
                // 预设控件
                const presetContainer = document.createElement('div');
                presetContainer.style.cssText = `
                    display: flex;
                    gap: 10px;
                    align-items: center;
                `;
                
                const presetSelect = document.createElement('select');
                presetSelect.id = 'toneCurvePresetSelect';
                presetSelect.style.cssText = `
                    padding: 4px 8px;
                    background: #444;
                    border: 1px solid #555;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 12px;
                `;
                presetSelect.innerHTML = `
                    <option value="Linear">Linear</option>
                    <option value="Medium Contrast">Medium Contrast</option>
                    <option value="Strong Contrast">Strong Contrast</option>
                    <option value="Custom">Custom</option>
                `;
                
                const saveBtn = document.createElement('button');
                saveBtn.style.cssText = `
                    padding: 4px 12px;
                    font-size: 12px;
                    background: #4a7c4e;
                    border: none;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                `;
                saveBtn.innerHTML = '💾 保存';
                
                const closeBtn = document.createElement('button');
                closeBtn.style.cssText = `
                    background: #e25c5c;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    color: white;
                    cursor: pointer;
                    font-size: 12px;
                `;
                closeBtn.textContent = '✕ 关闭';
                closeBtn.onclick = () => modal.remove();
                
                presetContainer.appendChild(presetSelect);
                presetContainer.appendChild(saveBtn);
                presetContainer.appendChild(closeBtn);
                
                header.appendChild(title);
                header.appendChild(presetContainer);
                content.appendChild(header);
                
                // 创建主体内容
                const body = document.createElement('div');
                body.style.cssText = `
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                `;
                
                // 左侧面板 - 图像预览区（与PS Curve一致的比例）
                const leftPanel = document.createElement('div');
                leftPanel.style.cssText = `
                    flex: 1;
                    padding: 20px;
                    background: #2b2b2b;
                    border-right: 1px solid #333;
                    display: flex;
                    flex-direction: column;
                `;
                
                const previewTitle = document.createElement('h4');
                previewTitle.style.cssText = `
                    margin: 0 0 15px 0;
                    color: #aaa;
                    font-size: 14px;
                `;
                previewTitle.textContent = '图像预览';
                
                const previewContainer = document.createElement('div');
                previewContainer.style.cssText = `
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border: 1px solid #444;
                    border-radius: 4px;
                    background: #1a1a1a;
                `;
                
                const previewPlaceholder = document.createElement('div');
                previewPlaceholder.style.cssText = `
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                `;
                previewPlaceholder.innerHTML = `
                    <div>📸</div>
                    <div>图像预览</div>
                    <div style="font-size: 12px; margin-top: 5px;">连接图像后显示</div>
                `;
                
                previewContainer.appendChild(previewPlaceholder);
                leftPanel.appendChild(previewTitle);
                leftPanel.appendChild(previewContainer);
                
                // 右侧面板 - 曲线编辑和控制区（与PS Curve一致的比例）
                const rightPanel = document.createElement('div');
                rightPanel.style.cssText = `
                    width: 600px;
                    display: flex;
                    flex-direction: column;
                    background: #333;
                    overflow: hidden;
                `;
                
                // 曲线编辑器区域
                const curveSection = document.createElement('div');
                curveSection.style.cssText = `
                    flex: 1;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                `;
                
                const canvas = document.createElement('canvas');
                canvas.id = 'toneCurveCanvas';
                canvas.width = 400;
                canvas.height = 400;
                canvas.style.cssText = `
                    border: 1px solid #444;
                    border-radius: 4px;
                    background: #1a1a1a;
                    cursor: crosshair;
                `;
                curveSection.appendChild(canvas);
                
                // 控制面板区域
                const controlsSection = document.createElement('div');
                controlsSection.style.cssText = `
                    padding: 20px;
                    border-top: 1px solid #444;
                    max-height: 350px;
                    overflow-y: auto;
                `;
                
                controlsSection.innerHTML = `
                    <!-- 曲线模式 -->
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #aaa; font-size: 14px;">曲线模式</h4>
                        <div style="display: flex; gap: 5px;">
                            <button class="mode-btn" data-mode="Point" style="flex: 1; padding: 6px; font-size: 11px; background: #555; border: none; border-radius: 3px; color: #fff; cursor: pointer;">点曲线</button>
                            <button class="mode-btn" data-mode="Parametric" style="flex: 1; padding: 6px; font-size: 11px; background: #555; border: none; border-radius: 3px; color: #fff; cursor: pointer;">参数</button>
                            <button class="mode-btn" data-mode="Combined" style="flex: 1; padding: 6px; font-size: 11px; background: #4a90e2; border: none; border-radius: 3px; color: #fff; cursor: pointer;">组合</button>
                        </div>
                    </div>
                    
                    <!-- 参数调整 -->
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 15px 0; color: #aaa; font-size: 14px;">参数调整</h4>
                        <div>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; color: #ff6b6b; font-size: 12px;">高光 (Highlights)</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="range" id="highlights" min="-100" max="100" value="0" style="flex: 1;">
                                    <span id="highlightsValue" style="color: #ccc; font-size: 11px; width: 30px;">0</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; color: #fbbf24; font-size: 12px;">明亮 (Lights)</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="range" id="lights" min="-100" max="100" value="0" style="flex: 1;">
                                    <span id="lightsValue" style="color: #ccc; font-size: 11px; width: 30px;">0</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; color: #60a5fa; font-size: 12px;">暗部 (Darks)</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="range" id="darks" min="-100" max="100" value="0" style="flex: 1;">
                                    <span id="darksValue" style="color: #ccc; font-size: 11px; width: 30px;">0</span>
                                </div>
                            </div>
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; color: #4338ca; font-size: 12px;">阴影 (Shadows)</label>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <input type="range" id="shadows" min="-100" max="100" value="0" style="flex: 1;">
                                    <span id="shadowsValue" style="color: #ccc; font-size: 11px; width: 30px;">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 操作按钮 -->
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button id="resetCurve" style="width: 100%; background: #6b7280; border: none; border-radius: 4px; padding: 8px; color: white; cursor: pointer; font-size: 12px;">重置曲线</button>
                        <button id="resetAll" style="width: 100%; background: #dc2626; border: none; border-radius: 4px; padding: 8px; color: white; cursor: pointer; font-size: 12px;">重置所有</button>
                    </div>
                `;
                
                rightPanel.appendChild(curveSection);
                rightPanel.appendChild(controlsSection);
                
                body.appendChild(leftPanel);
                body.appendChild(rightPanel);
                content.appendChild(body);
                
                modal.appendChild(content);
                document.body.appendChild(modal);
                
                // 初始化曲线编辑器
                this.initializeToneCurveEditor();
                
                // 绑定事件
                this.bindToneCurveEvents();
            };
            
            // 初始化曲线编辑器
            nodeType.prototype.initializeToneCurveEditor = function() {
                const canvas = document.getElementById('toneCurveCanvas');
                if (!canvas) return;
                
                const ctx = canvas.getContext('2d');
                this.toneCurvePoints = [[0, 0], [255, 255]];
                this.selectedPoint = -1;
                this.isDragging = false;
                
                // 绑定鼠标事件
                canvas.addEventListener('mousedown', (e) => this.handleToneCurveMouseDown(e));
                canvas.addEventListener('mousemove', (e) => this.handleToneCurveMouseMove(e));
                canvas.addEventListener('mouseup', (e) => this.handleToneCurveMouseUp(e));
                canvas.addEventListener('dblclick', (e) => this.handleToneCurveDoubleClick(e));
                
                this.drawToneCurve();
            };
            
            // 绘制曲线
            nodeType.prototype.drawToneCurve = function() {
                const canvas = document.getElementById('toneCurveCanvas');
                if (!canvas) return;
                
                const ctx = canvas.getContext('2d');
                const width = canvas.width;
                const height = canvas.height;
                
                // 清空画布
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, width, height);
                
                // 绘制网格
                ctx.strokeStyle = '#404040';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                
                // 垂直线
                for (let i = 0; i <= 4; i++) {
                    const x = (i * width) / 4;
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                }
                
                // 水平线
                for (let i = 0; i <= 4; i++) {
                    const y = (i * height) / 4;
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                }
                ctx.stroke();
                
                // 绘制对角线
                ctx.strokeStyle = '#808080';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(0, height);
                ctx.lineTo(width, 0);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 绘制曲线
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                
                for (let x = 0; x < width; x++) {
                    const inputValue = (x / width) * 255;
                    const outputValue = this.interpolateCurve(inputValue);
                    const y = height - (outputValue / 255) * height;
                    
                    if (x === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
                
                // 绘制控制点
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                
                this.toneCurvePoints.forEach((point, index) => {
                    const x = (point[0] / 255) * width;
                    const y = height - (point[1] / 255) * height;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                });
            };
            
            // 曲线插值 - 使用平滑三次样条插值（与PS风格一致）
            nodeType.prototype.interpolateCurve = function(inputValue) {
                const points = this.toneCurvePoints;
                let baseValue;
                
                if (inputValue <= points[0][0]) {
                    baseValue = points[0][1];
                } else if (inputValue >= points[points.length - 1][0]) {
                    baseValue = points[points.length - 1][1];
                } else {
                    // 使用Catmull-Rom样条插值创建平滑曲线
                    baseValue = this.catmullRomInterpolate(points, inputValue);
                }
                
                // 应用参数调整（高光、明亮、暗部、阴影）
                const parametricValue = this.applyParametricAdjustments(inputValue, baseValue);
                
                return Math.max(0, Math.min(255, parametricValue));
            };
            
            // 应用参数调整（Camera Raw风格）
            nodeType.prototype.applyParametricAdjustments = function(inputValue, baseValue) {
                const { highlights, lights, darks, shadows } = this.toneCurveData;
                
                // 如果所有参数都为0，直接返回基础值
                if (highlights === 0 && lights === 0 && darks === 0 && shadows === 0) {
                    return baseValue;
                }
                
                // Camera Raw风格的区域定义
                // 阴影: 0-63.75, 暗部: 63.75-127.5, 明亮: 127.5-191.25, 高光: 191.25-255
                const shadowsEnd = 63.75;
                const darksEnd = 127.5;
                const lightsEnd = 191.25;
                
                // 计算各区域的权重（使用高斯函数创建平滑过渡）
                const shadowWeight = this.calculateRegionWeight(inputValue, 0, shadowsEnd);
                const darkWeight = this.calculateRegionWeight(inputValue, shadowsEnd, darksEnd);
                const lightWeight = this.calculateRegionWeight(inputValue, darksEnd, lightsEnd);
                const highlightWeight = this.calculateRegionWeight(inputValue, lightsEnd, 255);
                
                // 计算总的调整量（Camera Raw风格的敏感度）
                const totalAdjustment = (
                    shadows * shadowWeight * 0.8 +      // 阴影敏感度
                    darks * darkWeight * 0.6 +          // 暗部敏感度
                    lights * lightWeight * 0.6 +        // 明亮敏感度
                    highlights * highlightWeight * 0.8   // 高光敏感度
                );
                
                // 将调整转换为曲线偏移（Camera Raw标准系数）
                const curveOffset = totalAdjustment * 1.28;
                
                return baseValue + curveOffset;
            };
            
            // 计算区域权重（Camera Raw风格的平滑权重函数）
            nodeType.prototype.calculateRegionWeight = function(inputVal, regionStart, regionEnd) {
                if (inputVal < regionStart || inputVal > regionEnd) {
                    return 0.0;
                }
                
                const regionCenter = (regionStart + regionEnd) / 2;
                const regionWidth = regionEnd - regionStart;
                
                // 使用高斯函数创建平滑的权重分布
                const distanceFromCenter = Math.abs(inputVal - regionCenter) / (regionWidth / 2);
                const weight = Math.exp(-2 * distanceFromCenter * distanceFromCenter);
                
                return weight;
            };
            
            // Catmull-Rom样条插值实现
            nodeType.prototype.catmullRomInterpolate = function(points, x) {
                const n = points.length;
                
                // 找到x所在的区间
                let i = 0;
                for (i = 0; i < n - 1; i++) {
                    if (x >= points[i][0] && x <= points[i + 1][0]) {
                        break;
                    }
                }
                
                // 如果只有两个点，使用线性插值
                if (n === 2) {
                    const t = (x - points[0][0]) / (points[1][0] - points[0][0]);
                    return points[0][1] + t * (points[1][1] - points[0][1]);
                }
                
                // 获取四个控制点
                let p0, p1, p2, p3;
                
                if (i === 0) {
                    // 起始区间，创建虚拟前一个点
                    p0 = [points[0][0] - (points[1][0] - points[0][0]), points[0][1]];
                    p1 = points[0];
                    p2 = points[1];
                    p3 = points[2] || points[1];
                } else if (i === n - 2) {
                    // 末尾区间，创建虚拟后一个点
                    p0 = points[i - 1];
                    p1 = points[i];
                    p2 = points[i + 1];
                    p3 = [points[i + 1][0] + (points[i + 1][0] - points[i][0]), points[i + 1][1]];
                } else {
                    // 中间区间
                    p0 = points[i - 1];
                    p1 = points[i];
                    p2 = points[i + 1];
                    p3 = points[i + 2];
                }
                
                // 归一化参数t
                const t = (x - p1[0]) / (p2[0] - p1[0]);
                
                // Catmull-Rom公式（张力系数0.3，匹配PS风格）
                const tension = 0.3;
                const t2 = t * t;
                const t3 = t2 * t;
                
                // Catmull-Rom基函数
                const h00 = 2 * t3 - 3 * t2 + 1;
                const h10 = t3 - 2 * t2 + t;
                const h01 = -2 * t3 + 3 * t2;
                const h11 = t3 - t2;
                
                // 计算切线（考虑张力）
                const m0 = tension * (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]);
                const m1 = tension * (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
                
                // 最终插值结果
                const result = h00 * p1[1] + h10 * m0 + h01 * p2[1] + h11 * m1;
                
                return Math.max(0, Math.min(255, result));
            };
            
            // 鼠标事件处理
            nodeType.prototype.handleToneCurveMouseDown = function(e) {
                const canvas = document.getElementById('toneCurveCanvas');
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                this.isDragging = true;
                this.selectedPoint = -1;
                
                // 检查是否点击了现有控制点
                this.toneCurvePoints.forEach((point, index) => {
                    const px = (point[0] / 255) * canvas.width;
                    const py = canvas.height - (point[1] / 255) * canvas.height;
                    
                    const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
                    if (distance < 10) {
                        this.selectedPoint = index;
                    }
                });
                
                // 如果没有点击现有点，添加新点
                if (this.selectedPoint === -1) {
                    const newX = Math.round((x / canvas.width) * 255);
                    const newY = Math.round(((canvas.height - y) / canvas.height) * 255);
                    
                    if (newX > 0 && newX < 255) {
                        this.toneCurvePoints.push([newX, newY]);
                        this.toneCurvePoints.sort((a, b) => a[0] - b[0]);
                        this.selectedPoint = this.toneCurvePoints.findIndex(p => p[0] === newX && p[1] === newY);
                        this.drawToneCurve();
                    }
                }
            };
            
            nodeType.prototype.handleToneCurveMouseMove = function(e) {
                if (!this.isDragging || this.selectedPoint === -1) return;
                
                const canvas = document.getElementById('toneCurveCanvas');
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const newX = Math.round((x / canvas.width) * 255);
                const newY = Math.round(((canvas.height - y) / canvas.height) * 255);
                
                // 限制范围和防止交叉
                if (this.selectedPoint > 0 && this.selectedPoint < this.toneCurvePoints.length - 1) {
                    const prevX = this.toneCurvePoints[this.selectedPoint - 1][0];
                    const nextX = this.toneCurvePoints[this.selectedPoint + 1][0];
                    
                    this.toneCurvePoints[this.selectedPoint][0] = Math.max(prevX + 1, Math.min(nextX - 1, newX));
                    this.toneCurvePoints[this.selectedPoint][1] = Math.max(0, Math.min(255, newY));
                } else {
                    // 端点只能调整Y值
                    this.toneCurvePoints[this.selectedPoint][1] = Math.max(0, Math.min(255, newY));
                }
                
                this.drawToneCurve();
            };
            
            nodeType.prototype.handleToneCurveMouseUp = function(e) {
                this.isDragging = false;
            };
            
            nodeType.prototype.handleToneCurveDoubleClick = function(e) {
                if (this.selectedPoint > 0 && this.selectedPoint < this.toneCurvePoints.length - 1) {
                    this.toneCurvePoints.splice(this.selectedPoint, 1);
                    this.selectedPoint = -1;
                    this.drawToneCurve();
                }
            };
            
            // 绑定事件
            nodeType.prototype.bindToneCurveEvents = function() {
                // 参数滑块事件
                ['highlights', 'lights', 'darks', 'shadows'].forEach(param => {
                    const slider = document.getElementById(param);
                    const valueSpan = document.getElementById(param + 'Value');
                    
                    if (slider && valueSpan) {
                        slider.addEventListener('input', (e) => {
                            const value = parseFloat(e.target.value);
                            valueSpan.textContent = value;
                            this.toneCurveData[param] = value;
                            this.drawToneCurve();
                        });
                    }
                });
                
                // 模式按钮事件
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const mode = e.target.dataset.mode;
                        this.toneCurveData.curve_mode = mode;
                        
                        // 更新按钮状态
                        document.querySelectorAll('.mode-btn').forEach(b => {
                            b.style.background = b === e.target ? '#4a90e2' : '#555';
                        });
                    });
                });
                
                // 重置按钮
                const resetCurve = document.getElementById('resetCurve');
                if (resetCurve) {
                    resetCurve.addEventListener('click', () => {
                        this.toneCurvePoints = [[0, 0], [255, 255]];
                        this.drawToneCurve();
                    });
                }
                
                const resetAll = document.getElementById('resetAll');
                if (resetAll) {
                    resetAll.addEventListener('click', () => {
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
                        this.updateToneCurveInterface();
                        this.drawToneCurve();
                    });
                }
            };
            
            // 预设系统方法
            nodeType.prototype.updateToneCurveInterface = function() {
                const highlights = document.getElementById('highlights');
                const lights = document.getElementById('lights');
                const darks = document.getElementById('darks');
                const shadows = document.getElementById('shadows');
                
                if (highlights) {
                    highlights.value = this.toneCurveData.highlights;
                    document.getElementById('highlightsValue').textContent = this.toneCurveData.highlights;
                }
                if (lights) {
                    lights.value = this.toneCurveData.lights;
                    document.getElementById('lightsValue').textContent = this.toneCurveData.lights;
                }
                if (darks) {
                    darks.value = this.toneCurveData.darks;
                    document.getElementById('darksValue').textContent = this.toneCurveData.darks;
                }
                if (shadows) {
                    shadows.value = this.toneCurveData.shadows;
                    document.getElementById('shadowsValue').textContent = this.toneCurveData.shadows;
                }
                
                // 更新曲线模式按钮
                const modeButtons = document.querySelectorAll('.mode-btn');
                modeButtons.forEach(btn => {
                    btn.style.background = btn.dataset.mode === this.toneCurveData.curve_mode ? '#4a90e2' : '#555';
                });
            };
        }
    }
});