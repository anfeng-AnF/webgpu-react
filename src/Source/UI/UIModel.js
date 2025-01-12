import React, { useState } from 'react';
import Split from 'react-split';
import './UIModel.css';

class UIModel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'details', // 'details' 或 'worldSettings'
    };
  }

  switchTab = (tab) => {
    this.setState({ activeTab: tab });
  };

  render() {
    const { activeTab } = this.state;

    return (
      <div className="ui-model-container">
        <Split sizes={[20, 60, 20]} minSize={50} gutterSize={4} className="split-horizontal">
          <div className="left-panel">
            <div className="panel-header">
              <h3>放置Actor</h3>
              <button className="close-button">×</button>
            </div>
            <div className="search-box">
              <input type="text" placeholder="搜索类" />
            </div>
            <div className="category-icons"></div>
          </div>

          <Split
            direction="vertical"
            sizes={[70, 30]}
            minSize={50}
            gutterSize={4}
            className="main-content-container"
          >
            <div className="main-content-top"></div>
            <div className="main-content-bottom">
              <div className="content-browser">
                <div className="browser-content">
                  <Split
                    sizes={[30, 70]}
                    minSize={100}
                    gutterSize={4}
                    className="split-horizontal file-management-split"
                  >
                    <div className="file-tree"></div>
                    <div className="file-details">
                      <div className="file-details-header">
                        <div className="browser-search">
                          <input type="text" placeholder="搜索" />
                        </div>
                      </div>
                      <div className="file-details-content"></div>
                    </div>
                  </Split>
                </div>
              </div>
            </div>
          </Split>

          <Split
            direction="vertical"
            sizes={[30, 70]}
            minSize={50}
            gutterSize={4}
            className="right-panel-container"
          >
            <div className="right-panel-top">
              <div className="outline-header">
                <div className="outline-controls">
                  <span className="item-label">Item Label ▾</span>
                  <span className="type-label">类型</span>
                </div>
                <div className="outline-search">
                  <input type="text" placeholder="搜索" />
                </div>
              </div>
              <div className="outline-content">
                <div className="outline-tree">
                </div>
              </div>
            </div>
            <div className="right-panel-bottom">
              <div className="tab-header">
                <button
                  className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                  onClick={() => this.switchTab('details')}
                >
                  细节
                </button>
                <button
                  className={`tab-button ${activeTab === 'worldSettings' ? 'active' : ''}`}
                  onClick={() => this.switchTab('worldSettings')}
                >
                  世界场景设置
                </button>
              </div>
              <div className="tab-content">
                {activeTab === 'details' ? (
                  <div className="details-content">{/* 细节内容 */}</div>
                ) : (
                  <div className="world-settings-content">{/* 世界场景设置内容 */}</div>
                )}
              </div>
            </div>
          </Split>
        </Split>
      </div>
    );
  }
}

export default UIModel;
