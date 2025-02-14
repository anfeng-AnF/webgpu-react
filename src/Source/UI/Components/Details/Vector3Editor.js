import React, { useState, useRef } from 'react';
import './Vector3Editor.css';

const Vector3Editor = ({ label = "位置", value = [0, 0, 0], onChange }) => {
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState('');
    const inputRefs = useRef([]);
    const isDragging = useRef(false);
    const lastX = useRef(0);
    const currentValue = useRef([...value]);
    const currentIndex = useRef(null);

    const handleMouseDown = (e, index) => {
        e.preventDefault();
        isDragging.current = true;
        lastX.current = e.clientX;
        currentValue.current = [...value];
        currentIndex.current = index;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;

        const delta = e.clientX - lastX.current;
        lastX.current = e.clientX;
        
        let sensitivity = 0.01;
        const currentVal = currentValue.current[currentIndex.current];
        if (Math.abs(currentVal) < 1) {
            sensitivity = 0.001;
        }

        const newValues = [...currentValue.current];
        newValues[currentIndex.current] += delta * sensitivity;
        newValues[currentIndex.current] = Number(newValues[currentIndex.current].toFixed(6));
        currentValue.current = newValues;
        onChange?.(newValues);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleClick = (e, index) => {
        if (!isDragging.current) {
            setEditingIndex(index);
            setEditValue(value[index].toString());
            setTimeout(() => inputRefs.current[index]?.select(), 0);
        }
    };

    const handleInputChange = (e) => {
        // 允许输入负号、数字和小数点
        const value = e.target.value;
        if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
            setEditValue(value);
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Enter') {
            const numValue = parseFloat(editValue);
            if (!isNaN(numValue)) {
                const newValues = [...value];
                newValues[index] = numValue;
                onChange?.(newValues);
            }
            setEditingIndex(null);
        } else if (e.key === 'Escape') {
            setEditingIndex(null);
            setEditValue(value[index].toString());
        }
    };

    const handleBlur = (index) => {
        const numValue = parseFloat(editValue);
        if (!isNaN(numValue)) {
            const newValues = [...value];
            newValues[index] = numValue;
            onChange?.(newValues);
        }
        setEditingIndex(null);
    };

    return (
        <div className="vector3-editor details-editor">
            <label className="vector3-label">{label}</label>
            <div className="vector3-inputs">
                <div className="vector3-input-group">
                    {['x', 'y', 'z'].map((axis, index) => (
                        <div key={axis} className={`input-wrapper ${axis}`}>
                            <input
                                ref={el => inputRefs.current[index] = el}
                                type="text"
                                value={editingIndex === index ? editValue : value[index]}
                                onChange={handleInputChange}
                                onBlur={() => handleBlur(index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                onMouseDown={(e) => handleMouseDown(e, index)}
                                onClick={(e) => handleClick(e, index)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Vector3Editor; 