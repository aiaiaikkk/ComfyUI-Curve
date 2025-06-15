import { app } from '../../scripts/app.js';
import { $el } from '../../scripts/ui.js';

console.log("🔄 PhotoshopHSLNode.js 开始加载...");

// 添加样式
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
        min-width: 120px;
        margin: 0 4px;
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

    /* 模态弹窗样式 */
    .hsl-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .hsl-modal-content {
        background-color: #1a1a1a;
        border-radius: 8px;
        padding: 0;
        width: 1200px;
        max-width: 95%;
        height: 800px;
        max-height: 95vh;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
    }
    
    .hsl-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        background: #2a2a2a;
        border-bottom: 1px solid #333;
    }
    
    .hsl-modal-title {
        color: #fff;
        font-size: 16px;
        font-weight: bold;
    }
    
    .hsl-modal-close {
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
    
    .hsl-modal-close:hover {
        background: #333;
    }
    
    .hsl-modal-body {
        display: flex;
        flex: 1;
        overflow: hidden;
    }
    
    .hsl-preview-container {
        flex: 1.5;
        display: flex;
        flex-direction: column;
        background: #2a2a2a;
        margin: 20px;
        border-radius: 8px;
        overflow: hidden;
        min-width: 500px;
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
        min-width: 300px;
        max-width: 400px;
    }
    
    .hsl-modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 10px 20px;
        background: #2a2a2a;
        border-top: 1px solid #333;
    }
    
    .hsl-modal-button {
        padding: 8px 16px;
        background-color: #4a90e2;
        border: none;
        border-radius: 4px;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
        margin-left: 10px;
        transition: background-color 0.2s;
    }
    
    .hsl-modal-button:hover {
        background-color: #3a80d2;
    }
    
    .hsl-modal-button.secondary {
        background-color: #555;
    }
    
    .hsl-modal-button.secondary:hover {
        background-color: #666;
    }
    
    .hsl-control {
        position: relative;
        margin-bottom: 20px;
    }
    
    .hsl-channel-section {
        margin-bottom: 20px;
        padding: 10px;
        background-color: #333;
        border-radius: 6px;
        border-left: 3px solid;
    }
    
    .hsl-channel-section.master {
        border-left-color: #ffffff;
    }
    
    .hsl-channel-section.red {
        border-left-color: #ff0000;
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

// 全局节点输出缓存
if (!window.globalNodeCache) {
    window.globalNodeCache = new Map();
}

// 添加全局节点执行监听器
function setupGlobalNodeOutputCache() {
    
    if (app.api) {
        
        // 监听executed事件
        app.api.addEventListener("executed", ({ detail }) => {
            const nodeId = String(detail.node); // 确保nodeId是字符串
            const outputData = detail.output;
            
            
            if (nodeId && outputData && outputData.images) {
                window.globalNodeCache.set(nodeId, outputData);
                
                // 同时更新到app.nodeOutputs
                if (!app.nodeOutputs) {
                    app.nodeOutputs = {};
                }
                app.nodeOutputs[nodeId] = outputData;
                
                // 更新节点的imgs属性
                const node = app.graph.getNodeById(nodeId);
                if (node && outputData.images && outputData.images.length > 0) {
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
                    
                    // 将转换后的图像URL存储到自定义属性，避免影响原有系统
                    node._curveNodeImageUrls = outputData.images.map(img => convertToImageUrl(img));
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
                                }
                            }
                        }
                    });
                }
            }
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

// 定义预设
const HSL_PRESETS = {
    "默认": { hue: 0, saturation: 0, lightness: 0 },
    "暖色调": { hue: 30, saturation: 20, lightness: 0 },
    "冷色调": { hue: -30, saturation: 20, lightness: 0 },
    "复古": { hue: 0, saturation: -20, lightness: 10 },
    "黑白": { hue: 0, saturation: -100, lightness: 0 },
    "高对比度": { hue: 0, saturation: 30, lightness: 10 },
    "柔和": { hue: 0, saturation: -10, lightness: 5 },
    "鲜艳": { hue: 0, saturation: 50, lightness: 0 }
};

