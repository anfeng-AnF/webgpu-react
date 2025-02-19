import IObjectBase from './Object/ObjectBase';
import FModuleManager from '../../Core/FModuleManager';
import SceneTreeBuilder from '../../UI/Components/SceneTree/SceneTreeBuilder';
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
        /**
         * 
         * @type {SceneTreeBuilder}
         */
        this.SceneTreeBuilder = FModuleManager.GetInstance().GetModule('UIModule').SceneTreeBuilder;

        this.Update();
        // 初始化SceneTreeBuilder的回调
        this.initializeSceneTreeCallbacks();
    }

    /**
     * 初始化场景树的回调函数
     */
    initializeSceneTreeCallbacks() {
        // 处理结构变化（如拖拽移动）
        this.SceneTreeBuilder.setStructureChangeCallback((changeInfo) => {
            console.log('结构变化', changeInfo);
            let { fromPath, toPath, position, node } = changeInfo;
            // 移除path中的第一个.前的内容
            fromPath = fromPath.substring(fromPath.indexOf('.') + 1);
            toPath = toPath.substring(toPath.indexOf('.') + 1);

            // 从原位置移除对象
            const sourceObject = this.getChildByPath(fromPath);
            if (!sourceObject) return;

            const sourceParentPath = fromPath.substring(0, fromPath.lastIndexOf('.'));
            const sourceParent = sourceParentPath ? this.getChildByPath(sourceParentPath) : this;
            sourceParent.Children.delete(node.name);

            // 添加到新位置
            let targetParent;
            if (position === 'inside') {
                targetParent = this.getChildByPath(toPath);
            } else {
                const targetParentPath = toPath.substring(0, toPath.lastIndexOf('.'));
                targetParent = targetParentPath ? this.getChildByPath(targetParentPath) : this;
            }

            if (targetParent && targetParent.Children) {
                targetParent.Children.set(node.name, sourceObject);
            }

            // 更新UI树
            this.Update();
        });

        // 处理选择变化
        this.SceneTreeBuilder.setSelectionChangeCallback((selectedPaths) => {
            // 先处理所有已选中对象的取消选中
            for (const [_, obj] of this.Children) {
                if (obj.Selected) {
                    obj.OnDeselected();
                }
            }

            // 处理新选中的对象
            if (selectedPaths.length > 0) {
                const path = selectedPaths[0].substring(selectedPaths[0].indexOf('.') + 1);
                const selectedObject = this.getChildByPath(path);
                if (selectedObject) {
                    selectedObject.OnSelected();
                }
            }
        });

        // 处理可见性变化
        this.SceneTreeBuilder.setVisibilityChangeCallback((path, visible) => {
            console.log('可见性变化', path, visible);
            const object = this.getChildByPath(path);
            if (object) {
                object.Visible = visible;
                // 如果对象有更新可见性的方法，调用它
                if (typeof object.updateVisibility === 'function') {
                    object.updateVisibility(visible);
                }
            }
        });

        // 处理列宽度变化
        this.SceneTreeBuilder.setColumnWidthChangeCallback((width) => {
            // 这里可以处理类型列宽度变化的逻辑
            console.log('Type column width changed to:', width);
        });
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

    /**
     * 更新UI树
     */
    Update(){
        this.SceneTreeBuilder.setTreeData(this.toUITree());
    }

    /**
     * 遍历所有子对象
     * @param {Function} callback 回调函数
     */
    transver(callback){

        function dfs(node){
            callback(node);
            for(const [_, child] of node.Children){
                dfs(child);
            }
        }

        dfs(this);
    }
}

export default Scene;
