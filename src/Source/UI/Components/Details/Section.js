import React from 'react';
import './Section.css';

class Section extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isExpanded: props.defaultExpanded !== undefined ? props.defaultExpanded : true
        };
    }

    toggleExpand = () => {
        this.setState(prevState => ({
            isExpanded: !prevState.isExpanded
        }));
    }

    render() {
        const { title, children } = this.props;
        const { isExpanded } = this.state;

        return (
            <div className="details-section">
                <div 
                    className={`section-header ${isExpanded ? 'expanded' : ''}`}
                    onClick={this.toggleExpand}
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
    }
}

export default Section; 