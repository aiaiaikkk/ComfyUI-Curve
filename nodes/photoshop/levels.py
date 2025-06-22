"""
Photoshop风格色阶调整节点

提供与Adobe Photoshop色阶调整工具类似的功能：
- RGB、红、绿、蓝、亮度通道独立调整
- 输入/输出黑点白点控制
- 中间调伽马校正
- 自动色阶和自动对比度
- 直方图分析和预览
"""

import torch
import numpy as np
from PIL import Image
import io
import base64

from ..core.base_node import BaseImageNode
from ..core.mask_utils import apply_mask_to_image, blur_mask


class PhotoshopLevelsNode(BaseImageNode):
    """PS风格的色阶调整节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'channel': (['RGB', 'R', 'G', 'B', 'Luminance'], {'default': 'RGB'}),
            },
            'optional': {
                'input_black': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 254.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '输入黑场点 (0-254)'
                }),
                'input_midtones': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.1,
                    'max': 9.99,
                    'step': 0.01,
                    'display': 'number',
                    'tooltip': '输入中间调 (0.1-9.99，1.0为中性，<1.0变暗，>1.0变亮)'
                }),
                'input_white': ('FLOAT', {
                    'default': 255.0,
                    'min': 1.0,
                    'max': 255.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '输入白场点 (1-255)'
                }),
                'output_black': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 254.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '输出黑场点 (0-254)'
                }),
                'output_white': ('FLOAT', {
                    'default': 255.0,
                    'min': 1.0,
                    'max': 255.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '输出白场点 (1-255)'
                }),
                'auto_levels': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '自动色阶调整'
                }),
                'auto_contrast': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '自动对比度调整'
                }),
                'clip_percentage': ('FLOAT', {
                    'default': 0.1,
                    'min': 0.0,
                    'max': 5.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '自动调整时的裁剪百分比'
                }),
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
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('IMAGE',)
    RETURN_NAMES = ('image',)
    FUNCTION = 'apply_levels_adjustment'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, image, channel, input_black=0.0, input_midtones=1.0, input_white=255.0, 
                   output_black=0.0, output_white=255.0, auto_levels=False, auto_contrast=False, 
                   clip_percentage=0.1, mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        mask_hash = "none" if mask is None else str(hash(mask.data.tobytes()) if hasattr(mask, 'data') else hash(str(mask)))
        return f"{channel}_{input_black}_{input_white}_{input_midtones}_{output_black}_{output_white}_{auto_levels}_{auto_contrast}_{clip_percentage}_{mask_hash}_{mask_blur}_{invert_mask}"

    def apply_levels_adjustment(self, image, channel, input_black=0.0, input_midtones=1.0, input_white=255.0,
                               output_black=0.0, output_white=255.0, auto_levels=False, auto_contrast=False,
                               clip_percentage=0.1, mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        try:
            # 确保输入图像格式正确
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端（仅当有unique_id时）
            if unique_id is not None:
                levels_data = {
                    "channel": channel,
                    "input_black": input_black,
                    "input_white": input_white,
                    "input_midtones": input_midtones,
                    "output_black": output_black,
                    "output_white": output_white,
                    "auto_levels": auto_levels,
                    "auto_contrast": auto_contrast,
                    "clip_percentage": clip_percentage
                }
                self.send_preview_to_frontend(image, unique_id, "photoshop_levels_preview", mask, levels_data)
            
            # 支持批处理
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image,
                    self._process_single_image,
                    channel, input_black, input_midtones, input_white,
                    output_black, output_white, auto_levels, auto_contrast, clip_percentage,
                    mask, mask_blur, invert_mask
                ),)
            else:
                result = self._process_single_image(
                    image, channel, input_black, input_midtones, input_white,
                    output_black, output_white, auto_levels, auto_contrast, clip_percentage,
                    mask, mask_blur, invert_mask
                )
                return (result,)
                
        except Exception as e:
            print(f"PhotoshopLevelsNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image, channel, input_black, input_midtones, input_white, 
                             output_black, output_white, auto_levels, auto_contrast, clip_percentage,
                             mask, mask_blur, invert_mask):
        """处理单张图像的色阶调整"""
        
        device = image.device
        
        # 将图像转换为0-255范围用于直方图分析
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 应用自动调整（如果启用）
        if auto_levels or auto_contrast:
            input_black, input_white, input_midtones = self._calculate_auto_levels(
                img_255, channel, auto_levels, auto_contrast, clip_percentage
            )
        
        # 应用色阶调整
        result = self._apply_levels_adjustment(
            image, channel, input_black, input_white, input_midtones, output_black, output_white
        )
        
        # 应用遮罩
        if mask is not None:
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _calculate_auto_levels(self, img_255, channel, auto_levels, auto_contrast, clip_percentage):
        """计算自动色阶参数"""
        # 将裁剪百分比转换为0-1范围
        clip = clip_percentage / 100.0
        
        if channel == 'RGB':
            # 对RGB三个通道分别计算
            r_min, r_max = self._calculate_channel_range(img_255[..., 0], clip, auto_levels, auto_contrast)
            g_min, g_max = self._calculate_channel_range(img_255[..., 1], clip, auto_levels, auto_contrast)
            b_min, b_max = self._calculate_channel_range(img_255[..., 2], clip, auto_levels, auto_contrast)
            
            # 取三个通道的平均值或极值
            if auto_levels:
                # 自动色阶：每个通道独立调整
                min_val = (r_min + g_min + b_min) / 3
                max_val = (r_max + g_max + b_max) / 3
            else:
                # 自动对比度：使用极值
                min_val = min(r_min, g_min, b_min)
                max_val = max(r_max, g_max, b_max)
        
        elif channel == 'Luminance':
            # 计算亮度通道
            if img_255.shape[2] >= 3:
                luminance = (img_255[..., 0] * 0.299 + 
                           img_255[..., 1] * 0.587 + 
                           img_255[..., 2] * 0.114)
                min_val, max_val = self._calculate_channel_range(luminance, clip, auto_levels, auto_contrast)
            else:
                min_val, max_val = self._calculate_channel_range(img_255[..., 0], clip, auto_levels, auto_contrast)
        
        else:
            # 单通道
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            if channel_idx < img_255.shape[2]:
                min_val, max_val = self._calculate_channel_range(img_255[..., channel_idx], clip, auto_levels, auto_contrast)
            else:
                min_val, max_val = 0, 255
        
        # 确保有效范围
        min_val = max(0, min(254, min_val))
        max_val = max(min_val + 1, min(255, max_val))
        
        # 返回计算的参数
        return min_val, max_val, 1.0  # 伽马值保持为1.0
    
    def _calculate_channel_range(self, channel_data, clip, auto_levels, auto_contrast):
        """计算通道的范围"""
        # 转换为numpy数组
        data = channel_data.cpu().numpy().flatten()
        
        # 计算直方图
        hist, bins = np.histogram(data, bins=256, range=(0, 255))
        
        # 计算累积分布
        cdf = hist.cumsum()
        cdf = cdf / cdf[-1]  # 归一化
        
        # 计算裁剪点
        min_val = bins[np.argwhere(cdf >= clip)[0, 0]]
        max_val = bins[np.argwhere(cdf >= (1 - clip))[0, 0]]
        
        return min_val, max_val
    
    def _apply_levels_adjustment(self, image, channel, input_black, input_white, input_midtones, output_black, output_white):
        """应用色阶调整"""
        device = image.device
        
        # 将图像转换为0-255范围
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 确保参数有效
        input_black = max(0, min(254, input_black))
        input_white = max(input_black + 1, min(255, input_white))
        output_black = max(0, min(254, output_black))
        output_white = max(output_black + 1, min(255, output_white))
        input_midtones = max(0.1, min(9.99, input_midtones))
        
        # 应用色阶调整
        if channel == 'RGB':
            # 对所有通道应用
            result = torch.zeros_like(img_255)
            for c in range(min(3, img_255.shape[2])):
                result[..., c] = self._apply_levels_to_channel(
                    img_255[..., c], input_black, input_midtones, input_white, output_black, output_white
                )
            # 如果有alpha通道，保持不变
            if img_255.shape[2] > 3:
                result[..., 3:] = img_255[..., 3:]
        elif channel == 'Luminance':
            # 对亮度应用调整，保持色彩
            if img_255.shape[2] >= 3:
                # 转换到HSV空间
                result = self._adjust_luminance_only(img_255, input_black, input_midtones, input_white, output_black, output_white)
            else:
                result = self._apply_levels_to_channel(
                    img_255[..., 0], input_black, input_midtones, input_white, output_black, output_white
                ).unsqueeze(-1)
        else:
            # 对单个通道应用
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            result = img_255.clone()
            if channel_idx < img_255.shape[2]:
                result[..., channel_idx] = self._apply_levels_to_channel(
                    img_255[..., channel_idx], input_black, input_midtones, input_white, output_black, output_white
                )
        
        # 转换回0-1范围
        result = (result / 255.0).clamp(0, 1)
        
        return result
    
    def _apply_levels_to_channel(self, channel_data, input_black, input_midtones, input_white, output_black, output_white):
        """对单个通道应用色阶调整"""
        # 输入范围调整
        normalized = (channel_data - input_black) / (input_white - input_black)
        normalized = torch.clamp(normalized, 0, 1)
        
        # 伽马校正
        gamma_corrected = torch.pow(normalized, 1.0 / input_midtones)
        
        # 输出范围调整
        result = gamma_corrected * (output_white - output_black) + output_black
        
        return torch.clamp(result, 0, 255)
    
    def _adjust_luminance_only(self, img_255, input_black, input_midtones, input_white, output_black, output_white):
        """仅调整亮度，保持色彩"""
        # 转换到HSV空间进行亮度调整
        rgb = img_255 / 255.0
        
        # 简化的RGB到HSV转换（仅处理V通道）
        max_vals, _ = torch.max(rgb, dim=2, keepdim=True)
        min_vals, _ = torch.min(rgb, dim=2, keepdim=True)
        
        # 调整V通道（亮度）
        v_channel = max_vals.squeeze(-1) * 255.0
        adjusted_v = self._apply_levels_to_channel(v_channel, input_black, input_midtones, input_white, output_black, output_white)
        adjusted_v = adjusted_v / 255.0
        
        # 计算调整比例
        adjustment_ratio = torch.where(max_vals.squeeze(-1) > 0, adjusted_v / max_vals.squeeze(-1), torch.ones_like(adjusted_v))
        adjustment_ratio = adjustment_ratio.unsqueeze(-1)
        
        # 应用调整比例到RGB
        result = rgb * adjustment_ratio
        result = torch.clamp(result, 0, 1) * 255.0
        
        return result