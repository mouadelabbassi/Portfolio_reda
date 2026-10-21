export const nodeVertex = /* glsl */ `
  attribute vec3 aNetwork;
  attribute vec3 aVehicle;
  attribute vec3 aSchematic;
  attribute vec3 aAccent;
  attribute float aSeed;
  attribute float aFocus;
  attribute float aSurface;
  uniform vec3 uWeights;
  uniform float uTime;
  uniform float uBoot;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vAccent;
  varying float vSeed;
  varying float vFocus;
  varying float vSurface;
  void main() {
    vec3 offset = aNetwork * uWeights.x + aVehicle * uWeights.y + aSchematic * uWeights.z;
    float reveal = smoothstep(aSeed * 0.58, aSeed * 0.58 + 0.32, uBoot);
    vec4 local = instanceMatrix * vec4(position * reveal, 1.0);
    local.xyz += offset;
    vec4 world = modelMatrix * local;
    vWorld = world.xyz;
    vLocal = position;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vAccent = aAccent;
    vSeed = aSeed;
    vFocus = aFocus;
    vSurface = aSurface;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const nodeFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uMotion;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vAccent;
  varying float vSeed;
  varying float vFocus;
  varying float vSurface;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorld);
    float light = max(0.0, dot(normal, normalize(vec3(-0.4, 0.85, 0.6))));
    float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.5);
    float top = smoothstep(0.6, 0.95, normal.y);
    vec2 coord = vLocal.xz;
    float lineX = 1.0 - smoothstep(0.025, 0.05, abs(fract(coord.x * 8.0 + 0.5) - 0.5));
    float lineZ = 1.0 - smoothstep(0.025, 0.05, abs(fract(coord.y * 8.0 + 0.5) - 0.5));
    float circuit = max(lineX, lineZ) * top * 0.11;
    float activity = 0.87 + sin(uTime * 1.4 + vSeed * 31.0) * 0.13 * uMotion;
    vec3 body = mix(vec3(0.021, 0.041, 0.042), vAccent * 0.17, 0.28 + light * 0.45);
    body += vAccent * (0.075 * light + 0.2 * rim + circuit) * activity;
    body += vAccent * vSurface * (0.22 + light * 0.48);
    float beacon = step(1.2, vSurface);
    body += vAccent * beacon * (0.18 + pow(max(0.0, sin(uTime * 2.4 + vSeed * 6.28)), 6.0) * 0.6 * uMotion);
    body += vAccent * max(0.0, vFocus - 0.5) * (0.23 + rim * 0.6);
    float visibility = mix(0.23, 1.0, min(vFocus + 0.35, 1.0));
    gl_FragColor = vec4(body * visibility, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const traceVertex = /* glsl */ `
  attribute vec3 aNetwork;
  attribute vec3 aVehicle;
  attribute vec3 aSchematic;
  attribute vec3 aPrevNetwork;
  attribute vec3 aPrevVehicle;
  attribute vec3 aPrevSchematic;
  attribute vec3 aNextNetwork;
  attribute vec3 aNextVehicle;
  attribute vec3 aNextSchematic;
  attribute vec3 aProgress;
  attribute vec3 aAccent;
  attribute float aSide;
  attribute float aSeed;
  attribute float aFocus;
  attribute float aWeight;
  uniform vec3 uWeights;
  uniform vec2 uResolution;
  uniform float uWidth;
  varying float vSide;
  varying float vProgress;
  varying vec3 vAccent;
  varying float vSeed;
  varying float vFocus;
  varying float vWeight;
  void main() {
    vec3 point = aNetwork * uWeights.x + aVehicle * uWeights.y + aSchematic * uWeights.z;
    vec3 previous = aPrevNetwork * uWeights.x + aPrevVehicle * uWeights.y + aPrevSchematic * uWeights.z;
    vec3 next = aNextNetwork * uWeights.x + aNextVehicle * uWeights.y + aNextSchematic * uWeights.z;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(point, 1.0);
    vec4 previousClip = projectionMatrix * modelViewMatrix * vec4(previous, 1.0);
    vec4 nextClip = projectionMatrix * modelViewMatrix * vec4(next, 1.0);
    vec2 direction = (nextClip.xy / nextClip.w - previousClip.xy / previousClip.w) * uResolution;
    direction = normalize(direction + vec2(0.0001));
    vec2 perpendicular = vec2(-direction.y, direction.x);
    clip.xy += perpendicular * aSide * uWidth * (0.8 + aFocus * 0.28) * (0.58 + aWeight * 0.67) / uResolution * clip.w;
    vSide = aSide;
    vProgress = dot(aProgress, uWeights);
    vAccent = aAccent;
    vSeed = aSeed;
    vFocus = aFocus;
    vWeight = aWeight;
    gl_Position = clip;
  }
