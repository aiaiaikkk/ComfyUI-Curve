"""
ComfyUI-Curve - Professional Image Adjustment Tools
Advanced curve, levels, HSL, and camera raw adjustments for ComfyUI

Version: 1.0.0
Author: aiaiaikkk
Repository: https://github.com/aiaiaikkk/ComfyUI-Curve
License: MIT
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, WEB_DIRECTORY, NODE_CLASS_TO_JS_FILE

# Version information
__version__ = "1.0.0"
__author__ = "aiaiaikkk"
__description__ = "Professional image adjustment tools for ComfyUI"

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

