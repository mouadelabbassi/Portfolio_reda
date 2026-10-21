// Every arrangement is derived from the graph. Stable hashes keep exported
// datasets, pointer targets and GPU morphs in the same deterministic space.
export const LAYOUT_NAMES = ['network', 'vehicle', 'schematic'];

export function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function nodeKind(node) {
  const type = String(node.type || '').toLowerCase();
  if (/person|profile|identity/.test(type)) return 'person';
  if (/experience|employment|internship|work/.test(type)) return 'experience';
  if (/project|system|achievement/.test(type)) return 'project';
  if (/education|degree|university/.test(type)) return 'education';
  if (/certification|certificate/.test(type)) return 'certification';
  if (/contact/.test(type)) return 'contact';
  return 'skill';
}

const KIND_ORDER = { person: 0, experience: 1, project: 2, education: 3, certification: 4, skill: 5, contact: 6 };

export function createLayouts(graph) {
  const nodes = graph.nodes || [];
  const clusters = (graph.clusters || []).map((cluster) => ({ ...cluster, id: String(cluster.id) }));
  const gateway = nodes.find((node) => nodeKind(node) === 'person') || nodes[0];
  for (const node of nodes) {
    if (!node.clusterId && !node.cluster) continue;
    const id = String(node.clusterId || node.cluster);
    if (node !== gateway && !clusters.some((cluster) => cluster.id === id)) clusters.push({ id, name: id, color: '#73c8c2' });
  }
  if (!clusters.length) clusters.push({ id: 'systems', name: 'Systems', color: '#c9f57a' });
  const maps = { network: new Map(), vehicle: new Map(), schematic: new Map() };
  const anchors = { network: [], vehicle: [], schematic: [] };
  if (gateway) {
    maps.network.set(gateway.id, [0, 0.6, 0]);
    maps.vehicle.set(gateway.id, [0, 0.65, 0]);
    maps.schematic.set(gateway.id, [0, 0.52, 6.5]);
  }
  const clusterCount = clusters.length;
  clusters.forEach((cluster, clusterIndex) => {
    const members = nodes.filter((node) => node !== gateway && String(node.clusterId || node.cluster || '') === cluster.id)
      .sort((a, b) => (KIND_ORDER[nodeKind(a)] - KIND_ORDER[nodeKind(b)]) || String(a.id).localeCompare(String(b.id)));
    const angle = -Math.PI * 0.77 + (clusterIndex / clusterCount) * Math.PI * 2;
    // Four quadrants read like separate PCBs, connected to one central ECU.
    const networkAnchor = [Math.cos(angle) * 8.4, 0, Math.sin(angle) * 6.4];
    const vehicleAngle = -Math.PI * 0.88 + (clusterIndex / Math.max(1, clusterCount - 1)) * Math.PI * 1.76;
    const vehicleAnchor = [Math.cos(vehicleAngle) * 6.3, 0, Math.sin(vehicleAngle) * 2.25];
    const columns = Math.min(clusterCount, 4);
    const column = clusterIndex % columns;
    const row = Math.floor(clusterIndex / columns);
    const schematicAnchor = [(column - (columns - 1) / 2) * 6.1, 0, -2.1 - row * 9];
    anchors.network.push({ ...cluster, position: networkAnchor });
    anchors.vehicle.push({ ...cluster, position: vehicleAnchor });
    anchors.schematic.push({ ...cluster, position: schematicAnchor });
    members.forEach((node, index) => {
      const kind = nodeKind(node);
      const important = kind !== 'skill' && kind !== 'certification';
      const columnCount = members.length > 7 ? 3 : 2;
      const memberRow = Math.floor(index / columnCount);
      const memberColumn = index % columnCount;
      const rowCount = Math.ceil(members.length / columnCount);
      const nx = (memberColumn - (columnCount - 1) / 2) * 2.15;
      const nz = (memberRow - (rowCount - 1) / 2) * 1.65;
      const jitter = (hashString(node.id) - 0.5) * 0.22;
      const height = important ? 0.48 : 0.25;
      maps.network.set(node.id, [networkAnchor[0] + nx, height + jitter, networkAnchor[2] + nz]);
      const vehicleColumns = 2;
      const vx = (Math.floor(index / vehicleColumns) - (Math.ceil(members.length / vehicleColumns) - 1) / 2) * 1.28;
      const vz = (index % vehicleColumns - 0.5) * 1.08;
      maps.vehicle.set(node.id, [vehicleAnchor[0] + vx, height * 0.72, vehicleAnchor[2] + vz]);
      maps.schematic.set(node.id, [schematicAnchor[0] + (memberColumn - (columnCount - 1) / 2) * 1.8, 0.28, schematicAnchor[2] + memberRow * 1.65]);
    });
  });
  const auxiliary = nodes.filter((node) => node !== gateway && !node.clusterId && !node.cluster)
    .sort((a, b) => (KIND_ORDER[nodeKind(a)] - KIND_ORDER[nodeKind(b)]) || String(a.id).localeCompare(String(b.id)));
  auxiliary.forEach((node, index) => {
    const angle = index / Math.max(1, auxiliary.length) * Math.PI * 2 + Math.PI * 0.125;
    maps.network.set(node.id, [Math.cos(angle) * 3.2, 0.28, Math.sin(angle) * 2.7]);
    const side = index % 2 ? 1 : -1;
    maps.vehicle.set(node.id, [side * (1.6 + Math.floor(index / 2) * 1.45), 0.25, side * 0.6]);
    maps.schematic.set(node.id, [(index - (auxiliary.length - 1) / 2) * 1.72, 0.25, 7.0]);
  });
  // Gracefully handle incomplete cluster metadata and an empty graph.
  nodes.forEach((node, index) => {
    LAYOUT_NAMES.forEach((name) => {
      if (!maps[name].has(node.id)) maps[name].set(node.id, [(index % 5 - 2) * 2, 0.3, Math.floor(index / 5) * 2]);
    });
  });
  return { maps, anchors, gatewayId: gateway?.id, clusters };
}

export function blendedPosition(layouts, id, weights) {
  const output = [0, 0, 0];
  LAYOUT_NAMES.forEach((name, index) => {
    const point = layouts.maps[name].get(id) || [0, 0, 0];
    for (let component = 0; component < 3; component++) output[component] += point[component] * weights[index];
  });
  return output;
}

// Each mode has the same path topology, so even the 90-degree PCB routes
// interpolate on the GPU without replacing their geometry.
export function routedPath(source, target, seed, edgeIndex = 0) {
  const lane = (seed - 0.5) * 0.8;
  const plane = -0.08 - (edgeIndex % 4) * 0.035;
  const useX = Math.abs(source[0] - target[0]) > Math.abs(source[2] - target[2]);
  if (useX) {
    const midpoint = (source[0] + target[0]) / 2 + lane;
    return [source, [source[0], plane, source[2]], [midpoint, plane, source[2]], [midpoint, plane, target[2]], [target[0], plane, target[2]], target];
  }
  const midpoint = (source[2] + target[2]) / 2 + lane;
  return [source, [source[0], plane, source[2]], [source[0], plane, midpoint], [target[0], plane, midpoint], [target[0], plane, target[2]], target];
}
