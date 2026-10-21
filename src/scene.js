import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT_NAMES, hashString, nodeKind, createLayouts, blendedPosition, routedPath } from './layouts.js';
import { nodeVertex, nodeFragment, traceVertex, traceFragment, gridVertex, gridFragment, pointVertex, pointFragment, haloVertex, haloFragment } from './shaders.js';

const ACCENT = '#c9f57a';
const SECONDARY = '#73c8c2';
const KIND_SCALE = { person: 1.65, experience: 1.02, project: 0.98, education: 0.9, certification: 0.72, skill: 0.7, contact: 0.82 };
const EASE = (value) => value * value * (3 - 2 * value);
const clamp = THREE.MathUtils.clamp;

function surface(geometry, brightness = 0) {
  geometry.setAttribute('aSurface', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill(brightness), 1));
  return geometry;
}

// Small, purpose-built electronic assemblies: pins, heatsinks, coils and
// optical housings carry the semantics before a label has to explain them.
function makeAssembly(kind) {
  const pieces = [];
  const add = (geometry, position = [0, 0, 0], brightness = 0, rotation = [0, 0, 0]) => {
    geometry.rotateX(rotation[0]);
    geometry.rotateY(rotation[1]);
    geometry.rotateZ(rotation[2]);
    geometry.translate(...position);
    pieces.push(surface(geometry, brightness));
  };
  const box = (size, position, brightness) => add(new THREE.BoxGeometry(...size), position, brightness);
  const pins = (count, radiusX, radiusZ, height = 0.02) => {
    for (let index = 0; index < count; index++) {
      const offsetX = (index / Math.max(1, count - 1) - 0.5) * radiusX * 1.6;
      const offsetZ = (index / Math.max(1, count - 1) - 0.5) * radiusZ * 1.6;
      box([0.07, 0.045, 0.18], [offsetX, height, radiusZ], 0.85);
      box([0.07, 0.045, 0.18], [offsetX, height, -radiusZ], 0.85);
      box([0.18, 0.045, 0.07], [radiusX, height, offsetZ], 0.85);
      box([0.18, 0.045, 0.07], [-radiusX, height, offsetZ], 0.85);
    }
  };
  const pad = (x, z, radius = 0.06) => add(new THREE.TorusGeometry(radius, 0.018, 5, 12), [x, 0.086, z], 0.8, [-Math.PI / 2, 0, 0]);
  if (kind === 'person') {
    add(new THREE.CylinderGeometry(0.87, 0.91, 0.13, 8), [0, 0, 0], 0.05);
    box([0.94, 0.16, 0.94], [0, 0.13, 0], 0.04);
    box([0.71, 0.1, 0.71], [0, 0.26, 0], 0.15);
    for (let index = 0; index < 7; index++) box([0.065, 0.16, 0.73], [(index - 3) * 0.1, 0.38, 0], 0.3);
    pins(7, 0.74, 0.74, 0.01);
    for (const x of [-0.58, 0.58]) for (const z of [-0.58, 0.58]) pad(x, z, 0.055);
  } else if (kind === 'experience') {
    box([1.38, 0.11, 0.99], [0, 0, 0], 0.04);
    box([0.85, 0.13, 0.69], [-0.12, 0.12, 0], 0);
    for (let index = 0; index < 7; index++) box([0.07, 0.22, 0.65], [index * 0.105 - 0.43, 0.28, 0], 0.18);
    box([0.19, 0.23, 0.7], [0.57, 0.14, 0], 0.1);
    for (let index = 0; index < 5; index++) box([0.22, 0.045, 0.055], [0.72, 0.1, index * 0.12 - 0.24], 0.8);
    for (const x of [-0.56, 0.56]) for (const z of [-0.38, 0.38]) pad(x, z);
  } else if (kind === 'project') {
    box([1.4, 0.1, 1.06], [0, 0, 0], 0.03);
    box([0.5, 0.13, 0.51], [-0.27, 0.12, -0.07], 0.1);
    for (let index = 0; index < 4; index++) {
      box([0.04, 0.04, 0.13], [-0.44 + index * 0.11, 0.08, 0.25], 0.9);
      box([0.04, 0.04, 0.13], [-0.44 + index * 0.11, 0.08, -0.39], 0.9);
    }
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 14), [0.35, 0.18, 0.05], 0.03);
    for (let index = 0; index < 5; index++) add(new THREE.TorusGeometry(0.195, 0.026, 5, 16), [0.35, 0.08 + index * 0.052, 0.05], 0.8, [-Math.PI / 2, 0, 0]);
    box([0.19, 0.15, 0.22], [0.36, 0.13, -0.31], 0.2);
    for (const x of [-0.59, 0.59]) for (const z of [-0.43, 0.43]) pad(x, z, 0.045);
  } else if (kind === 'education') {
    box([1.06, 0.1, 0.97], [0, 0, 0], 0.03);
    box([0.86, 0.07, 0.79], [0, 0.13, 0], 0.15);
    add(new THREE.CylinderGeometry(0.27, 0.34, 0.18, 8), [0, 0.26, 0], 0.1);
    add(new THREE.TorusGeometry(0.28, 0.025, 6, 16), [0, 0.37, 0], 0.8, [-Math.PI / 2, 0, 0]);
    for (const x of [-0.43, 0.43]) for (const z of [-0.39, 0.39]) pad(x, z, 0.035);
  } else if (kind === 'certification') {
    box([0.82, 0.08, 0.82], [0, 0, 0], 0.05);
    add(new THREE.CylinderGeometry(0.28, 0.34, 0.3, 16), [0, 0.18, 0], 0.07);
    add(new THREE.TorusGeometry(0.225, 0.045, 8, 20), [0, 0.35, 0], 0.85, [-Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16), [0, 0.354, 0], 0.3);
    for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) pad(x, z, 0.035);
  } else if (kind === 'contact') {
    // A hollow trapezoidal diagnostic connector, with two pin banks and a
    // small status beacon, distinguishes communication from compute nodes.
    box([1.35, 0.08, 0.94], [0, 0, 0], 0.05);
    const outline = new THREE.Shape();
    outline.moveTo(-0.53, -0.3); outline.lineTo(0.53, -0.3); outline.lineTo(0.41, 0.3); outline.lineTo(-0.41, 0.3); outline.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.37, -0.17); hole.lineTo(-0.3, 0.17); hole.lineTo(0.3, 0.17); hole.lineTo(0.37, -0.17); hole.closePath();
    outline.holes.push(hole);
    add(new THREE.ExtrudeGeometry(outline, { depth: 0.22, bevelEnabled: false, steps: 1 }), [0, 0.06, 0], 0.3, [-Math.PI / 2, 0, 0]);
    for (let index = 0; index < 6; index++) for (const z of [-0.09, 0.09]) box([0.045, 0.12, 0.045], [index * 0.105 - 0.2625, 0.12, z], 0.9);
    add(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 12), [0.57, 0.067, -0.32], 1.4);
    for (const x of [-0.56, 0.56]) pad(x, 0.33, 0.035);
  } else {
    box([0.72, 0.14, 0.72], [0, 0, 0], 0.04);
    box([0.44, 0.07, 0.44], [0, 0.12, 0], 0.2);
    pins(5, 0.42, 0.42, -0.015);
    box([0.12, 0.025, 0.025], [-0.12, 0.168, 0.12], 0.8);
  }
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((piece) => piece.dispose());
  merged.computeBoundingSphere();
  return merged;
}

