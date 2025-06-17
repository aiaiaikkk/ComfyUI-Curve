import torch
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
import io
from scipy.interpolate import CubicSpline
from comfy.model_management import get_torch_device
import matplotlib
matplotlib.use('Agg')  # 使用非交互式后端
import base64
from server import PromptServer

# 获取当前设备
def get_torch_device():
    return torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# 添加全局缓存字典，用于存储每个节点实例的直方图数据
_histogram_cache = {}

class PhotoshopCurveNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'interpolation': (['linear', 'cubic', 'monotonic'], {'default': 'cubic'}),
                'channel': (['RGB', 'R', 'G', 'B'], {'default': 'RGB'}),
            },
            'optional': {
                'curve_points': ('STRING', {
                    'default': '0,0;255,255', 
                    'multiline': False,
                    'placeholder': 'Format: x1,y1;x2,y2;x3,y3'
                }),
                'curve_strength': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.0,
                    'max': 2.0,
                    'step': 0.1,
                    'display': 'slider'
                }),
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，调色仅对遮罩区域有效'
                }),
                'mask_blur': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 20.0,
                    'step': 0.1,
                    'display': 'slider',
                    'tooltip': '遮罩边缘羽化程度'
                }),
                'invert_mask': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '反转遮罩区域'
                }),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('IMAGE', 'IMAGE', 'STRING')
    RETURN_NAMES = ('image', 'curve_chart', 'histogram_data')
    FUNCTION = 'apply_curve'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, image, interpolation, channel, curve_points='0,0;128,128;255,255', curve_strength=1.0, mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        mask_hash = "none" if mask is None else str(hash(mask.data.tobytes()) if hasattr(mask, 'data') else hash(str(mask)))
        return f"{curve_points}_{interpolation}_{channel}_{curve_strength}_{mask_hash}_{mask_blur}_{invert_mask}"

    def apply_curve(self, image, interpolation, channel, curve_points='0,0;255,255', curve_strength=1.0, mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        try:
            # 确保输入图像格式正确
            if image is None:
                raise ValueError("Input image is None")
            
            # 在处理前，先发送输入图像到前端（仅当有unique_id时）
            if unique_id is not None:
                try:
                    # 使用第一张图像进行预览
                    preview_image = image[0] if image.dim() == 4 else image
                    
                    # 转换为PIL图像
                    img_np = (preview_image.cpu().numpy() * 255).astype(np.uint8)
                    if img_np.shape[-1] == 3:
                        pil_img = Image.fromarray(img_np, mode='RGB')
                    elif img_np.shape[-1] == 4:
                        pil_img = Image.fromarray(img_np, mode='RGBA')
                    else:
                        pil_img = Image.fromarray(img_np[:,:,0], mode='L')
                    
                    # 转换为base64
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format='PNG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    # 发送图像数据事件
                    send_data = {
                        "node_id": str(unique_id),
                        "image": f"data:image/png;base64,{img_base64}"
                    }
                    
                    # 如果有遮罩，也发送遮罩数据
                    if mask is not None:
                        mask_preview = mask[0] if mask.dim() == 3 else mask
                        mask_np = (mask_preview.cpu().numpy() * 255).astype(np.uint8)
                        if mask_np.ndim == 2:
                            mask_pil = Image.fromarray(mask_np, mode='L')
                        else:
                            mask_pil = Image.fromarray(mask_np[:,:,0], mode='L')
                        
                        mask_buffer = io.BytesIO()
                        mask_pil.save(mask_buffer, format='PNG')
                        mask_base64 = base64.b64encode(mask_buffer.getvalue()).decode('utf-8')
                        send_data["mask"] = f"data:image/png;base64,{mask_base64}"
                    
                    # 使用PromptServer发送数据
                    PromptServer.instance.send_sync("photoshop_curve_preview", send_data)
                except Exception as e:
                    pass  # 静默失败，不影响正常处理
            
            # 处理批次维度
            if image.dim() == 4:  # Batch dimension exists
                batch_size = image.shape[0]
                results = []
                curve_charts = []
                
                # 取第一张图像生成直方图数据
                histogram_data = self._generate_histogram_json(image[0])
                
                for b in range(batch_size):
                    # 处理对应的遮罩
                    batch_mask = None
                    if mask is not None:
                        if mask.dim() == 3 and mask.shape[0] > b:
                            batch_mask = mask[b]
                        elif mask.dim() == 2:
                            batch_mask = mask
                        elif mask.dim() == 3 and mask.shape[0] == 1:
                            batch_mask = mask[0]
                    
                    result, curve_chart = self._process_single_image(
                        image[b], curve_points, interpolation, channel, curve_strength, 
                        batch_mask, mask_blur, invert_mask
                    )
                    results.append(result)
                    curve_charts.append(curve_chart)
                
                # 返回处理后的图像、曲线图和直方图数据
                return (torch.stack(results, dim=0), torch.stack(curve_charts, dim=0), histogram_data)
            else:
                # 生成直方图数据
                histogram_data = self._generate_histogram_json(image)
                
                result, curve_chart = self._process_single_image(
                    image, curve_points, interpolation, channel, curve_strength,
                    mask, mask_blur, invert_mask
                )
                
                # 返回处理后的图像、曲线图和直方图数据
                return (result.unsqueeze(0), curve_chart.unsqueeze(0), histogram_data)  # 添加批次维度
                
        except Exception as e:
            print(f"PhotoshopCurveNode error: {e}")
            # 返回原始图像作为fallback
            return (image, self._create_fallback_curve_chart().unsqueeze(0), "{}")
    
    def _process_single_image(self, image, curve_points, interpolation, channel, curve_strength, mask=None, mask_blur=0.0, invert_mask=False):
        # 确保图像在正确的设备上
        device = get_torch_device()
        image = image.to(device)
        
        # 处理图像维度 (HWC)
        if image.dim() == 3:
            h, w, c = image.shape
        else:
            raise ValueError(f"Unexpected image dimensions: {image.shape}")
        
        # 解析控制点
        control_points = self._parse_control_points(curve_points)
        if len(control_points) < 2:
            print("Warning: Less than 2 control points, using default curve")
            control_points = [(0, 0), (255, 255)]
        
        # 构建查找表
        lut = self._build_lookup_table(control_points, interpolation)
        
        # 应用曲线强度
        if curve_strength != 1.0:
            # 在原始值和曲线值之间插值
            identity_lut = np.arange(256, dtype=np.float32)
            lut = identity_lut * (1 - curve_strength) + lut * curve_strength
        
        # 应用LUT到图像
        result = self._apply_lut_to_image(image, lut, channel)
        
        # 处理遮罩
        if mask is not None:
            result = self._apply_mask(image, result, mask, mask_blur, invert_mask)
        
        # 生成曲线图像 - 从原始图像生成，但显示应用后的直方图
        # 这样可以在曲线预览中直接看到效果
        # 默认始终显示直方图，使用与曲线通道匹配的直方图通道
        curve_chart = self._generate_curve_chart(result, True, channel, control_points, interpolation, curve_strength)
        
        return result, curve_chart
    
    def _parse_control_points(self, curve_points_str):
        """解析控制点字符串"""
        points = []
        try:
            segments = curve_points_str.strip().split(';')
            for segment in segments:
                if not segment.strip():
                    continue
                parts = segment.strip().split(',')
                if len(parts) == 2:
                    x = float(parts[0])
                    y = float(parts[1])
                    # 限制在有效范围内
                    x = max(0, min(255, x))
                    y = max(0, min(255, y))
                    points.append((x, y))
        except Exception as e:
            print(f"Error parsing control points: {e}")
            return [(0, 0), (255, 255)]
        
        # 按x坐标排序
        points.sort(key=lambda p: p[0])
        
        # 确保有起始和结束点
        if not points or points[0][0] > 0:
            points.insert(0, (0, 0))
        if not points or points[-1][0] < 255:
            points.append((255, 255))
        
        return points
    
    def _build_lookup_table(self, control_points, interpolation):
        """构建查找表"""
        xs = [p[0] for p in control_points]
        ys = [p[1] for p in control_points]
        
        # 创建0-255的输入数组
        input_range = np.arange(256, dtype=np.float32)
        
        try:
            if interpolation == 'linear':
                lut = np.interp(input_range, xs, ys)
            elif interpolation == 'cubic':
                if len(xs) >= 2:
                    spline = CubicSpline(xs, ys, bc_type='natural')
                    lut = spline(input_range)
                else:
                    lut = np.interp(input_range, xs, ys)
            elif interpolation == 'monotonic':
                if len(xs) >= 2:
                    # 使用单调三次样条
                    spline = CubicSpline(xs, ys, bc_type='clamped')
                    lut = spline(input_range)
                    # 确保单调性（如果需要）
                    lut = np.maximum.accumulate(lut)
                else:
                    lut = np.interp(input_range, xs, ys)
            else:
                lut = np.interp(input_range, xs, ys)
                
        except Exception as e:
            print(f"Error building LUT: {e}, falling back to linear interpolation")
            lut = np.interp(input_range, xs, ys)
        
        # 确保LUT在有效范围内
        lut = np.clip(lut, 0, 255).astype(np.float32)
        return lut
    
    def _apply_lut_to_image(self, image, lut, channel):
        """将LUT应用到图像"""
        device = image.device
        
        # 将图像值缩放到0-255范围进行LUT查找
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 创建输出图像
        output = torch.zeros_like(img_255)
        
        # 转换LUT为tensor
        lut_tensor = torch.tensor(lut, device=device, dtype=torch.float32)
        
        # 根据通道设置应用LUT
        num_channels = img_255.shape[-1]
        
        for c in range(num_channels):
            channel_name = ['R', 'G', 'B'][c] if num_channels == 3 else str(c)
            
            if channel == 'RGB' or channel_name == channel:
                # 获取当前通道的像素值
                channel_data = img_255[..., c]
                
                # 将像素值转换为整数索引
                indices = channel_data.long().clamp(0, 255)
                
                # 使用LUT进行映射
                output[..., c] = lut_tensor[indices]
            else:
                # 不处理的通道保持原值
                output[..., c] = img_255[..., c]
        
        # 将结果缩放回0-1范围
        result = (output / 255.0).clamp(0, 1)
        
        return result

    def _apply_mask(self, original_image, processed_image, mask, mask_blur, invert_mask):
        """应用遮罩，混合原图和处理后的图像"""
        device = original_image.device
        h, w = original_image.shape[:2]
        
        # 处理遮罩
        if mask is None:
            return processed_image
        
        # 确保遮罩在正确的设备上
        mask = mask.to(device)
        
        # 处理遮罩维度，确保与图像匹配
        if mask.dim() == 2:
            # 遮罩是 (H, W)
            if mask.shape[0] != h or mask.shape[1] != w:
                # 调整遮罩尺寸以匹配图像
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0), 
                    size=(h, w), 
                    mode='bilinear', 
                    align_corners=False
                ).squeeze(0).squeeze(0)
        elif mask.dim() == 3:
            # 遮罩是 (1, H, W) 或 (H, W, 1)
            if mask.shape[0] == 1:
                mask = mask.squeeze(0)
            elif mask.shape[2] == 1:
                mask = mask.squeeze(2)
            
            # 再次检查尺寸
            if mask.shape[0] != h or mask.shape[1] != w:
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0), 
                    size=(h, w), 
                    mode='bilinear', 
                    align_corners=False
                ).squeeze(0).squeeze(0)
        
        # 确保遮罩值在 [0, 1] 范围内
        mask = torch.clamp(mask, 0.0, 1.0)
        
        # 反转遮罩（如果需要）
        if invert_mask:
            mask = 1.0 - mask
        
        # 应用高斯模糊羽化效果
        if mask_blur > 0.0:
            mask = self._apply_gaussian_blur(mask, mask_blur)
        
        # 扩展遮罩维度以匹配图像通道 (H, W) -> (H, W, C)
        if original_image.dim() == 3:
            mask = mask.unsqueeze(-1).expand(-1, -1, original_image.shape[2])
        
        # 混合原图和处理后的图像
        # result = original * (1 - mask) + processed * mask
        result = original_image * (1.0 - mask) + processed_image * mask
        
        return result
    
    def _apply_gaussian_blur(self, tensor, blur_radius):
        """对tensor应用高斯模糊"""
        if blur_radius <= 0:
            return tensor
        
        device = tensor.device
        
        # 计算高斯核大小（奇数）
        kernel_size = int(blur_radius * 2) * 2 + 1
        sigma = blur_radius / 3.0
        
        # 创建1D高斯核
        x = torch.arange(kernel_size, dtype=torch.float32, device=device) - kernel_size // 2
        gauss_1d = torch.exp(-0.5 * (x / sigma) ** 2)
        gauss_1d = gauss_1d / gauss_1d.sum()
        
        # 创建2D高斯核
        gauss_2d = gauss_1d.unsqueeze(0) * gauss_1d.unsqueeze(1)
        gauss_2d = gauss_2d.unsqueeze(0).unsqueeze(0)  # (1, 1, kernel_size, kernel_size)
        
        # 添加padding以保持尺寸
        padding = kernel_size // 2
        
        # 应用卷积
        blurred = torch.nn.functional.conv2d(
            tensor.unsqueeze(0).unsqueeze(0),  # (1, 1, H, W)
            gauss_2d,
            padding=padding
        ).squeeze(0).squeeze(0)  # (H, W)
        
        return blurred

    def _generate_curve_chart(self, image, show_histogram, channel, control_points=None, interpolation='cubic', curve_strength=1.0):
        """生成曲线图表可视化"""
        try:
            # 创建图表
            fig, ax = plt.subplots(figsize=(6, 6))
            
            # 设置背景颜色
            fig.patch.set_facecolor('#2a2a2a')
            ax.set_facecolor('#1a1a1a')
            
            # 设置坐标轴范围
            ax.set_xlim(0, 255)
            ax.set_ylim(0, 255)
            
            # 添加网格
            ax.grid(True, color='#444444', alpha=0.5, linestyle='-', linewidth=0.5)
            
            # 设置坐标轴标签
            ax.set_xlabel('Input', color='#cccccc')
            ax.set_ylabel('Output', color='#cccccc')
            
            # 设置刻度颜色
            ax.tick_params(axis='x', colors='#cccccc')
            ax.tick_params(axis='y', colors='#cccccc')
            
            # 设置边框颜色
            for spine in ax.spines.values():
                spine.set_color('#555555')
            
            # 添加通道渐变背景
            self._add_gradient_background(ax, channel)
            
            # 添加直方图背景
            # 始终显示直方图，使用与曲线通道匹配的直方图通道
            self._draw_histogram_background(ax, image, channel)
            
            # 绘制对角线参考线
            ax.plot([0, 255], [0, 255], color='#555555', linestyle='--', alpha=0.7)
            
            # 如果有控制点，绘制曲线
            if control_points and len(control_points) >= 2:
                # 根据插值方法生成曲线
                if interpolation == 'linear':
                    # 线性插值
                    x = [p[0] for p in control_points]
                    y = [p[1] for p in control_points]
                    ax.plot(x, y, '-', color='#4ecdc4', linewidth=2)
                else:
                    # 样条插值
                    x = np.array([p[0] for p in control_points])
                    y = np.array([p[1] for p in control_points])
                    
                    # 确保x是严格递增的
                    if len(x) > 1 and np.all(np.diff(x) > 0):
                        # 生成插值点
                        x_interp = np.linspace(0, 255, 256)
                        
                        if interpolation == 'cubic':
                            # 三次样条插值
                            try:
                                cs = CubicSpline(x, y)
                                y_interp = cs(x_interp)
                                # 限制在0-255范围内
                                y_interp = np.clip(y_interp, 0, 255)
                                ax.plot(x_interp, y_interp, '-', color='#4ecdc4', linewidth=2)
                            except Exception as e:
                                print(f"Cubic spline interpolation error: {e}")
                                # 退回到线性插值
                                ax.plot(x, y, '-', color='#4ecdc4', linewidth=2)
                        elif interpolation == 'monotonic':
                            # 单调样条插值 - 使用PCHIP
                            try:
                                from scipy.interpolate import PchipInterpolator
                                pchip = PchipInterpolator(x, y)
                                y_interp = pchip(x_interp)
                                # 限制在0-255范围内
                                y_interp = np.clip(y_interp, 0, 255)
                                ax.plot(x_interp, y_interp, '-', color='#4ecdc4', linewidth=2)
                            except Exception as e:
                                print(f"Monotonic interpolation error: {e}")
                                # 退回到线性插值
                                ax.plot(x, y, '-', color='#4ecdc4', linewidth=2)
                    else:
                        # 如果x不是严格递增的，退回到线性插值
                        ax.plot(x, y, '-', color='#4ecdc4', linewidth=2)
                
                # 绘制控制点
                ax.plot([p[0] for p in control_points], [p[1] for p in control_points], 'o', 
                        color='white', markeredgecolor='#4ecdc4', markersize=6)
            
            # 添加标题，包括当前通道和插值方法
            title = f"Curve: {channel} ({interpolation})"
            if curve_strength != 1.0:
                title += f", Strength: {curve_strength:.1f}"
            ax.set_title(title, color='white')
            
            # 将图表转换为PIL图像
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1, dpi=100)
            buf.seek(0)
            img = Image.open(buf).convert('RGB')
            
            # 关闭matplotlib图表，释放内存
            plt.close(fig)
            
            # 转换为tensor
            img_np = np.array(img).astype(np.float32) / 255.0
            return torch.from_numpy(img_np)
            
        except Exception as e:
            print(f"Error generating curve chart: {e}")
            return self._create_fallback_curve_chart()
    
    def _add_gradient_background(self, ax, channel_name):
        """添加渐变背景"""
        # 创建渐变背景
        gradient_colors = {
            'RGB': ['#ffffff', '#000000'],
            'R': ['#ff0000', '#000000'],
            'G': ['#00ff00', '#000000'],
            'B': ['#0000ff', '#000000'],
            'Luminance': ['#ffffff', '#000000']
        }
        
        colors = gradient_colors.get(channel_name, ['#ffffff', '#000000'])
        
        # 创建渐变
        import matplotlib.colors as mcolors
        import matplotlib.cm as cm
        
        cmap = mcolors.LinearSegmentedColormap.from_list('custom_gradient', colors)
        gradient = np.linspace(0, 1, 256)
        gradient = np.vstack((gradient, gradient))
        
        # 在坐标轴底部添加渐变条
        gradient_rect = ax.imshow(gradient, aspect='auto', cmap=cmap, 
                                 extent=[0, 255, -20, 0], alpha=0.3)

    def _draw_histogram_background(self, ax, image, channel):
        """绘制直方图背景"""
        try:
            # 将图像转换为NumPy数组
            img_np = image.cpu().numpy()
            
            # 将图像缩放到0-255范围
            img_255 = (img_np * 255.0).clip(0, 255)
            
            # 根据通道选择绘制直方图
            if channel == 'RGB':
                # 为RGB通道分别绘制直方图
                colors = ['red', 'green', 'blue']
                for i, color in enumerate(colors):
                    if i < img_255.shape[2]:
                        channel_data = img_255[:, :, i].flatten()
                        hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                        
                        # 归一化直方图高度
                        hist_max = np.max(hist) if np.max(hist) > 0 else 1
                        hist_normalized = hist / hist_max * 50  # 缩放到合适的高度
                        
                        # 绘制直方图
                        ax.fill_between(bins[:-1], hist_normalized, alpha=0.3, color=color)
            elif channel in ['R', 'G', 'B']:
                # 绘制单一通道直方图
                channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
                colors = {'R': 'red', 'G': 'green', 'B': 'blue'}
                color = colors.get(channel, 'white')
                
                if channel_idx < img_255.shape[2]:
                    channel_data = img_255[:, :, channel_idx].flatten()
                    hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                    
                    # 归一化直方图高度
                    hist_max = np.max(hist) if np.max(hist) > 0 else 1
                    hist_normalized = hist / hist_max * 50  # 缩放到合适的高度
                    
                    # 绘制直方图
                    ax.fill_between(bins[:-1], hist_normalized, alpha=0.4, color=color)
            else:
                # 默认显示亮度直方图
                if img_255.shape[2] >= 3:
                    luminance = (img_255[:, :, 0] * 0.299 + 
                               img_255[:, :, 1] * 0.587 + 
                               img_255[:, :, 2] * 0.114)
                    
                    hist, bins = np.histogram(luminance.flatten(), bins=256, range=(0, 255))
                    
                    # 归一化直方图高度
                    hist_max = np.max(hist) if np.max(hist) > 0 else 1
                    hist_normalized = hist / hist_max * 50  # 缩放到合适的高度
                    
                    # 绘制直方图
                    ax.fill_between(bins[:-1], hist_normalized, alpha=0.4, color='gray')
        
        except Exception as e:
            print(f"Error drawing histogram background: {e}")

    def _create_fallback_curve_chart(self):
        """创建备用曲线图像"""
        try:
            # 创建一个简单的错误图像
            fig, ax = plt.subplots(figsize=(5, 5))
            
            # 设置背景颜色
            fig.patch.set_facecolor('#2a2a2a')
            ax.set_facecolor('#1a1a1a')
            
            # 设置坐标轴范围
            ax.set_xlim(0, 255)
            ax.set_ylim(0, 255)
            
            # 添加网格
            ax.grid(True, color='#444444', alpha=0.5, linestyle='-', linewidth=0.5)
            
            # 绘制对角线
            ax.plot([0, 255], [0, 255], color='#555555', linestyle='--', alpha=0.7)
            
            # 添加错误文本
            ax.text(128, 128, "Error generating curve chart", 
                    color='white', fontsize=12, ha='center', va='center')
            
            # 将图表转换为PIL图像
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1, dpi=100)
            buf.seek(0)
            img = Image.open(buf).convert('RGB')
            
            # 关闭matplotlib图表，释放内存
            plt.close(fig)
            
            # 转换为tensor
            img_np = np.array(img).astype(np.float32) / 255.0
            return torch.from_numpy(img_np)
            
        except Exception as e:
            print(f"Error creating fallback curve chart: {e}")
            # 如果连备用图表都无法创建，返回一个黑色图像
            empty_chart = torch.zeros((256, 256, 3), dtype=torch.float32)
            return empty_chart
    
    def _generate_histogram_json(self, image):
        """生成直方图JSON数据 - 简化版本，不再需要histogram_channel参数"""
        try:
            # 将图像转换为0-255范围
            img_255 = (image.cpu().numpy() * 255.0).astype(np.uint8)
            
            # 创建直方图数据
            histogram_data = {}
            
            # 处理RGB通道
            for i, channel_name in enumerate(['R', 'G', 'B']):
                if i < img_255.shape[2]:
                    channel_data = img_255[:, :, i].flatten()
                    hist, _ = np.histogram(channel_data, bins=256, range=(0, 255))
                    histogram_data[channel_name] = hist.tolist()
            
            # 计算亮度通道
            if img_255.shape[2] >= 3:
                luminance = (img_255[:, :, 0] * 0.299 + 
                           img_255[:, :, 1] * 0.587 + 
                           img_255[:, :, 2] * 0.114).astype(np.uint8)
                hist, _ = np.histogram(luminance.flatten(), bins=256, range=(0, 255))
                histogram_data['Luminance'] = hist.tolist()
            
            # 转换为JSON字符串
            import json
            return json.dumps(histogram_data)
        except Exception as e:
            print(f"Error generating histogram JSON: {e}")
            return "{}"

class CurvePresetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'preset_style': ([
                    'Linear (无调整)',
                    
                    # 基础风格（效果明显）
                    '人像专用', '风景专用', '夜景专用',
                    
                    # 对比度系列（效果最明显）
                    '高对比度', '超高对比', '柔和对比', '暗调风格', '亮调风格',
                    
                    # 电影级调色（风格化强烈）
                    '电影蓝橙', '赛博朋克', '末日废土', '复古电影', '现代电影',
                    
                    # 胶片风格（复古感强烈）
                    'VSCO经典', '柯达胶片', '富士胶片', '宝丽来', '黑白胶片',
                    
                    # 日系风格（清新明显）
                    '日系清新', '日系通透', '日系奶油', '日系森系',
                    
                    # 港风系列（复古港片）
                    '港风经典', '港风暗调', '港风霓虹',
                    
                    # 社交媒体风格
                    '小红书', 'Instagram', 'TikTok流行',
                    
                    # 时尚摄影
                    '时尚杂志', '高级灰', '莫兰迪色', '奶茶色',
                    
                    # 艺术风格
                    '油画质感', '水彩画', '素描风格', '版画效果',
                    
                    # 特殊效果（效果强烈）
                    '梦幻紫调', '青春活力', '商业摄影', '婚纱摄影', '街拍风格',
                    
                    # 季节主题
                    '春日暖阳', '夏日清凉', '秋日金黄', '冬日雪景',
                    
                    # 极端效果（测试用）
                    '极端提亮', '极端压暗', '反转效果', 'S型增强',
                    
                    # === 人像摄影 ===
                    '人像美颜', '人像质感', '人像柔光',
                    
                    # === 风景摄影 ===
                    '风景增强', '自然风光', '山水画意',
                    
                    # === 电影风格 ===
                    '电影胶片', '电影冷调', '电影暖调',
                    
                    # === 复古风格 ===
                    '复古胶片', '复古暖调', '怀旧色调',
                    
                    # === 现代风格 ===
                    '现代简约', '科技感', '未来主义',
                    
                    # === 对比度系列 ===
                    '高对比度', '超高对比', '柔和对比', '暗调风格', '亮调风格'
                ], {'default': 'Linear (无调整)'}),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('curve_points',)
    FUNCTION = 'get_preset_curve'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, preset_style, unique_id=None):
        return f"{preset_style}"

    def get_preset_curves(self):
        """定义各种风格的预设曲线 - 优化版本，效果更明显"""
        return {
            'Linear (无调整)': '0,0;255,255',
            
            # === 基础风格（效果明显） ===
            '人像专用': '0,15;64,85;128,155;192,210;255,245',  # 提亮肤色，柔化对比
            '风景专用': '0,0;32,15;96,75;160,185;224,245;255,255',  # 增强天空和植物对比
            '夜景专用': '0,25;48,80;96,130;160,190;224,230;255,250',  # 大幅提亮暗部细节
            
            # === 对比度系列（效果最明显） ===
            '高对比度': '0,0;48,25;128,128;208,230;255,255',  # 强烈S型曲线
            '超高对比': '0,0;64,15;128,128;192,240;255,255',  # 极端对比效果
            '柔和对比': '0,20;64,80;128,140;192,200;255,240',  # 温和提升对比
            '暗调风格': '0,0;64,35;128,85;192,140;255,200',  # 整体压暗，营造氛围
            '亮调风格': '0,50;64,100;128,170;192,220;255,255',  # 大幅提亮，清新风格
            
            # === 电影级调色（风格化强烈） ===
            '电影蓝橙': '0,10;48,35;96,80;160,180;208,235;255,250',  # 经典电影色调
            '赛博朋克': '0,0;32,15;96,60;160,200;224,250;255,255',  # 科幻冷调
            '末日废土': '0,0;64,40;128,95;192,150;255,210',  # 荒凉暗调
            '复古电影': '0,5;48,45;96,90;160,170;224,220;255,245',  # 复古暖调
            '现代电影': '0,0;64,50;128,120;192,200;255,255',  # 现代冷调
            
            # === 胶片风格（复古感强烈） ===
            'VSCO经典': '0,20;32,50;96,110;160,180;224,230;255,245',  # 经典VSCO效果
            '柯达胶片': '0,25;48,70;96,125;160,185;224,230;255,245',  # 暖调胶片
            '富士胶片': '0,15;64,85;128,150;192,210;255,245',  # 清新胶片
            '宝丽来': '0,35;48,85;96,140;160,190;224,225;255,240',  # 复古即时成像
            '黑白胶片': '0,0;48,35;96,80;160,175;224,230;255,255',  # 黑白胶片质感
            
            # === 日系风格（清新明显） ===
            '日系清新': '0,35;64,100;128,170;192,225;255,250',  # 更明亮清新，与冬日雪景区分
            '日系通透': '0,40;48,90;96,145;144,190;192,225;255,250',  # 通透明亮
            '日系奶油': '0,45;48,100;96,155;144,200;192,235;255,250',  # 奶油质感
            '日系森系': '0,20;64,80;128,145;192,200;255,240',  # 更自然，与春日暖阳区分
            
            # === 港风系列（复古港片） ===
            '港风经典': '0,0;48,25;96,70;160,170;208,220;255,250',  # 经典港片色调
            '港风暗调': '0,0;32,10;96,55;160,140;224,190;255,230',  # 深沉港风
            '港风霓虹': '0,10;48,35;96,75;160,190;208,240;255,255',  # 霓虹夜景
            
            # === 社交媒体风格 ===
            '小红书': '0,30;64,90;128,155;192,220;255,250',  # 更温暖明亮，强化小红书特色
            'Instagram': '0,15;48,70;96,125;160,180;224,230;255,250',  # 更时尚现代，强化INS特色
            'TikTok流行': '0,15;64,90;128,160;192,220;255,248',  # 年轻活力
            
            # === 时尚摄影 ===
            '时尚杂志': '0,0;48,30;96,75;160,185;208,235;255,255',  # 时尚大片
            '高级灰': '0,25;64,80;128,135;192,190;255,240',  # 高级灰调
            '莫兰迪色': '0,40;64,95;128,150;192,205;255,235',  # 莫兰迪色调
            '奶茶色': '0,35;48,85;96,140;160,190;224,225;255,240',  # 温暖奶茶色
            
            # === 艺术风格 ===
            '油画质感': '0,10;48,60;96,115;160,170;224,220;255,245',  # 油画厚重感
            '水彩画': '0,40;64,105;128,170;192,220;255,245',  # 水彩透明感
            '素描风格': '0,0;64,45;128,105;192,165;255,220',  # 素描对比
            '版画效果': '0,0;32,15;96,65;160,155;224,210;255,240',  # 版画质感
            
            # === 特殊效果（效果强烈） ===
            '梦幻紫调': '0,20;48,75;96,135;160,190;224,235;255,250',  # 梦幻感
            '青春活力': '0,30;64,100;128,170;192,225;255,250',  # 活力四射
            '商业摄影': '0,5;48,55;96,105;160,185;224,240;255,255',  # 商业质感
            '婚纱摄影': '0,40;64,105;128,170;192,225;255,248',  # 更浪漫梦幻，与其他区分
            '街拍风格': '0,15;48,70;96,125;160,185;224,230;255,245',  # 街头感
            
            # === 季节主题 ===
            '春日暖阳': '0,30;64,95;128,165;192,220;255,245',  # 更温暖，与日系森系区分
            '夏日清凉': '0,20;48,80;96,140;160,200;224,240;255,250',  # 夏日清爽
            '秋日金黄': '0,15;48,65;96,115;160,175;224,225;255,245',  # 秋日金色
            '冬日雪景': '0,25;64,90;128,160;192,215;255,250',  # 调整为更冷峻，与日系清新区分
            
            # === 极端效果（测试用） ===
            '极端提亮': '0,80;64,140;128,190;192,230;255,255',  # 极端提亮效果
            '极端压暗': '0,0;64,20;128,60;192,120;255,180',  # 极端压暗效果
            '反转效果': '0,255;64,192;128,128;192,64;255,0',  # 反转色调
            'S型增强': '0,0;32,5;96,50;160,205;224,250;255,255',  # 强烈S型
            
            # === 人像摄影 ===
            '人像美颜': '0,25;48,85;96,140;160,190;224,230;255,245',  # 柔和美颜，与其他区分
            '人像质感': '0,10;48,60;96,110;160,175;224,225;255,250',  # 质感人像
            '人像柔光': '0,35;64,100;128,165;192,215;255,240',  # 柔光效果
            
            # === 风景摄影 ===
            '风景增强': '0,5;48,55;96,110;160,180;224,235;255,255',  # 风景对比增强，与商业摄影区分
            '自然风光': '0,15;64,85;128,150;192,205;255,245',  # 自然色彩
            '山水画意': '0,20;48,75;96,130;160,185;224,220;255,240',  # 山水意境
            
            # === 电影风格 ===
            '电影胶片': '0,15;48,65;96,120;160,175;224,215;255,240',  # 胶片质感，与秋日金黄区分
            '电影冷调': '0,0;48,30;96,80;160,160;224,210;255,245',  # 冷色调电影
            '电影暖调': '0,20;48,75;96,125;160,185;224,230;255,250',  # 暖色调电影
            
            # === 复古风格 ===
            '复古胶片': '0,10;48,55;96,105;160,165;224,205;255,235',  # 复古胶片，与电影胶片区分
            '复古暖调': '0,25;48,80;96,135;160,190;224,225;255,245',  # 复古暖色，与人像美颜区分
            '怀旧色调': '0,5;48,50;96,100;160,160;224,200;255,230',  # 怀旧感
            
            # === 现代风格 ===
            '现代简约': '0,20;64,85;128,145;192,200;255,245',  # 简约现代，与日系森系区分
            '科技感': '0,0;48,25;96,75;160,175;224,235;255,255',  # 科技冷峻，与港风经典区分
            '未来主义': '0,10;48,40;96,85;160,185;224,240;255,255',  # 未来感
            
            # === 对比度系列 ===
            '高对比度': '0,0;64,40;128,120;192,200;255,255',  # 强烈对比
            '超高对比': '0,0;48,20;128,128;208,235;255,255',  # 极端对比
            '柔和对比': '0,30;64,90;128,155;192,210;255,245',  # 柔和对比，与小红书区分
            '暗调风格': '0,0;64,35;128,90;192,150;255,200',  # 暗调处理
            '亮调风格': '0,50;64,110;128,175;192,220;255,250',  # 亮调处理
        }

    def get_preset_curve(self, preset_style, unique_id=None):
        try:
            # 获取预设曲线点
            preset_curves = self.get_preset_curves()
            curve_points = preset_curves.get(preset_style, '0,0;255,255')
            
            return (curve_points,)
            
        except Exception as e:
            print(f"CurvePresetNode error: {e}")
            return ('0,0;255,255',)

