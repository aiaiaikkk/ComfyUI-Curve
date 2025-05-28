import { app } from "../../scripts/app.js";

console.log("🎨 PhotoshopCurveNode.js 开始加载...");

class PhotoshopCurveNodeWidget {
    constructor(node) {
        console.log("🎨 PhotoshopCurveNodeWidget 构造函数被调用", node);
        this.node = node;
        
        // 查找widgets
        this.points = node.widgets.find(w => w.name === 'curve_points');
        this.interp = node.widgets.find(w => w.name === 'interpolation');
        this.channel = node.widgets.find(w => w.name === 'channel');
        
        console.log("🎨 找到的widgets", {
            points: !!this.points,
            interp: !!this.interp,
            channel: !!this.channel
        });
        
        // 确保有默认的曲线点值
        if (this.points && (!this.points.value || this.points.value.trim() === '')) {
            this.points.value = '0,0;255,255';
        }
        
        // 初始化控制点数据
        this.controlPoints = this.parsePoints(this.getActiveCurvePoints());
        this.selectedPoint = -1;
        this.isDragging = false;
        
        try {
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
        // 创建容器
        this.container = document.createElement('div');
        this.container.style.cssText = `
            width: 100%; 
            height: 444px; 
            background: #2a2a2a; 
            border: 1px solid #555; 
            border-radius: 4px; 
            padding: 10px; 
            box-sizing: border-box;
            position: relative;
        `;
        
        // 创建通道选择器
        this.createChannelSelector();
        
        // 创建SVG
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('viewBox', '0 0 384 384');
        this.svg.style.cssText = `
            width: 100%; 
            height: 384px; 
            cursor: crosshair;
            background: #1a1a1a;
            border-radius: 2px;
        `;
        
        // 添加组件到容器
        this.container.appendChild(this.channelSelector);
        this.container.appendChild(this.svg);
        
        // 添加到ComfyUI节点
        try {
            this.node.addDOMWidget('curve_editor', 'div', this.container);
            console.log("🎨 DOM widget 添加成功");
        } catch (error) {
            console.error("🎨 DOM widget 添加失败", error);
        }
    }
    
    createChannelSelector() {
        this.channelSelector = document.createElement('div');
        this.channelSelector.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            padding: 4px;
            justify-content: center;
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
        
        this.updateChannelButtons();
    }
    
    selectChannel(channelId) {
        if (this.channel) {
            this.channel.value = channelId;
        }
        this.updateChannelButtons();
        this.drawCurve();
        
        if (this.node.onResize) {
            this.node.onResize();
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
        return this.points ? this.points.value || defaultPoints : defaultPoints;
    }
    
    parsePoints(pointsStr) {
        const points = pointsStr.split(';')
            .map(s => s.split(',').map(Number))
            .filter(a => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]))
            .map(a => ({ x: Math.max(0, Math.min(255, a[0])), y: Math.max(0, Math.min(255, a[1])) }))
            .sort((a, b) => a.x - b.x);
        
        // 如果没有有效的点，返回默认的对角线
        if (points.length === 0) {
            return [{ x: 0, y: 0 }, { x: 255, y: 255 }];
        }
        
        // 确保有起始和结束点
        if (points[0].x > 0) {
            points.unshift({ x: 0, y: 0 });
        }
        if (points[points.length - 1].x < 255) {
            points.push({ x: 255, y: 255 });
        }
        
        return points;
    }
    
    pointsToString(points) {
        return points.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(';');
    }
    
    setupEventListeners() {
        this.svg.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.svg.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.svg.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.svg.addEventListener('mouseleave', this.onMouseUp.bind(this));
        this.svg.addEventListener('dblclick', this.onDoubleClick.bind(this));
        this.svg.addEventListener('contextmenu', this.onRightClick.bind(this));
        this.svg.addEventListener('selectstart', e => e.preventDefault());
    }
    
    setupWidgetCallbacks() {
        if (this.points) {
            const originalCallback = this.points.callback;
            this.points.callback = () => {
                if (originalCallback) originalCallback();
                this.controlPoints = this.parsePoints(this.points.value);
                this.drawCurve();
            };
        }
        
        if (this.interp) {
            const originalCallback = this.interp.callback;
            this.interp.callback = () => {
                if (originalCallback) originalCallback();
                this.drawCurve();
            };
        }
        
        if (this.channel) {
            const originalCallback = this.channel.callback;
            this.channel.callback = () => {
                if (originalCallback) originalCallback();
                this.updateChannelButtons();
                this.drawCurve();
            };
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
            return;
        }
        
        const pos = this.getSVGPoint(e);
        const point = this.controlPoints[this.selectedPoint];
        
        if (this.selectedPoint === 0) {
            point.x = 0;
            point.y = pos.y;
        } else if (this.selectedPoint === this.controlPoints.length - 1) {
            point.x = 255;
            point.y = pos.y;
        } else {
            const prevX = this.controlPoints[this.selectedPoint - 1].x;
            const nextX = this.controlPoints[this.selectedPoint + 1].x;
            point.x = Math.max(prevX + 1, Math.min(nextX - 1, pos.x));
            point.y = pos.y;
        }
        
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
        this.updatePointsWidget();
        this.drawCurve();
    }
    
