import { mat4, vec3 } from '@utils/mat';

export class PerspectiveCamera {
  public position: vec3 = [0, 5, -10];
  public target: vec3 = [0, 0, 0];
  public up: vec3 = [0, 1, 0];
  public fov = (60 * Math.PI) / 180;
  public near = 0.1;
  public far = 1000;
  private projectionMatrix = mat4.create();
  private viewMatrix = mat4.create();
  private viewProjectionMatrix = mat4.create();

  updateProjection(aspect: number) {
    mat4.perspective(this.projectionMatrix, this.fov, aspect, this.near, this.far);
  }

  updateView() {
    mat4.lookAt(this.viewMatrix, this.position, this.target, this.up);
    mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);
  }

  getViewProjectionMatrix(): Float32Array {
    return this.viewProjectionMatrix;
  }
}
