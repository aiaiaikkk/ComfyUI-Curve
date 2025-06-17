from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS, WEB_DIRECTORY, NODE_CLASS_TO_JS_FILE

# 确保所有必需的变量都被正确导出
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY', 'NODE_CLASS_TO_JS_FILE']

# 调试信息
print("🎨 ComfyUI-Curve 插件加载中...")
print(f"🎨 节点类映射: {list(NODE_CLASS_MAPPINGS.keys())}")
print(f"🎨 显示名称映射: {list(NODE_DISPLAY_NAME_MAPPINGS.keys())}")
print(f"🎨 Web目录: {WEB_DIRECTORY}")
print(f"🎨 JS文件映射: {NODE_CLASS_TO_JS_FILE}")
print("🎨 ComfyUI-Curve 插件加载完成！")