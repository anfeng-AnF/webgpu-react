/* global GPUTextureUsage, GPUBufferUsage */
import FModuleManager from './Source/Core/FModuleManager';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPBRMaterial } from './Source/Material/Mat_Instance/PBR.js';
import FResourceManager from './Source/Core/Resource/FResourceManager.js';
import GPUScene from './Source/Scene/GPUScene.js';
import StaticMesh from './Source/Object3D/Mesh/StaticMesh.js';
import BlenderSceneLoaderFbx from './Source/Scene/SceneLoader/BlenderSceneLoaderFbx.js';
import Scene from './Source/Scene/UI/Scene';
import Filter from './Source/Scene/UI/Object/Filter';
import SceneStaticMesh from './Source/Scene/UI/Object/SceneStaticMesh';
import DirectionalLight from './Source/Scene/UI/Object/DirectionalLight';
import PointLight from './Source/Scene/UI/Object/PointLight';

class Main {
    static ModuleManager = null;
    static backgroundMusic = null;
    static audioContext = null;
    static audioSource = null;
    static audioBuffer = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();
            
            // 初始化音频系统
            //await Main.initAudioSystem();
            
        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
    
    /**
     * 初始化音频系统
     */
    static async initAudioSystem() {
        try {
            // 检查浏览器是否支持 Web Audio API
            if (!window.AudioContext && !window.webkitAudioContext) {
                console.warn('当前浏览器不支持 Web Audio API，无法播放背景音乐');
                return;
            }
            
            // 创建音频上下文
            Main.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // 使用正确的文件路径
            const audioFile = '/Content/BGM/HOYO-MiX-使一颗心免于哀伤（伴奏）.mp3';
            
            console.log('加载 MP3 格式背景音乐:', audioFile);
            
            try {
                // 尝试使用 HTML5 Audio 元素作为备选方案
                Main.backgroundMusic = new Audio(audioFile);
                Main.backgroundMusic.loop = true;
                Main.backgroundMusic.volume = 0.3;
                
                // 添加加载事件监听器
                Main.backgroundMusic.addEventListener('canplaythrough', () => {
                    console.log('背景音乐加载成功（HTML5 Audio），等待用户交互后播放');
                    document.addEventListener('click', Main.playBackgroundMusicHTML5, { once: true });
                    document.addEventListener('keydown', Main.playBackgroundMusicHTML5, { once: true });
                });
                
                // 添加错误事件监听器
                Main.backgroundMusic.addEventListener('error', async (e) => {
                    console.warn('HTML5 Audio 加载失败，尝试使用 Web Audio API:', e);
                    
                    try {
                        // 加载音频文件
                        const response = await fetch(audioFile);
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        
                        const arrayBuffer = await response.arrayBuffer();
                        
                        // 解码音频数据
                        Main.audioBuffer = await Main.audioContext.decodeAudioData(arrayBuffer);
                        
                        console.log('背景音乐加载成功（Web Audio API），等待用户交互后播放');
                        
                        // 添加用户交互事件监听器
                        document.addEventListener('click', Main.playBackgroundMusic, { once: true });
                        document.addEventListener('keydown', Main.playBackgroundMusic, { once: true });
                        
                    } catch (error) {
                        console.error('Web Audio API 音频加载失败:', error);
                        console.warn('背景音乐将不会播放');
                    }
                });
                
                // 开始加载
                Main.backgroundMusic.load();
                
            } catch (error) {
                console.error('音频初始化失败:', error);
                console.warn('背景音乐将不会播放');
            }
        } catch (error) {
            console.error('音频系统初始化失败:', error);
        }
    }
    
    /**
     * 使用 HTML5 Audio 播放背景音乐
     */
    static playBackgroundMusicHTML5() {
        if (Main.backgroundMusic) {
            Main.backgroundMusic.play()
                .then(() => {
                    console.log('背景音乐开始播放（HTML5 Audio）');
                })
                .catch(error => {
                    console.error('背景音乐播放失败（HTML5 Audio）:', error);
                    // 如果 HTML5 Audio 播放失败，尝试使用 Web Audio API
                    if (Main.audioBuffer) {
                        Main.playBackgroundMusic();
                    }
                });
        }
    }
    
    /**
     * 使用 Web Audio API 播放背景音乐
     */
    static playBackgroundMusic() {
        // 如果音频上下文被暂停（浏览器策略），恢复它
        if (Main.audioContext && Main.audioContext.state === 'suspended') {
            Main.audioContext.resume();
        }
        
        // 如果音频未初始化或已经在播放，返回
        if (!Main.audioBuffer || Main.audioSource) {
            return;
        }
        
        try {
            // 创建音频源
            Main.audioSource = Main.audioContext.createBufferSource();
            Main.audioSource.buffer = Main.audioBuffer;
            
            // 设置循环播放
            Main.audioSource.loop = true;
            
            // 创建音量控制
            const gainNode = Main.audioContext.createGain();
            gainNode.gain.value = 0.3; // 设置音量 (0.0 到 1.0)
            
            // 连接节点
            Main.audioSource.connect(gainNode);
            gainNode.connect(Main.audioContext.destination);
            
            // 开始播放
            Main.audioSource.start(0);
            
            console.log('背景音乐开始播放（Web Audio API）');
        } catch (error) {
            console.error('背景音乐播放失败（Web Audio API）:', error);
            Main.audioSource = null;
        }
    }
    
    /**
     * 暂停背景音乐
     */
    static pauseBackgroundMusic() {
        // 尝试暂停 HTML5 Audio
        if (Main.backgroundMusic) {
            Main.backgroundMusic.pause();
            console.log('背景音乐已暂停（HTML5 Audio）');
        }
        
        // 尝试暂停 Web Audio API
        if (Main.audioSource) {
            Main.audioSource.stop();
            Main.audioSource = null;
            console.log('背景音乐已暂停（Web Audio API）');
        }
    }
    
    /**
     * 调整背景音乐音量
     * @param {number} volume - 音量值 (0.0 到 1.0)
     */
    static setBackgroundMusicVolume(volume) {
        volume = Math.max(0, Math.min(1, volume));
        
        // 调整 HTML5 Audio 音量
        if (Main.backgroundMusic) {
            Main.backgroundMusic.volume = volume;
        }
        
        // 调整 Web Audio API 音量
        if (Main.audioContext && Main.audioSource) {
            const gainNode = Main.audioContext.createGain();
            gainNode.gain.value = volume;
            
            Main.audioSource.disconnect();
            Main.audioSource.connect(gainNode);
            gainNode.connect(Main.audioContext.destination);
        }
        
        console.log(`背景音乐音量已设置为: ${volume}`);
    }
}

export default Main;
