# Vme50GPU

Vme50GPU 是一个面向自动驾驶远程辅助场景的 WebGPU 实时渲染引擎原型。项目采用 TypeScript + WGSL 实现，通过工程化封装支持对自车、感知目标、点云与光照的实时更新，目标是在浏览器侧呈现零延时、不卡顿的高可信度三维画面。

## 能力概览

- ⚙️ **多管线渲染核心**：基于统一帧常量缓存，实现网格与点云双渲染管线，支持深度缓冲与混合配置，所有 uniform buffer 均满足 256B 对齐以规避设备回退。
- 🧠 **流式场景同步**：`AutonomousRendererEngine` 封装 WebGPU 上下文、场景图与资源生命周期，暴露 `ingest(frame)` 接口用于接入远端传感器帧，可自动增删动态目标并回收 GPU 资源。
- 🌐 **点云高速写入**：内建 `PointCloudResource`，使用 COPY_DST 顶点缓冲快速灌入数万点激光雷达数据，并提供点大小 / 颜色参数化。
- 🛰️ **自适应相机与光照**：跟车相机根据自车朝向自动调整位置与关注点，支持每帧覆盖太阳、环境光参数，适配全天候渲染需求。
- 🧰 **可扩展资源库**：保留道路、车道线、车辆等基础 mesh 生成器，并对渲染统一缓冲进行抽象，便于后续加入 HD 地图补丁或更多语义实体。

## 快速开始

1. 安装依赖（需要 Node.js 18+）：
   ```bash
   npm install
   ```
2. 构建或启动开发服务器：
   ```bash
   npm run build
   # 或
   npm run dev
   ```
3. 浏览器访问 `http://localhost:4173`，确保使用支持 WebGPU 的浏览器版本（Chrome 113+ / Edge / Safari Tech Preview 等）。

> ⚠️ 当前容器环境无法联网，`npm install`/`npm run build` 需在本地开发环境执行。

## 核心模块

```text
src
├── core                # WebGPU 上下文、渲染器与 uniform 工具
├── engine              # AutonomousRendererEngine、传感器帧类型与模拟流
├── resources           # 几何体与点云资源封装
├── scene               # 场景节点管理与光照数据
├── shaders             # WGSL 着色器（PBR、Point Cloud）
└── utils               # 数学工具
```

### AutonomousRendererEngine

- `initialize()`：建立 WebGPU 上下文、静态几何体、可选点云缓冲。
- `start()/stop()`：内部维护 requestAnimationFrame 渲染循环，确保帧更新与渲染解耦。
- `ingest(frame)`：接收远端传感器帧，自动上屏自车、动态障碍、点云与光照数据。引擎内部使用 `Scene.upsert` 和脏标记刷新 uniform，避免多余写入。

### MockRemoteStream

提供一个无依赖的远程流模拟器，用于演示如何持续注入传感器数据。实际工程中可替换为 WebSocket、WebTransport 或共享内存通道，将 frame 直接传入 `ingest`。

## 后续扩展建议

- 引入 HD 地图分块与多级细节管理，在 `Scene` 上维护图层化渲染队列。
- 加入 GPU Driven Instance / Indirect Draw，支撑上万动态目标的批量更新。
- 结合 WebCodecs / WebRTC 将渲染输出与多模态传感器数据同步分发。
- 构建 Profiling 仪表盘，持续监控各渲染阶段耗时，实现在线调度与 QoS。

欢迎在此基础上继续演进，打造稳定、易用、可扩展的自动驾驶实时渲染平台。
