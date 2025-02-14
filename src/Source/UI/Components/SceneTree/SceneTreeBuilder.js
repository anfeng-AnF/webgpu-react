import React from 'react';
import './SceneTreeBuilder.css';
import TreeItem from './TreeItem';

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
        this.selectedItem = null;
        this.expandedNodes = new Set(); // 存储展开节点的路径
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

        // 添加当前节点
        result.push({
            ...node,
            level,
            path: currentPath,
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

    // 构建整个树
    build() {
        if (!this.treeData) return null;

        // 获取扁平化的节点数组
        const flatNodes = this.flattenTree(this.treeData);

        return (
            <div className="scene-tree">
                {flatNodes.map((node, index) => (
                    <TreeItem
                        key={index}
                        label={node.name}
                        type={node.type}
                        level={node.level}
                        expanded={node.expanded}
                        hasChildren={node.children?.length > 0}
                        selected={this.selectedItem === node.path}
                        onSelect={() => this.handleSelect(node.path)}
                        onExpand={(expanded) => this.handleExpand(node.path, expanded)}
                        num={index + 1}  // 添加序号，从1开始
                    />
                ))}
            </div>
        );
    }

    // 处理选择事件
    handleSelect(path) {
        this.selectedItem = path;
        // 这里可以添加选择回调
    }

    static resetInstance() {
        SceneTreeBuilder.instance = null;
    }
}

export default SceneTreeBuilder; 