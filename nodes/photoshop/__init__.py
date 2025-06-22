"""
Photoshop风格节点模块

提供与Adobe Photoshop类似的图像调整功能：
- 曲线调整
- HSL/色相饱和度调整
- 色阶调整
"""

from .curve import PhotoshopCurveNode
from .hsl import PhotoshopHSLNode
from .levels import PhotoshopLevelsNode

__all__ = ['PhotoshopCurveNode', 'PhotoshopHSLNode', 'PhotoshopLevelsNode']