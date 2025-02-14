import React from 'react';
import './SceneTreeBuilder.css';
import TreeItem from './TreeItem';
import TreeHeader from './TreeHeader';

/**
 * SceneTreeBuilder - 场景树构建器
 * 用于构建和管理场景树的单例类
 * 
 * 使用示例：
 * ```javascript
 * const sceneTreeBuilder = SceneTreeBuilder.getInstance();
 * 
 * // 1. 设置树数据
 * sceneTreeBuilder.setTreeData({
 *     name: 'Root',
 *     type: '编辑器',
 *     expanded: true,
 *     children: [
 *         {
 *             name: 'Folder1',
 *             type: '文件夹',
 *             children: []
 *         }
 *     ]
 * });
 * 
 * // 2. 监听结构变化
 * sceneTreeBuilder.setStructureChangeCallback((changeInfo) => {
 *     console.log('Tree structure changed:', {
 *         type: changeInfo.type,          // 变更类型（'move'）
 *         node: changeInfo.node.name,     // 被移动的节点名称
 *         fromPath: changeInfo.fromPath,  // 原始路径
 *         toPath: changeInfo.toPath,      // 目标路径
 *         position: changeInfo.position,  // 放置位置（'before'|'after'|'inside'）
 *         oldParent: changeInfo.oldParent.name,  // 原父节点名称
 *         newParent: changeInfo.newParent.name   // 新父节点名称
 *     });
 * });
 * 
 * // 3. 监听选中项变化
 * sceneTreeBuilder.setSelectionChangeCallback((selectedPaths) => {
 *     console.log('Selection changed:', {
 *         count: selectedPaths.length,
 *         items: selectedPaths.map(path => {
 *             const node = sceneTreeBuilder.findNodeByPath(path);
 *             return {
 *                 name: node.name,
 *                 type: node.type,
 *                 path: path
 *             };
 *         })
 *     });
 * });
 * 
 * // 4. 监听可见性变化
 * sceneTreeBuilder.setVisibilityChangeCallback((path, visible) => {
 *     const node = sceneTreeBuilder.findNodeByPath(path);
 *     console.log('Visibility changed:', {
 *         name: node.name,
 *         type: node.type,
 *         path: path,
 *         visible: visible
 *     });
 * });
 * 
 * // 5. 监听列宽度变化
 * sceneTreeBuilder.setColumnWidthChangeCallback((width) => {
 *     console.log('Column width changed:', width);
 * });
 * ```
 * 
 * 功能特性：
 * 1. 树节点拖拽排序
 * 2. 多选（Ctrl/Cmd + 点击）
 * 3. 范围选择（Shift + 点击）
 * 4. 节点展开/折叠
 * 5. 节点可见性控制
 * 6. 类型列宽度调整
 * 
 * 数据结构：
 * ```javascript
 * {
 *     name: string,       // 节点名称
 *     type: string,       // 节点类型
 *     expanded?: boolean, // 是否展开
 *     children?: array    // 子节点数组
 * }
 * ```
 */
class SceneTreeBuilder {
    static instance = null;

    static getInstance() {
        if (!SceneTreeBuilder.instance) {
            SceneTreeBuilder.instance = new SceneTreeBuilder();
        }
        return SceneTreeBuilder.instance;
    }

    constructor() {
        if (SceneTreeBuilder.instance) {
            throw new Error('SceneTreeBuilder is a singleton. Use SceneTreeBuilder.getInstance() instead.');
        }
        
        this.treeData = null;
        this.selectedItems = new Set();  // 使用 Set 存储选中的项
        this.lastSelectedIndex = -1;     // 记录最后一次选中的索引，用于范围选择
        this.expandedNodes = new Set(); // 存储展开节点的路径
        this.draggedNode = null;
        this.dropTarget = null;
        this.dropPosition = 'inside'; // 'before', 'after', 'inside'
        this.typeColumnWidth = 180; // 添加类型列宽度状态
        this.onStructureChange = null;
        this.onColumnWidthChange = null;  // 添加新的回调
        this.onVisibilityChange = null;  // 添加可见性变化回调
    }

    // 设置树数据
    setTreeData(data) {
        this.treeData = data;
        // 初始化展开状态
        this.expandedNodes.clear();
        if (data) {
            this.initializeExpandedState(data);
        }
    }