// 定义颜色通道 - 按照红橙黄绿浅绿蓝紫洋红顺序排列
const COLOR_CHANNELS = [
    { id: "red", name: "红色", color: "#ff0000", degree: 0,
      // -100到+100对应色相调整范围：-100°到+100°
      // 红色(0°)向左-100对应洋红(320°)，向右+100对应黄绿(100°)
      hueGradient: "linear-gradient(to right, #ff00ff, #ff0080, #ff0040, #ff0000, #ff4000, #ff8000, #ffff00, #80ff00)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #ff0000)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #ff0000, #ffffff)" 
    },
    { id: "orange", name: "橙色", color: "#ff8000", degree: 30,
      // 橙色(30°)向左-100对应紫红(290°)，向右+100对应青色(130°)
      hueGradient: "linear-gradient(to right, #ff00ff, #ff0080, #ff0000, #ff4000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #ff8000)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #ff8000, #ffffff)"
    },
    { id: "yellow", name: "黄色", color: "#ffff00", degree: 60,
      // 黄色(60°)向左-100对应红色(320°)，向右+100对应蓝色(160°)
      hueGradient: "linear-gradient(to right, #ff0040, #ff0000, #ff4000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #ffff00)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #ffff00, #ffffff)"
    },
    { id: "green", name: "绿色", color: "#00ff00", degree: 120,
      // 绿色(120°)向左-100对应橙色(20°)，向右+100对应蓝紫(220°)
      hueGradient: "linear-gradient(to right, #ff6000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #00ff00)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #00ff00, #ffffff)"
    },
    { id: "aqua", name: "浅绿", color: "#00ffff", degree: 180,
      // 青色(180°)向左-100对应黄色(80°)，向右+100对应洋红(280°)
      hueGradient: "linear-gradient(to right, #e0ff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #4000ff, #8000ff)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #00ffff)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #00ffff, #ffffff)"
    },
    { id: "blue", name: "蓝色", color: "#0000ff", degree: 240,
      // 蓝色(240°)向左-100对应绿色(140°)，向右+100对应红色(340°)
      hueGradient: "linear-gradient(to right, #00ff40, #00ff80, #00ffff, #0080ff, #0000ff, #4000ff, #8000ff, #ff00ff, #ff0080)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #0000ff)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #0000ff, #ffffff)"
    },
    { id: "purple", name: "紫色", color: "#8000ff", degree: 270,
      // 紫色(270°)向左-100对应青色(170°)，向右+100对应橙色(10°)
      hueGradient: "linear-gradient(to right, #00ffbf, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000, #ff4000)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #8000ff)",
      // 明度滑轨从黑色到当前色再到白色
      lightGradient: "linear-gradient(to right, #000000, #8000ff, #ffffff)"
    },
    { id: "magenta", name: "洋红", color: "#ff00ff", degree: 300,
      // 洋红(300°)向左-100对应蓝色(200°)，向右+100对应黄色(40°)
      hueGradient: "linear-gradient(to right, #0080ff, #0000ff, #4000ff, #8000ff, #ff00ff, #ff0080, #ff0000, #ff4000, #ff8000)",
      // 饱和度滑轨从灰色到饱和色
      satGradient: "linear-gradient(to right, #808080, #ff00ff)",
      // 明度滑轨从黑色到当前色再到白色
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
                
                // 创建模态弹窗容器
                const modal = document.createElement("div");
                modal.className = "hsl-modal";
                
                // 创建模态弹窗内容
                const modalContent = document.createElement("div");
                modalContent.className = "hsl-modal-content";
                
                // 创建模态弹窗头部
                const modalHeader = document.createElement("div");
                modalHeader.className = "hsl-modal-header";
                
                const modalTitle = document.createElement("div");
                modalTitle.className = "hsl-modal-title";
                modalTitle.textContent = "Photoshop HSL 调整";
                
                const closeButton = document.createElement("button");
                closeButton.className = "hsl-modal-close";
                closeButton.textContent = "×";
                closeButton.onclick = () => {
                    document.body.removeChild(modal);
                };
                
                modalHeader.appendChild(modalTitle);
                modalHeader.appendChild(closeButton);
                
                // 创建模态弹窗主体 - 新的布局：左侧预览，右侧控制区
                const modalBody = document.createElement("div");
                modalBody.className = "hsl-modal-body";
                
                // 创建左侧预览区域
                const previewContainer = document.createElement("div");
                previewContainer.className = "hsl-preview-container";
                
                // 创建预览图像
                const previewImage = document.createElement("img");
                previewImage.className = "hsl-preview-image";
                previewImage.src = ""; // 图像源将在后续设置
                previewImage.alt = "预览";
                
                previewContainer.appendChild(previewImage);
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
                
                // 为每个颜色通道创建控件
                COLOR_CHANNELS.forEach(channel => {
                    const channelSection = document.createElement("div");
                    channelSection.className = `hsl-channel-section ${channel.id}`;
                    
                    const channelTitle = document.createElement("div");
                    channelTitle.className = "hsl-channel-title";
                    channelTitle.textContent = channel.name;
                    channelSection.appendChild(channelTitle);
                    
                    // 创建色相控制
                    const hueControl = this.createSliderControl(
                        "色相", 
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
                        "饱和度", 
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
                    
                    // 创建明度控制
                    const lightnessControl = this.createSliderControl(
                        "明度", 
                        HSL_PARAMS.lightness.min, 
                        HSL_PARAMS.lightness.max,
                        0, // 默认值，后面会从节点参数中更新
                        channel.lightGradient, // 使用通道特定的明度渐变
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
                    
                    controlsContainer.appendChild(channelSection);
                });
                
                // 着色模式已移除
                modalBody.appendChild(controlsContainer);
                
                // 创建模态弹窗底部
                const modalFooter = document.createElement("div");
                modalFooter.className = "hsl-modal-footer";
                
                const resetButton = document.createElement("button");
                resetButton.className = "hsl-modal-button secondary";
                resetButton.textContent = "重置默认";
                resetButton.style.marginRight = "auto"; // 将重置按钮放在左侧
                resetButton.onclick = () => {
                    // 重置所有参数到默认值
                    this.resetAllParameters();
                    // 更新控件显示
                    this.updateModalControls(controlsContainer);
                    // 更新预览
                    updatePreviewImage();
                };
                
                const cancelButton = document.createElement("button");
                cancelButton.className = "hsl-modal-button secondary";
                cancelButton.textContent = "取消";
                cancelButton.onclick = () => {
                    document.body.removeChild(modal);
                };
                
                const applyButton = document.createElement("button");
                applyButton.className = "hsl-modal-button";
applyButton.textContent = "应用";
applyButton.onclick = () => {
    // 获取当前弹窗中的所有控件值，并更新到节点
    try {
        console.log("应用HSL调整到节点");
        
        // 遍历所有颜色通道
        COLOR_CHANNELS.forEach(channel => {
            const channelSection = controlsContainer.querySelector(`.hsl-channel-section.${channel.id}`);
            if (channelSection) {
                // 获取当前通道控件值
                const hueControl = channelSection.querySelector(".hsl-control:nth-child(2)");
                const saturationControl = channelSection.querySelector(".hsl-control:nth-child(3)");
                const lightnessControl = channelSection.querySelector(".hsl-control:nth-child(4)");
                
                // 获取对应的节点控件
                const hueWidget = this.widgets.find(w => w.name === `${channel.id}_hue`);
                const saturationWidget = this.widgets.find(w => w.name === `${channel.id}_saturation`);
                const lightnessWidget = this.widgets.find(w => w.name === `${channel.id}_lightness`);
                
                // 更新节点控件值
                if (hueWidget && hueControl) {
                    const input = hueControl.querySelector("input");
                    if (input) {
                        hueWidget.value = parseInt(input.value);
                    }
                }
                
                if (saturationWidget && saturationControl) {
                    const input = saturationControl.querySelector("input");
                    if (input) {
                        saturationWidget.value = parseInt(input.value);
                    }
                }
                
                if (lightnessWidget && lightnessControl) {
                    const input = lightnessControl.querySelector("input");
                    if (input) {
                        lightnessWidget.value = parseInt(input.value);
                    }
                }
            }
        });
        
        // 更新节点参数字符串（hsl_params）
        const paramsObj = {};
        COLOR_CHANNELS.forEach(channel => {
            const hueWidget = this.widgets.find(w => w.name === `${channel.id}_hue`);
            const saturationWidget = this.widgets.find(w => w.name === `${channel.id}_saturation`);
            const lightnessWidget = this.widgets.find(w => w.name === `${channel.id}_lightness`);
            
            paramsObj[channel.id] = {
                hue: hueWidget ? hueWidget.value : 0,
                saturation: saturationWidget ? saturationWidget.value : 0,
                lightness: lightnessWidget ? lightnessWidget.value : 0
            };
        });
        
        // 更新输入参数
        this.inputs[1].value = JSON.stringify(paramsObj);
        
        console.log("HSL参数已更新:", paramsObj);
    } catch (error) {
        console.error("更新HSL参数失败:", error);
    }
    
    document.body.removeChild(modal);
    // 通知画布更新
    this.graph.setDirtyCanvas(true);
};
                
                modalFooter.appendChild(resetButton);
                modalFooter.appendChild(cancelButton);
                modalFooter.appendChild(applyButton);
                
                // 组装模态弹窗
                modalContent.appendChild(modalHeader);
                modalContent.appendChild(modalBody);
                modalContent.appendChild(modalFooter);
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
                                hue: this.widgets.find(w => w.name === "aqua_hue")?.value || 0,
                                saturation: this.widgets.find(w => w.name === "aqua_saturation")?.value || 0,
                                lightness: this.widgets.find(w => w.name === "aqua_lightness")?.value || 0
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
                            // 应用HSL调整 - 模拟CameraRaw算法
                            for (let i = 0; i < data.length; i += 4) {
                                const r = data[i];
                                const g = data[i + 1];
                                const b = data[i + 2];
                                
                                // 计算遮罩因子
                                let maskFactor = 1.0; // 默认完全应用调整
                                if (maskData) {
                                    // 获取遮罩亮度（使用红色通道作为遮罩值）
                                    const maskLuminance = maskData[i] / 255.0;
                                    maskFactor = maskLuminance; // 直接使用遮罩亮度作为因子
                                }
                                
                                // 如果遮罩因子为0，跳过处理
                                if (maskFactor === 0) {
                                    continue;
                                }
                                
                                // 转换为HSL
                                const hsl = rgbToHsl(r, g, b);
                                const originalHue = hsl[0];
                            
                            // 获取所有可能影响此像素的通道
                            const influencingChannels = [];
                            
                            // 计算每个通道对此像素的影响权重 (模拟CameraRaw的平滑过渡)
                            COLOR_CHANNELS.forEach(channel => {
                                // 计算色相距离 (0-0.5范围)
                                let hueDist = Math.abs(originalHue - (channel.degree / 360));
                                // 处理色环边界情况
                                if (hueDist > 0.5) hueDist = 1 - hueDist;
                                
                                // 影响范围 (大约60度/360 = 1/6 = 0.167)
                                const influence = 0.167;
                                
                                // 计算权重 - 使用平滑的钟形曲线
                                let weight = 0;
                                if (hueDist < influence) {
                                    // 平滑过渡 - 余弦曲线 (1 在中心, 0 在边缘)
                                    weight = Math.cos(hueDist * Math.PI / influence / 2);
                                    weight = weight * weight; // 使曲线更陡峭
                                    
                                    influencingChannels.push({
                                        id: channel.id,
                                        weight: weight,
                                        params: params[channel.id]
                                    });
                                }
                            });
                            
                            // 总权重
                            const totalWeight = influencingChannels.reduce((sum, ch) => sum + ch.weight, 0);
                            
                            // 如果至少有一个通道有影响
                            if (totalWeight > 0) {
                                let hueShift = 0;
                                let satFactor = 0;
                                let lightFactor = 0;
                                
                                // 计算加权平均调整值
                                influencingChannels.forEach(ch => {
                                    const normWeight = ch.weight / totalWeight;
                                    
                                    // 色相调整 - 使用加权的偏移量
                                    hueShift += (ch.params.hue / 360) * normWeight;
                                    
                                    // 饱和度调整 - 使用非线性曲线
                                    const satAdjust = ch.params.saturation / 100;
                                    // 应用非线性曲线，保持低饱和度区域的细节
                                    const satCurve = satAdjust >= 0 
                                        ? 1 + satAdjust * (1 - 0.3 * hsl[1]) // 高饱和区减少增益
                                        : 1 + satAdjust * (0.7 + 0.3 * hsl[1]); // 低饱和区减少减益
                                    satFactor += satCurve * normWeight;
                                    
                                    // 明度调整 - 使用非线性曲线
                                    const lightAdjust = ch.params.lightness / 100;
                                    // 保护高光和阴影区域
                                    const lightCurve = lightAdjust >= 0
                                        ? 1 + lightAdjust * (1 - 0.5 * hsl[2]) // 高亮区减少增益
                                        : 1 + lightAdjust * (0.5 + 0.5 * hsl[2]); // 暗部减少减益
                                    lightFactor += lightCurve * normWeight;
                                });
                                
                                // 应用调整
                                hsl[0] = (hsl[0] + hueShift) % 1; // 色相调整
                                hsl[1] = Math.max(0, Math.min(1, hsl[1] * satFactor)); // 饱和度调整
                                hsl[2] = Math.max(0, Math.min(1, hsl[2] * lightFactor)); // 明度调整
                            }
                            
                            // 转回RGB
                            const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
                            
                            // 应用遮罩混合
                            if (maskFactor < 1.0) {
                                // 混合原始和调整后的颜色
                                data[i] = Math.round(r * (1 - maskFactor) + rgb[0] * maskFactor);
                                data[i + 1] = Math.round(g * (1 - maskFactor) + rgb[1] * maskFactor);
                                data[i + 2] = Math.round(b * (1 - maskFactor) + rgb[2] * maskFactor);
                            } else {
                                // 完全应用调整
                                data[i] = rgb[0];
                                data[i + 1] = rgb[1];
                                data[i + 2] = rgb[2];
                            }
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
                        // 将0-1的色相映射到颜色通道，与PS终端HSL通道对齐
                        // 色相角度：红色0度，橙色30度，黄色60度，绿色120度，青色180度，蓝色240度，紫色270度，洋红300度
                        const hueDegree = hue * 360;
                        
                        if (hueDegree >= 345 || hueDegree < 15) return 'red';       // 红色 345-15度
                        if (hueDegree >= 15 && hueDegree < 45) return 'orange';     // 橙色 15-45度
                        if (hueDegree >= 45 && hueDegree < 90) return 'yellow';     // 黄色 45-90度
                        if (hueDegree >= 90 && hueDegree < 150) return 'green';     // 绿色 90-150度
                        if (hueDegree >= 150 && hueDegree < 210) return 'aqua';     // 青色 150-210度
                        if (hueDegree >= 210 && hueDegree < 255) return 'blue';     // 蓝色 210-255度
                        if (hueDegree >= 255 && hueDegree < 285) return 'purple';   // 紫色 255-285度
                        if (hueDegree >= 285 && hueDegree < 345) return 'magenta';  // 洋红 285-345度
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
                
                // 创建数值显示
                const valueSpan = document.createElement("span");
                valueSpan.className = "hsl-value";
                valueSpan.textContent = value;
                
                input.oninput = () => {
                    valueSpan.textContent = input.value;
                    if (onChange) {
                        onChange(input.value);
                    }
                };
                
                // 将元素添加到控件中
                control.appendChild(labelDiv);
                control.appendChild(input);
                control.appendChild(valueSpan);
                
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
                        
                        const hueControl = channelSection.querySelector(".hsl-control:nth-child(2)");
                        const saturationControl = channelSection.querySelector(".hsl-control:nth-child(3)");
                        const lightnessControl = channelSection.querySelector(".hsl-control:nth-child(4)");
                        
                        if (hueWidget && hueControl) {
                            const input = hueControl.querySelector("input");
                            const valueSpan = hueControl.querySelector(".hsl-value");
                            if (input && valueSpan) {
                                input.value = hueWidget.value;
                                valueSpan.textContent = hueWidget.value;
                            }
                        }
                        
                        if (saturationWidget && saturationControl) {
                            const input = saturationControl.querySelector("input");
                            const valueSpan = saturationControl.querySelector(".hsl-value");
                            if (input && valueSpan) {
                                input.value = saturationWidget.value;
                                valueSpan.textContent = saturationWidget.value;
                            }
                        }
                        
                        if (lightnessWidget && lightnessControl) {
                            const input = lightnessControl.querySelector("input");
                            const valueSpan = lightnessControl.querySelector(".hsl-value");
                            if (input && valueSpan) {
                                input.value = lightnessWidget.value;
                                valueSpan.textContent = lightnessWidget.value;
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
                            $el("span", { textContent: "色相" })
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
                    // 饱和度控制
                    $el("div", {
                        className: "hsl-control"
                    }, [
                        $el("div", {
                            className: "hsl-label"
                        }, [
                            $el("span", { textContent: "饱和度" })
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
                    // 亮度控制
                    $el("div", {
                        className: "hsl-control"
                    }, [
                        $el("div", {
                            className: "hsl-label"
                        }, [
                            $el("span", { textContent: "亮度" })
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
                            $el("span", { textContent: "着色强度" })
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
                    // 着色切换
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
                            textContent: "启用着色模式"
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