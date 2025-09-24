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
  @location(1) normal : vec3<f32>;
  @location(2) uv : vec2<f32>;
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>;
  @location(0) worldPos : vec3<f32>;
  @location(1) normal : vec3<f32>;
  @location(2) uv : vec2<f32>;
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let worldPosition = model.model * vec4<f32>(input.position, 1.0);
  output.position = frame.viewProj * worldPosition;
  output.worldPos = worldPosition.xyz;
  output.normal = normalize((model.model * vec4<f32>(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  return output;
}

fn fresnelSchlick(cosTheta : f32, f0 : vec3<f32>) -> vec3<f32> {
  return f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - cosTheta, 5.0);
}

fn diffuseBRDF(albedo : vec3<f32>, ndl : f32) -> vec3<f32> {
  return albedo / 3.1415926 * ndl;
}

fn specularBRDF(ndl : f32, ndv : f32, h : vec3<f32>, n : vec3<f32>, v : vec3<f32>, roughness : f32, f0 : vec3<f32>) -> vec3<f32> {
  let alpha = roughness * roughness;
  let alpha2 = alpha * alpha;
  let ndh = max(dot(n, h), 0.0);
  let ndh2 = ndh * ndh;
  let denom = ndh2 * (alpha2 - 1.0) + 1.0;
  let d = alpha2 / (3.1415926 * denom * denom);
  let k = alpha / 2.0;
  let g = ndl / (ndl * (1.0 - k) + k) * ndv / (ndv * (1.0 - k) + k);
  let f = fresnelSchlick(max(dot(h, v), 0.0), f0);
  return d * g * f;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
  let normal = normalize(input.normal);
  let lightDir = normalize(-frame.sunDirection.xyz);
  let viewDir = normalize(frame.eyePosition.xyz - input.worldPos);
  let halfVector = normalize(lightDir + viewDir);
  let ndl = max(dot(normal, lightDir), 0.0);
  let ndv = max(dot(normal, viewDir), 0.0);
  let roughness = clamp(0.1 + input.uv.y * 0.2, 0.05, 0.9);
  let albedo = mix(model.color.rgb, vec3<f32>(0.18, 0.2, 0.22), clamp(input.uv.x * 0.5, 0.0, 1.0));
  let f0 = mix(vec3<f32>(0.04), albedo, 0.04);

  let diffuse = diffuseBRDF(albedo, ndl);
  let specular = specularBRDF(ndl, ndv, halfVector, normal, viewDir, roughness, f0);

  let sunContribution = (diffuse + specular) * frame.sunColor.rgb;
  let ambient = frame.ambientColor.rgb * (albedo * 0.4 + 0.2);
  let emissive = vec3<f32>(0.0, 0.0, 0.0);

  var color = sunContribution + ambient + emissive;
  color = pow(color, vec3<f32>(1.0 / 2.2));

  return vec4<f32>(color, 1.0);
}
