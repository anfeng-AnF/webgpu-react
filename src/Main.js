import FModuleManager from './Source/Core/FModuleManager';

class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();

            const UIModel = Main.ModuleManager.GetModule('UIModule');
            const DetailBuilder = UIModel.GetDetailBuilder();

            // 创建一个引用对象来存储所有属性
            const actorProperties = {
                basic: {
                    name: "TestCube",
                    guid: "F7977D324F1DA9A205CDF3A430F87F7E"
                },
                transform: {
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1]
                },
                physics: {
                    mass: 100,
                    gravity: true,
                    simulated: true
                },
                rendering: {
                    visible: true,
                    castShadow: true,
                    material: "Default"
                }
            };

            // 更新函数现在直接修改引用对象
            const updateActorProperty = (path, value) => {
                const pathParts = path.split('.');
                const section = pathParts[0].toLowerCase();
                const property = pathParts[1].toLowerCase();
                
                // 直接修改引用对象中的值
                if (actorProperties[section]) {
                    actorProperties[section][property] = value;
                    console.log(`Property updated - ${path}:`, value);
                }
            };

            // 设置 DetailBuilder 的回调函数
            DetailBuilder.setOnChange(updateActorProperty);

            // 使用引用对象添加属性
            DetailBuilder.addProperties({
                'Basic.Name': {
                    value: actorProperties.basic.name,
                    label: '名称',
                    type: 'string'
                },
                'Basic.GUID': {
                    value: actorProperties.basic.guid,
                    label: 'GUID',
                    type: 'string'
                },
                
                'Transform.Position': {
                    value: actorProperties.transform.position,
                    label: '位置',
                    type: 'vector3'
                },
                'Transform.Rotation': {
                    value: actorProperties.transform.rotation,
                    label: '旋转',
                    type: 'vector3'
                },
                'Transform.Scale': {
                    value: actorProperties.transform.scale,
                    label: '缩放',
                    type: 'vector3'
                },

                'Physics.Mass': {
                    value: actorProperties.physics.mass,
                    label: '质量',
                    type: 'float'
                },
                'Physics.UseGravity': {
                    value: actorProperties.physics.gravity,
                    label: '使用重力',
                    type: 'boolean'
                },
                'Physics.Simulated': {
                    value: actorProperties.physics.simulated,
                    label: '物理模拟',
                    type: 'boolean'
                },

                'Rendering.Visible': {
                    value: actorProperties.rendering.visible,
                    label: '可见性',
                    type: 'boolean'
                },
                'Rendering.CastShadow': {
                    value: actorProperties.rendering.castShadow,
                    label: '投射阴影',
                    type: 'boolean'
                },
                'Rendering.Material': {
                    value: actorProperties.rendering.material,
                    label: '材质',
                    type: 'enum',
                    options: [
                        { value: 'Default', label: '默认' },
                        { value: 'Metal', label: '金属' },
                        { value: 'Wood', label: '木材' },
                        { value: 'Glass', label: '玻璃' }
                    ]
                }
            });

            // 每隔5秒打印属性
            setInterval(() => {
                console.log('Actor Properties:', actorProperties);
            }, 5000);

            console.log('System initialized with test properties');
        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main; 