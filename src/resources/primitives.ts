import { Renderer, createUniformBuffer } from '@core/renderer';
import { mat4, vec3 } from '@utils/mat';
import { MeshRenderable } from '@scene/types';

interface MeshDefinition {
  vertices: Float32Array;
  indices: Uint32Array;
}

function createBuffer(device: GPUDevice, data: BufferSource, usage: GPUBufferUsageFlags): GPUBuffer {
  const buffer = device.createBuffer({
    size: (data.byteLength + 3) & ~3,
    usage: usage | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

function buildMesh(vertices: number[], indices: number[]): MeshDefinition {
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

function initializeUniform(transform: mat4, color: vec3, device: GPUDevice, renderer: Renderer) {
  const { buffer, data, matrix, color: colorView } = createUniformBuffer(device);
  matrix.set(transform);
  colorView.set([...color, 1]);
  device.queue.writeBuffer(buffer, 0, data.buffer, 0, data.byteLength);
  const bindGroup = renderer.createModelBindGroup(buffer);
  return { buffer, data, matrix, color: colorView, bindGroup };
}

export function createRoadSurface(device: GPUDevice, renderer: Renderer): MeshRenderable {
  const roadWidth = 8;
  const roadLength = 200;
  const vertices = [
    -roadWidth, 0, -roadLength, 0, 1, 0, 0, 0,
    roadWidth, 0, -roadLength, 0, 1, 0, 1, 0,
    roadWidth, 0, roadLength, 0, 1, 0, 1, 1,
    -roadWidth, 0, roadLength, 0, 1, 0, 0, 1,
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  return createStaticRenderable(device, renderer, buildMesh(vertices, indices), [0, -0.01, 0], [0.1, 0.1, 0.12]);
}

export function createGroundPlane(device: GPUDevice, renderer: Renderer): MeshRenderable {
  const size = 200;
  const vertices = [
    -size, -0.02, -size, 0, 1, 0, 0, 0,
    size, -0.02, -size, 0, 1, 0, 1, 0,
    size, -0.02, size, 0, 1, 0, 1, 1,
    -size, -0.02, size, 0, 1, 0, 0, 1,
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  return createStaticRenderable(device, renderer, buildMesh(vertices, indices), [0, 0, 0], [0.05, 0.08, 0.05]);
}

export function createLaneMarkings(device: GPUDevice, renderer: Renderer): MeshRenderable {
  const stripeWidth = 0.2;
  const stripeLength = 4;
  const gap = 2;
  const count = 40;
  const vertices: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  for (let i = 0; i < count; i++) {
    const zStart = -i * (stripeLength + gap);
    const zEnd = zStart - stripeLength;
    const positions: [number, number, number][] = [
      [-stripeWidth, 0.01, zStart],
      [0, 0.01, zStart],
      [0, 0.01, zEnd],
      [-stripeWidth, 0.01, zEnd],
      [0, 0.01, zStart],
      [stripeWidth, 0.01, zStart],
      [stripeWidth, 0.01, zEnd],
      [0, 0.01, zEnd],
    ];
    for (const [x, y, z] of positions) {
      vertices.push(x, y, z, 0, 1, 0, 0.5 + x, 0.5 + z);
    }
    indices.push(
      vertexOffset,
      vertexOffset + 1,
      vertexOffset + 2,
      vertexOffset,
      vertexOffset + 2,
      vertexOffset + 3,
      vertexOffset + 4,
      vertexOffset + 5,
      vertexOffset + 6,
      vertexOffset + 4,
      vertexOffset + 6,
      vertexOffset + 7,
    );
    vertexOffset += 8;
  }
  return createStaticRenderable(device, renderer, buildMesh(vertices, indices), [0, 0, 0], [0.92, 0.9, 0.6]);
}

export function createVehicle(
  device: GPUDevice,
  renderer: Renderer,
  position: vec3,
  color: vec3,
  dimensions: vec3 = [4.5, 1.6, 2],
): MeshRenderable {
  const [length, height, width] = [dimensions[0], dimensions[1], dimensions[2]];
  const vertices = [
    -width / 2, 0, -length / 2, 0, 1, 0, 0, 0,
    width / 2, 0, -length / 2, 0, 1, 0, 1, 0,
    width / 2, 0, length / 2, 0, 1, 0, 1, 1,
    -width / 2, 0, length / 2, 0, 1, 0, 0, 1,
    -width / 2, height, -length / 2, 0, 1, 0, 0, 0,
    width / 2, height, -length / 2, 0, 1, 0, 1, 0,
    width / 2, height, length / 2, 0, 1, 0, 1, 1,
    -width / 2, height, length / 2, 0, 1, 0, 0, 1,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  return createStaticRenderable(device, renderer, buildMesh(vertices, indices), position, color);
}

function createStaticRenderable(
  device: GPUDevice,
  renderer: Renderer,
  mesh: MeshDefinition,
  translation: vec3,
  color: vec3,
): MeshRenderable {
  const vertexBuffer = createBuffer(device, mesh.vertices, GPUBufferUsage.VERTEX);
  const indexBuffer = createBuffer(device, mesh.indices, GPUBufferUsage.INDEX);
  const transform = mat4.create();
  mat4.identity(transform);
  mat4.translate(transform, transform, translation);
  const uniform = initializeUniform(transform, color, device, renderer);
  return {
    kind: 'mesh',
    vertexBuffer,
    indexBuffer,
    indexCount: mesh.indices.length,
    modelBuffer: uniform.buffer,
    bindGroup: uniform.bindGroup,
    uniformData: uniform.data,
    uniformMatrix: uniform.matrix,
    uniformColor: uniform.color,
    marked: false,
  };
}
