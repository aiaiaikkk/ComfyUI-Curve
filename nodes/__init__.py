"""
ComfyUI-Curve模块化节点系统

重构后的模块化架构，将各个功能节点分类组织：
- core: 核心基础模块
- photoshop: PS风格调整节点
- lightroom: Lightroom风格调整节点
- camera_raw: Camera Raw风格增强节点
- effects: 图像效果节点
- analysis: 图像分析节点
- presets: 预设配置节点
"""

# 导入各模块的节点
from .photoshop.hsl import PhotoshopHSLNode
from .photoshop.curve import PhotoshopCurveNode
from .photoshop.levels import PhotoshopLevelsNode

from .lightroom.color_grading import ColorGradingNode

from .camera_raw.enhance import CameraRawEnhanceNode

from .effects.gaussian_blur import GaussianBlurNode

from .analysis.histogram import HistogramAnalysisNode


# 节点映射
NODE_CLASS_MAPPINGS = {
    "PhotoshopCurveNode": PhotoshopCurveNode,
    "PhotoshopLevelsNode": PhotoshopLevelsNode,
    "PhotoshopHSLNode": PhotoshopHSLNode,
    "ColorGradingNode": ColorGradingNode,
    "CameraRawEnhanceNode": CameraRawEnhanceNode,
    "GaussianBlurNode": GaussianBlurNode,
    "HistogramAnalysisNode": HistogramAnalysisNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PhotoshopCurveNode": "🎨 PS Curves",
    "PhotoshopLevelsNode": "📊 PS Levels",
    "PhotoshopHSLNode": "🎨 PS HSL",
    "ColorGradingNode": "🎨 Color Grading",
    "CameraRawEnhanceNode": "📷 Camera Raw Enhance",
    "GaussianBlurNode": "🔀 Gaussian Blur with Mask",
    "HistogramAnalysisNode": "📊 Histogram Analysis",
}

# JS文件映射
NODE_CLASS_TO_JS_FILE = {
    "PhotoshopCurveNode": "PhotoshopCurveNode.js",
    "PhotoshopLevelsNode": "PhotoshopLevelsNode.js",
    "PhotoshopHSLNode": "PhotoshopHSLNode.js",
    "ColorGradingNode": "ColorGradingNode.js",
    "CameraRawEnhanceNode": "CameraRawEnhanceNode.js",
    "GaussianBlurNode": "GaussianBlurNode.js",
    "HistogramAnalysisNode": "HistogramAnalysisNode.js",
}

# Web目录设置
WEB_DIRECTORY = "./web"

__all__ = [
    'NODE_CLASS_MAPPINGS', 
    'NODE_DISPLAY_NAME_MAPPINGS', 
    'NODE_CLASS_TO_JS_FILE',
    'WEB_DIRECTORY'
]