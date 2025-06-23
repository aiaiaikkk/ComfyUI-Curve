"""
遮罩处理工具

提供遮罩相关的通用功能
"""

import torch
import cv2
import numpy as np

def apply_mask_to_image(original_image, processed_image, mask, invert_mask=False, remove_small_areas=False, min_area_threshold=100):
    """
    使用遮罩混合原始图像和处理后的图像
    
    Args:
        original_image: 原始图像 tensor
        processed_image: 处理后的图像 tensor  
        mask: 遮罩 tensor
        invert_mask: 是否反转遮罩
        remove_small_areas: 是否移除小的遮罩区域（去噪）
        min_area_threshold: 最小区域面积阈值
    
    Returns:
        混合后的图像 tensor
    """
    if mask is None:
        return processed_image
    
    # 立即保存原始形状信息
    orig_shape = original_image.shape
    mask_shape = mask.shape
    
    # 强制要求遮罩尺寸必须与图像匹配，不进行任何插值
    # 使用具体的高度和宽度比较
    if len(mask_shape) == 2:
        mask_h, mask_w = mask_shape[0], mask_shape[1]
    elif len(mask_shape) == 3:
        if mask_shape[0] == 1:  # [1, H, W] 格式
            mask_h, mask_w = mask_shape[1], mask_shape[2]
        else:  # [H, W, C] 格式
            mask_h, mask_w = mask_shape[0], mask_shape[1]
    else:
        mask_h, mask_w = mask_shape[-2], mask_shape[-1]
    
    img_h, img_w = orig_shape[0], orig_shape[1]  # 假设是 [H, W, C] 格式
    
    if mask_h != img_h or mask_w != img_w:
        print(f"[MASK ERROR] 遮罩尺寸不匹配！")
        print(f"  遮罩: ({mask_h}, {mask_w}), 图像: ({img_h}, {img_w})")
        return original_image  # 直接返回原图，不应用任何效果
    
    # 反转遮罩（如果需要）
    if invert_mask:
        mask = 1.0 - mask
    
    # 去除小区域（去噪）
    if remove_small_areas:
        if mask.dim() == 2:
            mask = remove_small_mask_areas(mask, min_area_threshold)
        elif mask.dim() == 3 and mask.shape[-1] == 1:
            # 如果是3D但只有一个通道，处理该通道
            mask_2d = mask[..., 0]
            mask_2d = remove_small_mask_areas(mask_2d, min_area_threshold)
            mask = mask_2d.unsqueeze(-1)
    
    # 扩展遮罩维度以匹配图像
    if mask.dim() == 2:
        # 2D遮罩 (H, W) -> (H, W, C)
        mask = mask.unsqueeze(-1)
    elif mask.dim() == 3:
        # 检查是否为 [C, H, W] 格式
        if mask.shape[0] == 1 or mask.shape[0] < mask.shape[2]:
            # [C, H, W] -> [H, W, C]
            mask = mask.permute(1, 2, 0)
        
        if mask.shape[-1] > 1:
            # 如果遮罩有多个通道，只使用第一个通道
            mask = mask[..., :1]
    
    # 确保遮罩扩展到所有颜色通道
    if mask.shape[-1] != original_image.shape[-1]:
        mask = mask.expand(-1, -1, original_image.shape[-1])
    
    # 简单的形状匹配检查
    if mask.shape != original_image.shape:
        print(f"[MASK DEBUG] 需要调整形状: {mask.shape} -> {original_image.shape}")
        # 只进行简单的维度扩展，不进行插值
        try:
            mask = mask.expand_as(original_image)
            print(f"[MASK DEBUG] 通过expand匹配成功")
        except RuntimeError as e:
            print(f"[MASK ERROR] 无法通过expand匹配形状: {e}")
            return original_image  # 如果无法匹配，返回原图
    
    # 确保遮罩值在0-1范围内
    mask = mask.clamp(0, 1)
    
    
    # 混合图像
    # 遮罩值为1的地方应用处理后的图像，遮罩值为0的地方保留原始图像
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


def remove_small_mask_areas(mask, min_area_threshold=100):
    """
    去除遮罩中的小区域（噪点）
    
    Args:
        mask: 2D遮罩 tensor
        min_area_threshold: 最小区域面积阈值
    
    Returns:
        清理后的遮罩 tensor
    """
    # 转换为numpy数组
    mask_np = mask.cpu().numpy()
    
    # 二值化遮罩
    binary_mask = (mask_np > 0.5).astype(np.uint8) * 255
    
    # 使用OpenCV进行连通组件分析
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_mask, connectivity=8)
    
    # 创建清理后的遮罩
    cleaned_mask = np.zeros_like(binary_mask)
    
    # 只保留面积大于阈值的区域（跳过背景标签0）
    removed_count = 0
    kept_count = 0
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area >= min_area_threshold:
            cleaned_mask[labels == i] = 255
            kept_count += 1
        else:
            removed_count += 1
    
    print(f"[MASK CLEANUP] Kept {kept_count} regions, removed {removed_count} small regions (threshold: {min_area_threshold}px)")
    
    # 转换回0-1范围的float
    cleaned_mask = cleaned_mask.astype(np.float32) / 255.0
    
    # 转换回tensor，保持原始的值范围
    cleaned_mask_tensor = torch.from_numpy(cleaned_mask).to(mask.device)
    
    # 应用原始遮罩的值（不只是二值）
    result = mask * cleaned_mask_tensor
    
    return result
