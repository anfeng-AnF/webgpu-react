import React, { useState, useRef, useEffect } from 'react';
import './Vector3Editor.css';

const Vector3Editor = ({ label = "位置", value = [0, 0, 0], onChange }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState('');
    const dragStartX = useRef(0);
    const currentValue = useRef(0);
    const currentIndex = useRef(null);
    const lastX = useRef(0);
    const inputRefs = useRef([]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - lastX.current;
            lastX.current = e.clientX;
            
            console.log('Mouse move:', {
                deltaX,
                currentValue: currentValue.current,
                clientX: e.clientX,
                lastX: lastX.current
            });
            
            let sensitivity = 1;
            if (Math.abs(currentValue.current) < 1) {
                sensitivity = 0.01;
            } else if (Math.abs(currentValue.current) < 10) {
                sensitivity = 0.1;
            }

            const newValue = currentValue.current + (deltaX * sensitivity);
            currentValue.current = Number(newValue.toPrecision(6));
            
            const newValues = [...value];
            newValues[currentIndex.current] = currentValue.current;
            
            console.log('New value:', {
                sensitivity,
                newValue: currentValue.current,
                newValues
            });
            
            onChange(newValues);
        };

        const handleMouseUp = () => {
            console.log('Mouse up');
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, value, onChange]);

    const handleMouseDown = (e, index) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        dragStartX.current = e.clientX;
        lastX.current = e.clientX;
        currentValue.current = value[index];
        currentIndex.current = index;
        console.log('Mouse down:', { index, startX: e.clientX, startValue: value[index] });
    };

    const handleInputChange = (e, index) => {
        const newValues = [...value];
        newValues[index] = Number(Number(e.target.value).toPrecision(6));
        onChange?.(newValues);
    };

    const preventSelection = (e) => {
        e.preventDefault();
    };

    // 处理单击编辑
    const handleClick = (e, index) => {
        if (!isDragging) {
            setIsEditing(true);
            setEditingIndex(index);
            setEditValue(value[index].toString());
            // 确保下一个渲染周期后聚焦并选中文本
            setTimeout(() => {
                if (inputRefs.current[index]) {
                    inputRefs.current[index].select();
                }
            }, 0);
        }
    };

    // 处理编辑完成
    const handleBlur = () => {
        if (isEditing) {
            finishEditing();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            finishEditing();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditingIndex(null);
        }
    };

    const finishEditing = () => {
        if (editingIndex !== null) {
            const newValue = Number(Number(editValue).toPrecision(6));
            const newValues = [...value];
            newValues[editingIndex] = newValue;
            onChange(newValues);
            setIsEditing(false);
            setEditingIndex(null);
        }
    };

    // 修改input渲染逻辑
    const renderInput = (index) => {
        const isCurrentlyEditing = isEditing && editingIndex === index;
        return (
            <input
                ref={el => inputRefs.current[index] = el}
                type="number"
                value={isCurrentlyEditing ? editValue : value[index]}
                onChange={(e) => {
                    if (isCurrentlyEditing) {
                        setEditValue(e.target.value);
                    } else {
                        handleInputChange(e, index);
                    }
                }}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onClick={(e) => handleClick(e, index)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onDragStart={(e) => e.preventDefault()}
                step="any"
            />
        );
    };

    return (
        <div className="vector3-editor" onMouseDown={preventSelection}>
            <label className="vector3-label">{label}</label>
            <div className="vector3-inputs">
                <div className="vector3-input-group">
                    <div className="input-wrapper x">
                        {renderInput(0)}
                    </div>
                    <div className="input-wrapper y">
                        {renderInput(1)}
                    </div>
                    <div className="input-wrapper z">
                        {renderInput(2)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Vector3Editor; 