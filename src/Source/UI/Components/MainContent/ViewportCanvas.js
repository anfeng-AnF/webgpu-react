import React, { useEffect, useRef, useCallback } from 'react';
import './ViewportCanvas.css';

const ViewportCanvas = ({ 
    width = '100%', 
    height = '100%',
    backgroundColor = '#141414',
    onCanvasReady,
    onResize,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onMouseEnter,
    onMouseLeave,
    onWheel,
    onContextMenu,
    onKeyDown,
    onKeyUp,
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    canvasId = 'ViewportCanvas',
    tabIndex = 0,  // 使 Canvas 可以接收键盘事件
    ...props 
}) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const uniqueId = useRef(canvasId + '_' + Math.random().toString(36).substr(2, 9));
    const [fps, setFps] = React.useState(0);
    const lastTimeRef = useRef(performance.now());
    const frameCountRef = useRef(0);
    const intervalRef = useRef(null);

    // 鼠标事件处理
    const handleMouseEvent = useCallback((event, handler) => {
        if (!handler) return;
        
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 计算设备像素比下的坐标
        const dpr = window.devicePixelRatio || 1;
        const deviceX = x * dpr;
        const deviceY = y * dpr;

        handler({
            ...event,
            canvasX: x,
            canvasY: y,
            deviceX,
            deviceY,
            buttons: event.buttons,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation()
        });
    }, []);

    // 滚轮事件处理
    const handleWheel = useCallback((event) => {
        if (!onWheel) return;
        
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dpr = window.devicePixelRatio || 1;

        onWheel({
            ...event,
            canvasX: x,
            canvasY: y,
            deviceX: x * dpr,
            deviceY: y * dpr,
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaMode: event.deltaMode,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation()
        });
    }, [onWheel]);

    // 键盘事件处理
    const handleKeyEvent = useCallback((event, handler) => {
        if (!handler) return;
        
        handler({
            ...event,
            key: event.key,
            code: event.code,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation()
        });
    }, []);

    // 添加触摸事件处理
    const handleTouchMove = useCallback((event) => {
        if (!onTouchMove) return;
        
        const rect = event.currentTarget.getBoundingClientRect();
        const touch = event.touches[0]; // 获取第一个触摸点
        
        if (!touch) return;

        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // 计算设备像素比下的坐标
        const dpr = window.devicePixelRatio || 1;
        const deviceX = x * dpr;
        const deviceY = y * dpr;

        onTouchMove({
            ...event,
            canvasX: x,
            canvasY: y,
            deviceX,
            deviceY,
            touches: event.touches,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation()
        });
    }, [onTouchMove]);

    // 添加触摸开始事件处理
    const handleTouchStart = useCallback((event) => {
        if (!onTouchStart) return;
        
        const rect = event.currentTarget.getBoundingClientRect();
        const touch = event.touches[0];
        
        if (!touch) return;

        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const dpr = window.devicePixelRatio || 1;
        
        onTouchStart({
            ...event,
            canvasX: x,
            canvasY: y,
            deviceX: x * dpr,
            deviceY: y * dpr,
            touches: event.touches,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation()
        });
    }, [onTouchStart]);

    // 添加触摸结束事件处理
    const handleTouchEnd = useCallback((event) => {
        if (!onTouchEnd) return;
        onTouchEnd(event);
    }, [onTouchEnd]);

    // 计算FPS
    useEffect(() => {
        const updateFPS = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTimeRef.current;
            
            if (deltaTime >= 1000) { // 每秒更新一次
                setFps(Math.round((frameCountRef.current * 1000) / deltaTime));
                frameCountRef.current = 0;
                lastTimeRef.current = currentTime;
            }
            frameCountRef.current++;
            requestAnimationFrame(updateFPS);
        };

        intervalRef.current = requestAnimationFrame(updateFPS);

        return () => {
            if (intervalRef.current) {
                cancelAnimationFrame(intervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!canvasRef.current.__initialized) {
            canvasRef.current.__initialized = true;
        }
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
            const newWidth = Math.max(1, Math.floor(rect.width * dpr));
            const newHeight = Math.max(1, Math.floor(rect.height * dpr));
            
            if (canvas.width !== newWidth || canvas.height !== newHeight) {
                canvas.width = newWidth;
                canvas.height = newHeight;
                onResize?.(canvas.width, canvas.height, canvas);
            }
        };

        // 确保容器有初始尺寸
        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            console.warn('Canvas container has zero size');
            return;
        }

        // 先更新一次尺寸
        updateCanvasSize();

        // 等待一帧确保尺寸已更新
        requestAnimationFrame(() => {
            if (canvas.width > 0 && canvas.height > 0) {
                onCanvasReady?.(canvas);
                
                resizeObserverRef.current = new ResizeObserver(() => {
                    requestAnimationFrame(updateCanvasSize);
                });
                resizeObserverRef.current.observe(container);
            } else {
                console.warn('Canvas has zero size after initialization');
            }
        });

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
            style={{ 
                width, 
                height, 
                backgroundColor,
                minWidth: '1px',
                minHeight: '1px',
                position: 'relative'  // 确保定位正确
            }}
        >
            <canvas
                ref={canvasRef}
                className="viewport-canvas"
                id={uniqueId.current}
                tabIndex={tabIndex}
                onMouseDown={e => handleMouseEvent(e, onMouseDown)}
                onMouseUp={e => handleMouseEvent(e, onMouseUp)}
                onMouseMove={e => handleMouseEvent(e, onMouseMove)}
                onMouseEnter={e => handleMouseEvent(e, onMouseEnter)}
                onMouseLeave={e => handleMouseEvent(e, onMouseLeave)}
                onTouchStart={e => {
                    e.preventDefault();
                    handleTouchStart(e);
                }}
                onTouchEnd={e => {
                    e.preventDefault();
                    handleTouchEnd(e);
                }}
                onTouchMove={e => {
                    e.preventDefault();
                    handleTouchMove(e);
                }}
                onWheel={handleWheel}
                onContextMenu={e => {
                    e.preventDefault();
                    onContextMenu?.(e);
                }}
                onKeyDown={e => handleKeyEvent(e, onKeyDown)}
                onKeyUp={e => handleKeyEvent(e, onKeyUp)}
                style={{ 
                    outline: 'none',
                    touchAction: 'none'  // 禁用默认触摸行为
                }}
                {...props}
            />
            <div className="canvas-info-label">
                <div>{canvasId}</div>
                <div>{fps} FPS</div>
            </div>
        </div>
    );
};

export default ViewportCanvas; 