function createTraceGeometry(graph, layouts, colorForNode) {
  const attributes = {
    aNetwork: [], aVehicle: [], aSchematic: [],
    aPrevNetwork: [], aPrevVehicle: [], aPrevSchematic: [],
    aNextNetwork: [], aNextVehicle: [], aNextSchematic: [],
    aProgress: [], aAccent: [], aSide: [], aSeed: [], aFocus: [], aWeight: [],
  };
  const indices = [];
  const edgeRanges = [];
  const idSet = new Set(graph.nodes.map((node) => node.id));
  const validEdges = graph.edges.filter((edge) => idSet.has(typeof edge.source === 'object' ? edge.source.id : edge.source) && idSet.has(typeof edge.target === 'object' ? edge.target.id : edge.target));
  validEdges.forEach((edge, edgeIndex) => {
    const source = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const target = typeof edge.target === 'object' ? edge.target.id : edge.target;
    const seed = hashString(`${source}-${target}`);
    const paths = LAYOUT_NAMES.map((name) => routedPath(layouts.maps[name].get(source), layouts.maps[name].get(target), seed, edgeIndex));
    const distances = paths.map((path) => {
      const values = [0];
      for (let index = 1; index < path.length; index++) values.push(values[index - 1] + Math.hypot(...path[index].map((value, component) => value - path[index - 1][component])));
      return values.map((value) => value / (values.at(-1) || 1));
    });
    const color = colorForNode(source);
    const start = attributes.aSide.length;
    paths[0].forEach((_, pointIndex) => {
      for (const side of [-1, 1]) {
        ['Network', 'Vehicle', 'Schematic'].forEach((name, layoutIndex) => {
          const path = paths[layoutIndex];
          attributes[`a${name}`].push(...path[pointIndex]);
          attributes[`aPrev${name}`].push(...path[Math.max(0, pointIndex - 1)]);
          attributes[`aNext${name}`].push(...path[Math.min(path.length - 1, pointIndex + 1)]);
        });
        attributes.aProgress.push(...distances.map((distance) => distance[pointIndex]));
        attributes.aAccent.push(color.r, color.g, color.b);
        attributes.aSide.push(side);
        attributes.aSeed.push(seed);
        attributes.aFocus.push(0.8);
        attributes.aWeight.push(edge.weight != null && Number.isFinite(Number(edge.weight)) ? clamp(Number(edge.weight), 0, 1.4) : 0.5);
      }
      if (pointIndex < paths[0].length - 1) {
        const index = start + pointIndex * 2;
        indices.push(index, index + 1, index + 2, index + 1, index + 3, index + 2);
      }
    });
    edgeRanges.push({ source, target, start, count: paths[0].length * 2 });
  });
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(attributes)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, /a(Side|Seed|Focus|Weight)$/.test(name) ? 1 : 3));
  // A conventional position buffer keeps Three's renderer and diagnostics
  // happy; all actual spatial transforms happen in the shared shader.
  geometry.setAttribute('position', geometry.getAttribute('aNetwork').clone());
  geometry.setIndex(indices);
  return { geometry, edgeRanges, validEdges };
}