    removePoint(index) {
        if (index > 0 && index < this.controlPoints.length - 1) {
            this.controlPoints.splice(index, 1);
            this.updatePointsWidget();
            this.drawCurve();
        }
    }
    
    updatePointsWidget() {
        if (this.points) {
            this.points.value = this.pointsToString(this.controlPoints);
        }
        if (this.node.onResize) {
            this.node.onResize();
        }
    }
    
    createChannelGradient() {
        const existingDefs = this.svg.querySelector('defs');
        if (existingDefs) {
            this.svg.removeChild(existingDefs);
        }
        
        const defs = document.createElementNS(this.svg.namespaceURI, 'defs');
        
        // 创建渐变
        const gradient = document.createElementNS(this.svg.namespaceURI, 'linearGradient');
        gradient.setAttribute('id', 'channelGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');
        
        const currentChannel = this.channel ? this.channel.value : 'RGB';
        
        const stop1 = document.createElementNS(this.svg.namespaceURI, 'stop');
        const stop2 = document.createElementNS(this.svg.namespaceURI, 'stop');
        stop1.setAttribute('offset', '0%');
        stop2.setAttribute('offset', '100%');
        
        switch (currentChannel) {
            case 'RGB':
                stop1.setAttribute('stop-color', 'rgba(255,255,255,0.5)');
                stop2.setAttribute('stop-color', 'rgba(0,0,0,0.5)');
                break;
            case 'R':
                stop1.setAttribute('stop-color', 'rgba(255,0,0,0.5)');
                stop2.setAttribute('stop-color', 'rgba(0,255,255,0.5)');
                break;
            case 'G':
                stop1.setAttribute('stop-color', 'rgba(0,255,0,0.5)');
                stop2.setAttribute('stop-color', 'rgba(255,0,255,0.5)');
                break;
            case 'B':
                stop1.setAttribute('stop-color', 'rgba(0,0,255,0.5)');
                stop2.setAttribute('stop-color', 'rgba(255,255,0,0.5)');
                break;
            default:
                stop1.setAttribute('stop-color', 'rgba(255,255,255,0.5)');
                stop2.setAttribute('stop-color', 'rgba(0,0,0,0.5)');
        }
        
        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        
        this.svg.appendChild(defs);
    }
    
    drawCurve() {
        console.log("🎨 开始绘制曲线");
        
        // 清空SVG
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }
        
        // 创建通道渐变
        this.createChannelGradient();
        
        // 绘制背景
        const bg = document.createElementNS(this.svg.namespaceURI, 'rect');
        bg.setAttribute('width', '384');
        bg.setAttribute('height', '384');
        bg.setAttribute('fill', 'url(#channelGradient)');
        bg.setAttribute('stroke', '#444');
        bg.setAttribute('stroke-width', '1');
        this.svg.appendChild(bg);
        
        // 绘制网格
        this.drawGrid();
        
        // 绘制曲线
        if (this.controlPoints.length >= 2) {
            this.drawSmoothCurve();
        }
        
