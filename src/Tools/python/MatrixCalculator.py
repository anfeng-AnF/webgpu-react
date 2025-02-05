import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
import numpy as np
import math

class DraggableEntry(tk.Entry):
    def __init__(self, master, default_value="0", min_value=-100, max_value=100, step=0.1, **kwargs):
        super().__init__(master, **kwargs)
        self.min_value = min_value
        self.max_value = max_value
        self.step = step
        self.drag_start_x = None
        self.start_value = None
        self.last_x = None
        
        # 设置默认值
        self.insert(0, default_value)
        
        # 绑定鼠标事件
        self.bind("<Button-1>", self.on_click)
        self.bind("<B1-Motion>", self.on_drag)
        self.bind("<ButtonRelease-1>", self.on_release)
        
    def on_click(self, event):
        self.drag_start_x = event.x
        self.last_x = event.x
        try:
            self.start_value = float(self.get())
        except ValueError:
            self.start_value = 0
            self.delete(0, tk.END)
            self.insert(0, "0")
    
    def on_drag(self, event):
        if self.last_x is not None:
            # 计算相对于上一次位置的变化
            dx = event.x - self.last_x
            try:
                current_value = float(self.get())
            except ValueError:
                current_value = 0
                
            # 根据拖动距离调整值
            new_value = current_value + dx * self.step
            new_value = max(self.min_value, min(self.max_value, new_value))
            
            # 更新显示
            self.delete(0, tk.END)
            self.insert(0, f"{new_value:.2f}")
            
            # 更新上一次位置
            self.last_x = event.x
            
            # 触发更新事件
            self.event_generate("<<ValueChanged>>")
            
    def on_release(self, event):
        self.drag_start_x = None
        self.last_x = None
        self.start_value = None

