import React, { useState, useEffect } from 'react';
import './TreeItem.css';

// 添加图标类型枚举
// 添加时，需要同时修改TreeItem.css中的图标类型
const ICON_TYPES = {
    FOLDER: 'filter',
    EDITOR: 'editor',
    STATIC_MESH: 'staticMesh',
    SCENE: 'scene',
    POINT_LIGHT: 'pointLight',
    DIRECTIONAL_LIGHT: 'directionalLight',
};

const TreeItem = ({ 
    label, 
    type,
    level = 0,
    expanded = false,
    hasChildren = false,
    selected = false,      // 是否被选中
    onSelect,             // 选中回调
    onExpand,            // 展开回调
    indent = 12,        // 每级缩进宽度
    typeWidth,     // 使用传入的类型列宽度
    num = 0,          // 添加序号属性
    onVisibilityChange,  // 可视性变更回调
    initialVisibility = true,  // 初始可视性状态
    index,              // 添加索引属性用于范围选择
    onRangeSelect,      // 范围选择回调
    onMultiSelect,      // 多选回调
    onDragStart,        // 添加拖拽相关回调
    onDragOver,
    onDrop,
    path,               // 添加路径属性用于拖拽判断
}) => {
    const [bIsShow, setBIsShow] = useState(initialVisibility);
    const [isSelected, setIsSelected] = useState(selected);
    const [isDragging, setIsDragging] = useState(false);

    // 处理选中状态变化
    useEffect(() => {
        setIsSelected(selected);
    }, [selected]);

    const handleExpandClick = (e) => {
        e.stopPropagation();
        onExpand?.(!expanded);
    };

    const handleItemClick = (e) => {
        e.stopPropagation();
        
        if (e.shiftKey) {
            // Shift + 点击：范围选择
            onRangeSelect?.(index);
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + 点击：切换选中状态
            onMultiSelect?.(index, !isSelected);
        } else {
            // 普通点击：单选
            onSelect?.();
        }
    };

    const handleVisibilityClick = (e) => {
        e.stopPropagation();
        const newVisibility = !bIsShow;
        setBIsShow(newVisibility);
        onVisibilityChange?.(newVisibility);
    };

    const handleDragStart = (e) => {
        if (!path) {
            console.warn('No path available for drag start');
            return;
        }
        e.stopPropagation();
        setIsDragging(true);
        onDragStart?.(path);
        e.dataTransfer.setData('text/plain', path);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        if (!path) {
            console.warn('No path available for drag over');
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        onDragOver?.(path, index, e.clientY);
    };

    const handleDrop = (e) => {
        if (!path) {
            console.warn('No path available for drop');
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const draggedPath = e.dataTransfer.getData('text/plain');
        if (!draggedPath) {
            console.warn('No dragged path available');
            return;
        }
        onDrop?.(draggedPath, path);
        setIsDragging(false);
    };

    const handleDragEnd = () => {
        console.log('TreeItem drag end');
        setIsDragging(false);
    };

    // 修改检查逻辑
    const getIconClass = (type) => {
        if (!type) return 'default';
        
        // 将输入类型转换为小写以进行匹配
        const normalizedType = type.toLowerCase();
        
        // 检查是否存在于ICON_TYPES中的值
        const matchedType = Object.values(ICON_TYPES).find(value => 
            value.toLowerCase() === normalizedType
        );
        return matchedType || 'default';
    };

    return (
        <div 
            className={`tree-item-header ${isSelected ? 'selected' : ''} 
                       ${num % 2 === 1 ? 'odd-row' : ''} 
                       ${isDragging ? 'dragging' : ''}`}
            onClick={handleItemClick}
            draggable={true}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            style={{ gridTemplateColumns: `24px 1fr ${typeWidth}px` }}
        >
            {/* 左侧眼睛图标容器 */}
            <div className="visibility-container">
                <span 
                    className={`visibility-icon ${bIsShow ? 'visible' : ''}`}
                    onClick={handleVisibilityClick}
                />
            </div>

            {/* 中间标签容器 */}
            <div className="label-container" style={{ paddingLeft: `${level * indent}px` }}>
                <span 
                    className={`expand-icon ${expanded ? 'expanded' : ''}`}
                    onClick={handleExpandClick}
                    style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                >
                    ▶
                </span>
                <span className={`type-icon ${getIconClass(type)}`} />
                <span className="item-label">{label}</span>
            </div>

            {/* 右侧类型容器 */}
            <div className="type-container">
                <span className="item-type">{type}</span>
            </div>
        </div>
    );
};

export default TreeItem; 