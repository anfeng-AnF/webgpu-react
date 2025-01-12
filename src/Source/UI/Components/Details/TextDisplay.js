import React from 'react';
import './DetailsEditor.css';

const TextDisplay = ({ text = "", style = {} }) => {
    return (
        <div className="details-editor text-display" style={style}>
            <span className="display-text">{text}</span>
        </div>
    );
};

export default TextDisplay; 