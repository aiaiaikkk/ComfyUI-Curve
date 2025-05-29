import torch
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
import io
from scipy.interpolate import CubicSpline
from comfy.model_management import get_torch_device
import matplotlib
matplotlib.use('Agg')  # 使用非交互式后端

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
                'show_histogram': ('BOOLEAN', {
                    'default': True,  # 默认改为True，自动显示直方图
                    'tooltip': '在曲线图背景显示直方图（类似PS）'
                }),
                'histogram_channel': (['Auto', 'RGB', 'R', 'G', 'B', 'Luminance'], {
                    'default': 'Auto',
                    'tooltip': '直方图显示通道，Auto会根据curve channel自动选择'
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
    def IS_CHANGED(cls, image, interpolation, channel, curve_points='0,0;128,128;255,255', curve_strength=1.0, mask=None, mask_blur=0.0, invert_mask=False, show_histogram=True, histogram_channel='Auto', unique_id=None):
        mask_hash = "none" if mask is None else str(hash(mask.data.tobytes()) if hasattr(mask, 'data') else hash(str(mask)))
        return f"{curve_points}_{interpolation}_{channel}_{curve_strength}_{mask_hash}_{mask_blur}_{invert_mask}_{show_histogram}_{histogram_channel}"

    def apply_curve(self, image, interpolation, channel, curve_points='0,0;255,255', curve_strength=1.0, mask=None, mask_blur=0.0, invert_mask=False, show_histogram=True, histogram_channel='Auto', unique_id=None):
        try:
            # 确保输入图像格式正确
            if image is None:
                raise ValueError("Input image is None")
            
            # 处理批次维度
            if image.dim() == 4:  # Batch dimension exists
                batch_size = image.shape[0]
                results = []
                curve_charts = []
                
                # 取第一张图像生成直方图数据
                histogram_data = self._generate_histogram_json(image[0], histogram_channel, channel)
                
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
                        batch_mask, mask_blur, invert_mask, show_histogram, histogram_channel
                    )
                    results.append(result)
                    curve_charts.append(curve_chart)
                return (torch.stack(results, dim=0), torch.stack(curve_charts, dim=0), histogram_data)
            else:
                # 生成直方图数据
                histogram_data = self._generate_histogram_json(image, histogram_channel, channel)
                
                result, curve_chart = self._process_single_image(
                    image, curve_points, interpolation, channel, curve_strength,
                    mask, mask_blur, invert_mask, show_histogram, histogram_channel
                )
                return (result.unsqueeze(0), curve_chart.unsqueeze(0), histogram_data)  # 添加批次维度
                
        except Exception as e:
            print(f"PhotoshopCurveNode error: {e}")
            # 返回原始图像作为fallback
            return (image, self._create_fallback_curve_chart().unsqueeze(0), "{}")
    
    def _process_single_image(self, image, curve_points, interpolation, channel, curve_strength, mask=None, mask_blur=0.0, invert_mask=False, show_histogram=True, histogram_channel='Auto'):
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
        
        # 生成曲线图像 - 使用处理后的图像
        curve_chart = self._generate_curve_chart(result, show_histogram, histogram_channel, control_points, interpolation, curve_strength)
        
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

    def _generate_curve_chart(self, image, show_histogram, histogram_channel, control_points=None, interpolation='cubic', curve_strength=1.0):
        """生成曲线图像 - 统一风格的版本"""
        try:
            # 创建图表
            fig, ax = plt.subplots(figsize=(4, 4), dpi=100)
            
            # 设置背景和网格风格（与曲线编辑器一致）
            fig.patch.set_facecolor('#2a2a2a')  # 外部背景
            ax.set_facecolor('#1a1a1a')  # 内部背景
            
            # 设置图表范围
            ax.set_xlim(0, 255)
            ax.set_ylim(0, 255)
            
            # 绘制网格（与曲线编辑器一致）
            gridColor = '#444444'
            ax.grid(True, color=gridColor, alpha=0.5, linestyle='-', linewidth=0.5)
            
            # 设置轴标签颜色
            ax.tick_params(axis='x', colors='white', labelsize=8)
            ax.tick_params(axis='y', colors='white', labelsize=8)
            ax.spines['bottom'].set_color('#555')
            ax.spines['top'].set_color('#555')
            ax.spines['left'].set_color('#555')
            ax.spines['right'].set_color('#555')
            
            # 添加色调标签（模仿曲线编辑器的标签）
            tone_points = [
                (0, 0, "白色"), 
                (64, 64, "高光"), 
                (128, 128, "中间调"), 
                (192, 192, "阴影"), 
                (255, 255, "黑色")
            ]
            
            for x, y, label in tone_points:
                ax.text(x, 255-y, label, color='#888', fontsize=8, 
                       ha='center', va='center', alpha=0.7)
            
            # 如果启用了直方图显示，直接从当前图像生成直方图
            if show_histogram:
                    self._draw_histogram_background(ax, image, histogram_channel)
            
            # 绘制对角线（线性曲线参考）
            ax.plot([0, 255], [0, 255], color='#555555', linestyle='--', alpha=0.5, linewidth=1)
            
            # 绘制曲线
            if control_points and len(control_points) >= 2:
                try:
                    # 提取x和y坐标
                    x_points = [p[0] for p in control_points]
                    y_points = [p[1] for p in control_points]
                    
                    # 绘制控制点
                    ax.scatter(x_points, y_points, color='#4ecdc4', s=30, zorder=3)
                    
                    # 构建查找表获取完整曲线
                    lut = self._build_lookup_table(control_points, interpolation)
                    
                    # 应用曲线强度（如果需要）
                    if curve_strength != 1.0:
                        identity_lut = np.arange(256, dtype=np.float32)
                        lut = identity_lut * (1 - curve_strength) + lut * curve_strength
                    
                    # 绘制曲线
                    ax.plot(np.arange(256), lut, color='#4ecdc4', linewidth=2, zorder=2)
                except Exception as curve_error:
                    print(f"Error drawing curve on chart: {curve_error}")
            
            # 保存图表为图像
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1, facecolor='#2a2a2a')
            plt.close(fig)
            
            # 转换为PIL图像
            buf.seek(0)
            chart_pil = Image.open(buf)
            
            # 调整图像大小
            chart_pil = chart_pil.resize((512, 512), Image.LANCZOS)
            
            # 转换为RGB模式
            if chart_pil.mode != 'RGB':
                chart_pil = chart_pil.convert('RGB')
            
            # 转换为tensor
            chart_np = np.array(chart_pil) / 255.0
            chart_tensor = torch.from_numpy(chart_np).float().to(get_torch_device())
            
            return chart_tensor
        
        except Exception as e:
            print(f"Error generating curve chart: {e}")
            return self._create_fallback_curve_chart()
        
    def _draw_histogram_background(self, ax, image, histogram_channel):
        """在曲线图背景绘制直方图 - 统一风格的版本"""
        try:
            # 将图像转换为0-255范围
            img_255 = (image * 255.0).clamp(0, 255)
            
            # 确定要显示的通道
            if histogram_channel == 'Auto':
                # 根据当前处理的通道自动选择
                histogram_channel = 'RGB'  # 默认显示RGB
            
            if histogram_channel == 'RGB':
                # 显示RGB三个通道的直方图
                colors = ['#ff5555', '#55ff55', '#5555ff']  # 更鲜明的RGB颜色
                alphas = [0.3, 0.3, 0.3]
                
                for c, (color, alpha) in enumerate(zip(colors, alphas)):
                    if c < img_255.shape[2]:
                        channel_data = img_255[..., c].cpu().numpy().flatten()
                        hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                        
                        # 归一化直方图到0-255范围
                        hist_normalized = (hist / np.max(hist)) * 255 if np.max(hist) > 0 else hist
                        hist_normalized = hist_normalized * 0.8  # 缩放到图表高度的80%
                        
                        # 绘制直方图作为背景
                        ax.fill_between(bins[:-1], 0, hist_normalized, 
                                      alpha=alpha, color=color, step='pre')
                        
            elif histogram_channel == 'Luminance':
                # 显示亮度直方图
                if img_255.shape[2] >= 3:
                    luminance = (img_255[..., 0] * 0.299 + 
                               img_255[..., 1] * 0.587 + 
                               img_255[..., 2] * 0.114)
                    lum_data = luminance.cpu().numpy().flatten()
                    hist, bins = np.histogram(lum_data, bins=256, range=(0, 255))
                    
                    # 归一化直方图
                    hist_normalized = (hist / np.max(hist)) * 255 if np.max(hist) > 0 else hist
                    hist_normalized = hist_normalized * 0.8  # 缩放到图表高度的80%
                    
                    # 绘制灰色直方图
                    ax.fill_between(bins[:-1], 0, hist_normalized, 
                                  alpha=0.3, color='#aaaaaa', step='pre')
                    
            else:
                # 单通道直方图
                channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(histogram_channel, 0)
                colors = {'R': '#ff5555', 'G': '#55ff55', 'B': '#5555ff'}
                color = colors.get(histogram_channel, '#aaaaaa')
                
                if channel_idx < img_255.shape[2]:
                    channel_data = img_255[..., channel_idx].cpu().numpy().flatten()
                    hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                    
                    # 归一化直方图
                    hist_normalized = (hist / np.max(hist)) * 255 if np.max(hist) > 0 else hist
                    hist_normalized = hist_normalized * 0.8  # 缩放到图表高度的80%
                    
                    # 绘制单通道直方图
                    ax.fill_between(bins[:-1], 0, hist_normalized, 
                                  alpha=0.4, color=color, step='pre')
                    
        except Exception as e:
            print(f"Error drawing histogram background: {e}")

    def _create_fallback_curve_chart(self):
        """创建备用曲线图像 - 统一风格的版本"""
        try:
            # 创建一个简单的错误图像
            fig, ax = plt.subplots(figsize=(5, 5), dpi=100)
            fig.patch.set_facecolor('#2a2a2a')  # 外部背景
            
            ax.set_facecolor('#1a1a1a')  # 内部背景
            ax.text(0.5, 0.5, 'Error generating curve chart\nPlease check console for details', 
                   horizontalalignment='center', verticalalignment='center',
                   transform=ax.transAxes, fontsize=12, color='#ff5555')
            ax.set_xlim(0, 255)
            ax.set_ylim(0, 255)
            ax.set_xlabel('Input', color='#cccccc', fontsize=10)
            ax.set_ylabel('Output', color='#cccccc', fontsize=10)
            ax.set_title('Curve Chart Error', color='white', fontsize=12)
            ax.tick_params(colors='#cccccc')
            
            # 设置边框颜色
            for spine in ax.spines.values():
                spine.set_color('#555555')
            
            # 绘制对角线（线性曲线参考）
            ax.plot([0, 255], [0, 255], color='#555555', linestyle='--', alpha=0.5, linewidth=1)
            
            # 绘制网格线
            gridColor = '#444444'
            ax.grid(True, color=gridColor, alpha=0.5, linestyle='-', linewidth=0.5)
            
            # 转换为tensor
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', pad_inches=0.1, facecolor='#2a2a2a')
            plt.close(fig)
            buf.seek(0)
            
            pil_image = Image.open(buf)
            pil_image = pil_image.resize((512, 512), Image.LANCZOS)
            
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            img_array = np.array(pil_image)
            curve_chart_tensor = torch.from_numpy(img_array).float() / 255.0
            
            return curve_chart_tensor.to(get_torch_device())
        except Exception as e:
            print(f"Error creating fallback curve chart: {e}")
            # 创建纯色图像作为最后的备用
            empty_chart = torch.ones((512, 512, 3), dtype=torch.float32).to(get_torch_device()) * 0.1
            # 在中间绘制红色十字表示错误
            empty_chart[236:276, 236:276, 0] = 1.0
            empty_chart[236:276, 236:276, 1] = 0.0
            empty_chart[236:276, 236:276, 2] = 0.0
            return empty_chart
            
    def _generate_histogram_json(self, image, histogram_channel, curve_channel):
        """生成用于前端显示的直方图JSON数据"""
        try:
            # 将图像转换为0-255范围
            img_255 = (image * 255.0).clamp(0, 255).cpu().numpy()
            
            # 确定要显示的通道
            display_channel = histogram_channel
            if display_channel == 'Auto':
                display_channel = curve_channel
            
            # 创建存储直方图数据的字典
            result = {'histograms': {}}
            
            # 收集RGB通道直方图数据
            if display_channel == 'RGB' or display_channel == 'Auto':
                for c, color_name in enumerate(['R', 'G', 'B']):
                    if c < img_255.shape[-1]:
                        channel_data = img_255[..., c].flatten()
                        hist, _ = np.histogram(channel_data, bins=256, range=(0, 255))
                        # 归一化直方图
                        hist_max = np.max(hist) if np.max(hist) > 0 else 1
                        normalized_hist = (hist / hist_max).tolist()
                        result['histograms'][color_name] = normalized_hist
            
            # 收集亮度通道直方图数据
            if display_channel == 'Luminance':
                if img_255.shape[-1] >= 3:
                    luminance = 0.299 * img_255[..., 0] + 0.587 * img_255[..., 1] + 0.114 * img_255[..., 2]
                    hist, _ = np.histogram(luminance.flatten(), bins=256, range=(0, 255))
                    hist_max = np.max(hist) if np.max(hist) > 0 else 1
                    normalized_hist = (hist / hist_max).tolist()
                    result['histograms']['Luminance'] = normalized_hist
            
            # 收集单个通道直方图数据
            if display_channel in ['R', 'G', 'B']:
                channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(display_channel, 0)
                if channel_idx < img_255.shape[-1]:
                    channel_data = img_255[..., channel_idx].flatten()
                    hist, _ = np.histogram(channel_data, bins=256, range=(0, 255))
                    hist_max = np.max(hist) if np.max(hist) > 0 else 1
                    normalized_hist = (hist / hist_max).tolist()
                    result['histograms'][display_channel] = normalized_hist
            
            # 添加当前通道选择
            result['active_channel'] = display_channel
            
            import json
            return json.dumps(result)
            
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

