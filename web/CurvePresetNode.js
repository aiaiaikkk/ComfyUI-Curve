import { app } from "../../scripts/app.js";

class CurvePresetNodeWidget {
    constructor(node) {
        this.node = node;
        this.presetStyle = node.widgets.find(w => w.name === 'preset_style');
        
        this.createWidget();
        this.setupCallbacks();
        this.updatePreview();
    }
    
    createWidget() {
        // Create preview container
        this.container = document.createElement('div');
        this.container.style.cssText = `
            width: 100%; 
            height: 330px; 
            background: #2a2a2a; 
            border: 1px solid #555; 
            border-radius: 4px; 
            padding: 10px; 
            box-sizing: border-box;
            position: relative;
        `;
        
        // Create style information display
        this.createStyleInfo();
        
        // Create mini curve preview
        this.createCurvePreview();
        
        // Add to ComfyUI node
        this.node.addDOMWidget('preset_preview', 'div', this.container);
    }
    
    createStyleInfo() {
        this.styleInfo = document.createElement('div');
        this.styleInfo.style.cssText = `
            background: #1a1a1a;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 10px;
            font-size: 12px;
            color: #ccc;
        `;
        this.container.appendChild(this.styleInfo);
    }
    
    createCurvePreview() {
        // Create SVG preview
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('viewBox', '0 0 200 200');
        this.svg.style.cssText = `
            width: 100%; 
            height: 200px; 
            background: #1a1a1a;
            border-radius: 4px;
            border: 1px solid #444;
        `;
        this.container.appendChild(this.svg);
    }
    
    setupCallbacks() {
        if (this.presetStyle) {
            const originalCallback = this.presetStyle.callback;
            this.presetStyle.callback = () => {
                if (originalCallback) originalCallback();
                this.updatePreview();
            };
        }
    }
    
