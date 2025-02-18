import IObjectBase from './ObjectBase';

class Filter extends IObjectBase {
    constructor(name = '') {
        super();
        this.Name = name;
        this.Type = 'filter';  // 设置类型为 filter，对应 UI 中的文件夹图标
    }

    // 如果需要，可以添加特定于 Filter 的方法
    GetUIInfo() {
        return {
            ...super.GetUIInfo(),
            // 可以添加 Filter 特有的 UI 信息
        };
    }
}

export default Filter;
