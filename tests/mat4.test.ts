import { describe, expect, it } from 'vitest';
import { mat4 } from '@utils/mat';

function expectMatrixClose(actual: Float32Array, expected: number[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i += 1) {
    expect(actual[i]).toBeCloseTo(expected[i], Math.abs(expected[i]) < 1 ? 6 : 5);
  }
}

describe('mat4', () => {
  it('creates an identity matrix by default', () => {
    const identity = mat4.create();
    expectMatrixClose(identity, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  });

  it('generates a perspective projection matrix', () => {
    const matrix = mat4.create();
    mat4.perspective(matrix, Math.PI / 2, 1, 0.1, 100);
    expectMatrixClose(matrix, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, -1.001001, -1,
      0, 0, -0.2002002, 0
    ]);
  });

  it('builds a view matrix looking at a target', () => {
    const matrix = mat4.create();
    mat4.lookAt(matrix, [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    expectMatrixClose(matrix, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, -5, 1
    ]);
  });

  it('applies translation without mutating the source matrix', () => {
    const source = mat4.create();
    const target = mat4.create();
    mat4.translate(target, source, [1, 2, 3]);

    expectMatrixClose(target, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      1, 2, 3, 1
    ]);
    expectMatrixClose(source, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  });

  it('scales and rotates around the Y axis', () => {
    const scaled = mat4.create();
    mat4.scale(scaled, scaled, [2, 3, 4]);
    expectMatrixClose(scaled, [
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      0, 0, 0, 1
    ]);

    const rotated = mat4.create();
    mat4.rotateY(rotated, mat4.create(), Math.PI / 2);
    expectMatrixClose(rotated, [
      0, 0, -1, 0,
      0, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 1
    ]);
  });
});
