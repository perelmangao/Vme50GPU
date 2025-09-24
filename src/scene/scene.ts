import { PerspectiveCamera } from '@core/camera';
import { Renderable } from './types';

export interface LightingState {
  sunDirection: Float32Array;
  sunColor: Float32Array;
  ambientColor: Float32Array;
}

export class Scene {
  public readonly renderables: Renderable[] = [];
  public readonly camera = new PerspectiveCamera();
  public lighting: LightingState = {
    sunDirection: new Float32Array([0.25, -1.0, 0.5, 0]),
    sunColor: new Float32Array([1.0, 0.98, 0.92, 0]),
    ambientColor: new Float32Array([0.1, 0.12, 0.15, 0]),
  };

  private renderableIndex = new Map<string, Renderable>();

  add(renderable: Renderable, id?: string) {
    if (id) {
      renderable.id = id;
      this.renderableIndex.set(id, renderable);
    }
    this.renderables.push(renderable);
  }

  upsert(id: string, create: () => Renderable, update: (renderable: Renderable) => void) {
    const existing = this.renderableIndex.get(id);
    if (existing) {
      update(existing);
      return existing;
    }
    const renderable = create();
    renderable.id = id;
    this.renderableIndex.set(id, renderable);
    this.renderables.push(renderable);
    update(renderable);
    return renderable;
  }

  remove(id: string) {
    const existing = this.renderableIndex.get(id);
    if (!existing) return;
    this.renderableIndex.delete(id);
    const index = this.renderables.indexOf(existing);
    if (index !== -1) {
      this.renderables.splice(index, 1);
    }
  }
}
