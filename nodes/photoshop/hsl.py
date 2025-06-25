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
import json
import uuid
from datetime import datetime
from pathlib import Path

try:
    from server import PromptServer
    from aiohttp import web
    import aiofiles
    
    # 简单的HSL预设管理器
    class HSLPresetManager:
        def __init__(self):
            self.preset_dir = Path(__file__).parent.parent.parent / "presets" / "hsl"
            self.user_dir = self.preset_dir / "user"
            self.default_dir = self.preset_dir / "default"
            self.shared_dir = self.preset_dir / "shared"
            
            # 确保目录存在
            for dir_path in [self.user_dir, self.default_dir, self.shared_dir]:
                dir_path.mkdir(parents=True, exist_ok=True)
            
            self._setup_routes()
        
        def _setup_routes(self):
            """设置API路由"""
            if not PromptServer or not hasattr(PromptServer, 'instance') or not PromptServer.instance:
                return
                
            routes = PromptServer.instance.routes
            
            @routes.get("/hsl_presets/list")
            async def list_presets(request):
                try:
                    presets = []
                    
                    # 扫描所有预设目录
                    for preset_type, dir_path in [
                        ('default', self.default_dir),
                        ('user', self.user_dir),
                        ('shared', self.shared_dir)
                    ]:
                        if dir_path.exists():
                            for file_path in dir_path.glob("*.json"):
                                try:
                                    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                                        content = await f.read()
                                        preset_data = json.loads(content)
                                        preset_data['type'] = preset_type
                                        preset_data['file_name'] = file_path.name
                                        presets.append(preset_data)
                                except Exception as e:
                                    print(f"Error loading preset {file_path}: {e}")
                    
                    # 按创建时间排序
                    presets.sort(key=lambda x: x.get('created_at', ''), reverse=True)
                    
                    return web.json_response({"success": True, "presets": presets})
                
                except Exception as e:
                    return web.json_response({"success": False, "error": str(e)})
            
            @routes.post("/hsl_presets/save")
            async def save_preset(request):
                try:
                    data = await request.json()
                    preset_id = data.get('id', str(uuid.uuid4()))
                    preset_type = data.get('type', 'user')
                    
                    # 构建预设数据
                    preset_data = {
                        'id': preset_id,
                        'name': data.get('name', 'Untitled Preset'),
                        'description': data.get('description', ''),
                        'category': data.get('category', 'custom'),
                        'created_at': datetime.now().isoformat(),
                        'author': data.get('author', 'Anonymous'),
                        'version': '1.0',
                        'node_type': 'hsl',
                        'parameters': data.get('parameters', {}),
                        'metadata': {
                            'tags': data.get('tags', []),
                            'thumbnail': data.get('thumbnail', '')
                        }
                    }
                    
                    # 确定保存目录
                    save_dir = self.user_dir if preset_type == 'user' else self.shared_dir
                    file_path = save_dir / f"{preset_id}.json"
                    
                    # 保存文件
                    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(preset_data, indent=2, ensure_ascii=False))
                    
                    return web.json_response({"success": True, "id": preset_id, "message": "预设保存成功"})
                
                except Exception as e:
                    return web.json_response({"success": False, "error": str(e)})
            
            @routes.get("/hsl_presets/load/{preset_id}")
            async def load_preset(request):
                try:
                    preset_id = request.match_info['preset_id']
                    
                    # 在所有目录中查找预设
                    for dir_path in [self.default_dir, self.user_dir, self.shared_dir]:
                        file_path = dir_path / f"{preset_id}.json"
                        if file_path.exists():
                            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                                content = await f.read()
                                preset_data = json.loads(content)
                                return web.json_response({"success": True, "preset": preset_data})
                    
                    return web.json_response({"success": False, "error": "预设未找到"})
                
                except Exception as e:
                    return web.json_response({"success": False, "error": str(e)})
            
            @routes.delete("/hsl_presets/delete/{preset_id}")
            async def delete_preset(request):
                try:
                    preset_id = request.match_info['preset_id']
                    
                    # 只允许删除用户预设
                    file_path = self.user_dir / f"{preset_id}.json"
                    if file_path.exists():
                        file_path.unlink()
                        return web.json_response({"success": True, "message": "预设删除成功"})
                    
                    return web.json_response({"success": False, "error": "预设未找到或无权删除"})
                
                except Exception as e:
                    return web.json_response({"success": False, "error": str(e)})
            
            @routes.get("/hsl_presets/export/{preset_id}")
            async def export_preset(request):
                try:
                    preset_id = request.match_info['preset_id']
                    
                    # 在所有目录中查找预设
                    for dir_path in [self.default_dir, self.user_dir, self.shared_dir]:
                        file_path = dir_path / f"{preset_id}.json"
                        if file_path.exists():
                            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                                content = await f.read()
                                preset_data = json.loads(content)
                                
                                # 添加导出信息
                                preset_data['exported_at'] = datetime.now().isoformat()
                                preset_data['exported_from'] = 'ComfyUI-HSL'
                                
                                return web.json_response({
                                    "success": True,
                                    "preset": preset_data,
                                    "filename": f"{preset_data['name'].replace(' ', '_')}_hsl_preset.json"
                                })
                    
                    return web.json_response({"success": False, "error": "预设未找到"})
                
                except Exception as e:
                    return web.json_response({"success": False, "error": str(e)})
            
            @routes.post("/hsl_presets/import")
            async def import_preset(request):
                try:
                    data = await request.json()
                    preset_data = data.get('preset_data')
                    
                    if not preset_data:
                        return web.json_response({"success": False, "error": "无效的预设数据"})
                    
                    # 验证预设类型
                    if preset_data.get('node_type') != 'hsl':
                        return web.json_response({"success": False, "error": "预设类型不匹配，需要hsl类型"})
                    
                    # 生成新ID
                    preset_id = str(uuid.uuid4())
                    preset_data['id'] = preset_id
                    preset_data['imported_at'] = datetime.now().isoformat()
                    preset_data['type'] = 'user'  # 导入的预设总是用户预设
                    
                    # 保存到用户目录
                    file_path = self.user_dir / f"{preset_id}.json"
                    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(preset_data, indent=2, ensure_ascii=False))
                    
                    return web.json_response({"success": True, "id": preset_id, "message": "预设导入成功"})
                
                except Exception as e:
                    return web.json_response({"success": False, "error": str(e)})
    
    # 创建HSL预设管理器实例
    hsl_preset_manager = HSLPresetManager()
    
