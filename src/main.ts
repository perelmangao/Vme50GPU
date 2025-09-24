import { AutonomousRendererEngine } from '@engine/autonomous-renderer';
import { MockRemoteStream } from '@engine/mock-stream';

async function bootstrap() {
  const canvas = document.getElementById('viewport') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Viewport canvas not found');
  }

  const engine = new AutonomousRendererEngine(canvas, {
    pointCloudCapacity: 48000,
    pointSize: 2.8,
    followCameraDistance: 26,
    followCameraHeight: 16,
  });

  await engine.initialize();
  engine.start();

  const mockStream = new MockRemoteStream(engine, 32000);
  mockStream.start();

  if (import.meta.env.DEV) {
    Object.assign(window, { engine, mockStream });
  }
}

bootstrap().catch((error) => {
  console.error(error);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<div style="padding:1rem;color:#ff8181;">${error}</div>`;
  }
});
