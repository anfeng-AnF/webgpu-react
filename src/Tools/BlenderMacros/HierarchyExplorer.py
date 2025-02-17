# run this script in blender

import json
import bpy
import os

# 递归函数：导出集合层级结构、对象和灯光
def export_collection_structure(collection):
    collection_data = {}
    
    # 遍历集合中的所有对象
    for obj in collection.objects:
        if obj.type == 'MESH':  # 只导出网格对象
            collection_data[obj.name] = {"type": "MESH"}
        elif obj.type == 'LIGHT':  # 只导出灯光对象
            collection_data[obj.name] = {"type": "LIGHT"}
    
    # 遍历子集合（子文件夹）
    for sub_collection in collection.children:
        collection_data[sub_collection.name] = export_collection_structure(sub_collection)
    
    return collection_data

# 导出层级结构到 JSON 文件
def save_to_json(file_path):
    # 导出根集合层级结构
    collection_data = export_collection_structure(bpy.context.scene.collection)
    
    with open(file_path, 'w', encoding='utf-8') as json_file:
        # ensure_ascii=False 使得非 ASCII 字符能够原样写入
        json.dump(collection_data, json_file, indent=4, ensure_ascii=False)
    print(f"导出成功：{file_path}")

# 获取当前 .blend 文件的路径
blend_file_path = bpy.data.filepath
if blend_file_path:
    # 获取目录路径并生成文件名
    directory = os.path.dirname(blend_file_path)
    file_path = os.path.join(directory, "scene_structure.json")
else:
    # 如果没有保存过 .blend 文件，默认保存在当前工作目录
    file_path = "scene_structure.json"

# 保存到当前 .blend 文件所在的目录
save_to_json(file_path)