    getPresetCurves() {
        return {
            'Linear (无调整)': { 
                points: '0,0;255,255',
                description: '线性曲线，不进行任何调整，保持原始图像效果',
                recommendedChannel: 'RGB'
            },
            
            // === 基础风格 ===
            '人像专用': { 
                points: '0,15;64,85;128,155;192,210;255,245',
                description: '专为人像设计，提亮肤色，柔化对比，让肌肤更通透自然',
                recommendedChannel: 'RGB'
            },
            '风景专用': { 
                points: '0,0;32,15;96,75;160,185;224,245;255,255',
                description: '增强风景对比度，突出细节层次，让天空更蓝植物更绿',
                recommendedChannel: 'RGB'
            },
            '夜景专用': { 
                points: '0,25;48,80;96,130;160,190;224,230;255,250',
                description: '针对夜景优化，大幅提亮暗部细节，保持高光不过曝',
                recommendedChannel: 'RGB'
            },
            
            // === 对比度系列 ===
            '高对比度': { 
                points: '0,0;48,25;128,128;208,230;255,255',
                description: '强烈S型曲线，大幅增强对比度，使图像更鲜明有力',
                recommendedChannel: 'RGB'
            },
            '超高对比': { 
                points: '0,0;64,15;128,128;192,240;255,255',
                description: '极端对比效果，强烈的明暗对比',
                recommendedChannel: 'RGB'
            },
            '柔和对比': { 
                points: '0,20;64,80;128,140;192,200;255,240',
                description: '温和S型曲线，适度增强对比，保持柔和自然',
                recommendedChannel: 'RGB'
            },
            '暗调风格': { 
                points: '0,0;64,35;128,85;192,140;255,200',
                description: '整体压暗处理，营造低调神秘氛围，适合艺术创作',
                recommendedChannel: 'RGB'
            },
            '亮调风格': { 
                points: '0,50;64,100;128,170;192,220;255,255',
                description: '整体提亮处理，营造明亮清新感，适合时尚或商业摄影',
                recommendedChannel: 'RGB'
            },
            
            // === 电影级调色 ===
            '电影蓝橙': { 
                points: '0,10;48,35;96,80;160,180;208,235;255,250',
                description: '电影蓝橙调色，经典好莱坞风格',
                recommendedChannel: 'Blue'
            },
            '赛博朋克': { 
                points: '0,0;32,15;96,60;160,200;224,250;255,255',
                description: '赛博朋克风格，未来科技感，高对比度',
                recommendedChannel: 'Blue'
            },
            '末日废土': { 
                points: '0,0;64,40;128,95;192,150;255,210',
                description: '末日废土风格，荒凉沧桑，适合末日主题',
                recommendedChannel: 'Red'
            },
            '复古电影': { 
                points: '0,5;48,45;96,90;160,170;224,220;255,245',
                description: '复古暖调处理，为图像增加温暖感，适合怀旧主题',
                recommendedChannel: 'Red'
            },
            '现代电影': { 
                points: '0,0;64,50;128,120;192,200;255,255',
                description: '现代冷调处理，营造冷酷氛围，适合现代或科技主题',
                recommendedChannel: 'Blue'
            },
            
            // === 胶片风格 ===
            'VSCO经典': { 
                points: '0,20;32,50;96,110;160,180;224,230;255,245',
                description: 'VSCO胶片风格，复古质感，模拟胶片效果',
                recommendedChannel: 'RGB'
            },
            '柯达胶片': { 
                points: '0,25;48,70;96,125;160,185;224,230;255,245',
                description: '柯达胶片风格，经典胶片色彩还原',
                recommendedChannel: 'Red'
            },
            '富士胶片': { 
                points: '0,15;64,85;128,150;192,210;255,245',
                description: '富士胶片风格，鲜艳饱和的色彩还原',
                recommendedChannel: 'Green'
            },
            '宝丽来': { 
                points: '0,35;48,85;96,140;160,190;224,225;255,240',
                description: '宝丽来即时成像风格，复古怀旧质感',
                recommendedChannel: 'RGB'
            },
            '黑白胶片': { 
                points: '0,0;48,35;96,80;160,175;224,230;255,255',
                description: '黑白胶片质感，强烈的对比和质感感',
                recommendedChannel: 'RGB'
            },
            
            // === 日系风格 ===
            '日系清新': { 
                points: '0,35;64,100;128,170;192,225;255,250',
                description: '营造日系清新感，整体提亮，降低对比，呈现柔美质感',
                recommendedChannel: 'Green'
            },
            '日系通透': { 
                points: '0,40;48,90;96,145;144,190;192,225;255,250',
                description: '营造日系通透效果，大幅提亮图像，营造梦幻通透感',
                recommendedChannel: 'RGB'
            },
            '日系奶油': { 
                points: '0,45;48,100;96,155;144,200;192,235;255,250',
                description: '日系奶油色调，温暖柔和，营造治愈氛围',
                recommendedChannel: 'Red'
            },
            '日系森系': { 
                points: '0,20;64,80;128,145;192,200;255,240',
                description: '日系森系风格，自然清新，适合户外和植物主题',
                recommendedChannel: 'Green'
            },
            
            // === 港风系列 ===
            '港风经典': { 
                points: '0,0;48,25;96,70;160,170;208,220;255,250',
                description: '经典港片色调，S型曲线增强对比度，营造复古港片质感',
                recommendedChannel: 'Red'
            },
            '港风暗调': { 
                points: '0,0;32,10;96,55;160,140;224,190;255,230',
                description: '港风暗调处理，压暗整体色调，营造神秘氛围',
                recommendedChannel: 'RGB'
            },
            '港风霓虹': { 
                points: '0,10;48,35;96,75;160,190;208,240;255,255',
                description: '港风霓虹效果，增强高光，适合夜景和都市主题',
                recommendedChannel: 'Blue'
            },
            
            // === 社交媒体风格 ===
            '小红书': { 
                points: '0,30;64,90;128,155;192,220;255,250',
                description: '小红书风格调色，温暖明亮，适合日常分享和生活记录',
                recommendedChannel: 'Red'
            },
            'Instagram': { 
                points: '0,15;48,70;96,125;160,180;224,230;255,250',
                description: 'Instagram风格，时尚现代，适合社交媒体分享',
                recommendedChannel: 'RGB'
            },
            'TikTok流行': { 
                points: '0,15;64,90;128,160;192,220;255,248',
                description: 'TikTok流行风格，青春活力，适合短视频内容',
                recommendedChannel: 'RGB'
            },
            
            // === 时尚摄影 ===
            '时尚杂志': { 
                points: '0,0;48,30;96,75;160,185;208,235;255,255',
                description: '时尚杂志风格，高端优雅，适合商业摄影',
                recommendedChannel: 'RGB'
            },
            '高级灰': { 
                points: '0,25;64,80;128,135;192,190;255,240',
                description: '高级灰调色，低饱和度，高端质感',
                recommendedChannel: 'RGB'
            },
            '莫兰迪色': { 
                points: '0,40;64,95;128,150;192,205;255,235',
                description: '莫兰迪色彩风格，柔和优雅，艺术氛围',
                recommendedChannel: 'RGB'
            },
            '奶茶色': { 
                points: '0,35;48,85;96,140;160,190;224,225;255,240',
                description: '奶茶色调，温暖舒适，适合日常生活记录',
                recommendedChannel: 'Red'
            },
            
            // === 艺术风格 ===
            '油画质感': { 
                points: '0,10;48,60;96,115;160,170;224,220;255,245',
                description: '油画质感效果，丰富的艺术表现力',
                recommendedChannel: 'Red'
            },
            '水彩画': { 
                points: '0,40;64,105;128,170;192,220;255,245',
                description: '水彩画风格，轻盈透明的艺术效果',
                recommendedChannel: 'RGB'
            },
            '素描风格': { 
                points: '0,0;64,45;128,105;192,165;255,220',
                description: '素描风格，干净利落的线条表现',
                recommendedChannel: 'RGB'
            },
            '版画效果': { 
                points: '0,0;32,15;96,65;160,155;224,210;255,240',
                description: '版画效果，强烈的对比和质感感',
                recommendedChannel: 'RGB'
            },
            
            // === 特殊效果 ===
            '梦幻紫调': { 
                points: '0,20;48,75;96,135;160,190;224,235;255,250',
                description: '梦幻紫调，浪漫神秘的视觉效果',
                recommendedChannel: 'Blue'
            },
            '青春活力': { 
                points: '0,30;64,100;128,170;192,225;255,250',
                description: '青春活力风格，明亮鲜艳，充满生命力',
                recommendedChannel: 'Green'
            },
            '商业摄影': { 
                points: '0,5;48,55;96,105;160,185;224,240;255,255',
                description: '商业摄影风格，专业精准的色彩表现',
                recommendedChannel: 'RGB'
            },
            '婚纱摄影': { 
                points: '0,40;64,105;128,170;192,225;255,248',
                description: '婚纱摄影风格，浪漫梦幻，突出幸福感',
                recommendedChannel: 'RGB'
            },
            '街拍风格': { 
                points: '0,15;48,70;96,125;160,185;224,230;255,245',
                description: '街拍风格，自然真实，捕捉生活瞬间',
                recommendedChannel: 'RGB'
            },
            
            // === 季节主题 ===
            '春日暖阳': { 
                points: '0,30;64,95;128,165;192,220;255,245',
                description: '春日暖阳风格，温暖明亮，充满希望',
                recommendedChannel: 'Red'
            },
            '夏日清凉': { 
                points: '0,20;48,80;96,140;160,200;224,240;255,250',
                description: '夏日清凉风格，清新明快，降温解暑',
                recommendedChannel: 'Blue'
            },
            '秋日金黄': { 
                points: '0,15;48,65;96,115;160,175;224,225;255,245',
                description: '秋日金黄风格，温暖收获，成熟稳重',
                recommendedChannel: 'Red'
            },
            '冬日雪景': { 
                points: '0,25;64,90;128,160;192,215;255,250',
                description: '冬日雪景风格，纯净冷冽，银装素裹',
                recommendedChannel: 'Blue'
            },
            
            // === 极端效果 ===
            '极端提亮': { 
                points: '0,80;64,140;128,190;192,230;255,255',
                description: '极端提亮效果，大幅增加图像亮度',
                recommendedChannel: 'RGB'
            },
            '极端压暗': { 
                points: '0,0;64,20;128,60;192,120;255,180',
                description: '极端压暗效果，营造深沉氛围',
                recommendedChannel: 'RGB'
            },
            '反转效果': { 
                points: '0,255;64,192;128,128;192,64;255,0',
                description: '反转色调效果，营造特殊视觉冲击',
                recommendedChannel: 'RGB'
            },
            'S型增强': { 
                points: '0,0;32,5;96,50;160,205;224,250;255,255',
                description: '强烈S型曲线，大幅增强对比度',
                recommendedChannel: 'RGB'
            },
            
            // === 人像摄影 ===
            '人像美颜': { 
                points: '0,25;48,85;96,140;160,190;224,230;255,245',
                description: '人像美颜效果，柔和提亮，适合人像摄影',
                recommendedChannel: 'Red'
            },
            '人像质感': { 
                points: '0,10;48,60;96,110;160,175;224,225;255,250',
                description: '人像质感增强，突出肌肤质感和立体感',
                recommendedChannel: 'RGB'
            },
            '人像柔光': { 
                points: '0,35;64,100;128,165;192,215;255,240',
                description: '人像柔光效果，营造柔和光感',
                recommendedChannel: 'RGB'
            },
            
            // === 风景摄影 ===
            '风景增强': { 
                points: '0,5;48,55;96,110;160,180;224,235;255,255',
                description: '风景对比增强，突出自然风光层次',
                recommendedChannel: 'Green'
            },
            '自然风光': { 
                points: '0,15;64,85;128,150;192,205;255,245',
                description: '自然风光色彩，保持真实的自然色彩表现',
                recommendedChannel: 'Green'
            },
            '山水画意': { 
                points: '0,20;48,75;96,130;160,185;224,220;255,240',
                description: '山水画意境，营造中国传统山水画韵味',
                recommendedChannel: 'RGB'
            },
            
            // === 电影风格 ===
            '电影胶片': { 
                points: '0,15;48,65;96,120;160,175;224,215;255,240',
                description: '电影胶片质感，复古电影色调',
                recommendedChannel: 'RGB'
            },
            '电影冷调': { 
                points: '0,0;48,30;96,80;160,160;224,210;255,245',
                description: '电影冷调，营造冷峻电影氛围',
                recommendedChannel: 'Blue'
            },
            '电影暖调': { 
                points: '0,20;48,75;96,125;160,185;224,230;255,250',
                description: '电影暖调，温暖电影质感',
                recommendedChannel: 'Red'
            },
            
            // === 复古风格 ===
            '复古胶片': { 
                points: '0,10;48,55;96,105;160,165;224,205;255,235',
                description: '复古胶片效果，怀旧胶片色彩',
                recommendedChannel: 'RGB'
            },
            '复古暖调': { 
                points: '0,25;48,80;96,135;160,190;224,225;255,245',
                description: '复古暖调，温暖的怀旧感觉',
                recommendedChannel: 'Red'
            },
            '怀旧色调': { 
                points: '0,5;48,50;96,100;160,160;224,200;255,230',
                description: '怀旧色调效果，营造时光流逝感',
                recommendedChannel: 'RGB'
            },
            
            // === 现代风格 ===
            '现代简约': { 
                points: '0,20;64,85;128,145;192,200;255,245',
                description: '现代简约风格，干净利落的视觉效果',
                recommendedChannel: 'RGB'
            },
            '科技感': { 
                points: '0,0;48,25;96,75;160,175;224,235;255,255',
                description: '科技感色调，冷峻现代科技氛围',
                recommendedChannel: 'Blue'
            },
            '未来主义': { 
                points: '0,10;48,40;96,85;160,185;224,240;255,255',
                description: '未来主义风格，前卫科幻的视觉效果',
                recommendedChannel: 'Blue'
            }
        };
    }
    