except ImportError:
    print("⚠️ 警告: 无法导入预设管理依赖，预设功能将不可用")
    hsl_preset_manager = None


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
        
        if not needs_processing and mask is None:
            # 如果没有任何调整且没有遮罩，直接转换回RGB并返回
            img_bgr = cv2.cvtColor(img_hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
            if has_alpha:
                img_rgba = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGBA)
                img_rgba[:,:,3] = alpha_channel
                result = torch.from_numpy(img_rgba.astype(np.float32) / 255.0).to(device)
            else:
                img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
                result = torch.from_numpy(img_rgb.astype(np.float32) / 255.0).to(device)
            return result
        
        # 基于OpenCV HSV真实分布的精确颜色范围定义
        # OpenCV HSV: 0°=红, 30°=黄, 60°=绿, 90°=青, 120°=蓝, 150°=洋红
        color_ranges = {
            'red': [(0, 10), (170, 179)],     # 红色：0度附近 (已校准)
            'orange': [(10, 25)],             # 橙色：15度附近 (红-黄之间)
            'yellow': [(25, 45)],             # 黄色：30度附近 ±15度
            'green': [(45, 85)],              # 绿色：60度附近 ±25度 **修正**
            'cyan': [(85, 105)],              # 青色：90度附近 ±15度 **修正**
            'blue': [(105, 135)],             # 蓝色：120度附近 ±15度 **修正**
            'purple': [(135, 155)],           # 紫色：135-155度 **修正**
            'magenta': [(155, 170)]           # 洋红：155-170度 **修正**
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
        
        # 获取饱和度通道，用于过滤低饱和度像素
        saturation_channel = img_hsv[:,:,1]
        
        # 定义饱和度阈值 - 匹配Photoshop行为
        # 低于此阈值的像素被认为是"灰色"，不应该受色相调整影响
        SATURATION_THRESHOLD = 15  # 可以根据需要调整，PS大约在10-20之间
        
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
            
            # 重要修复：只对饱和度足够高的像素应用遮罩
            # 这样可以避免对灰色像素进行不必要的色相调整
            saturation_mask = (saturation_channel >= SATURATION_THRESHOLD).astype(np.float32)
            range_mask = range_mask * saturation_mask
            
            # 添加到总遮罩
            mask = np.maximum(mask, range_mask)
        
        # 只在有遮罩的地方进行调整，提高性能
        if np.any(mask > 0):
            result = img_hsv.copy()
            
            # 只对有遮罩的像素进行调整
            mask_indices = mask > 0
            
            if hue_shift != 0:
                # 基于Photoshop行为的色相映射
                def get_precise_hue_mapping(input_degrees):
                    """将-100到+100的输入映射到实际的色相变化
                    Photoshop中，-100到+100通常对应约-60到+60度的色相变化"""
                    # 直接线性映射：-100到+100 映射到 -60到+60
                    # 这样用户输入-100时会得到-60度的旋转，更符合预期
                    return input_degrees * 0.6
                
                hue_adjustment = get_precise_hue_mapping(hue_shift)
                
                current_hue = result[mask_indices, 0]
                new_hue = current_hue + hue_adjustment
                
                # 正确处理色相环绕（确保结果在0-179范围内）
                # 先转换当前色相到360度范围，进行调整，再转回OpenCV范围
                current_hue_360 = current_hue * 2  # 转换到360度范围
                adjusted_hue_360 = current_hue_360 + hue_adjustment  # 应用调整
                
                # 环绕处理：确保在0-360范围内（使用模运算）
                adjusted_hue_360 = adjusted_hue_360 % 360
                
                new_hue = adjusted_hue_360 / 2  # 转回OpenCV范围(0-179)
                
                result[mask_indices, 0] = new_hue
            
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