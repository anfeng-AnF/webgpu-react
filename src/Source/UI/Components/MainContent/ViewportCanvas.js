import React, { useEffect, useRef } from 'react';
import './ViewportCanvas.css';

const ViewportCanvas = ({ 
    width = '100%', 
    height = '100%',
    backgroundColor = '#141414',
    onCanvasReady,
    onResize,
    canvasId,
    ...props 
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const resizeObserverRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;

        if (!canvas || !container) return;

        // 设置画布尺寸
        const updateCanvasSize = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // 设置显示尺寸
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            
            // 设置渲染尺寸
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            // 通知尺寸变化
            onResize?.(canvas.width, canvas.height);
        };

        // 创建 ResizeObserver
        resizeObserverRef.current = new ResizeObserver(updateCanvasSize);
        resizeObserverRef.current.observe(container);

        // 初始化画布
        updateCanvasSize();
        onCanvasReady?.(canvas);

        // 清理函数
        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
        };
    }, [onCanvasReady, onResize]);

    return (
        <div 
            ref={containerRef}
            className="viewport-canvas-container"
            style={{ width, height, backgroundColor }}
        >
            <canvas
                ref={canvasRef}
                className="viewport-canvas"
                id={canvasId}
                {...props}
            />
        </div>
    );
};

export default ViewportCanvas; 