`;

export const traceFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uMotion;
  uniform float uGlow;
  uniform float uBoot;
  varying float vSide;
  varying float vProgress;
  varying vec3 vAccent;
  varying float vSeed;
  varying float vFocus;
  varying float vWeight;
  void main() {
    float edge = 1.0 - smoothstep(0.24, 1.0, abs(vSide));
    float moving = fract(vProgress * 1.7 - uTime * (0.14 + vWeight * 0.06) + vSeed);
    float pulse = pow(max(0.0, 1.0 - moving * 8.0), 3.0) * uMotion;
    float light = (0.09 + vWeight * 0.07 + pulse * 0.8) * (0.25 + vFocus * 0.75);
    light += max(0.0, vFocus - 0.8) * 0.17;
    vec3 color = mix(vAccent, vec3(0.92, 1.0, 0.78), pulse * 0.65);
    float reveal = smoothstep(vSeed * 0.35 + 0.12, vSeed * 0.35 + 0.6, uBoot);
    gl_FragColor = vec4(color, edge * light * uGlow * reveal);
  }
`;

export const gridVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const gridFragment = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uWeights;
  void main() {
    vec2 coord = vWorld.xz;
    vec2 grid = abs(fract(coord * 0.5 - 0.5) - 0.5) / fwidth(coord * 0.5);
    float thin = 1.0 - min(min(grid.x, grid.y), 1.0);
    vec2 minorGrid = abs(fract(coord * 2.0 - 0.5) - 0.5) / fwidth(coord * 2.0);
    float minor = 1.0 - min(min(minorGrid.x, minorGrid.y), 1.0);
    float fade = 1.0 - smoothstep(8.0, 23.0, length(coord * vec2(0.8, 1.0)));
    float axis = 1.0 - smoothstep(0.0, 0.018, min(abs(coord.x), abs(coord.y)));
    float alpha = (thin * 0.043 + minor * 0.012 + axis * 0.023) * fade;
    gl_FragColor = vec4(mix(vec3(0.24, 0.4, 0.38), vec3(0.5, 0.67, 0.42), uWeights.z), alpha);
  }
`;

export const pointVertex = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uMotion;
  uniform float uPixelRatio;
  uniform vec3 uCursor;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec3 point = position;
    point.y += sin(uTime * 0.18 + aSeed * 62.0) * 0.6 * uMotion;
    point.x += sin(uTime * 0.06 + aSeed * 13.0) * 0.35 * uMotion;
    vec3 delta = point - uCursor;
    float distanceToCursor = length(delta);
    point += normalize(delta + vec3(0.001)) * (1.0 - smoothstep(0.0, 2.4, distanceToCursor)) * 0.3 * uMotion;
    vec4 view = modelViewMatrix * vec4(point, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(aSize * uPixelRatio * 80.0 / -view.z, 1.0, 4.0);
    vAlpha = (0.15 + sin(aSeed * 51.0 + uTime * 0.4) * 0.08 * uMotion);
    vSeed = aSeed;
  }
`;

export const pointFragment = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    float point = 1.0 - smoothstep(0.0, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(mix(vec3(0.45, 0.78, 0.76), vec3(0.79, 0.96, 0.48), step(0.65, vSeed)), point * vAlpha);
  }
`;

export const haloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const haloFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMotion;
  void main() {
    float radius = length(vUv - 0.5) * 2.0;
    float ring = (1.0 - smoothstep(0.012, 0.04, abs(radius - 0.67))) * 0.8;
    float glow = exp(-abs(radius - 0.67) * 18.0) * 0.26;
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float dash = step(0.15, sin(angle * 12.0 + uTime * 0.5 * uMotion));
    float inner = exp(-radius * radius * 8.0) * 0.035;
    gl_FragColor = vec4(uColor, (ring * dash + glow + inner) * (1.0 - smoothstep(0.9, 1.0, radius)));
  }
`;
