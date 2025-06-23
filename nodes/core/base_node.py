"""
基础节点类

提供所有节点的通用功能和接口
"""

import torch
import numpy as np
from PIL import Image
import io
import base64

class BaseImageNode:
    """基础图像处理节点"""
    
    RETURN_TYPES = ('IMAGE',)
    FUNCTION = 'process'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    def __init__(self):
        pass
    
    def tensor_to_pil(self, tensor):
        """将PyTorch tensor转换为PIL图像"""
        if tensor.dim() == 4:
            tensor = tensor.squeeze(0)
        
        # 确保tensor在0-1范围内
        tensor = torch.clamp(tensor, 0, 1)
        
        # 转换为numpy数组
        np_image = (tensor.cpu().numpy() * 255).astype(np.uint8)
        
        if np_image.shape[2] == 3:
            return Image.fromarray(np_image, mode='RGB')
        elif np_image.shape[2] == 4:
            return Image.fromarray(np_image, mode='RGBA')
        else:
            return Image.fromarray(np_image[:,:,0], mode='L')
    
    def pil_to_tensor(self, pil_image):
        """将PIL图像转换为PyTorch tensor"""
        np_image = np.array(pil_image).astype(np.float32) / 255.0
        
        if len(np_image.shape) == 2:
            np_image = np.stack([np_image] * 3, axis=-1)
        elif np_image.shape[2] == 4:
            # 处理RGBA，移除alpha通道或转换为RGB
            np_image = np_image[:, :, :3]
            
        tensor = torch.from_numpy(np_image)
        return tensor.unsqueeze(0)
    
    def apply_mask_blur(self, mask, blur_radius):
        """应用遮罩模糊"""
        if blur_radius <= 0:
            return mask
            
        import cv2
        
        # 转换为numpy数组
        if isinstance(mask, torch.Tensor):
            mask_np = (mask.cpu().numpy() * 255).astype(np.uint8)
        else:
            mask_np = mask
            
        # 应用高斯模糊
        ksize = int(blur_radius * 2) * 2 + 1  # 确保是奇数
        blurred = cv2.GaussianBlur(mask_np, (ksize, ksize), blur_radius)
        
        # 转换回tensor
        if isinstance(mask, torch.Tensor):
            return torch.from_numpy(blurred.astype(np.float32) / 255.0)
        else:
            return blurred
    
    def send_preview_to_frontend(self, image, node_id, event_name, mask=None):
        """发送预览图像到前端"""
        try:
            from server import PromptServer
            
            # 转换图像为base64
            preview_image = image[0] if image.dim() == 4 else image
            pil_img = self.tensor_to_pil(preview_image)
            
            buffer = io.BytesIO()
            pil_img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            send_data = {
                "node_id": str(node_id),
                "image": f"data:image/png;base64,{img_base64}"
            }
            
            # 处理遮罩
            if mask is not None:
                preview_mask = mask[0] if mask.dim() == 3 else mask
                mask_pil = Image.fromarray((preview_mask.cpu().numpy() * 255).astype(np.uint8), mode='L')
                
                mask_buffer = io.BytesIO()
                mask_pil.save(mask_buffer, format='PNG')
                mask_base64 = base64.b64encode(mask_buffer.getvalue()).decode('utf-8')
                send_data["mask"] = f"data:image/png;base64,{mask_base64}"
            
            # 发送事件
            PromptServer.instance.send_sync(event_name, send_data)
            print(f"✅ 已发送{event_name}预览数据到前端，节点ID: {node_id}")
            
        except Exception as e:
            print(f"发送预览数据失败: {e}")
    
    def process_batch_images(self, images, process_func, *args, **kwargs):
        """批处理图像"""
        if len(images.shape) == 4:
            batch_size = images.shape[0]
            result = torch.zeros_like(images)
            
            # 特殊处理mask参数
            # 在大多数节点中，mask是第6个位置参数（索引5）
            mask_in_args = False
            mask_index = 5  # mask通常在第6个参数位置
            
            if len(args) > mask_index and isinstance(args[mask_index], (torch.Tensor, type(None))):
                mask_in_args = True
                mask = args[mask_index]
            else:
                # 检查kwargs
                mask = kwargs.get('mask', None)
            
            for i in range(batch_size):
                # 准备当前批次的参数
                batch_args = list(args)
                
                # 处理mask
                if mask is not None:
                    print(f"[BATCH DEBUG] 批次 {i}: 处理遮罩")
                    print(f"  原始mask shape: {mask.shape if hasattr(mask, 'shape') else type(mask)}")
                    print(f"  batch_size: {batch_size}")
                    
                    if isinstance(mask, torch.Tensor):
                        if mask.dim() == 3 and mask.shape[0] == batch_size:
                            # mask是批处理的，取对应的mask
                            current_mask = mask[i]
                            print(f"  选择批处理遮罩[{i}]: {current_mask.shape}")
                        elif mask.dim() == 2:
                            # mask是单个的2D，对所有批次使用
                            current_mask = mask
                            print(f"  使用2D遮罩: {current_mask.shape}")
                        elif mask.dim() == 3 and mask.shape[0] == 1:
                            # mask是单个的3D，展开使用
                            current_mask = mask[0]
                            print(f"  展开3D遮罩: {current_mask.shape}")
                        elif mask.dim() == 3 and mask.shape[0] > 1:
                            # 多个mask但数量不等于batch_size，使用第一个
                            current_mask = mask[0]
                            print(f"  使用多遮罩第一个: {current_mask.shape}")
                        elif mask.dim() == 4:
                            # 4D mask，取对应批次
                            if mask.shape[0] == batch_size:
                                current_mask = mask[i]
                            else:
                                current_mask = mask[0]
                            print(f"  4D遮罩处理: {current_mask.shape}")
                        else:
                            current_mask = mask
                            print(f"  其他情况遮罩: {current_mask.shape if hasattr(current_mask, 'shape') else type(current_mask)}")
                    else:
                        current_mask = mask
                        print(f"  非tensor遮罩: {type(current_mask)}")
                    
                    # 更新参数中的mask
                    if mask_in_args and len(batch_args) > mask_index:
                        batch_args[mask_index] = current_mask
                    else:
                        kwargs['mask'] = current_mask
                
                # 处理当前图像
                print(f"[BATCH DEBUG] 调用process_func:")
                print(f"  image[{i}] shape: {images[i].shape}")
                print(f"  batch_args中mask位置({mask_index}): {batch_args[mask_index].shape if mask_in_args and len(batch_args) > mask_index and hasattr(batch_args[mask_index], 'shape') else 'N/A'}")
                print(f"  kwargs中mask: {kwargs.get('mask').shape if 'mask' in kwargs and hasattr(kwargs['mask'], 'shape') else 'N/A'}")
                
                result[i] = process_func(images[i], *batch_args, **kwargs)
            
            return result
        else:
            return process_func(images, *args, **kwargs)