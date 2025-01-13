import React from 'react';
import './MainContent.css';

const MainContent = ({ children }) => {
    console.log('MainContent rendering:', { children });
    return (
        <div className="main-content-view">
            {children}
        </div>
    );
};

export default MainContent; 