class HistogramAnalysisNode:
    """专业直方图分析节点 - 纯分析功能，不修改图像"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'channel': (['RGB', 'R', 'G', 'B', 'Luminance'], {'default': 'RGB'}),
            },
            'optional': {
                'histogram_bins': ('INT', {
                    'default': 256,
                    'min': 64,
                    'max': 1024,
                    'step': 1,
                    'tooltip': '直方图分组数量'
                }),
                'show_statistics': ('BOOLEAN', {
                    'default': True,
                    'tooltip': '显示详细统计信息'
                }),
                'export_data': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '导出原始直方图数据'
                }),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('IMAGE', 'STRING', 'STRING', 'STRING')
    RETURN_NAMES = ('histogram_image', 'histogram_data', 'statistics', 'raw_data')
    FUNCTION = 'analyze_histogram'
    CATEGORY = 'Image/Analysis'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, image, channel, histogram_bins=256, show_statistics=True, export_data=False, unique_id=None):
        return f"{channel}_{histogram_bins}_{show_statistics}_{export_data}"

    def analyze_histogram(self, image, channel, histogram_bins=256, show_statistics=True, export_data=False, unique_id=None):
        try:
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端（仅当有unique_id时）
            if unique_id is not None:
                try:
                    preview_image = image[0] if image.dim() == 4 else image
                    img_np = (preview_image.cpu().numpy() * 255).astype(np.uint8)
                    
                    if img_np.shape[-1] == 3:
                        pil_img = Image.fromarray(img_np, mode='RGB')
                    elif img_np.shape[-1] == 4:
                        pil_img = Image.fromarray(img_np, mode='RGBA')
                    else:
                        pil_img = Image.fromarray(img_np[:,:,0], mode='L')
                    
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format='PNG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    send_data = {
                        "node_id": str(unique_id),
                        "image": f"data:image/png;base64,{img_base64}",
                        "analysis_data": {
                            "channel": channel,
                            "histogram_bins": histogram_bins,
                            "show_statistics": show_statistics,
                            "export_data": export_data
                        }
                    }
                    
                    PromptServer.instance.send_sync("histogram_analysis_preview", send_data)
                    print(f"✅ 已发送直方图分析预览数据到前端，节点ID: {unique_id}")
                    
                except Exception as preview_error:
                    print(f"发送直方图分析预览时出错: {preview_error}")
            
            # 处理批次维度
            if image.dim() == 4:
                batch_size = image.shape[0]
                histogram_images = []
                histogram_data_list = []
                statistics_list = []
                raw_data_list = []
                
                for b in range(batch_size):
                    hist_image, hist_data, stats, raw_data = self._analyze_single_image(
                        image[b], channel, histogram_bins, show_statistics, export_data
                    )
                    histogram_images.append(hist_image)
                    histogram_data_list.append(hist_data)
                    statistics_list.append(stats)
                    raw_data_list.append(raw_data)
                
                combined_hist = "\n".join([f"Image {i+1}:\n{hist}" for i, hist in enumerate(histogram_data_list)])
                combined_stats = "\n".join([f"Image {i+1}:\n{stats}" for i, stats in enumerate(statistics_list)])
                combined_raw = "\n".join([f"Image {i+1}:\n{raw}" for i, raw in enumerate(raw_data_list)])
                
                return (torch.stack(histogram_images, dim=0), combined_hist, combined_stats, combined_raw)
            else:
                hist_image, hist_data, stats, raw_data = self._analyze_single_image(
                    image, channel, histogram_bins, show_statistics, export_data
                )
                return (hist_image.unsqueeze(0), hist_data, stats, raw_data)
                
        except Exception as e:
            print(f"HistogramAnalysisNode error: {e}")
            fallback_hist = self._create_fallback_histogram_image()
            return (fallback_hist, "Error generating histogram", "Error calculating statistics", "Error exporting data")
    
    def _analyze_single_image(self, image, channel, histogram_bins, show_statistics, export_data):
        device = get_torch_device()
        image = image.to(device)
        
        if image.dim() == 3:
            h, w, c = image.shape
        else:
            raise ValueError(f"Unexpected image dimensions: {image.shape}")
        
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 生成专业直方图可视化
        histogram_image = self._generate_professional_histogram_image(img_255, channel, histogram_bins)
        
        # 生成直方图数据
        histogram_data = self._generate_detailed_histogram_data(img_255, channel, histogram_bins)
        
        # 生成统计信息
        statistics = self._calculate_comprehensive_statistics(img_255, channel) if show_statistics else "Statistics disabled"
        
        # 导出原始数据
        raw_data = self._export_raw_histogram_data(img_255, channel, histogram_bins) if export_data else "Raw data export disabled"
        
        return histogram_image, histogram_data, statistics, raw_data
    
    def _generate_professional_histogram_image(self, img_255, channel, bins=256):
        """生成专业的直方图可视化图像"""
        img_np = img_255.cpu().numpy()
        
        # 创建高质量的直方图图像
        fig, ax = plt.subplots(figsize=(12, 8), facecolor='#2a2a2a')
        ax.set_facecolor('#1a1a1a')
        
        if channel == 'RGB':
            # RGB综合直方图
            colors = ['#ff6b6b', '#51cf66', '#74c0fc']
            labels = ['Red', 'Green', 'Blue']
            
            for i, (color, label) in enumerate(zip(colors, labels)):
                channel_data = img_np[:, :, i].flatten()
                hist, bin_edges = np.histogram(channel_data, bins=bins, range=(0, 255))
                bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
                ax.plot(bin_centers, hist, color=color, alpha=0.7, linewidth=2, label=label)
                ax.fill_between(bin_centers, hist, alpha=0.3, color=color)
        
        elif channel in ['R', 'G', 'B']:
            # 单通道直方图
            channel_idx = {'R': 0, 'G': 1, 'B': 2}[channel]
            color = {'R': '#ff6b6b', 'G': '#51cf66', 'B': '#74c0fc'}[channel]
            
            channel_data = img_np[:, :, channel_idx].flatten()
            hist, bin_edges = np.histogram(channel_data, bins=bins, range=(0, 255))
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
            ax.bar(bin_centers, hist, width=(255/bins)*0.8, color=color, alpha=0.8, edgecolor='none')
        
        elif channel == 'Luminance':
            # 亮度直方图
            luminance = img_np[:, :, 0] * 0.299 + img_np[:, :, 1] * 0.587 + img_np[:, :, 2] * 0.114
            luminance_data = luminance.flatten()
            hist, bin_edges = np.histogram(luminance_data, bins=bins, range=(0, 255))
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
            ax.bar(bin_centers, hist, width=(255/bins)*0.8, color='#cccccc', alpha=0.8, edgecolor='none')
        
        # 样式设置
        ax.set_xlim(0, 255)
        ax.set_xlabel('Pixel Value', color='#cccccc', fontsize=12)
        ax.set_ylabel('Frequency', color='#cccccc', fontsize=12)
        ax.set_title(f'Histogram Analysis - {channel} Channel', color='#ffffff', fontsize=14, fontweight='bold')
        ax.tick_params(colors='#cccccc', labelsize=10)
        ax.grid(True, alpha=0.3, color='#444444')
        
        if channel == 'RGB':
            ax.legend(facecolor='#2a2a2a', edgecolor='#555555', labelcolor='#cccccc')
        
        # 添加统计信息文本
        stats_text = self._get_histogram_stats_text(img_255, channel)
        ax.text(0.02, 0.98, stats_text, transform=ax.transAxes, 
                verticalalignment='top', fontsize=10, color='#cccccc',
                bbox=dict(boxstyle='round', facecolor='#2a2a2a', alpha=0.8))
        
        plt.tight_layout()
        
        # 转换为tensor
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, facecolor='#2a2a2a', edgecolor='none')
        buf.seek(0)
        
        pil_image = Image.open(buf)
        img_array = np.array(pil_image.convert('RGB'))
        result_tensor = torch.from_numpy(img_array.astype(np.float32) / 255.0)
        
        plt.close(fig)
        buf.close()
        
        return result_tensor
    
    def _generate_detailed_histogram_data(self, img_255, channel, bins):
        """生成详细的直方图数据"""
        img_np = img_255.cpu().numpy()
        data = {}
        
        if channel == 'RGB':
            for i, ch in enumerate(['R', 'G', 'B']):
                channel_data = img_np[:, :, i].flatten()
                hist, bin_edges = np.histogram(channel_data, bins=bins, range=(0, 255))
                data[ch] = {
                    'histogram': hist.tolist(),
                    'bin_edges': bin_edges.tolist(),
                    'total_pixels': len(channel_data)
                }
        else:
            if channel in ['R', 'G', 'B']:
                channel_idx = {'R': 0, 'G': 1, 'B': 2}[channel]
                channel_data = img_np[:, :, channel_idx].flatten()
            elif channel == 'Luminance':
                channel_data = (img_np[:, :, 0] * 0.299 + img_np[:, :, 1] * 0.587 + img_np[:, :, 2] * 0.114).flatten()
            
            hist, bin_edges = np.histogram(channel_data, bins=bins, range=(0, 255))
            data[channel] = {
                'histogram': hist.tolist(),
                'bin_edges': bin_edges.tolist(),
                'total_pixels': len(channel_data)
            }
        
        import json
        return json.dumps(data, indent=2)
    
    def _calculate_comprehensive_statistics(self, img_255, channel):
        """计算全面的图像统计信息"""
        img_np = img_255.cpu().numpy()
        stats = {}
        
        if channel == 'RGB':
            for i, ch in enumerate(['R', 'G', 'B']):
                channel_data = img_np[:, :, i].flatten()
                stats[ch] = self._calculate_channel_stats(channel_data)
        else:
            if channel in ['R', 'G', 'B']:
                channel_idx = {'R': 0, 'G': 1, 'B': 2}[channel]
                channel_data = img_np[:, :, channel_idx].flatten()
            elif channel == 'Luminance':
                channel_data = (img_np[:, :, 0] * 0.299 + img_np[:, :, 1] * 0.587 + img_np[:, :, 2] * 0.114).flatten()
            
            stats[channel] = self._calculate_channel_stats(channel_data)
        
        # 格式化输出
        result = []
        for ch, stat in stats.items():
            result.append(f"{ch} Channel Statistics:")
            result.append(f"  Mean: {stat['mean']:.2f}")
            result.append(f"  Median: {stat['median']:.2f}")
            result.append(f"  Std Dev: {stat['std']:.2f}")
            result.append(f"  Min: {stat['min']:.0f}")
            result.append(f"  Max: {stat['max']:.0f}")
            result.append(f"  Range: {stat['range']:.0f}")
            result.append(f"  Skewness: {stat['skewness']:.3f}")
            result.append(f"  Kurtosis: {stat['kurtosis']:.3f}")
            result.append("")
        
        return "\n".join(result)
    
    def _calculate_channel_stats(self, data):
        """计算单通道统计信息"""
        from scipy import stats
        
        return {
            'mean': float(np.mean(data)),
            'median': float(np.median(data)),
            'std': float(np.std(data)),
            'min': float(np.min(data)),
            'max': float(np.max(data)),
            'range': float(np.max(data) - np.min(data)),
            'skewness': float(stats.skew(data)),
            'kurtosis': float(stats.kurtosis(data))
        }
    
    def _export_raw_histogram_data(self, img_255, channel, bins):
        """导出原始直方图数据（CSV格式）"""
        img_np = img_255.cpu().numpy()
        csv_lines = []
        
        if channel == 'RGB':
            csv_lines.append("Bin_Center,Red_Count,Green_Count,Blue_Count")
            
            # 计算每个通道的直方图
            hists = []
            bin_edges = None
            for i in range(3):
                channel_data = img_np[:, :, i].flatten()
                hist, edges = np.histogram(channel_data, bins=bins, range=(0, 255))
                hists.append(hist)
                if bin_edges is None:
                    bin_edges = edges
            
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
            
            for i, center in enumerate(bin_centers):
                csv_lines.append(f"{center:.1f},{hists[0][i]},{hists[1][i]},{hists[2][i]}")
        
        else:
            csv_lines.append(f"Bin_Center,{channel}_Count")
            
            if channel in ['R', 'G', 'B']:
                channel_idx = {'R': 0, 'G': 1, 'B': 2}[channel]
                channel_data = img_np[:, :, channel_idx].flatten()
            elif channel == 'Luminance':
                channel_data = (img_np[:, :, 0] * 0.299 + img_np[:, :, 1] * 0.587 + img_np[:, :, 2] * 0.114).flatten()
            
            hist, bin_edges = np.histogram(channel_data, bins=bins, range=(0, 255))
            bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
            
            for i, center in enumerate(bin_centers):
                csv_lines.append(f"{center:.1f},{hist[i]}")
        
        return "\n".join(csv_lines)
    
    def _get_histogram_stats_text(self, img_255, channel):
        """获取直方图统计信息文本（用于图像标注）"""
        img_np = img_255.cpu().numpy()
        
        if channel == 'RGB':
            # RGB平均统计
            rgb_data = img_np.reshape(-1, 3)
            mean_rgb = np.mean(rgb_data, axis=0)
            return f"RGB Mean: ({mean_rgb[0]:.1f}, {mean_rgb[1]:.1f}, {mean_rgb[2]:.1f})\nPixels: {rgb_data.shape[0]:,}"
        else:
            if channel in ['R', 'G', 'B']:
                channel_idx = {'R': 0, 'G': 1, 'B': 2}[channel]
                channel_data = img_np[:, :, channel_idx].flatten()
            elif channel == 'Luminance':
                channel_data = (img_np[:, :, 0] * 0.299 + img_np[:, :, 1] * 0.587 + img_np[:, :, 2] * 0.114).flatten()
            
            mean_val = np.mean(channel_data)
            std_val = np.std(channel_data)
            return f"{channel} Mean: {mean_val:.1f}\nStd Dev: {std_val:.1f}\nPixels: {len(channel_data):,}"
    
    def _create_fallback_histogram_image(self):
        """创建错误时的备用直方图图像"""
        # 创建简单的错误图像
        error_image = np.ones((400, 600, 3), dtype=np.float32) * 0.1
        return torch.from_numpy(error_image)

class PhotoshopLevelsNode:
    """专业色阶调整节点 - 专注于色阶调整功能"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                'channel': (['RGB', 'R', 'G', 'B', 'Luminance'], {'default': 'RGB'}),
            },
            'optional': {
                'input_black': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 254.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '输入黑场点 (0-254)'
                }),
                'input_white': ('FLOAT', {
                    'default': 255.0,
                    'min': 1.0,
                    'max': 255.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '输入白场点 (1-255)'
                }),
                'input_midtones': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.1,
                    'max': 9.99,
                    'step': 0.01,
                    'display': 'slider',
                    'tooltip': '输入中间调 (0.1-9.99，1.0为中性，<1.0变暗，>1.0变亮)'
                }),
                'output_black': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 254.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '输出黑场点 (0-254)'
                }),
                'output_white': ('FLOAT', {
                    'default': 255.0,
                    'min': 1.0,
                    'max': 255.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '输出白场点 (1-255)'
                }),
                'auto_levels': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '自动色阶调整'
                }),
                'auto_contrast': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '自动对比度调整'
                }),
                'clip_percentage': ('FLOAT', {
                    'default': 0.1,
                    'min': 0.0,
                    'max': 5.0,
                    'step': 0.1,
                    'display': 'slider',
                    'tooltip': '自动调整时的裁剪百分比'
                }),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('IMAGE',)
    RETURN_NAMES = ('image',)
    FUNCTION = 'apply_levels_adjustment'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, image, channel, input_black=0.0, input_white=255.0, input_midtones=1.0, 
                   output_black=0.0, output_white=255.0, auto_levels=False, auto_contrast=False, 
                   clip_percentage=0.1, unique_id=None):
        return f"{channel}_{input_black}_{input_white}_{input_midtones}_{output_black}_{output_white}_{auto_levels}_{auto_contrast}_{clip_percentage}"

    def apply_levels_adjustment(self, image, channel, input_black=0.0, input_white=255.0, input_midtones=1.0,
                               output_black=0.0, output_white=255.0, auto_levels=False, auto_contrast=False,
                               clip_percentage=0.1, unique_id=None):
        try:
            # 确保输入图像格式正确
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端（仅当有unique_id时）
            if unique_id is not None:
                try:
                    # 使用第一张图像进行预览
                    preview_image = image[0] if image.dim() == 4 else image
                    
                    # 转换为PIL图像
                    img_np = (preview_image.cpu().numpy() * 255).astype(np.uint8)
                    if img_np.shape[-1] == 3:
                        pil_img = Image.fromarray(img_np, mode='RGB')
                    elif img_np.shape[-1] == 4:
                        pil_img = Image.fromarray(img_np, mode='RGBA')
                    else:
                        pil_img = Image.fromarray(img_np[:,:,0], mode='L')
                    
                    # 转换为base64
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format='PNG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    # 准备发送数据
                    send_data = {
                        "node_id": str(unique_id),
                        "image": f"data:image/png;base64,{img_base64}",
                        "levels_data": {
                            "channel": channel,
                            "input_black": input_black,
                            "input_white": input_white,
                            "input_midtones": input_midtones,
                            "output_black": output_black,
                            "output_white": output_white,
                            "auto_levels": auto_levels,
                            "auto_contrast": auto_contrast,
                            "clip_percentage": clip_percentage
                        }
                    }
                    
                    # 发送事件到前端
                    PromptServer.instance.send_sync("levels_adjustment_preview", send_data)
                    print(f"✅ 已发送色阶调整预览数据到前端，节点ID: {unique_id}")
                    
                except Exception as preview_error:
                    print(f"发送色阶预览时出错: {preview_error}")
            
            # 处理批次维度
            if image.dim() == 4:  # Batch dimension exists
                batch_size = image.shape[0]
                results = []
                
                for b in range(batch_size):
                    result = self._apply_levels_to_image(
                        image[b], channel, input_black, input_white, input_midtones,
                        output_black, output_white, auto_levels, auto_contrast, clip_percentage
                    )
                    results.append(result)
                
                return (torch.stack(results, dim=0),)
            else:
                result = self._apply_levels_to_image(
                    image, channel, input_black, input_white, input_midtones,
                    output_black, output_white, auto_levels, auto_contrast, clip_percentage
                )
                return (result.unsqueeze(0),)
                
        except Exception as e:
            print(f"PhotoshopLevelsNode error: {e}")
            # 返回原始图像作为fallback
            return (image,)
    
    def _apply_levels_to_image(self, image, channel, input_black, input_white, input_midtones, output_black, output_white, auto_levels, auto_contrast, clip_percentage):
        """应用色阶调整到单个图像"""
        # 确保图像在正确的设备上
        device = get_torch_device()
        image = image.to(device)
        
        # 将图像转换为0-255范围用于直方图分析
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 应用自动调整（如果启用）
        if auto_levels or auto_contrast:
            input_black, input_white, input_midtones = self._calculate_auto_levels(
                img_255, channel, auto_levels, auto_contrast, clip_percentage
            )
        
        # 应用色阶调整
        result = self._apply_levels_adjustment(
            image, channel, input_black, input_white, input_midtones, output_black, output_white
        )
        
        return result
    
    def _calculate_auto_levels(self, img_255, channel, auto_levels, auto_contrast, clip_percentage):
        """计算自动色阶参数"""
        # 将裁剪百分比转换为0-1范围
        clip = clip_percentage / 100.0
        
        if channel == 'RGB':
            # 对RGB三个通道分别计算
            r_min, r_max = self._calculate_channel_range(img_255[..., 0], clip, auto_levels, auto_contrast)
            g_min, g_max = self._calculate_channel_range(img_255[..., 1], clip, auto_levels, auto_contrast)
            b_min, b_max = self._calculate_channel_range(img_255[..., 2], clip, auto_levels, auto_contrast)
            
            # 取三个通道的平均值或极值
            if auto_levels:
                # 自动色阶：每个通道独立调整
                min_val = (r_min + g_min + b_min) / 3
                max_val = (r_max + g_max + b_max) / 3
            else:
                # 自动对比度：使用极值
                min_val = min(r_min, g_min, b_min)
                max_val = max(r_max, g_max, b_max)
        
        elif channel == 'Luminance':
            # 计算亮度通道
            if img_255.shape[2] >= 3:
                luminance = (img_255[..., 0] * 0.299 + 
                           img_255[..., 1] * 0.587 + 
                           img_255[..., 2] * 0.114)
                min_val, max_val = self._calculate_channel_range(luminance, clip, auto_levels, auto_contrast)
            else:
                min_val, max_val = self._calculate_channel_range(img_255[..., 0], clip, auto_levels, auto_contrast)
        
        else:
            # 单通道
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            if channel_idx < img_255.shape[2]:
                min_val, max_val = self._calculate_channel_range(img_255[..., channel_idx], clip, auto_levels, auto_contrast)
            else:
                min_val, max_val = 0, 255
        
        # 确保有效范围
        min_val = max(0, min(254, min_val))
        max_val = max(min_val + 1, min(255, max_val))
        
        # 返回计算的参数
        return min_val, max_val, 1.0  # 伽马值保持为1.0
    
    def _calculate_channel_range(self, channel_data, clip, auto_levels, auto_contrast):
        """计算通道的范围"""
        # 转换为numpy数组
        data = channel_data.cpu().numpy().flatten()
        
        # 计算直方图
        hist, bins = np.histogram(data, bins=256, range=(0, 255))
        
        # 计算累积分布
        cdf = hist.cumsum()
        cdf = cdf / cdf[-1]  # 归一化
        
        # 计算裁剪点
        min_val = bins[np.argwhere(cdf >= clip)[0, 0]]
        max_val = bins[np.argwhere(cdf >= (1 - clip))[0, 0]]
        
        return min_val, max_val
    
    def _apply_levels_adjustment(self, image, channel, input_black, input_white, input_midtones, output_black, output_white):
        """应用色阶调整"""
        device = image.device
        
        # 将图像转换为0-255范围
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 确保参数有效
        input_black = max(0, min(254, input_black))
        input_white = max(input_black + 1, min(255, input_white))
        output_black = max(0, min(254, output_black))
        output_white = max(output_black + 1, min(255, output_white))
        input_midtones = max(0.1, min(9.99, input_midtones))
        
        # 应用色阶调整
        if channel == 'RGB':
            # 对所有通道应用
            result = torch.zeros_like(img_255)
            for c in range(min(3, img_255.shape[2])):
                result[..., c] = self._apply_levels_to_channel(
                    img_255[..., c], input_black, input_white, input_midtones, output_black, output_white
                )
            # 如果有alpha通道，保持不变
            if img_255.shape[2] > 3:
                result[..., 3:] = img_255[..., 3:]
        elif channel == 'Luminance':
            # 对亮度应用调整，保持色彩
            if img_255.shape[2] >= 3:
                # 转换到HSV空间
                result = self._adjust_luminance_only(img_255, input_black, input_white, input_midtones, output_black, output_white)
            else:
                result = self._apply_levels_to_channel(
                    img_255[..., 0], input_black, input_white, input_midtones, output_black, output_white
                ).unsqueeze(-1)
        else:
            # 对单个通道应用
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            result = img_255.clone()
            if channel_idx < img_255.shape[2]:
                result[..., channel_idx] = self._apply_levels_to_channel(
                    img_255[..., channel_idx], input_black, input_white, input_midtones, output_black, output_white
                )
        
        # 转换回0-1范围
        result = (result / 255.0).clamp(0, 1)
        
        return result
    
    def _apply_levels_to_channel(self, channel_data, input_black, input_white, input_midtones, output_black, output_white):
        """对单个通道应用色阶调整"""
        # 输入范围调整
        normalized = (channel_data - input_black) / (input_white - input_black)
        normalized = torch.clamp(normalized, 0, 1)
        
        # 伽马校正
        gamma_corrected = torch.pow(normalized, 1.0 / input_midtones)
        
        # 输出范围调整
        result = gamma_corrected * (output_white - output_black) + output_black
        
        return torch.clamp(result, 0, 255)
    
    def _adjust_luminance_only(self, img_255, input_black, input_white, input_midtones, output_black, output_white):
        """仅调整亮度，保持色彩"""
        # 转换到HSV空间进行亮度调整
        rgb = img_255 / 255.0
        
        # 简化的RGB到HSV转换（仅处理V通道）
        max_vals, _ = torch.max(rgb, dim=2, keepdim=True)
        min_vals, _ = torch.min(rgb, dim=2, keepdim=True)
        
        # 调整V通道（亮度）
        v_channel = max_vals.squeeze(-1) * 255.0
        adjusted_v = self._apply_levels_to_channel(v_channel, input_black, input_white, input_midtones, output_black, output_white)
        adjusted_v = adjusted_v / 255.0
        
        # 计算调整比例
        adjustment_ratio = torch.where(max_vals.squeeze(-1) > 0, adjusted_v / max_vals.squeeze(-1), torch.ones_like(adjusted_v))
        adjustment_ratio = adjustment_ratio.unsqueeze(-1)
        
        # 应用调整比例到RGB
        result = rgb * adjustment_ratio
        result = torch.clamp(result, 0, 1) * 255.0
        
        return result



