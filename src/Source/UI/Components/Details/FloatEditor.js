import React, { useState, useRef } from 'react';
import './DetailsEditor.css';

const FloatEditor = ({ label = "", value = 0, onChange, precision = 3 }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef(null);
    const lastX = useRef(0);
    const isDragging = useRef(false);
    const currentValue = useRef(value);

    const handleMouseDown = (e) => {
        e.preventDefault();
        isDragging.current = true;
        lastX.current = e.clientX;
        currentValue.current = value;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e) => {
        if (!isDragging.current) return;

        const delta = e.clientX - lastX.current;
        lastX.current = e.clientX;
        
        let sensitivity = 0.01;
        if (Math.abs(currentValue.current) < 1) {
            sensitivity = 0.001;
        }

        const newValue = currentValue.current + (delta * sensitivity);
        currentValue.current = Number(newValue.toFixed(precision));
        onChange?.(currentValue.current);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleClick = () => {
        if (!isDragging.current) {
            setIsEditing(true);
            setEditValue(value.toString());
            setTimeout(() => inputRef.current?.select(), 0);
        }
    };

    const handleInputChange = (e) => {
        // 允许输入负号、数字和小数点
        const value = e.target.value;
        if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
            setEditValue(value);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const numValue = parseFloat(editValue);
            if (!isNaN(numValue)) {
                onChange?.(numValue);
            }
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(value.toString());
        }
    };

    const handleBlur = () => {
        const numValue = parseFloat(editValue);
        if (!isNaN(numValue)) {
            onChange?.(numValue);
        }
        setIsEditing(false);
    };

    return (
        <div className="details-editor float-editor">
            <label className="editor-label">{label}</label>
            <div className="editor-input">
                <input
                    ref={inputRef}
                    type="text"
                    value={isEditing ? editValue : value}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onMouseDown={handleMouseDown}
                    onClick={handleClick}
                />
            </div>
        </div>
    );
};

export default FloatEditor; 