function makeVehicle(uniforms) {
  const points = [];
  const segment = (from, to) => points.push(...from, ...to);
  const loop = (vertices) => vertices.forEach((vertex, index) => segment(vertex, vertices[(index + 1) % vertices.length]));
  const outline = [[-9.4, 0, -2.3], [-8.6, 0, -3.2], [-5.9, 0, -3.65], [4.9, 0, -3.65], [8.4, 0, -3.0], [9.6, 0, -1.85], [9.6, 0, 1.85], [8.4, 0, 3.0], [4.9, 0, 3.65], [-5.9, 0, 3.65], [-8.6, 0, 3.2], [-9.4, 0, 2.3]];
  loop(outline);
  loop(outline.map(([x, , z]) => [x, 0.35, z * 0.94]));
  outline.forEach((point) => segment(point, [point[0], 0.35, point[2] * 0.94]));
  const roof = [[-4.1, 1.6, -2.28], [1.8, 1.6, -2.28], [3.3, 0.42, -3.12], [3.3, 0.42, 3.12], [1.8, 1.6, 2.28], [-4.1, 1.6, 2.28], [-6.1, 0.4, 3.05], [-6.1, 0.4, -3.05]];
  loop(roof);
  segment(roof[0], roof[5]); segment(roof[1], roof[4]); segment(roof[2], roof[7]);
  segment([-0.9, 1.6, -2.28], [-0.9, 1.6, 2.28]);
  for (const x of [-6.0, 5.8]) for (const z of [-3.58, 3.58]) {
    const ring = Array.from({ length: 28 }, (_, index) => {
      const angle = index / 28 * Math.PI * 2;
      return [x + Math.cos(angle) * 1.22, -0.1 + Math.sin(angle) * 1.22, z];
    });
    loop(ring);
    segment([x - 1.22, -0.1, z], [x + 1.22, -0.1, z]);
    segment([x, -1.32, z], [x, 1.12, z]);
  }
  // Axles and a longitudinal bus tie the underlying network to the vehicle.
  segment([-6, -0.15, -3.6], [-6, -0.15, 3.6]);
  segment([5.8, -0.15, -3.6], [5.8, -0.15, 3.6]);
  segment([-8.4, -0.15, 0], [8.4, -0.15, 0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uWeights; void main() { gl_FragColor = vec4(0.42, 0.72, 0.7, 0.22 * uWeights.y); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.LineSegments(geometry, material);
}

function createLabel(node, select, hover) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'signal-node-label';
  button.setAttribute('aria-label', `Inspect ${String(node.type || 'node').toLowerCase()}: ${node.name}`);
  button.dataset.nodeId = node.id;
  button.title = node.name;
  Object.assign(button.style, {
    position: 'absolute', left: '0', top: '0', pointerEvents: 'auto', border: '0',
    background: 'transparent', color: '#a6b3a9', font: 'inherit', fontSize: '9px',
    lineHeight: '1.25', letterSpacing: '.06em', textAlign: 'left', padding: '7px 8px',
    whiteSpace: 'nowrap', cursor: 'pointer', maxWidth: '178px', overflow: 'hidden',
    textOverflow: 'ellipsis', textTransform: 'uppercase', willChange: 'transform',
    transition: 'color 180ms, opacity 180ms', touchAction: 'manipulation',
  });
  const tick = document.createElement('span');
  tick.setAttribute('aria-hidden', 'true');
  tick.textContent = '— ';
  tick.style.opacity = '.45';
  const text = document.createElement('span');
  text.textContent = node.name;
  button.append(tick, text);
  button.addEventListener('click', (event) => { event.stopPropagation(); select(node.id); });
  button.addEventListener('pointerenter', () => hover(node.id));
  button.addEventListener('pointerleave', () => hover(null));
  button.addEventListener('focus', () => hover(node.id));
  button.addEventListener('blur', () => hover(null));
  return button;
}

/**
 * One renderer, one shared spatial state for GPU positions and DOM hit targets.
 * UI code owns the information cards; the scene owns navigation and geometry.
 */
export async function createNetwork({ container, graph, onSelect = () => {}, onHover = () => {}, onMetrics = () => {}, onProject = () => {}, reducedMotion = false }) {
  if (!container) throw new Error('A network stage is required.');
  const verifiedNodes = (graph?.nodes || []).filter((node) => node.status === 'verified');
  const verifiedIds = new Set(verifiedNodes.map((node) => node.id));
  const verifiedEdges = (graph?.edges || []).filter((edge) => verifiedIds.has(typeof edge.source === 'object' ? edge.source.id : edge.source) && verifiedIds.has(typeof edge.target === 'object' ? edge.target.id : edge.target));
  const data = { ...graph, nodes: verifiedNodes, edges: verifiedEdges, clusters: graph?.clusters || [] };
  const layouts = createLayouts(data);
  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const clusterColors = new Map(layouts.clusters.map((cluster) => [String(cluster.id), cluster.color || SECONDARY]));
  const colorCache = new Map();
  const colorForNode = (id) => {
    if (!colorCache.has(id)) {
      const node = nodesById.get(id);
      colorCache.set(id, new THREE.Color(nodeKind(node || {}) === 'person' ? ACCENT : (clusterColors.get(String(node?.clusterId || node?.cluster || 'systems')) || SECONDARY)));
    }
    return colorCache.get(id);
  };
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(0x070c0b, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.domElement.className = 'signal-webgl-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', outline: 'none' });
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 180);
  camera.position.set(23.4, 25.8, 30.0);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.07;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 17;
  controls.maxDistance = 110;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.rotateSpeed = 0.43;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.55;
  const uniforms = {
    uTime: { value: 0 }, uMotion: { value: reducedMotion ? 0 : 1 },
    uBoot: { value: reducedMotion ? 1 : 0 },
    uWeights: { value: new THREE.Vector3(1, 0, 0) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPixelRatio: { value: 1 }, uCursor: { value: new THREE.Vector3(100, 100, 100) },
  };
  const nodeMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: nodeVertex, fragmentShader: nodeFragment });
  const instanceGroups = [];
  const instanceForId = new Map();
  for (const kind of Object.keys(KIND_SCALE)) {
    const members = data.nodes.filter((node) => nodeKind(node) === kind);
    if (!members.length) continue;
    const geometry = makeAssembly(kind);
    const attributes = { aNetwork: [], aVehicle: [], aSchematic: [], aAccent: [], aSeed: [], aFocus: [] };
    members.forEach((node) => {
      ['Network', 'Vehicle', 'Schematic'].forEach((name) => attributes[`a${name}`].push(...layouts.maps[name.toLowerCase()].get(node.id)));
      const color = colorForNode(node.id);
      attributes.aAccent.push(color.r, color.g, color.b);
      attributes.aSeed.push(hashString(node.id));
      attributes.aFocus.push(0.8);
    });
    for (const [name, values] of Object.entries(attributes)) geometry.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(values), name === 'aSeed' || name === 'aFocus' ? 1 : 3));
    const mesh = new THREE.InstancedMesh(geometry, nodeMaterial, members.length);
    mesh.frustumCulled = false;
    const object = new THREE.Object3D();
    members.forEach((node, index) => {
      const scale = KIND_SCALE[kind];
      object.position.set(0, 0, 0);
      object.rotation.set(0, kind === 'person' ? Math.PI / 4 : 0, 0);
      object.scale.setScalar(scale);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
      instanceForId.set(node.id, { mesh, index, kind, scale });
    });
    mesh.instanceMatrix.needsUpdate = true;
    instanceGroups.push({ mesh, members });
    scene.add(mesh);
  }
  const traces = createTraceGeometry(data, layouts, colorForNode);
  const makeTraceMaterial = (width, glow) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uWidth: { value: width }, uGlow: { value: glow } },
    vertexShader: traceVertex, fragmentShader: traceFragment,
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const traceGlow = new THREE.Mesh(traces.geometry, makeTraceMaterial(7.8, 0.14));
  const traceCore = new THREE.Mesh(traces.geometry, makeTraceMaterial(1.5, 1.0));
  traceGlow.frustumCulled = false; traceCore.frustumCulled = false;
  traceGlow.renderOrder = 1; traceCore.renderOrder = 2;
  scene.add(traceGlow, traceCore);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.ShaderMaterial({
    uniforms, vertexShader: gridVertex, fragmentShader: gridFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.4;
  grid.renderOrder = -3;
  scene.add(grid);
  const vehicle = makeVehicle(uniforms);
  scene.add(vehicle);

  const particleCount = matchMedia('(max-width: 760px)').matches ? 90 : 240;
  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = [], particleSeeds = [], particleSizes = [];
  for (let index = 0; index < particleCount; index++) {
    const a = hashString(`particle-x-${index}`), b = hashString(`particle-z-${index}`), c = hashString(`particle-y-${index}`);
    particlePositions.push((a - 0.5) * 35, c * 9 - 1, (b - 0.5) * 28);
    particleSeeds.push(hashString(`particle-${index}`));
    particleSizes.push(0.6 + a * 0.8);
  }
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(particleSeeds, 1));
  particleGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(particleSizes, 1));
  const particles = new THREE.Points(particleGeometry, new THREE.ShaderMaterial({
    uniforms, vertexShader: pointVertex, fragmentShader: pointFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  particles.frustumCulled = false;
  scene.add(particles);
  const haloMaterial = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new THREE.Color(ACCENT) } },
    vertexShader: haloVertex, fragmentShader: haloFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.9), haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  scene.add(halo);
  const hoverHalo = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), haloMaterial.clone());
  hoverHalo.material.uniforms.uTime = uniforms.uTime;
  hoverHalo.material.uniforms.uMotion = uniforms.uMotion;
  hoverHalo.material.uniforms.uColor.value = new THREE.Color(SECONDARY);
  hoverHalo.rotation.x = -Math.PI / 2;
  hoverHalo.visible = false;
  scene.add(hoverHalo);

  const labelsLayer = document.createElement('div');
  labelsLayer.className = 'signal-label-layer';
  Object.assign(labelsLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '2', fontFamily: 'var(--font-mono, monospace)' });
  container.appendChild(labelsLayer);
  const labels = new Map();
  const projected = new Map();
  const worldPosition = new THREE.Vector3();
  const projection = new THREE.Vector3();
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const cursorWorld = new THREE.Vector3();
  let selectedId = null;
  let hoveredId = null;
  let highlightedIds = null;
  let layoutName = 'network';
  let weights = [1, 0, 0];
  let morph = null;
  let cameraMove = null;
  let tour = false;
  let tourStart = null;
  let currentQuality = matchMedia('(max-width: 760px)').matches ? 'medium' : 'high';
  let autoQuality = true;
  let qualityLowSamples = 0;
  let qualityHighSamples = 0;
  let paused = false;
  let inViewport = true;
  let disposed = false;
  let width = 1, height = 1;
  let framingScale = 1;
  let raf = 0;
  let previousTime = 0;
  let visibleTime = 0;
  let bootTime = 0;
  let bootComplete = reducedMotion;
  let frames = 0, sampleTime = 0, fps = 60;
  let hasReportedMetrics = false;
  let pointerDown = null;
  const activePointers = new Set();
  let multiplePointers = false;
  let isDragging = false;
  let ignoreClickUntil = 0;

  const requestRender = () => {
    if (!raf && !disposed && !paused && inViewport && !document.hidden) raf = requestAnimationFrame(render);
  };
  function updateFocus() {
    const focus = new Set();
    if (highlightedIds) highlightedIds.forEach((id) => focus.add(id));
    if (selectedId) {
      focus.add(selectedId);
      traces.edgeRanges.forEach((edge) => {
        if (edge.source === selectedId) focus.add(edge.target);
        if (edge.target === selectedId) focus.add(edge.source);
      });
    }
    const filterActive = highlightedIds !== null || selectedId !== null;
    for (const { mesh, members } of instanceGroups) {
      const attribute = mesh.geometry.getAttribute('aFocus');
      members.forEach((node, index) => attribute.setX(index, node.id === selectedId ? 1.6 : !filterActive ? 0.8 : focus.has(node.id) ? 1.0 : 0.01));
      attribute.needsUpdate = true;
    }
    const attribute = traces.geometry.getAttribute('aFocus');
    traces.edgeRanges.forEach((edge) => {
      const direct = selectedId && (edge.source === selectedId || edge.target === selectedId);
      const related = focus.has(edge.source) && focus.has(edge.target);
      const value = direct ? 1.5 : !filterActive ? 0.8 : related ? 1 : 0.02;
      for (let index = edge.start; index < edge.start + edge.count; index++) attribute.setX(index, value);
    });
    attribute.needsUpdate = true;
    halo.visible = Boolean(selectedId && nodesById.has(selectedId));
    if (selectedId) haloMaterial.uniforms.uColor.value.copy(colorForNode(selectedId));
    for (const [id, button] of labels) {
      const active = id === selectedId;
      button.setAttribute('aria-pressed', String(active));
      button.style.color = active ? ACCENT : '#a6b3a9';
      button.style.opacity = filterActive && !focus.has(id) ? '.35' : '1';
    }
    requestRender();
  }
  function select(id, notify = false) {
    selectedId = id && nodesById.has(id) ? id : null;
    updateFocus();
    if (notify && selectedId) onSelect(selectedId);
  }
  function hover(id) {
    if (id === hoveredId) return;
    hoveredId = id && nodesById.has(id) ? id : null;
    hoverHalo.visible = Boolean(hoveredId && hoveredId !== selectedId);
    renderer.domElement.style.cursor = hoveredId ? 'pointer' : isDragging ? 'grabbing' : 'grab';
    onHover(hoveredId);
    requestRender();
  }
  data.nodes.forEach((node) => {
    const label = createLabel(node, (id) => select(id, true), hover);
    label.hidden = true;
    labels.set(node.id, label);
    labelsLayer.appendChild(label);
  });
  const clusterLabels = layouts.clusters.map((cluster) => {
    const label = document.createElement('div');
    label.className = 'signal-cluster-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = String(cluster.name || cluster.id).toUpperCase();
    Object.assign(label.style, { position: 'absolute', color: cluster.color || SECONDARY, opacity: '.48', fontSize: '8px', letterSpacing: '.2em', whiteSpace: 'nowrap', fontWeight: '500', transition: 'opacity 200ms', pointerEvents: 'none' });
    labelsLayer.appendChild(label);
    return { id: cluster.id, label };
  });

  function updateLabels() {
    const mobile = width < 760;
    const viewDirection = new THREE.Vector3();
    camera.getWorldDirection(viewDirection);
    for (const node of data.nodes) {
      const position = blendedPosition(layouts, node.id, weights);
      worldPosition.set(...position);
      projection.copy(worldPosition).project(camera);
      const x = (projection.x * 0.5 + 0.5) * width;
      const y = (-projection.y * 0.5 + 0.5) * height;
      const distance = camera.position.distanceTo(worldPosition);
      const scale = instanceForId.get(node.id)?.scale || 1;
      const radius = Math.max(mobile ? 14 : 11, height / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance) * scale * 0.55);
      projected.set(node.id, { x, y, radius, depth: projection.z, world: position });
    }
    const priority = data.nodes.filter((node) => nodeKind(node) !== 'skill' && nodeKind(node) !== 'certification');
    priority.sort((a, b) => (a.id === selectedId || a.id === hoveredId ? -1 : 0) - (b.id === selectedId || b.id === hoveredId ? -1 : 0) || (a.id === layouts.gatewayId ? -1 : 0) - (b.id === layouts.gatewayId ? -1 : 0) || String(a.id).localeCompare(String(b.id)));
    for (const id of [selectedId, hoveredId]) if (id && !priority.some((node) => node.id === id)) priority.unshift(nodesById.get(id));
    const shown = new Set();
    const rectangles = [];
    const maxLabels = mobile ? 6 : currentQuality === 'low' ? 10 : 15;
    for (const node of priority) {
      if (!node || shown.size >= maxLabels) continue;
      const point = projected.get(node.id);
      if (!point || point.depth > 1 || point.depth < -1) continue;
      const isImportant = node.id === selectedId || node.id === hoveredId || node.id === layouts.gatewayId;
      const labelWidth = Math.min(170, String(node.name).length * 5.6 + 25);
      let x = point.x + 6;
      let y = point.y + point.radius * 0.6 + 7;
      if (node.id === layouts.gatewayId) { x = point.x - labelWidth * 0.5; y = point.y + point.radius + 8; }
      if (x < 8 || x + labelWidth > width - 8 || y < 8 || y + 24 > height - 12) continue;
      // Intro and inspector occupy the left/right edge at desktop sizes.
      // The actual hit geometry remains available even when a label is hidden.
      if (!mobile && !isImportant && (x < width * 0.275 || x + labelWidth > width * 0.91)) continue;
      const rectangle = { x, y, w: labelWidth, h: 25 };
      const collides = rectangles.some((box) => rectangle.x < box.x + box.w + 4 && rectangle.x + rectangle.w + 4 > box.x && rectangle.y < box.y + box.h + 1 && rectangle.y + rectangle.h + 1 > box.y);
      if (collides && !isImportant) continue;
      labels.get(node.id).style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      shown.add(node.id);
      rectangles.push(rectangle);
    }
    for (const [id, button] of labels) {
      // A focused control is never removed from the accessibility tree.
      const show = shown.has(id) || document.activeElement === button;
      button.hidden = !show;
    }
    if (selectedId && projected.has(selectedId)) onProject({ id: selectedId, ...projected.get(selectedId), width, height });
    clusterLabels.forEach(({ id, label }) => {
      const center = [0, 0, 0];
      LAYOUT_NAMES.forEach((name, index) => {
        const anchor = layouts.anchors[name].find((value) => value.id === id)?.position || [0, 0, 0];
        for (let component = 0; component < 3; component++) center[component] += anchor[component] * weights[index];
      });
      center[2] -= 2.8;
      projection.set(...center).project(camera);
      const x = (projection.x * 0.5 + 0.5) * width;
      const y = (-projection.y * 0.5 + 0.5) * height;
      label.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      label.style.opacity = mobile || x < width * 0.27 || x > width * 0.89 || y < 50 || y > height - 60 ? '0' : '.48';
    });
  }

  function applyQuality(level) {
    currentQuality = ['high', 'medium', 'low'].includes(level) ? level : 'high';
    const dpr = Math.min(window.devicePixelRatio || 1, currentQuality === 'high' ? 1.8 : currentQuality === 'medium' ? 1.35 : 1);
    renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;
    particles.visible = currentQuality !== 'low';
    particleGeometry.setDrawRange(0, currentQuality === 'medium' ? Math.floor(particleCount * 0.5) : particleCount);
    traceGlow.visible = currentQuality !== 'low';
    renderer.setSize(width, height, false);
    requestRender();
  }
  function framingFor(name = layoutName) {
    const portraitScale = height / width * (name === 'schematic' ? 1.02 : 0.88);
    return width < 760 ? clamp(portraitScale, 1.3, 3) : clamp(portraitScale, 1, 2.5);
  }
  function resize() {
    const box = container.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    const nextFramingScale = framingFor();
    if (Math.abs(nextFramingScale - framingScale) > 0.001) {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(nextFramingScale / framingScale);
      camera.position.copy(controls.target).add(offset);
      framingScale = nextFramingScale;
      cameraMove = null;
      controls.update();
    }
    camera.aspect = width / height;
    camera.setViewOffset(width, height, width > 1000 ? -width * 0.07 : 0, width < 760 ? -height * 0.12 : 0, width, height);
    camera.updateProjectionMatrix();
    uniforms.uResolution.value.set(width, height);
    renderer.setSize(width, height, false);
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    if (!inViewport && raf) { cancelAnimationFrame(raf); raf = 0; }
    previousTime = 0;
    requestRender();
  }, { threshold: 0.01 }) : null;
  intersectionObserver?.observe(container);

  function hitAt(clientX, clientY) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const x = clientX - bounds.left, y = clientY - bounds.top;
    let closest = null, best = Infinity;
    for (const [id, point] of projected) {
      if (point.depth < -1 || point.depth > 1) continue;
      const distance = Math.hypot(x - point.x, y - point.y);
      const normalized = distance / point.radius;
      if (normalized < 1.15 && normalized < best) { closest = id; best = normalized; }
    }
    return closest;
  }
  function pointerMove(event) {
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) isDragging = true;
    if (isDragging) { hover(null); return; }
    hover(hitAt(event.clientX, event.clientY));
    const bounds = renderer.domElement.getBoundingClientRect();
    pointerNdc.set((event.clientX - bounds.left) / width * 2 - 1, -(event.clientY - bounds.top) / height * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(groundPlane, cursorWorld)) uniforms.uCursor.value.copy(cursorWorld);
  }
  function pointerStart(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) multiplePointers = true;
    pointerDown = { x: event.clientX, y: event.clientY };
    isDragging = false;
    cameraMove = null;
    tourStart = null;
  }
  function pointerEnd(event) {
    const moved = pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7;
    if (pointerDown && !multiplePointers && !isDragging && !moved && performance.now() > ignoreClickUntil) {
      const id = hitAt(event.clientX, event.clientY);
      if (id) select(id, true);
    }
    pointerDown = null;
    activePointers.delete(event.pointerId);
    if (!activePointers.size) multiplePointers = false;
    isDragging = false;
    renderer.domElement.style.cursor = hoveredId ? 'pointer' : 'grab';
  }
  function pointerLeave() {
    if (!pointerDown) hover(null);
    uniforms.uCursor.value.set(100, 100, 100);
  }
  function controlsStart() { cameraMove = null; tourStart = null; requestRender(); }
  function controlsChange() { requestRender(); }
  function controlsEnd() { ignoreClickUntil = performance.now() + (isDragging ? 80 : 0); requestRender(); }
  controls.addEventListener('start', controlsStart);
  controls.addEventListener('change', controlsChange);
  controls.addEventListener('end', controlsEnd);
  renderer.domElement.addEventListener('pointermove', pointerMove);
  renderer.domElement.addEventListener('pointerdown', pointerStart);
  renderer.domElement.addEventListener('pointerup', pointerEnd);
  renderer.domElement.addEventListener('pointercancel', pointerEnd);
  renderer.domElement.addEventListener('pointerleave', pointerLeave);
  function visibilityChange() {
    previousTime = 0;
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    requestRender();
  }
  document.addEventListener('visibilitychange', visibilityChange);

  function moveCamera(position, target, duration = 1400) {
    if (reducedMotion) {
      camera.position.copy(position);
      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      cameraMove = null;
    } else {
      cameraMove = { from: camera.position.clone(), to: position.clone(), targetFrom: controls.target.clone(), targetTo: target.clone(), start: visibleTime * 1000, duration };
    }
    requestRender();
  }
  function setLayout(name) {
    if (!LAYOUT_NAMES.includes(name)) return;
    layoutName = name;
    const target = LAYOUT_NAMES.map((value) => value === name ? 1 : 0);
    if (reducedMotion) {
      weights = target;
      uniforms.uWeights.value.set(...weights);
      morph = null;
    } else {
      morph = { from: [...weights], to: target, start: visibleTime * 1000, duration: 1600 };
    }
    const desktop = width > 1000;
    const modeFramingScale = framingFor(name);
    framingScale = modeFramingScale;
    const cameraPositions = {
      network: new THREE.Vector3(23.4, 25.8, 30).multiplyScalar(modeFramingScale),
      vehicle: new THREE.Vector3(13, 29, 29).multiplyScalar(modeFramingScale),
      schematic: new THREE.Vector3(0.02, desktop ? 34 : 39, 7).multiplyScalar(modeFramingScale),
    };
    moveCamera(cameraPositions[name], new THREE.Vector3(0, 0, name === 'schematic' ? 0 : -0.5));
    requestRender();
  }

  function render(now) {
    raf = 0;
    if (disposed || paused || !inViewport || document.hidden) return;
    const rawDelta = previousTime ? Math.max((now - previousTime) / 1000, 0.0001) : 1 / 60;
    const delta = Math.min(rawDelta, 0.1);
    previousTime = now;
    if (!reducedMotion) visibleTime += delta;
    uniforms.uTime.value = visibleTime;
    if (!bootComplete) {
      bootTime += delta;
      uniforms.uBoot.value = clamp(bootTime / 1.9, 0, 1);
      if (uniforms.uBoot.value >= 1) bootComplete = true;
    }
    if (morph) {
      const progress = clamp((visibleTime * 1000 - morph.start) / morph.duration, 0, 1);
      const amount = EASE(progress);
      weights = morph.from.map((value, index) => THREE.MathUtils.lerp(value, morph.to[index], amount));
      uniforms.uWeights.value.set(...weights);
      if (progress >= 1) morph = null;
    }
    if (cameraMove) {
      const progress = clamp((visibleTime * 1000 - cameraMove.start) / cameraMove.duration, 0, 1);
      const amount = EASE(progress);
      camera.position.lerpVectors(cameraMove.from, cameraMove.to, amount);
      controls.target.lerpVectors(cameraMove.targetFrom, cameraMove.targetTo, amount);
      if (progress >= 1) cameraMove = null;
    }
    if (tour && !reducedMotion && !pointerDown && !cameraMove) {
      if (!tourStart) tourStart = { time: visibleTime, position: camera.position.clone(), target: controls.target.clone() };
      const angle = Math.sin((visibleTime - tourStart.time) * 0.095) * 0.13;
      const relative = tourStart.position.clone().sub(tourStart.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      camera.position.copy(tourStart.target).add(relative);
    }
    const controlChanged = controls.update();
    if (selectedId && halo.visible) {
      const position = blendedPosition(layouts, selectedId, weights);
      halo.position.set(position[0], position[1] - 0.1, position[2]);
      const scale = nodeKind(nodesById.get(selectedId)) === 'person' ? 1.1 : 0.72;
      halo.scale.setScalar(scale);
    }
    if (hoveredId && hoverHalo.visible) {
      const position = blendedPosition(layouts, hoveredId, weights);
      hoverHalo.position.set(position[0], position[1] - 0.09, position[2]);
    }
    updateLabels();
    renderer.render(scene, camera);
    frames++; sampleTime += rawDelta;
    if (sampleTime >= 1 || !hasReportedMetrics) {
      hasReportedMetrics = true;
      fps = Math.round(frames / sampleTime);
      frames = 0; sampleTime = 0;
      if (autoQuality && !reducedMotion && !morph) {
        qualityLowSamples = fps < 42 ? qualityLowSamples + 1 : 0;
        qualityHighSamples = fps > 56 ? qualityHighSamples + 1 : 0;
        if (qualityLowSamples >= 3 && currentQuality !== 'low') { applyQuality(currentQuality === 'high' ? 'medium' : 'low'); qualityLowSamples = 0; qualityHighSamples = 0; }
        if (qualityHighSamples >= 12 && currentQuality !== 'high') { applyQuality(currentQuality === 'low' ? 'medium' : 'high'); qualityLowSamples = 0; qualityHighSamples = 0; }
      }
      onMetrics({ fps: reducedMotion ? 0 : fps, quality: currentQuality, nodeCount: data.nodes.length, edgeCount: traces.validEdges.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
    }
    if (!reducedMotion || morph || cameraMove || controlChanged) requestRender();
  }
  resize();
  applyQuality(currentQuality);
  updateFocus();
  requestRender();

  return {
    setLayout,
    completeBoot() { bootComplete = true; uniforms.uBoot.value = 1; requestRender(); },
    selectNode(id) { select(id, false); },
    highlight(ids) { highlightedIds = ids == null ? null : new Set(ids); updateFocus(); },
    focusNodes(ids) {
      const points = [...(ids || [])].filter((id) => nodesById.has(id)).map((id) => new THREE.Vector3(...blendedPosition(layouts, id, weights)));
      if (!points.length) return;
      const box = new THREE.Box3().setFromPoints(points);
      const center = box.getCenter(new THREE.Vector3());
      const extent = box.getSize(new THREE.Vector3());
      const offset = camera.position.clone().sub(controls.target).normalize();
      const distance = clamp((Math.max(extent.x, extent.z) * 2.3 + 17) * (width < 760 ? Math.min(1.7, framingScale) : 1), 18, 88);
      moveCamera(center.clone().add(offset.multiplyScalar(distance)), center, 1100);
    },
    setTour(enabled) {
      tour = Boolean(enabled);
      tourStart = null;
      controls.enabled = !tour;
      renderer.domElement.style.touchAction = tour ? 'pan-y' : 'none';
      renderer.domElement.style.cursor = tour ? 'default' : 'grab';
      requestRender();
    },
    setQuality(level) {
      if (level === 'paused') { this.setPaused(true); return; }
      autoQuality = level === 'auto';
      if (autoQuality) applyQuality(width < 760 ? 'medium' : 'high');
      else applyQuality(level);
      this.setPaused(false);
    },
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      uniforms.uMotion.value = reducedMotion ? 0 : 1;
      controls.enableDamping = !reducedMotion;
      if (reducedMotion) {
        bootComplete = true;
        uniforms.uBoot.value = 1;
        if (morph) { weights = [...morph.to]; uniforms.uWeights.value.set(...weights); morph = null; }
        if (cameraMove) { camera.position.copy(cameraMove.to); controls.target.copy(cameraMove.targetTo); cameraMove = null; controls.update(); }
      }
      previousTime = 0;
      requestRender();
    },
    setPaused(value) {
      paused = Boolean(value);
      if (paused && raf) { cancelAnimationFrame(raf); raf = 0; }
      previousTime = 0;
      requestRender();
    },
    resume(value = true) { this.setPaused(!value); },
    getState() { return { selectedId, hoveredId, layout: layoutName, weights: [...weights], quality: currentQuality, reducedMotion, paused, camera: camera.position.toArray(), projected: [...projected.entries()].map(([id, point]) => ({ id, x: point.x, y: point.y, radius: point.radius })) }; },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      resizeObserver.disconnect(); intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', visibilityChange);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerdown', pointerStart);
      renderer.domElement.removeEventListener('pointerup', pointerEnd);
      renderer.domElement.removeEventListener('pointercancel', pointerEnd);
      renderer.domElement.removeEventListener('pointerleave', pointerLeave);
      controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
      renderer.dispose(); renderer.domElement.remove(); labelsLayer.remove();
    },
  };
}
