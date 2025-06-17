/**
 * HistogramAnalysisNode - 简单的前端注册
 * 此节点主要功能在后端实现，前端只做基本注册
 */

import { app } from '../../scripts/app.js';

console.log('📊 HistogramAnalysisNode.js 开始加载...');

app.registerExtension({
    name: 'Comfy.HistogramAnalysisNode',
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === 'HistogramAnalysisNode') {
            console.log('📊 注册 HistogramAnalysisNode 节点 - 仅后端功能');
            
            // 确保不会有任何 onNodeCreated 错误
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                // 调用原始方法（如果存在）
                if (onNodeCreated) {
                    try {
                        onNodeCreated.apply(this, arguments);
                    } catch (error) {
                        console.warn('📊 HistogramAnalysisNode: 忽略 onNodeCreated 错误', error);
                    }
                }
                
                // 此节点不需要前端交互功能
                console.log('📊 HistogramAnalysisNode 节点已创建（ID: ' + this.id + '）');
            };
        }
    }
});

console.log('✅ HistogramAnalysisNode.js 加载完成');