        // 绘制控制点
        this.controlPoints.forEach((point, index) => {
            const circle = document.createElementNS(this.svg.namespaceURI, 'circle');
            const canvasX = (point.x / 255) * 384;
            const canvasY = 384 - (point.y / 255) * 384;
            
            // 限制控制点显示在画布范围内，但保持原始逻辑坐标
            const displayX = Math.max(4, Math.min(380, canvasX));
            const displayY = Math.max(4, Math.min(380, canvasY));
            
            circle.setAttribute('cx', displayX);
            circle.setAttribute('cy', displayY);
            circle.setAttribute('r', index === this.selectedPoint ? '6' : '4');
            
            // 如果控制点超出边界，使用不同的颜色表示
            const isOutOfBounds = canvasY < 0 || canvasY > 384;
            const fillColor = isOutOfBounds ? '#ff9999' : 
                             (index === 0 || index === this.controlPoints.length - 1 ? '#ff6b6b' : '#4ecdc4');
            
            circle.setAttribute('fill', fillColor);
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            this.svg.appendChild(circle);
            
            // 添加坐标标签
            const text = document.createElementNS(this.svg.namespaceURI, 'text');
            text.setAttribute('x', displayX + 8);
            text.setAttribute('y', displayY - 8);
            text.setAttribute('fill', isOutOfBounds ? '#ff9999' : '#fff');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-family', 'monospace');
            text.textContent = `${Math.round(point.x)},${Math.round(point.y)}`;
            this.svg.appendChild(text);
        });
    }
    
    drawGrid() {
        const gridColor = '#333';
        const gridSpacing = 384 / 4;
        
        for (let i = 1; i < 4; i++) {
            const pos = gridSpacing * i;
            
            // 垂直线
            const vLine = document.createElementNS(this.svg.namespaceURI, 'line');
            vLine.setAttribute('x1', pos);
            vLine.setAttribute('y1', '0');
            vLine.setAttribute('x2', pos);
            vLine.setAttribute('y2', '384');
            vLine.setAttribute('stroke', gridColor);
            vLine.setAttribute('stroke-width', '1');
            this.svg.appendChild(vLine);
            
            // 水平线
            const hLine = document.createElementNS(this.svg.namespaceURI, 'line');
            hLine.setAttribute('x1', '0');
            hLine.setAttribute('y1', pos);
            hLine.setAttribute('x2', '384');
            hLine.setAttribute('y2', pos);
            hLine.setAttribute('stroke', gridColor);
            hLine.setAttribute('stroke-width', '1');
            this.svg.appendChild(hLine);
        }
        
        // 添加色调标签
        this.drawToneLabels();
    }
    
    drawToneLabels() {
        const tonePoints = [
            { x: 0, y: 384, label: '黑色' },
            { x: 96, y: 288, label: '阴影' },
            { x: 192, y: 192, label: '中间调' },
            { x: 288, y: 96, label: '高光' },
            { x: 384, y: 0, label: '白色' }
        ];
        
        tonePoints.forEach(point => {
            const text = document.createElementNS(this.svg.namespaceURI, 'text');
            text.setAttribute('x', point.x);
            text.setAttribute('y', point.y);
            text.setAttribute('fill', '#003366');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.textContent = point.label;
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
        const result = [];
        const steps = 384; // 每个像素一个点，确保精确
        
        // 如果只有两个点，使用线性插值
        if (points.length === 2) {
            for (let step = 0; step <= steps; step++) {
                const x = (step / steps) * 255;
                const t = x / 255;
                const y = points[0].y * (1 - t) + points[1].y * t;
                
                const canvasX = (x / 255) * 384;
                const canvasY = 384 - (y / 255) * 384;
                const clampedY = Math.max(0, Math.min(384, canvasY));
                
                result.push({ x: canvasX, y: clampedY });
            }
            return result;
        }
        
        // 使用自然三次样条插值（类似PS）
        const splineCoeffs = this.calculateNaturalSpline(points);
        
        for (let step = 0; step <= steps; step++) {
            const x = (step / steps) * 255;
            const y = this.evaluateNaturalSpline(x, points, splineCoeffs);
            
            const canvasX = (x / 255) * 384;
            const canvasY = 384 - (y / 255) * 384;
            const clampedY = Math.max(0, Math.min(384, canvasY));
            
            result.push({ x: canvasX, y: clampedY });
        }
        
        return result;
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
}

// 注册扩展
console.log("🎨 开始注册扩展...");

app.registerExtension({
    name: "PhotoshopCurveNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        console.log("🎨 beforeRegisterNodeDef 被调用", nodeData.name);
        
        if (nodeData.name === "PhotoshopCurveNode") {
            console.log("🎨 匹配到PhotoshopCurveNode节点！");
            
            // 保存原始的onNodeCreated
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                console.log("🎨 onNodeCreated 被调用", this);
                
                // 调用原始的onNodeCreated（如果存在）
                if (originalOnNodeCreated) {
                    originalOnNodeCreated.call(this);
                }
                
                // 设置节点默认大小，确保能完整显示曲线图
                this.size = [420, 580];  // 宽度420，高度580，增加高度确保画布完全包含
                
                // 延迟创建widget
                setTimeout(() => {
                    console.log("🎨 开始创建曲线编辑器widget");
                    
                    try {
                        if (!this.curveEditor) {
                            this.curveEditor = new PhotoshopCurveNodeWidget(this);
                            console.log("🎨 曲线编辑器创建成功");
                            
                            // 确保节点大小适配内容
                            if (this.onResize) {
                                this.onResize();
                            }
                        } else {
                            console.log("🎨 曲线编辑器已存在");
                        }
                    } catch (error) {
                        console.error("🎨 创建曲线编辑器失败", error);
                    }
                }, 100);
            };
            
            console.log("🎨 onNodeCreated 回调设置完成");
        }
    }
});

console.log("🎨 PhotoshopCurveNode.js 加载完成"); 