    // 初始化展开状态
    initializeExpandedState(node, parentPath = '') {
        const currentPath = parentPath ? `${parentPath}.${node.name}` : node.name;
        if (node.expanded) {
            this.expandedNodes.add(currentPath);
        }
        
        if (node.children) {
            node.children.forEach(child => {
                this.initializeExpandedState(child, currentPath);
            });
        }
    }

    // 处理节点展开/收起
    handleExpand(path, expanded) {
        if (expanded) {
            this.expandedNodes.add(path);
        } else {
            this.expandedNodes.delete(path);
        }
        
        // 如果有更新回调，通知更新
        if (this.onExpandChange) {
            this.onExpandChange(path, expanded);
        }
    }

    // 设置展开状态变化的回调
    setExpandChangeCallback(callback) {
        this.onExpandChange = callback;
    }

    // 将树结构转换为扁平数组
    flattenTree(node, level = 0, parentPath = '', result = []) {
        if (!node) return result;

        const currentPath = parentPath ? `${parentPath}.${node.name}` : node.name;
        const isExpanded = this.expandedNodes.has(currentPath);

        // 添加当前节点，确保包含完整路径
        result.push({
            ...node,
            level,
            path: currentPath,  // 确保设置 path
            expanded: isExpanded
        });

        // 只有当节点展开时才递归处理子节点
        if (node.children && isExpanded) {
            node.children.forEach(child => {
                this.flattenTree(child, level + 1, currentPath, result);
            });
        }

        return result;
    }

