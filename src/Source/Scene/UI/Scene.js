import IObjectBase from './Object/ObjectBase';

class Scene extends IObjectBase {
    constructor() {
        super();  // 调用父类构造函数
        /**
         * 对象名 -> 对象
         * @type {Map<string, IObjectBase>}
         */
        this.Children = new Map();
        this.Name = 'Scene';  // 添加场景名称
        this.Type = 'scene';  // 添加场景类型
    }

    /**
     * 将场景转换为UI树数据结构
     * @returns {Object} 返回UI树所需的数据结构
     */
    toUITree() {
        return {
            name: this.Name,
            type: this.Type,
            expanded: true,
            children: this.buildChildrenTree(this.Children)
        };
    }

    /**
     * 递归构建子节点的树结构
     * @param {Map<string, IObjectBase>} children 
     * @returns {Array} 子节点数组
     */
    buildChildrenTree(children) {
        const result = [];
        
        for (const [name, child] of children) {
            const node = {
                name: name,
                type: child.Type.toLowerCase(),
                expanded: true
            };

            // 如果有子节点，递归构建子树
            if (child.Children && child.Children.size > 0) {
                node.children = this.buildChildrenTree(child.Children);
            }

            result.push(node);
        }

        return result;
    }

    /**
     * 根据点号分隔的路径字符串查找子对象
     * 例如："a.b" 表示先查找 Scene.Children 中 key 为 "a" 的对象，
     * 然后在该对象的 Children 中查找 key 为 "b" 的对象。
     *
     * @param {string} path 点分隔的路径字符串，如 "a.b.c"
     * @returns {IObjectBase|undefined} 找到的对象，如果找不到则返回 undefined
     */
    getChildByPath(path) {
        const keys = path.split('.');
        let current = this;  // 从 Scene 根节点开始查找

        for (const key of keys) {
            // 当前节点需要拥有 Children 属性，并且 key 存在
            if (current.Children && current.Children.has(key)) {
                current = current.Children.get(key);
            } else {
                // 找不到相应子对象则返回 undefined
                return undefined;
            }
        }

        return current;
    }
}

export default Scene;
