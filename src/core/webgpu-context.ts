export interface WebGPUContextOptions {
  canvas: HTMLCanvasElement;
  requiredFeatures?: GPUFeatureName[];
}

export class WebGPUContext {
  public readonly canvas: HTMLCanvasElement;
  public device!: GPUDevice;
  public format!: GPUTextureFormat;
  public context!: GPUCanvasContext;
  public presentationSize!: [number, number];

  constructor(private readonly options: WebGPUContextOptions) {
    this.canvas = options.canvas;
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser.');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });

    if (!adapter) {
      throw new Error('Unable to acquire GPU adapter.');
    }

    this.device = await adapter.requestDevice({
      requiredFeatures: this.options.requiredFeatures,
    });

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.configure();
    window.addEventListener('resize', () => this.configure());
  }

  configure() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = Math.floor(this.canvas.clientWidth * devicePixelRatio);
    const height = Math.floor(this.canvas.clientHeight * devicePixelRatio);
    if (width === 0 || height === 0) {
      return;
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.presentationSize = [width, height];

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });
  }

  createView(): GPUTextureView {
    const texture = this.context.getCurrentTexture();
    return texture.createView();
  }
}