class PhotoshopHSLNode:
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
            
            # 在处理前，先发送输入图像到前端（仅当有unique_id时）
            if unique_id is not None:
                try:
                    # 使用第一张图像进行预览
                    preview_image = image[0] if image.dim() == 4 else image
                    
                    # 转换为PIL图像
                    img_np = (preview_image.cpu().numpy() * 255).astype(np.uint8)
                    if img_np.shape[-1] == 3:
                        pil_img = Image.fromarray(img_np, mode='RGB')
                    elif img_np.shape[-1] == 4:
                        pil_img = Image.fromarray(img_np, mode='RGBA')
                    else:
                        pil_img = Image.fromarray(img_np[:,:,0], mode='L')
                    
                    # 转换为base64
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format='PNG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    # 发送图像数据事件
                    send_data = {
                        "node_id": str(unique_id),
                        "image": f"data:image/png;base64,{img_base64}"
                    }
                    
                    # 处理遮罩（如果存在）
                    mask = kwargs.get('mask', None)
                    if mask is not None:
                        try:
                            # 使用第一个遮罩进行预览
                            preview_mask = mask[0] if mask.dim() == 3 else mask
                            
                            # 转换遮罩为PIL图像
                            mask_np = (preview_mask.cpu().numpy() * 255).astype(np.uint8)
                            pil_mask = Image.fromarray(mask_np, mode='L')
                            
                            # 转换为base64
                            mask_buffer = io.BytesIO()
                            pil_mask.save(mask_buffer, format='PNG')
                            mask_base64 = base64.b64encode(mask_buffer.getvalue()).decode('utf-8')
                            
                            send_data["mask"] = f"data:image/png;base64,{mask_base64}"
                        except Exception as mask_error:
                            print(f"处理遮罩时出错: {mask_error}")
                    
                    # 发送事件到前端
                    PromptServer.instance.send_sync("photoshop_hsl_preview", send_data)
                    print(f"✅ 已发送HSL预览数据到前端，节点ID: {unique_id}")
                    
                except Exception as preview_error:
                    print(f"发送HSL预览时出错: {preview_error}")
                    # 继续处理，不因预览失败而中断主流程
            # 处理可选参数
            mask = kwargs.get('mask', None)
            mask_blur = kwargs.get('mask_blur', 0.0)
            invert_mask = kwargs.get('invert_mask', False)
            
            # 支持批处理
            if len(image.shape) == 4:
                # 处理批量图像
                batch_size = image.shape[0]
                result = torch.zeros_like(image)
                
                for i in range(batch_size):
                    # 正确处理遮罩维度（参考PS Curve节点）
                    batch_mask = None
                    if mask is not None:
                        if mask.dim() == 2:
                            # 遮罩是 (H, W)，所有批次使用相同遮罩
                            batch_mask = mask
                        elif mask.dim() == 3:
                            if mask.shape[0] == 1:
                                # 遮罩是 (1, H, W)，所有批次使用相同遮罩
                                batch_mask = mask[0]
                            elif mask.shape[0] == batch_size:
                                # 遮罩是 (B, H, W)，每个批次使用对应遮罩
                                batch_mask = mask[i]
                            else:
                                # 其他情况，尝试使用第一个遮罩
                                batch_mask = mask[0] if mask.shape[0] > 0 else mask
                    
                    result[i] = self._process_single_image(
                        image[i],
                        red_hue, red_saturation, red_lightness,
                        orange_hue, orange_saturation, orange_lightness,
                        yellow_hue, yellow_saturation, yellow_lightness,
                        green_hue, green_saturation, green_lightness,
                        cyan_hue, cyan_saturation, cyan_lightness,
                        blue_hue, blue_saturation, blue_lightness,
                        purple_hue, purple_saturation, purple_lightness,
                        magenta_hue, magenta_saturation, magenta_lightness,
                        batch_mask, mask_blur, invert_mask
                    )
                
                return (result,)
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
        import cv2
        
        
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
        
        # 不再应用主色调调整和着色模式
        
        # 定义颜色范围 (H值范围在OpenCV中为0-179，与PS终端HSL通道对齐)
        color_ranges = {
            'red': [(0, 14), (165, 179)],  # 红色
            'orange': [(15, 29)],          # 橙色
            'yellow': [(30, 44)],          # 黄色
            'green': [(45, 74)],           # 绿色
            'cyan': [(75, 104)],           # 浅绿
            'blue': [(105, 134)],          # 蓝色
            'purple': [(135, 149)],        # 紫色
            'magenta': [(150, 164)]        # 洋红
        }
        
        # 按照红橙黄绿浅绿蓝紫洋红的顺序应用各个颜色范围的调整
        if red_hue != 0 or red_saturation != 0 or red_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['red'], red_hue, red_saturation, red_lightness)
            
        if orange_hue != 0 or orange_saturation != 0 or orange_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['orange'], orange_hue, orange_saturation, orange_lightness)
            
        if yellow_hue != 0 or yellow_saturation != 0 or yellow_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['yellow'], yellow_hue, yellow_saturation, yellow_lightness)
            
        if green_hue != 0 or green_saturation != 0 or green_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['green'], green_hue, green_saturation, green_lightness)
            
        if cyan_hue != 0 or cyan_saturation != 0 or cyan_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['cyan'], cyan_hue, cyan_saturation, cyan_lightness)
            
        if blue_hue != 0 or blue_saturation != 0 or blue_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['blue'], blue_hue, blue_saturation, blue_lightness)
            
        if purple_hue != 0 or purple_saturation != 0 or purple_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['purple'], purple_hue, purple_saturation, purple_lightness)
            
        if magenta_hue != 0 or magenta_saturation != 0 or magenta_lightness != 0:
            img_hsv = self._adjust_color_range(img_hsv, color_ranges['magenta'], magenta_hue, magenta_saturation, magenta_lightness)
        
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
            result = self._apply_mask(image, result, mask, mask_blur, invert_mask)
        
        return result
    
    def _adjust_hsl(self, img_hsv, hue_shift, sat_shift, light_shift, mask=None):
        """应用HSL调整到HSV图像"""
        h, w, _ = img_hsv.shape
        
        # 创建调整后的HSV图像副本
        adjusted = img_hsv.copy()
        
        # 色相值偏移
        adjusted[:,:,0] = (adjusted[:,:,0] + hue_shift * 0.9) % 180  # 将-100~100映射到-90~90，OpenCV的H范围是0-179
        
        # 应用饱和度调整 (OpenCV的S范围是0-255)
        if sat_shift > 0:
            # 增加饱和度
            adjusted[:,:,1] = adjusted[:,:,1] * (1 + sat_shift / 100)
        else:
            # 降低饱和度
            adjusted[:,:,1] = adjusted[:,:,1] * (1 + sat_shift / 100)
        
        # 应用明度调整 (OpenCV的V范围是0-255)
        if light_shift > 0:
            # 增加明度
            adjusted[:,:,2] = adjusted[:,:,2] * (1 + light_shift / 100)
        else:
            # 降低明度
            adjusted[:,:,2] = adjusted[:,:,2] * (1 + light_shift / 100)
        
        # 如果提供了遮罩，只在遮罩区域应用调整
        if mask is not None:
            return img_hsv * (1 - mask) + adjusted * mask
        else:
            return adjusted
    
    def _adjust_color_range(self, img_hsv, ranges, hue_shift, sat_shift, light_shift):
        """调整特定颜色范围的HSL值"""
        h, w, _ = img_hsv.shape
        
        # 创建遮罩
        mask = np.zeros((h, w), dtype=np.float32)
        
        # 对每个范围创建遮罩
        for r in ranges:
            lower, upper = r
            
            # 创建当前范围的遮罩
            range_mask = np.logical_and(img_hsv[:,:,0] >= lower, img_hsv[:,:,0] <= upper).astype(np.float32)
            
            # 添加到总遮罩
            mask = np.maximum(mask, range_mask)
        
        # 扩展遮罩维度以匹配HSV
        mask = np.expand_dims(mask, axis=2)
        mask = np.repeat(mask, 3, axis=2)
        
        # 应用HSL调整，只在遮罩区域
        adjusted = self._adjust_hsl(img_hsv, hue_shift, sat_shift, light_shift)
        
        # 混合原始和调整后的图像
        result = img_hsv * (1 - mask) + adjusted * mask
        
        return result
    
    def _apply_mask(self, original_image, processed_image, mask, mask_blur, invert_mask):
        """应用遮罩混合原始图像和处理后的图像"""
        # 获取设备信息
        device = original_image.device
        
        # 获取图像尺寸
        if original_image.dim() == 3:
            h, w, c = original_image.shape
        else:
            raise ValueError(f"Unexpected image dimensions: {original_image.shape}")
        
        # 确保遮罩在正确的设备上
        mask = mask.to(device)
        
        # 处理遮罩维度，确保与图像匹配（参考PhotoshopCurveNode）
        if mask.dim() == 2:
            # 遮罩是 (H, W)
            if mask.shape[0] != h or mask.shape[1] != w:
                # 调整遮罩尺寸以匹配图像
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0), 
                    size=(h, w), 
                    mode='bilinear', 
                    align_corners=False
                ).squeeze(0).squeeze(0)
        elif mask.dim() == 3:
            # 遮罩是 (1, H, W) 或 (H, W, 1)
            if mask.shape[0] == 1:
                # 遮罩是 (1, H, W)，去掉批次维度
                mask = mask.squeeze(0)
            elif mask.shape[2] == 1:
                # 遮罩是 (H, W, 1)，去掉通道维度
                mask = mask.squeeze(2)
            
            # 调整尺寸
            if mask.shape[0] != h or mask.shape[1] != w:
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0), 
                    size=(h, w), 
                    mode='bilinear', 
                    align_corners=False
                ).squeeze(0).squeeze(0)
        
        # 确保遮罩值在 [0, 1] 范围内
        mask = torch.clamp(mask, 0.0, 1.0)
        
        # 反转遮罩（如果需要）
        if invert_mask:
            mask = 1.0 - mask
        
        # 应用高斯模糊羽化效果
        if mask_blur > 0.0:
            mask = self._apply_gaussian_blur(mask, mask_blur)
        
        # 扩展遮罩维度以匹配图像通道 (H, W) -> (H, W, C)
        if original_image.dim() == 3:
            mask = mask.unsqueeze(-1).expand(-1, -1, original_image.shape[2])
        
        # 混合原图和处理后的图像
        result = original_image * (1.0 - mask) + processed_image * mask
        
        return result
    
    def _apply_gaussian_blur(self, tensor, blur_radius):
        """对tensor应用高斯模糊"""
        if blur_radius <= 0:
            return tensor
        
        device = tensor.device
        
        # 计算高斯核大小（奇数）
        kernel_size = int(blur_radius * 2) * 2 + 1
        sigma = blur_radius / 3.0
        
        # 创建1D高斯核
        x = torch.arange(kernel_size, dtype=torch.float32, device=device) - kernel_size // 2
        gauss_1d = torch.exp(-0.5 * (x / sigma) ** 2)
        gauss_1d = gauss_1d / gauss_1d.sum()
        
        # 创建2D高斯核
        gauss_2d = gauss_1d.unsqueeze(0) * gauss_1d.unsqueeze(1)
        gauss_2d = gauss_2d.unsqueeze(0).unsqueeze(0)  # (1, 1, kernel_size, kernel_size)
        
        # 添加padding以保持尺寸
        padding = kernel_size // 2
        
        # 应用卷积
        blurred = torch.nn.functional.conv2d(
            tensor.unsqueeze(0).unsqueeze(0),  # (1, 1, H, W)
            gauss_2d,
            padding=padding
        ).squeeze(0).squeeze(0)  # (H, W)
        
        return blurred

