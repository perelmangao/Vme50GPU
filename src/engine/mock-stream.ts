import { AutonomousRendererEngine } from './autonomous-renderer';
import { ObjectState, SensorFrame } from './types';

interface TrafficSeed {
  id: string;
  laneOffset: number;
  speed: number;
  color?: [number, number, number];
  type?: ObjectState['type'];
  dimensions?: [number, number, number];
  phase?: number;
}

export class MockRemoteStream {
  private timer?: number;
  private readonly seeds: TrafficSeed[] = [
    { id: 'car-a', laneOffset: -3, speed: 14, color: [0.8, 0.2, 0.25], type: 'vehicle' },
    { id: 'car-b', laneOffset: 3, speed: 10, color: [0.2, 0.7, 0.3], type: 'vehicle', phase: 20 },
    { id: 'truck-c', laneOffset: -9, speed: 8, color: [0.5, 0.5, 0.6], type: 'vehicle', dimensions: [8, 3, 3], phase: 40 },
    { id: 'pedestrian-d', laneOffset: 1.5, speed: 1.5, type: 'pedestrian', dimensions: [0.5, 1.8, 0.5], color: [0.9, 0.7, 0.1], phase: 5 },
  ];
  private readonly startTime = performance.now();

  constructor(private readonly engine: AutonomousRendererEngine, private readonly pointBudget = 24000) {}

  start() {
    this.stop();
    const tick = () => {
      const now = performance.now();
      const elapsed = (now - this.startTime) / 1000;
      this.engine.ingest(this.composeFrame(elapsed));
    };
    this.timer = window.setInterval(tick, 33);
  }

  stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private composeFrame(time: number): SensorFrame {
    const egoZ = time * 12;
    const egoHeading = Math.sin(time * 0.1) * 0.05;
    const egoPosition: [number, number, number] = [0, 0, egoZ];

    const objects: ObjectState[] = this.seeds.map((seed) => {
      const offset = seed.laneOffset;
      const z = egoZ - (time * seed.speed + (seed.phase ?? 0));
      const id = seed.id;
      const heading = seed.type === 'pedestrian' ? Math.PI : 0;
      return {
        id,
        position: [offset, 0, z] as [number, number, number],
        heading,
        dimensions: seed.dimensions,
        type: seed.type,
        color: seed.color,
      };
    });

    const pointCloud = this.generatePointCloud(time, egoPosition);

    return {
      timestamp: performance.now(),
      ego: {
        position: egoPosition,
        heading: egoHeading,
        dimensions: [4.5, 1.6, 2],
        color: [0.2, 0.6, 1.0],
      },
      objects,
      pointCloud,
      lighting: {
        sunDirection: [0.3, -1.0, 0.25],
        ambientColor: [0.12, 0.14, 0.18],
      },
    };
  }

  private generatePointCloud(time: number, origin: [number, number, number]): Float32Array {
    const pointCount = Math.min(this.pointBudget, 20000);
    const data = new Float32Array(pointCount * 4);
    const radius = 25;
    for (let i = 0; i < pointCount; i++) {
      const angle = ((i / pointCount) * Math.PI * 2 + time * 0.2) % (Math.PI * 2);
      const distance = radius * Math.sqrt((i % pointCount) / pointCount);
      const x = origin[0] + Math.cos(angle) * distance + Math.sin(time + i) * 0.5;
      const z = origin[2] + Math.sin(angle) * distance;
      const y = Math.sin(angle * 4 + time) * 0.6 + 0.3;
      const intensity = 0.4 + 0.6 * Math.random();
      const baseIndex = i * 4;
      data[baseIndex] = x;
      data[baseIndex + 1] = y;
      data[baseIndex + 2] = z;
      data[baseIndex + 3] = intensity;
    }
    return data;
  }
}
