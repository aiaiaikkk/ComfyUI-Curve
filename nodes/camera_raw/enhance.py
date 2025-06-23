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


class CameraRawEnhanceNode(BaseImageNode):
    """Camera Raw增强节点 - 集成纹理、清晰度、去薄雾三个功能"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                # 纹理控制
                'texture': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '纹理增强，增强中等大小细节的对比度'
                }),
                # 清晰度控制
                'clarity': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '清晰度调整，增强中间调对比度'
                }),
                # 去薄雾控制
                'dehaze': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '去薄雾效果，减少或增加大气雾霾'
                }),
                # 混合控制
                'blend': ('FLOAT', {
                    'default': 100.0,
                    'min': 0.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '控制增强效果的混合程度（0-100%）'
                }),
                # 整体强度
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
    
    def apply_camera_raw_enhance(self, image, texture=0.0, clarity=0.0, dehaze=0.0, 
                                blend=100.0, overall_strength=1.0,
                                mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        """应用Camera Raw增强效果"""
        # 性能优化：如果所有参数都是默认值且没有遮罩，直接返回原图
        if (texture == 0 and clarity == 0 and dehaze == 0 and mask is None):
            return (image,)
        
        try:
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端
            if unique_id is not None:
                enhance_data = {
                    "texture": texture,
                    "clarity": clarity,
                    "dehaze": dehaze,
                    "blend": blend,
                    "overall_strength": overall_strength
                }
                self.send_preview_to_frontend(image, unique_id, "camera_raw_enhance_preview", mask)
            
            # 支持批处理
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image,
                    self._process_single_image,
                    texture, clarity, dehaze, blend, overall_strength,
                    mask, mask_blur, invert_mask
                ),)
            else:
                result = self._process_single_image(
                    image, texture, clarity, dehaze, blend, overall_strength,
                    mask, mask_blur, invert_mask
                )
                return (result,)
            
        except Exception as e:
            print(f"CameraRawEnhanceNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image, texture, clarity, dehaze, blend, overall_strength,
                             mask, mask_blur, invert_mask):
        """处理单张图像的Camera Raw增强"""
        device = image.device
        
        # 转换为numpy进行处理
        img_np = image.detach().cpu().numpy()
        
        # 保存原始图像
        original = img_np.copy()
        
        # 检查是否需要处理
        needs_processing = (texture != 0 or clarity != 0 or dehaze != 0 or 
                          overall_strength != 1.0 or blend < 100.0)
        
        if not needs_processing and mask is None:
            return image
        
        # 应用纹理增强
        if texture != 0:
            img_np = self._apply_texture(img_np, texture)
        
        # 应用清晰度增强
        if clarity != 0:
            img_np = self._apply_clarity(img_np, clarity)
        
        # 应用去薄雾效果
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
    
    def _apply_dehaze(self, image, dehaze_strength):
        """应用去薄雾效果 - 增强对比度和饱和度"""
        # 转换为uint8进行处理
        img_uint8 = (image * 255).astype(np.uint8)
        
        # 转换为HSV
        hsv = cv2.cvtColor(img_uint8, cv2.COLOR_RGB2HSV).astype(np.float32)
        
        # 应用去薄雾效果
        dehaze_factor = dehaze_strength / 100.0
        
        # 增强对比度（调整V通道）
        v_channel = hsv[:, :, 2]
        v_enhanced = np.power(v_channel / 255.0, 1.0 - dehaze_factor * 0.3) * 255.0
        hsv[:, :, 2] = np.clip(v_enhanced, 0, 255)
        
        # 增强饱和度（调整S通道）
        s_channel = hsv[:, :, 1]
        s_enhanced = s_channel * (1.0 + dehaze_factor * 0.2)
        hsv[:, :, 1] = np.clip(s_enhanced, 0, 255)
        
        # 转换回RGB
        enhanced = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
        
        # 转换回0-1范围
        return enhanced.astype(np.float32) / 255.0