class PhotoshopHistogramNode:
    """PS直方图功能节点 - 提供直方图分析和色阶调整"""
    
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
                'gamma': ('FLOAT', {
                    'default': 1.0,
                    'min': 0.1,
                    'max': 9.99,
                    'step': 0.01,
                    'display': 'slider',
                    'tooltip': '伽马值 (0.1-9.99)'
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
    
    RETURN_TYPES = ('IMAGE', 'IMAGE', 'STRING', 'STRING')
    RETURN_NAMES = ('image', 'histogram_image', 'histogram_data', 'statistics')
    FUNCTION = 'apply_histogram_adjustment'
    CATEGORY = 'Image/Analysis'
    OUTPUT_NODE = False
    
    @classmethod
    def IS_CHANGED(cls, image, channel, input_black=0.0, input_white=255.0, gamma=1.0, 
                   output_black=0.0, output_white=255.0, auto_levels=False, auto_contrast=False, 
                   clip_percentage=0.1, unique_id=None):
        return f"{channel}_{input_black}_{input_white}_{gamma}_{output_black}_{output_white}_{auto_levels}_{auto_contrast}_{clip_percentage}"

    def apply_histogram_adjustment(self, image, channel, input_black=0.0, input_white=255.0, gamma=1.0,
                                 output_black=0.0, output_white=255.0, auto_levels=False, auto_contrast=False,
                                 clip_percentage=0.1, unique_id=None):
        try:
            # 确保输入图像格式正确
            if image is None:
                raise ValueError("Input image is None")
            
            # 处理批次维度
            if image.dim() == 4:  # Batch dimension exists
                batch_size = image.shape[0]
                results = []
                histogram_images = []
                histogram_data_list = []
                statistics_list = []
                
                for b in range(batch_size):
                    result, hist_image, hist_data, stats = self._process_single_image(
                        image[b], channel, input_black, input_white, gamma,
                        output_black, output_white, auto_levels, auto_contrast, clip_percentage
                    )
                    results.append(result)
                    histogram_images.append(hist_image)
                    histogram_data_list.append(hist_data)
                    statistics_list.append(stats)
                
                # 合并批次结果
                combined_hist = "\n".join([f"Image {i+1}:\n{hist}" for i, hist in enumerate(histogram_data_list)])
                combined_stats = "\n".join([f"Image {i+1}:\n{stats}" for i, stats in enumerate(statistics_list)])
                
                return (torch.stack(results, dim=0), torch.stack(histogram_images, dim=0), combined_hist, combined_stats)
            else:
                result, hist_image, hist_data, stats = self._process_single_image(
                    image, channel, input_black, input_white, gamma,
                    output_black, output_white, auto_levels, auto_contrast, clip_percentage
                )
                return (result.unsqueeze(0), hist_image.unsqueeze(0), hist_data, stats)
                
        except Exception as e:
            print(f"PhotoshopHistogramNode error: {e}")
            # 返回原始图像作为fallback
            fallback_hist = self._create_fallback_histogram_image()
            return (image, fallback_hist, "Error generating histogram", "Error calculating statistics")
    
    def _process_single_image(self, image, channel, input_black, input_white, gamma, output_black, output_white, auto_levels, auto_contrast, clip_percentage):
        # 确保图像在正确的设备上
        device = get_torch_device()
        image = image.to(device)
        
        # 处理图像维度 (HWC)
        if image.dim() == 3:
            h, w, c = image.shape
        else:
            raise ValueError(f"Unexpected image dimensions: {image.shape}")
        
        # 将图像转换为0-255范围用于直方图分析
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 生成直方图数据和图像
        histogram_data = self._generate_histogram_data(img_255, channel)
        histogram_image = self._generate_histogram_image(img_255, channel, input_black, input_white, gamma)
        
        # 计算统计信息
        statistics = self._calculate_statistics(img_255, channel)
        
        # 应用自动调整（如果启用）
        if auto_levels or auto_contrast:
            input_black, input_white, gamma = self._calculate_auto_levels(
                img_255, channel, auto_levels, auto_contrast, clip_percentage
            )
        
        # 应用色阶调整
        result = self._apply_levels_adjustment(
            image, channel, input_black, input_white, gamma, output_black, output_white
        )
        
        return result, histogram_image, histogram_data, statistics
    
    def _generate_histogram_data(self, img_255, channel):
        """生成直方图数据"""
        histogram_info = []
        
        if channel == 'RGB' or channel == 'Luminance':
            if channel == 'RGB':
                # RGB综合直方图
                for c, color_name in enumerate(['Red', 'Green', 'Blue']):
                    if c < img_255.shape[2]:
                        channel_data = img_255[..., c].cpu().numpy().flatten()
                        hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                        histogram_info.append(f"{color_name} Channel Histogram:")
                        histogram_info.append(f"  Bins: {len(hist)}")
                        histogram_info.append(f"  Peak: {np.argmax(hist)} (value: {np.max(hist)})")
                        histogram_info.append(f"  Mean: {np.mean(channel_data):.2f}")
                        histogram_info.append("")
            else:
                # 亮度直方图
                if img_255.shape[2] >= 3:
                    luminance = (img_255[..., 0] * 0.299 + 
                               img_255[..., 1] * 0.587 + 
                               img_255[..., 2] * 0.114)
                    lum_data = luminance.cpu().numpy().flatten()
                    hist, bins = np.histogram(lum_data, bins=256, range=(0, 255))
                    histogram_info.append("Luminance Histogram:")
                    histogram_info.append(f"  Bins: {len(hist)}")
                    histogram_info.append(f"  Peak: {np.argmax(hist)} (value: {np.max(hist)})")
                    histogram_info.append(f"  Mean: {np.mean(lum_data):.2f}")
        else:
            # 单通道直方图
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            colors = {'R': 'red', 'G': 'green', 'B': 'blue'}
            color = colors.get(channel, 'white')
            
            if channel_idx < img_255.shape[2]:
                channel_data = img_255[..., channel_idx].cpu().numpy().flatten()
                hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                
                # 归一化直方图
                hist_normalized = (hist / np.max(hist)) * 255 if np.max(hist) > 0 else hist
                
                # 绘制单通道直方图
                histogram_info.append(f"{channel} Channel Histogram:")
                histogram_info.append(f"  Bins: {len(hist)}")
                histogram_info.append(f"  Peak: {np.argmax(hist)} (value: {np.max(hist)})")
                histogram_info.append(f"  Mean: {np.mean(channel_data):.2f}")
                histogram_info.append(f"  Std Dev: {np.std(channel_data):.2f}")
                
                # 添加分布信息
                histogram_info.append(f"  Min: {np.min(channel_data):.2f}")
                histogram_info.append(f"  Max: {np.max(channel_data):.2f}")
                histogram_info.append(f"  Median: {np.median(channel_data):.2f}")
                
                # 计算百分位数
                p1, p99 = np.percentile(channel_data, [1, 99])
                histogram_info.append(f"  1st Percentile: {p1:.2f}")
                histogram_info.append(f"  99th Percentile: {p99:.2f}")
        
        return "\n".join(histogram_info)
    
    def _generate_histogram_image(self, img_255, channel, input_black=0, input_white=255, gamma=1.0):
        """生成直方图可视化图像 - 统一风格的版本"""
        try:
            # 设置图像大小
            fig_width, fig_height = 6, 4
            fig, ax = plt.subplots(figsize=(fig_width, fig_height))
            
            # 统一风格
            fig.patch.set_facecolor('#2a2a2a')  # 外部背景
            ax.set_facecolor('#1a1a1a')  # 内部背景
            
            # 设置网格线和边框
            gridColor = '#444444'
            ax.grid(True, color=gridColor, alpha=0.5, linestyle='-', linewidth=0.5)
            
            # 设置轴标签颜色
            ax.tick_params(axis='x', colors='white', labelsize=8)
            ax.tick_params(axis='y', colors='white', labelsize=8)
            for spine in ax.spines.values():
                spine.set_color('#555555')
            
            # 设置标题和标签颜色
            title_color = 'white'
            label_color = '#cccccc'
            
            if channel == 'RGB':
                # RGB综合直方图 - 显示三个通道
                colors = ['#ff5555', '#55ff55', '#5555ff']  # 更鲜明的RGB颜色
                channel_names = ['Red', 'Green', 'Blue']
                
                for c, (color, name) in enumerate(zip(colors, channel_names)):
                    if c < img_255.shape[2]:
                        channel_data = img_255[..., c].cpu().numpy().flatten()
                        hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                        
                        # 绘制直方图
                        ax.plot(bins[:-1], hist, color=color, alpha=0.8, linewidth=1.5, label=name)
                        ax.fill_between(bins[:-1], hist, alpha=0.3, color=color)
                
                ax.legend(loc='upper right', framealpha=0.7, facecolor='#2a2a2a', edgecolor='#555555', labelcolor='white')
                title = 'RGB Histogram'
                
            elif channel == 'Luminance':
                # 亮度直方图
                if img_255.shape[2] >= 3:
                    luminance = (img_255[..., 0] * 0.299 + 
                               img_255[..., 1] * 0.587 + 
                               img_255[..., 2] * 0.114)
                    lum_data = luminance.cpu().numpy().flatten()
                    hist, bins = np.histogram(lum_data, bins=256, range=(0, 255))
                    
                    ax.plot(bins[:-1], hist, color='#aaaaaa', linewidth=1.5)
                    ax.fill_between(bins[:-1], hist, alpha=0.5, color='#aaaaaa')
                    
                title = 'Luminance Histogram'
                
            else:
                # 单通道直方图
                channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
                colors = {'R': '#ff5555', 'G': '#55ff55', 'B': '#5555ff'}
                color = colors.get(channel, '#5555ff')
                
                if channel_idx < img_255.shape[2]:
                    channel_data = img_255[..., channel_idx].cpu().numpy().flatten()
                    hist, bins = np.histogram(channel_data, bins=256, range=(0, 255))
                    
                    ax.plot(bins[:-1], hist, color=color, linewidth=1.5)
                    ax.fill_between(bins[:-1], hist, alpha=0.5, color=color)
                    
                title = f'{channel} Channel Histogram'
            
            # 添加色阶指示线
            if input_black > 0:
                ax.axvline(x=input_black, color='#ffffff', linestyle='--', alpha=0.7, linewidth=1, 
                          label=f'Black: {input_black:.0f}')
            if input_white < 255:
                ax.axvline(x=input_white, color='#ffffff', linestyle='--', alpha=0.7, linewidth=1, 
                          label=f'White: {input_white:.0f}')
            if gamma != 1.0:
                # 显示伽马中点
                gamma_point = input_black + (input_white - input_black) * (0.5 ** (1/gamma))
                ax.axvline(x=gamma_point, color='#aaaaaa', linestyle=':', alpha=0.7, linewidth=1, 
                          label=f'Gamma: {gamma:.2f}')
            
            # 设置标题和标签
            ax.set_title(title, fontsize=12, fontweight='bold', color=title_color, pad=10)
            ax.set_xlabel('Pixel Value (0-255)', fontsize=10, color=label_color)
            ax.set_ylabel('Frequency', fontsize=10, color=label_color)
            ax.set_xlim(0, 255)
            
            # 如果有色阶线，显示图例
            if input_black > 0 or input_white < 255 or gamma != 1.0:
                ax.legend(loc='upper left', fontsize=8, framealpha=0.7, 
                         facecolor='#2a2a2a', edgecolor='#555555', labelcolor='white')
            
            # 调整布局
            plt.tight_layout()
            
            # 将图像转换为tensor
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1, facecolor='#2a2a2a')
            plt.close(fig)
            
            # 转换为PIL图像
            buf.seek(0)
            chart_pil = Image.open(buf)
            
            # 调整图像大小
            chart_pil = chart_pil.resize((512, 512), Image.LANCZOS)
            
            # 转换为RGB模式
            if chart_pil.mode != 'RGB':
                chart_pil = chart_pil.convert('RGB')
            
            # 转换为tensor
            chart_np = np.array(chart_pil) / 255.0
            chart_tensor = torch.from_numpy(chart_np).float().to(get_torch_device())
            
            return chart_tensor
        
        except Exception as e:
            print(f"Error generating histogram image: {e}")
            return self._create_fallback_histogram_image()
    
    def _create_fallback_histogram_image(self):
        """创建备用直方图图像 - 统一风格的版本"""
        try:
            # 创建一个简单的错误图像
            fig, ax = plt.subplots(figsize=(5, 5), dpi=100)
            fig.patch.set_facecolor('#2a2a2a')  # 外部背景
            
            ax.set_facecolor('#1a1a1a')  # 内部背景
            ax.text(0.5, 0.5, 'Error generating histogram\nPlease check console for details', 
                   horizontalalignment='center', verticalalignment='center',
                   transform=ax.transAxes, fontsize=12, color='#ff5555')
            ax.set_xlim(0, 255)
            ax.set_ylim(0, 255)
            ax.set_xlabel('Pixel Value', color='#cccccc', fontsize=10)
            ax.set_ylabel('Frequency', color='#cccccc', fontsize=10)
            ax.set_title('Histogram Error', color='white', fontsize=12)
            ax.tick_params(colors='#cccccc')
            
            # 设置边框颜色
            for spine in ax.spines.values():
                spine.set_color('#555555')
            
            # 绘制网格线
            gridColor = '#444444'
            ax.grid(True, color=gridColor, alpha=0.5, linestyle='-', linewidth=0.5)
            
            # 转换为tensor
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=100, bbox_inches='tight', pad_inches=0.1, facecolor='#2a2a2a')
            plt.close(fig)
            buf.seek(0)
            
            pil_image = Image.open(buf)
            pil_image = pil_image.resize((512, 512), Image.LANCZOS)
            
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            img_array = np.array(pil_image)
            histogram_tensor = torch.from_numpy(img_array).float() / 255.0
            
            return histogram_tensor.to(get_torch_device())
            
        except Exception as e:
            print(f"Error creating fallback histogram: {e}")
            # 创建一个纯色图像作为最后的备用
            empty_chart = torch.ones((512, 512, 3), dtype=torch.float32).to(get_torch_device()) * 0.1
            # 在中间绘制红色十字表示错误
            empty_chart[236:276, 236:276, 0] = 1.0
            empty_chart[236:276, 236:276, 1] = 0.0
            empty_chart[236:276, 236:276, 2] = 0.0
            return empty_chart

    def _calculate_statistics(self, img_255, channel):
        """计算图像统计信息"""
        stats_info = []
        
        if channel == 'RGB':
            for c, color_name in enumerate(['Red', 'Green', 'Blue']):
                if c < img_255.shape[2]:
                    channel_data = img_255[..., c].cpu().numpy()
                    stats_info.append(f"{color_name} Channel Statistics:")
                    stats_info.append(f"  Mean: {np.mean(channel_data):.2f}")
                    stats_info.append(f"  Std Dev: {np.std(channel_data):.2f}")
                    stats_info.append(f"  Min: {np.min(channel_data):.2f}")
                    stats_info.append(f"  Max: {np.max(channel_data):.2f}")
                    stats_info.append("")
        elif channel == 'Luminance':
            if img_255.shape[2] >= 3:
                luminance = (img_255[..., 0] * 0.299 + 
                           img_255[..., 1] * 0.587 + 
                           img_255[..., 2] * 0.114)
                lum_data = luminance.cpu().numpy()
                stats_info.append("Luminance Statistics:")
                stats_info.append(f"  Mean: {np.mean(lum_data):.2f}")
                stats_info.append(f"  Std Dev: {np.std(lum_data):.2f}")
                stats_info.append(f"  Min: {np.min(lum_data):.2f}")
                stats_info.append(f"  Max: {np.max(lum_data):.2f}")
        else:
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            if channel_idx < img_255.shape[2]:
                channel_data = img_255[..., channel_idx].cpu().numpy()
                stats_info.append(f"{channel} Channel Statistics:")
                stats_info.append(f"  Mean: {np.mean(channel_data):.2f}")
                stats_info.append(f"  Std Dev: {np.std(channel_data):.2f}")
                stats_info.append(f"  Min: {np.min(channel_data):.2f}")
                stats_info.append(f"  Max: {np.max(channel_data):.2f}")
                stats_info.append(f"  Median: {np.median(channel_data):.2f}")
                
                # 添加对比度和亮度信息
                contrast = np.std(channel_data)
                brightness = np.mean(channel_data)
                stats_info.append(f"  Contrast (Std): {contrast:.2f}")
                stats_info.append(f"  Brightness (Mean): {brightness:.2f}")
                
                # 动态范围
                dynamic_range = np.max(channel_data) - np.min(channel_data)
                stats_info.append(f"  Dynamic Range: {dynamic_range:.2f}")
        
        return "\n".join(stats_info)
    
    def _calculate_auto_levels(self, img_255, channel, auto_levels, auto_contrast, clip_percentage):
        """计算自动色阶参数"""
        if channel == 'RGB':
            # 对所有通道计算
            all_data = img_255.cpu().numpy().flatten()
        elif channel == 'Luminance':
            if img_255.shape[2] >= 3:
                luminance = (img_255[..., 0] * 0.299 + 
                           img_255[..., 1] * 0.587 + 
                           img_255[..., 2] * 0.114)
                all_data = luminance.cpu().numpy().flatten()
            else:
                all_data = img_255[..., 0].cpu().numpy().flatten()
        else:
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            if channel_idx < img_255.shape[2]:
                all_data = img_255[..., channel_idx].cpu().numpy().flatten()
            else:
                all_data = img_255[..., 0].cpu().numpy().flatten()
        
        # 计算百分位数来确定黑白场点
        low_percentile = clip_percentage
        high_percentile = 100 - clip_percentage
        
        input_black = np.percentile(all_data, low_percentile)
        input_white = np.percentile(all_data, high_percentile)
        
        # 确保有效范围
        input_black = max(0, min(254, input_black))
        input_white = max(input_black + 1, min(255, input_white))
        
        # 伽马值保持1.0（除非需要特殊调整）
        gamma = 1.0
        
        # 如果只是自动对比度，调整伽马值
        if auto_contrast and not auto_levels:
            # 计算中间调的位置来调整伽马
            median_val = np.median(all_data)
            if input_white > input_black:
                normalized_median = (median_val - input_black) / (input_white - input_black)
                if normalized_median > 0 and normalized_median < 1:
                    # 调整伽马使中间调更接近0.5
                    gamma = np.log(0.5) / np.log(normalized_median)
                    gamma = max(0.1, min(9.99, gamma))
        
        return input_black, input_white, gamma
    
    def _apply_levels_adjustment(self, image, channel, input_black, input_white, gamma, output_black, output_white):
        """应用色阶调整"""
        device = image.device
        
        # 将图像转换为0-255范围
        img_255 = (image * 255.0).clamp(0, 255)
        
        # 确保参数有效
        input_black = max(0, min(254, input_black))
        input_white = max(input_black + 1, min(255, input_white))
        output_black = max(0, min(254, output_black))
        output_white = max(output_black + 1, min(255, output_white))
        gamma = max(0.1, min(9.99, gamma))
        
        # 应用色阶调整
        if channel == 'RGB':
            # 对所有通道应用
            result = torch.zeros_like(img_255)
            for c in range(min(3, img_255.shape[2])):
                result[..., c] = self._apply_levels_to_channel(
                    img_255[..., c], input_black, input_white, gamma, output_black, output_white
                )
            # 如果有alpha通道，保持不变
            if img_255.shape[2] > 3:
                result[..., 3:] = img_255[..., 3:]
        elif channel == 'Luminance':
            # 对亮度应用调整，保持色彩
            if img_255.shape[2] >= 3:
                # 转换到HSV空间
                result = self._adjust_luminance_only(img_255, input_black, input_white, gamma, output_black, output_white)
            else:
                result = self._apply_levels_to_channel(
                    img_255[..., 0], input_black, input_white, gamma, output_black, output_white
                ).unsqueeze(-1)
        else:
            # 对单个通道应用
            channel_idx = {'R': 0, 'G': 1, 'B': 2}.get(channel, 0)
            result = img_255.clone()
            if channel_idx < img_255.shape[2]:
                result[..., channel_idx] = self._apply_levels_to_channel(
                    img_255[..., channel_idx], input_black, input_white, gamma, output_black, output_white
                )
        
        # 转换回0-1范围
        result = (result / 255.0).clamp(0, 1)
        
        return result
    
    def _apply_levels_to_channel(self, channel_data, input_black, input_white, gamma, output_black, output_white):
        """对单个通道应用色阶调整"""
        # 输入范围调整
        normalized = (channel_data - input_black) / (input_white - input_black)
        normalized = torch.clamp(normalized, 0, 1)
        
        # 伽马校正
        gamma_corrected = torch.pow(normalized, 1.0 / gamma)
        
        # 输出范围调整
        result = gamma_corrected * (output_white - output_black) + output_black
        
        return torch.clamp(result, 0, 255)
    
    def _adjust_luminance_only(self, img_255, input_black, input_white, gamma, output_black, output_white):
        """仅调整亮度，保持色彩"""
        # 转换到HSV空间进行亮度调整
        rgb = img_255 / 255.0
        
        # 简化的RGB到HSV转换（仅处理V通道）
        max_vals, _ = torch.max(rgb, dim=2, keepdim=True)
        min_vals, _ = torch.min(rgb, dim=2, keepdim=True)
        
        # 调整V通道（亮度）
        v_channel = max_vals.squeeze(-1) * 255.0
        adjusted_v = self._apply_levels_to_channel(v_channel, input_black, input_white, gamma, output_black, output_white)
        adjusted_v = adjusted_v / 255.0
        
        # 计算调整比例
        adjustment_ratio = torch.where(max_vals.squeeze(-1) > 0, adjusted_v / max_vals.squeeze(-1), torch.ones_like(adjusted_v))
        adjustment_ratio = adjustment_ratio.unsqueeze(-1)
        
        # 应用调整比例到RGB
        result = rgb * adjustment_ratio
        result = torch.clamp(result, 0, 1) * 255.0
        
        return result

# 导出节点映射
NODE_CLASS_MAPPINGS = {
    "PhotoshopCurveNode": PhotoshopCurveNode,
    "PhotoshopHistogramNode": PhotoshopHistogramNode,
    "CurvePresetNode": CurvePresetNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PhotoshopCurveNode": "🎨 PS Curve (Professional)",
    "PhotoshopHistogramNode": "📊 PS Histogram & Levels",
    "CurvePresetNode": "🎨 PS Curve Preset",
}

# Web目录设置
WEB_DIRECTORY = "./web"