import React, { useState } from 'react';
import './TreeBuilder.css';

class TreeBuilder {
    static instance = null;

    static getInstance(onChange) {
        if (!TreeBuilder.instance) {
            TreeBuilder.instance = new TreeBuilder(onChange);
        }
        if (onChange) {
            TreeBuilder.instance.onChange = onChange;
        }
        return TreeBuilder.instance;
    }

    constructor(onChange) {
        if (TreeBuilder.instance) {
            throw new Error('TreeBuilder is a singleton. Use TreeBuilder.getInstance() instead.');
        }
        this.onChange = onChange;
        this.selectedItem = null;
    }

    // 渲染单个树节点
    renderTreeItem = (item, path = '', level = 0) => {
        const TreeItem = ({ item, path, level }) => {
            const [isExpanded, setIsExpanded] = useState(true);
            const hasChildren = item.children && item.children.length > 0;
            const isSelected = path === this.selectedItem;

            const handleClick = (e) => {
                e.stopPropagation();
                this.selectedItem = path;
                if (this.onChange) {
                    this.onChange('tree.select', { path, item });
                }
            };

            const handleExpandClick = (e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
            };

            const getItemIcon = () => {
                if (item.type === '文件夹') {
                    return '📁';
                } else if (item.type === '世界场景') {
                    return '🌍';
                } else if (item.type.includes('Actor')) {
                    return '🎮';
                } else if (item.type === 'Landscape') {
                    return '🏔️';
                } else {
                    return '📄';
                }
            };

            return (
                <div>
                    <div 
                        className={`tree-item ${isSelected ? 'selected' : ''}`}
                        onClick={handleClick}
                    >
                        {/* 缩进 */}
                        {Array(level).fill().map((_, i) => (
                            <div key={i} className="indent"></div>
                        ))}
                        
                        {/* 展开/折叠图标 */}
                        <div 
                            className="expand-icon"
                            onClick={handleExpandClick}
                            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                        >
                            {isExpanded ? '▼' : '▶'}
                        </div>

                        {/* 项目图标 */}
                        <div className="item-icon">
                            {getItemIcon()}
                        </div>

                        {/* 项目标签 */}
                        <div className="item-label">{item.label}</div>

                        {/* 项目类型 */}
                        <div className="item-type">{item.type}</div>
                    </div>

                    {/* 子项目 */}
                    {hasChildren && isExpanded && (
                        <div className="tree-children">
                            {item.children.map((child, index) => {
                                const childPath = `${path}/${index}`;
                                return this.renderTreeItem(child, childPath, level + 1);
                            })}
                        </div>
                    )}
                </div>
            );
        };

        return <TreeItem key={path} item={item} path={path} level={level} />;
    };

    // 构建整个树
    build(data) {
        return (
            <div className="tree-container">
                {this.renderTreeItem(data)}
            </div>
        );
    }

    // 清除选中项
    clearSelection() {
        this.selectedItem = null;
        if (this.onChange) {
            this.onChange('tree.clearSelection');
        }
    }
}

export default TreeBuilder; 