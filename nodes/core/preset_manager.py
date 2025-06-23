"""
预设管理器
处理曲线预设的保存、加载和管理
"""

import os
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
import aiofiles
try:
    from server import PromptServer
except ImportError:
    print("⚠️ 警告: 无法导入PromptServer，预设功能将不可用")
    PromptServer = None
from PIL import Image
import base64
import io

class PresetManager:
    """预设管理器类"""
    
    def __init__(self, preset_dir="presets"):
        self.preset_dir = Path(__file__).parent.parent.parent / preset_dir
        self.user_dir = self.preset_dir / "user"
        self.default_dir = self.preset_dir / "default"
        self.shared_dir = self.preset_dir / "shared"
        
        # 确保目录存在
        for dir_path in [self.user_dir, self.default_dir, self.shared_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # 设置路由
        self._setup_routes()
    
    def _setup_routes(self):
        """设置API路由"""
        if not PromptServer:
            print("⚠️ PromptServer不可用，跳过路由设置")
            return
            
        # 确保PromptServer实例存在
        if not hasattr(PromptServer, 'instance') or not PromptServer.instance:
            print("⚠️ PromptServer实例未初始化，跳过路由设置")
            return
            
        routes = PromptServer.instance.routes
        
        # 保存预设
        @routes.post("/curve_presets/save")
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
                    'curves': data.get('curves', {}),
                    'strength': data.get('strength', 100),
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
                
                return {"success": True, "id": preset_id, "message": "预设保存成功"}
            
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        # 获取预设列表
        @routes.get("/curve_presets/list")
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
                
                return {"success": True, "presets": presets}
            
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        # 加载单个预设
        @routes.get("/curve_presets/load/{preset_id}")
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
                            return {"success": True, "preset": preset_data}
                
                return {"success": False, "error": "预设未找到"}
            
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        # 删除预设
        @routes.delete("/curve_presets/delete/{preset_id}")
        async def delete_preset(request):
            try:
                preset_id = request.match_info['preset_id']
                
                # 只允许删除用户预设
                file_path = self.user_dir / f"{preset_id}.json"
                if file_path.exists():
                    file_path.unlink()
                    return {"success": True, "message": "预设删除成功"}
                
                return {"success": False, "error": "预设未找到或无权删除"}
            
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        # 更新预设
        @routes.put("/curve_presets/update/{preset_id}")
        async def update_preset(request):
            try:
                preset_id = request.match_info['preset_id']
                data = await request.json()
                
                # 只允许更新用户预设
                file_path = self.user_dir / f"{preset_id}.json"
                if file_path.exists():
                    # 读取现有数据
                    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        preset_data = json.loads(content)
                    
                    # 更新数据
                    preset_data.update({
                        'name': data.get('name', preset_data.get('name')),
                        'description': data.get('description', preset_data.get('description')),
                        'category': data.get('category', preset_data.get('category')),
                        'tags': data.get('tags', preset_data.get('metadata', {}).get('tags', [])),
                        'updated_at': datetime.now().isoformat()
                    })
                    
                    # 保存更新
                    async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(preset_data, indent=2, ensure_ascii=False))
                    
                    return {"success": True, "message": "预设更新成功"}
                
                return {"success": False, "error": "预设未找到或无权更新"}
            
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        # 导出预设
        @routes.get("/curve_presets/export/{preset_id}")
        async def export_preset(request):
            try:
                preset_id = request.match_info['preset_id']
                
                # 查找预设文件
                for dir_path in [self.default_dir, self.user_dir, self.shared_dir]:
                    file_path = dir_path / f"{preset_id}.json"
                    if file_path.exists():
                        async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                            content = await f.read()
                        
                        # 返回文件内容供下载
                        return {
                            "success": True,
                            "content": content,
                            "filename": f"curve_preset_{preset_id}.json"
                        }
                
                return {"success": False, "error": "预设未找到"}
            
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        # 导入预设
        @routes.post("/curve_presets/import")
        async def import_preset(request):
            try:
                data = await request.json()
                preset_content = data.get('content', '')
                
                # 解析预设数据
                preset_data = json.loads(preset_content)
                
                # 生成新ID避免冲突
                new_id = str(uuid.uuid4())
                preset_data['id'] = new_id
                preset_data['imported_at'] = datetime.now().isoformat()
                
                # 保存到用户目录
                file_path = self.user_dir / f"{new_id}.json"
                async with aiofiles.open(file_path, 'w', encoding='utf-8') as f:
                    await f.write(json.dumps(preset_data, indent=2, ensure_ascii=False))
                
                return {"success": True, "id": new_id, "message": "预设导入成功"}
            
            except Exception as e:
                return {"success": False, "error": str(e)}

# 创建全局预设管理器实例
preset_manager = PresetManager()