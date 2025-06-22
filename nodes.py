"""
ComfyUI-Curve 主节点入口文件

这是重构后的入口文件，现在仅作为模块化节点系统的导入代理。
所有节点已经被重构到nodes/目录下的对应模块中。

架构说明：
- nodes/core/: 核心基础模块（BaseImageNode, mask_utils等）
- nodes/photoshop/: PS风格调整节点（HSL, Curve, Levels）
- nodes/lightroom/: Lightroom风格节点（ColorGrading）
- nodes/camera_raw/: Camera Raw增强节点
- nodes/effects/: 图像效果节点（高斯模糊等）
- nodes/analysis/: 图像分析节点（直方图等）
- nodes/presets/: 预设配置节点
"""

# 从模块化系统导入所有必要的组件
from nodes import (
    NODE_CLASS_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS, 
    NODE_CLASS_TO_JS_FILE,
    WEB_DIRECTORY
)

# 导出所有必要的变量供ComfyUI使用
__all__ = [
    'NODE_CLASS_MAPPINGS', 
    'NODE_DISPLAY_NAME_MAPPINGS', 
    'NODE_CLASS_TO_JS_FILE',
    'WEB_DIRECTORY'
]

# 版本信息
__version__ = "2.0.0"  # 重构版本
__description__ = "Professional Color Adjustment Extension for ComfyUI - Modular Architecture"