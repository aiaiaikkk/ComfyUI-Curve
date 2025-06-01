import { app } from "../../scripts/app.js";

console.log("🎨 PhotoshopCurveNode.js 开始加载...");

class PhotoshopCurveNodeWidget {
    constructor(node) {
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
        
        // 查找widgets
        this.points = null;
        this.interp = null;
        this.channel = null;
        
        // 初始化端点滑块值
        this.blackPointX = 0;
        this.whitePointX = 255;
        this.isDraggingBlackSlider = false;
        this.isDraggingWhiteSlider = false;
        
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
            display: flex;
            flex-direction: column;
            align-items: center;
        `;
        
        // 创建通道选择器
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
        `;
        
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
        
        // 创建滑块轨道
        this.sliderTrack = document.createElement('div');
        this.sliderTrack.style.cssText = `
            position: absolute;
            left: 0px;
            right: 0px;
            top: 15px;
            height: 2px;
            background: #555;
        `;
        this.sliderContainer.appendChild(this.sliderTrack);
        
        // 创建左侧三角形滑块(黑点)
        this.blackPointSlider = document.createElement('div');
        this.blackPointSlider.style.cssText = `
            position: absolute;
            left: 0px;
            top: 5px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 16px solid #4ecdc4;
            transform: translateX(-8px);
            cursor: ew-resize;
            filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.5));
            transition: border-bottom-color 0.2s;
        `;
        this.sliderContainer.appendChild(this.blackPointSlider);
        
        // 创建右侧三角形滑块(白点)
        this.whitePointSlider = document.createElement('div');
        this.whitePointSlider.style.cssText = `
            position: absolute;
            left: 384px;
            top: 5px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-bottom: 16px solid #4ecdc4;
            transform: translateX(8px);
            cursor: ew-resize;
            filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.5));
            transition: border-bottom-color 0.2s;
        `;
        this.sliderContainer.appendChild(this.whitePointSlider);
        
        // 添加组件到容器
        this.container.appendChild(this.channelSelector);
        this.container.appendChild(this.svg);
        this.container.appendChild(this.sliderContainer);
        
        // 添加到ComfyUI节点
        try {
            console.log("🎨 正在添加DOM widget到节点:", this.node);
            if (!this.node || !this.node.addDOMWidget) {
                console.error("🎨 节点对象无效或缺少addDOMWidget方法");
                return;
            }
            
            this.node.addDOMWidget('curve_editor', 'div', this.container);
            console.log("🎨 DOM widget 添加成功");
            
            // 设置滑块事件
            this.setupSliderEvents();
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
            return;
        }
        
        const pos = this.getSVGPoint(e);
        const point = this.controlPoints[this.selectedPoint];
        
        if (this.selectedPoint === 0) {
            // 允许起点在X轴上移动，但受黑点滑块的限制
            point.x = Math.max(this.blackPointX, Math.min(this.controlPoints[1].x - 1, pos.x));
            point.y = pos.y;
            // 同步更新黑点滑块位置
            this.blackPointX = point.x;
            this.updateSliderPositions();
        } else if (this.selectedPoint === this.controlPoints.length - 1) {
            // 允许终点在X轴上移动，但受白点滑块的限制
            point.x = Math.max(this.controlPoints[this.controlPoints.length - 2].x + 1, 
                Math.min(this.whitePointX, pos.x));
            point.y = pos.y;
            // 同步更新白点滑块位置
            this.whitePointX = point.x;
            this.updateSliderPositions();
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
    
    // 设置滑块事件
    setupSliderEvents() {
        try {
            // 黑点滑块拖动
            this.blackPointX = 0;
            this.whitePointX = 255;
            
            this._boundBlackSliderDrag = this.handleBlackSliderDrag.bind(this);
            this._boundWhiteSliderDrag = this.handleWhiteSliderDrag.bind(this);
            this._boundStopSliderDrag = this.stopSliderDrag.bind(this);
            
            // 滑块鼠标进入/离开效果
            this.blackPointSlider.addEventListener('mouseenter', () => {
                this.blackPointSlider.style.borderBottomColor = '#7befe6';
            });
            
            this.blackPointSlider.addEventListener('mouseleave', () => {
                if (!this.isDraggingBlackSlider) {
                    this.blackPointSlider.style.borderBottomColor = '#4ecdc4';
                }
            });
            
            this.whitePointSlider.addEventListener('mouseenter', () => {
                this.whitePointSlider.style.borderBottomColor = '#7befe6';
            });
            
            this.whitePointSlider.addEventListener('mouseleave', () => {
                if (!this.isDraggingWhiteSlider) {
                    this.whitePointSlider.style.borderBottomColor = '#4ecdc4';
                }
            });
            
            this.blackPointSlider.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.isDraggingBlackSlider = true;
                this.blackPointSlider.style.borderBottomColor = '#aaffe9';
                document.addEventListener('mousemove', this._boundBlackSliderDrag);
                document.addEventListener('mouseup', this._boundStopSliderDrag);
            });
            
            this.whitePointSlider.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.isDraggingWhiteSlider = true;
                this.whitePointSlider.style.borderBottomColor = '#aaffe9';
                document.addEventListener('mousemove', this._boundWhiteSliderDrag);
                document.addEventListener('mouseup', this._boundStopSliderDrag);
            });
        } catch (error) {
            console.error("🎨 设置滑块事件失败:", error);
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
            this.blackPointSlider.style.left = `${newLeft}px`;
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
            this.whitePointSlider.style.left = `${newLeft}px`;
            this.whitePointSlider.style.right = 'auto';
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
        this.blackPointSlider.style.borderBottomColor = '#4ecdc4';
        this.whitePointSlider.style.borderBottomColor = '#4ecdc4';
        document.removeEventListener('mousemove', this._boundBlackSliderDrag);
        document.removeEventListener('mousemove', this._boundWhiteSliderDrag);
        document.removeEventListener('mouseup', this._boundStopSliderDrag);
    }
    
    // 更新滑块位置
    updateSliderPositions() {
        try {
            if (this.controlPoints.length >= 2 && this.sliderContainer) {
                const startPoint = this.controlPoints[0];
                const endPoint = this.controlPoints[this.controlPoints.length - 1];
                const trackWidth = this.sliderContainer.offsetWidth;
                if (startPoint && this.blackPointSlider) {
                    const blackPosPercent = startPoint.x / 255;
                    const blackPosPixels = blackPosPercent * trackWidth;
                    this.blackPointSlider.style.left = `${blackPosPixels}px`;
                    this.blackPointX = startPoint.x;
                }
                if (endPoint && this.whitePointSlider) {
                    const whitePosPercent = endPoint.x / 255;
                    const whitePosPixels = whitePosPercent * trackWidth;
                    this.whitePointSlider.style.left = `${whitePosPixels}px`;
                    this.whitePointSlider.style.right = 'auto';
                    this.whitePointX = endPoint.x;
                }
            }
        } catch (error) {
            console.error("🎨 更新滑块位置失败:", error);
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
            if (this.blackPointSlider) {
                this.blackPointSlider.removeEventListener('mousedown', this._boundBlackSliderDrag);
                this.blackPointSlider.removeEventListener('mouseenter', null);
                this.blackPointSlider.removeEventListener('mouseleave', null);
            }
            if (this.whitePointSlider) {
                this.whitePointSlider.removeEventListener('mousedown', this._boundWhiteSliderDrag);
                this.whitePointSlider.removeEventListener('mouseenter', null);
                this.whitePointSlider.removeEventListener('mouseleave', null);
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
            this.blackPointSlider = null;
            this.whitePointSlider = null;
            
            console.log("🎨 曲线编辑器已清理");
        } catch (error) {
            console.error("🎨 清理曲线编辑器失败:", error);
        }
    }
}

