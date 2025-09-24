import { WebGPUContext } from './webgpu-context';
import { Scene } from '@scene/scene';
import shaderSource from '@shaders/pbr.wgsl?raw';
import pointCloudSource from '@shaders/point-cloud.wgsl?raw';
import { MeshRenderable, PointCloudRenderable, Renderable } from '@scene/types';

const FRAME_UNIFORM_SIZE = 256;
const MODEL_UNIFORM_SIZE = 256;

type PipelineKey = 'mesh' | 'point-cloud';

interface PipelineState {
  pipeline: GPURenderPipeline;
  vertexStride: number;
}

export class Renderer {
  private pipelines = new Map<PipelineKey, PipelineState>();
  private depthTexture!: GPUTexture;
  private depthView!: GPUTextureView;
  private frameUniformBuffer!: GPUBuffer;
  private frameBindGroup!: GPUBindGroup;
  private frameUniformData!: Float32Array;
  private frameBindGroupLayout!: GPUBindGroupLayout;
  private modelBindGroupLayout!: GPUBindGroupLayout;
  private startTime = performance.now();

  constructor(private readonly context: WebGPUContext) {}

  async initialize(scene: Scene) {
    const { device, presentationSize } = this.context;

    this.createDepthResources();

    this.frameUniformData = new Float32Array(FRAME_UNIFORM_SIZE / 4);

    this.frameBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    this.modelBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.frameBindGroupLayout, this.modelBindGroupLayout],
    });

    this.pipelines.set('mesh', this.createMeshPipeline(device, pipelineLayout));

    this.frameUniformBuffer = device.createBuffer({
      size: FRAME_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.frameBindGroup = device.createBindGroup({
      layout: this.frameBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.frameUniformBuffer },
        },
      ],
    });

    scene.camera.updateProjection(presentationSize[0] / presentationSize[1]);
    scene.camera.updateView();
  }

  private ensurePipeline(key: PipelineKey): PipelineState {
    const existing = this.pipelines.get(key);
    if (existing) {
      return existing;
    }
    const pipelineLayout = this.context.device.createPipelineLayout({
      bindGroupLayouts: [this.frameBindGroupLayout, this.modelBindGroupLayout],
    });
    const created =
      key === 'mesh'
        ? this.createMeshPipeline(this.context.device, pipelineLayout)
        : this.createPointCloudPipeline(this.context.device, pipelineLayout);
    this.pipelines.set(key, created);
    return created;
  }

  private createMeshPipeline(device: GPUDevice, layout: GPUPipelineLayout): PipelineState {
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 8 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 3 * 4, format: 'float32x3' },
              { shaderLocation: 2, offset: 6 * 4, format: 'float32x2' },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.context.format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });
    return { pipeline, vertexStride: 8 * 4 };
  }

  private createPointCloudPipeline(device: GPUDevice, layout: GPUPipelineLayout): PipelineState {
    const shaderModule = device.createShaderModule({ code: pointCloudSource });
    const pipeline = device.createRenderPipeline({
      layout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 4 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 3 * 4, format: 'float32' },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: this.context.format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: {
        topology: 'point-list',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
        format: 'depth24plus',
      },
    });
    return { pipeline, vertexStride: 4 * 4 };
  }

  createModelBindGroup(buffer: GPUBuffer): GPUBindGroup {
    return this.context.device.createBindGroup({
      layout: this.modelBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer },
        },
      ],
    });
  }

  resize() {
    this.createDepthResources();
  }

  private createDepthResources() {
    const { device, presentationSize } = this.context;
    this.depthTexture?.destroy();
    this.depthTexture = device.createTexture({
      size: { width: presentationSize[0], height: presentationSize[1], depthOrArrayLayers: 1 },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = this.depthTexture.createView();
  }

  private updateFrameUniforms(scene: Scene) {
    const now = performance.now();
    const timeSeconds = (now - this.startTime) / 1000;
    const viewProj = scene.camera.getViewProjectionMatrix();

    this.frameUniformData.set(viewProj, 0);
    this.frameUniformData.set([...scene.camera.position, 1], 16);
    this.frameUniformData.set(scene.lighting.sunDirection, 20);
    this.frameUniformData.set(scene.lighting.sunColor, 24);
    this.frameUniformData.set(scene.lighting.ambientColor, 28);
    this.frameUniformData[32] = timeSeconds;
  }

  private flushRenderableUniforms(device: GPUDevice, renderable: Renderable) {
    if (!renderable.marked) return;
    device.queue.writeBuffer(renderable.modelBuffer, 0, renderable.uniformData.buffer, 0, MODEL_UNIFORM_SIZE);
    renderable.marked = false;
  }

  render(scene: Scene) {
    const { device } = this.context;

    scene.camera.updateView();
    this.updateFrameUniforms(scene);

    device.queue.writeBuffer(this.frameUniformBuffer, 0, this.frameUniformData.buffer, 0, FRAME_UNIFORM_SIZE);

    const commandEncoder = device.createCommandEncoder();
    const textureView = this.context.createView();

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.01, g: 0.02, b: 0.05, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthLoadOp: 'clear',
        depthClearValue: 1,
        depthStoreOp: 'store',
      },
    });

    passEncoder.setBindGroup(0, this.frameBindGroup);

    const meshRenderables: MeshRenderable[] = [];
    const pointRenderables: PointCloudRenderable[] = [];

    for (const renderable of scene.renderables) {
      if (renderable.kind === 'mesh') {
        meshRenderables.push(renderable);
      } else if (renderable.kind === 'point-cloud') {
        pointRenderables.push(renderable);
      }
    }

    if (meshRenderables.length > 0) {
      const pipeline = this.ensurePipeline('mesh');
      passEncoder.setPipeline(pipeline.pipeline);
      for (const renderable of meshRenderables) {
        this.flushRenderableUniforms(device, renderable);
        passEncoder.setBindGroup(1, renderable.bindGroup);
        passEncoder.setVertexBuffer(0, renderable.vertexBuffer);
        passEncoder.setIndexBuffer(renderable.indexBuffer, 'uint32');
        passEncoder.drawIndexed(renderable.indexCount, 1, 0, 0, 0);
      }
    }

    if (pointRenderables.length > 0) {
      const pipeline = this.ensurePipeline('point-cloud');
      passEncoder.setPipeline(pipeline.pipeline);
      for (const renderable of pointRenderables) {
        this.flushRenderableUniforms(device, renderable);
        passEncoder.setBindGroup(1, renderable.bindGroup);
        passEncoder.setVertexBuffer(0, renderable.vertexBuffer);
        passEncoder.draw(renderable.vertexCount, 1, 0, 0);
      }
    }

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);
  }
}

export function createUniformBuffer(device: GPUDevice): {
  buffer: GPUBuffer;
  data: Float32Array;
  matrix: Float32Array;
  color: Float32Array;
} {
  const data = new Float32Array(MODEL_UNIFORM_SIZE / 4);
  const buffer = device.createBuffer({
    size: MODEL_UNIFORM_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  return { buffer, data, matrix: data.subarray(0, 16), color: data.subarray(16, 20) };
}
