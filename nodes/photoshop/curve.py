"""
Photoshop风格曲线调整节点

提供与Adobe Photoshop曲线调整工具类似的功能：
- RGB、红、绿、蓝通道独立调整
- 基于控制点的曲线调整
- 遮罩支持和羽化功能
- 实时预览功能
"""

import torch
import numpy as np
from PIL import Image
import io
import base64

from ..core.base_node import BaseImageNode
from ..core.mask_utils import apply_mask_to_image, blur_mask
from ..core.preset_manager import preset_manager


class PhotoshopCurveNode(BaseImageNode):
    """PS风格的曲线调整节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'rgb_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': 'RGB曲线控制点，格式：[[x1,y1],[x2,y2],...]'
                }),
                'red_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': '红色通道曲线控制点'
                }),
                'green_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': '绿色通道曲线控制点'
                }),
                'blue_curve': ('STRING', {
                    'default': '[[0,0],[255,255]]',
                    'display': 'hidden',
                    'tooltip': '蓝色通道曲线控制点'
                }),
                'curve_type': (['cubic', 'linear'], {
                    'default': 'cubic',
                    'tooltip': '曲线插值类型'
                }),
                'strength': ('FLOAT', {
                    'default': 100.0,
                    'min': 0.0,
                    'max': 200.0,
                    'step': 1.0,
                    'display': 'number',
                    'tooltip': '调整效果强度，100为完整效果，0为无效果'
                }),
            },
            'optional': {
                'preset_curve_points': ('STRING', {
                    'default': None,
                    'tooltip': '来自CurvePresetNode的预设曲线点，格式：x1,y1;x2,y2;...'
                }),
                'preset_suggested_channel': ('STRING', {
                    'default': None,
                    'tooltip': '来自CurvePresetNode的建议通道：RGB/Red/Green/Blue'
                }),
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，调整仅对遮罩区域有效'
                }),
                'mask_blur': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 50.0,
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
            }
        }
    
    RETURN_TYPES = ('IMAGE', 'IMAGE')
    RETURN_NAMES = ('image', 'curve_chart')
    FUNCTION = 'apply_curve_adjustment'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    def apply_curve_adjustment(self, image, rgb_curve='[[0,0],[255,255]]', 
                               red_curve='[[0,0],[255,255]]', green_curve='[[0,0],[255,255]]', 
                               blue_curve='[[0,0],[255,255]]', curve_type='cubic', strength=100.0,
                               preset_curve_points=None, preset_suggested_channel=None,
                               mask=None, mask_blur=0.0, invert_mask=False, unique_id=None, **kwargs):
        """应用曲线调整"""
        
        try:
            # 参数验证和类型转换
            try:
                if isinstance(mask_blur, str):
                    mask_blur = float(mask_blur) if mask_blur.strip() else 0.0
                elif mask_blur is None:
                    mask_blur = 0.0
            except (ValueError, AttributeError):
                mask_blur = 0.0
                
            # 验证 invert_mask 参数
            if isinstance(invert_mask, str):
                invert_mask = invert_mask.lower() in ('true', '1', 'yes', 'on')
            elif invert_mask is None:
                invert_mask = False
                
            # 处理来自CurvePresetNode的预设曲线点
            if preset_curve_points is not None and preset_curve_points.strip():
                converted_curve = self._convert_preset_points_to_curve_format(preset_curve_points)
                
                # 根据建议通道自动应用到对应通道
                if preset_suggested_channel and preset_suggested_channel.strip():
                    channel = preset_suggested_channel.strip()
                    if channel == 'RGB':
                        rgb_curve = converted_curve
                        print(f"📐 预设曲线应用到RGB通道: {preset_curve_points}")
                    elif channel == 'Red':
                        red_curve = converted_curve
                        print(f"📐 预设曲线应用到红色通道: {preset_curve_points}")
                    elif channel == 'Green':
                        green_curve = converted_curve
                        print(f"📐 预设曲线应用到绿色通道: {preset_curve_points}")
                    elif channel == 'Blue':
                        blue_curve = converted_curve
                        print(f"📐 预设曲线应用到蓝色通道: {preset_curve_points}")
                    else:
                        # 默认应用到RGB通道
                        rgb_curve = converted_curve
                        print(f"📐 预设曲线应用到RGB通道(默认): {preset_curve_points}")
                else:
                    # 没有建议通道，默认应用到RGB通道
                    rgb_curve = converted_curve
                    print(f"📐 预设曲线应用到RGB通道(无建议): {preset_curve_points}")
            
            # 发送预览到前端
            if unique_id is not None:
                self.send_preview_to_frontend(image, unique_id, "photoshop_curve_preview", mask)
            
            # 支持批处理
            if len(image.shape) == 4:
                processed_image = self.process_batch_images(
                    image, 
                    self._process_single_image,
                    rgb_curve, red_curve, green_curve, blue_curve, curve_type, strength,
                    mask, mask_blur, invert_mask
                )
                # 使用第一张图像生成曲线图表
                curve_chart = self._generate_curve_chart(
                    processed_image[0], rgb_curve, red_curve, green_curve, blue_curve, curve_type
                )
                # 确保curve_chart有正确的批次维度
                if len(curve_chart.shape) == 3:
                    curve_chart = curve_chart.unsqueeze(0)
                return (processed_image, curve_chart)
            else:
                result = self._process_single_image(
                    image, rgb_curve, red_curve, green_curve, blue_curve, curve_type, strength,
                    mask, mask_blur, invert_mask
                )
                # 生成曲线图表
                curve_chart = self._generate_curve_chart(
                    result, rgb_curve, red_curve, green_curve, blue_curve, curve_type
                )
                # 确保curve_chart有正确的批次维度
                if len(curve_chart.shape) == 3:
                    curve_chart = curve_chart.unsqueeze(0)
                return (result.unsqueeze(0) if len(result.shape) == 3 else result, curve_chart)
        except Exception as e:
            print(f"PhotoshopCurveNode error: {e}")
            import traceback
            traceback.print_exc()
            # 错误时返回原图和空白图表
            blank_chart = self._create_blank_chart()
            if len(blank_chart.shape) == 3:
                blank_chart = blank_chart.unsqueeze(0)
            # 确保image也有正确的批次维度
            if len(image.shape) == 3:
                image = image.unsqueeze(0)
            return (image, blank_chart)
    
    def _process_single_image(self, image, rgb_curve, red_curve, green_curve, blue_curve, curve_type, strength,
                              mask, mask_blur, invert_mask):
        """处理单张图像的曲线调整"""
        import json
        from scipy.interpolate import interp1d
        
        device = image.device
        
        # 解析曲线数据
        try:
            rgb_points = json.loads(rgb_curve)
            red_points = json.loads(red_curve)
            green_points = json.loads(green_curve)
            blue_points = json.loads(blue_curve)
        except:
            # 如果解析失败，使用默认的线性曲线
            rgb_points = [[0,0],[255,255]]
            red_points = [[0,0],[255,255]]
            green_points = [[0,0],[255,255]]
            blue_points = [[0,0],[255,255]]
        
        # 检查是否需要处理
        is_identity = (
            self._is_identity_curve(rgb_points) and
            self._is_identity_curve(red_points) and
            self._is_identity_curve(green_points) and
            self._is_identity_curve(blue_points)
        )
        
        # 只有在没有遮罩且是恒等曲线时才返回原图
        if is_identity and mask is None:
            return image
        
        # 转换图像到numpy
        img_np = (image.detach().cpu().numpy() * 255.0).astype(np.uint8)
        result_np = img_np.copy()
        
        # 创建查找表
        rgb_lut = self._create_lut(rgb_points, curve_type)
        red_lut = self._create_lut(red_points, curve_type)
        green_lut = self._create_lut(green_points, curve_type)
        blue_lut = self._create_lut(blue_points, curve_type)
        
        # 应用曲线调整（即使是恒等曲线，当有遮罩时也需要处理）
        if not is_identity or mask is not None:
            if not self._is_identity_curve(rgb_points):
                # 应用RGB曲线到所有通道
                result_np[:,:,0] = rgb_lut[result_np[:,:,0]]
                result_np[:,:,1] = rgb_lut[result_np[:,:,1]]
                result_np[:,:,2] = rgb_lut[result_np[:,:,2]]
            
            # 应用独立通道曲线
            if not self._is_identity_curve(red_points):
                result_np[:,:,0] = red_lut[result_np[:,:,0]]
            if not self._is_identity_curve(green_points):
                result_np[:,:,1] = green_lut[result_np[:,:,1]]
            if not self._is_identity_curve(blue_points):
                result_np[:,:,2] = blue_lut[result_np[:,:,2]]
        
        # 转换回tensor
        result = torch.from_numpy(result_np.astype(np.float32) / 255.0).to(device)
        
        # 应用强度混合
        if strength < 100.0:
            strength_ratio = strength / 100.0
            result = image * (1.0 - strength_ratio) + result * strength_ratio
        
        # 应用遮罩
        if mask is not None:
            if mask_blur > 0:
                mask = blur_mask(mask, mask_blur)
            result = apply_mask_to_image(image, result, mask, invert_mask)
        
        return result
    
    def _is_identity_curve(self, points):
        """检查是否为恒等曲线"""
        if len(points) != 2:
            return False
        return points[0] == [0, 0] and points[1] == [255, 255]
    
    def _create_lut(self, points, curve_type):
        """创建查找表"""
        from scipy.interpolate import interp1d
        
        if len(points) < 2:
            # 默认线性曲线
            return np.arange(256, dtype=np.uint8)
        
        # 排序控制点
        points = sorted(points, key=lambda x: x[0])
        
        
        # 提取x和y坐标
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        
        # 确保边界点
        if x_coords[0] > 0:
            x_coords.insert(0, 0)
            y_coords.insert(0, 0)
        if x_coords[-1] < 255:
            x_coords.append(255)
            y_coords.append(255)
        
        # 创建插值函数
        try:
            if curve_type == 'cubic' and len(x_coords) > 3:
                # 对于cubic插值，需要至少4个点
                interp_func = interp1d(x_coords, y_coords, kind='cubic', bounds_error=False, fill_value='extrapolate')
            elif curve_type == 'cubic' and len(x_coords) == 3:
                # 3个点时使用quadratic插值
                interp_func = interp1d(x_coords, y_coords, kind='quadratic', bounds_error=False, fill_value='extrapolate')
            else:
                # 2个点或更少时使用linear插值
                interp_func = interp1d(x_coords, y_coords, kind='linear', bounds_error=False, fill_value='extrapolate')
        except Exception as e:
            # 如果插值失败，回退到线性插值
            print(f"插值创建失败，使用线性插值: {e}")
            interp_func = interp1d(x_coords, y_coords, kind='linear', bounds_error=False, fill_value='extrapolate')
        
        # 生成查找表
        x_range = np.arange(256)
        lut = interp_func(x_range)
        lut = np.clip(lut, 0, 255).astype(np.uint8)
        
        return lut
    
    def _create_blank_chart(self):
        """创建空白图表"""
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_agg import FigureCanvasAgg
        
        fig, ax = plt.subplots(figsize=(5, 5), facecolor='#1a1a1a')
        ax.set_facecolor('#2a2a2a')
        ax.text(0.5, 0.5, 'No Data', ha='center', va='center', 
                color='white', fontsize=20, transform=ax.transAxes)
        ax.set_xlim(0, 255)
        ax.set_ylim(0, 255)
        
        canvas = FigureCanvasAgg(fig)
        canvas.draw()
        buf = canvas.buffer_rgba()
        w, h = canvas.get_width_height()
        chart_np = np.frombuffer(buf, np.uint8).reshape(h, w, 4)[:, :, :3]
        plt.close(fig)
        
        # 确保返回正确的形状 [H, W, C]
        chart_tensor = torch.from_numpy(chart_np.astype(np.float32) / 255.0)
        return chart_tensor
    
    def _generate_curve_chart(self, image, rgb_curve, red_curve, green_curve, blue_curve, curve_type):
        """生成曲线与直方图的复合图表"""
        import json
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_agg import FigureCanvasAgg
        import matplotlib.patches as mpatches
        
        # 设置matplotlib样式
        plt.style.use('dark_background')
        
        try:
            # 解析曲线数据
            rgb_points = json.loads(rgb_curve) if isinstance(rgb_curve, str) else rgb_curve
            red_points = json.loads(red_curve) if isinstance(red_curve, str) else red_curve
            green_points = json.loads(green_curve) if isinstance(green_curve, str) else green_curve
            blue_points = json.loads(blue_curve) if isinstance(blue_curve, str) else blue_curve
        except:
            rgb_points = [[0,0],[255,255]]
            red_points = [[0,0],[255,255]]
            green_points = [[0,0],[255,255]]
            blue_points = [[0,0],[255,255]]
        
        # 创建图形
        fig = plt.figure(figsize=(8, 8), facecolor='#0a0a0a', dpi=100)
        ax = fig.add_subplot(111)
        ax.set_facecolor('#141414')
        
        # 计算处理后图像的直方图
        img_np = (image.detach().cpu().numpy() * 255.0).astype(np.uint8)
        
        # 计算RGB通道直方图
        hist_r, _ = np.histogram(img_np[:,:,0], bins=256, range=(0, 256))
        hist_g, _ = np.histogram(img_np[:,:,1], bins=256, range=(0, 256))
        hist_b, _ = np.histogram(img_np[:,:,2], bins=256, range=(0, 256))
        
        # 计算亮度直方图
        luminance = (0.299 * img_np[:,:,0] + 0.587 * img_np[:,:,1] + 0.114 * img_np[:,:,2]).astype(np.uint8)
        hist_lum, _ = np.histogram(luminance, bins=256, range=(0, 256))
        
        # 归一化直方图到0-255范围
        max_val = max(hist_r.max(), hist_g.max(), hist_b.max())
        if max_val > 0:
            scale_factor = 180 / max_val  # 最大高度180像素
            hist_r = hist_r.astype(float) * scale_factor
            hist_g = hist_g.astype(float) * scale_factor
            hist_b = hist_b.astype(float) * scale_factor
            hist_lum = hist_lum.astype(float) * scale_factor
        
        # 绘制网格 - 更细致的网格
        for i in range(0, 256, 32):
            ax.axvline(i, color='#2a2a2a', linewidth=0.5, alpha=0.5)
            ax.axhline(i, color='#2a2a2a', linewidth=0.5, alpha=0.5)
        
        # 主要网格线
        for i in [0, 64, 128, 192, 255]:
            ax.axvline(i, color='#3a3a3a', linewidth=1, alpha=0.7)
            ax.axhline(i, color='#3a3a3a', linewidth=1, alpha=0.7)
        
        # 绘制对角线参考
        ax.plot([0, 255], [0, 255], color='#555555', linewidth=1.5, alpha=0.8, linestyle='--')
        
        # 绘制直方图 - 使用渐变效果
        x = np.arange(256)
        
        # 绘制RGB通道直方图
        ax.fill_between(x, 0, hist_r, color='#ff4444', alpha=0.2)
        ax.fill_between(x, 0, hist_g, color='#44ff44', alpha=0.2)
        ax.fill_between(x, 0, hist_b, color='#4444ff', alpha=0.2)
        
        # 绘制亮度直方图轮廓
        ax.plot(x, hist_lum, color='#888888', linewidth=1, alpha=0.5)
        
        # 绘制曲线 - 使用更鲜艳的颜色
        curves_drawn = []
        
        # RGB曲线
        if not self._is_identity_curve(rgb_points):
            rgb_lut = self._create_lut(rgb_points, curve_type)
            ax.plot(x, rgb_lut, color='#ffffff', linewidth=3, label='RGB', zorder=10)
            curves_drawn.append(('RGB', '#ffffff'))
        
        # 单独通道曲线
        if not self._is_identity_curve(red_points):
            red_lut = self._create_lut(red_points, curve_type)
            ax.plot(x, red_lut, color='#ff6666', linewidth=2.5, label='R', zorder=9)
            curves_drawn.append(('R', '#ff6666'))
        
        if not self._is_identity_curve(green_points):
            green_lut = self._create_lut(green_points, curve_type)
            ax.plot(x, green_lut, color='#66ff66', linewidth=2.5, label='G', zorder=9)
            curves_drawn.append(('G', '#66ff66'))
        
        if not self._is_identity_curve(blue_points):
            blue_lut = self._create_lut(blue_points, curve_type)
            ax.plot(x, blue_lut, color='#6666ff', linewidth=2.5, label='B', zorder=9)
            curves_drawn.append(('B', '#6666ff'))
        
        # 设置轴
        ax.set_xlim(-5, 260)
        ax.set_ylim(-5, 260)
        ax.set_xlabel('Input', color='#cccccc', fontsize=14, fontweight='bold')
        ax.set_ylabel('Output', color='#cccccc', fontsize=14, fontweight='bold')
        
        # 设置标题
        ax.set_title('Curve Adjustment Analysis', color='#ffffff', fontsize=18, 
                    fontweight='bold', pad=20)
        
        # 设置刻度
        ax.set_xticks([0, 64, 128, 192, 255])
        ax.set_yticks([0, 64, 128, 192, 255])
        ax.tick_params(colors='#999999', labelsize=11)
        
        # 自定义图例
        if curves_drawn:
            legend_elements = [mpatches.Patch(facecolor=color, edgecolor=color, label=name) 
                             for name, color in curves_drawn]
            legend = ax.legend(handles=legend_elements, loc='upper left', 
                             framealpha=0.9, facecolor='#1a1a1a', 
                             edgecolor='#444444', fontsize=12)
            legend.get_frame().set_linewidth(1.5)
            
            # 设置图例文字颜色
            for text in legend.get_texts():
                text.set_color('#ffffff')
        
        # 添加边框
        for spine in ax.spines.values():
            spine.set_edgecolor('#444444')
            spine.set_linewidth(1.5)
        
        # 调整布局
        plt.tight_layout(pad=2.0)
        
        # 渲染图形到numpy数组
        canvas = FigureCanvasAgg(fig)
        canvas.draw()
        buf = canvas.buffer_rgba()
        w, h = canvas.get_width_height()
        
        # 转换为numpy数组
        chart_np = np.frombuffer(buf, np.uint8).reshape(h, w, 4)
        chart_np = chart_np[:, :, :3]  # 移除alpha通道
        
        # 转换为torch tensor
        chart_tensor = torch.from_numpy(chart_np.astype(np.float32) / 255.0).to(image.device)
        
        # 清理
        plt.close(fig)
        plt.style.use('default')  # 恢复默认样式
        
        return chart_tensor
    
    def _convert_preset_points_to_curve_format(self, preset_points):
        """
        将CurvePresetNode的格式转换为PhotoshopCurveNode的格式
        输入格式: 'x1,y1;x2,y2;x3,y3;...'
        输出格式: '[[x1,y1],[x2,y2],[x3,y3],...]'
        """
        try:
            # 解析预设点格式：'0,0;64,85;128,155;...'
            points = []
            
            # 分割各个点
            point_pairs = preset_points.split(';')
            
            for pair in point_pairs:
                if ',' in pair:
                    x_str, y_str = pair.split(',')
                    x = int(float(x_str.strip()))
                    y = int(float(y_str.strip()))
                    points.append([x, y])
            
            # 转换为JSON格式字符串
            import json
            curve_format = json.dumps(points)
            
            print(f"🔄 曲线格式转换: {preset_points} -> {curve_format}")
            return curve_format
            
        except Exception as e:
            print(f"❌ 曲线格式转换失败: {e}")
            return '[[0,0],[255,255]]'  # 返回默认直线