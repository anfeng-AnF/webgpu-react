import React from 'react';
import './App.css';
import UIModel from './Source/UI/UIModel';

/**
 * 应用程序根组件
 */
class App extends React.Component {
    render() {
        return (
            <div className="app">
                <UIModel />
            </div>
        );
    }
}

export default App;
