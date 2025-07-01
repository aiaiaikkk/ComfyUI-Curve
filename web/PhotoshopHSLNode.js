import { app } from '../../scripts/app.js';
import { $el } from '../../scripts/ui.js';

console.log("🔄 PhotoshopHSLNode.js loading...");

// PS-style saturation adjustment factor calculation (matches backend implementation)
function calculatePSSaturationFactor(sat_shift) {
    if (sat_shift === 0) {
        return 1.0;
    } else if (sat_shift > 0) {
        // Positive adjustment: use exponential curve, avoid over-saturation
        return 1.0 + (sat_shift / 100.0) * 2.0;
    } else {
        // Negative adjustment: when saturation is -100, should completely remove saturation
        return Math.max(0.0, 1.0 + (sat_shift / 100.0));
    }
}

// PS-style lightness adjustment function (matches backend implementation)
function applyPSLightnessAdjustment(value, light_shift) {
    if (light_shift === 0) {
        return value;
    }
    
    // Normalize value to 0-1 range
    const normalized = value / 255.0;
    
    let adjusted;
    if (light_shift > 0) {
        // Brighten: use power function to protect highlights
        const power = 1.0 - (light_shift / 100.0) * 0.5;
        adjusted = Math.pow(normalized, power);
    } else {
        // Darken: use inverse power function to protect shadows
        const power = 1.0 + (Math.abs(light_shift) / 100.0) * 0.5;
        adjusted = Math.pow(normalized, power);
    }
    
    // Convert back to 0-255 range and ensure within valid bounds
    return Math.max(0, Math.min(255, adjusted * 255.0));
}

// OpenCV HSV conversion function (matches backend implementation)
function rgbToOpenCVHSV(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    const s = max === 0 ? 0 : (diff / max) * 255;
    const v = max * 255;
    
    if (diff !== 0) {
        if (max === r) {
            h = 60 * ((g - b) / diff);
        } else if (max === g) {
            h = 60 * (2 + (b - r) / diff);
        } else {
            h = 60 * (4 + (r - g) / diff);
        }
    }
    
    if (h < 0) h += 360;
    h = h / 2; // OpenCV H range is 0-179
    
    return [Math.round(h), Math.round(s), Math.round(v)];
}

function openCVHSVToRGB(h, s, v) {
    h = h * 2; // Convert back to 0-360 degrees
    s = s / 255;
    v = v / 255;
    
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    
    let r = 0, g = 0, b = 0;
    
    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }
    
    return [r + m, g + m, b + m];
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    .photoshop-hsl-panel {
        padding: 10px;
        background-color: #2a2a2a;
        border-radius: 4px;
        margin-top: 10px;
    }
    
    .hsl-control {
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        height: 20px;
    }
    
    .hsl-control input[type="range"] {
        width: 100%;
        height: 12px;
        border-radius: 0;
        outline: none;
        -webkit-appearance: none;
        background: transparent;
        flex: 1;
        min-width: 250px;
        margin: 0 10px;
        padding: 0;
    }
    
    .hsl-control input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        background: #fff;
        border-radius: 50%;
        cursor: pointer;
        margin-top: -4px;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
    }
    
    .hsl-control input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 8px;
        cursor: pointer;
        border-radius: 2px;
    }
    
    .hsl-label {
        color: #fff;
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        width: 60px;
        margin-right: 8px;
        line-height: 12px;
    }
    
    .hsl-value {
        color: #aaa;
        font-size: 11px;
        margin-left: 6px;
        min-width: 30px;
        text-align: right;
        line-height: 12px;
    }

    .hsl-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 10px;
    }

    .hsl-preset {
        padding: 4px 8px;
        background: #333;
        border: 1px solid #444;
        border-radius: 3px;
        color: #fff;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .hsl-preset:hover {
        background: #444;
    }

    .hsl-preset.active {
        background: #666;
        border-color: #888;
    }
    
    .hsl-colorize-toggle {
        display: flex;
        align-items: center;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #444;
    }
    
    .hsl-colorize-toggle label {
        color: #fff;
        margin-left: 8px;
        font-size: 12px;
    }
    
    .hsl-colorize-toggle input[type="checkbox"] {
        width: 16px;
        height: 16px;
    }

    .color-channels {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-bottom: 15px;
    }

    .color-channel {
        padding: 4px 8px;
        background: #333;
        border: 1px solid #444;
        border-radius: 3px;
        color: #fff;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .color-channel:hover {
        background: #444;
    }

    .color-channel.active {
        background: #666;
        border-color: #888;
    }

    /* Modal popup styles - Color Grading style */
    .hsl-modal {
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
    }
    
    .hsl-modal-content {
        background-color: #2a2a2a;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        padding: 0;
        width: 95%;
        max-width: 1400px;
        height: 90%;
        max-height: 900px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    .hsl-modal-header {
        padding: 15px 20px;
        background-color: #1a1a1a;
        border-bottom: 1px solid #404040;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .hsl-modal-title {
        color: #ffffff;
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    }
    
    .hsl-modal-close {
        background-color: #ff4757;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 8px 15px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
    }
    
    .hsl-modal-close:hover {
        background-color: #ff3838;
    }
    
    .hsl-modal-body {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    
    .hsl-preview-container {
        flex: 1;
        padding: 20px;
        background-color: #1e1e1e;
        border-right: 1px solid #404040;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        overflow: hidden;
    }
    
    .hsl-preview-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #1a1a1a;
    }
    
    .hsl-controls-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: #2a2a2a;
        margin: 20px 20px 20px 0;
        border-radius: 8px;
        padding: 20px;
        overflow-y: auto;
        min-width: 450px;
        max-width: 550px;
    }
    
    /* Custom scrollbar styles */
    .hsl-controls-container::-webkit-scrollbar {
        width: 8px;
    }
    
    .hsl-controls-container::-webkit-scrollbar-track {
        background: #1a1a1a;
        border-radius: 4px;
    }
    
    .hsl-controls-container::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
    }
    
    .hsl-controls-container::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    
    .hsl-modal-footer {
        padding: 15px 20px;
        background-color: #1a1a1a;
        border-top: 1px solid #404040;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .hsl-modal-button {
        padding: 8px 15px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: background-color 0.2s;
        margin-left: 10px;
    }
    
    .hsl-modal-button.primary {
        background-color: #27ae60;
        color: white;
    }
    
    .hsl-modal-button.primary:hover {
        background-color: #229954;
    }
    
    .hsl-modal-button.secondary {
        background-color: #3498db;
        color: white;
    }
    
    .hsl-modal-button.secondary:hover {
        background-color: #2980b9;
    }
    
    .hsl-control {
        position: relative;
        margin-bottom: 20px;
    }
    
    .hsl-channel-section {
        margin-bottom: 20px;
        padding: 15px 20px;
        padding-left: 30px;
        background-color: #333;
        border-radius: 6px;
        border-left: 4px solid;
    }
    
    .hsl-channel-section.master {
        border-left-color: #ffffff;
    }
    
    .hsl-channel-section.red {
        border-left-color: #ff0000;
    }
    
    .hsl-channel-section.orange {
        border-left-color: #ff8000;
    }
    
    .hsl-channel-section.yellow {
        border-left-color: #ffff00;
    }
    
    .hsl-channel-section.green {
        border-left-color: #00ff00;
    }
    
    .hsl-channel-section.cyan {
        border-left-color: #00ffff;
    }
    
    .hsl-channel-section.blue {
        border-left-color: #0000ff;
    }
    
    .hsl-channel-section.purple {
        border-left-color: #8000ff;
    }
    
    .hsl-channel-section.magenta {
        border-left-color: #ff00ff;
    }
    
    .hsl-channel-title {
        color: #fff;
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 10px;
    }
