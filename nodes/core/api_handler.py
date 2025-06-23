"""
ComfyUI兼容的API处理器
"""
import os
import json
import uuid
from datetime import datetime
from pathlib import Path

class PresetAPIHandler:
    @staticmethod
    def setup_routes(app):
        """设置预设管理路由"""
        from aiohttp import web
        
        # 预设目录
        base_dir = Path(__file__).parent.parent.parent
        preset_dir = base_dir / "presets"
        user_dir = preset_dir / "user"
        default_dir = preset_dir / "default"
        
        # 确保目录存在
        for d in [preset_dir, user_dir, default_dir]:
            d.mkdir(parents=True, exist_ok=True)
        
        async def save_preset(request):
            """保存预设"""
            try:
                data = await request.json()
                preset_id = str(uuid.uuid4())
                
                preset_data = {
                    "id": preset_id,
                    "name": data.get("name", "未命名"),
                    "description": data.get("description", ""),
                    "category": data.get("category", "custom"),
                    "created_at": datetime.now().isoformat(),
                    "curves": data.get("curves", {}),
                    "strength": data.get("strength", 100),
                    "metadata": {
                        "tags": data.get("tags", []),
                        "thumbnail": ""
                    }
                }
                
                # 保存文件
                file_path = user_dir / f"{preset_id}.json"
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(preset_data, f, indent=2, ensure_ascii=False)
                
                return web.Response(
                    text=json.dumps({"success": True, "id": preset_id}),
                    content_type='application/json'
                )
                
            except Exception as e:
                print(f"保存预设失败: {e}")
                import traceback
                traceback.print_exc()
                return web.Response(
                    text=json.dumps({"success": False, "error": str(e)}),
                    content_type='application/json',
                    status=200  # 使用200状态码避免CORS问题
                )
        
        async def list_presets(request):
            """列出预设"""
            try:
                presets = []
                
                for preset_type, dir_path in [("default", default_dir), ("user", user_dir)]:
                    if dir_path.exists():
                        for file_path in dir_path.glob("*.json"):
                            try:
                                with open(file_path, "r", encoding="utf-8") as f:
                                    preset = json.load(f)
                                    preset["type"] = preset_type
                                    presets.append(preset)
                            except:
                                pass
                
                return web.Response(
                    text=json.dumps({"success": True, "presets": presets}),
                    content_type='application/json'
                )
                
            except Exception as e:
                return web.Response(
                    text=json.dumps({"success": False, "error": str(e)}),
                    content_type='application/json'
                )
        
        async def load_preset(request):
            """加载预设"""
            try:
                preset_id = request.match_info.get("preset_id")
                
                for dir_path in [default_dir, user_dir]:
                    file_path = dir_path / f"{preset_id}.json"
                    if file_path.exists():
                        with open(file_path, "r", encoding="utf-8") as f:
                            preset = json.load(f)
                        return web.Response(
                            text=json.dumps({"success": True, "preset": preset}),
                            content_type='application/json'
                        )
                
                return web.Response(
                    text=json.dumps({"success": False, "error": "未找到"}),
                    content_type='application/json'
                )
                
            except Exception as e:
                return web.Response(
                    text=json.dumps({"success": False, "error": str(e)}),
                    content_type='application/json'
                )
        
        async def delete_preset(request):
            """删除预设"""
            try:
                preset_id = request.match_info.get("preset_id")
                file_path = user_dir / f"{preset_id}.json"
                
                if file_path.exists():
                    file_path.unlink()
                    return web.Response(
                        text=json.dumps({"success": True}),
                        content_type='application/json'
                    )
                
                return web.Response(
                    text=json.dumps({"success": False, "error": "未找到"}),
                    content_type='application/json'
                )
                
            except Exception as e:
                return web.Response(
                    text=json.dumps({"success": False, "error": str(e)}),
                    content_type='application/json'
                )
        
        # 注册路由
        app.router.add_post("/curve_presets/save", save_preset)
        app.router.add_get("/curve_presets/list", list_presets)
        app.router.add_get("/curve_presets/load/{preset_id}", load_preset)
        app.router.add_delete("/curve_presets/delete/{preset_id}", delete_preset)
        
        print("✅ 预设API路由注册完成")