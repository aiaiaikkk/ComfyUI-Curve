/**
 * HistogramAnalysisNode - Simple Frontend Registration
 * This node's main functionality is implemented on the backend, frontend only does basic registration
 */

import { app } from '../../scripts/app.js';

console.log('📊 HistogramAnalysisNode.js loading...');

app.registerExtension({
    name: 'Comfy.HistogramAnalysisNode',
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === 'HistogramAnalysisNode') {
            console.log('📊 Registering HistogramAnalysisNode - Backend only functionality');
            
            // 确保不会有任何 onNodeCreated 错误
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                // 调用原始方法（如果存在）
                if (onNodeCreated) {
                    try {
                        onNodeCreated.apply(this, arguments);
                    } catch (error) {
                        console.warn('📊 HistogramAnalysisNode: Ignoring onNodeCreated error', error);
                    }
                }
                
                // This node does not require frontend interaction functionality
                console.log('📊 HistogramAnalysisNode node created (ID: ' + this.id + ')');
            };
        }
    }
});

console.log('✅ HistogramAnalysisNode.js loading complete');