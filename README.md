# WebGPU Deferred Rendering

一个基于 WebGPU 的延迟渲染项目。

## 项目预览

- 操作界面
  ![](READMERESOURCE/OperationInterface.gif)

- 较为粗糙的金属材质
  ![](READMERESOURCE/Matel055A.png)

- 光滑金属球
  ![](READMERESOURCE/Metal034.png)  

- 《皱巴巴的锡箔纸》
  ![](READMERESOURCE/Foil.png)

- 石材
  ![](READMERESOURCE/Rock017.png)

- GBuffers
  ![](READMERESOURCE/BufferDisplay.gif)

- CSM Cascade Shadow Map
  ![](READMERESOURCE/ShowCSM.png)

- 几何体控制
  ![](READMERESOURCE/ObjectDisplay.gif)


## 开发环境准备

确保您的开发环境中已安装以下工具：

- Node.js (推荐 v14.0.0 或更高版本)
- npm (Node.js 包管理器)

## 项目启动

在项目目录下，您可以运行：

### `npm install`

安装项目所需的所有依赖包。

### `npm start`

启动开发服务器，运行应用程序。\
在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

当您修改代码时，页面将自动刷新。\
您也可以在控制台中查看任何代码错误。

### `npm run build`

将应用程序构建到 `build` 文件夹中，为生产环境做好准备。\
构建后的文件已经过优化，可以获得最佳性能。

## 项目内容简述

|——public
| |——Shader # 着色器文件
| | |——Common # 通用着色器
| | |——DeferredShading # 延迟渲染着色器
| | |——PostProcess # 后处理着色器
| | └──Shadow # 阴影相关着色器
|
|——src
| |——Source
| | |——UI # UI模块
| | | |——Components # UI组件
| | | |——Styles # UI样式
| | |——Material # 材质系统
| | |
| | |——Renderer # 渲染器模块
| | | └——DeferredShadingRenderer # 延迟渲染实现



