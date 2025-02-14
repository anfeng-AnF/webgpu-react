import IModule from '../Core/IModule';
import React from 'react';
import FModuleManager from '../Core/FModuleManager';
import ViewportCanvas from '../UI/Components/MainContent/ViewportCanvas';
import FResourceManager from '../Core/Resource/FResourceManager';
import FDeferredShadingSceneRenderer from './DeferredShadingRenderer/FDeferredShadingSceneRenderer';
import * as THREE from 'three';
import FSceneRenderer from './DeferredShadingRenderer/FSceneRenderer';

/**
 * 渲染器模块
 */
class RendererModule extends IModule {
    constructor() {
        super();
        this.adapter = null;
        this.device = null;
        this.canvas = null;
        this.context = null;
        this.sceneRenderer = null;
        this.moduleManager = FModuleManager.GetInstance();
        this.bInitialized = false;

        // 相机控制相关状态
        this._isDragging = false;
        this._lastMouseX = 0;
        this._lastMouseY = 0;
        this._cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this._cameraPosition = new THREE.Vector3(0, 2, 5);
        this._moveSpeed = 0.1;
        this._rotateSpeed = 0.005;
        this._activeKeys = new Set();
        
        // 添加右键状态跟踪
        this._isRightMouseDown = false;

        // 添加移动速度相关配置
        this._minMoveSpeed = 0.01;    // 最小移动速度
        this._maxMoveSpeed = 1.0;     // 最大移动速度
        this._moveSpeedMultiplier = 1.2; // 速度调整倍率

        // 添加UI更新标志
        this._needUpdateUI = false;
    }

    async Initialize() {
        this.adapter = await navigator.gpu.requestAdapter();
        this.device = await this.adapter.requestDevice();
        console.log(this.adapter);
        console.log(this.device);

        if (!this.device) {
            throw new Error('Failed to initialize WebGPU device');
        }

        let UIModule = this.moduleManager.GetModule('UIModule');
        let mainContent = UIModule.GetMainContentBuilder();
        mainContent.addComponent(
            'viewport',
            'viewportCanvas2',
            <ViewportCanvas
                onResize={(width, height) => this.handleResize(width, height)}
                onCanvasReady={(canvas) => this.handleCanvasReady(canvas)}
                onMouseDown={(e) => this.handleMouseDown(e)}
                onMouseUp={(e) => this.handleMouseUp(e)}
                onMouseMove={(e) => this.handleMouseMove(e)}
                onWheel={(e) => this.handleWheel(e)}
                onKeyDown={(e) => this.handleKeyDown(e)}
                onKeyUp={(e) => this.handleKeyUp(e)}
                canvasId="RendererModuleViewportCanvas"
            />
        );

        FResourceManager.GetInstance().InitDevice(this.device);
        this.sceneRenderer = new FDeferredShadingSceneRenderer(this.device);

        await this.sceneRenderer.Initialize();

        // 初始化相机UI
        await this.#InitializeCameraUI();
    }

    /**
     * 初始化相机UI控制
     * @private
     */
    async #InitializeCameraUI() {
        const UIModule = this.moduleManager.GetModule('UIModule');
        const DetailBuilder = UIModule.WorldSettingsBuilder;

        // 创建相机控制
        DetailBuilder.addProperties({
            'Camera.Position': {
                value: [0, 2, 5], // 默认相机位置
                label: '相机位置',
                type: 'vector3',
                onChange: (path, value) => {
                    this._cameraPosition.set(value[0], value[1], value[2]);
                    this.updateCamera();
                },
            },
            'Camera.Rotation': {
                value: [0, 0, 0],
                label: '相机旋转',
                type: 'vector3',
                onChange: (path, value) => {
                    // 将角度转换为弧度
                    this._cameraRotation.set(
                        value[0] * Math.PI / 180,  // 度数转弧度
                        value[1] * Math.PI / 180,
                        value[2] * Math.PI / 180
                    );
                    this.updateCamera();
                },
            },
            'Camera.FOV': {
                value: 60,
                label: '视野角度',
                type: 'float',
                min: 1,
                max: 179,
                onChange: (path, value) => {
                    if (this.sceneRenderer?._MainCamera) {
                        this.sceneRenderer._MainCamera.fov = value;
                        this.sceneRenderer._MainCamera.updateProjectionMatrix();
                    }
                },
            },
            'Camera.Near': {
                value: 0.1,
                label: '近裁面',
                type: 'float',
                min: 0.01,
                max: 10,
                onChange: (path, value) => {
                    if (this.sceneRenderer?._MainCamera) {
                        this.sceneRenderer._MainCamera.near = value;
                        this.sceneRenderer._MainCamera.updateProjectionMatrix();
                    }
                },
            },
            'Camera.Far': {
                value: this.sceneRenderer._MainCamera.far,
                label: '远裁面',
                type: 'float',
                min: 1,
                max: 1e10,
                onChange: (path, value) => {
                    if (this.sceneRenderer?._MainCamera) {
                        this.sceneRenderer._MainCamera.far = value;
                        this.sceneRenderer._MainCamera.updateProjectionMatrix();
                    }
                },
            },
            'Camera.MoveSpeed': {
                value: this._moveSpeed,
                label: '移动速度',
                type: 'float',
                min: this._minMoveSpeed,
                max: this._maxMoveSpeed,
                onChange: (path, value) => {
                    this._moveSpeed = value;
                },
            },
        });

