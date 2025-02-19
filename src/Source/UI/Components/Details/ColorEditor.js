import React, { useState } from 'react';
import './ColorEditor.css';

const ColorEditor = ({ label = "", value = "FFFFFF", onChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);

    const handleInputChange = (e) => {
        // 只允许输入有效的十六进制字符
        const newValue = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
        setEditValue(newValue);
    };

    const handleBlur = () => {
        if (editValue.length === 6) {
            onChange?.(editValue);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (editValue.length === 6) {
                onChange?.(editValue);
            }
            setIsEditing(false);
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(value);
        }
    };

    const handleColorBoxClick = () => {
        setIsEditing(true);
        setEditValue(value);
    };

    return (
        <div className="details-editor color-editor">
            <label className="editor-label">{label}</label>
            <div className="editor-input">
                <div className="color-preview" style={{ backgroundColor: `#${value}` }} />
                {isEditing ? (
                    <div className="color-input-container">
                        <span className="color-hash">#</span>
                        <input
                            type="text"
                            value={editValue}
                            onChange={handleInputChange}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                ) : (
                    <div 
                        className="color-text-display"
                        onClick={handleColorBoxClick}
                    >
                        #{value}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ColorEditor; 