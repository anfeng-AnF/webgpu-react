import React, { useRef, useEffect } from 'react';
import './TreeHeader.css';

const TreeHeader = ({ typeColumnWidth, onTypeColumnWidthChange }) => {
    const resizingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const headerRef = useRef(null);

    // 计算最小和最大宽度
    const getWidthLimits = () => {
        if (!headerRef.current) return { min: 100, max: 400 };
        const containerWidth = headerRef.current.offsetWidth;
        return {
            min: containerWidth * 0.1,
            max: containerWidth * 0.8
        };
    };

    const handleResizeStart = (e) => {
        resizingRef.current = true;
        startXRef.current = e.clientX;
        startWidthRef.current = typeColumnWidth;
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        // 添加拖动时的样式
        headerRef.current?.classList.add('resizing');
    };

    const handleResizeMove = (e) => {
        if (!resizingRef.current) return;
        
        const delta = startXRef.current - e.clientX;
        const { min, max } = getWidthLimits();
        const newWidth = Math.max(min, Math.min(max, startWidthRef.current + delta));
        // 直接传递新的宽度值
        onTypeColumnWidthChange(newWidth);
    };

    const handleResizeEnd = () => {
        resizingRef.current = false;
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        // 移除拖动时的样式
        headerRef.current?.classList.remove('resizing');
    };

    // 监听容器大小变化
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            const { min, max } = getWidthLimits();
            const newWidth = Math.max(min, Math.min(max, typeColumnWidth));
            if (newWidth !== typeColumnWidth) {
                onTypeColumnWidthChange(newWidth);
            }
        });

        if (headerRef.current) {
            resizeObserver.observe(headerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [typeColumnWidth, onTypeColumnWidthChange]);

    return (
        <div 
            ref={headerRef}
            className="tree-header" 
            style={{ gridTemplateColumns: `24px 1fr ${typeColumnWidth}px` }}
        >
            {/* 左侧容器 - 可见性图标区域 */}
            <div className="visibility-container">
                <span className="visibility-icon visible"></span>
            </div>

            {/* 中间容器 - 名称区域 */}
            <div className="label-container">
                <span className="header-label">名称</span>
            </div>

            {/* 分界线 */}
            <div 
                className="resize-handle"
                onMouseDown={handleResizeStart}
            />

            {/* 右侧容器 - 类型区域 */}
            <div className="type-container">
                <span className="header-type">&nbsp;&nbsp;&nbsp;类型</span>
            </div>
        </div>
    );
};

export default TreeHeader; 