`;
document.head.appendChild(style);

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
                    
                    // Store converted image URL to custom property, avoiding impact on original system
                    node._curveNodeImageUrls = outputData.images.map(img => convertToImageUrl(img));
                }
                
                // Update connected downstream node cache (supports PS Curve and HSL nodes)
                const graph = app.graph;
                if (graph && graph.links) {
                    Object.values(graph.links).forEach(link => {
                        if (link && String(link.origin_id) === nodeId) {
                            const targetNode = graph.getNodeById(link.target_id);
                            // Support PS Curve and HSL nodes
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
                                    
                                    // PS Curve node needs imgs property
                                    if (targetNode.type === "PhotoshopCurveNode" && targetNode.imgs) {
                                        // Only update when node already has imgs property
                                        targetNode.imgs = outputData.images.map(imageData => ({ 
                                            src: convertToImageUrl(imageData)
                                        }));
                                    }
                                }
                            }
                        }
                    });
                }
            }
        });
        
        // Listen for execution_cached events
        app.api.addEventListener("execution_cached", ({ detail }) => {
            if (detail && detail.nodes) {
                detail.nodes.forEach(nodeId => {
                    const nodeIdStr = String(nodeId);
                    
                    const node = app.graph.getNodeById(nodeIdStr);
                    if (node) {
                        if (node.imgs && node.imgs.length > 0) {
                            console.log(`🎨 Cached node ${nodeIdStr} already has imgs data`);
                        } else {
                            console.log(`🎨 Cached node ${nodeIdStr} needs to get output data`);
                            
                            // 尝试从last_node_outputs获取
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
    }
}

// 添加photoshop_hsl_preview事件监听器
function setupPhotoshopHSLPreviewListener() {
    if (app.api) {
        console.log("🎨 设置photoshop_hsl_preview事件监听器...", app.api);
        
        // 检查是否已经有同样的监听器
        if (!app.api._hslPreviewListenerAdded) {
            console.log("🎨 添加新的photoshop_hsl_preview监听器");
            app.api._hslPreviewListenerAdded = true;
            
            // 监听后端发送的预览图像
            app.api.addEventListener("photoshop_hsl_preview", ({ detail }) => {
                console.log("🎨 收到photoshop_hsl_preview原始事件:", detail);
                if (detail) {
                    const nodeId = detail.node_id;
                    const imageData = detail.image;
                    const maskData = detail.mask;
                    
                    console.log(`🎨 收到photoshop_hsl_preview事件 - 节点 ${nodeId}`, {
                        hasImage: !!imageData,
                        hasMask: !!maskData,
                        imageLength: imageData?.length || 0
                    });
                    
                    // 查找对应的节点
                    const node = app.graph.getNodeById(nodeId);
                    if (node && node.type === "PhotoshopHSLNode") {
                        // 存储图像数据到节点
                        node._previewImageUrl = imageData;
                        node._previewMaskUrl = maskData;
                        
                        console.log(`🎨 已存储预览图像到节点 ${nodeId}`);
                        
                        // 如果模态弹窗已打开，立即更新图像
                        if (node._hslModal && node._hslModal.isOpen) {
                            console.log("🎨 模态弹窗已打开，立即更新图像");
                            node._hslModal.setInputImage(imageData);
                            if (maskData) {
                                node._hslModal.setMaskData(maskData);
                            }
                        }
                    }
                }
            });
        } else {
            console.log("🎨 photoshop_hsl_preview监听器已存在，跳过添加");
        }
    } else {
        console.log("🎨 app.api不可用，无法设置photoshop_hsl_preview监听器");
    }
}

// 立即设置监听器
setupGlobalNodeOutputCache();
setupPhotoshopHSLPreviewListener();

// 延迟设置（确保API完全初始化）
setTimeout(() => {
    console.log("🎨 延迟重新设置全局节点输出缓存监听器...");
    setupGlobalNodeOutputCache();
    setupPhotoshopHSLPreviewListener();
}, 1000);

// 多次延迟设置确保可靠性
setTimeout(() => {
    console.log("🎨 再次延迟设置全局节点输出缓存监听器...");
    setupGlobalNodeOutputCache();
    setupPhotoshopHSLPreviewListener();
}, 3000);

// 定义HSL调整参数
const HSL_PARAMS = {
    hue: { min: -100, max: 100, default: 0 },
    saturation: { min: -100, max: 100, default: 0 },
    lightness: { min: -100, max: 100, default: 0 }
};

// Define presets
const HSL_PRESETS = {
    // User-defined preset system is now in place - built-in presets removed
};

// Define color channels - arranged in Red, Orange, Yellow, Green, Light Green, Blue, Purple, Magenta order
const COLOR_CHANNELS = [
    { id: "red", name: "Red", color: "#ff0000", degree: 0,
      // -100到+100对应色相调整范围：-100°到+100°
      // Red (0°) left -100 corresponds to Magenta (320°), right +100 corresponds to Yellow-Green (100°)
      hueGradient: "linear-gradient(to right, #ff00ff, #ff0080, #ff0040, #ff0000, #ff4000, #ff8000, #ffff00, #80ff00)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #ff0000)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #ff0000, #ffffff)" 
    },
    { id: "orange", name: "Orange", color: "#ff8000", degree: 30,
      // Orange (30°) left -100 corresponds to Purple-Red (290°), right +100 corresponds to Cyan (130°)
      hueGradient: "linear-gradient(to right, #ff00ff, #ff0080, #ff0000, #ff4000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #ff8000)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #ff8000, #ffffff)"
    },
    { id: "yellow", name: "Yellow", color: "#ffff00", degree: 60,
      // Yellow (60°) left -100 corresponds to Red (320°), right +100 corresponds to Blue (160°)
      hueGradient: "linear-gradient(to right, #ff0040, #ff0000, #ff4000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #ffff00)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #ffff00, #ffffff)"
    },
    { id: "green", name: "Green", color: "#00ff00", degree: 120,
      // Green (120°) left -100 corresponds to Orange (20°), right +100 corresponds to Blue-Purple (220°)
      hueGradient: "linear-gradient(to right, #ff6000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #00ff00)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #00ff00, #ffffff)"
    },
    { id: "cyan", name: "Cyan", color: "#00ffff", degree: 180,
      // Cyan (180°) left -100 corresponds to Yellow (80°), right +100 corresponds to Magenta (280°)
      hueGradient: "linear-gradient(to right, #e0ff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #4000ff, #8000ff)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #00ffff)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #00ffff, #ffffff)"
    },
    { id: "blue", name: "Blue", color: "#0000ff", degree: 240,
      // Blue (240°) left -100 corresponds to Green (140°), right +100 corresponds to Red (340°)
      hueGradient: "linear-gradient(to right, #00ff40, #00ff80, #00ffff, #0080ff, #0000ff, #4000ff, #8000ff, #ff00ff, #ff0080)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #0000ff)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #0000ff, #ffffff)"
    },
    { id: "purple", name: "Purple", color: "#8000ff", degree: 270,
      // Purple (270°) left -100 corresponds to Cyan (170°), right +100 corresponds to Orange (10°)
      hueGradient: "linear-gradient(to right, #00ffbf, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000, #ff4000)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #8000ff)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #8000ff, #ffffff)"
    },
    { id: "magenta", name: "Magenta", color: "#ff00ff", degree: 300,
      // Magenta (300°) left -100 corresponds to Blue (200°), right +100 corresponds to Yellow (40°)
      hueGradient: "linear-gradient(to right, #0080ff, #0000ff, #4000ff, #8000ff, #ff00ff, #ff0080, #ff0000, #ff4000, #ff8000)",
      // Saturation slider from gray to saturated color
      satGradient: "linear-gradient(to right, #808080, #ff00ff)",
      // Lightness slider from black to current color to white
      lightGradient: "linear-gradient(to right, #000000, #ff00ff, #ffffff)"
    }
];

app.registerExtension({
    name: "Comfy.PhotoshopHSLNode",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "PhotoshopHSLNode") {
            // 修改输入输出定义
            nodeType.inputs = [
                { name: "image", type: "IMAGE" }
            ];
            nodeType.outputs = [
                { name: "image", type: "IMAGE" }
            ];

            // 添加HSL参数
            nodeType.inputs.push({
                name: "hsl_params",
                type: "STRING",
                default: JSON.stringify({
                    red: { hue: 0, saturation: 0, lightness: 0 },
                    orange: { hue: 0, saturation: 0, lightness: 0 },
                    yellow: { hue: 0, saturation: 0, lightness: 0 },
                    green: { hue: 0, saturation: 0, lightness: 0 },
                    aqua: { hue: 0, saturation: 0, lightness: 0 },
                    blue: { hue: 0, saturation: 0, lightness: 0 },
                    purple: { hue: 0, saturation: 0, lightness: 0 },
                    magenta: { hue: 0, saturation: 0, lightness: 0 }
                })
            });
            
            // 添加遮罩相关参数
            nodeType.inputs.push({
                name: "mask",
                type: "MASK",
                optional: true
            });
            
            nodeType.inputs.push({
                name: "mask_blur",
                type: "FLOAT",
                default: 0.0,
                min: 0.0,
                max: 20.0,
                step: 0.1,
            });
            
            nodeType.inputs.push({
                name: "invert_mask",
                type: "BOOLEAN",
                default: false
            });

            // 添加双击事件处理
            const origOnDblClick = nodeType.prototype.onDblClick;
            nodeType.prototype.onDblClick = function(e, pos, graphCanvas) {
                console.log("HSL节点双击事件触发", this.id);
                
                // 调用原始的onDblClick方法
                if (origOnDblClick) {
                    origOnDblClick.apply(this, arguments);
                }
                
                // 阻止事件冒泡和默认行为
                e.stopPropagation();
                e.preventDefault();
                
                console.log("HSL节点准备显示模态弹窗");
                
                try {
                    // 创建模态弹窗
                    if (this.showHSLModal) {
                        console.log("调用showHSLModal方法");
                        this.showHSLModal();
                    } else {
                        console.error("showHSLModal方法不存在");
                    }
                } catch (error) {
                    console.error("显示HSL模态弹窗失败:", error);
                }
                
                return false; // 阻止事件继续传播
            };
            
            // 添加显示HSL模态弹窗的方法
            nodeType.prototype.showHSLModal = function() {
                console.log("显示HSL模态弹窗", this.id);
                
                // Create modal popup container
                const modal = document.createElement("div");
                modal.className = "hsl-modal";
                
                // 创建模态弹窗内容
                const modalContent = document.createElement("div");
                modalContent.className = "hsl-modal-content";
                
                // 创建模态弹窗头部
                const modalHeader = document.createElement("div");
                modalHeader.className = "hsl-modal-header";
                
                const modalTitle = document.createElement("h3");
                modalTitle.className = "hsl-modal-title";
                modalTitle.textContent = "🎨 Photoshop HSL Adjustment";
                
                // Button container
                const buttonContainer = document.createElement("div");
                buttonContainer.style.cssText = `
                    display: flex;
                    gap: 10px;
                    align-items: center;
                `;
                
                // Preset controls container
                const presetContainer = document.createElement("div");
                presetContainer.style.cssText = `
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    margin-right: 20px;
                `;
                
                // 预设下拉菜单
                const presetSelect = document.createElement('select');
                presetSelect.className = 'hsl-preset-select';
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
                this.loadHSLPresetList(presetSelect);
                
                // 预设选择事件
                presetSelect.addEventListener('change', (e) => {
                    if (e.target.value) {
                        this.loadHSLPreset(e.target.value, controlsContainer, updatePreviewImage);
                    }
                });
                
                // 保存预设按钮
                const savePresetBtn = document.createElement('button');
                savePresetBtn.className = 'hsl-modal-button secondary';
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
                savePresetBtn.onclick = () => this.saveHSLPreset(presetSelect);
                
                // 管理预设按钮
                const managePresetBtn = document.createElement('button');
                managePresetBtn.className = 'hsl-modal-button secondary';
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
                managePresetBtn.onclick = () => this.showHSLPresetManager(presetSelect);
                
                presetContainer.appendChild(presetSelect);
                presetContainer.appendChild(savePresetBtn);
                presetContainer.appendChild(managePresetBtn);
                
                // 重置按钮
                const resetBtn = document.createElement("button");
                resetBtn.className = "hsl-modal-button secondary";
                resetBtn.textContent = "Reset";
                resetBtn.onclick = () => {
                    this.resetAllParameters();
                    
                    // 直接重置所有输入框的值
                    const allRangeInputs = controlsContainer.querySelectorAll("input[type='range']");
                    const allValueInputs = controlsContainer.querySelectorAll(".hsl-value-input");
                    
                    allRangeInputs.forEach(input => {
                        input.value = 0;
                    });
                    
                    allValueInputs.forEach(input => {
                        input.value = 0;
                    });
                    
                    this.updateModalControls(controlsContainer);
                    updatePreviewImage();
                };
                
                // 应用按钮
                const applyBtn = document.createElement("button");
                applyBtn.className = "hsl-modal-button primary";
                applyBtn.textContent = "Apply";
                applyBtn.onclick = () => {
                    // 应用功能已自动生效，关闭弹窗即可
                    document.body.removeChild(modal);
                };
                
                // 关闭按钮
                const closeButton = document.createElement("button");
                closeButton.className = "hsl-modal-close";
                closeButton.textContent = "Close";
                closeButton.onclick = () => {
                    document.body.removeChild(modal);
                };
                
                buttonContainer.appendChild(presetContainer);
                buttonContainer.appendChild(resetBtn);
                buttonContainer.appendChild(applyBtn);
                buttonContainer.appendChild(closeButton);
                
                modalHeader.appendChild(modalTitle);
                modalHeader.appendChild(buttonContainer);
                
                // 创建模态弹窗主体 - 新的布局：左侧预览，右侧控制区
                const modalBody = document.createElement("div");
                modalBody.className = "hsl-modal-body";
                
                // 创建左侧预览区域
                const previewContainer = document.createElement("div");
                previewContainer.className = "hsl-preview-container";
                
                // 预览标题
                const previewTitle = document.createElement("h4");
                previewTitle.style.cssText = `
                    color: #ffffff;
                    margin: 0 0 15px 0;
                    font-size: 16px;
                    font-weight: 500;
                `;
                previewTitle.textContent = "Live Preview";
                previewContainer.appendChild(previewTitle);
                
                // Preview image container
                const imageContainer = document.createElement("div");
                imageContainer.style.cssText = `
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: #0a0a0a;
                    border-radius: 8px;
                    border: 2px solid #333333;
                    position: relative;
                    overflow: hidden;
                `;
                
                // 创建预览图像
                const previewImage = document.createElement("img");
                previewImage.className = "hsl-preview-image";
                previewImage.style.cssText = `
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    border-radius: 5px;
                `;
                previewImage.src = ""; // Image source will be set later
                previewImage.alt = "Preview";
                
                imageContainer.appendChild(previewImage);
                previewContainer.appendChild(imageContainer);
                modalBody.appendChild(previewContainer);
                
                // 创建右侧控制区域
                const controlsContainer = document.createElement("div");
                controlsContainer.className = "hsl-controls-container";
                
                // 添加预设按钮
                const presets = document.createElement("div");
                presets.className = "hsl-presets";
                presets.style.marginBottom = "20px";
                
                Object.keys(HSL_PRESETS).forEach(presetName => {
                    const presetButton = document.createElement("button");
                    presetButton.className = "hsl-preset";
                    presetButton.textContent = presetName;
                    presetButton.onclick = () => {
                        this.applyPreset(presetName, controlsContainer);
                        updatePreviewImage(); // 预设应用后更新预览
                    };
                    presets.appendChild(presetButton);
                });
                
                controlsContainer.appendChild(presets);
                
                // Create tabs container
                const tabsContainer = document.createElement("div");
                tabsContainer.className = "hsl-tabs-container";
                tabsContainer.style.cssText = `
                    margin-bottom: 20px;
                    border-bottom: 2px solid #333;
                    display: flex;
                    flex-wrap: wrap;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 8px 8px 0 0;
                    padding: 5px 5px 0 5px;
                `;
                
                // 创建内容容器
                const tabContentContainer = document.createElement("div");
                tabContentContainer.className = "hsl-tab-content-container";
                tabContentContainer.style.cssText = `
                    min-height: 300px;
                `;
                
                // 存储选项卡和内容
                const tabs = [];
                const tabContents = [];
                
                // 为每个颜色通道创建选项卡和内容
                COLOR_CHANNELS.forEach((channel, index) => {
                    // 创建选项卡按钮
                    const tab = document.createElement("button");
                    tab.className = "hsl-tab";
                    tab.dataset.channelColor = channel.color; // 保存通道颜色
                    tab.style.cssText = `
                        background: none;
                        border: none;
                        padding: 8px 12px;
                        color: ${channel.color}88; // 初始状态使用通道颜色的半透明版本
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 600;
                        transition: all 0.2s;
                        border-bottom: 3px solid transparent;
                        margin: 0 2px;
                        margin-bottom: -3px;
                        text-shadow: 0 0 2px rgba(0,0,0,0.8);
                        border-radius: 6px 6px 0 0;
                    `;
                    tab.textContent = channel.name;
                    tab.onclick = () => selectTab(index);
                    
                    // 添加hover效果
                    tab.onmouseenter = () => {
                        if (!tab.classList.contains('active')) { // 不是当前选中的选项卡
                            tab.style.color = channel.color + 'CC'; // 更亮的颜色
                            tab.style.backgroundColor = channel.color + '1A'; // 淡淡的背景色
                        }
                    };
                    tab.onmouseleave = () => {
                        if (!tab.classList.contains('active')) { // 不是当前选中的选项卡
                            tab.style.color = channel.color + '88';
                            tab.style.backgroundColor = 'transparent';
                        }
                    };
                    
                    tabs.push(tab);
                    tabsContainer.appendChild(tab);
                    
                    // 创建选项卡内容
                    const channelSection = document.createElement("div");
                    channelSection.className = `hsl-channel-section ${channel.id}`;
                    channelSection.style.cssText = `
                        display: none;
                        padding: 20px 0;
                        margin: 0 10px;
                    `;
                    tabContents.push(channelSection);
                    
                    // 创建色相控制
                    const hueControl = this.createSliderControl(
                        "Hue", 
                        HSL_PARAMS.hue.min, 
                        HSL_PARAMS.hue.max,
                        0, // 默认值，后面会从节点参数中更新
                        channel.hueGradient,
                        (value) => {
                            this.updateChannelParam(channel.id, "hue", parseInt(value));
                            updatePreviewImage(); // 参数变化时更新预览
                        }
                    );
                    // 设置滑块的初始位置在中间（对应0值）
                    const hueSlider = hueControl.querySelector("input");
                    if (hueSlider) {
                        hueSlider.style.backgroundSize = "100% 100%";
                    }
                    channelSection.appendChild(hueControl);
                    
                    // 创建饱和度控制
                    const saturationControl = this.createSliderControl(
                        "Saturation", 
                        HSL_PARAMS.saturation.min, 
                        HSL_PARAMS.saturation.max,
                        0, // 默认值，后面会从节点参数中更新
                        channel.satGradient,
                        (value) => {
                            this.updateChannelParam(channel.id, "saturation", parseInt(value));
                            updatePreviewImage(); // 参数变化时更新预览
                        }
                    );
                    // 设置滑块的初始位置在中间（对应0值）
                    const satSlider = saturationControl.querySelector("input");
                    if (satSlider) {
                        satSlider.style.backgroundSize = "100% 100%";
                    }
                    channelSection.appendChild(saturationControl);
                    
                    // Create lightness control
                    const lightnessControl = this.createSliderControl(
                        "Lightness", 
                        HSL_PARAMS.lightness.min, 
                        HSL_PARAMS.lightness.max,
                        0, // 默认值，后面会从节点参数中更新
                        channel.lightGradient, // Use channel-specific lightness gradient
                        (value) => {
                            this.updateChannelParam(channel.id, "lightness", parseInt(value));
                            updatePreviewImage(); // 参数变化时更新预览
                        }
                    );
                    // 设置滑块的初始位置在中间（对应0值）
                    const lightSlider = lightnessControl.querySelector("input");
                    if (lightSlider) {
                        lightSlider.style.backgroundSize = "100% 100%";
                    }
                    channelSection.appendChild(lightnessControl);
                    
                    // 将内容添加到内容容器
                    tabContentContainer.appendChild(channelSection);
                });
                
                // 选项卡切换函数
                const selectTab = (index) => {
                    // 更新选项卡样式
                    tabs.forEach((tab, i) => {
                        const channelColor = tab.dataset.channelColor;
                        if (i === index) {
                            tab.classList.add('active');
                            tab.style.color = channelColor; // 使用完全不透明的通道颜色
                            tab.style.borderBottomColor = channelColor;
                            tab.style.backgroundColor = channelColor + '1A'; // 淡淡的背景色
                            tab.style.textShadow = `0 0 5px ${channelColor}66`; // 发光效果
                        } else {
                            tab.classList.remove('active');
                            tab.style.color = channelColor + '88'; // 半透明的通道颜色
                            tab.style.borderBottomColor = 'transparent';
                            tab.style.backgroundColor = 'transparent';
                            tab.style.textShadow = '0 0 2px rgba(0,0,0,0.5)';
                        }
                    });
                    
                    // 显示对应内容
                    tabContents.forEach((content, i) => {
                        content.style.display = i === index ? 'block' : 'none';
                    });
                };
                
                // 添加选项卡和内容到控制容器
                controlsContainer.appendChild(tabsContainer);
                controlsContainer.appendChild(tabContentContainer);
                
                // 默认选中第一个选项卡
                selectTab(0);
                
                // 着色模式已移除
                modalBody.appendChild(controlsContainer);
                
                // 组装模态弹窗
                modalContent.appendChild(modalHeader);
                modalContent.appendChild(modalBody);
                modal.appendChild(modalContent);
                
                // 添加到文档
                document.body.appendChild(modal);
                
                // 从节点参数中更新控件值
                this.updateModalControls(controlsContainer);
                
                // 获取输入图像并设置预览
                let inputImage = null;
                
                // 使用与PS Curve节点相同的图像获取方法
                const getInputImageFromNode = async () => {
                    try {
                        console.log("🎨 HSL节点开始获取图像，节点ID:", this.id);
                        
                        let imageUrl = "";
                        let maskUrl = null;
                        
                        // 最高优先级：使用后端发送的预览图像
                        if (this._previewImageUrl && typeof this._previewImageUrl === 'string') {
                            imageUrl = this._previewImageUrl;
                            console.log("🎨 使用后端发送的预览图像:", imageUrl.substring(0, 50) + '...');
                        }
                        // 方法0: 从我们的自定义属性获取
                        if (this._curveNodeImageUrls && this._curveNodeImageUrls.length > 0) {
                            imageUrl = this._curveNodeImageUrls[0];
                            console.log("🎨 方法0: 从自定义属性获取图像:", imageUrl.substring(0, 50) + '...');
                        }
                        // 方法0.1: 从原有的imgs属性获取
                        else if (this.imgs && this.imgs.length > 0) {
                            imageUrl = this.imgs[0].src;
                            console.log("🎨 方法0.1: 从imgs属性获取图像:", imageUrl.substring(0, 50) + '...');
                        }
                        // 方法0.5: 从ComfyUI的UI系统获取
                        else if (app.nodeOutputs && app.nodeOutputs[this.id] && app.nodeOutputs[this.id].images) {
                            const nodeOutput = app.nodeOutputs[this.id];
                            const convertToImageUrl = (imageData) => {
                                if (typeof imageData === 'string') return imageData;
                                if (imageData && typeof imageData === 'object' && imageData.filename) {
                                    const baseUrl = window.location.origin;
                                    return `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}&type=${imageData.type || 'output'}&subfolder=${imageData.subfolder || ''}`;
                                }
                                return imageData;
                            };
                            imageUrl = convertToImageUrl(nodeOutput.images[0]);
                            console.log("🎨 方法0.5: 从app.nodeOutputs获取图像:", imageUrl.substring(0, 50) + '...');
                        }
                        // 方法1: 从全局缓存获取（适用于所有处理节点）
                        else if (window.globalNodeCache && window.globalNodeCache.has(String(this.id))) {
                            const cachedData = window.globalNodeCache.get(String(this.id));
                            const convertToImageUrl = (imageData) => {
                                if (typeof imageData === 'string') return imageData;
                                if (imageData && typeof imageData === 'object' && imageData.filename) {
                                    const baseUrl = window.location.origin;
                                    return `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}&type=${imageData.type || 'output'}&subfolder=${imageData.subfolder || ''}`;
                                }
                                return imageData;
                            };
                            imageUrl = convertToImageUrl(cachedData.images[0]);
                            console.log("🎨 方法1: 从全局缓存获取图像:", imageUrl.substring(0, 50) + '...');
                        }
                        // 方法2: 从缓存的输入图像获取（当前节点的缓存）
                        else if (this._lastInputImage) {
                            imageUrl = this._lastInputImage;
                            console.log("🎨 方法2: 从缓存输入图像获取:", imageUrl.substring(0, 50) + '...');
                        }
                        // 方法3: 尝试从连接的源节点获取
                        else if (this.inputs && this.inputs[0] && this.inputs[0].link) {
                            const linkInfo = app.graph.links[this.inputs[0].link];
                            if (linkInfo) {
                                const sourceNodeId = String(linkInfo.origin_id);
                                const sourceNode = app.graph.getNodeById(linkInfo.origin_id);
                                
                                console.log("🎨 方法3: 查找源节点图像，节点ID:", sourceNodeId, "节点类型:", sourceNode?.type);
                                console.log("🎨 调试 - 全局缓存状态:", {
                                    hasGlobalCache: !!window.globalNodeCache,
                                    cacheKeys: window.globalNodeCache ? Array.from(window.globalNodeCache.keys()) : [],
                                    hasSourceNodeId: window.globalNodeCache ? window.globalNodeCache.has(sourceNodeId) : false
                                });
                                console.log("🎨 调试 - 源节点状态:", {
                                    hasSourceNode: !!sourceNode,
                                    hasImgs: sourceNode?.imgs?.length || 0,
                                    nodeType: sourceNode?.type
                                });
                                console.log("🎨 调试 - app.nodeOutputs状态:", {
                                    hasNodeOutputs: !!app.nodeOutputs,
                                    outputKeys: app.nodeOutputs ? Object.keys(app.nodeOutputs) : [],
                                    hasSourceOutput: app.nodeOutputs ? !!app.nodeOutputs[sourceNodeId] : false
                                });
                                
                                // 首先从全局缓存获取源节点数据
                                if (window.globalNodeCache && window.globalNodeCache.has(sourceNodeId)) {
                                    const sourceCache = window.globalNodeCache.get(sourceNodeId);
                                    console.log("🎨 方法3a: 源节点缓存数据:", sourceCache);
                                    if (sourceCache.images && sourceCache.images.length > 0) {
                                        const convertToImageUrl = (imageData) => {
                                            if (typeof imageData === 'string') return imageData;
                                            if (imageData && typeof imageData === 'object' && imageData.filename) {
                                                const baseUrl = window.location.origin;
                                                return `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}&type=${imageData.type || 'output'}&subfolder=${imageData.subfolder || ''}`;
                                            }
                                            return imageData;
                                        };
                                        imageUrl = convertToImageUrl(sourceCache.images[0]);
                                        console.log("🎨 方法3a: 从源节点全局缓存获取图像:", imageUrl.substring(0, 50) + '...');
                                    }
                                }
                                // 从源节点的imgs属性获取
                                else if (sourceNode && sourceNode.imgs && sourceNode.imgs.length > 0) {
                                    imageUrl = sourceNode.imgs[0].src;
                                    console.log("🎨 方法3b: 从源节点imgs获取图像:", imageUrl.substring(0, 50) + '...');
                                }
                                // 从app.nodeOutputs获取源节点数据
                                else if (app.nodeOutputs && app.nodeOutputs[sourceNodeId]) {
                                    const sourceOutput = app.nodeOutputs[sourceNodeId];
                                    console.log("🎨 方法3c: 源节点输出数据:", sourceOutput);
                                    if (sourceOutput.images && sourceOutput.images.length > 0) {
                                        const convertToImageUrl = (imageData) => {
                                            if (typeof imageData === 'string') return imageData;
                                            if (imageData && typeof imageData === 'object' && imageData.filename) {
                                                const baseUrl = window.location.origin;
                                                return `${baseUrl}/view?filename=${encodeURIComponent(imageData.filename)}&type=${imageData.type || 'output'}&subfolder=${imageData.subfolder || ''}`;
                                            }
                                            return imageData;
                                        };
                                        imageUrl = convertToImageUrl(sourceOutput.images[0]);
                                        console.log("🎨 方法3c: 从源节点nodeOutputs获取图像:", imageUrl.substring(0, 50) + '...');
                                    }
                                }
                            }
                        }
                        
                        // 获取遮罩（如果有）
                        // 优先使用后端发送的预览遮罩
                        if (this._previewMaskUrl && typeof this._previewMaskUrl === 'string') {
                            maskUrl = this._previewMaskUrl;
                            console.log("🎨 使用后端发送的预览遮罩:", maskUrl.substring(0, 50) + '...');
                        }
                        // 其次使用缓存的遮罩
                        else if (this._lastInputMask) {
                            maskUrl = this._lastInputMask;
                            console.log("🎨 找到缓存的遮罩:", maskUrl.substring(0, 50) + '...');
                        } else if (this.inputs && this.inputs[2] && this.inputs[2].link) {
                            // 从遮罩输入获取
                            const maskLinkInfo = app.graph.links[this.inputs[2].link];
                            if (maskLinkInfo) {
                                const maskSourceNode = app.graph.getNodeById(maskLinkInfo.origin_id);
                                if (maskSourceNode && maskSourceNode.imgs && maskSourceNode.imgs.length > 0) {
                                    maskUrl = maskSourceNode.imgs[0].src;
                                    console.log("🎨 从遮罩源节点获取遮罩:", maskUrl.substring(0, 50) + '...');
                                }
                            }
                        }
                        
                        if (!imageUrl) {
                            console.log("🎨 所有方法都无法获取图像");
                            
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
                                    <text x="250" y="320" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dy=".3em">to generate images before HSL editing</text>
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
                        }
                        
                        return { imageUrl, maskUrl };
                    } catch (error) {
                        console.error("🎨 获取输入图像时出错:", error);
                        return null;
                    }
                };
                
                // 预览图像更新函数
                const updatePreviewImage = async () => {
                    // 只在第一次获取输入图像
                    if (!inputImage) {
                        inputImage = await getInputImageFromNode();
                    }
                    
                    if (!inputImage || !inputImage.imageUrl) {
                        console.log("🎨 无法获取输入图像进行预览");
                        return;
                    }
                    
                    // 设置预览图像
                    const previewImg = document.querySelector('.hsl-preview-image');
                    if (!previewImg) {
                        console.error("🎨 找不到预览图像元素");
                        return;
                    }
                    
                    // 创建离屏Canvas进行图像处理
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 创建临时图像对象
                    const tempImage = new Image();
                    tempImage.crossOrigin = "Anonymous";
                    
                    // 等待图像加载完成后处理
                    tempImage.onload = () => {
                        // 设置canvas尺寸
                        canvas.width = tempImage.width;
                        canvas.height = tempImage.height;
                        
                        // 绘制原始图像
                        ctx.drawImage(tempImage, 0, 0);
                        
                        // 获取图像数据
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const data = imageData.data;
                        
                        // 获取当前的HSL参数
                        const params = {
                            red: {
                                hue: this.widgets.find(w => w.name === "red_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "red_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "red_lightness")?.value || 0
                            },
                            orange: {
                                hue: this.widgets.find(w => w.name === "orange_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "orange_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "orange_lightness")?.value || 0
                            },
                            yellow: {
                                hue: this.widgets.find(w => w.name === "yellow_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "yellow_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "yellow_lightness")?.value || 0
                            },
                            green: {
                                hue: this.widgets.find(w => w.name === "green_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "green_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "green_lightness")?.value || 0
                            },
                            aqua: {
                                hue: this.widgets.find(w => w.name === "cyan_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "cyan_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "cyan_lightness")?.value || 0
                            },
                            blue: {
                                hue: this.widgets.find(w => w.name === "blue_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "blue_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "blue_lightness")?.value || 0
                            },
                            purple: {
                                hue: this.widgets.find(w => w.name === "purple_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "purple_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "purple_lightness")?.value || 0
                            },
                            magenta: {
                                hue: this.widgets.find(w => w.name === "magenta_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "magenta_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "magenta_lightness")?.value || 0
                            }
                        };
                        
                        // 处理遮罩（如果有）
                        let maskImageData = null;
                        let maskData = null;
                        
                        if (inputImage.maskUrl) {
                            console.log("🎨 处理遮罩图像:", inputImage.maskUrl.substring(0, 50) + '...');
                            
                            // 创建遮罩图像
                            const maskCanvas = document.createElement('canvas');
                            const maskCtx = maskCanvas.getContext('2d');
                            const maskImage = new Image();
                            maskImage.crossOrigin = "Anonymous";
                            
                            maskImage.onload = () => {
                                // 设置遮罩canvas尺寸
                                maskCanvas.width = canvas.width;
                                maskCanvas.height = canvas.height;
                                
                                // 绘制遮罩（缩放到与主图像相同尺寸）
                                maskCtx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
                                
                                // 获取遮罩数据
                                maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
                                maskData = maskImageData.data;
                                
                                console.log("🎨 遮罩数据已准备完成");
                                
                                // 重新应用HSL调整（现在有遮罩数据）
                                applyHSLWithMask();
                            };
                            
                            maskImage.src = inputImage.maskUrl;
                        } else {
                            // 没有遮罩，直接应用HSL调整
                            applyHSLWithMask();
                        }
                        
                        function applyHSLWithMask() {
                            // 应用HSV调整 - 匹配后端OpenCV实现
                            for (let i = 0; i < data.length; i += 4) {
                                const r = data[i] / 255.0;
                                const g = data[i + 1] / 255.0;
                                const b = data[i + 2] / 255.0;
                                
                                // 转换为HSV（匹配OpenCV）
                                const hsv = rgbToOpenCVHSV(r, g, b);
                                
                                // 应用调整到所有相关颜色范围
                                let adjustedHSV = [...hsv];
                                
                                // 基于OpenCV HSV真实分布的精确颜色范围定义
                                // OpenCV HSV: 0°=Red, 30°=Yellow, 60°=Green, 90°=Cyan, 120°=Blue, 150°=Magenta
                                const colorRanges = {
                                    red: [[0, 10], [170, 179]],      // Red: around 0 degrees (calibrated)
                                    orange: [[10, 25]],              // Orange: around 15 degrees (between red-yellow)
                                    yellow: [[25, 45]],              // Yellow: around 30 degrees ±15 degrees
                                    green: [[45, 85]],               // Green: around 60 degrees ±25 degrees **corrected**
                                    cyan: [[85, 105]],               // Cyan: around 90 degrees ±15 degrees **corrected**
                                    blue: [[105, 135]],              // Blue: around 120 degrees ±15 degrees **corrected**
                                    purple: [[135, 155]],            // Purple: 135-155 degrees **corrected**
                                    magenta: [[155, 170]]            // Magenta: 155-170 degrees **corrected**
                                };
                                
                                Object.keys(colorRanges).forEach(colorName => {
                                    const ranges = colorRanges[colorName];
                                    const colorParams = params[colorName === 'cyan' ? 'aqua' : colorName];
                                    
                                    if (!colorParams || (colorParams.hue === 0 && colorParams.saturation === 0 && colorParams.lightness === 0)) {
                                        return;
                                    }
                                    
                                    // Saturation threshold filtering (matches backend implementation)
                                    const SATURATION_THRESHOLD = 15;
                                    if (adjustedHSV[1] < SATURATION_THRESHOLD) {
                                        return; // 跳过低饱和度像素
                                    }
                                    
                                    // 检查像素是否在当前颜色范围内
                                    let inRange = false;
                                    for (const range of ranges) {
                                        const [minH, maxH] = range;
                                        if (adjustedHSV[0] >= minH && adjustedHSV[0] <= maxH) {
                                            inRange = true;
                                            break;
                                        }
                                    }
                                    
                                    if (inRange) {
                                        // 应用调整（修复为匹配PS和后端算法）
                                        if (colorParams.hue !== 0) {
                                            // 匹配后端的线性映射：-100到+100映射到-60到+60度
                                            function getPreciseHueMapping(inputDegrees) {
                                                // 直接线性映射：-100到+100 映射到 -60到+60
                                                // 与后端nodes/photoshop/hsl.py完全一致
                                                return inputDegrees * 0.6;
                                            }
                                            
                                            const hueAdjustment = getPreciseHueMapping(colorParams.hue);
                                            
                                            // 匹配后端的色相计算逻辑
                                            // 先转换当前色相到360度范围，进行调整，再转回OpenCV范围
                                            const currentHue360 = adjustedHSV[0] * 2;  // 转换到360度范围
                                            let adjustedHue360 = currentHue360 + hueAdjustment;  // 应用调整
                                            
                                            // 环绕处理：确保在0-360范围内（使用模运算）
                                            adjustedHue360 = adjustedHue360 % 360;
                                            if (adjustedHue360 < 0) {
                                                adjustedHue360 += 360;
                                            }
                                            
                                            const newHue = adjustedHue360 / 2;  // 转回OpenCV范围(0-179)
                                            
                                            adjustedHSV[0] = newHue;
                                        }
                                        if (colorParams.saturation !== 0) {
                                            // 修复：使用PS风格的饱和度调整
                                            const satFactor = calculatePSSaturationFactor(colorParams.saturation);
                                            adjustedHSV[1] = Math.max(0, Math.min(255, adjustedHSV[1] * satFactor));
                                        }
                                        if (colorParams.lightness !== 0) {
                                            // Fix: Use PS-style lightness adjustment
                                            adjustedHSV[2] = applyPSLightnessAdjustment(adjustedHSV[2], colorParams.lightness);
                                        }
                                    }
                                });
                                
                                // 转换回RGB
                                const rgb = openCVHSVToRGB(adjustedHSV[0], adjustedHSV[1], adjustedHSV[2]);
                                
                                // 计算遮罩因子
                                let maskFactor = 1.0;
                                if (maskData) {
                                    const maskLuminance = maskData[i] / 255.0;
                                    maskFactor = maskLuminance;
                                }
                                
                                // 应用遮罩混合（原图与处理后图像）
                                data[i] = Math.round((r * 255 * (1 - maskFactor) + rgb[0] * 255 * maskFactor));
                                data[i + 1] = Math.round((g * 255 * (1 - maskFactor) + rgb[1] * 255 * maskFactor));
                                data[i + 2] = Math.round((b * 255 * (1 - maskFactor) + rgb[2] * 255 * maskFactor));
                            }
                            
                            // 更新图像数据
                            ctx.putImageData(imageData, 0, 0);
                            
                            // 显示处理后的图像
                            previewImg.src = canvas.toDataURL();
                            previewImg.style.display = 'block';
                        }
                    };
                    
                    // 加载图像
                    tempImage.src = inputImage.imageUrl;
                    
                    // 辅助函数：RGB转HSL
                    function rgbToHsl(r, g, b) {
                        r /= 255;
                        g /= 255;
                        b /= 255;
                        
                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        let h, s, l = (max + min) / 2;
                        
                        if (max === min) {
                            h = s = 0; // 灰色
                        } else {
                            const d = max - min;
                            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                            
                            switch (max) {
                                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                case g: h = (b - r) / d + 2; break;
                                case b: h = (r - g) / d + 4; break;
                            }
                            
                            h /= 6;
                        }
                        
                        return [h, s, l];
                    }
                    
                    // 辅助函数：HSL转RGB
                    function hslToRgb(h, s, l) {
                        let r, g, b;
                        
                        if (s === 0) {
                            r = g = b = l; // 灰色
                        } else {
                            const hue2rgb = (p, q, t) => {
                                if (t < 0) t += 1;
                                if (t > 1) t -= 1;
                                if (t < 1/6) return p + (q - p) * 6 * t;
                                if (t < 1/2) return q;
                                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                                return p;
                            };
                            
                            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                            const p = 2 * l - q;
                            
                            r = hue2rgb(p, q, h + 1/3);
                            g = hue2rgb(p, q, h);
                            b = hue2rgb(p, q, h - 1/3);
                        }
                        
                        return [
                            Math.round(r * 255),
                            Math.round(g * 255),
                            Math.round(b * 255)
                        ];
                    }
                    
                    // 辅助函数：确定颜色通道
                    function getColorChannel(hue) {
                        // 基于12色环标准定义，每个基本色相占30度
                        const hueDegree = hue * 360;
                        
                        if (hueDegree >= 345 || hueDegree < 15) return 'red';       // Red 345-15 degrees (±15 degrees)
                        if (hueDegree >= 15 && hueDegree < 75) return 'orange';     // Orange 15-75 degrees (includes red-orange, orange, orange-yellow)
                        if (hueDegree >= 75 && hueDegree < 135) return 'yellow';    // Yellow 75-135 degrees (includes orange-yellow, yellow, yellow-green)
                        if (hueDegree >= 135 && hueDegree < 195) return 'green';    // Green 135-195 degrees (includes yellow-green, green, blue-green)
                        if (hueDegree >= 195 && hueDegree < 225) return 'aqua';     // Cyan 195-225 degrees (blue-green)
                        if (hueDegree >= 225 && hueDegree < 285) return 'blue';     // Blue 225-285 degrees (includes blue-green, blue, blue-purple)
                        if (hueDegree >= 285 && hueDegree < 315) return 'purple';   // Purple 285-315 degrees (purple)
                        if (hueDegree >= 315 && hueDegree < 345) return 'magenta';  // Magenta 315-345 degrees (purple-red)
                        return null;
                    }
                };
                
                // 初始化预览图像
                updatePreviewImage();
            };
            
            // 添加创建滑块控件的辅助方法
            nodeType.prototype.createSliderControl = function(label, min, max, value, background, onChange) {
                const control = document.createElement("div");
                control.className = "hsl-control";
                
                // 创建左侧标签
                const labelDiv = document.createElement("div");
                labelDiv.className = "hsl-label";
                
                const labelSpan = document.createElement("span");
                labelSpan.textContent = label;
                
                labelDiv.appendChild(labelSpan);
                
                // 创建滑块
                const input = document.createElement("input");
                input.type = "range";
                input.min = min;
                input.max = max;
                input.value = value;
                input.style.background = background;
                
                // 确保滑块在中间位置显示正确
                if (min === -100 && max === 100) {
                    input.style.backgroundPosition = "center";
                }
                
                // 创建数值输入框（替代span）
                const valueInput = document.createElement("input");
                valueInput.type = "number";
                valueInput.className = "hsl-value-input";
                valueInput.value = value;
                valueInput.min = min;
                valueInput.max = max;
                valueInput.style.cssText = `
                    width: 60px;
                    background: #1a1a1a;
                    border: 1px solid #444;
                    color: #fff;
                    padding: 4px 6px;
                    font-size: 12px;
                    text-align: center;
                    border-radius: 3px;
                    margin-left: 15px;
                `;
                
                // 滑块变化时更新输入框
                input.oninput = () => {
                    valueInput.value = input.value;
                    if (onChange) {
                        onChange(input.value);
                    }
                };
                
                // 输入框变化时更新滑块
                valueInput.oninput = () => {
                    let val = parseInt(valueInput.value);
                    if (isNaN(val)) val = 0;
                    val = Math.max(min, Math.min(max, val)); // 限制在范围内
                    valueInput.value = val;
                    input.value = val;
                    if (onChange) {
                        onChange(val);
                    }
                };
                
                // 处理Enter键
                valueInput.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        valueInput.blur();
                    }
                };
                
                // 将元素添加到控件中
                control.appendChild(labelDiv);
                control.appendChild(input);
                control.appendChild(valueInput);
                
                return control;
            };
            
            // 添加更新通道参数的辅助方法
            nodeType.prototype.updateChannelParam = function(channelId, param, value) {
                // 查找对应的widget
                const widgetName = `${channelId}_${param}`;
                const widget = this.widgets.find(w => w.name === widgetName);
                
                if (widget) {
                    widget.value = value;
                }
            };
            
            // 添加从节点参数更新模态控件的辅助方法
            nodeType.prototype.updateModalControls = function(controlsContainer) {
                // 更新各通道控件
                COLOR_CHANNELS.forEach(channel => {
                    const channelSection = controlsContainer.querySelector(`.hsl-channel-section.${channel.id}`);
                    if (channelSection) {
                        const hueWidget = this.widgets.find(w => w.name === `${channel.id}_hue`);
                        const saturationWidget = this.widgets.find(w => w.name === `${channel.id}_saturation`);
                        const lightnessWidget = this.widgets.find(w => w.name === `${channel.id}_lightness`);
                        
                        const hueControl = channelSection.querySelector(".hsl-control:nth-child(1)");
                        const saturationControl = channelSection.querySelector(".hsl-control:nth-child(2)");
                        const lightnessControl = channelSection.querySelector(".hsl-control:nth-child(3)");
                        
                        if (hueWidget && hueControl) {
                            const rangeInput = hueControl.querySelector("input[type='range']");
                            const valueInput = hueControl.querySelector(".hsl-value-input");
                            if (rangeInput) {
                                rangeInput.value = hueWidget.value;
                            }
                            if (valueInput) {
                                valueInput.value = hueWidget.value;
                            }
                        }
                        
                        if (saturationWidget && saturationControl) {
                            const rangeInput = saturationControl.querySelector("input[type='range']");
                            const valueInput = saturationControl.querySelector(".hsl-value-input");
                            if (rangeInput) {
                                rangeInput.value = saturationWidget.value;
                            }
                            if (valueInput) {
                                valueInput.value = saturationWidget.value;
                            }
                        }
                        
                        if (lightnessWidget && lightnessControl) {
                            const rangeInput = lightnessControl.querySelector("input[type='range']");
                            const valueInput = lightnessControl.querySelector(".hsl-value-input");
                            if (rangeInput) {
                                rangeInput.value = lightnessWidget.value;
                            }
                            if (valueInput) {
                                valueInput.value = lightnessWidget.value;
                            }
                        }
                    }
                });
                
                // 着色模式已移除
            };
            
            // 添加重置所有参数的方法
            nodeType.prototype.resetAllParameters = function() {
                console.log("重置所有HSL参数到默认值");
                
                // 重置所有颜色通道的参数
                COLOR_CHANNELS.forEach(channel => {
                    const hueWidget = this.widgets.find(w => w.name === `${channel.id}_hue`);
                    const saturationWidget = this.widgets.find(w => w.name === `${channel.id}_saturation`);
                    const lightnessWidget = this.widgets.find(w => w.name === `${channel.id}_lightness`);
                    
                    if (hueWidget) hueWidget.value = 0;
                    if (saturationWidget) saturationWidget.value = 0;
                    if (lightnessWidget) lightnessWidget.value = 0;
                });
                
                // 着色模式已移除
                
                // 通知画布更新
                this.graph.setDirtyCanvas(true);
            };
            
            // 添加应用预设的辅助方法
            nodeType.prototype.applyPreset = function(presetName, modalBody) {
                const preset = HSL_PRESETS[presetName];
                if (preset) {
                    // Master通道和着色模式已移除
                    
                    // 更新模态控件值
                    this.updateModalControls(modalBody);
                    
                    // 通知画布更新
                    this.graph.setDirtyCanvas(true);
                }
            };
            
            // HSL预设管理功能
            nodeType.prototype.loadHSLPresetList = async function(selectElement) {
                try {
                    const response = await fetch('/hsl_presets/list');
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
                    console.error('加载HSL预设列表失败:', error);
                }
            };
            
            nodeType.prototype.getCategoryLabel = function(category) {
                const labels = {
                    'default': 'Default Presets',
                    'cinematic': 'Cinematic Style',
                    'portrait': 'Portrait',
                    'landscape': 'Landscape',
                    'custom': 'Custom'
                };
                return labels[category] || category;
            };
            
            nodeType.prototype.loadHSLPreset = async function(presetId, controlsContainer, updatePreviewImage) {
                try {
                    const response = await fetch(`/hsl_presets/load/${presetId}`);
                    const data = await response.json();
                    
                    if (data.success && data.preset) {
                        const preset = data.preset;
                        const parameters = preset.parameters;
                        
                        // 应用预设参数到节点widgets
                        Object.entries(parameters).forEach(([paramName, value]) => {
                            const widget = this.widgets.find(w => w.name === paramName);
                            if (widget) {
                                widget.value = value;
                            }
                        });
                        
                        // 更新模态控件
                        this.updateModalControls(controlsContainer);
                        
                        // 更新预览
                        if (updatePreviewImage) {
                            updatePreviewImage();
                        }
                        
                        // 通知画布更新
                        this.graph.setDirtyCanvas(true);
                        
                        console.log('HSL预设加载成功:', preset.name);
                    }
                } catch (error) {
                    console.error('加载HSL预设失败:', error);
                    alert('Failed to load preset: ' + error.message);
                }
            };
            
            nodeType.prototype.saveHSLPreset = async function(presetSelect) {
                const name = prompt('Please enter preset name:');
                if (!name) return;
                
                const description = prompt('Please enter preset description (optional):') || '';
                
                try {
                    // 收集当前所有HSL参数
                    const parameters = {};
                    
                    // 收集所有颜色通道的参数
                    const channels = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'];
                    const params = ['hue', 'saturation', 'lightness'];
                    
                    channels.forEach(channel => {
                        params.forEach(param => {
                            const widgetName = `${channel}_${param}`;
                            const widget = this.widgets.find(w => w.name === widgetName);
                            if (widget) {
                                parameters[widgetName] = widget.value;
                            }
                        });
                    });
                    
                    const presetData = {
                        name: name,
                        description: description,
                        category: 'custom',
                        parameters: parameters,
                        tags: ['hsl', 'custom']
                    };
                    
                    const response = await fetch('/hsl_presets/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(presetData)
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('Preset saved successfully!');
                        // 重新加载预设列表
                        this.loadHSLPresetList(presetSelect);
                    } else {
                        alert('Failed to save preset: ' + result.error);
                    }
                } catch (error) {
                    console.error('Failed to save HSL preset:', error);
                    alert('Failed to save preset: ' + error.message);
                }
            };
            
            nodeType.prototype.showHSLPresetManager = async function(presetSelect) {
                try {
                    // 获取预设列表
                    const response = await fetch('/hsl_presets/list');
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
                        z-index: 10000;
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
                    title.textContent = 'HSL Preset Manager';
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
                                        const delResponse = await fetch(`/hsl_presets/delete/${preset.id}`, {
                                            method: 'DELETE'
                                        });
                                        const delResult = await delResponse.json();
                                        
                                        if (delResult.success) {
                                            presetItem.remove();
                                            this.loadHSLPresetList(presetSelect);
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
                                const expResponse = await fetch(`/hsl_presets/export/${preset.id}`);
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
                            
                            const impResponse = await fetch('/hsl_presets/import', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ preset_data: presetData })
                            });
                            
                            const impResult = await impResponse.json();
                            
                            if (impResult.success) {
                                alert('Preset imported successfully!');
                                document.body.removeChild(managerModal);
                                this.loadHSLPresetList(presetSelect);
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
                    console.error('Failed to show HSL preset manager:', error);
                    alert('Failed to show preset manager: ' + error.message);
                }
            };
            
            // 添加自定义UI
            const onNodeCreated = nodeType.onNodeCreated;
            nodeType.onNodeCreated = function () {
                const result = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                // 确保showHSLModal方法直接添加到节点实例上
                if (!this.showHSLModal) {
                    this.showHSLModal = nodeType.prototype.showHSLModal;
                    console.log("已将showHSLModal方法添加到节点实例", this.id);
                }
                
                // 创建HSL控制面板
                const hslPanel = $el("div", {
                    className: "photoshop-hsl-panel"
                }, [
                    // 预设按钮
                    $el("div", {
                        className: "hsl-presets"
                    }, Object.keys(HSL_PRESETS).map(presetName => 
                        $el("button", {
                            className: "hsl-preset",
                            textContent: presetName
                        })
                    )),
                    // 颜色通道选择
                    $el("div", {
                        className: "color-channels"
                    }, COLOR_CHANNELS.map(channel => 
                        $el("button", {
                            className: channel.id === "master" ? "color-channel active" : "color-channel",
                            textContent: channel.name,
                            dataset: { channelId: channel.id }
                        })
                    )),
                    // 色相控制
                    $el("div", {
                        className: "hsl-control"
                    }, [
                        $el("div", {
                            className: "hsl-label"
                        }, [
                            $el("span", { textContent: "Hue" })
                        ]),
                        $el("input", {
                            type: "range",
                            min: HSL_PARAMS.hue.min,
                            max: HSL_PARAMS.hue.max,
                            value: HSL_PARAMS.hue.default,
                            style: {
                                background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
                            }
                        }),
                        $el("span", { className: "hsl-value", textContent: "0" })
                    ]),
                    // Saturation control
                    $el("div", {
                        className: "hsl-control"
                    }, [
                        $el("div", {
                            className: "hsl-label"
                        }, [
                            $el("span", { textContent: "Saturation" })
                        ]),
                        $el("input", {
                            type: "range",
                            min: HSL_PARAMS.saturation.min,
                            max: HSL_PARAMS.saturation.max,
                            value: HSL_PARAMS.saturation.default,
                            style: {
                                background: "linear-gradient(to right, #808080, #ff0000)"
                            }
                        }),
                        $el("span", { className: "hsl-value", textContent: "0" })
                    ]),
                    // Lightness control
                    $el("div", {
                        className: "hsl-control"
                    }, [
                        $el("div", {
                            className: "hsl-label"
                        }, [
                            $el("span", { textContent: "Lightness" })
                        ]),
                        $el("input", {
                            type: "range",
                            min: HSL_PARAMS.lightness.min,
                            max: HSL_PARAMS.lightness.max,
                            value: HSL_PARAMS.lightness.default,
                            style: {
                                background: "linear-gradient(to right, #000000, #ffffff)"
                            }
                        }),
                        $el("span", { className: "hsl-value", textContent: "0" })
                    ]),
                    // 着色控制
                    $el("div", {
                        className: "hsl-control"
                    }, [
                        $el("div", {
                            className: "hsl-label"
                        }, [
                            $el("span", { textContent: "Colorize Intensity" })
                        ]),
                        $el("input", {
                            type: "range",
                            min: HSL_PARAMS.colorize.min,
                            max: HSL_PARAMS.colorize.max,
                            value: HSL_PARAMS.colorize.default,
                            style: {
                                background: "linear-gradient(to right, #808080, #ff0000)"
                            }
                        }),
                        $el("span", { className: "hsl-value", textContent: "0" })
                    ]),
                    // Colorize toggle
                    $el("div", {
                        className: "hsl-colorize-toggle"
                    }, [
                        $el("input", {
                            type: "checkbox",
                            id: `hsl-colorize-${this.id}`,
                            checked: false
                        }),
                        $el("label", {
                            htmlFor: `hsl-colorize-${this.id}`,
                            textContent: "Enable Colorize Mode"
                        })
                    ])
                ]);

                // 添加控制面板到节点
                this.widgets[0].parentElement.appendChild(hslPanel);

                // 获取所有输入和值显示元素
                const inputs = hslPanel.querySelectorAll("input[type='range']");
                const values = hslPanel.querySelectorAll(".hsl-value");
                const presets = hslPanel.querySelectorAll(".hsl-preset");
                const colorizeToggle = hslPanel.querySelector("input[type='checkbox']");
                const channelButtons = hslPanel.querySelectorAll(".color-channel");

                // 当前选中的通道
                let currentChannel = "master";

                // 更新参数函数
                const updateParams = () => {
                    try {
                        // 获取当前参数
                        let params = JSON.parse(this.inputs[1].value);
                        
                        // 确保所有通道存在
                        COLOR_CHANNELS.forEach(channel => {
                            if (!params[channel.id]) {
                                params[channel.id] = { hue: 0, saturation: 0, lightness: 0 };
                            }
                        });

                        // 更新当前通道的值
                        params[currentChannel].hue = parseInt(inputs[0].value);
                        params[currentChannel].saturation = parseInt(inputs[1].value);
                        params[currentChannel].lightness = parseInt(inputs[2].value);
                        
                        // 更新着色值
                        params.colorize = colorizeToggle.checked ? parseInt(inputs[3].value) : 0;
                        
                        // 更新显示值
                        values[0].textContent = params[currentChannel].hue;
                        values[1].textContent = params[currentChannel].saturation;
                        values[2].textContent = params[currentChannel].lightness;
                        values[3].textContent = params.colorize;
                        
                        // 更新着色控制的可用性
                        inputs[3].disabled = !colorizeToggle.checked;
                        inputs[3].style.opacity = colorizeToggle.checked ? "1" : "0.5";
                        
                        // 更新节点参数
                        this.inputs[1].value = JSON.stringify(params);
                        
                        // 更新节点的hue, saturation, lightness参数
                        if (this.widgets) {
                            const hueWidget = this.widgets.find(w => w.name === "hue");
                            const saturationWidget = this.widgets.find(w => w.name === "saturation");
                            const lightnessWidget = this.widgets.find(w => w.name === "lightness");
                            const colorizeWidget = this.widgets.find(w => w.name === "colorize");
                            
                            if (hueWidget) hueWidget.value = params[currentChannel].hue;
                            if (saturationWidget) saturationWidget.value = params[currentChannel].saturation;
                            if (lightnessWidget) lightnessWidget.value = params[currentChannel].lightness;
                            if (colorizeWidget) colorizeWidget.value = colorizeToggle.checked;
                        }
                        
                        this.graph.setDirtyCanvas(true);

                        // 移除所有预设的active类
                        presets.forEach(preset => preset.classList.remove("active"));
                    } catch (error) {
                        console.error("更新HSL参数失败:", error);
                    }
                };

                // 切换通道函数
                const switchChannel = (channelId) => {
                    try {
                        currentChannel = channelId;
                        
                        // 更新通道按钮状态
                        channelButtons.forEach(button => {
                            if (button.dataset.channelId === channelId) {
                                button.classList.add("active");
                            } else {
                                button.classList.remove("active");
                            }
                        });
                        
                        // 获取当前参数
                        const params = JSON.parse(this.inputs[1].value);
                        
                        // 确保当前通道存在
                        if (!params[channelId]) {
                            params[channelId] = { hue: 0, saturation: 0, lightness: 0 };
                        }
                        
                        // 更新滑块值
                        inputs[0].value = params[channelId].hue;
                        inputs[1].value = params[channelId].saturation;
                        inputs[2].value = params[channelId].lightness;
                        
                        // 更新显示值
                        values[0].textContent = params[channelId].hue;
                        values[1].textContent = params[channelId].saturation;
                        values[2].textContent = params[channelId].lightness;
                        
                        // 更新着色相关控件
                        if (channelId === "master") {
                            inputs[3].value = params.colorize || 0;
                            values[3].textContent = params.colorize || 0;
                            colorizeToggle.checked = params.colorize > 0;
                            inputs[3].disabled = !colorizeToggle.checked;
                            inputs[3].style.opacity = colorizeToggle.checked ? "1" : "0.5";
                        }
                        
                        // 更新节点的channel参数
                        if (this.widgets) {
                            const channelWidget = this.widgets.find(w => w.name === "channel");
                            if (channelWidget) {
                                channelWidget.value = channelId;
                            }
                        }
                        
                        // 更新节点的hue, saturation, lightness参数
                        if (this.widgets) {
                            const hueWidget = this.widgets.find(w => w.name === "hue");
                            const saturationWidget = this.widgets.find(w => w.name === "saturation");
                            const lightnessWidget = this.widgets.find(w => w.name === "lightness");
                            
                            if (hueWidget) hueWidget.value = params[channelId].hue;
                            if (saturationWidget) saturationWidget.value = params[channelId].saturation;
                            if (lightnessWidget) lightnessWidget.value = params[channelId].lightness;
                        }
                        
                        // 通知画布更新
                        this.graph.setDirtyCanvas(true);
                    } catch (error) {
                        console.error("切换颜色通道失败:", error);
                    }
                };

                // 应用预设函数
                const applyPreset = (presetName) => {
                    const preset = HSL_PRESETS[presetName];
                    if (preset) {
                        // 获取当前参数
                        let params = JSON.parse(this.inputs[1].value);
                        
                        // 更新主通道的值
                        params.master = {
                            hue: preset.hue,
                            saturation: preset.saturation,
                            lightness: preset.lightness
                        };
                        
                        // 更新着色值
                        params.colorize = preset.colorize || 0;
                        
                        // 更新节点参数
                        this.inputs[1].value = JSON.stringify(params);
                        
                        // 更新节点的hue, saturation, lightness和colorize参数
                        if (this.widgets) {
                            const hueWidget = this.widgets.find(w => w.name === "hue");
                            const saturationWidget = this.widgets.find(w => w.name === "saturation");
                            const lightnessWidget = this.widgets.find(w => w.name === "lightness");
                            const colorizeWidget = this.widgets.find(w => w.name === "colorize");
                            
                            if (hueWidget) hueWidget.value = preset.hue;
                            if (saturationWidget) saturationWidget.value = preset.saturation;
                            if (lightnessWidget) lightnessWidget.value = preset.lightness;
                            if (colorizeWidget) colorizeWidget.value = preset.colorize > 0;
                        }
                        
                        // 切换到主通道
                        switchChannel("master");
                        
                        // 添加active类到当前预设
                        presets.forEach(preset => {
                            if (preset.textContent === presetName) {
                                preset.classList.add("active");
                            } else {
                                preset.classList.remove("active");
                            }
                        });
                    }
                };

                // 添加事件监听器
                inputs.forEach(input => {
                    input.addEventListener("input", updateParams);
                });
                
                colorizeToggle.addEventListener("change", updateParams);

                // 添加预设点击事件
                presets.forEach(preset => {
                    preset.addEventListener("click", () => {
                        applyPreset(preset.textContent);
                    });
                });

                // 添加通道切换事件
                channelButtons.forEach(button => {
                    button.addEventListener("click", () => {
                        switchChannel(button.dataset.channelId);
                    });
                });

                // 初始化控件
                const initControls = () => {
                    try {
                        // 获取当前参数值
                        const paramValue = this.inputs[1].value;
                        if (paramValue) {
                            const params = JSON.parse(paramValue);
                            
                            // 确保所有通道存在
                            COLOR_CHANNELS.forEach(channel => {
                                if (!params[channel.id]) {
                                    params[channel.id] = { hue: 0, saturation: 0, lightness: 0 };
                                }
                            });
                            
                            // 更新节点参数
                            this.inputs[1].value = JSON.stringify(params);
                            
                            // 切换到主通道
                            switchChannel("master");
                            
                            // 确保节点的colorize参数与JSON参数一致
                            if (this.widgets) {
                                const colorizeWidget = this.widgets.find(w => w.name === "colorize");
                                if (colorizeWidget) {
                                    colorizeWidget.value = params.colorize > 0;
                                }
                            }
                        }
                    } catch (error) {
                        console.error("初始化HSL控件失败:", error);
                    }
                };
                
                // 执行初始化
                initControls();
                
                // 监听参数变化
                this.onConnectOutput = () => {
                    initControls();
                };

                return result;
            };
        }
    }
});

console.log("🔄 PhotoshopHSLNode.js 加载完成"); 