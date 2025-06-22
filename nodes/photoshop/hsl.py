"""
Photoshop风格HSL/色相饱和度调整节点

提供与Adobe Photoshop HSL调整工具类似的功能：
- 8个独立的颜色通道调整（红、橙、黄、绿、青、蓝、紫、洋红）
- 每个通道支持色相、饱和度、明度调整
- 遮罩支持和羽化功能
- 实时预览功能
"""

import torch
import numpy as np
import cv2
from PIL import Image
import io
import base64

from ..core.base_node import BaseImageNode
from ..core.mask_utils import apply_mask_to_image, blur_mask


class PhotoshopHSLNode(BaseImageNode):
    """PS风格的色相/饱和度/明度调整节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),

                # 红色控制
                'red_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '红色 - 色相调整 (-100 ~ +100)'
                }),
                'red_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '红色 - 饱和度调整 (-100 ~ +100)'
                }),
                'red_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '红色 - 明度调整 (-100 ~ +100)'
                }),
                # 橙色控制
                'orange_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '橙色 - 色相调整 (-100 ~ +100)'
                }),
                'orange_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '橙色 - 饱和度调整 (-100 ~ +100)'
                }),
                'orange_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '橙色 - 明度调整 (-100 ~ +100)'
                }),
                # 黄色控制
                'yellow_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '黄色 - 色相调整 (-100 ~ +100)'
                }),
                'yellow_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '黄色 - 饱和度调整 (-100 ~ +100)'
                }),
                'yellow_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '黄色 - 明度调整 (-100 ~ +100)'
                }),
                # 绿色控制
                'green_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '绿色 - 色相调整 (-100 ~ +100)'
                }),
                'green_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '绿色 - 饱和度调整 (-100 ~ +100)'
                }),
                'green_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '绿色 - 明度调整 (-100 ~ +100)'
                }),
                # 浅绿控制
                'cyan_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '浅绿 - 色相调整 (-100 ~ +100)'
                }),
                'cyan_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '浅绿 - 饱和度调整 (-100 ~ +100)'
                }),
                'cyan_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '浅绿 - 明度调整 (-100 ~ +100)'
                }),
                # 蓝色控制
                'blue_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '蓝色 - 色相调整 (-100 ~ +100)'
                }),
                'blue_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '蓝色 - 饱和度调整 (-100 ~ +100)'
                }),
                'blue_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '蓝色 - 明度调整 (-100 ~ +100)'
                }),
                # 紫色控制
                'purple_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '紫色 - 色相调整 (-100 ~ +100)'
                }),
                'purple_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '紫色 - 饱和度调整 (-100 ~ +100)'
                }),
                'purple_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '紫色 - 明度调整 (-100 ~ +100)'
                }),
                # 品红控制
                'magenta_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '品红 - 色相调整 (-100 ~ +100)'
                }),
                'magenta_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '品红 - 饱和度调整 (-100 ~ +100)'
                }),
                'magenta_lightness': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '品红 - 明度调整 (-100 ~ +100)'
                }),

            },
            'optional': {
                # 遮罩支持
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
            },
            'ui': {
                'red_hue': {'x': 0, 'y': 0},
                'red_saturation': {'x': 0, 'y': 1},
                'red_lightness': {'x': 0, 'y': 2},
                
                'orange_hue': {'x': 0, 'y': 3},
                'orange_saturation': {'x': 0, 'y': 4},
                'orange_lightness': {'x': 0, 'y': 5},
                
                'yellow_hue': {'x': 0, 'y': 6},
                'yellow_saturation': {'x': 0, 'y': 7},
                'yellow_lightness': {'x': 0, 'y': 8},
                
                'green_hue': {'x': 0, 'y': 9},
                'green_saturation': {'x': 0, 'y': 10},
                'green_lightness': {'x': 0, 'y': 11},
                
                'cyan_hue': {'x': 1, 'y': 0},
                'cyan_saturation': {'x': 1, 'y': 1},
                'cyan_lightness': {'x': 1, 'y': 2},
                
                'blue_hue': {'x': 1, 'y': 3},
                'blue_saturation': {'x': 1, 'y': 4},
                'blue_lightness': {'x': 1, 'y': 5},
                
                'purple_hue': {'x': 1, 'y': 6},
                'purple_saturation': {'x': 1, 'y': 7},
                'purple_lightness': {'x': 1, 'y': 8},
                
                'magenta_hue': {'x': 1, 'y': 9},
                'magenta_saturation': {'x': 1, 'y': 10},
                'magenta_lightness': {'x': 1, 'y': 11},
            }
        }
    
    RETURN_TYPES = ('IMAGE',)
    FUNCTION = 'apply_hsl_adjustment'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, image, 
                  red_hue=0.0, red_saturation=0.0, red_lightness=0.0,
                  orange_hue=0.0, orange_saturation=0.0, orange_lightness=0.0,
                  yellow_hue=0.0, yellow_saturation=0.0, yellow_lightness=0.0,
                  green_hue=0.0, green_saturation=0.0, green_lightness=0.0,
                  cyan_hue=0.0, cyan_saturation=0.0, cyan_lightness=0.0,
                  blue_hue=0.0, blue_saturation=0.0, blue_lightness=0.0,
                  purple_hue=0.0, purple_saturation=0.0, purple_lightness=0.0,
                  magenta_hue=0.0, magenta_saturation=0.0, magenta_lightness=0.0,
                  unique_id=None, **kwargs):
        mask = kwargs.get('mask', None)
        mask_blur = kwargs.get('mask_blur', 0.0)
        invert_mask = kwargs.get('invert_mask', False)
        
        mask_hash = "none" if mask is None else str(hash(mask.data.tobytes()) if hasattr(mask, 'data') else hash(str(mask)))
        return f"{red_hue}_{red_saturation}_{red_lightness}_{orange_hue}_{orange_saturation}_{orange_lightness}_{yellow_hue}_{yellow_saturation}_{yellow_lightness}_{green_hue}_{green_saturation}_{green_lightness}_{cyan_hue}_{cyan_saturation}_{cyan_lightness}_{blue_hue}_{blue_saturation}_{blue_lightness}_{purple_hue}_{purple_saturation}_{purple_lightness}_{magenta_hue}_{magenta_saturation}_{magenta_lightness}_{mask_hash}_{mask_blur}_{invert_mask}"
    
    def apply_hsl_adjustment(self, image, 
                             red_hue=0.0, red_saturation=0.0, red_lightness=0.0,
                             orange_hue=0.0, orange_saturation=0.0, orange_lightness=0.0,
                             yellow_hue=0.0, yellow_saturation=0.0, yellow_lightness=0.0,
                             green_hue=0.0, green_saturation=0.0, green_lightness=0.0,
                             cyan_hue=0.0, cyan_saturation=0.0, cyan_lightness=0.0,
                             blue_hue=0.0, blue_saturation=0.0, blue_lightness=0.0,
                             purple_hue=0.0, purple_saturation=0.0, purple_lightness=0.0,
                             magenta_hue=0.0, magenta_saturation=0.0, magenta_lightness=0.0,
                             **kwargs):
        """应用PS风格的HSL调整"""
        # 性能优化：如果所有参数都是默认值，直接返回原图
        if (red_hue == 0 and red_saturation == 0 and red_lightness == 0 and
            orange_hue == 0 and orange_saturation == 0 and orange_lightness == 0 and
            yellow_hue == 0 and yellow_saturation == 0 and yellow_lightness == 0 and
            green_hue == 0 and green_saturation == 0 and green_lightness == 0 and
            cyan_hue == 0 and cyan_saturation == 0 and cyan_lightness == 0 and
            blue_hue == 0 and blue_saturation == 0 and blue_lightness == 0 and
            purple_hue == 0 and purple_saturation == 0 and purple_lightness == 0 and
            magenta_hue == 0 and magenta_saturation == 0 and magenta_lightness == 0):
            return (image,)
        
        try:
            # 获取unique_id用于前端推送
            unique_id = kwargs.get('unique_id', None)
            
            # 发送预览到前端
            if unique_id is not None:
                mask = kwargs.get('mask', None)
                self.send_preview_to_frontend(image, unique_id, "photoshop_hsl_preview", mask)
            
            # 处理可选参数
            mask = kwargs.get('mask', None)
            mask_blur = kwargs.get('mask_blur', 0.0)
            invert_mask = kwargs.get('invert_mask', False)
            
            # 支持批处理
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image, 
                    self._process_single_image,
                    red_hue, red_saturation, red_lightness,
                    orange_hue, orange_saturation, orange_lightness,
                    yellow_hue, yellow_saturation, yellow_lightness,
                    green_hue, green_saturation, green_lightness,
                    cyan_hue, cyan_saturation, cyan_lightness,
                    blue_hue, blue_saturation, blue_lightness,
                    purple_hue, purple_saturation, purple_lightness,
                    magenta_hue, magenta_saturation, magenta_lightness,
                    mask, mask_blur, invert_mask
                ),)
            else:
                # 处理单张图像
                result = self._process_single_image(
                    image,
                    red_hue, red_saturation, red_lightness,
                    orange_hue, orange_saturation, orange_lightness,
                    yellow_hue, yellow_saturation, yellow_lightness,
                    green_hue, green_saturation, green_lightness,
                    cyan_hue, cyan_saturation, cyan_lightness,
                    blue_hue, blue_saturation, blue_lightness,
                    purple_hue, purple_saturation, purple_lightness,
                    magenta_hue, magenta_saturation, magenta_lightness,
                    mask, mask_blur, invert_mask
                )
                return (result,)
        except Exception as e:
            print(f"PhotoshopHSLNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image, 
                             red_hue, red_saturation, red_lightness,
                             orange_hue, orange_saturation, orange_lightness,
                             yellow_hue, yellow_saturation, yellow_lightness,
                             green_hue, green_saturation, green_lightness,
                             cyan_hue, cyan_saturation, cyan_lightness,
                             blue_hue, blue_saturation, blue_lightness,
                             purple_hue, purple_saturation, purple_lightness,
                             magenta_hue, magenta_saturation, magenta_lightness,
                             mask, mask_blur, invert_mask):
        """处理单张图像的HSL调整"""
        
        # 确保图像在正确的设备上
        device = image.device
        
        # 将图像转换为numpy数组，范围0-255
        img_np = (image.detach().cpu().numpy() * 255.0).astype(np.uint8)
        
        # 转换为OpenCV格式 (RGB -> BGR)
        has_alpha = False
        alpha_channel = None
        
        if img_np.shape[2] == 4:  # 处理RGBA图像
            has_alpha = True
            alpha_channel = img_np[:,:,3]
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        else:  # RGB图像
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        
        # 转换为HSV空间 (OpenCV使用HSV而不是HSL)
        img_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
        
        # 预先检查是否需要处理 - 性能优化
        needs_processing = (
            red_hue != 0 or red_saturation != 0 or red_lightness != 0 or
            orange_hue != 0 or orange_saturation != 0 or orange_lightness != 0 or
            yellow_hue != 0 or yellow_saturation != 0 or yellow_lightness != 0 or
            green_hue != 0 or green_saturation != 0 or green_lightness != 0 or
            cyan_hue != 0 or cyan_saturation != 0 or cyan_lightness != 0 or
            blue_hue != 0 or blue_saturation != 0 or blue_lightness != 0 or
            purple_hue != 0 or purple_saturation != 0 or purple_lightness != 0 or
            magenta_hue != 0 or magenta_saturation != 0 or magenta_lightness != 0
        )
        
        if not needs_processing:
            # 如果没有任何调整，直接转换回RGB并返回
            img_bgr = cv2.cvtColor(img_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
            if has_alpha:
                img_rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGBA)
                img_rgba[:,:,3] = alpha_channel
                result = torch.from_numpy(img_rgba.astype(np.float32) / 255.0).to(device)
            else:
                img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                result = torch.from_numpy(img_rgb.astype(np.float32) / 255.0).to(device)
            return result
        
        # 定义颜色范围 (H值范围在OpenCV中为0-179，与PS终端HSL通道对齐)
        color_ranges = {
            'red': [(0, 10), (170, 179)],  # 红色 - 跨越0度
            'orange': [(11, 25)],          # 橙色
            'yellow': [(26, 40)],          # 黄色
            'green': [(41, 80)],           # 绿色 - 扩大范围
            'cyan': [(81, 100)],           # 青色
            'blue': [(101, 130)],          # 蓝色 - 修正范围
            'purple': [(131, 150)],        # 紫色
            'magenta': [(151, 169)]        # 洋红
        }
        
        # 按照颜色顺序应用各个颜色范围的调整
        color_adjustments = [
            ('red', red_hue, red_saturation, red_lightness),
            ('orange', orange_hue, orange_saturation, orange_lightness),
            ('yellow', yellow_hue, yellow_saturation, yellow_lightness),
            ('green', green_hue, green_saturation, green_lightness),
            ('cyan', cyan_hue, cyan_saturation, cyan_lightness),
            ('blue', blue_hue, blue_saturation, blue_lightness),
            ('purple', purple_hue, purple_saturation, purple_lightness),
            ('magenta', magenta_hue, magenta_saturation, magenta_lightness),
        ]
        
        for color_name, hue_shift, sat_shift, light_shift in color_adjustments:
            if hue_shift != 0 or sat_shift != 0 or light_shift != 0:
                img_hsv = self._adjust_color_range(
                    img_hsv, color_ranges[color_name], 
                    hue_shift, sat_shift, light_shift
                )
        
        # 将HSV值限制在有效范围内
        img_hsv[:,:,0] = np.clip(img_hsv[:,:,0], 0, 179)  # H: 0-179
        img_hsv[:,:,1] = np.clip(img_hsv[:,:,1], 0, 255)  # S: 0-255
        img_hsv[:,:,2] = np.clip(img_hsv[:,:,2], 0, 255)  # V: 0-255
        
        # 转换回BGR
        img_bgr = cv2.cvtColor(img_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        # 转换回RGB格式
        if has_alpha:
            img_rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGBA)
            img_rgba[:,:,3] = alpha_channel
            result = torch.from_numpy(img_rgba.astype(np.float32) / 255.0).to(device)
        else:
            img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            result = torch.from_numpy(img_rgb.astype(np.float32) / 255.0).to(device)
        
        # 应用遮罩
        if mask is not None:
            # 处理遮罩模糊
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _adjust_color_range(self, img_hsv, ranges, hue_shift, sat_shift, light_shift):
        """调整特定颜色范围的HSL值 - 优化版本"""
        # 如果所有调整都是0，直接返回原图
        if hue_shift == 0 and sat_shift == 0 and light_shift == 0:
            return img_hsv
            
        h, w, _ = img_hsv.shape
        
        # 创建遮罩
        mask = np.zeros((h, w), dtype=np.float32)
        
        # 对每个范围创建遮罩
        for r in ranges:
            lower, upper = r
            
            # 创建当前范围的遮罩，使用柔和边界以避免硬边缘
            hue_channel = img_hsv[:,:,0]
            
            # 处理色相环绕（红色跨越0度）
            if lower > upper:  # 跨越0度的情况（如红色）
                range_mask = np.logical_or(hue_channel >= lower, hue_channel <= upper).astype(np.float32)
            else:
                range_mask = np.logical_and(hue_channel >= lower, hue_channel <= upper).astype(np.float32)
            
            # 添加到总遮罩
            mask = np.maximum(mask, range_mask)
        
        # 只在有遮罩的地方进行调整，提高性能
        if np.any(mask > 0):
            result = img_hsv.copy()
            
            # 只对有遮罩的像素进行调整
            mask_indices = mask > 0
            
            if hue_shift != 0:
                # 色相调整
                hue_adjustment = hue_shift * 1.8  # 将-100~100映射到-180~180度
                result[mask_indices, 0] = (result[mask_indices, 0] + hue_adjustment) % 180
            
            if sat_shift != 0:
                # 饱和度调整
                sat_factor = self._calculate_ps_saturation_factor(sat_shift)
                result[mask_indices, 1] = np.clip(result[mask_indices, 1] * sat_factor, 0, 255)
            
            if light_shift != 0:
                # 明度调整
                result[mask_indices, 2] = self._apply_ps_lightness_adjustment(result[mask_indices, 2], light_shift)
            
            return result
        else:
            return img_hsv
    
    def _calculate_ps_saturation_factor(self, sat_shift):
        """计算PS风格的饱和度调整因子"""
        if sat_shift == 0:
            return 1.0
        elif sat_shift > 0:
            # 正向调整：使用指数曲线，避免过度饱和
            return 1.0 + (sat_shift / 100.0) * 2.0
        else:
            # 负向调整：当saturation为-100时，应该完全去除饱和度
            return max(0.0, 1.0 + (sat_shift / 100.0))
    
    def _apply_ps_lightness_adjustment(self, values, light_shift):
        """应用PS风格的明度调整"""
        if light_shift == 0:
            return values
        
        # 将值规范化到0-1范围
        normalized = values / 255.0
        
        if light_shift > 0:
            # 提亮：使用幂函数保护高光
            power = 1.0 - (light_shift / 100.0) * 0.5
            adjusted = np.power(normalized, power)
        else:
            # 变暗：使用反向幂函数保护阴影
            power = 1.0 + (abs(light_shift) / 100.0) * 0.5
            adjusted = np.power(normalized, power)
        
        # 转换回0-255范围并确保在有效范围内
        return np.clip(adjusted * 255.0, 0, 255)