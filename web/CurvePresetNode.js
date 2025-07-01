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
            'Linear (No Adjustment)': { 
                points: '0,0;255,255',
                description: 'Linear curve with no adjustments, preserves original image effect',
                recommendedChannel: 'RGB'
            },
            
            // === Basic Styles (Obvious Effects) ===
            'Portrait Special': { 
                points: '0,15;64,85;128,155;192,210;255,245',
                description: 'Designed for portraits, brightens skin tones, softens contrast, makes skin more transparent and natural',
                recommendedChannel: 'R'
            },
            'Landscape Special': { 
                points: '0,0;32,15;96,75;160,185;224,245;255,255',
                description: 'Enhanced landscape contrast, highlights detail layers, makes sky bluer and plants greener',
                recommendedChannel: 'G'
            },
            'Night Scene Special': { 
                points: '0,25;48,80;96,130;160,190;224,230;255,250',
                description: 'Optimized for night scenes, brightens dark details, maintains highlights without overexposure',
                recommendedChannel: 'RGB'
            },
            
            // === Contrast Series (Most Obvious Effects) ===
            'High Contrast': { 
                points: '0,0;48,25;128,128;208,230;255,255',
                description: 'Strong S-curve, greatly enhances contrast, makes image more vivid and powerful',
                recommendedChannel: 'RGB'
            },
            'Ultra High Contrast': { 
                points: '0,0;64,15;128,128;192,240;255,255',
                description: 'Extreme contrast effect, strong light-dark contrast',
                recommendedChannel: 'RGB'
            },
            'Soft Contrast': { 
                points: '0,20;64,80;128,140;192,200;255,240',
                description: 'Mild S-curve, moderately enhances contrast, maintains soft and natural image',
                recommendedChannel: 'RGB'
            },
            'Dark Tone Style': { 
                points: '0,0;64,35;128,85;192,140;255,200',
                description: 'Overall darkening processing, creates low-key mysterious atmosphere, suitable for artistic creation',
                recommendedChannel: 'RGB'
            },
            'Bright Tone Style': { 
                points: '0,50;64,100;128,170;192,220;255,255',
                description: 'Overall brightening processing, creates bright and fresh feeling, suitable for fashion or commercial photography',
                recommendedChannel: 'RGB'
            },
            
            // === Cinematic Color Grading (Strong Style) ===
            'Cinematic Blue Orange': { 
                points: '0,10;48,35;96,80;160,180;208,235;255,250',
                description: 'Cinematic blue-orange color grading, classic Hollywood style',
                recommendedChannel: 'B'
            },
            'Cyberpunk': { 
                points: '0,0;32,15;96,60;160,200;224,250;255,255',
                description: 'Cyberpunk style, futuristic tech feel, high contrast',
                recommendedChannel: 'B'
            },
            'Post Apocalyptic': { 
                points: '0,0;64,40;128,95;192,150;255,210',
                description: 'Post-apocalyptic style, desolate and weathered, suitable for post-apocalyptic themes',
                recommendedChannel: 'R'
            },
            'Vintage Cinema': { 
                points: '0,5;48,45;96,90;160,170;224,220;255,245',
                description: 'Vintage warm tone processing, adds warmth to the image, suitable for nostalgic themes',
                recommendedChannel: 'R'
            },
            'Modern Cinema': { 
                points: '0,0;64,50;128,120;192,200;255,255',
                description: 'Modern cool tone processing, creates cool atmosphere, suitable for modern or tech themes',
                recommendedChannel: 'B'
            },
            
            // === Film Styles (Strong Vintage Feel) ===
            'VSCO Classic': { 
                points: '0,20;32,50;96,110;160,180;224,230;255,245',
                description: 'VSCO film style, vintage texture, simulates film effects',
                recommendedChannel: 'RGB'
            },
            'Kodak Film': { 
                points: '0,25;48,70;96,125;160,185;224,230;255,245',
                description: 'Kodak film style, classic film color reproduction',
                recommendedChannel: 'R'
            },
            'Fuji Film': { 
                points: '0,15;64,85;128,150;192,210;255,245',
                description: 'Fuji film style, vibrant and saturated color reproduction',
                recommendedChannel: 'G'
            },
            'Polaroid': { 
                points: '0,35;48,85;96,140;160,190;224,225;255,240',
                description: 'Polaroid instant film style, vintage nostalgic texture',
                recommendedChannel: 'R'
            },
            'Black & White Film': { 
                points: '0,0;48,35;96,80;160,175;224,230;255,255',
                description: 'Black and white film texture, strong contrast and texture feel',
                recommendedChannel: 'RGB'
            },
            
            // === Japanese Styles (Fresh and Clear) ===
            'Japanese Fresh': { 
                points: '0,35;64,100;128,170;192,225;255,250',
                description: 'Creates Japanese freshness, overall brightening, reduces contrast, presents soft texture',
                recommendedChannel: 'RGB'
            },
            'Japanese Transparent': { 
                points: '0,40;48,90;96,145;144,190;192,225;255,250',
                description: 'Creates Japanese transparency effect, significantly brightens the image, creates dreamy transparency',
                recommendedChannel: 'RGB'
            },
            'Japanese Creamy': { 
                points: '0,45;48,100;96,155;144,200;192,235;255,250',
                description: 'Japanese creamy tones, warm and soft, creates healing atmosphere',
                recommendedChannel: 'R'
            },
            'Japanese Forest': { 
                points: '0,20;64,80;128,145;192,200;255,240',
                description: 'Japanese forest style, natural and fresh, suitable for outdoor and plant themes',
                recommendedChannel: 'G'
            },
            
            // === Hong Kong Style Series (Vintage Hong Kong Films) ===
            'Hong Kong Classic': { 
                points: '0,0;48,25;96,70;160,170;208,220;255,250',
                description: 'Classic Hong Kong color tones, S-curve enhances contrast, creates vintage Hong Kong film texture',
                recommendedChannel: 'RGB'
            },
            'Hong Kong Dark Tone': { 
                points: '0,0;32,10;96,55;160,140;224,190;255,230',
                description: 'Hong Kong dark tone processing, darkens overall color tone, creates mysterious atmosphere',
                recommendedChannel: 'RGB'
            },
            'Hong Kong Neon': { 
                points: '0,10;48,35;96,75;160,190;208,240;255,255',
                description: 'Hong Kong neon effect, enhances highlights, suitable for night scenes and urban themes',
                recommendedChannel: 'B'
            },
            
            // === Social Media Styles ===
            'Xiaohongshu (Little Red Book)': { 
                points: '0,30;64,90;128,155;192,220;255,250',
                description: 'Xiaohongshu style color grading, warm and bright, suitable for daily sharing and life recording',
                recommendedChannel: 'RGB'
            },
            'Instagram': { 
                points: '0,15;48,70;96,125;160,180;224,230;255,250',
                description: 'Instagram style, fashionable and modern, suitable for social media sharing',
                recommendedChannel: 'RGB'
            },
            'TikTok Popular': { 
                points: '0,15;64,90;128,160;192,220;255,248',
                description: 'TikTok popular style, youthful and energetic, suitable for short video content',
                recommendedChannel: 'RGB'
            },
            
            // === Fashion Photography ===
            'Fashion Magazine': { 
                points: '0,0;48,30;96,75;160,185;208,235;255,255',
                description: 'Fashion magazine style, high-end and elegant, suitable for commercial photography',
                recommendedChannel: 'RGB'
            },
            'Premium Gray': { 
                points: '0,25;64,80;128,135;192,190;255,240',
                description: 'Premium gray color grading, low saturation, premium texture',
                recommendedChannel: 'RGB'
            },
            'Morandi Color': { 
                points: '0,40;64,95;128,150;192,205;255,235',
                description: 'Morandi color style, soft and elegant, artistic atmosphere',
                recommendedChannel: 'RGB'
            },
            'Milk Tea Color': { 
                points: '0,35;48,85;96,140;160,190;224,225;255,240',
                description: 'Milk tea color tone, warm and comfortable, suitable for daily life recording',
                recommendedChannel: 'R'
            },
            
            // === Artistic Styles ===
            'Oil Painting Texture': { 
                points: '0,10;48,60;96,115;160,170;224,220;255,245',
                description: 'Oil painting texture effect, rich artistic expression',
                recommendedChannel: 'RGB'
            },
            'Watercolor Painting': { 
                points: '0,40;64,105;128,170;192,220;255,245',
                description: 'Watercolor painting style, light and transparent artistic effect',
                recommendedChannel: 'RGB'
            },
            'Sketch Style': { 
                points: '0,0;64,45;128,105;192,165;255,220',
                description: 'Sketch style, clean and crisp line expression',
                recommendedChannel: 'RGB'
            },
            'Printmaking Effect': { 
                points: '0,0;32,15;96,65;160,155;224,210;255,240',
                description: 'Printmaking effect, strong contrast and texture feel',
                recommendedChannel: 'RGB'
            },
            
            // === Special Effects (Strong Effects) ===
            'Dreamy Purple Tone': { 
                points: '0,20;48,75;96,135;160,190;224,235;255,250',
                description: 'Dreamy purple tone, romantic and mysterious visual effect',
                recommendedChannel: 'B'
            },
            'Youthful Vitality': { 
                points: '0,30;64,100;128,170;192,225;255,250',
                description: 'Youthful vitality style, bright and vibrant, full of life',
                recommendedChannel: 'RGB'
            },
            'Commercial Photography': { 
                points: '0,5;48,55;96,105;160,185;224,240;255,255',
                description: 'Commercial photography style, professional and precise color representation',
                recommendedChannel: 'RGB'
            },
            'Wedding Photography': { 
                points: '0,40;64,105;128,170;192,225;255,248',
                description: 'Wedding photography style, romantic and dreamy, highlights happiness',
                recommendedChannel: 'R'
            },
            'Street Photography Style': { 
                points: '0,15;48,70;96,125;160,185;224,230;255,245',
                description: 'Street photography style, natural and authentic, captures life moments',
                recommendedChannel: 'RGB'
            },
            
            // === Seasonal Themes ===
            'Spring Warm Sun': { 
                points: '0,30;64,95;128,165;192,220;255,245',
                description: 'Spring warm sun style, warm and bright, full of hope',
                recommendedChannel: 'R'
            },
            'Summer Cool': { 
                points: '0,20;48,80;96,140;160,200;224,240;255,250',
                description: 'Summer cool style, fresh and clear, cooling and refreshing',
                recommendedChannel: 'G'
            },
            'Autumn Golden Yellow': { 
                points: '0,15;48,65;96,115;160,175;224,225;255,245',
                description: 'Autumn golden yellow style, warm harvest, mature and stable',
                recommendedChannel: 'R'
            },
            'Winter Snow Scene': { 
                points: '0,25;64,90;128,160;192,215;255,250',
                description: 'Winter snow scene style, pure and cool, silver-clad landscape',
                recommendedChannel: 'B'
            },
            
            // === Extreme Effects (For Testing) ===
            'Extreme Brighten': { 
                points: '0,100;64,180;128,220;192,240;255,255',
                description: 'Extreme brighten effect, significantly increases image brightness',
                recommendedChannel: 'RGB'
            },
            'Extreme Darken': { 
                points: '0,0;64,20;128,60;192,100;255,150',
                description: 'Extreme darken effect, creates deep atmosphere',
                recommendedChannel: 'RGB'
            },
            'Invert Effect': { 
                points: '0,255;64,192;128,128;192,64;255,0',
                description: 'Invert color tone effect, creates special visual impact',
                recommendedChannel: 'RGB'
            },
            'S-Curve Enhanced': { 
                points: '0,0;32,5;96,50;160,205;224,250;255,255',
                description: 'Strong S-curve, greatly enhances contrast',
                recommendedChannel: 'RGB'
            },
            
            // === Portrait Photography ===
            'Portrait Beauty': { 
                points: '0,25;48,85;96,140;160,190;224,230;255,245',
                description: 'Portrait beauty effect, soft brightening, suitable for portrait photography',
                recommendedChannel: 'R'
            },
            'Portrait Texture': { 
                points: '0,10;48,60;96,110;160,175;224,225;255,250',
                description: 'Portrait texture enhancement, highlights skin texture and dimensionality',
                recommendedChannel: 'RGB'
            },
            'Portrait Soft Light': { 
                points: '0,35;64,100;128,165;192,215;255,240',
                description: 'Portrait soft light effect, creates gentle lighting feel',
                recommendedChannel: 'R'
            },
            
            // === Landscape Photography ===
            'Landscape Enhancement': { 
                points: '0,5;48,55;96,110;160,180;224,235;255,255',
                description: 'Landscape contrast enhancement, highlights natural scenery layers',
                recommendedChannel: 'G'
            },
            'Natural Scenery': { 
                points: '0,15;64,85;128,150;192,205;255,245',
                description: 'Natural scenery colors, maintains authentic natural color representation',
                recommendedChannel: 'G'
            },
            'Landscape Painting Style': { 
                points: '0,20;48,75;96,130;160,185;224,220;255,240',
                description: 'Landscape painting artistic conception, creates traditional Chinese landscape painting charm',
                recommendedChannel: 'RGB'
            },
            
            // === Cinematic Styles ===
            'Cinematic Film': { 
                points: '0,15;48,65;96,120;160,175;224,215;255,240',
                description: 'Cinematic film texture, vintage cinema color tone',
                recommendedChannel: 'RGB'
            },
            'Cinematic Cool Tone': { 
                points: '0,0;48,30;96,80;160,160;224,210;255,245',
                description: 'Cinematic cool tone, creates cool cinematic atmosphere',
                recommendedChannel: 'B'
            },
            'Cinematic Warm Tone': { 
                points: '0,20;48,75;96,125;160,185;224,230;255,250',
                description: 'Cinematic warm tone, warm cinematic texture',
                recommendedChannel: 'R'
            },
            
            // === Vintage Styles ===
            'Vintage Film': { 
                points: '0,10;48,55;96,105;160,165;224,205;255,235',
                description: 'Vintage film effect, nostalgic film colors',
                recommendedChannel: 'RGB'
            },
            'Vintage Warm Tone': { 
                points: '0,25;48,80;96,135;160,190;224,225;255,245',
                description: 'Vintage warm tone, warm nostalgic feel',
                recommendedChannel: 'R'
            },
            'Nostalgic Tone': { 
                points: '0,5;48,50;96,100;160,160;224,200;255,230',
                description: 'Nostalgic tone effect, creates sense of time passing',
                recommendedChannel: 'RGB'
            },
            
            // === Modern Styles ===
            'Modern Minimalist': { 
                points: '0,20;64,85;128,145;192,200;255,245',
                description: 'Modern minimalist style, clean and crisp visual effect',
                recommendedChannel: 'RGB'
            },
            'Tech Feel': { 
                points: '0,0;48,25;96,75;160,175;224,235;255,255',
                description: 'Tech feel color tone, cool modern technological atmosphere',
                recommendedChannel: 'B'
            },
            'Futurism': { 
                points: '0,10;48,40;96,85;160,185;224,240;255,255',
                description: 'Futuristic style, avant-garde sci-fi visual effect',
                recommendedChannel: 'B'
            },
            
            // === Contrast Series ===
            'High Contrast': { 
                points: '0,0;64,40;128,120;192,200;255,255',
                description: 'High contrast effect, strong light-dark contrast',
                recommendedChannel: 'RGB'
            },
            'Ultra High Contrast': { 
                points: '0,0;48,20;128,128;208,235;255,255',
                description: 'Ultra high contrast, extreme contrast effect',
                recommendedChannel: 'RGB'
            },
            'Soft Contrast': { 
                points: '0,30;64,90;128,155;192,210;255,245',
                description: 'Soft contrast, gentle contrast enhancement',
                recommendedChannel: 'RGB'
            },
            'Dark Tone Style': { 
                points: '0,0;64,35;128,90;192,150;255,200',
                description: 'Dark tone style, darkens overall color tone',
                recommendedChannel: 'RGB'
            },
            'Bright Tone Style': { 
                points: '0,50;64,110;128,175;192,220;255,250',
                description: 'Bright tone style, brightens overall color tone',
                recommendedChannel: 'RGB'
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
                case 'R': return { color: '#ff6b6b', name: 'Red Channel', desc: 'Adjust warm tones and skin color' };
                case 'G': return { color: '#51cf66', name: 'Green Channel', desc: 'Adjust plants and neutral colors' };
                case 'B': return { color: '#339af0', name: 'Blue Channel', desc: 'Adjust cool tones and sky' };
                default: return { color: '#868e96', name: 'RGB Channel', desc: 'Overall color tone adjustment' };
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