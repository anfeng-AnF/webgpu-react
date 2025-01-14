import React, { useState } from 'react';
import './Section.css';

const Section = ({ title, children, defaultExpanded = true }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="details-section">
            <div 
                className={`section-header ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                <span className="section-title">{title}</span>
            </div>
            {isExpanded && (
                <div className="section-content">
                    {children}
                </div>
            )}
        </div>
    );
};

export default Section; 