        // 存储DetailBuilder的引用，用于后续更新
        this._detailBuilder = DetailBuilder;
    }

    // 鼠标事件处理
    handleMouseDown(e) {
        if (e.buttons === 2) { // 右键
            this._isRightMouseDown = true;
            this._lastMouseX = e.canvasX;
            this._lastMouseY = e.canvasY;
            // 确保Canvas获得焦点
            e.currentTarget.focus();
            e.preventDefault();
        }
    }

    handleMouseUp(e) {
        if (e.buttons === 0) { // 所有按键都松开了
            this._isRightMouseDown = false;
        }
    }

    handleMouseMove(e) {
        if (!this._isRightMouseDown) return;

        const deltaX = e.canvasX - this._lastMouseX;
        const deltaY = e.canvasY - this._lastMouseY;

        // 更新相机旋转
        this._cameraRotation.y -= deltaX * this._rotateSpeed;
        this._cameraRotation.x = Math.max(
            -Math.PI / 2,
            Math.min(Math.PI / 2, this._cameraRotation.x - deltaY * this._rotateSpeed)
        );

        this._lastMouseX = e.canvasX;
        this._lastMouseY = e.canvasY;

        this.updateCamera();
    }

    handleWheel(e) {
        if (this._isRightMouseDown) {
            // 调整移动速度
            const factor = e.deltaY > 0 ? 1 / this._moveSpeedMultiplier : this._moveSpeedMultiplier;
            this._moveSpeed = Math.max(
                this._minMoveSpeed,
                Math.min(this._maxMoveSpeed, this._moveSpeed * factor)
            );
            
            // 标记需要更新UI
            this._needUpdateUI = true;
        } else {
            // 缩放相机距离
            const zoomSpeed = 0.001;
            const forward = new THREE.Vector3(0, 0, -1).applyEuler(this._cameraRotation);
            this._cameraPosition.addScaledVector(forward, e.deltaY * zoomSpeed);
            this.updateCamera();
        }
        e.preventDefault();
    }

    // 键盘事件处理
    handleKeyDown(e) {
        // 移除对右键状态的检查，改为检查是否在Canvas上
        if (document.activeElement === e.target) {
            this._activeKeys.add(e.code);
            e.preventDefault();
        }
    }

    handleKeyUp(e) {
        this._activeKeys.delete(e.code);
        e.preventDefault();
    }

    // 更新相机位置和旋转
    updateCamera() {
        if (!this.sceneRenderer) return;

        const camera = this.sceneRenderer._MainCamera;
        if (!camera) return;

        // 更新相机位置和旋转
        camera.position.copy(this._cameraPosition);
        camera.rotation.copy(this._cameraRotation);
        camera.updateMatrixWorld();

        // 标记需要更新UI
        this._needUpdateUI = true;
    }

    // 更新UI显示
    updateUI() {
        if (!this._needUpdateUI || !this._detailBuilder) return;

        // 位置保留3位小数
        this._detailBuilder.updateProperty('Camera.Position', [
            Number(this._cameraPosition.x.toFixed(3)),
            Number(this._cameraPosition.y.toFixed(3)),
            Number(this._cameraPosition.z.toFixed(3))
        ]);

        // 旋转角度转换为度数并规范化到 -180 到 180 度范围
        const normalizeAngle = (angle) => {
            // 将弧度转换为度数
            let degrees = angle * 180 / Math.PI;
            // 规范化到 -180 到 180 度范围
            while (degrees > 180) degrees -= 360;
            while (degrees < -180) degrees += 360;
            return Number(degrees.toFixed(2));
        };

        this._detailBuilder.updateProperty('Camera.Rotation', [
            normalizeAngle(this._cameraRotation.x),
            normalizeAngle(this._cameraRotation.y),
            normalizeAngle(this._cameraRotation.z)
        ]);

        // 移动速度保留3位小数
        this._detailBuilder.updateProperty('Camera.MoveSpeed', 
            Number(this._moveSpeed.toFixed(3))
        );

        this._needUpdateUI = false;
    }

    // 处理键盘移动
    processKeyboardInput() {
        if (!this._activeKeys.size) return;

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(this._cameraRotation);
        const right = new THREE.Vector3(1, 0, 0).applyEuler(this._cameraRotation);
        
        // WASD移动只在右键按下时生效
        if (this._isRightMouseDown) {
            if (this._activeKeys.has('KeyW')) this._cameraPosition.addScaledVector(forward, this._moveSpeed);
            if (this._activeKeys.has('KeyS')) this._cameraPosition.addScaledVector(forward, -this._moveSpeed);
            if (this._activeKeys.has('KeyA')) this._cameraPosition.addScaledVector(right, -this._moveSpeed);
            if (this._activeKeys.has('KeyD')) this._cameraPosition.addScaledVector(right, this._moveSpeed);
        }
        
        // QE上下移动始终生效
        if (this._activeKeys.has('KeyQ')) this._cameraPosition.y -= this._moveSpeed;
        if (this._activeKeys.has('KeyE')) this._cameraPosition.y += this._moveSpeed;

        this.updateCamera();
    }

    handleResize(width, height) {
        this.sceneRenderer?.OnCanvasResize(width, height);
    }

    handleCanvasReady(canvas) {
        this.sceneRenderer?.OnCanvasReady(canvas);
    }

    Update(DeltaTime) {
        this.processKeyboardInput();
        this.updateUI(); // 更新UI显示
        this.sceneRenderer?.Render(DeltaTime);
    }

    async Shutdown() {
        await this.sceneRenderer?.Destroy();
    }
}

export default RendererModule;