class ColorGradingNode:
    """
    Color Grading节点 - 实现Lightroom风格的色彩分级功能
    支持阴影、中间调、高光的独立色彩调整
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            'required': {
                'image': ('IMAGE',),
                # 阴影控制
                'shadows_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -180.0,
                    'max': 180.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '阴影区域色相偏移（-180到180度）'
                }),
                'shadows_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '阴影区域饱和度调整（-100到100%）'
                }),
                'shadows_luminance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '阴影区域明度调整（-100到100%）'
                }),
                # 中间调控制
                'midtones_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -180.0,
                    'max': 180.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '中间调区域色相偏移（-180到180度）'
                }),
                'midtones_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '中间调区域饱和度调整（-100到100%）'
                }),
                'midtones_luminance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '中间调区域明度调整（-100到100%）'
                }),
                # 高光控制
                'highlights_hue': ('FLOAT', {
                    'default': 0.0,
                    'min': -180.0,
                    'max': 180.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '高光区域色相偏移（-180到180度）'
                }),
                'highlights_saturation': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '高光区域饱和度调整（-100到100%）'
                }),
                'highlights_luminance': ('FLOAT', {
                    'default': 0.0,
                    'min': -100.0,
                    'max': 100.0,
                    'step': 1.0,
                    'display': 'slider',
                    'tooltip': '高光区域明度调整（-100到100%）'
                }),
                # 混合模式
                'blend_mode': (['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn'], {
                    'default': 'normal',
                    'tooltip': '色彩分级的混合模式'
                }),
                # 整体强度
                'overall_strength': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.0,
                    'max': 2.0,
                    'step': 0.1,
                    'display': 'slider',
                    'tooltip': '色彩分级的整体强度'
                }),
            },
            'optional': {
                'mask': ('MASK', {
                    'default': None,
                    'tooltip': '可选遮罩，色彩分级仅对遮罩区域有效'
                }),
                'mask_blur': ('FLOAT', {
                    'default': 0.0,
                    'min': 0.0,
                    'max': 20.0,
                    'step': 0.1,
                    'display': 'slider',
                    'tooltip': '遮罩边缘羽化程度'
                }),
                'invert_mask': ('BOOLEAN', {
                    'default': False,
                    'tooltip': '反转遮罩区域'
                }),
            },
            'hidden': {'unique_id': 'UNIQUE_ID'}
        }
    
    RETURN_TYPES = ('IMAGE',)
    RETURN_NAMES = ('image',)
    FUNCTION = 'apply_color_grading'
    CATEGORY = 'Image/Adjustments'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # 创建所有参数的缓存键
        cache_params = []
        for key, value in kwargs.items():
            if key != 'unique_id':
                if hasattr(value, 'data'):
                    cache_params.append(f"{key}:{hash(value.data.tobytes())}")
                else:
                    cache_params.append(f"{key}:{value}")
        return "_".join(cache_params)
    
    def apply_color_grading(self, image, 
                           shadows_hue=0.0, shadows_saturation=0.0, shadows_luminance=0.0,
                           midtones_hue=0.0, midtones_saturation=0.0, midtones_luminance=0.0,
                           highlights_hue=0.0, highlights_saturation=0.0, highlights_luminance=0.0,
                           blend_mode='normal', overall_strength=1.0,
                           mask=None, mask_blur=0.0, invert_mask=False, unique_id=None):
        """
        应用色彩分级效果
        """
        # 性能优化：如果所有参数都是默认值且没有遮罩，直接返回原图
        if (shadows_hue == 0 and shadows_saturation == 0 and shadows_luminance == 0 and
            midtones_hue == 0 and midtones_saturation == 0 and midtones_luminance == 0 and
            highlights_hue == 0 and highlights_saturation == 0 and highlights_luminance == 0 and
            mask is None):
            return (image,)
        
        try:
            if image is None:
                raise ValueError("Input image is None")
            
            # 发送预览数据到前端（仅当有unique_id时）
            if unique_id is not None:
                try:
                    # 使用第一张图像进行预览
                    preview_image = image[0] if image.dim() == 4 else image
                    
                    # 转换为PIL图像
                    img_np = (preview_image.cpu().numpy() * 255).astype(np.uint8)
                    if img_np.shape[-1] == 3:
                        pil_img = Image.fromarray(img_np, mode='RGB')
                    elif img_np.shape[-1] == 4:
                        pil_img = Image.fromarray(img_np, mode='RGBA')
                    else:
                        pil_img = Image.fromarray(img_np[:,:,0], mode='L')
                    
                    # 转换为base64
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format='PNG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    # 准备发送数据
                    send_data = {
                        "node_id": str(unique_id),
                        "image": f"data:image/png;base64,{img_base64}",
                        "grading_data": {
                            "shadows": {"hue": shadows_hue, "saturation": shadows_saturation, "luminance": shadows_luminance},
                            "midtones": {"hue": midtones_hue, "saturation": midtones_saturation, "luminance": midtones_luminance},
                            "highlights": {"hue": highlights_hue, "saturation": highlights_saturation, "luminance": highlights_luminance},
                            "blend_mode": blend_mode,
                            "overall_strength": overall_strength
                        }
                    }
                    
                    # 处理遮罩
                    if mask is not None:
                        try:
                            # 获取第一个遮罩用于预览
                            preview_mask = mask[0] if mask.dim() == 3 else mask
                            
                            # 确保遮罩是2D的
                            if preview_mask.dim() > 2:
                                preview_mask = preview_mask.squeeze()
                            
                            # 转换遮罩为PIL图像
                            mask_np = (preview_mask.cpu().numpy() * 255).astype(np.uint8)
                            pil_mask = Image.fromarray(mask_np, mode='L')
                            
                            # 转换为base64
                            mask_buffer = io.BytesIO()
                            pil_mask.save(mask_buffer, format='PNG')
                            mask_base64 = base64.b64encode(mask_buffer.getvalue()).decode('utf-8')
                            
                            send_data["mask"] = f"data:image/png;base64,{mask_base64}"
                        except Exception as mask_error:
                            print(f"处理色彩分级遮罩时出错: {mask_error}")
                    
                    # 发送事件到前端
                    PromptServer.instance.send_sync("color_grading_preview", send_data)
                    print(f"✅ 已发送色彩分级预览数据到前端，节点ID: {unique_id}")
                    
                except Exception as preview_error:
                    print(f"发送色彩分级预览时出错: {preview_error}")
            
            # 处理图像
            if len(image.shape) == 4:
                # 批处理
                batch_size = image.shape[0]
                result = torch.zeros_like(image)
                
                for i in range(batch_size):
                    # 正确处理遮罩维度（参考PS Curve节点）
                    batch_mask = None
                    if mask is not None:
                        if mask.dim() == 2:
                            # 遮罩是 (H, W)，所有批次使用相同遮罩
                            batch_mask = mask
                        elif mask.dim() == 3:
                            if mask.shape[0] == 1:
                                # 遮罩是 (1, H, W)，所有批次使用相同遮罩
                                batch_mask = mask[0]
                            elif mask.shape[0] == batch_size:
                                # 遮罩是 (B, H, W)，每个批次使用对应遮罩
                                batch_mask = mask[i]
                            else:
                                # 其他情况，尝试使用第一个遮罩
                                batch_mask = mask[0] if mask.shape[0] > 0 else mask
                    
                    result[i] = self._process_single_image(
                        image[i],
                        shadows_hue, shadows_saturation, shadows_luminance,
                        midtones_hue, midtones_saturation, midtones_luminance,
                        highlights_hue, highlights_saturation, highlights_luminance,
                        blend_mode, overall_strength,
                        batch_mask, mask_blur, invert_mask
                    )
                
                return (result,)
            else:
                # 单张图像
                result = self._process_single_image(
                    image,
                    shadows_hue, shadows_saturation, shadows_luminance,
                    midtones_hue, midtones_saturation, midtones_luminance,
                    highlights_hue, highlights_saturation, highlights_luminance,
                    blend_mode, overall_strength,
                    mask, mask_blur, invert_mask
                )
                return (result,)
                
        except Exception as e:
            print(f"ColorGradingNode error: {e}")
            import traceback
            traceback.print_exc()
            return (image,)
    
    def _process_single_image(self, image,
                             shadows_hue, shadows_saturation, shadows_luminance,
                             midtones_hue, midtones_saturation, midtones_luminance,
                             highlights_hue, highlights_saturation, highlights_luminance,
                             blend_mode, overall_strength,
                             mask, mask_blur, invert_mask):
        """处理单张图像的色彩分级 - 使用更接近Lightroom的算法"""
        import cv2
        
        print(f"🎨 Color Grading 处理开始:")
        print(f"  - Shadows: H={shadows_hue}, S={shadows_saturation}, L={shadows_luminance}")
        print(f"  - Midtones: H={midtones_hue}, S={midtones_saturation}, L={midtones_luminance}")
        print(f"  - Highlights: H={highlights_hue}, S={highlights_saturation}, L={highlights_luminance}")
        print(f"  - Blend mode: {blend_mode}, Strength: {overall_strength}")
        print(f"  - Has mask: {mask is not None}")
        
        device = image.device
        
        # 将图像转换为numpy数组，范围0-1（保持精度）
        img_np = image.detach().cpu().numpy()
        
        # 处理Alpha通道
        has_alpha = False
        alpha_channel = None
        
        if img_np.shape[2] == 4:  # RGBA图像
            has_alpha = True
            alpha_channel = img_np[:,:,3]
            img_np = img_np[:,:,:3]  # 只保留RGB通道
        
        # 检查是否有实际的调整
        has_adjustment = (shadows_hue != 0 or shadows_saturation != 0 or shadows_luminance != 0 or
                         midtones_hue != 0 or midtones_saturation != 0 or midtones_luminance != 0 or
                         highlights_hue != 0 or highlights_saturation != 0 or highlights_luminance != 0)
        
        # 如果没有调整且blend_mode是normal，直接返回原图或应用遮罩
        if not has_adjustment and blend_mode == 'normal':
            print("  - 没有调整参数，跳过颜色处理")
            
            # 如果没有遮罩，直接返回原图
            if mask is None:
                print("  - 没有遮罩，直接返回原图")
                return image
            
            # 有遮罩但没有调整，理论上应该返回原图，因为处理前后图像相同
            print("  - 有遮罩但没有调整，返回原图")
            return image
        
        # 转换为Lab色彩空间（更接近人眼感知，Lightroom使用的色彩空间）
        # OpenCV期望BGR格式，所以先转换
        img_bgr = cv2.cvtColor((img_np * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
        img_lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        
        print(f"  - 原始Lab范围: L[{np.min(img_lab[:,:,0]):.1f},{np.max(img_lab[:,:,0]):.1f}], a[{np.min(img_lab[:,:,1]):.1f},{np.max(img_lab[:,:,1]):.1f}], b[{np.min(img_lab[:,:,2]):.1f},{np.max(img_lab[:,:,2]):.1f}]")
        
        # 修复OpenCV Lab值范围问题
        # 检测OpenCV返回的Lab格式并正确归一化
        l_max = np.max(img_lab[:,:,0])
        if l_max > 100:
            # OpenCV返回的是0-255范围的L通道，需要除以255而不是100
            print("  - 检测到OpenCV使用0-255的L通道范围")
            img_lab[:,:,0] = img_lab[:,:,0] / 255.0  # L: 0-255 -> 0-1
            img_lab[:,:,1] = img_lab[:,:,1] / 255.0  # a: 0-255 -> 0-1 (已经偏移了128)
            img_lab[:,:,2] = img_lab[:,:,2] / 255.0  # b: 0-255 -> 0-1 (已经偏移了128)
        else:
            # 标准Lab格式：L: 0-100, a/b: -128-127
            print("  - 检测到OpenCV使用标准Lab范围")
            img_lab[:,:,0] = img_lab[:,:,0] / 100.0  # L: 0-100 -> 0-1
            img_lab[:,:,1] = (img_lab[:,:,1] + 128.0) / 255.0  # a: -128-127 -> 0-1
            img_lab[:,:,2] = (img_lab[:,:,2] + 128.0) / 255.0  # b: -128-127 -> 0-1
        
        print(f"  - 归一化后Lab范围: L[{np.min(img_lab[:,:,0]):.3f},{np.max(img_lab[:,:,0]):.3f}], a[{np.min(img_lab[:,:,1]):.3f},{np.max(img_lab[:,:,1]):.3f}], b[{np.min(img_lab[:,:,2]):.3f},{np.max(img_lab[:,:,2]):.3f}]")
        
        # 使用L通道（亮度）创建更精确的遮罩
        luminance = img_lab[:,:,0]
        
        # 创建改进的亮度遮罩（使用更平滑的过渡）
        shadows_mask = self._create_improved_luminance_mask(luminance, 'shadows')
        midtones_mask = self._create_improved_luminance_mask(luminance, 'midtones')
        highlights_mask = self._create_improved_luminance_mask(luminance, 'highlights')
        
        # 保存原始亮度（重要：保持亮度不变）
        original_luminance = img_lab[:,:,0].copy()
        
        # 应用色彩分级到Lab空间的a和b通道
        result_lab = img_lab.copy()
        
        # 处理每个区域的色彩调整
        for region, region_mask, hue, sat, lum in [
            ('shadows', shadows_mask, shadows_hue, shadows_saturation, shadows_luminance),
            ('midtones', midtones_mask, midtones_hue, midtones_saturation, midtones_luminance),
            ('highlights', highlights_mask, highlights_hue, highlights_saturation, highlights_luminance)
        ]:
            if hue != 0 or sat != 0:
                # 将色相和饱和度转换为Lab空间的偏移
                color_offset_a, color_offset_b = self._hue_sat_to_lab_offset(hue, sat)
                
                # 应用颜色偏移（只影响a和b通道）
                result_lab[:,:,1] = result_lab[:,:,1] + color_offset_a * region_mask * overall_strength
                result_lab[:,:,2] = result_lab[:,:,2] + color_offset_b * region_mask * overall_strength
            
            # 亮度调整（保留更多细节）
            if lum != 0:
                lum_factor = lum / 100.0 * overall_strength
                result_lab[:,:,0] = result_lab[:,:,0] + lum_factor * region_mask
        
        # 添加调试信息
        print(f"  - Lab值范围检查:")
        print(f"    L: [{np.min(result_lab[:,:,0]):.3f}, {np.max(result_lab[:,:,0]):.3f}]")
        print(f"    a: [{np.min(result_lab[:,:,1]):.3f}, {np.max(result_lab[:,:,1]):.3f}]")
        print(f"    b: [{np.min(result_lab[:,:,2]):.3f}, {np.max(result_lab[:,:,2]):.3f}]")
        
        # 如果不是亮度调整，恢复原始亮度（保持对比度）
        if shadows_luminance == 0 and midtones_luminance == 0 and highlights_luminance == 0:
            result_lab[:,:,0] = original_luminance
        
        # 限制Lab值在有效范围内（注意：a和b通道可以为负值）
        result_lab[:,:,0] = np.clip(result_lab[:,:,0], 0, 1)  # L通道：0-1
        # a和b通道在归一化状态下应该在0-1范围（因为我们加了128再除以255）
        # 但是应用偏移后可能超出范围，所以不限制，让后续转换处理
        
        # 反归一化Lab值（根据检测到的格式）
        if l_max > 100:
            # 0-255格式
            result_lab[:,:,0] = result_lab[:,:,0] * 255.0
            result_lab[:,:,1] = result_lab[:,:,1] * 255.0
            result_lab[:,:,2] = result_lab[:,:,2] * 255.0
            
            # 确保Lab值在有效范围内
            result_lab[:,:,0] = np.clip(result_lab[:,:,0], 0, 255)
            result_lab[:,:,1] = np.clip(result_lab[:,:,1], 0, 255)
            result_lab[:,:,2] = np.clip(result_lab[:,:,2], 0, 255)
            
            # 转换为uint8
            result_lab_uint8 = result_lab.astype(np.uint8)
        else:
            # 标准格式
            result_lab[:,:,0] = result_lab[:,:,0] * 100.0
            result_lab[:,:,1] = result_lab[:,:,1] * 255.0 - 128.0
            result_lab[:,:,2] = result_lab[:,:,2] * 255.0 - 128.0
            
            # 确保Lab值在有效范围内
            result_lab[:,:,0] = np.clip(result_lab[:,:,0], 0, 100)
            result_lab[:,:,1] = np.clip(result_lab[:,:,1], -128, 127)
            result_lab[:,:,2] = np.clip(result_lab[:,:,2], -128, 127)
            
            # 转换回BGR再转RGB（注意：Lab值需要是uint8类型）
            result_lab_uint8 = result_lab.copy()
            result_lab_uint8[:,:,0] = np.clip(result_lab[:,:,0], 0, 100).astype(np.uint8)
            result_lab_uint8[:,:,1] = np.clip(result_lab[:,:,1] + 128, 0, 255).astype(np.uint8)
            result_lab_uint8[:,:,2] = np.clip(result_lab[:,:,2] + 128, 0, 255).astype(np.uint8)
        
        img_bgr = cv2.cvtColor(result_lab_uint8.astype(np.uint8), cv2.COLOR_LAB2BGR)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
        # 调试信息：检查转换后的RGB值
        print(f"  - 转换后RGB范围: [{np.min(img_rgb)}, {np.max(img_rgb)}]")
        
        # 应用混合模式（使用浮点精度）
        img_rgb_float = img_rgb.astype(np.float32) / 255.0
        img_np_uint8 = (img_np * 255).astype(np.uint8)
        img_rgb = self._apply_blend_mode(img_np_uint8, img_rgb, blend_mode, overall_strength)
        
        print(f"  - 混合后RGB范围: [{np.min(img_rgb)}, {np.max(img_rgb)}]")
        
        # 恢复Alpha通道
        if has_alpha:
            img_rgba = np.dstack([img_rgb / 255.0, alpha_channel])
            result = torch.from_numpy(img_rgba.astype(np.float32)).to(device)
        else:
            result = torch.from_numpy(img_rgb.astype(np.float32) / 255.0).to(device)
        
        print(f"  - 处理后torch tensor范围: [{torch.min(result):.3f}, {torch.max(result):.3f}]")
        
        # 应用遮罩
        if mask is not None:
            print(f"  - 应用遮罩，原图范围: [{torch.min(image):.3f}, {torch.max(image):.3f}]")
            print(f"  - 处理后图像范围: [{torch.min(result):.3f}, {torch.max(result):.3f}]")
            print(f"  - 遮罩范围: [{torch.min(mask):.3f}, {torch.max(mask):.3f}]")
            result = self._apply_mask(image, result, mask, mask_blur, invert_mask)
            print(f"  - 最终结果范围: [{torch.min(result):.3f}, {torch.max(result):.3f}]")
        
        return result
    
    def _create_luminance_mask(self, luminance, region_type):
        """创建亮度区域遮罩"""
        if region_type == 'shadows':
            # 阴影：低亮度区域，使用反向S曲线
            mask = np.power(1.0 - luminance, 2.0)
        elif region_type == 'highlights':
            # 高光：高亮度区域，使用正向S曲线
            mask = np.power(luminance, 2.0)
        else:  # midtones
            # 中间调：中等亮度区域，使用钟形曲线
            mask = 4.0 * luminance * (1.0 - luminance)
        
        # 平滑遮罩以避免硬边缘
        mask = np.clip(mask, 0.0, 1.0)
        return mask
    
    def _create_improved_luminance_mask(self, luminance, region_type):
        """创建改进的亮度区域遮罩 - 更接近Lightroom的算法"""
        import scipy.ndimage as ndimage
        
        if region_type == 'shadows':
            # 阴影：使用更平滑的过渡曲线
            # Lightroom使用的是更渐进的过渡，避免硬边缘
            threshold = 0.25  # 阴影的亮度阈值
            transition = 0.15  # 过渡区域的宽度
            
            # 使用sigmoid函数创建平滑过渡
            mask = 1.0 / (1.0 + np.exp(-(threshold - luminance) / transition))
            
        elif region_type == 'highlights':
            # 高光：使用反向的sigmoid函数
            threshold = 0.75  # 高光的亮度阈值
            transition = 0.15
            
            mask = 1.0 / (1.0 + np.exp(-(luminance - threshold) / transition))
            
        else:  # midtones
            # 中间调：使用高斯分布创建钟形曲线
            center = 0.5  # 中间调的中心点
            width = 0.35  # 分布宽度
            
            # 使用高斯函数
            mask = np.exp(-0.5 * ((luminance - center) / width) ** 2)
            
            # 归一化到合理范围
            mask = mask * 1.2  # 略微增强中间调的影响
        
        # 应用额外的平滑处理，避免色彩断层
        mask = ndimage.gaussian_filter(mask, sigma=1.0)
        
        # 确保遮罩在有效范围内
        mask = np.clip(mask, 0.0, 1.0)
        
        return mask
    
    def _hue_sat_to_lab_offset(self, hue, saturation):
        """将色相和饱和度转换为Lab色彩空间的偏移量"""
        # 将角度转换为弧度
        hue_rad = np.radians(hue)
        
        # 饱和度归一化到0-1范围
        sat_normalized = abs(saturation) / 100.0
        
        # 在Lab空间中，a和b通道的范围大约是-128到127
        # 但为了获得更自然的效果，我们使用较小的偏移范围
        # 注意：这个值是归一化后的，实际偏移量会乘以255再减128
        max_offset = 0.15  # 减小最大偏移量，避免颜色过度饱和
        
        # 计算Lab空间的偏移
        # a通道：红-绿轴
        # b通道：黄-蓝轴
        offset_a = np.cos(hue_rad) * sat_normalized * max_offset
        offset_b = np.sin(hue_rad) * sat_normalized * max_offset
        
        # 考虑人眼对不同颜色的敏感度差异
        # 对某些颜色区域进行微调
        if -30 <= hue <= 30:  # 红色区域
            offset_a *= 1.1
        elif 150 <= hue <= 210:  # 青色区域
            offset_a *= 0.9
        elif 60 <= hue <= 120:  # 绿色区域
            offset_b *= 0.95
        elif 240 <= hue <= 300:  # 蓝色区域
            offset_b *= 1.05
        
        return offset_a, offset_b
    
    def _apply_grading_to_region(self, img_hsv, region_mask, hue_shift, sat_shift, lum_shift):
        """对特定区域应用色彩分级"""
        h, w, _ = img_hsv.shape
        
        # 扩展遮罩维度
        mask_3d = np.expand_dims(region_mask, axis=2)
        
        # 应用色相偏移
        if hue_shift != 0:
            hue_offset = hue_shift * 0.5  # 将-180~180映射到-90~90（OpenCV H范围）
            new_hue = (img_hsv[:,:,0] + hue_offset) % 180
            img_hsv[:,:,0] = img_hsv[:,:,0] * (1 - mask_3d[:,:,0]) + new_hue * mask_3d[:,:,0]
        
        # 应用饱和度调整
        if sat_shift != 0:
            sat_factor = 1.0 + (sat_shift / 100.0)
            new_sat = img_hsv[:,:,1] * sat_factor
            img_hsv[:,:,1] = img_hsv[:,:,1] * (1 - mask_3d[:,:,0]) + new_sat * mask_3d[:,:,0]
        
        # 应用明度调整
        if lum_shift != 0:
            lum_factor = 1.0 + (lum_shift / 100.0)
            new_lum = img_hsv[:,:,2] * lum_factor
            img_hsv[:,:,2] = img_hsv[:,:,2] * (1 - mask_3d[:,:,0]) + new_lum * mask_3d[:,:,0]
        
        return img_hsv
    
    def _apply_blend_mode(self, base, overlay, blend_mode, strength):
        """应用混合模式"""
        base_f = base.astype(np.float32) / 255.0
        overlay_f = overlay.astype(np.float32) / 255.0
        
        if blend_mode == 'normal':
            result = overlay_f
        elif blend_mode == 'multiply':
            result = base_f * overlay_f
        elif blend_mode == 'screen':
            result = 1.0 - (1.0 - base_f) * (1.0 - overlay_f)
        elif blend_mode == 'overlay':
            result = np.where(base_f < 0.5, 
                            2.0 * base_f * overlay_f,
                            1.0 - 2.0 * (1.0 - base_f) * (1.0 - overlay_f))
        elif blend_mode == 'soft_light':
            result = np.where(overlay_f < 0.5,
                            base_f - (1.0 - 2.0 * overlay_f) * base_f * (1.0 - base_f),
                            base_f + (2.0 * overlay_f - 1.0) * (np.sqrt(base_f) - base_f))
        elif blend_mode == 'hard_light':
            result = np.where(overlay_f < 0.5,
                            2.0 * base_f * overlay_f,
                            1.0 - 2.0 * (1.0 - base_f) * (1.0 - overlay_f))
        elif blend_mode == 'color_dodge':
            result = np.where(overlay_f >= 1.0, overlay_f, base_f / (1.0 - overlay_f + 1e-10))
        elif blend_mode == 'color_burn':
            result = np.where(overlay_f <= 0.0, overlay_f, 1.0 - (1.0 - base_f) / (overlay_f + 1e-10))
        else:
            result = overlay_f
        
        # 应用强度混合
        result = base_f * (1.0 - strength) + result * strength
        
        # 限制范围并转换回uint8
        result = np.clip(result * 255.0, 0, 255).astype(np.uint8)
        return result
    
    def _apply_mask(self, original_image, processed_image, mask, mask_blur, invert_mask):
        """应用遮罩混合原始图像和处理后的图像"""
        # 获取设备信息
        device = original_image.device
        
        # 获取图像尺寸
        if original_image.dim() == 3:
            h, w, c = original_image.shape
        else:
            raise ValueError(f"Unexpected image dimensions: {original_image.shape}")
        
        # 确保遮罩在正确的设备上
        mask = mask.to(device)
        
        # 处理遮罩维度，确保与图像匹配（参考PhotoshopCurveNode）
        if mask.dim() == 2:
            # 遮罩是 (H, W)
            if mask.shape[0] != h or mask.shape[1] != w:
                # 调整遮罩尺寸以匹配图像
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0), 
                    size=(h, w), 
                    mode='bilinear', 
                    align_corners=False
                ).squeeze(0).squeeze(0)
        elif mask.dim() == 3:
            # 遮罩是 (1, H, W) 或 (H, W, 1)
            if mask.shape[0] == 1:
                # 遮罩是 (1, H, W)，去掉批次维度
                mask = mask.squeeze(0)
            elif mask.shape[2] == 1:
                # 遮罩是 (H, W, 1)，去掉通道维度
                mask = mask.squeeze(2)
            
            # 调整尺寸
            if mask.shape[0] != h or mask.shape[1] != w:
                mask = torch.nn.functional.interpolate(
                    mask.unsqueeze(0).unsqueeze(0), 
                    size=(h, w), 
                    mode='bilinear', 
                    align_corners=False
                ).squeeze(0).squeeze(0)
        
        # 确保遮罩值在 [0, 1] 范围内
        mask = torch.clamp(mask, 0.0, 1.0)
        
        # 反转遮罩（如果需要）
        if invert_mask:
            mask = 1.0 - mask
        
        # 应用高斯模糊羽化效果
        if mask_blur > 0.0:
            mask = self._apply_gaussian_blur(mask, mask_blur)
        
        # 扩展遮罩维度以匹配图像通道 (H, W) -> (H, W, C)
        if original_image.dim() == 3:
            mask = mask.unsqueeze(-1).expand(-1, -1, original_image.shape[2])
        
        # 混合原图和处理后的图像
        result = original_image * (1.0 - mask) + processed_image * mask
        
        return result
    
    def _apply_gaussian_blur(self, tensor, blur_radius):
        """对tensor应用高斯模糊"""
        if blur_radius <= 0:
            return tensor
        
        device = tensor.device
        
        # 计算高斯核大小（奇数）
        kernel_size = int(blur_radius * 2) * 2 + 1
        sigma = blur_radius / 3.0
        
        # 创建1D高斯核
        x = torch.arange(kernel_size, dtype=torch.float32, device=device) - kernel_size // 2
        gauss_1d = torch.exp(-0.5 * (x / sigma) ** 2)
        gauss_1d = gauss_1d / gauss_1d.sum()
        
        # 创建2D高斯核
        gauss_2d = gauss_1d.unsqueeze(0) * gauss_1d.unsqueeze(1)
        gauss_2d = gauss_2d.unsqueeze(0).unsqueeze(0)  # (1, 1, kernel_size, kernel_size)
        
        # 添加padding以保持尺寸
        padding = kernel_size // 2
        
        # 应用卷积
        blurred = torch.nn.functional.conv2d(
            tensor.unsqueeze(0).unsqueeze(0),  # (1, 1, H, W)
            gauss_2d,
            padding=padding
        ).squeeze(0).squeeze(0)  # (H, W)
        
        return blurred

# 更新NODE_CLASS_MAPPINGS和NODE_DISPLAY_NAME_MAPPINGS
NODE_CLASS_MAPPINGS = {
    "PhotoshopCurveNode": PhotoshopCurveNode,
    "PhotoshopLevelsNode": PhotoshopLevelsNode,  # 色阶调整节点
    "HistogramAnalysisNode": HistogramAnalysisNode,  # 直方图分析节点
    "CurvePresetNode": CurvePresetNode,
    "ColorGradingNode": ColorGradingNode,
    "PhotoshopHSLNode": PhotoshopHSLNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PhotoshopCurveNode": "🎨 PS Curve (Professional)",
    "PhotoshopLevelsNode": "🎨 PS Levels (Professional)",  # 色阶调整显示名称
    "HistogramAnalysisNode": "📊 Histogram Analysis",  # 直方图分析显示名称
    "CurvePresetNode": "🎨 PS Curve Preset",
    "ColorGradingNode": "🎨 Color Grading Wheels",
    "PhotoshopHSLNode": "🎨 PS HSL Adjustment",
}

# Web目录设置
WEB_DIRECTORY = "./web"

# JS文件映射 - 将节点类名映射到JS文件名
NODE_CLASS_TO_JS_FILE = {
    "PhotoshopCurveNode": "PhotoshopCurveNode.js",
    "PhotoshopLevelsNode": "PhotoshopHistogramNode.js",  # 使用原有的JS文件
    "HistogramAnalysisNode": "HistogramAnalysisNode.js",  # 明确映射到简化的JS文件
    "CurvePresetNode": "CurvePresetNode.js",
    "ColorGradingNode": "ColorGradingNode.js",
    "PhotoshopHSLNode": "PhotoshopHSLNode.js",
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY', 'NODE_CLASS_TO_JS_FILE']