// 注册扩展
console.log("🎨 开始注册扩展...");

// 注意：直方图不会显示在曲线编辑器中，但会显示在curve_chart输出中
// 这样可以保持UI简洁，同时保留直方图功能

app.registerExtension({
    name: "PhotoshopCurveNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 只处理我们的目标节点
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
            
            // 延迟创建编辑器，确保DOM已经准备好
            setTimeout(() => {
                // 确保widgets已初始化
                if (this.widgets && Array.isArray(this.widgets)) {
                    console.log("🎨 节点widgets数量:", this.widgets.length);
                    
                    // 为每个参数小部件添加回调
                    for (const w of this.widgets) {
                        const originalCallback = w.callback;
                        
                        // 使用闭包保存节点引用，而不是直接设置widget.node属性
                        const node = this;
                        w.callback = function() {
                            // 调用原始回调
                            if (originalCallback) {
                                originalCallback.apply(this, arguments);
                            }
                            
                            // 触发自定义回调
                            if (node.onCurveNodeValueChanged) {
                                node.onCurveNodeValueChanged(this, this.value);
                            }
                        };
                    }
                } else {
                    console.warn("🎨 节点widgets尚未初始化");
                }
                
                // 创建曲线编辑器实例
                console.log("🎨 创建曲线编辑器实例");
                try {
                    if (!this.curveEditor) {
                        this.curveEditor = new PhotoshopCurveNodeWidget(this);
                        console.log("🎨 曲线编辑器创建成功");
                    }
                } catch (error) {
                    console.error("🎨 创建曲线编辑器失败:", error);
                }
                
                // 强制更新节点尺寸和位置
                if (this.graph) {
                    this.graph.setDirtyCanvas(true, true);
                }
                
                console.log("🎨 PhotoshopCurveNode 节点创建完成");
            }, 100); // 延迟100ms确保DOM已准备好
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
    }
});

console.log("🎨 PhotoshopCurveNode.js 加载完成"); 