    updatePreview() {
        const currentStyle = this.presetStyle ? this.presetStyle.value : 'Linear (No Adjustment)';
        const presetData = this.getPresetCurves()[currentStyle];
        
        if (!presetData) return;
        
        // 获取通道颜色和名称
        const getChannelInfo = (channel) => {
            switch (channel) {
                case 'Red': return { color: '#ff6b6b', name: '红色通道', desc: '调整暖色调和肤色' };
                case 'Green': return { color: '#51cf66', name: '绿色通道', desc: '调整植物和中性色彩' };
                case 'Blue': return { color: '#339af0', name: '蓝色通道', desc: '调整冷色调和天空' };
                default: return { color: '#868e96', name: 'RGB通道', desc: '整体色调调整' };
            }
        };
        
        const channelInfo = getChannelInfo(presetData.recommendedChannel);
        
        // 更新风格信息
        this.styleInfo.innerHTML = `
            <div style="font-weight: bold; color: #4ecdc4; margin-bottom: 4px;">
                ${currentStyle}
            </div>
            <div style="margin-bottom: 8px;">${presetData.description}</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 6px 8px; background: #0a0a0a; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background: ${channelInfo.color}; border: 1px solid #333;"></div>
                    <span style="font-weight: bold; color: ${channelInfo.color}; font-size: 11px;">Recommended Channel: ${channelInfo.name}</span>
                </div>
                <span style="color: #888; font-size: 10px;">${channelInfo.desc}</span>
            </div>
            <div style="font-family: monospace; font-size: 10px; color: #888; background: #0a0a0a; padding: 4px 6px; border-radius: 2px;">
                Curve Points: ${presetData.points}
            </div>
        `;
        
        // 绘制曲线预览
        this.drawCurvePreview(presetData.points);
    }
    
