import { WebGPUContext } from '@core/webgpu-context';
import { Renderer } from '@core/renderer';
import { Scene } from '@scene/scene';
import { MeshRenderable } from '@scene/types';
import { createGroundPlane, createLaneMarkings, createRoadSurface, createVehicle } from '@resources/primitives';
import { PointCloudResource } from '@resources/point-cloud';
import { mat4, vec3 } from '@utils/mat';
import { EngineOptions, ObjectState, PoseState, SensorFrame } from './types';

export class AutonomousRendererEngine {
  private context!: WebGPUContext;
  private renderer!: Renderer;
  private scene = new Scene();
  private animationHandle = 0;
  private initialized = false;
  private latestFrame?: SensorFrame;
  private frameDirty = false;

  private egoRenderable!: MeshRenderable;
  private dynamicObjects = new Map<string, MeshRenderable>();
  private pointCloud?: PointCloudResource;

  private readonly handleResize = () => {
    if (!this.initialized) return;
    this.context.configure();
    this.renderer.resize();
    this.scene.camera.updateProjection(this.context.presentationSize[0] / this.context.presentationSize[1]);
  };

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: EngineOptions = {}) {}

  async initialize() {
    this.context = new WebGPUContext({ canvas: this.canvas });
    await this.context.initialize();

    this.renderer = new Renderer(this.context);
    await this.renderer.initialize(this.scene);

    const ground = createGroundPlane(this.context.device, this.renderer);
    const road = createRoadSurface(this.context.device, this.renderer);
    const laneMarkings = createLaneMarkings(this.context.device, this.renderer);

    this.scene.add(ground);
    this.scene.add(road);
    this.scene.add(laneMarkings);

    this.egoRenderable = createVehicle(this.context.device, this.renderer, [0, 0, 0], [0.2, 0.6, 1.0]);
    this.scene.add(this.egoRenderable, 'ego');

    if (this.options.pointCloudCapacity) {
      this.pointCloud = new PointCloudResource(this.context.device, this.renderer, {
        id: 'lidar-point-cloud',
        maxPoints: this.options.pointCloudCapacity,
        pointSize: this.options.pointSize,
        baseColor: this.options.pointBaseColor,
      });
      this.scene.add(this.pointCloud.renderable, 'lidar-point-cloud');
    }

    const followDistance = this.options.followCameraDistance ?? 24;
    const followHeight = this.options.followCameraHeight ?? 14;
    this.scene.camera.position = [0, followHeight, -followDistance];
    this.scene.camera.target = [0, 0, 20];
    this.scene.camera.updateProjection(this.context.presentationSize[0] / this.context.presentationSize[1]);

    window.addEventListener('resize', this.handleResize);
    this.initialized = true;
  }

  start() {
    if (!this.initialized) {
      throw new Error('Engine must be initialized before starting.');
    }
    const loop = () => {
      if (this.frameDirty && this.latestFrame) {
        this.applyFrame(this.latestFrame);
        this.frameDirty = false;
      }
      this.renderer.render(this.scene);
      this.animationHandle = requestAnimationFrame(loop);
    };
    this.animationHandle = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.animationHandle);
    window.removeEventListener('resize', this.handleResize);
    this.frameDirty = false;
    this.latestFrame = undefined;
    this.initialized = false;
  }

  ingest(frame: SensorFrame) {
    this.latestFrame = frame;
    this.frameDirty = true;
  }

  private applyFrame(frame: SensorFrame) {
    this.updateVehicleRenderable(this.egoRenderable, frame.ego);
    this.updateCamera(frame.ego);

    const activeIds = new Set<string>();
    for (const object of frame.objects) {
      activeIds.add(object.id);
      const baseColor = object.color ?? this.colorFromType(object.type);
      const renderable = this.scene.upsert(
        object.id,
        () => this.createObjectRenderable(object, baseColor),
        (existing) => this.updateVehicleRenderable(existing as MeshRenderable, object),
      ) as MeshRenderable;
      renderable.uniformColor.set([...baseColor, 1]);
      renderable.marked = true;
      this.dynamicObjects.set(object.id, renderable);
    }

    for (const [id, renderable] of this.dynamicObjects) {
      if (activeIds.has(id)) continue;
      this.scene.remove(id);
      renderable.vertexBuffer.destroy();
      renderable.indexBuffer.destroy();
      renderable.modelBuffer.destroy();
      this.dynamicObjects.delete(id);
    }

    if (frame.pointCloud && this.pointCloud) {
      this.pointCloud.update(frame.pointCloud);
    }

    if (frame.lighting) {
      this.applyLighting(frame.lighting);
    }
  }

  private applyLighting(override: SensorFrame['lighting']) {
    if (!override) return;
    if (override.sunDirection) {
      const sun = this.scene.lighting.sunDirection;
      sun[0] = override.sunDirection[0];
      sun[1] = override.sunDirection[1];
      sun[2] = override.sunDirection[2];
    }
    if (override.sunColor) {
      const color = this.scene.lighting.sunColor;
      color[0] = override.sunColor[0];
      color[1] = override.sunColor[1];
      color[2] = override.sunColor[2];
    }
    if (override.ambientColor) {
      const ambient = this.scene.lighting.ambientColor;
      ambient[0] = override.ambientColor[0];
      ambient[1] = override.ambientColor[1];
      ambient[2] = override.ambientColor[2];
    }
  }

  private createObjectRenderable(state: ObjectState, color: vec3): MeshRenderable {
    const renderable = createVehicle(this.context.device, this.renderer, [0, 0, 0], color, state.dimensions ?? [4.5, 1.6, 2]);
    renderable.uniformColor.set([...color, 1]);
    renderable.marked = true;
    return renderable;
  }

  private updateVehicleRenderable(renderable: MeshRenderable, pose: PoseState) {
    const matrix = renderable.uniformMatrix;
    mat4.identity(matrix);
    mat4.translate(matrix, matrix, pose.position);
    mat4.rotateY(matrix, matrix, pose.heading);
    if (pose.color) {
      renderable.uniformColor.set([...pose.color, 1]);
    }
    renderable.marked = true;
  }

  private updateCamera(pose: PoseState) {
    const followDistance = this.options.followCameraDistance ?? 24;
    const followHeight = this.options.followCameraHeight ?? 14;
    const forward: vec3 = [Math.sin(pose.heading), 0, Math.cos(pose.heading)];
    const target: vec3 = [pose.position[0] + forward[0] * 12, pose.position[1] + 2, pose.position[2] + forward[2] * 12];
    const cameraPosition: vec3 = [
      pose.position[0] - forward[0] * followDistance,
      pose.position[1] + followHeight,
      pose.position[2] - forward[2] * followDistance,
    ];
    this.scene.camera.target = target;
    this.scene.camera.position = cameraPosition;
  }

  private colorFromType(type: ObjectState['type']): vec3 {
    switch (type) {
      case 'pedestrian':
        return [0.95, 0.6, 0.2];
      case 'cyclist':
        return [0.2, 0.8, 0.9];
      case 'static':
        return [0.6, 0.6, 0.6];
      case 'vehicle':
        return [0.9, 0.2, 0.3];
      default:
        return [0.7, 0.7, 0.7];
    }
  }
}
