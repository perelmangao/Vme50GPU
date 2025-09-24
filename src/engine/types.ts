import type { vec3 } from '@utils/mat';

export interface PoseState {
  position: vec3;
  heading: number;
  dimensions?: vec3;
  color?: vec3;
}

export interface ObjectState extends PoseState {
  id: string;
  type?: 'vehicle' | 'pedestrian' | 'cyclist' | 'static' | 'unknown';
}

export interface LightingOverride {
  sunDirection?: vec3;
  sunColor?: vec3;
  ambientColor?: vec3;
}

export interface SensorFrame {
  timestamp: number;
  ego: PoseState;
  objects: ObjectState[];
  pointCloud?: Float32Array;
  lighting?: LightingOverride;
}

export interface EngineOptions {
  pointCloudCapacity?: number;
  pointSize?: number;
  pointBaseColor?: vec3;
  followCameraDistance?: number;
  followCameraHeight?: number;
}