    drawCurvePreview(pointsStr) {
        // Clear SVG
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }
        
        // 创建背景渐变
        this.createPreviewGradient();
        
        // 绘制背景
        const bg = document.createElementNS(this.svg.namespaceURI, 'rect');
        bg.setAttribute('width', '200');
        bg.setAttribute('height', '200');
        bg.setAttribute('fill', 'url(#previewGradient)');
        bg.setAttribute('stroke', '#444');
        bg.setAttribute('stroke-width', '1');
        this.svg.appendChild(bg);
        
        // 绘制网格
        this.drawPreviewGrid();
        
        // 解析并绘制曲线
        const points = this.parsePoints(pointsStr);
        if (points.length >= 2) {
            this.drawCurve(points);
        }
    }
    
    createPreviewGradient() {
        const defs = document.createElementNS(this.svg.namespaceURI, 'defs');
        const gradient = document.createElementNS(this.svg.namespaceURI, 'linearGradient');
        gradient.setAttribute('id', 'previewGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');
        
        const stop1 = document.createElementNS(this.svg.namespaceURI, 'stop');
        const stop2 = document.createElementNS(this.svg.namespaceURI, 'stop');
        stop1.setAttribute('offset', '0%');
        stop2.setAttribute('offset', '100%');
        
        stop1.setAttribute('stop-color', 'rgba(255,255,255,0.3)');
        stop2.setAttribute('stop-color', 'rgba(0,0,0,0.3)');
        
        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        this.svg.appendChild(defs);
    }
    
    drawPreviewGrid() {
        // 绘制简单网格
        for (let i = 1; i < 4; i++) {
            const pos = (200 / 4) * i;
            
            // 垂直线
            const vLine = document.createElementNS(this.svg.namespaceURI, 'line');
            vLine.setAttribute('x1', pos);
            vLine.setAttribute('y1', '0');
            vLine.setAttribute('x2', pos);
            vLine.setAttribute('y2', '200');
            vLine.setAttribute('stroke', '#333');
            vLine.setAttribute('stroke-width', '0.5');
            this.svg.appendChild(vLine);
            
            // 水平线
            const hLine = document.createElementNS(this.svg.namespaceURI, 'line');
            hLine.setAttribute('x1', '0');
            hLine.setAttribute('y1', pos);
            hLine.setAttribute('x2', '200');
            hLine.setAttribute('y2', pos);
            hLine.setAttribute('stroke', '#333');
            hLine.setAttribute('stroke-width', '0.5');
            this.svg.appendChild(hLine);
        }
    }
    
    drawCurve(points) {
        if (points.length < 2) return;
        
        // 转换坐标
        const coords = points.map(p => ({
            x: (p.x / 255) * 200,
            y: 200 - (p.y / 255) * 200
        }));
        
        let pathData = `M${coords[0].x},${coords[0].y}`;
        
        if (coords.length === 2) {
            pathData += ` L${coords[1].x},${coords[1].y}`;
        } else {
            for (let i = 1; i < coords.length; i++) {
                const current = coords[i];
                const previous = coords[i - 1];
                const next = coords[i + 1];
                
                if (i === 1) {
                    const cp1x = previous.x + (current.x - previous.x) * 0.3;
                    const cp1y = previous.y + (current.y - previous.y) * 0.3;
                    const cp2x = current.x - (next ? (next.x - previous.x) * 0.2 : (current.x - previous.x) * 0.3);
                    const cp2y = current.y - (next ? (next.y - previous.y) * 0.2 : (current.y - previous.y) * 0.3);
                    pathData += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${current.x},${current.y}`;
                } else if (i === coords.length - 1) {
                    const prev2 = coords[i - 2];
                    const cp1x = previous.x + (current.x - prev2.x) * 0.2;
                    const cp1y = previous.y + (current.y - prev2.y) * 0.2;
                    const cp2x = current.x - (current.x - previous.x) * 0.3;
                    const cp2y = current.y - (current.y - previous.y) * 0.3;
                    pathData += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${current.x},${current.y}`;
                } else {
                    const prev2 = coords[i - 2];
                    const cp1x = previous.x + (current.x - prev2.x) * 0.2;
                    const cp1y = previous.y + (current.y - prev2.y) * 0.2;
                    const cp2x = current.x - (next.x - previous.x) * 0.2;
                    const cp2y = current.y - (next.y - previous.y) * 0.2;
                    pathData += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${current.x},${current.y}`;
                }
            }
        }
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#4ecdc4');
        path.setAttribute('stroke-width', '2');
        this.svg.appendChild(path);
        
        // 绘制控制点
        coords.forEach(coord => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', coord.x);
            circle.setAttribute('cy', coord.y);
            circle.setAttribute('r', '2');
            circle.setAttribute('fill', '#4ecdc4');
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '1');
            this.svg.appendChild(circle);
        });
    }
    
    parsePoints(pointsStr) {
        return pointsStr.split(';')
            .map(s => s.split(',').map(Number))
            .filter(a => a.length === 2 && !isNaN(a[0]) && !isNaN(a[1]))
            .map(a => ({ x: Math.max(0, Math.min(255, a[0])), y: Math.max(0, Math.min(255, a[1])) }))
            .sort((a, b) => a.x - b.x);
    }
}

// 注册节点扩展
app.registerExtension({
    name: "CurvePresetNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "CurvePresetNode") {
            nodeType.prototype.onNodeCreated = function() {
                // Set node default size, ensure complete display of preview content
                this.size = [340, 370];  // Increase height to 370, ensure it wraps the 330px background panel + margins
                
                setTimeout(() => {
                    if (!this.presetPreview) {
                        this.presetPreview = new CurvePresetNodeWidget(this);
                        
                        // 确保节点大小适配内容
                        if (this.onResize) {
                            this.onResize();
                        }
                    }
                }, 100);
            };
        }
    }
}); 