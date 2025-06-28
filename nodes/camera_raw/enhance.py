"""
Camera Raw增强节点

提供与Adobe Camera Raw类似的图像增强功能：
- 纹理增强：增强中等大小细节的对比度
- 清晰度调整：增强中间调对比度
- 去薄雾效果：减少或增加大气雾霾效果
- 混合控制和整体强度调节
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

# 创建Camera Raw预设管理器实例
camera_raw_preset_manager = GenericPresetManager('camera_raw')


class CameraRawEnhanceNode(BaseImageNode):
    """Camera Raw增强节点 - 集成纹理、清晰度、去薄雾三个功能"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                
                # === 曝光调整 ===
                'exposure': ('FLOAT', {
                    'default': 0.0,
                    'min': -5.0,
                    'max': 5.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '曝光度调整，控制整体亮度'
                }),
                'highlights': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '高光调整，控制过曝区域'
                }),
                'shadows': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '阴影调整，提亮暗部细节'
                }),
                'whites': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '白色调整，调整白场点'
                }),
                'blacks': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '黑色调整，调整黑场点'
                }),
                
                # === 色彩调整 ===
                'temperature': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '色温调整，控制冷暖色调'
                }),
                'tint': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '色调调整，绿品偏向'
                }),
                'vibrance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '自然饱和度，智能饱和度调整'
                }),
                'saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '饱和度调整，整体饱和度'
                }),
                
                # === 基本调整 ===
                'contrast': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '对比度调整，整体对比度'
                }),
                
                # === 增强功能 ===
                'texture': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '纹理增强，增强中等大小细节的对比度'
                }),
                'clarity': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '清晰度调整，增强中间调对比度'
                }),
                'dehaze': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '去薄雾效果，减少或增加大气雾霾'
                }),
                
                # === 混合控制 ===
                'blend': ('FLOAT', {
                    'default': 100.0,
                    'min': 0.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '控制增强效果的混合程度（0-100%）'
                }),
                'overall_strength': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.0,
                    'max': 2.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '增强效果的整体强度'
                }),
            },
            'optional': {
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，增强效果仅对遮罩区域有效'
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
    FUNCTION = 'apply_camera_raw_enhance'
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
    
    def apply_camera_raw_enhance(self, image, 
                                # 曝光调整
                                exposure=0.0, highlights=0.0, shadows=0.0, whites=0.0, blacks=0.0,
                                # 色彩调整  
                                temperature=0.0, tint=0.0, vibrance=0.0, saturation=0.0,
                                # 基本调整
                                contrast=0.0,
                                # 增强功能
                                texture=0.0, clarity=0.0, dehaze=0.0,
                                # 混合控制
                                blend=100.0, overall_strength=1.0,
                                # 遮罩
                                mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        """应用Camera Raw增强效果"""
        # 性能优化：如果所有参数都是默认值且没有遮罩，直接返回原图
        all_params_default = (
            exposure == 0 and highlights == 0 and shadows == 0 and whites == 0 and blacks == 0 and
            temperature == 0 and tint == 0 and vibrance == 0 and saturation == 0 and
            contrast == 0 and texture == 0 and clarity == 0 and dehaze == 0
        )
        if all_params_default and mask is None:
            return (image,)
        
        try:
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端
            if unique_id is not None:
                enhance_data = {
                    # 曝光调整
                    "exposure": exposure, "highlights": highlights, "shadows": shadows, 
                    "whites": whites, "blacks": blacks,
                    # 色彩调整
                    "temperature": temperature, "tint": tint, "vibrance": vibrance, "saturation": saturation,
                    # 基本调整
                    "contrast": contrast,
                    # 增强功能
                    "texture": texture, "clarity": clarity, "dehaze": dehaze,
                    # 混合控制
                    "blend": blend, "overall_strength": overall_strength
                }
                self.send_preview_to_frontend(image, unique_id, "camera_raw_enhance_preview", mask)
            
            # 支持批处理
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image,
                    self._process_single_image,
                    exposure, highlights, shadows, whites, blacks,
                    temperature, tint, vibrance, saturation,
                    contrast, texture, clarity, dehaze, blend, overall_strength,
                    mask, mask_blur, invert_mask
                ),)
            else:
                result = self._process_single_image(
                    image, exposure, highlights, shadows, whites, blacks,
                    temperature, tint, vibrance, saturation,
                    contrast, texture, clarity, dehaze, blend, overall_strength,
                    mask, mask_blur, invert_mask
                )
                return (result,)
            
        except Exception as e:
            print(f"CameraRawEnhanceNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image, 
                             exposure, highlights, shadows, whites, blacks,
                             temperature, tint, vibrance, saturation,
                             contrast, texture, clarity, dehaze, blend, overall_strength,
                             mask, mask_blur, invert_mask):
        """处理单张图像的Camera Raw增强"""
        device = image.device
        
        # 转换为numpy进行处理
        img_np = image.detach().cpu().numpy()
        
        # 保存原始图像
        original = img_np.copy()
        
        # 检查是否需要处理
        needs_processing = (
            exposure != 0 or highlights != 0 or shadows != 0 or whites != 0 or blacks != 0 or
            temperature != 0 or tint != 0 or vibrance != 0 or saturation != 0 or
            contrast != 0 or texture != 0 or clarity != 0 or dehaze != 0 or
            overall_strength != 1.0 or blend < 100.0
        )
        
        if not needs_processing and mask is None:
            return image
        
        # === 第一步：曝光调整 ===
        if exposure != 0:
            img_np = self._apply_exposure(img_np, exposure)
        
        if highlights != 0:
            img_np = self._apply_highlights(img_np, highlights)
        
        if shadows != 0:
            img_np = self._apply_shadows(img_np, shadows)
        
        if whites != 0:
            img_np = self._apply_whites(img_np, whites)
        
        if blacks != 0:
            img_np = self._apply_blacks(img_np, blacks)
        
        # === 第二步：色彩调整 ===
        if temperature != 0 or tint != 0:
            img_np = self._apply_white_balance(img_np, temperature, tint)
        
        if vibrance != 0:
            img_np = self._apply_vibrance(img_np, vibrance)
        
        if saturation != 0:
            img_np = self._apply_saturation(img_np, saturation)
        
        # === 第三步：基本调整 ===
        if contrast != 0:
            img_np = self._apply_contrast(img_np, contrast)
        
        # === 第四步：增强功能（保持原有算法不变）===
        if texture != 0:
            img_np = self._apply_texture(img_np, texture)
        
        if clarity != 0:
            img_np = self._apply_clarity(img_np, clarity)
        
        if dehaze != 0:
            img_np = self._apply_dehaze(img_np, dehaze)
        
        # 应用整体强度
        if overall_strength != 1.0:
            img_np = original * (1 - overall_strength) + img_np * overall_strength
        
        # 应用混合
        if blend < 100.0:
            blend_factor = blend / 100.0
            img_np = original * (1 - blend_factor) + img_np * blend_factor
        
        # 确保值在有效范围内
        img_np = np.clip(img_np, 0, 1)
        
        # 转换回tensor
        result = torch.from_numpy(img_np).to(device)
        
        # 应用遮罩
        if mask is not None:
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _apply_texture(self, image, texture_strength):
        """应用纹理增强 - 增强中等大小细节的对比度"""
        # 转换为uint8进行处理
        img_uint8 = (image * 255).astype(np.uint8)
        
        # 创建中等频率的滤波器
        # 使用高斯模糊创建低频版本
        low_freq = cv2.GaussianBlur(img_uint8, (0, 0), sigmaX=2.0, sigmaY=2.0)
        
        # 创建高频版本
        high_freq = cv2.GaussianBlur(img_uint8, (0, 0), sigmaX=0.5, sigmaY=0.5)
        
        # 提取中频细节
        mid_freq = img_uint8.astype(np.float32) - low_freq.astype(np.float32) + 128
        
        # 应用纹理增强
        texture_factor = texture_strength / 100.0
        enhanced = img_uint8.astype(np.float32) + (mid_freq - 128) * texture_factor
        
        # 转换回0-1范围
        enhanced = np.clip(enhanced, 0, 255) / 255.0
        
        return enhanced
    
    def _apply_clarity(self, image, clarity_strength):
        """应用清晰度增强 - 增强中间调对比度"""
        # 转换为uint8进行处理
        img_uint8 = (image * 255).astype(np.uint8)
        
        # 创建模糊版本用于对比
        blurred = cv2.GaussianBlur(img_uint8, (0, 0), sigmaX=10.0, sigmaY=10.0)
        
        # 计算对比度差异
        contrast_diff = img_uint8.astype(np.float32) - blurred.astype(np.float32)
        
        # 应用清晰度增强
        clarity_factor = clarity_strength / 100.0
        enhanced = img_uint8.astype(np.float32) + contrast_diff * clarity_factor
        
        # 转换回0-1范围
        enhanced = np.clip(enhanced, 0, 255) / 255.0
        
        return enhanced
    
    # === 新增的Camera Raw调整算法 ===
    
    def _apply_exposure(self, image, exposure_value):
        """应用曝光调整 - 与PS Camera Raw一致"""
        if exposure_value == 0:
            return image
        
        # 曝光调整使用2的幂次方，与PS一致
        exposure_factor = 2 ** exposure_value
        result = image * exposure_factor
        
        return np.clip(result, 0, 1)
    
    def _apply_highlights(self, image, highlights_value):
        """应用高光调整 - 控制过曝区域，更接近PS Camera Raw"""
        if highlights_value == 0:
            return image
        
        # 计算亮度
        luminance = np.dot(image, [0.299, 0.587, 0.114])
        
        # 创建更精确的高光遮罩，类似PS的处理方式
        # 使用S形曲线确定高光区域
        highlight_threshold = 0.7  # 高光阈值
        highlight_mask = np.zeros_like(luminance)
        
        # 对于高于阈值的区域使用渐变遮罩
        above_threshold = luminance > highlight_threshold
        highlight_mask[above_threshold] = (luminance[above_threshold] - highlight_threshold) / (1.0 - highlight_threshold)
        highlight_mask = np.power(highlight_mask, 1.5)  # 让过渡更平滑
        
        # 扩展到RGB三通道
        highlight_mask = highlight_mask[..., np.newaxis]
        
        # 调整强度，更接近PS的响应曲线
        adjustment = highlights_value / 100.0
        
        if highlights_value < 0:
            # 负值：压制高光，使用更激进的衰减
            factor = np.power(1.0 + adjustment, 1.2)  # 非线性衰减
            result = image * (1 - highlight_mask) + image * factor * highlight_mask
        else:
            # 正值：恢复高光细节，更温和的处理
            factor = 1.0 + adjustment * 0.3  # 降低正向调整的强度
            result = image * (1 - highlight_mask) + image * factor * highlight_mask
        
        return np.clip(result, 0, 1)
    
    def _apply_shadows(self, image, shadows_value):
        """应用阴影调整 - 提亮暗部细节，更接近PS Camera Raw"""
        if shadows_value == 0:
            return image
        
        # 计算亮度
        luminance = np.dot(image, [0.299, 0.587, 0.114])
        
        # 创建更精确的阴影遮罩，类似PS的处理方式
        shadow_threshold = 0.3  # 阴影阈值
        shadow_mask = np.zeros_like(luminance)
        
        # 对于低于阈值的区域使用渐变遮罩
        below_threshold = luminance < shadow_threshold
        shadow_mask[below_threshold] = (shadow_threshold - luminance[below_threshold]) / shadow_threshold
        shadow_mask = np.power(shadow_mask, 1.2)  # 让过渡更平滑
        
        # 扩展到RGB三通道
        shadow_mask = shadow_mask[..., np.newaxis]
        
        # 调整强度
        adjustment = shadows_value / 100.0
        
        if shadows_value > 0:
            # 正值：提亮阴影，使用更自然的提亮曲线
            # 使用类似gamma校正的方式
            lift_factor = 1.0 + adjustment * 0.8
            # 对阴影区域进行非线性提亮
            lifted_image = np.power(image, 1.0 / lift_factor)
            result = image * (1 - shadow_mask) + lifted_image * shadow_mask
        else:
            # 负值：压暗阴影，使用更强的压暗
            factor = np.power(1.0 + adjustment, 0.8)  # 非线性压暗
            result = image * (1 - shadow_mask) + image * factor * shadow_mask
        
        return np.clip(result, 0, 1)
    
    def _apply_whites(self, image, whites_value):
        """应用白色调整 - 调整白场点，更接近PS Camera Raw"""
        if whites_value == 0:
            return image
        
        # 白色调整主要影响亮部，使用更精确的曲线
        adjustment = whites_value / 100.0
        
        # 计算亮度
        luminance = np.dot(image, [0.299, 0.587, 0.114])
        
        # 创建白色权重遮罩，主要影响中间调到高光
        # 使用S形曲线，更符合PS的处理方式
        white_weight = np.power(luminance, 2.0)  # 强调亮部
        white_weight = white_weight[..., np.newaxis]
        
        if whites_value > 0:
            # 正值：扩展白场，提升亮部
            # 使用更激进的提升
            factor = 1.0 + adjustment * 0.8 * white_weight
        else:
            # 负值：压缩白场，降低亮部
            # 使用更温和的压缩
            factor = 1.0 + adjustment * 0.4 * white_weight
        
        result = image * factor
        return np.clip(result, 0, 1)
    
    def _apply_blacks(self, image, blacks_value):
        """应用黑色调整 - 调整黑场点，更接近PS Camera Raw"""
        if blacks_value == 0:
            return image
        
        # 黑色调整主要影响暗部，使用更精确的曲线
        adjustment = blacks_value / 100.0
        
        # 计算亮度
        luminance = np.dot(image, [0.299, 0.587, 0.114])
        
        # 创建黑色权重遮罩，主要影响阴影到中间调
        # 使用反向S形曲线，强调暗部
        black_weight = 1.0 - np.power(luminance, 0.5)  # 强调暗部
        black_weight = np.power(black_weight, 1.5)  # 让过渡更平滑
        black_weight = black_weight[..., np.newaxis]
        
        if blacks_value > 0:
            # 正值：提升黑场，减少深黑色，类似lift操作
            # 使用加法操作，更自然
            lift_amount = adjustment * 0.4 * black_weight
            result = image + lift_amount
        else:
            # 负值：压暗黑场，增加深黑色
            # 使用乘法操作，保持黑色的纯净度
            factor = 1.0 + adjustment * 0.6 * black_weight
            result = image * factor
        
        return np.clip(result, 0, 1)
    
    def _apply_white_balance(self, image, temperature, tint):
        """应用白平衡调整 - 色温和色调，更接近PS Camera Raw"""
        if temperature == 0 and tint == 0:
            return image
        
        # 更精确的色温映射，基于黑体辐射曲线
        temp_factor = temperature / 100.0
        tint_factor = tint / 100.0
        
        # PS Camera Raw风格的色温调整
        # 使用更复杂的色温曲线，更接近真实的色温变化
        if temp_factor != 0:
            if temp_factor > 0:
                # 正值：暖色调（增加红色，减少蓝色）
                # 使用非线性曲线模拟真实色温变化
                temp_intensity = np.power(temp_factor, 0.8)
                r_mult = 1.0 + temp_intensity * 0.4
                g_mult = 1.0 + temp_intensity * 0.15
                b_mult = 1.0 - temp_intensity * 0.25
            else:
                # 负值：冷色调（减少红色，增加蓝色）
                temp_intensity = np.power(-temp_factor, 0.8)
                r_mult = 1.0 - temp_intensity * 0.3
                g_mult = 1.0 - temp_intensity * 0.1
                b_mult = 1.0 + temp_intensity * 0.35
        else:
            r_mult = g_mult = b_mult = 1.0
        
        # PS Camera Raw风格的色调调整
        # 更精确地模拟绿-品红轴的调整
        if tint_factor != 0:
            if tint_factor > 0:
                # 正值：偏绿
                tint_intensity = np.power(tint_factor, 0.9)
                g_mult *= 1.0 + tint_intensity * 0.25
                r_mult *= 1.0 - tint_intensity * 0.12
                b_mult *= 1.0 - tint_intensity * 0.12
            else:
                # 负值：偏品红
                tint_intensity = np.power(-tint_factor, 0.9)
                g_mult *= 1.0 - tint_intensity * 0.2
                r_mult *= 1.0 + tint_intensity * 0.1
                b_mult *= 1.0 + tint_intensity * 0.1
        
        # 应用调整
        result = image.copy()
        result[:, :, 0] *= r_mult  # Red
        result[:, :, 1] *= g_mult  # Green
        result[:, :, 2] *= b_mult  # Blue
        
        # 轻微的归一化，防止过度饱和
        max_channel = np.max(result, axis=2, keepdims=True)
        over_saturated = max_channel > 1.0
        result[over_saturated] = result[over_saturated] / max_channel[over_saturated]
        
        return np.clip(result, 0, 1)
    
    def _apply_vibrance(self, image, vibrance_value):
        """应用自然饱和度调整 - 智能饱和度"""
        if vibrance_value == 0:
            return image
        
        # 转换到HSV空间进行处理
        img_uint8 = (image * 255).astype(np.uint8)
        hsv = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2HSV).astype(np.float32)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        
        # 自然饱和度的特点：对已经饱和的颜色影响较小
        adjustment = vibrance_value / 100.0
        
        # 创建保护遮罩：已经高饱和度的区域受到保护
        saturation_mask = 1.0 - (s / 255.0) ** 2  # 高饱和度区域权重小
        
        # 肤色保护：减少对肤色的影响
        # 肤色在HSV中大约在色相10-25度范围
        skin_mask = np.ones_like(h)
        skin_hue_range = ((h >= 5) & (h <= 30)) | ((h >= 160) & (h <= 180))
        skin_mask[skin_hue_range] = 0.3  # 肤色区域减少影响
        
        # 综合遮罩
        final_mask = saturation_mask * skin_mask
        
        if adjustment > 0:
            # 正值：增加自然饱和度
            s_enhanced = s + adjustment * 120 * final_mask
        else:
            # 负值：减少饱和度
            s_enhanced = s + adjustment * 255 * final_mask
        
        s_enhanced = np.clip(s_enhanced, 0, 255)
        
        # 重新组合HSV
        hsv_enhanced = np.stack([h, s_enhanced, v], axis=2)
        result_uint8 = cv2.cvtColor(hsv_enhanced.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
        return result_uint8.astype(np.float32) / 255.0
    
    def _apply_saturation(self, image, saturation_value):
        """应用饱和度调整 - 整体饱和度"""
        if saturation_value == 0:
            return image
        
        # 计算灰度版本
        gray = np.dot(image, [0.299, 0.587, 0.114])
        
        # 饱和度调整
        adjustment = saturation_value / 100.0
        saturation_factor = 1.0 + adjustment
        
        # 混合彩色和灰度
        result = gray[..., np.newaxis] * (1 - saturation_factor) + image * saturation_factor
        
        return np.clip(result, 0, 1)
    
    def _apply_contrast(self, image, contrast_value):
        """应用对比度调整"""
        if contrast_value == 0:
            return image
        
        # 对比度调整
        adjustment = contrast_value / 100.0
        contrast_factor = 1.0 + adjustment
        
        # 以0.5为中心点进行对比度调整
        result = (image - 0.5) * contrast_factor + 0.5
        
        return np.clip(result, 0, 1)
    
    def _apply_dehaze(self, image, dehaze_strength):
        """应用去薄雾效果 - 简化版，与前端算法保持一致"""
        if dehaze_strength == 0:
            return image
            
        # 转换为numpy数组
        img_float = image.astype(np.float32)
        
        # 去薄雾强度因子
        dehaze_factor = dehaze_strength / 100.0
        
        if dehaze_factor > 0:
            # 正向去薄雾 - 简化版，匹配前端算法
            enhanced = self._simple_dehaze_frontend_match(img_float, dehaze_factor)
        else:
            # 负向去薄雾 - 添加雾霾效果
            enhanced = self._negative_dehaze(img_float, -dehaze_factor)
        
        # 转换回0-1范围
        return np.clip(enhanced, 0, 1)
    
    def _simple_dehaze_frontend_match(self, image, dehaze_factor):
        """
        最优Camera Raw去薄雾算法 - 基于大量测试和用户反馈优化
        智能选择V2或V3算法以获得最佳效果
        """
        return self._optimal_camera_raw_dehaze(image, dehaze_factor)
    
    def _optimal_camera_raw_dehaze(self, image, strength):
        """
        最优Camera Raw去薄雾算法
        基于图像特征智能选择V2或V3算法
        
        Args:
            image: numpy array, shape (H, W, 3), dtype float32, range [0, 1]
            strength: float, 去薄雾强度 0.0-1.0
            
        Returns:
            processed_image: numpy array, same shape and dtype as input
        """
        if strength == 0.0:
            return image.copy()
        
        def analyze_image_characteristics(img):
            """分析图像特征"""
            import cv2
            brightness = np.mean(img)
            contrast = np.std(img)
            hsv = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_RGB2HSV)
            saturation = np.mean(hsv[:,:,1])
            return {'brightness': brightness, 'contrast': contrast, 'saturation': saturation}
        
        def apply_v2_algorithm(img, s):
            """适合低饱和度薄雾图像的V2算法"""
            stats = analyze_image_characteristics(img)
            result = img.copy()
            
            if stats['saturation'] < 30:
                base_stretch = [[0.018, 0.985, 0.618], [0.013, 0.988, 0.636], [0.023, 0.980, 0.570]]
                base_power = [1.12, 1.06, 1.28]
                base_global = 1.04
            elif stats['saturation'] > 70:
                base_stretch = [[0.010, 0.995, 0.75], [0.008, 0.996, 0.78], [0.015, 0.990, 0.70]]
                base_power = [1.03, 1.01, 1.10]
                base_global = 1.01
            else:
                base_stretch = [[0.014, 0.990, 0.68], [0.010, 0.992, 0.70], [0.019, 0.986, 0.63]]
                base_power = [1.07, 1.03, 1.18]
                base_global = 1.025
            
            # 根据强度调整参数
            adjusted_stretch = []
            adjusted_power = []
            
            for i in range(3):
                low_p, high_p, scale = base_stretch[i]
                
                # 强度为0时回到原始参数，强度为1时使用完整参数
                adj_low = low_p * s + (1.0 - s) * 0.01
                adj_high = high_p * s + (1.0 - s) * 0.99
                adj_scale = scale * s + (1.0 - s) * 1.0
                
                adjusted_stretch.append([adj_low, adj_high, adj_scale])
                
                # 幂函数也根据强度调整
                adj_power = base_power[i] * s + (1.0 - s) * 1.0
                adjusted_power.append(adj_power)
            
            adj_global = base_global * s + (1.0 - s) * 1.0
            
            for i in range(3):
                channel = result[:,:,i]
                low_p, high_p, scale = adjusted_stretch[i]
                
                p_low, p_high = np.percentile(channel, [low_p*100, high_p*100])
                if p_high > p_low:
                    channel_stretched = np.clip((channel - p_low) / (p_high - p_low), 0, 1)
                else:
                    channel_stretched = channel
                
                result[:,:,i] = np.power(channel_stretched * scale, adjusted_power[i])
            
            return np.clip(result * adj_global, 0, 1)
        
        def apply_v3_algorithm(img, s):
            """适合高对比度图像的V3算法"""
            stats = analyze_image_characteristics(img)
            result = img.copy()
            
            brightness_factor = max(0.5, min(1.5, 1.0 / stats['brightness']))
            contrast_factor = max(0.5, min(1.5, 0.1 / stats['contrast']))
            saturation_factor = max(0.5, min(1.5, 50.0 / stats['saturation']))
            overall_factor = max(0.6, min(1.4, (brightness_factor + contrast_factor + saturation_factor) / 3.0))
            
            # 根据强度调整overall_factor
            overall_factor = overall_factor * s + 1.0 * (1.0 - s)
            
            base_stretch = [[0.016, 0.988, 0.68], [0.012, 0.990, 0.70], [0.022, 0.984, 0.62]]
            base_power = [1.08, 1.04, 1.20]
            base_global = 1.03
            
            for i in range(3):
                channel = result[:,:,i]
                low_p, high_p, scale = base_stretch[i]
                
                adj_low = low_p * (2.0 - overall_factor)
                adj_high = high_p + (1.0 - high_p) * (overall_factor - 1.0) * 0.5
                adj_scale = scale * (0.8 + 0.4 * overall_factor)
                adj_power = base_power[i] * (0.7 + 0.6 * overall_factor)
                
                # 确保强度为0时回到原始状态
                adj_low = adj_low * s + 0.01 * (1.0 - s)
                adj_high = adj_high * s + 0.99 * (1.0 - s)
                adj_scale = adj_scale * s + 1.0 * (1.0 - s)
                adj_power = adj_power * s + 1.0 * (1.0 - s)
                
                p_low, p_high = np.percentile(channel, [adj_low*100, adj_high*100])
                if p_high > p_low:
                    channel_stretched = np.clip((channel - p_low) / (p_high - p_low), 0, 1)
                else:
                    channel_stretched = channel
                result[:,:,i] = np.power(channel_stretched * adj_scale, adj_power)
            
            adj_global = (base_global * (0.8 + 0.4 * overall_factor)) * s + 1.0 * (1.0 - s)
            return np.clip(result * adj_global, 0, 1)
        
        # 主逻辑：智能选择算法
        stats = analyze_image_characteristics(image)
        
        is_foggy_type = (stats['contrast'] < 0.1 and stats['saturation'] < 40)
        is_clear_type = (stats['contrast'] > 0.15 and stats['saturation'] > 60)
        
        if is_foggy_type:
            return apply_v2_algorithm(image, strength)
        elif is_clear_type:
            return apply_v3_algorithm(image, strength)
        else:
            # 选择更接近的类型
            type1_similarity = abs(stats['contrast'] - 0.057) + abs(stats['saturation'] - 11.7) / 10
            type2_similarity = abs(stats['contrast'] - 0.195) + abs(stats['saturation'] - 83.0) / 10
            
            if type1_similarity < type2_similarity:
                return apply_v2_algorithm(image, strength)
            else:
                return apply_v3_algorithm(image, strength)

    def _ps_style_dehaze(self, image, strength):
        """PS风格的去薄雾 - 优化算法，专注对比度增强而非饱和度"""
        # 基于大量测试，发现PS去薄雾的核心是对比度增强，而非饱和度增强
        img = image.astype(np.float32)
        
        # === 步骤1：基础温和去雾 ===
        result = self._mild_dehaze_ps(img, strength)
        
        # === 步骤2：核心 - 对比度增强 ===
        result = self._contrast_boost_ps(result, strength)
        
        # === 步骤3：清晰度提升 ===
        result = self._clarity_enhancement_ps(result, strength)
        
        # === 步骤4：极保守的色彩调整 ===
        result = self._minimal_color_adjustment_ps(result, strength)
        
        # 适度混合（PS特点：保持自然）
        blend = 0.7 * strength
        final = image * (1 - blend) + result * blend
        
        return np.clip(final, 0, 1)
    
    def _mild_dehaze_ps(self, image, strength):
        """温和去雾 - PS风格"""
        img_uint8 = (image * 255).astype(np.uint8)
        min_channel = np.minimum(np.minimum(img_uint8[:, :, 0], img_uint8[:, :, 1]), img_uint8[:, :, 2])
        
        # 高效暗通道计算
        h, w = min_channel.shape
        dark_channel = np.zeros_like(min_channel, dtype=np.float32)
        
        # 大区块处理提高效率
        block_size = 20
        for i in range(0, h, block_size):
            for j in range(0, w, block_size):
                end_i = min(i + block_size, h)
                end_j = min(j + block_size, w)
                local_min = min_channel[i:end_i, j:end_j].min()
                dark_channel[i:end_i, j:end_j] = local_min
        
        # 保守的去雾参数
        omega = 0.5 * strength
        transmission = 1 - omega * dark_channel / 255.0
        transmission = np.maximum(transmission, 0.7)
        
        # 固定大气光（经验值，接近PS）
        A = 200
        
        # 场景恢复
        result = np.zeros_like(image)
        for i in range(3):
            result[:, :, i] = (image[:, :, i] - A/255.0) / transmission + A/255.0
        
        return np.clip(result, 0, 1)
    
    def _contrast_boost_ps(self, image, strength):
        """对比度增强 - PS去薄雾的核心"""
        
        # 1. 强S曲线（PS特色）
        def ps_s_curve(x):
            return x + 0.4 * x * (1 - x) * (2 * x - 1) * strength
        
        result = ps_s_curve(image)
        
        # 2. 直方图拉伸（重要：PS去薄雾的关键步骤）
        for i in range(3):
            channel = result[:, :, i]
            p0_5, p99_5 = np.percentile(channel, [0.5, 99.5])
            if p99_5 > p0_5:
                result[:, :, i] = np.clip((channel - p0_5) / (p99_5 - p0_5), 0, 1)
        
        # 3. 额外对比度增强
        mean_val = result.mean()
        contrast_multiplier = 1.0 + 0.6 * strength
        result = mean_val + (result - mean_val) * contrast_multiplier
        
        return np.clip(result, 0, 1)
    
    def _clarity_enhancement_ps(self, image, strength):
        """清晰度增强 - PS风格"""
        result = image.copy()
        
        # 高效锐化实现
        for i in range(3):
            channel = image[:, :, i]
            h, w = channel.shape
            
            # 快速锐化
            sharpened = np.zeros_like(channel)
            
            step = 8  # 跳跃处理提高效率
            for y in range(2, h-2, step):
                for x in range(2, w-2, step):
                    # 简单高通滤波
                    center = channel[y, x]
                    avg_neighbors = (channel[y-1, x] + channel[y+1, x] + 
                                   channel[y, x-1] + channel[y, x+1]) / 4
                    high_freq = center - avg_neighbors
                    
                    # 填充区域
                    end_y, end_x = min(y+step, h-2), min(x+step, w-2)
                    sharpened[y:end_y, x:end_x] = high_freq
            
            # 应用锐化
            sharpness_factor = 0.35 * strength
            result[:, :, i] = channel + sharpened * sharpness_factor
        
        return np.clip(result, 0, 1)
    
    def _minimal_color_adjustment_ps(self, image, strength):
        """极保守的色彩调整 - PS风格（关键：不过度增加饱和度）"""
        
        # 重要：PS去薄雾几乎不增加饱和度！
        result = image.copy()
        
        # 1. 仅微调RGB比例
        r_mean, g_mean, b_mean = [result[:, :, i].mean() for i in range(3)]
        total = r_mean + g_mean + b_mean
        
        if total > 0:
            current_ratios = np.array([r_mean, g_mean, b_mean]) / total
            target_ratios = np.array([0.338, 0.351, 0.311])
            
            # 极微调整（仅5%）
            adjustment = (target_ratios - current_ratios) * 0.05 * strength
            new_ratios = current_ratios + adjustment
            
            factors = new_ratios / current_ratios
            factors = np.clip(factors, 0.99, 1.01)  # 极小调整范围
            
            result[:, :, 0] *= factors[0]
            result[:, :, 1] *= factors[1]
            result[:, :, 2] *= factors[2]
        
        # 2. 微调亮度到目标
        current_brightness = np.dot(result, [0.299, 0.587, 0.114]).mean()
        target_brightness = 66.4 / 255.0
        
        if current_brightness > 0:
            brightness_factor = target_brightness / current_brightness
            brightness_factor = 1.0 + (brightness_factor - 1.0) * 0.2 * strength
            brightness_factor = np.clip(brightness_factor, 0.95, 1.05)
            result *= brightness_factor
        
        return np.clip(result, 0, 1)

    def _get_simple_dark_channel(self, img):
        """简化的暗通道计算"""
        b, g, r = cv2.split(img)
        min_channel = np.minimum(np.minimum(r, g), b)
        
        # 使用形态学操作
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dark = cv2.erode(min_channel, kernel)
        
        return dark
    
    def _estimate_atmospheric_light_simple(self, img, dark_channel):
        """简化的大气光估计"""
        h, w = dark_channel.shape
        num_pixels = h * w
        
        # 选择最亮的0.1%像素
        num_brightest = max(int(num_pixels * 0.001), 1)
        
        # 找到暗通道中最亮的位置
        dark_vec = dark_channel.reshape(num_pixels)
        indices = np.argpartition(dark_vec, -num_brightest)[-num_brightest:]
        
        # 在原图中找到对应位置的最大值
        atmospheric_light = np.array([0, 0, 0], dtype=np.float32)
        for idx in indices:
            y = idx // w
            x = idx % w
            atmospheric_light = np.maximum(atmospheric_light, img[y, x, :])
        
        return atmospheric_light
    
    def _positive_dehaze(self, image, strength):
        """原始的正向去薄雾 - 保留作为备选"""
        # 使用暗通道先验算法进行去雾
        dehazed_dcp = self._dark_channel_prior_dehaze(image, strength)
        
        # 温和的后处理增强
        # 1. 转换为HSV进行温和增强
        hsv = cv2.cvtColor((dehazed_dcp * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        
        # 2. 适度的饱和度提升
        saturation_boost = 1.0 + strength * 0.15  # 更温和的饱和度提升
        s_enhanced = s * saturation_boost
        
        # 3. 温和的CLAHE增强
        v_clahe = self._apply_clahe(v, strength * 0.4)  # 降低CLAHE强度
        
        # 重新组合HSV
        hsv_enhanced = np.stack([
            h,
            np.clip(s_enhanced, 0, 255),
            np.clip(v_clahe, 0, 255)
        ], axis=2)
        
        # 转换回RGB
        rgb_enhanced = cv2.cvtColor(hsv_enhanced.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
        # 4. 温和的S曲线增强
        rgb_final = self._apply_s_curve(rgb_enhanced.astype(np.float32) / 255.0, strength * 0.15)
        
        # 5. 与原图混合，避免过度处理
        blend_factor = 0.85  # 85%处理后的图像 + 15%原图
        result = rgb_final * blend_factor + image * (1 - blend_factor)
        
        return result
    
    def _dark_channel_prior_dehaze(self, image, strength):
        """暗通道先验去雾算法 - 业界标准算法"""
        # 转换为0-255范围
        img = (image * 255).astype(np.uint8)
        
        # 1. 计算暗通道
        dark_channel = self._get_dark_channel(img, 15)
        
        # 2. 估计大气光
        atmospheric_light = self._estimate_atmospheric_light(img, dark_channel)
        
        # 3. 估计透射率
        transmission = self._estimate_transmission(img, atmospheric_light, strength)
        
        # 4. 细化透射率（使用导向滤波）
        transmission_refined = self._refine_transmission(img, transmission)
        
        # 5. 恢复场景辐射
        recovered = self._recover_scene(img, transmission_refined, atmospheric_light)
        
        return recovered / 255.0
    
    def _get_dark_channel(self, img, patch_size):
        """计算暗通道"""
        b, g, r = cv2.split(img)
        min_channel = np.minimum(np.minimum(r, g), b)
        
        # 使用最小值滤波
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (patch_size, patch_size))
        dark_channel = cv2.erode(min_channel, kernel)
        
        return dark_channel
    
    def _estimate_atmospheric_light(self, img, dark_channel):
        """估计大气光值"""
        h, w = dark_channel.shape
        num_pixels = h * w
        
        # 选择暗通道中最亮的0.1%像素
        num_brightest = int(max(num_pixels * 0.001, 1))
        
        # 获取暗通道中最亮像素的位置
        dark_vec = dark_channel.reshape(num_pixels)
        indices = np.argpartition(dark_vec, -num_brightest)[-num_brightest:]
        
        # 在原图中找到这些位置的最大强度值
        atmospheric_light = np.zeros(3)
        for idx in indices:
            y = idx // w
            x = idx % w
            atmospheric_light = np.maximum(atmospheric_light, img[y, x, :])
        
        return atmospheric_light
    
    def _estimate_transmission(self, img, atmospheric_light, strength):
        """估计透射率 - 更激进的参数以匹配PS效果"""
        # 归一化图像
        norm_img = img.astype(np.float32) / atmospheric_light
        
        # 计算归一化图像的暗通道
        # 使用更激进的omega值（原论文推荐0.95，我们用0.85-0.95之间根据强度调整）
        omega = 0.85 + (0.1 * (1.0 - strength))  # 强度越高，omega越小，去雾越强
        transmission = 1 - omega * self._get_dark_channel((norm_img * 255).astype(np.uint8), 15) / 255.0
        
        # 对透射率进行gamma校正，增强对比度
        transmission = np.power(transmission, 1.2)
        
        return transmission
    
    def _refine_transmission(self, img, transmission):
        """使用导向滤波细化透射率"""
        # 转换为灰度图作为引导图像
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        
        # 使用导向滤波
        refined = self._guided_filter(gray, transmission, radius=60, eps=0.0001)
        
        return np.clip(refined, 0.1, 0.9)
    
    def _guided_filter(self, guide, src, radius, eps):
        """导向滤波实现"""
        mean_I = cv2.boxFilter(guide, cv2.CV_32F, (radius, radius))
        mean_p = cv2.boxFilter(src, cv2.CV_32F, (radius, radius))
        
        corr_Ip = cv2.boxFilter(guide * src, cv2.CV_32F, (radius, radius))
        cov_Ip = corr_Ip - mean_I * mean_p
        
        mean_II = cv2.boxFilter(guide * guide, cv2.CV_32F, (radius, radius))
        var_I = mean_II - mean_I * mean_I
        
        a = cov_Ip / (var_I + eps)
        b = mean_p - a * mean_I
        
        mean_a = cv2.boxFilter(a, cv2.CV_32F, (radius, radius))
        mean_b = cv2.boxFilter(b, cv2.CV_32F, (radius, radius))
        
        q = mean_a * guide + mean_b
        
        return q
    
    def _recover_scene(self, img, transmission, atmospheric_light):
        """恢复无雾场景 - 平衡版本，避免过度处理"""
        # 防止透射率过小
        t = np.maximum(transmission, 0.1)
        
        # 恢复每个通道
        recovered = np.zeros_like(img, dtype=np.float32)
        for i in range(3):
            recovered[:, :, i] = (img[:, :, i].astype(np.float32) - atmospheric_light[i]) / t[:, :] + atmospheric_light[i]
        
        # 温和的对比度增强
        # 1. 应用自动色阶 - 使用更合理的百分位数
        for i in range(3):
            channel = recovered[:, :, i]
            p_low, p_high = np.percentile(channel, [2, 98])  # 更温和的裁剪
            
            # 避免过度拉伸
            if p_high - p_low > 20:  # 只有当动态范围足够大时才拉伸
                channel_stretched = np.clip((channel - p_low) * 255.0 / (p_high - p_low), 0, 255)
                # 与原始混合，避免过度
                recovered[:, :, i] = channel * 0.3 + channel_stretched * 0.7
            else:
                recovered[:, :, i] = channel
        
        # 2. 确保在合理范围内
        recovered_uint8 = np.clip(recovered, 0, 255).astype(np.uint8)
        
        # 转换为HSV进行温和增强
        hsv = cv2.cvtColor(recovered_uint8, cv2.COLOR_RGB2HSV).astype(np.float32)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        
        # 3. 温和的饱和度提升 - 避免过饱和
        s_mean = s.mean()
        if s_mean < 100:  # 只有饱和度较低时才大幅提升
            s_enhanced = np.clip(s * 1.3, 0, 255)  # 30%饱和度提升
        else:
            s_enhanced = np.clip(s * 1.15, 0, 255)  # 15%饱和度提升
        
        # 4. 温和的亮度调整 - 使用更温和的S曲线
        v_normalized = v / 255.0
        # 温和的S曲线
        v_enhanced = v_normalized + 0.2 * v_normalized * (1 - v_normalized) * (2 * v_normalized - 1)
        v_enhanced = np.clip(v_enhanced * 255, 0, 255)
        
        # 5. 轻微的锐化效果
        kernel = np.array([[0, -0.5, 0],
                          [-0.5, 3, -0.5],
                          [0, -0.5, 0]]) / 1.0
        v_sharpened = cv2.filter2D(v_enhanced.astype(np.uint8), -1, kernel)
        v_final = np.clip(v_enhanced * 0.85 + v_sharpened * 0.15, 0, 255)
        
        # 重新组合
        hsv_enhanced = np.stack([h, s_enhanced, v_final], axis=2)
        result = cv2.cvtColor(hsv_enhanced.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
        return result
    
    def _negative_dehaze(self, image, strength):
        """负向去薄雾 - 添加雾霾效果"""
        # 降低对比度
        gamma = 1.0 + strength * 0.5
        dehazed = np.power(image, gamma)
        
        # 降低饱和度
        gray = np.dot(dehazed, [0.299, 0.587, 0.114])
        desaturated = dehazed * (1 - strength * 0.3) + gray[..., np.newaxis] * strength * 0.3
        
        # 添加大气光
        atmospheric_light = 0.8  # 模拟大气光强度
        hazed = desaturated + (atmospheric_light - desaturated) * strength * 0.2
        
        return hazed
    
    def _apply_clahe(self, v_channel, strength):
        """应用CLAHE (对比度限制自适应直方图均衡) - 平衡版"""
        # 创建CLAHE对象 - 使用适中的参数
        clip_limit = 2.0 + strength * 2.0  # 适中的裁剪限制
        tile_grid_size = (8, 8)  # 标准网格大小
        
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
        
        # 应用CLAHE
        v_clahe = clahe.apply(v_channel.astype(np.uint8)).astype(np.float32)
        
        # 与原始图像混合 - 使用适中的混合比例
        blend_factor = min(strength * 0.5, 0.6)  # 最高60%的CLAHE效果
        return v_channel * (1 - blend_factor) + v_clahe * blend_factor
    
    def _lift_shadows(self, v_channel, strength):
        """提升暗部细节"""
        # 创建暗部遮罩 (值越小权重越大)
        shadow_mask = 1.0 - (v_channel / 255.0)
        shadow_mask = np.power(shadow_mask, 2)  # 平方增强暗部选择
        
        # 提升暗部
        lift_amount = strength * 40  # 提升量
        v_lifted = v_channel + shadow_mask * lift_amount
        
        return v_lifted
    
    def _compress_highlights(self, v_channel, strength):
        """压制高光"""
        # 创建高光遮罩
        highlight_mask = np.power(v_channel / 255.0, 2)
        
        # 压制高光
        compress_amount = strength * 20
        v_compressed = v_channel - highlight_mask * compress_amount
        
        return v_compressed
    
    def _apply_s_curve(self, image, strength):
        """应用S曲线增强对比度"""
        # S曲线函数：f(x) = x + strength * x * (1-x) * (2x-1)
        s_curve = image + strength * image * (1 - image) * (2 * image - 1)
        return s_curve