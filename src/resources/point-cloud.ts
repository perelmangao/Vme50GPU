import { Renderer, createUniformBuffer } from '@core/renderer';
import { mat4, vec3 } from '@utils/mat';
import { PointCloudRenderable } from '@scene/types';

export interface PointCloudOptions {
  id?: string;
  maxPoints: number;
  pointSize?: number;
  baseColor?: vec3;
  transform?: mat4;
}

const POINT_STRIDE = 4 * 4; // xyz + intensity

export class PointCloudResource {
  public readonly renderable: PointCloudRenderable;
  private readonly device: GPUDevice;
  private readonly vertexBuffer: GPUBuffer;
  private readonly capacity: number;

  constructor(device: GPUDevice, renderer: Renderer, options: PointCloudOptions) {
    this.device = device;
    this.capacity = options.maxPoints;
    this.vertexBuffer = device.createBuffer({
      size: this.capacity * POINT_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const { buffer, data, matrix, color } = createUniformBuffer(device);
    const transform = options.transform ?? mat4.create();
    if (!options.transform) {
      mat4.identity(transform);
    }
    matrix.set(transform);

    const baseColor: vec3 = options.baseColor ?? [0.6, 0.8, 1.0];
    const size = options.pointSize ?? 3.0;
    color.set([...baseColor, size]);

    device.queue.writeBuffer(buffer, 0, data.buffer, 0, data.byteLength);
    const bindGroup = renderer.createModelBindGroup(buffer);

    this.renderable = {
      id: options.id,
      kind: 'point-cloud',
      vertexBuffer: this.vertexBuffer,
      vertexCount: 0,
      modelBuffer: buffer,
      bindGroup,
      uniformData: data,
      uniformMatrix: matrix,
      uniformColor: color,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      marked: false,
    };
  }

  update(points: Float32Array) {
    const pointCount = points.length / 4;
    if (pointCount > this.capacity) {
      throw new Error(`Point cloud capacity exceeded: ${pointCount} > ${this.capacity}`);
    }
    this.device.queue.writeBuffer(this.vertexBuffer, 0, points.buffer, points.byteOffset, points.byteLength);
    this.renderable.vertexCount = pointCount;
  }

  setTransform(transform: mat4) {
    this.renderable.uniformMatrix.set(transform);
    this.renderable.marked = true;
  }

  setBaseColor(color: vec3, pointSize?: number) {
    this.renderable.uniformColor.set([...color, pointSize ?? this.renderable.uniformColor[3]]);
    this.renderable.marked = true;
  }
}