class MatrixCalculator:
    def __init__(self, root):
        self.root = root
        self.root.title("4x4变换矩阵计算器")
        
        # 创建标签页
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(expand=True, fill='both', padx=5, pady=5)
        
        # 创建矩阵生成页
        self.generator_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.generator_frame, text='矩阵生成')
        
        # 创建矩阵解析页
        self.parser_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.parser_frame, text='矩阵解析')
        
        # 设置矩阵生成页
        self.setup_generator()
        
        # 设置矩阵解析页
        self.setup_parser()

    def setup_generator(self):
        # 创建输入框架
        self.input_frame = tk.Frame(self.generator_frame)
        self.input_frame.pack(pady=10)
        
        # Position输入
        tk.Label(self.input_frame, text="Position:").grid(row=0, column=0, sticky='e')
        self.pos_frame = tk.Frame(self.input_frame)
        self.pos_frame.grid(row=0, column=1, pady=5)
        
        self.pos_entries = []
        for i, label in enumerate(['X:', 'Y:', 'Z:']):
            tk.Label(self.pos_frame, text=label).grid(row=0, column=i*2)
            entry = DraggableEntry(self.pos_frame, width=8, default_value="0", 
                                 min_value=-100, max_value=100, step=0.05)
            entry.grid(row=0, column=i*2+1, padx=2)
            self.pos_entries.append(entry)
        
        # Rotation输入 (欧拉角，单位：度)
        tk.Label(self.input_frame, text="Rotation (度):").grid(row=1, column=0, sticky='e')
        self.rot_frame = tk.Frame(self.input_frame)
        self.rot_frame.grid(row=1, column=1, pady=5)
        
        self.rot_entries = []
        for i, label in enumerate(['X:', 'Y:', 'Z:']):
            tk.Label(self.rot_frame, text=label).grid(row=0, column=i*2)
            entry = DraggableEntry(self.rot_frame, width=8, default_value="0",
                                 min_value=-360, max_value=360, step=0.5)
            entry.grid(row=0, column=i*2+1, padx=2)
            self.rot_entries.append(entry)
        
        # Scale输入
        tk.Label(self.input_frame, text="Scale:").grid(row=2, column=0, sticky='e')
        self.scale_frame = tk.Frame(self.input_frame)
        self.scale_frame.grid(row=2, column=1, pady=5)
        
        self.scale_entries = []
        for i, label in enumerate(['X:', 'Y:', 'Z:']):
            tk.Label(self.scale_frame, text=label).grid(row=0, column=i*2)
            entry = DraggableEntry(self.scale_frame, width=8, default_value="1",
                                 min_value=0.01, max_value=10, step=0.01)
            entry.grid(row=0, column=i*2+1, padx=2)
            self.scale_entries.append(entry)
        
        # 计算按钮
        tk.Button(self.generator_frame, text="生成矩阵", command=self.calculate).pack(pady=5)
        
        # 显示结果的文本框
        self.result_text = tk.Text(self.generator_frame, height=8, width=60)
        self.result_text.pack(pady=10)
        
        # 添加复制按钮
        tk.Button(self.generator_frame, text="复制到剪贴板", command=self.copy_to_clipboard).pack(pady=5)

    def setup_parser(self):
        # 添加说明标签
        tk.Label(self.parser_frame, text="粘贴要解析的矩阵:").pack(pady=5)
        
        # 添加矩阵输入文本框
        self.matrix_input = tk.Text(self.parser_frame, height=10, width=60)
        self.matrix_input.pack(pady=5)
        
        # 添加解析按钮
        tk.Button(self.parser_frame, text="解析矩阵", command=self.parse_matrix).pack(pady=5)
        
        # 添加解析结果显示框
        self.parse_result_frame = tk.Frame(self.parser_frame)
        self.parse_result_frame.pack(pady=10)
        
        # Position结果
        tk.Label(self.parse_result_frame, text="Position:").grid(row=0, column=0, sticky='e', padx=5)
        self.pos_result = tk.Label(self.parse_result_frame, text="X: 0.00  Y: 0.00  Z: 0.00")
        self.pos_result.grid(row=0, column=1, sticky='w')
        
        # Rotation结果
        tk.Label(self.parse_result_frame, text="Rotation:").grid(row=1, column=0, sticky='e', padx=5)
        self.rot_result = tk.Label(self.parse_result_frame, text="X: 0.00  Y: 0.00  Z: 0.00")
        self.rot_result.grid(row=1, column=1, sticky='w')
        
        # Scale结果
        tk.Label(self.parse_result_frame, text="Scale:").grid(row=2, column=0, sticky='e', padx=5)
        self.scale_result = tk.Label(self.parse_result_frame, text="X: 1.00  Y: 1.00  Z: 1.00")
        self.scale_result.grid(row=2, column=1, sticky='w')
        
        # 添加"应用到生成器"按钮
        tk.Button(self.parser_frame, text="应用到生成器", command=self.apply_to_generator).pack(pady=5)

    def apply_to_generator(self):
        # 切换到生成器标签页
        self.notebook.select(0)
        # 触发计算以更新显示
        self.calculate()

    def copy_to_clipboard(self):
        self.root.clipboard_clear()
        self.root.clipboard_append(self.result_text.get(1.0, tk.END).strip())

    def create_rotation_matrix(self, rx, ry, rz):
        # 将角度转换为弧度
        rx, ry, rz = np.radians([rx, ry, rz])
        
        # 创建各轴的旋转矩阵
        Rx = np.array([
            [1, 0, 0],
            [0, np.cos(rx), -np.sin(rx)],
            [0, np.sin(rx), np.cos(rx)]
        ])
        
        Ry = np.array([
            [np.cos(ry), 0, np.sin(ry)],
            [0, 1, 0],
            [-np.sin(ry), 0, np.cos(ry)]
        ])
        
        Rz = np.array([
            [np.cos(rz), -np.sin(rz), 0],
            [np.sin(rz), np.cos(rz), 0],
            [0, 0, 1]
        ])
        
        # 组合旋转矩阵 (按Z-Y-X顺序)
        R = Rz @ Ry @ Rx
        return R

    def calculate(self):
        try:
            # 获取输入值
            position = [float(entry.get()) for entry in self.pos_entries]
            rotation = [float(entry.get()) for entry in self.rot_entries]
            scale = [float(entry.get()) for entry in self.scale_entries]
            
            # 创建变换矩阵
            S = np.diag(scale + [1])
            R = self.create_rotation_matrix(*rotation)
            R4x4 = np.eye(4)
            R4x4[:3, :3] = R
            T = np.eye(4)
            T[:3, 3] = position
            
            # 组合变换矩阵
            M = T @ R4x4 @ S
            
            # 修改输出格式
            formatted_output = "            new Float32Array(\n                [\n"
            for i, row in enumerate(M):
                formatted_output += "                " + ", ".join(f"{x:>7.6f}" for x in row)
                if i < 3:
                    formatted_output += ","
                formatted_output += "\n"
            formatted_output += "                ]\n            );"
            
            # 显示结果
            self.result_text.delete(1.0, tk.END)
            self.result_text.insert(tk.END, formatted_output)
            
        except ValueError:
            messagebox.showerror("错误", "请确保所有输入都是有效的数字")

    def parse_matrix(self):
        try:
            # 获取输入文本
            text = self.matrix_input.get(1.0, tk.END).strip()
            
            # 清理文本，提取数字
            text = text.replace('[', '').replace(']', '').replace('\n', '').replace(' ', '')
            numbers = [float(x) for x in text.split(',') if x.strip()]
            
            if len(numbers) != 16:
                raise ValueError("矩阵必须包含16个数字")
            
            # 转换为4x4矩阵
            matrix = np.array(numbers).reshape(4, 4)
            
            # 提取位置
            position = matrix[:3, 3]
            
            # 提取3x3旋转矩阵
            rotation_matrix = matrix[:3, :3]
            
            # 提取缩放（通过计算每列的长度）
            scale = np.array([
                np.linalg.norm(rotation_matrix[:, 0]),
                np.linalg.norm(rotation_matrix[:, 1]),
                np.linalg.norm(rotation_matrix[:, 2])
            ])
            
            # 归一化旋转矩阵（移除缩放）
            rotation_matrix = rotation_matrix / scale
            
            # 转换为欧拉角（度数）
            euler_angles = self.rotation_matrix_to_euler_angles(rotation_matrix)
            euler_degrees = np.degrees(euler_angles)
            
            # 更新解析结果显示
            self.pos_result.config(
                text=f"X: {position[0]:.2f}  Y: {position[1]:.2f}  Z: {position[2]:.2f}")
            self.rot_result.config(
                text=f"X: {euler_degrees[0]:.2f}  Y: {euler_degrees[1]:.2f}  Z: {euler_degrees[2]:.2f}")
            self.scale_result.config(
                text=f"X: {scale[0]:.2f}  Y: {scale[1]:.2f}  Z: {scale[2]:.2f}")
            
            # 更新输入框
            for i, entry in enumerate(self.pos_entries):
                entry.delete(0, tk.END)
                entry.insert(0, f"{position[i]:.2f}")
                
            for i, entry in enumerate(self.rot_entries):
                entry.delete(0, tk.END)
                entry.insert(0, f"{euler_degrees[i]:.2f}")
                
            for i, entry in enumerate(self.scale_entries):
                entry.delete(0, tk.END)
                entry.insert(0, f"{scale[i]:.2f}")
            
            # 触发重新计算
            self.calculate()
            
        except Exception as e:
            messagebox.showerror("错误", f"解析矩阵失败: {str(e)}")

    def rotation_matrix_to_euler_angles(self, R):
        """
        从旋转矩阵提取欧拉角 (ZYX顺序)
        """
        sy = np.sqrt(R[0,0] * R[0,0] + R[1,0] * R[1,0])
        singular = sy < 1e-6

        if not singular:
            x = np.arctan2(R[2,1], R[2,2])
            y = np.arctan2(-R[2,0], sy)
            z = np.arctan2(R[1,0], R[0,0])
        else:
            x = np.arctan2(-R[1,2], R[1,1])
            y = np.arctan2(-R[2,0], sy)
            z = 0

        return np.array([x, y, z])

def main():
    root = tk.Tk()
    app = MatrixCalculator(root)
    root.mainloop()

if __name__ == "__main__":
    main()
