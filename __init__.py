from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, WEB_DIRECTORY, NODE_CLASS_TO_JS_FILE

# 确保所有必需的变量都被正确导出
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY', 'NODE_CLASS_TO_JS_FILE']

# API路由注册
try:
    from server import PromptServer
    from .nodes.core.api_handler import PresetAPIHandler
    
    # 注册API路由
    if hasattr(PromptServer, 'instance') and PromptServer.instance and hasattr(PromptServer.instance, 'app'):
        PresetAPIHandler.setup_routes(PromptServer.instance.app)
    else:
        # 延迟注册
        import threading
        def delayed_setup():
            import time
            time.sleep(2)
            try:
                from server import PromptServer
                if hasattr(PromptServer, 'instance') and PromptServer.instance and hasattr(PromptServer.instance, 'app'):
                    PresetAPIHandler.setup_routes(PromptServer.instance.app)
            except:
                pass
        
        thread = threading.Thread(target=delayed_setup)
        thread.daemon = True
        thread.start()
        
except Exception as e:
    print(f"⚠️ 预设API注册时出错: {e}")

# 调试信息
print("🎨 ComfyUI-Curve 插件加载中...")
print(f"🎨 节点类映射: {list(NODE_CLASS_MAPPINGS.keys())}")
print(f"🎨 显示名称映射: {list(NODE_DISPLAY_NAME_MAPPINGS.keys())}")
print(f"🎨 Web目录: {WEB_DIRECTORY}")
print(f"🎨 JS文件映射: {NODE_CLASS_TO_JS_FILE}")
print("🎨 ComfyUI-Curve 插件加载完成！")