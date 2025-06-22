"""
遮罩处理工具

提供遮罩相关的通用功能
"""

import torch
import cv2
import numpy as np

def apply_mask_to_image(original_image, processed_image, mask, invert_mask=False):
    """
    使用遮罩混合原始图像和处理后的图像
    
    Args:
        original_image: 原始图像 tensor
        processed_image: 处理后的图像 tensor  
        mask: 遮罩 tensor
        invert_mask: 是否反转遮罩
    
    Returns:
        混合后的图像 tensor
    """
    if mask is None:
        return processed_image
    
    # 确保遮罩和图像尺寸匹配
    if mask.shape[-2:] != original_image.shape[-2:]:
        mask = torch.nn.functional.interpolate(
            mask.unsqueeze(0).unsqueeze(0), 
            size=original_image.shape[-2:], 
            mode='bilinear', 
            align_corners=False
        ).squeeze(0).squeeze(0)
    
    # 反转遮罩（如果需要）
    if invert_mask:
        mask = 1.0 - mask
    
    # 扩展遮罩维度以匹配图像
    if len(mask.shape) == 2:
        mask = mask.unsqueeze(-1)
    if mask.shape[-1] != original_image.shape[-1]:
        mask = mask.expand(-1, -1, original_image.shape[-1])
    
    # 混合图像
    result = original_image * (1.0 - mask) + processed_image * mask
    
    return result

def blur_mask(mask, blur_radius):
    """
    对遮罩应用高斯模糊
    
    Args:
        mask: 遮罩 tensor
        blur_radius: 模糊半径
    
    Returns:
        模糊后的遮罩 tensor
    """
    if blur_radius <= 0:
        return mask
    
    # 转换为numpy进行处理
    mask_np = (mask.cpu().numpy() * 255).astype(np.uint8)
    
    # 计算核大小（必须是奇数）
    ksize = int(blur_radius * 2) * 2 + 1
    ksize = max(3, ksize)  # 最小核大小为3
    
    # 应用高斯模糊
    blurred = cv2.GaussianBlur(mask_np, (ksize, ksize), blur_radius)
    
    # 转换回tensor
    return torch.from_numpy(blurred.astype(np.float32) / 255.0).to(mask.device)

def process_mask_for_batch(mask, batch_size, image_height, image_width):
    """
    为批处理准备遮罩
    
    Args:
        mask: 输入遮罩
        batch_size: 批大小
        image_height: 图像高度
        image_width: 图像宽度
    
    Returns:
        处理后的遮罩，适用于批处理
    """
    if mask is None:
        return None
    
    # 处理不同的遮罩维度
    if mask.dim() == 2:
        # (H, W) -> (1, H, W) -> (B, H, W)
        mask = mask.unsqueeze(0).expand(batch_size, -1, -1)
    elif mask.dim() == 3:
        if mask.shape[0] == 1:
            # (1, H, W) -> (B, H, W)  
            mask = mask.expand(batch_size, -1, -1)
        elif mask.shape[0] != batch_size:
            # 如果遮罩数量不匹配，使用第一个遮罩
            mask = mask[0:1].expand(batch_size, -1, -1)
    
    # 调整遮罩尺寸
    if mask.shape[-2:] != (image_height, image_width):
        mask = torch.nn.functional.interpolate(
            mask.unsqueeze(1), 
            size=(image_height, image_width), 
            mode='bilinear', 
            align_corners=False
        ).squeeze(1)
    
    return mask

def create_luminance_mask(image, threshold_low=0.2, threshold_high=0.8):
    """
    基于亮度创建遮罩
    
    Args:
        image: 输入图像 tensor (B, H, W, C) 或 (H, W, C)
        threshold_low: 低阈值
        threshold_high: 高阈值
    
    Returns:
        亮度遮罩 tensor
    """
    # 计算亮度
    if image.shape[-1] >= 3:
        # RGB亮度公式
        luminance = 0.299 * image[..., 0] + 0.587 * image[..., 1] + 0.114 * image[..., 2]
    else:
        luminance = image[..., 0]
    
    # 创建遮罩
    mask = torch.zeros_like(luminance)
    mask = torch.where(
        (luminance >= threshold_low) & (luminance <= threshold_high),
        torch.ones_like(luminance),
        torch.zeros_like(luminance)
    )
    
    return mask