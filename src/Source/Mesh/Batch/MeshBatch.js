import * as THREE from 'three';
import FResourceManager from '../../Core/Resource/FResourceManager';
import FStaticMesh from '../StaticMesh';

/**
 * 可利用同一条渲染管线渲染的网格集合
 */
class MeshBatch{

    /**
     * 网格
     * @type {FStaticMesh[]}
     * @public
     */
    MeshList = [];

    /**
     * 构造函数
     * @param {string} pipelineName 渲染管线名称
     */
    constructor(pipelineName){
        this._PipelineName = pipelineName;
    }

    /**
     * 是否相等
     * @param {MeshBatch} MeshBatch 其他meshbatch
     * @returns {boolean} 是否相等
     */
    IsEqual(MeshBatch){
        return this._PipelineName === MeshBatch._PipelineName;
    }

    /**
     * 网格体
     * @param {FStaticMesh}
     */
    AddMesh(StaticMesh){
        if()
    }

    /**
     * 判断网格体是否是该类别
     * @param {FStaticMesh} StaticMesh 
     * @returns {boolean} 是否相等
     */
    #IsMeshFamily(StaticMesh){
        let bFamily
    }
}

export default MeshBatch;
