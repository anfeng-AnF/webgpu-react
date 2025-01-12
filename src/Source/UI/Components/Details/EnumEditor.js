import React from 'react';
import './DetailsEditor.css';

const EnumEditor = ({ label = "", value = "", options = [], onChange }) => {
    return (
        <div className="details-editor enum-editor">
            <label className="editor-label">{label}</label>
            <div className="editor-input">
                <select 
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                >
                    {options.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default EnumEditor; 