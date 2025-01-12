import React from 'react';
import './DetailsEditor.css';

const BooleanEditor = ({ label = "", value = false, onChange }) => {
    return (
        <div className="details-editor boolean-editor">
            <label className="editor-label">{label}</label>
            <div className="editor-input">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange?.(e.target.checked)}
                />
            </div>
        </div>
    );
};

export default BooleanEditor; 