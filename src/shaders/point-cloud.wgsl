struct FrameUniforms {
  viewProj : mat4x4<f32>;
  eyePosition : vec4<f32>;
  sunDirection : vec4<f32>;
  sunColor : vec4<f32>;
  ambientColor : vec4<f32>;
  time : vec4<f32>;
};

struct ModelUniforms {
  model : mat4x4<f32>;
  color : vec4<f32>;
};

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(1) @binding(0) var<uniform> model : ModelUniforms;

struct VertexInput {
  @location(0) position : vec3<f32>;
  @location(1) intensity : f32;
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>;
  @location(0) intensity : f32;
  @builtin(point_size) pointSize : f32;
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let worldPosition = model.model * vec4<f32>(input.position, 1.0);
  output.position = frame.viewProj * worldPosition;
  output.intensity = input.intensity;
  output.pointSize = model.color.w;
  return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
  let normalized = clamp(input.intensity, 0.0, 1.0);
  let colorRampLow = vec3<f32>(0.05, 0.2, 0.45);
  let color = mix(colorRampLow, model.color.rgb, normalized);
  let alpha = clamp(normalized * 1.2, 0.05, 1.0);
  return vec4<f32>(color, alpha);
}
