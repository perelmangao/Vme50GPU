export type RenderableKind = 'mesh' | 'point-cloud';

export interface BaseRenderable {
  id?: string;
  kind: RenderableKind;
  vertexBuffer: GPUBuffer;
  modelBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  uniformData: Float32Array;
  uniformMatrix: Float32Array;
  uniformColor: Float32Array;
  marked?: boolean;
}

export interface MeshRenderable extends BaseRenderable {
  kind: 'mesh';
  indexBuffer: GPUBuffer;
  indexCount: number;
}

export interface PointCloudRenderable extends BaseRenderable {
  kind: 'point-cloud';
  vertexCount: number;
  usage: GPUBufferUsageFlags;
}

export type Renderable = MeshRenderable | PointCloudRenderable;
