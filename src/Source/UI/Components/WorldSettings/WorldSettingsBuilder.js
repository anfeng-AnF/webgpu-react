import React from 'react';
import { BooleanEditor, EnumEditor, FloatEditor, Vector3Editor, Section } from '../Details';
import './WorldSettingsBuilder.css';

class WorldSettingsBuilder {
    static instance = null;

    static getInstance(onChange) {
        if (!WorldSettingsBuilder.instance) {
            WorldSettingsBuilder.instance = new WorldSettingsBuilder(onChange);
        }
        if (onChange) {
            WorldSettingsBuilder.instance.onChange = onChange;
        }
        return WorldSettingsBuilder.instance;
    }

    constructor(onChange) {
        if (WorldSettingsBuilder.instance) {
            throw new Error('WorldSettingsBuilder is a singleton. Use WorldSettingsBuilder.getInstance() instead.');
        }
        
        this.onChange = onChange || ((path, value) => {
            console.log('World property changed:', path, value);
        });
        
        this.properties = new Map();
        this.sections = new Map();
        this.stateChangeListeners = new Set();
        this.callbacks = new Map();
    }

    addStateChangeListener(listener) {
        this.stateChangeListeners.add(listener);
    }

    removeStateChangeListener(listener) {
        this.stateChangeListeners.delete(listener);
    }

    notifyStateChange(path, value) {
        this.stateChangeListeners.forEach(listener => listener(path, value));
    }

    addProperty(path, value, options = {}) {
        const pathParts = path.split('.');
        const sectionPath = pathParts.slice(0, -1).join('.');
        const propertyName = pathParts[pathParts.length - 1];

        this.properties.set(path, {
            value,
            options,
            type: this.getPropertyType(value),
            name: propertyName,
            path
        });

        if (options.onChange) {
            this.callbacks.set(path, options.onChange);
        }

        if (sectionPath) {
            if (!this.sections.has(sectionPath)) {
                this.sections.set(sectionPath, new Set());
            }
            this.sections.get(sectionPath).add(path);
        }
    }

    getPropertyType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (Array.isArray(value) && value.length === 3) return 'vector3';
        if (typeof value === 'string') return 'enum';
        return null;
    }

    updateProperty(path, value) {
        const property = this.properties.get(path);
        if (property) {
            property.value = Array.isArray(value) ? [...value] : value;
            this.properties.set(path, property);
            this.notifyStateChange(path, value);
        }
    }

    buildComponent(path) {
        const property = this.properties.get(path);
        if (!property) return null;

        const { value, options, type, name } = property;
        const { key, ...componentProps } = {
            key: path,
            label: options.label || name,
            value: value,
            onChange: (newValue) => {
                this.updateProperty(path, newValue);
                if (JSON.stringify(value) !== JSON.stringify(newValue)) {
                    const specificCallback = this.callbacks.get(path);
                    if (specificCallback) {
                        specificCallback(path, newValue);
                    }
                    
                    if (typeof this.onChange === 'function') {
                        this.onChange(path, newValue);
                    }
                }
            }
        };

        switch (type) {
            case 'boolean':
                return <BooleanEditor key={key} {...componentProps} />;
            case 'number':
                return <FloatEditor key={key} {...componentProps} />;
            case 'vector3':
                return <Vector3Editor key={key} {...componentProps} />;
            case 'enum':
                return (
                    <EnumEditor 
                        key={key}
                        {...componentProps}
                        options={options.options || [{ value, label: value }]}
                    />
                );
            default:
                return null;
        }
    }

    buildSection(sectionPath) {
        const properties = this.sections.get(sectionPath);
        if (!properties) return null;

        const sectionName = sectionPath.split('.').pop();
        const components = Array.from(properties)
            .map(path => this.buildComponent(path))
            .filter(Boolean);

        const childSections = Array.from(this.sections.keys())
            .filter(path => path.startsWith(sectionPath + '.'))
            .map(path => this.buildSection(path));

        return (
            <Section key={sectionPath} title={sectionName}>
                {components}
                {childSections}
            </Section>
        );
    }

    build() {
        const topLevelSections = Array.from(this.sections.keys())
            .filter(path => !path.includes('.'))
            .map(path => this.buildSection(path));

        const ungroupedProperties = Array.from(this.properties.keys())
            .filter(path => !path.includes('.'))
            .map(path => this.buildComponent(path));

        return (
            <div className="world-settings-builder">
                {ungroupedProperties}
                {topLevelSections}
            </div>
        );
    }

    clear() {
        this.properties.clear();
        this.sections.clear();
        this.callbacks.clear();
    }

    addProperties(properties) {
        Object.entries(properties).forEach(([path, config]) => {
            const { value, label, onChange, ...otherOptions } = config;
            this.addProperty(path, value, {
                label,
                onChange,
                ...otherOptions
            });
        });
    }

    static resetInstance() {
        WorldSettingsBuilder.instance = null;
    }

    setOnChange(callback) {
        if (typeof callback === 'function') {
            this.onChange = callback;
        } else {
            console.warn('setOnChange expects a function as argument');
        }
    }
}

export default WorldSettingsBuilder; 