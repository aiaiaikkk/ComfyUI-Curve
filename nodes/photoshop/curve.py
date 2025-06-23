"""
Photoshop风格曲线调整节点

提供与Adobe Photoshop曲线调整工具类似的功能：
- RGB、红、绿、蓝通道独立调整
- 基于控制点的曲线调整
- 遮罩支持和羽化功能
- 实时预览功能
"""

import torch
import numpy as np
from PIL import Image
import io
import base64

from ..core.base_node import BaseImageNode
from ..core.mask_utils import apply_mask_to_image, blur_mask
from ..core.preset_manager import preset_manager


class PhotoshopCurveNode(BaseImageNode):
    """PS风格的曲线调整节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'rgb_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': 'RGB曲线控制点，格式：[[x1,y1],[x2,y2],...]'
                }),
                'red_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': '红色通道曲线控制点'
                }),
                'green_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': '绿色通道曲线控制点'
                }),
                'blue_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': '蓝色通道曲线控制点'
                }),
                'curve_type': (['cubic', 'linear'], {
                    'default': 'cubic',
                    'tooltip': '曲线插值类型'
                }),
            },
            'optional': {
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，调整仅对遮罩区域有效'
                }),
                'mask_blur': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 20.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '遮罩边缘羽化程度'
                }),
                'invert_mask': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '反转遮罩区域'
                }),
            },
            'hidden': {
                'unique_id': 'UNIQUE_ID'
            }
        }
    
    RETURN_TYPES = ('IMAGE',)
    FUNCTION = 'apply_curve_adjustment'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    def apply_curve_adjustment(self, image, rgb_curve='[[0,0],[255,255]]', 
                               red_curve='[[0,0],[255,255]]', green_curve='[[0,0],[255,255]]', 
                               blue_curve='[[0,0],[255,255]]', curve_type='cubic',
                               mask=None, mask_blur=0.0, invert_mask=False, unique_id=None, **kwargs):
        """应用曲线调整"""
        print(f"PhotoshopCurveNode 接收到参数:")
        print(f"  rgb_curve: {rgb_curve}")
        print(f"  red_curve: {red_curve}")
        print(f"  green_curve: {green_curve}")
        print(f"  blue_curve: {blue_curve}")
        print(f"  curve_type: {curve_type}")
        
        try:
            # 发送预览到前端
            if unique_id is not None:
                self.send_preview_to_frontend(image, unique_id, "photoshop_curve_preview", mask)
            
            # 支持批处理
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image, 
                    self._process_single_image,
                    rgb_curve, red_curve, green_curve, blue_curve, curve_type,
                    mask, mask_blur, invert_mask
                ),)
            else:
                result = self._process_single_image(
                    image, rgb_curve, red_curve, green_curve, blue_curve, curve_type,
                    mask, mask_blur, invert_mask
                )
                return (result,)
        except Exception as e:
            print(f"PhotoshopCurveNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image, rgb_curve, red_curve, green_curve, blue_curve, curve_type,
                              mask, mask_blur, invert_mask):
        """处理单张图像的曲线调整"""
        import json
        from scipy.interpolate import interp1d
        
        device = image.device
        
        # 解析曲线数据
        try:
            rgb_points = json.loads(rgb_curve)
            red_points = json.loads(red_curve)
            green_points = json.loads(green_curve)
            blue_points = json.loads(blue_curve)
        except:
            # 如果解析失败，使用默认的线性曲线
            rgb_points = [[0,0],[255,255]]
            red_points = [[0,0],[255,255]]
            green_points = [[0,0],[255,255]]
            blue_points = [[0,0],[255,255]]
        
        # 检查是否需要处理
        is_identity = (
            self._is_identity_curve(rgb_points) and
            self._is_identity_curve(red_points) and
            self._is_identity_curve(green_points) and
            self._is_identity_curve(blue_points)
        )
        
        if is_identity and mask is None:
            return image
        
        # 转换图像到numpy
        img_np = (image.detach().cpu().numpy() * 255.0).astype(np.uint8)
        result_np = img_np.copy()
        
        # 创建查找表
        rgb_lut = self._create_lut(rgb_points, curve_type)
        red_lut = self._create_lut(red_points, curve_type)
        green_lut = self._create_lut(green_points, curve_type)
        blue_lut = self._create_lut(blue_points, curve_type)
        
        # 应用曲线调整
        if not self._is_identity_curve(rgb_points):
            # 应用RGB曲线到所有通道
            result_np[:,:,0] = rgb_lut[result_np[:,:,0]]
            result_np[:,:,1] = rgb_lut[result_np[:,:,1]]
            result_np[:,:,2] = rgb_lut[result_np[:,:,2]]
        
        # 应用独立通道曲线
        if not self._is_identity_curve(red_points):
            result_np[:,:,0] = red_lut[result_np[:,:,0]]
        if not self._is_identity_curve(green_points):
            result_np[:,:,1] = green_lut[result_np[:,:,1]]
        if not self._is_identity_curve(blue_points):
            result_np[:,:,2] = blue_lut[result_np[:,:,2]]
        
        # 转换回tensor
        result = torch.from_numpy(result_np.astype(np.float32) / 255.0).to(device)
        
        # 应用遮罩
        if mask is not None:
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _is_identity_curve(self, points):
        """检查是否为恒等曲线"""
        if len(points) != 2:
            return False
        return points[0] == [0, 0] and points[1] == [255, 255]
    
    def _create_lut(self, points, curve_type):
        """创建查找表"""
        from scipy.interpolate import interp1d
        
        if len(points) < 2:
            # 默认线性曲线
            return np.arange(256, dtype=np.uint8)
        
        # 排序控制点
        points = sorted(points, key=lambda x: x[0])
        
        # 调试输出
        print(f"  创建LUT - 输入点数: {len(points)}, 曲线类型: {curve_type}")
        print(f"  控制点: {points}")
        
        # 提取x和y坐标
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        
        # 确保边界点
        if x_coords[0] > 0:
            x_coords.insert(0, 0)
            y_coords.insert(0, 0)
        if x_coords[-1] < 255:
            x_coords.append(255)
            y_coords.append(255)
        
        # 创建插值函数
        try:
            if curve_type == 'cubic' and len(x_coords) > 3:
                # 对于cubic插值，需要至少4个点
                interp_func = interp1d(x_coords, y_coords, kind='cubic', bounds_error=False, fill_value='extrapolate')
            elif curve_type == 'cubic' and len(x_coords) == 3:
                # 3个点时使用quadratic插值
                interp_func = interp1d(x_coords, y_coords, kind='quadratic', bounds_error=False, fill_value='extrapolate')
            else:
                # 2个点或更少时使用linear插值
                interp_func = interp1d(x_coords, y_coords, kind='linear', bounds_error=False, fill_value='extrapolate')
        except Exception as e:
            # 如果插值失败，回退到线性插值
            print(f"插值创建失败，使用线性插值: {e}")
            interp_func = interp1d(x_coords, y_coords, kind='linear', bounds_error=False, fill_value='extrapolate')
        
        # 生成查找表
        x_range = np.arange(256)
        lut = interp_func(x_range)
        lut = np.clip(lut, 0, 255).astype(np.uint8)
        
        return lut