    // 处理单选
    handleSelect(path, index) {
        this.selectedItems.clear();
        this.selectedItems.add(path);
        this.lastSelectedIndex = index;
        // 如果有更新回调，通知更新
        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedItems));
        }
    }

    // 处理范围选择
    handleRangeSelect(currentIndex) {
        if (this.lastSelectedIndex === -1) return;

        const flatNodes = this.flattenTree(this.treeData);
        const start = Math.min(this.lastSelectedIndex, currentIndex);
        const end = Math.max(this.lastSelectedIndex, currentIndex);

        // 选择范围内的所有项
        for (let i = start; i <= end; i++) {
            this.selectedItems.add(flatNodes[i].path);
        }

        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedItems));
        }
    }

    // 处理多选
    handleMultiSelect(path, index, selected) {
        if (selected) {
            this.selectedItems.add(path);
        } else {
            this.selectedItems.delete(path);
        }
        this.lastSelectedIndex = index;

        if (this.onSelectionChange) {
            this.onSelectionChange(Array.from(this.selectedItems));
        }
    }

    // 设置选择变化的回调
    setSelectionChangeCallback(callback) {
        this.onSelectionChange = callback;
    }

    // 处理拖拽开始
    handleDragStart(path) {
        if (!path) return;
        this.draggedNode = this.findNodeByPath(path);
        this.draggedPath = path;
    }

    // 处理拖拽经过
    handleDragOver(targetPath, targetIndex, clientY) {
        if (!targetPath) return;
        const targetNode = this.findNodeByPath(targetPath);
        
        if (!targetNode || !this.draggedNode) return;

        // 防止拖拽到自己
        if (targetPath === this.draggedPath) return;

        // 防止拖拽到自己的子节点
        if (this.isDescendant(this.draggedNode, targetNode)) return;

        // 防止拖拽到自己的父节点
        if (targetPath === this.draggedPath.substring(0, this.draggedPath.lastIndexOf('.'))) return;

        const rect = document.elementFromPoint(0, clientY).getBoundingClientRect();
        const relativeY = clientY - rect.top;
        
        // 调整放置位置判断逻辑
        if (targetNode.type === '文件夹') {
            if (relativeY < rect.height * 0.15) {
                this.dropPosition = 'before';
            } else if (relativeY > rect.height * 0.85) {
                this.dropPosition = 'after';
            } else {
                this.dropPosition = 'inside';
            }
        } else {
            if (relativeY < rect.height * 0.25) {
                this.dropPosition = 'before';
            } else if (relativeY > rect.height * 0.75) {
                this.dropPosition = 'after';
            } else {
                this.dropPosition = 'inside';
            }
        }

        this.dropTarget = targetNode;
    }

    // 添加检查是否是父节点的方法
    isParent(possibleParent, child) {
        if (!possibleParent || !child) return false;
        
        const childParent = this.findParentNode(child);
        return childParent === possibleParent;
    }

    // 处理放置
    handleDrop(draggedPath, targetPath) {
        if (!draggedPath || !targetPath) return;

        const draggedNode = this.findNodeByPath(draggedPath);
        const targetNode = this.findNodeByPath(targetPath);
        
        if (!draggedNode || !targetNode) return;

        this.draggedNode = draggedNode;
        this.dropTarget = targetNode;

        // 防止无效的拖放
        if (draggedPath === targetPath) return;
        if (this.isDescendant(draggedNode, targetNode)) return;
        if (targetPath === draggedPath.substring(0, draggedPath.lastIndexOf('.'))) return;

        // 如果目标不是文件夹，强制设置为 before
        if (this.dropPosition === 'inside' && targetNode.type !== '文件夹') {
            this.dropPosition = 'before';
        }

        // 获取拖拽节点的原父节点
        const draggedParent = this.findParentNode(draggedNode);
        if (!draggedParent) return;

        // 创建节点的深拷贝，防止引用问题
        const draggedNodeCopy = JSON.parse(JSON.stringify(draggedNode));

        // 从原位置移除节点
        draggedParent.children = draggedParent.children.filter(
            child => child !== draggedNode
        );

        // 准备变更信息
        const changeInfo = {
            type: 'move',
            node: draggedNodeCopy,
            fromPath: draggedPath,
            toPath: targetPath,
            position: this.dropPosition,
            oldParent: draggedParent,
            newParent: this.dropPosition === 'inside' ? targetNode : this.findParentNode(targetNode)
        };

        // 根据放置位置插入节点
        let success = false;
        switch (this.dropPosition) {
            case 'before':
                this.insertNodeBefore(draggedNodeCopy, targetNode);
                success = true;
                break;
            case 'after':
                this.insertNodeAfter(draggedNodeCopy, targetNode);
                success = true;
                break;
            case 'inside':
                if (!targetNode.children) {
                    targetNode.children = [];
                }
                targetNode.children.push(draggedNodeCopy);
                // 自动展开目标节点
                const targetNodePath = this.getNodePath(targetNode);
                if (targetNodePath) {
                    this.expandedNodes.add(targetNodePath);
                }
                success = true;
                break;
            default:
                break;
        }

        // 清理拖拽状态
        this.draggedNode = null;
        this.dropTarget = null;
        this.dropPosition = 'inside';

        // 如果操作成功且有回调，则通知更新并传递变更信息
        if (success && this.onStructureChange) {
            this.onStructureChange(changeInfo);
        }
    }

    // 辅助方法：查找节点
    findNodeByPath(path) {
        if (!path || !this.treeData) return null;
        
        // 如果是根节点
        if (path === this.treeData.name) {
            return this.treeData;
        }

        const pathParts = path.split('.');
        let currentNode = this.treeData;
        let pathIndex = 0;

        // 如果第一个部分是根节点名称，从下一个开始
        if (pathParts[0] === this.treeData.name) {
            pathIndex = 1;
        }

        // 遍历路径部分
        while (pathIndex < pathParts.length && currentNode) {
            const targetName = pathParts[pathIndex];
            
            // 如果当前节点没有子节点，返回null
            if (!currentNode.children) {
                return null;
            }

            // 在子节点中查找目标名称
            currentNode = currentNode.children.find(child => child.name === targetName);
            pathIndex++;
        }

        return currentNode;
    }

    // 辅助方法：查找父节点
    findParentNode(targetNode, currentNode = this.treeData) {
        if (!currentNode || !targetNode) return null;
        
        // 检查是否是根节点的直接子节点
        if (currentNode.children) {
            if (currentNode.children.includes(targetNode)) {
                return currentNode;
            }
            
            for (const child of currentNode.children) {
                const result = this.findParentNode(targetNode, child);
                if (result) return result;
            }
        }
        return null;
    }

    // 辅助方法：判断是否是子孙节点
    isDescendant(parent, child) {
        if (!parent || !child) return false;
        
        // 获取两个节点的完整路径
        const parentPath = this.getNodePath(parent);
        const childPath = this.getNodePath(child);
        
        if (!parentPath || !childPath) return false;
        
        // 检查 childPath 是否以 parentPath 开头，且后面跟着点号
        return childPath !== parentPath && childPath.startsWith(parentPath + '.');
    }

    // 辅助方法：在目标节点前插入
    insertNodeBefore(node, target) {
        if (target === this.treeData) {
            if (!this.treeData.children) {
                this.treeData.children = [];
            }
            this.treeData.children.unshift(node);
            return;
        }

        const parent = this.findParentNode(target);
        if (!parent || !parent.children) return;
        
        const index = parent.children.indexOf(target);
        if (index === -1) return;
        
        parent.children.splice(index, 0, node);
    }

    // 辅助方法：在目标节点后插入
    insertNodeAfter(node, target) {
        if (target === this.treeData) {
            if (!this.treeData.children) {
                this.treeData.children = [];
            }
            this.treeData.children.push(node);
            return;
        }

        const parent = this.findParentNode(target);
        if (!parent || !parent.children) return;
        
        const index = parent.children.indexOf(target);
        if (index === -1) return;
        
        parent.children.splice(index + 1, 0, node);
    }

    // 添加获取节点路径的辅助方法
    getNodePath(node, currentNode = this.treeData, currentPath = '') {
        if (currentNode === node) {
            return currentPath || currentNode.name;
        }

        if (currentNode.children) {
            for (const child of currentNode.children) {
                const childPath = currentPath ? `${currentPath}.${child.name}` : child.name;
                const result = this.getNodePath(node, child, childPath);
                if (result) return result;
            }
        }

        return null;
    }

    /**
     * 设置结构变化的回调函数
     * @param {Function} callback 回调函数，接收变更信息对象作为参数
     * @param {Object} changeInfo 变更信息对象
     * @param {string} changeInfo.type - 变更类型（'move'）
     * @param {Object} changeInfo.node - 被移动的节点对象
     * @param {string} changeInfo.fromPath - 原始路径
     * @param {string} changeInfo.toPath - 目标路径
     * @param {string} changeInfo.position - 放置位置（'before'|'after'|'inside'）
     * @param {Object} changeInfo.oldParent - 原父节点对象
     * @param {Object} changeInfo.newParent - 新父节点对象
     */
    setStructureChangeCallback(callback) {
        this.onStructureChange = callback;
    }

    // 修改更新类型列宽度的方法
    setTypeColumnWidth(width) {
        this.typeColumnWidth = width;
        // 使用专门的列宽度变化回调
        if (this.onColumnWidthChange) {
            this.onColumnWidthChange(width);
        }
    }

    // 添加列宽度变化的回调设置方法
    setColumnWidthChangeCallback(callback) {
        this.onColumnWidthChange = callback;
    }

    // 处理可见性变化
    handleVisibilityChange(path, visible) {
        if (this.onVisibilityChange) {
            this.onVisibilityChange(path, visible);
        }
    }

    // 添加可见性变化的回调设置方法
    setVisibilityChangeCallback(callback) {
        this.onVisibilityChange = callback;
    }

    // 构建整个树
    build() {
        if (!this.treeData) return null;

        const flatNodes = this.flattenTree(this.treeData);

        return (
            <div className="scene-tree">
                <TreeHeader 
                    typeColumnWidth={this.typeColumnWidth}
                    onTypeColumnWidthChange={this.setTypeColumnWidth.bind(this)}
                />
                {flatNodes.map((node, index) => (
                    <TreeItem
                        key={index}
                        label={node.name}
                        type={node.type}
                        level={node.level}
                        expanded={node.expanded}
                        hasChildren={node.children?.length > 0}
                        selected={this.selectedItems.has(node.path)}
                        onSelect={() => this.handleSelect(node.path, index)}
                        onMultiSelect={(selected) => this.handleMultiSelect(node.path, index, selected)}
                        onRangeSelect={() => this.handleRangeSelect(index)}
                        onExpand={(expanded) => this.handleExpand(node.path, expanded)}
                        onVisibilityChange={(visible) => this.handleVisibilityChange(node.path, visible)}
                        num={index + 1}
                        index={index}
                        path={node.path}
                        onDragStart={this.handleDragStart.bind(this)}
                        onDragOver={this.handleDragOver.bind(this)}
                        onDrop={this.handleDrop.bind(this)}
                        typeWidth={this.typeColumnWidth} // 传递类型列宽度
                    />
                ))}
            </div>
        );
    }

    static resetInstance() {
        SceneTreeBuilder.instance = null;
    }
}

export default SceneTreeBuilder; 