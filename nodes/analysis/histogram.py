"""
直方图分析节点

提供专业的图像直方图分析功能：
- RGB和单通道直方图分析
- 亮度直方图
- 详细统计信息
- 专业可视化
- 原始数据导出
"""

import torch
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
import io
import json
from scipy import stats

from ..core.base_node import BaseImageNode


class HistogramAnalysisNode(BaseImageNode):
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
            
            # 支持批处理
            if len(image.shape) == 4:
                batch_size = image.shape[0]
                histogram_images = []
                histogram_datas = []
                statistics_list = []
                raw_datas = []
                
                for i in range(batch_size):
                    result = self._process_single_image(
                        image[i], channel, histogram_bins, show_statistics, export_data
                    )
                    histogram_images.append(result[0])
                    histogram_datas.append(result[1])
                    statistics_list.append(result[2])
                    raw_datas.append(result[3])
                
                # 将直方图图像堆叠成批次
                histogram_batch = torch.stack(histogram_images)
                
                # 对于文本数据，如果是批处理，返回第一个（因为ComfyUI不支持批量字符串）
                return (histogram_batch, histogram_datas[0], statistics_list[0], raw_datas[0])
            else:
                result = self._process_single_image(
                    image, channel, histogram_bins, show_statistics, export_data
                )
                # 确保图像有批次维度
                if len(result[0].shape) == 3:
                    histogram_image = result[0].unsqueeze(0)
                else:
                    histogram_image = result[0]
                return (histogram_image, result[1], result[2], result[3])
                
        except Exception as e:
            print(f"HistogramAnalysisNode error: {e}")
            import traceback
            traceback.print_exc()
            fallback_hist = self._create_fallback_histogram_image()
            if len(fallback_hist.shape) == 3:
                fallback_hist = fallback_hist.unsqueeze(0)
            return (fallback_hist, "Error generating histogram", "Error calculating statistics", "Error exporting data")
    
    def _process_single_image(self, image, channel, histogram_bins, show_statistics, export_data):
        """处理单张图像的直方图分析"""
        device = image.device
        
        # 确保图像在正确的范围内
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
        result_tensor = torch.from_numpy(img_array.astype(np.float32) / 255.0).to(img_255.device)
        
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
        
        return json.dumps(data, indent=2)
    
    def _calculate_comprehensive_statistics(self, img_255, channel):
        """计算全面的图像统计信息"""
        img_np = img_255.cpu().numpy()
        stats_dict = {}
        
        if channel == 'RGB':
            for i, ch in enumerate(['R', 'G', 'B']):
                channel_data = img_np[:, :, i].flatten()
                stats_dict[ch] = self._calculate_channel_stats(channel_data)
        else:
            if channel in ['R', 'G', 'B']:
                channel_idx = {'R': 0, 'G': 1, 'B': 2}[channel]
                channel_data = img_np[:, :, channel_idx].flatten()
            elif channel == 'Luminance':
                channel_data = (img_np[:, :, 0] * 0.299 + img_np[:, :, 1] * 0.587 + img_np[:, :, 2] * 0.114).flatten()
            
            stats_dict[channel] = self._calculate_channel_stats(channel_data)
        
        # 格式化输出
        result = []
        for ch, stat in stats_dict.items():
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
        error_image = np.ones((600, 800, 3), dtype=np.float32) * 0.1
        # 添加错误文本
        from PIL import ImageDraw, ImageFont
        pil_img = Image.fromarray((error_image * 255).astype(np.uint8))
        draw = ImageDraw.Draw(pil_img)
        try:
            draw.text((400, 300), "Error generating histogram", fill=(255, 100, 100), anchor="mm")
        except:
            pass
        error_image = np.array(pil_img).astype(np.float32) / 255.0
        return torch.from_numpy(error_image)