"""
Lightroom风格色彩分级节点

提供与Adobe Lightroom类似的色彩分级功能：
- 阴影、中间调、高光的独立色彩调整
- 支持色相、饱和度、明度调整
- 混合和平衡控制
- 多种混合模式
- 遮罩支持
"""

import torch
import numpy as np
import cv2
from PIL import Image
import io
import base64

from ..core.base_node import BaseImageNode
from ..core.mask_utils import apply_mask_to_image, blur_mask


class ColorGradingNode(BaseImageNode):
    """
    Color Grading节点 - 实现Lightroom风格的色彩分级功能
    支持阴影、中间调、高光的独立色彩调整
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                # 阴影控制
                'shadows_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -180.0,
                    'max': 180.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '阴影区域色相偏移（-180到180度）'
                }),
                'shadows_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '阴影区域饱和度调整（-100到100%）'
                }),
                'shadows_luminance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '阴影区域明度调整（-100到100%）'
                }),
                # 中间调控制
                'midtones_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -180.0,
                    'max': 180.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '中间调区域色相偏移（-180到180度）'
                }),
                'midtones_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '中间调区域饱和度调整（-100到100%）'
                }),
                'midtones_luminance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '中间调区域明度调整（-100到100%）'
                }),
                # 高光控制
                'highlights_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -180.0,
                    'max': 180.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '高光区域色相偏移（-180到180度）'
                }),
                'highlights_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '高光区域饱和度调整（-100到100%）'
                }),
                'highlights_luminance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '高光区域明度调整（-100到100%）'
                }),
                # 混合控制 (Blend)
                'blend': ('FLOAT', {
                    'default': 100.0,
                    'min': 0.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '控制色彩分级效果的混合程度（0-100%）'
                }),
                # 平衡控制 (Balance)
                'balance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '控制阴影与高光之间的平衡点（-100=偏向阴影，0=中间，100=偏向高光）'
                }),
                # 混合模式
                'blend_mode': (['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn'], {
                    'default': 'normal',
                    'tooltip': '色彩分级的混合模式'
                }),
                # 整体强度
                'overall_strength': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.0,
                    'max': 2.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '色彩分级的整体强度'
                }),
            },
            'optional': {
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，色彩分级仅对遮罩区域有效'
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
    FUNCTION = 'apply_color_grading'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # 创建所有参数的缓存键
        cache_params = []
        for key, value in kwargs.items():
            if key != 'unique_id':
                if hasattr(value, 'data'):
                    cache_params.append(f"{key}:{hash(value.data.tobytes())}")
                else:
                    cache_params.append(f"{key}:{value}")
        return "_".join(cache_params)
    
    def apply_color_grading(self, image, 
                           shadows_hue=0.0, shadows_saturation=0.0, shadows_luminance=0.0,
                           midtones_hue=0.0, midtones_saturation=0.0, midtones_luminance=0.0,
                           highlights_hue=0.0, highlights_saturation=0.0, highlights_luminance=0.0,
                           blend=100.0, balance=0.0,
                           blend_mode='normal', overall_strength=1.0,
                           mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        """
        应用色彩分级效果
        """
        # 性能优化：如果所有参数都是默认值且没有遮罩，直接返回原图
        if (shadows_hue == 0 and shadows_saturation == 0 and shadows_luminance == 0 and
            midtones_hue == 0 and midtones_saturation == 0 and midtones_luminance == 0 and
            highlights_hue == 0 and highlights_saturation == 0 and highlights_luminance == 0 and
            mask is None):
            return (image,)
        
        try:
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端
            if unique_id is not None:
                grading_data = {
                    "shadows": {"hue": shadows_hue, "saturation": shadows_saturation, "luminance": shadows_luminance},
                    "midtones": {"hue": midtones_hue, "saturation": midtones_saturation, "luminance": midtones_luminance},
                    "highlights": {"hue": highlights_hue, "saturation": highlights_saturation, "luminance": highlights_luminance},
                    "blend": blend,
                    "balance": balance,
                    "blend_mode": blend_mode,
                    "overall_strength": overall_strength
                }
                self._send_color_grading_preview(image, unique_id, mask, grading_data)
            
            # 处理图像
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image, 
                    self._process_single_image,
                    shadows_hue, shadows_saturation, shadows_luminance,
                    midtones_hue, midtones_saturation, midtones_luminance,
                    highlights_hue, highlights_saturation, highlights_luminance,
                    blend, balance, blend_mode, overall_strength,
                    mask, mask_blur, invert_mask
                ),)
            else:
                # 单张图像
                result = self._process_single_image(
                    image,
                    shadows_hue, shadows_saturation, shadows_luminance,
                    midtones_hue, midtones_saturation, midtones_luminance,
                    highlights_hue, highlights_saturation, highlights_luminance,
                    blend, balance, blend_mode, overall_strength,
                    mask, mask_blur, invert_mask
                )
                return (result,)
                
        except Exception as e:
            print(f"ColorGradingNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _send_color_grading_preview(self, image, unique_id, mask, grading_data):
        """发送色彩分级预览数据到前端"""
        try:
            # 使用第一张图像进行预览
            preview_image = image[0] if image.dim() == 4 else image
            
            # 转换为PIL图像
            img_np = (preview_image.cpu().numpy() * 255).astype(np.uint8)
            if img_np.shape[-1] == 3:
                pil_img = Image.fromarray(img_np, mode='RGB')
            elif img_np.shape[-1] == 4:
                pil_img = Image.fromarray(img_np, mode='RGBA')
            else:
                pil_img = Image.fromarray(img_np[:,:,0], mode='L')
            
            # 转换为base64
            buffer = io.BytesIO()
            pil_img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            # 准备发送数据
            send_data = {
                "node_id": str(unique_id),
                "image": f"data:image/png;base64,{img_base64}",
                "grading_data": grading_data
            }
            
            # 处理遮罩
            if mask is not None:
                try:
                    # 获取第一个遮罩用于预览
                    preview_mask = mask[0] if mask.dim() == 3 else mask
                    
                    # 确保遮罩是2D的
                    if preview_mask.dim() > 2:
                        preview_mask = preview_mask.squeeze()
                    
                    # 转换遮罩为PIL图像
                    mask_np = (preview_mask.cpu().numpy() * 255).astype(np.uint8)
                    pil_mask = Image.fromarray(mask_np, mode='L')
                    
                    # 转换为base64
                    mask_buffer = io.BytesIO()
                    pil_mask.save(mask_buffer, format='PNG')
                    mask_base64 = base64.b64encode(mask_buffer.getvalue()).decode('utf-8')
                    
                    send_data["mask"] = f"data:image/png;base64,{mask_base64}"
                except Exception as mask_error:
                    print(f"处理色彩分级遮罩时出错: {mask_error}")
            
            # 发送事件到前端
            try:
                from server import PromptServer
                PromptServer.instance.send_sync("color_grading_preview", send_data)
                print(f"✅ 已发送色彩分级预览数据到前端，节点ID: {unique_id}")
            except ImportError:
                print("PromptServer不可用，跳过前端预览")
            
        except Exception as preview_error:
            print(f"发送色彩分级预览时出错: {preview_error}")
    
    def _process_single_image(self, image,
                             shadows_hue, shadows_saturation, shadows_luminance,
                             midtones_hue, midtones_saturation, midtones_luminance,
                             highlights_hue, highlights_saturation, highlights_luminance,
                             blend, balance, blend_mode, overall_strength,
                             mask, mask_blur, invert_mask):
        """处理单张图像的色彩分级 - 使用更接近Lightroom的算法"""
        
        device = image.device
        
        # 将图像转换为numpy数组，范围0-1（保持精度）
        img_np = image.detach().cpu().numpy()
        
        # 处理Alpha通道
        has_alpha = False
        alpha_channel = None
        
        if img_np.shape[2] == 4:  # RGBA图像
            has_alpha = True
            alpha_channel = img_np[:,:,3]
            img_np = img_np[:,:,:3]  # 只保留RGB通道
        
        # 检查是否有实际的调整
        has_adjustment = (shadows_hue != 0 or shadows_saturation != 0 or shadows_luminance != 0 or
                         midtones_hue != 0 or midtones_saturation != 0 or midtones_luminance != 0 or
                         highlights_hue != 0 or highlights_saturation != 0 or highlights_luminance != 0)
        
        # 如果没有调整且blend_mode是normal，直接返回原图
        if not has_adjustment and blend_mode == 'normal' and mask is None:
            return image
        
        # 转换为Lab色彩空间（更接近人眼感知，Lightroom使用的色彩空间）
        img_bgr = cv2.cvtColor((img_np * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        img_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        
        # 修复OpenCV Lab值范围问题
        l_max = np.max(img_lab[:,:,0])
        if l_max > 100:
            # OpenCV返回的是0-255范围的L通道
            img_lab[:,:,0] = img_lab[:,:,0] / 255.0  # L: 0-255 -> 0-1
            img_lab[:,:,1] = img_lab[:,:,1] / 255.0  # a: 0-255 -> 0-1
            img_lab[:,:,2] = img_lab[:,:,2] / 255.0  # b: 0-255 -> 0-1
        else:
            # 标准Lab格式：L: 0-100, a/b: -128-127
            img_lab[:,:,0] = img_lab[:,:,0] / 100.0  # L: 0-100 -> 0-1
            img_lab[:,:,1] = (img_lab[:,:,1] + 128.0) / 255.0  # a: -128-127 -> 0-1
            img_lab[:,:,2] = (img_lab[:,:,2] + 128.0) / 255.0  # b: -128-127 -> 0-1
        
        # 使用L通道（亮度）创建更精确的遮罩
        luminance = img_lab[:,:,0]
        
        # 创建改进的亮度遮罩
        shadows_mask = self._create_improved_luminance_mask(luminance, 'shadows', balance)
        midtones_mask = self._create_improved_luminance_mask(luminance, 'midtones', balance)
        highlights_mask = self._create_improved_luminance_mask(luminance, 'highlights', balance)
        
        # 保存原始亮度（重要：保持亮度不变）
        original_luminance = img_lab[:,:,0].copy()
        
        # 应用色彩分级到Lab空间的a和b通道
        result_lab = img_lab.copy()
        
        # 应用各区域的色彩调整
        result_lab = self._apply_region_adjustment(
            result_lab, shadows_mask, shadows_hue, shadows_saturation, shadows_luminance, 'shadows'
        )
        result_lab = self._apply_region_adjustment(
            result_lab, midtones_mask, midtones_hue, midtones_saturation, midtones_luminance, 'midtones'
        )
        result_lab = self._apply_region_adjustment(
            result_lab, highlights_mask, highlights_hue, highlights_saturation, highlights_luminance, 'highlights'
        )
        
        # 保持原始亮度（如果没有明度调整）
        if shadows_luminance == 0 and midtones_luminance == 0 and highlights_luminance == 0:
            result_lab[:,:,0] = original_luminance
        
        # 应用整体强度和混合
        if overall_strength != 1.0:
            result_lab[:,:,1] = img_lab[:,:,1] + (result_lab[:,:,1] - img_lab[:,:,1]) * overall_strength
            result_lab[:,:,2] = img_lab[:,:,2] + (result_lab[:,:,2] - img_lab[:,:,2]) * overall_strength
        
        if blend != 100.0:
            blend_factor = blend / 100.0
            result_lab[:,:,1] = img_lab[:,:,1] + (result_lab[:,:,1] - img_lab[:,:,1]) * blend_factor
            result_lab[:,:,2] = img_lab[:,:,2] + (result_lab[:,:,2] - img_lab[:,:,2]) * blend_factor
        
        # 转换回RGB
        result_lab_cv = result_lab.copy()
        if l_max > 100:
            # 转换回OpenCV期望的0-255范围
            result_lab_cv[:,:,0] = result_lab_cv[:,:,0] * 255.0
            result_lab_cv[:,:,1] = result_lab_cv[:,:,1] * 255.0
            result_lab_cv[:,:,2] = result_lab_cv[:,:,2] * 255.0
        else:
            # 转换回标准Lab范围
            result_lab_cv[:,:,0] = result_lab_cv[:,:,0] * 100.0
            result_lab_cv[:,:,1] = result_lab_cv[:,:,1] * 255.0 - 128.0
            result_lab_cv[:,:,2] = result_lab_cv[:,:,2] * 255.0 - 128.0
        
        # 限制Lab值在有效范围内
        result_lab_cv = np.clip(result_lab_cv, 0, 255)
        
        # 转换回RGB
        result_bgr = cv2.cvtColor(result_lab_cv.astype(np.uint8), cv2.COLOR_LAB2BGR)
        result_rgb = cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)
        
        # 转换为tensor
        result = torch.from_numpy(result_rgb.astype(np.float32) / 255.0).to(device)
        
        # 恢复Alpha通道
        if has_alpha:
            alpha_tensor = torch.from_numpy(alpha_channel).to(device).unsqueeze(-1)
            result = torch.cat([result, alpha_tensor], dim=-1)
        
        # 应用混合模式
        if blend_mode != 'normal':
            result = self._apply_blend_mode(image, result, blend_mode)
        
        # 应用遮罩
        if mask is not None:
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _create_improved_luminance_mask(self, luminance, region, balance):
        """创建改进的亮度遮罩"""
        balance_factor = balance / 100.0
        
        if region == 'shadows':
            # 阴影：0-0.3的亮度范围，平衡控制向高光偏移
            center = 0.15 + balance_factor * 0.1
            mask = np.exp(-((luminance - center) / 0.15) ** 2)
            mask = np.where(luminance < center + 0.2, mask, 0)
            
        elif region == 'midtones':
            # 中间调：0.2-0.8的亮度范围，平衡控制影响中心点
            center = 0.5 + balance_factor * 0.2
            mask = np.exp(-((luminance - center) / 0.25) ** 2)
            
        else:  # highlights
            # 高光：0.7-1.0的亮度范围，平衡控制向阴影偏移
            center = 0.85 - balance_factor * 0.1
            mask = np.exp(-((luminance - center) / 0.15) ** 2)
            mask = np.where(luminance > center - 0.2, mask, 0)
        
        # 确保遮罩值在0-1范围内
        return np.clip(mask, 0, 1)
    
    def _apply_region_adjustment(self, lab_img, mask, hue_shift, sat_shift, lum_shift, region_name):
        """应用区域调整到Lab图像"""
        if hue_shift == 0 and sat_shift == 0 and lum_shift == 0:
            return lab_img
        
        result = lab_img.copy()
        
        # 明度调整
        if lum_shift != 0:
            lum_factor = 1.0 + lum_shift / 100.0
            result[:,:,0] = result[:,:,0] * (1.0 + (lum_factor - 1.0) * mask[:,:,np.newaxis] if mask.ndim == 2 else mask)
        
        # 色相和饱和度调整
        if hue_shift != 0 or sat_shift != 0:
            # 将a, b通道转换为极坐标（色相、饱和度）
            a = result[:,:,1] - 0.5  # 中心化
            b = result[:,:,2] - 0.5
            
            # 计算当前的色相和饱和度
            current_hue = np.arctan2(b, a)
            current_sat = np.sqrt(a**2 + b**2)
            
            # 应用调整
            if hue_shift != 0:
                hue_rad = np.deg2rad(hue_shift)
                new_hue = current_hue + hue_rad * mask
            else:
                new_hue = current_hue
            
            if sat_shift != 0:
                sat_factor = 1.0 + sat_shift / 100.0
                new_sat = current_sat * (1.0 + (sat_factor - 1.0) * mask)
            else:
                new_sat = current_sat
            
            # 转换回笛卡尔坐标
            new_a = new_sat * np.cos(new_hue) + 0.5
            new_b = new_sat * np.sin(new_hue) + 0.5
            
            result[:,:,1] = new_a
            result[:,:,2] = new_b
        
        return result
    
    def _apply_blend_mode(self, base, overlay, mode):
        """应用混合模式"""
        if mode == 'normal':
            return overlay
        elif mode == 'multiply':
            return base * overlay
        elif mode == 'screen':
            return 1.0 - (1.0 - base) * (1.0 - overlay)
        elif mode == 'overlay':
            return torch.where(base < 0.5, 2 * base * overlay, 1.0 - 2 * (1.0 - base) * (1.0 - overlay))
        elif mode == 'soft_light':
            return torch.where(overlay < 0.5, 
                              2 * base * overlay + base**2 * (1.0 - 2 * overlay),
                              2 * base * (1.0 - overlay) + torch.sqrt(base) * (2 * overlay - 1.0))
        elif mode == 'hard_light':
            return torch.where(overlay < 0.5, 2 * base * overlay, 1.0 - 2 * (1.0 - base) * (1.0 - overlay))
        elif mode == 'color_dodge':
            return torch.where(overlay >= 1.0, overlay, base / (1.0 - overlay + 1e-8))
        elif mode == 'color_burn':
            return torch.where(overlay <= 0.0, overlay, 1.0 - (1.0 - base) / (overlay + 1e-8))
        else:
            return overlay