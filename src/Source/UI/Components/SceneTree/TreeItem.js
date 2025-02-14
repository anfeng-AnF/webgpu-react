import React, { useState, useEffect } from 'react';
import './TreeItem.css';

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
    typeWidth = 180,     // 类型列宽度
    num = 0,          // 添加序号属性
    onVisibilityChange,  // 可视性变更回调
    initialVisibility = true  // 初始可视性状态
}) => {
    const [bIsShow, setBIsShow] = useState(initialVisibility);
    const [isSelected, setIsSelected] = useState(selected);

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
        onSelect?.();
    };

    const handleVisibilityClick = (e) => {
        e.stopPropagation();
        const newVisibility = !bIsShow;
        setBIsShow(newVisibility);
        onVisibilityChange?.(newVisibility);
    };

    return (
        <div 
            className={`tree-item-header ${isSelected ? 'selected' : ''} ${num % 2 === 1 ? 'odd-row' : ''}`}
            onClick={handleItemClick}
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
                <span className={`type-icon ${type?.toLowerCase()}`} />
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