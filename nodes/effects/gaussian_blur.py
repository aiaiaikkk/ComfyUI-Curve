"""
高斯模糊效果节点

提供带遮罩支持的高斯模糊功能：
- 可调节模糊半径
- 遮罩支持，实现选择性模糊
- 遮罩羽化功能
- 批处理支持
"""

import torch
import numpy as np
import cv2
from PIL import Image
import io
import base64

from ..core.base_node import BaseImageNode
from ..core.mask_utils import apply_mask_to_image, blur_mask


class GaussianBlurNode(BaseImageNode):
    """高斯模糊节点 - 支持遮罩的选择性模糊"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'blur_radius': ('FLOAT', {
                    'default': 2.0,
                    'min': 0.1,
                    'max': 50.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '模糊半径，值越大模糊效果越强'
                }),
            },
            'optional': {
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，白色区域应用模糊，黑色区域保持原图'
                }),
                'mask_blur': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 20.0,
                    'step': 0.1,
                    'display': 'number',
                    'tooltip': '遮罩边缘羽化，使模糊边界更自然'
                }),
                'invert_mask': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '反转遮罩，黑色区域变为白色区域'
                }),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('IMAGE',)
    RETURN_NAMES = ('image',)
    FUNCTION = 'apply_gaussian_blur'
    CATEGORY = 'Image/Effects'
    OUTPUT_NODE = False
    
    def apply_gaussian_blur(self, image, blur_radius, mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        """应用高斯模糊效果"""
        try:
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端
            if unique_id is not None:
                blur_data = {
                    "blur_radius": blur_radius,
                    "mask_blur": mask_blur,
                    "invert_mask": invert_mask
                }
                self.send_preview_to_frontend(image, unique_id, "gaussian_blur_preview", mask, blur_data)
            
            # 支持批处理
            if len(image.shape) == 4:
                return (self.process_batch_images(
                    image,
                    self._process_single_image,
                    blur_radius, mask, mask_blur, invert_mask
                ),)
            else:
                result = self._process_single_image(
                    image, blur_radius, mask, mask_blur, invert_mask
                )
                return (result,)
                
        except Exception as e:
            print(f"GaussianBlurNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image, blur_radius, mask, mask_blur, invert_mask):
        """处理单张图像的高斯模糊"""
        device = image.device
        
        # 将图像转换为numpy数组
        img_np = image.detach().cpu().numpy()
        
        # 处理Alpha通道
        has_alpha = False
        alpha_channel = None
        
        if img_np.shape[2] == 4:  # RGBA图像
            has_alpha = True
            alpha_channel = img_np[:,:,3]
            img_np = img_np[:,:,:3]  # 只保留RGB通道
        
        # 转换为适合OpenCV的格式 (H, W, C) -> (H, W, C) 0-255
        img_uint8 = (img_np * 255).astype(np.uint8)
        h, w, c = img_uint8.shape
        
        # 应用高斯模糊
        if blur_radius > 0:
            # 计算高斯核大小（必须是奇数）
            kernel_size = int(blur_radius * 6) + 1
            if kernel_size % 2 == 0:
                kernel_size += 1
            
            # 对每个通道分别应用高斯模糊
            blurred_img = cv2.GaussianBlur(img_uint8, (kernel_size, kernel_size), blur_radius)
        else:
            blurred_img = img_uint8.copy()
        
        # 转换回torch tensor
        result_np = blurred_img.astype(np.float32) / 255.0
        
        # 如果原图有Alpha通道，添加回去
        if has_alpha:
            result_np = np.concatenate([result_np, alpha_channel[:,:,np.newaxis]], axis=2)
        
        result_tensor = torch.from_numpy(result_np).to(device)
        
        # 应用遮罩
        if mask is not None:
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result_tensor = apply_mask_to_image(image, result_tensor, mask, invert_mask)
        
        return result_tensor