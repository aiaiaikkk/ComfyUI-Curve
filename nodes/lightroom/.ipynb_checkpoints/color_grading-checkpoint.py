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
from ..core.generic_preset_manager import GenericPresetManager

# 创建Color Grading预设管理器实例
color_grading_preset_manager = GenericPresetManager('color_grading')


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
                    'default': 50.0,  # 修改为与Lightroom一致的默认值
                    'min': 0.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '控制色彩分级效果的混合程度（0-100%，Lightroom默认50）'
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
                           blend=50.0, balance=0.0,
                           blend_mode='normal', overall_strength=1.0,
                           mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        """
        应用色彩分级效果
        """
        # 性能优化：如果所有参数都是默认值且没有遮罩，直接返回原图
        if (shadows_hue == 0 and shadows_saturation == 0 and shadows_luminance == 0 and
            midtones_hue == 0 and midtones_saturation == 0 and midtones_luminance == 0 and
            highlights_hue == 0 and highlights_saturation == 0 and highlights_luminance == 0 and
            blend == 50.0 and balance == 0.0 and blend_mode == 'normal' and overall_strength == 1.0 and
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
        
        # 调试：打印所有参数
        print(f"ColorGrading参数调试:")
        print(f"  阴影: hue={shadows_hue}, sat={shadows_saturation}, lum={shadows_luminance}")
        print(f"  中间调: hue={midtones_hue}, sat={midtones_saturation}, lum={midtones_luminance}")
        print(f"  高光: hue={highlights_hue}, sat={highlights_saturation}, lum={highlights_luminance}")
        print(f"  其他: blend={blend}, balance={balance}, blend_mode={blend_mode}, overall_strength={overall_strength}")
        
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
        
        # 检查是否有实际的调整（包括所有影响参数）
        has_adjustment = (shadows_hue != 0 or shadows_saturation != 0 or shadows_luminance != 0 or
                         midtones_hue != 0 or midtones_saturation != 0 or midtones_luminance != 0 or
                         highlights_hue != 0 or highlights_saturation != 0 or highlights_luminance != 0 or
                         blend != 50.0 or balance != 0.0 or overall_strength != 1.0)
        
        # 如果没有调整且blend_mode是normal且没有遮罩，直接返回原图
        if not has_adjustment and blend_mode == 'normal' and mask is None:
            return image
        
        # 直接在RGB空间工作，完全匹配前端算法
        # 转换为RGB numpy数组
        img_rgb = img_np.copy()
        
        # 使用感知亮度创建遮罩
        luminance = img_rgb[:,:,0] * 0.299 + img_rgb[:,:,1] * 0.587 + img_rgb[:,:,2] * 0.114
        
        # 创建改进的亮度遮罩
        shadows_mask = self._create_improved_luminance_mask(luminance, 'shadows', balance)
        midtones_mask = self._create_improved_luminance_mask(luminance, 'midtones', balance)
        highlights_mask = self._create_improved_luminance_mask(luminance, 'highlights', balance)
        
        # 初始化RGB增量
        delta_r = np.zeros_like(img_rgb[:,:,0])
        delta_g = np.zeros_like(img_rgb[:,:,0])
        delta_b = np.zeros_like(img_rgb[:,:,0])
        
        # 处理每个区域（完全模拟前端算法）
        regions = [
            (shadows_mask, shadows_hue, shadows_saturation, shadows_luminance),
            (midtones_mask, midtones_hue, midtones_saturation, midtones_luminance),
            (highlights_mask, highlights_hue, highlights_saturation, highlights_luminance)
        ]
        
        for mask, hue, sat, lum in regions:
            if hue != 0 or sat != 0:
                # 计算强度（包含overall_strength）
                strength = mask * overall_strength
                
                if sat >= 0:
                    # 正饱和度：添加颜色
                    hue_rad = np.deg2rad(hue)
                    sat_normalized = sat / 100.0
                    
                    # 模拟前端的Lab偏移计算（增强到匹配Lightroom强度）
                    max_offset = 0.7
                    offset_a = np.cos(hue_rad) * sat_normalized * max_offset
                    offset_b = np.sin(hue_rad) * sat_normalized * max_offset
                    
                    # 应用颜色敏感度调整（完全匹配前端）
                    # 将负角度转换为正角度
                    hue_normalized = hue % 360
                    if (hue_normalized >= 330) or (hue_normalized <= 30):  # 红色区域 (330-360, 0-30)
                        offset_a *= 1.1
                    elif 150 <= hue_normalized <= 210:  # 青色区域
                        offset_a *= 0.9
                    elif 60 <= hue_normalized <= 120:  # 绿色区域
                        offset_b *= 0.95
                    elif 240 <= hue_normalized <= 300:  # 蓝色区域
                        offset_b *= 1.05
                    
                    # 将Lab偏移转换为RGB调整（完全匹配前端的权重）
                    delta_r += (offset_a * 0.6 + offset_b * 0.3) * strength
                    delta_g += (-offset_a * 0.5 + offset_b * 0.2) * strength
                    delta_b += (-offset_a * 0.1 - offset_b * 0.8) * strength
                    
                else:
                    # 负饱和度：朝向灰度混合
                    desat_strength = abs(sat) / 100.0 * strength
                    
                    # 计算灰度值
                    gray = img_rgb[:,:,0] * 0.299 + img_rgb[:,:,1] * 0.587 + img_rgb[:,:,2] * 0.114
                    
                    # 朝向灰度混合
                    delta_r += (gray - img_rgb[:,:,0]) * desat_strength
                    delta_g += (gray - img_rgb[:,:,1]) * desat_strength
                    delta_b += (gray - img_rgb[:,:,2]) * desat_strength
            
            # 亮度调整
            if lum != 0:
                lum_factor = lum / 100.0 * mask * overall_strength
                lum_adjust = lum_factor * 0.2  # 降低强度以获得更自然的效果
                delta_r += lum_adjust
                delta_g += lum_adjust
                delta_b += lum_adjust
        
        # 应用调整（不裁剪，允许负值和超过1的值）
        result_rgb = np.zeros_like(img_rgb)
        result_rgb[:,:,0] = img_rgb[:,:,0] + delta_r
        result_rgb[:,:,1] = img_rgb[:,:,1] + delta_g
        result_rgb[:,:,2] = img_rgb[:,:,2] + delta_b
        
        # 应用blend参数
        if blend < 100.0:
            blend_factor = blend / 100.0
            result_rgb = img_rgb * (1.0 - blend_factor) + result_rgb * blend_factor
        
        # 在最后才裁剪到有效范围
        result_rgb = np.clip(result_rgb, 0, 1)
        
        # 转换为tensor
        result = torch.from_numpy(result_rgb.astype(np.float32)).to(device)
        
        # 恢复Alpha通道
        if has_alpha:
            alpha_tensor = torch.from_numpy(alpha_channel).to(device).unsqueeze(-1)
            result = torch.cat([result, alpha_tensor], dim=-1)
        
        # 应用混合模式
        if blend_mode != 'normal':
            result = self._apply_blend_mode(image, result, blend_mode)
        
        # 应用遮罩
        if mask is not None:
            # 确保mask是tensor
            if not isinstance(mask, torch.Tensor):
                mask = torch.from_numpy(mask).to(device)
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _create_improved_luminance_mask(self, luminance, region, balance):
        """创建改进的亮度遮罩 - 完全匹配前端的Sigmoid算法"""
        balance_normalized = balance / 100.0  # -1.0 to 1.0
        
        if region == 'shadows':
            # 使用Sigmoid函数（与前端完全一致）
            threshold = 0.25 + balance_normalized * 0.2  # 0.05 to 0.45
            transition = 0.15
            mask = 1 / (1 + np.exp(-(threshold - luminance) / transition))
            
        elif region == 'highlights':
            # 使用Sigmoid函数（与前端完全一致）
            threshold = 0.75 - balance_normalized * 0.2  # 0.55 to 0.95
            transition = 0.15
            mask = 1 / (1 + np.exp(-(luminance - threshold) / transition))
            
        else:  # midtones
            # 使用高斯函数（与前端完全一致）
            center = 0.5 + balance_normalized * 0.1  # 0.4 to 0.6
            width = 0.35
            mask = np.exp(-0.5 * ((luminance - center) / width) ** 2) * 1.2
        
        # 确保遮罩值在0-1范围内
        return np.clip(mask, 0, 1)
    
    
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