import React from 'react';
import Vector3Editor from '../Vector3Editor';
import BooleanEditor from './BooleanEditor';
import EnumEditor from './EnumEditor';
import FloatEditor from './FloatEditor';
import Section from '../Section';

class DetailBuilder {
    constructor(onChange) {
        this.onChange = onChange;
        this.properties = new Map(); // 存储所有属性
        this.sections = new Map();   // 存储section结构
        this.stateChangeListeners = new Set();
    }

    // 添加状态变化监听器
    addStateChangeListener(listener) {
        this.stateChangeListeners.add(listener);
    }

    // 移除状态变化监听器
    removeStateChangeListener(listener) {
        this.stateChangeListeners.delete(listener);
    }

    // 通知状态变化
    notifyStateChange(path, value) {
        this.stateChangeListeners.forEach(listener => listener(path, value));
    }

    // 添加属性
    addProperty(path, value, options = {}) {
        const pathParts = path.split('.');
        const sectionPath = pathParts.slice(0, -1).join('.');
        const propertyName = pathParts[pathParts.length - 1];

        // 存储属性信息
        this.properties.set(path, {
            value,
            options,
            type: this.getPropertyType(value),
            name: propertyName,
            path  // 添加完整路径
        });

        // 构建section层级结构
        if (sectionPath) {
            if (!this.sections.has(sectionPath)) {
                this.sections.set(sectionPath, new Set());
            }
            this.sections.get(sectionPath).add(path);
        }
    }

    // 获取属性类型
    getPropertyType(value) {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (Array.isArray(value) && value.length === 3) return 'vector3';
        if (typeof value === 'string') return 'enum';
        return null;
    }

    // 更新属性值
    updateProperty(path, value) {
        const prop = this.properties.get(path);
        if (prop) {
            // 如果是数组，创建副本
            prop.value = Array.isArray(value) ? [...value] : value;
            this.properties.set(path, prop);
            this.notifyStateChange(path, value);
        }
    }

    // 构建单个组件
    buildComponent(path) {
        const prop = this.properties.get(path);
        if (!prop) return null;

        const { value, options, type, name } = prop;
        const { key, ...componentProps } = {
            key: path,
            label: options.label || name,
            value: value,
            onChange: (newValue) => {
                this.updateProperty(path, newValue);
                this.onChange(path, newValue);
                console.log('Component value changed:', path, newValue);
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

    // 构建section
    buildSection(sectionPath) {
        const properties = this.sections.get(sectionPath);
        if (!properties) return null;

        const sectionName = sectionPath.split('.').pop();
        const components = Array.from(properties)
            .map(path => this.buildComponent(path))
            .filter(Boolean);

        // 检查是否有子section
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

    // 构建整个细节面板
    build() {


        // 获取顶层section
        const topLevelSections = Array.from(this.sections.keys())
            .filter(path => !path.includes('.'))
            .map(path => this.buildSection(path));

        // 获取未分组的属性
        const ungroupedProperties = Array.from(this.properties.keys())
            .filter(path => !path.includes('.'))
            .map(path => this.buildComponent(path));

        return (
            <React.Fragment>
                {ungroupedProperties}
                {topLevelSections}
            </React.Fragment>
        );
    }

    // 清除所有数据
    clear() {
        this.properties.clear();
        this.sections.clear();
    }

    // 添加批量添加属性的方法
    addProperties(properties) {
        // properties的格式应该是：
        // {
        //     'path.to.property': {
        //         value: any,
        //         label: string,
        //         options?: object
        //     }
        // }
        
        Object.entries(properties).forEach(([path, config]) => {
            const { value, label, ...otherOptions } = config;
            this.addProperty(path, value, {
                label,
                ...otherOptions
            });
        });
    }

    // 添加一个辅助方法，用于从对象生成属性配置
    static createPropertiesFromObject(obj, parentPath = '') {
        const properties = {};

        const processValue = (value, path) => {
            if (value === null || value === undefined) return;

            if (typeof value === 'object' && !Array.isArray(value)) {
                // 处理嵌套对象
                Object.entries(value).forEach(([key, val]) => {
                    const newPath = parentPath ? `${path}.${key}` : key;
                    processValue(val, newPath);
                });
            } else {
                // 处理基本类型和数组
                properties[path] = {
                    value,
                    label: path.split('.').pop()
                };
            }
        };

        processValue(obj, parentPath);
        return properties;
    }
}

export default DetailBuilder; 