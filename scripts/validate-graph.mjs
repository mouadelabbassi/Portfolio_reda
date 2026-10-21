import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const NODE_TYPES = new Set(['Person', 'Project', 'Skill', 'Technology', 'Experience', 'Education', 'Certification', 'Contact']);
const EDGE_TYPES = new Set(['USES', 'BUILT_WITH', 'LEARNED_AT', 'PRODUCED', 'RELATED_TO']);
const ID = /^[a-z][a-z0-9-]*$/u;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

/** Only web/contact links and local PDF downloads may enter rendered content. */
export function isSafeLink(value) {
  if (!hasText(value) || /[\u0000-\u0020\u007f\\]/u.test(value)) return false;
  if (/^https:\/\//iu.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  }
  if (/^mailto:/iu.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === 'mailto:' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(decodeURIComponent(url.pathname))
        && !/%0[ad]/iu.test(value);
    } catch { return false; }
  }
  if (/^tel:/iu.test(value)) return /^tel:\+?[0-9]{5,15}$/iu.test(value);
  // Relative downloads cannot escape the static asset root or masquerade as a
  // protocol-relative URL. The deployed site serves these files itself.
  const localPath = value.split(/[?#]/u)[0];
  let decoded;
  try { decoded = decodeURIComponent(localPath); } catch { return false; }
  return !/[:\\\u0000-\u0020\u007f]/u.test(decoded)
    && !decoded.startsWith('//')
    && !decoded.split('/').includes('..')
    && /\.pdf$/iu.test(decoded);
}

/**
 * Validate the graph's documented schema and cross-reference invariants.
 * Draft placeholders are allowed only when explicit and documented; consumers
 * must render status === "verified" nodes, which the query engine enforces.
 */
export function validateGraph(graph) {
  const errors = [];
  const fail = (location, message) => errors.push(`${location}: ${message}`);
  if (!isObject(graph)) return { valid: false, errors: ['graph: expected an object'], summary: {} };
  if (graph.schemaVersion !== '1.0.0') fail('schemaVersion', 'expected 1.0.0');
  if (!['awaiting-sources', 'draft', 'verified'].includes(graph.status)) fail('status', 'expected awaiting-sources, draft, or verified');
  for (const key of ['sources', 'clusters', 'nodes', 'edges', 'tour', 'placeholders']) {
    if (!Array.isArray(graph[key])) fail(key, 'expected an array');
  }
  const sources = Array.isArray(graph.sources) ? graph.sources : [];
  const clusters = Array.isArray(graph.clusters) ? graph.clusters : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const tour = Array.isArray(graph.tour) ? graph.tour : [];
  const placeholders = Array.isArray(graph.placeholders) ? graph.placeholders : [];
  const idsFor = (items, location) => {
    const ids = new Set();
    items.forEach((item, index) => {
      if (!isObject(item)) { fail(`${location}[${index}]`, 'expected an object'); return; }
      if (typeof item.id !== 'string' || !ID.test(item.id)) fail(`${location}[${index}].id`, 'expected a lowercase kebab-case ID');
      if (ids.has(item.id)) fail(`${location}[${index}].id`, `duplicate ID ${item.id}`);
      ids.add(item.id);
    });
    return ids;
  };
  const sourceIds = idsFor(sources, 'sources');
  const clusterIds = idsFor(clusters, 'clusters');
  const nodeIds = idsFor(nodes, 'nodes');
  idsFor(edges, 'edges');
  idsFor(tour, 'tour');
  const byId = new Map(nodes.filter(isObject).map((node) => [node.id, node]));
  const checkRefs = (refs, location, required = true) => {
    if (!Array.isArray(refs)) { fail(location, 'expected evidence sourceRefs array'); return; }
    if (required && refs.length === 0) fail(location, 'verified content requires CV evidence');
    refs.forEach((ref, index) => {
      const refPath = `${location}[${index}]`;
      if (!isObject(ref)) { fail(refPath, 'expected {sourceId, locator, evidence}'); return; }
      if (!sourceIds.has(ref.sourceId)) fail(`${refPath}.sourceId`, `unknown source ${ref.sourceId}`);
      if (!hasText(ref.locator)) fail(`${refPath}.locator`, 'CV location is required');
      if (!hasText(ref.evidence)) fail(`${refPath}.evidence`, 'supporting CV text is required');
    });
  };
  const checkNodeRefs = (refs, location, { required = false, verified = false, stack = false } = {}) => {
    if (!Array.isArray(refs)) { fail(location, 'expected an array of node IDs'); return; }
    if (required && !refs.length) fail(location, 'at least one node ID is required');
    if (new Set(refs).size !== refs.length) fail(location, 'duplicate node references');
    refs.forEach((id) => {
      if (!nodeIds.has(id)) fail(location, `unknown node ${id}`);
      else if (verified && byId.get(id)?.status !== 'verified') fail(location, `node ${id} is a placeholder`);
      if (stack && byId.has(id) && !['Skill', 'Technology'].includes(byId.get(id).type)) fail(location, `stack node ${id} must be a Skill or Technology`);
    });
  };
  sources.forEach((source, index) => {
    if (!isObject(source)) return;
    if (source.kind !== 'cv') fail(`sources[${index}].kind`, 'facts must come from CV sources');
    if (!hasText(source.fileName)) fail(`sources[${index}].fileName`, 'source file name is required');
    if (source.sha256 !== undefined && !/^[a-f0-9]{64}$/iu.test(source.sha256)) fail(`sources[${index}].sha256`, 'expected a SHA-256 checksum');
  });
  if (!isObject(graph.identity) || !hasText(graph.identity.brand)) fail('identity', 'brand identity is required');
  if (graph.identity?.referenceUrl && !isSafeLink(graph.identity.referenceUrl)) fail('identity.referenceUrl', 'expected a safe HTTPS URL');
  if (!isObject(graph.profile)) fail('profile', 'expected a profile object');
  const root = byId.get(graph.profile?.personNodeId);
  if (!root || root.type !== 'Person') fail('profile.personNodeId', 'must reference the Person gateway');
  if (nodes.filter((node) => node?.type === 'Person').length !== 1) fail('nodes', 'exactly one Person gateway is required');
  if (root?.status === 'verified') {
    for (const key of ['name', 'headline', 'summary']) {
      if (!hasText(graph.profile?.[key])) fail(`profile.${key}`, 'verified profile text is required');
    }
  }
  if (graph.profile?.cvDownloadUrl !== null && graph.profile?.cvDownloadUrl !== undefined && !isSafeLink(graph.profile.cvDownloadUrl)) {
    fail('profile.cvDownloadUrl', 'expected a safe web/contact link or relative PDF path');
  }
  clusters.forEach((cluster, index) => {
    if (!isObject(cluster)) return;
    if (!hasText(cluster.name)) fail(`clusters[${index}].name`, 'cluster name is required');
    if (!/^#[a-f0-9]{6}$/iu.test(cluster.color ?? '')) fail(`clusters[${index}].color`, 'expected #RRGGBB color');
    checkNodeRefs(cluster.sourceNodeIds, `clusters[${index}].sourceNodeIds`, { required: true, verified: true });
  });
  nodes.forEach((node, index) => {
    if (!isObject(node)) return;
    const location = `nodes[${index}]`;
    if (!NODE_TYPES.has(node.type)) fail(`${location}.type`, 'unknown node type');
    if (!hasText(node.name)) fail(`${location}.name`, 'name is required');
    if (!['placeholder', 'verified'].includes(node.status)) fail(`${location}.status`, 'expected verified or placeholder');
    if (node.clusterId !== null && !clusterIds.has(node.clusterId)) fail(`${location}.clusterId`, `unknown cluster ${node.clusterId}`);
    checkRefs(node.sourceRefs, `${location}.sourceRefs`, node.status === 'verified');
    if (node.status === 'placeholder') {
      if (!/^\[PLACEHOLDER:/u.test(node.name ?? '')) fail(`${location}.name`, 'placeholder name must start [PLACEHOLDER:');
      if (Array.isArray(node.sourceRefs) && node.sourceRefs.length) fail(`${location}.sourceRefs`, 'placeholder nodes must not assert evidence');
      if (!placeholders.length) fail(location, 'placeholder nodes require a documented reason in placeholders');
      if (graph.status === 'verified') fail(location, 'a graph with placeholder nodes must be draft');
    }
    if (!isObject(node.details)) { fail(`${location}.details`, 'expected a details object'); return; }
    if (node.details.stackNodeIds !== undefined) checkNodeRefs(node.details.stackNodeIds, `${location}.details.stackNodeIds`, { verified: node.status === 'verified', stack: true });
    if (node.details.visualization !== undefined && !['waveform', 'can-frames', 'power-curve', 'sensor-stream', 'none'].includes(node.details.visualization)) fail(`${location}.details.visualization`, 'unknown visualization');
    if (node.details.links !== undefined) {
      if (!Array.isArray(node.details.links)) fail(`${location}.details.links`, 'expected an array');
      else node.details.links.forEach((link, linkIndex) => {
        const linkPath = `${location}.details.links[${linkIndex}]`;
        if (!isObject(link)) { fail(linkPath, 'expected a link object'); return; }
        if (!hasText(link.label)) fail(`${linkPath}.label`, 'label is required');
        if (!isSafeLink(link.url)) fail(`${linkPath}.url`, 'only HTTPS, mailto, validated tel, or safe relative PDF links are allowed');
        checkRefs(link.sourceRefs, `${linkPath}.sourceRefs`);
      });
    }
  });
  edges.forEach((edge, index) => {
    if (!isObject(edge)) return;
    const location = `edges[${index}]`;
    if (!EDGE_TYPES.has(edge.type)) fail(`${location}.type`, 'unknown relationship type');
    if (!nodeIds.has(edge.source)) fail(`${location}.source`, `unknown node ${edge.source}`);
    if (!nodeIds.has(edge.target)) fail(`${location}.target`, `unknown node ${edge.target}`);
    if (!Number.isFinite(edge.weight) || edge.weight < 0 || edge.weight > 1) fail(`${location}.weight`, 'expected a finite number between 0 and 1');
    if (edge.status !== undefined && !['verified', 'placeholder'].includes(edge.status)) fail(`${location}.status`, 'expected verified or placeholder');
    const verified = edge.status !== 'placeholder';
    checkRefs(edge.sourceRefs, `${location}.sourceRefs`, verified);
    if (verified) {
      for (const endpoint of ['source', 'target']) {
        if (byId.has(edge[endpoint]) && byId.get(edge[endpoint]).status !== 'verified') fail(`${location}.${endpoint}`, 'verified relationships cannot reference placeholders');
      }
    } else if (!placeholders.length || graph.status === 'verified') fail(location, 'placeholder edges require a draft graph and documented reason');
  });
  tour.forEach((stop, index) => {
    if (!isObject(stop)) return;
    if (!hasText(stop.title)) fail(`tour[${index}].title`, 'title is required');
    checkNodeRefs(stop.nodeIds, `tour[${index}].nodeIds`, { required: true, verified: true });
  });
  placeholders.forEach((placeholder, index) => {
    if (!isObject(placeholder) || !hasText(placeholder.path) || !hasText(placeholder.reason)) fail(`placeholders[${index}]`, 'expected a path and a reason');
  });
  const counts = {};
  for (const node of nodes.filter((node) => node?.status === 'verified')) counts[node.type] = (counts[node.type] ?? 0) + 1;
  const summary = {
    status: graph.status,
    sources: sources.length,
    verifiedNodes: nodes.filter((node) => node?.status === 'verified').length,
    placeholderNodes: nodes.filter((node) => node?.status === 'placeholder').length,
    relationships: edges.length,
    clusters: clusters.length,
    counts,
  };
  return { valid: errors.length === 0, errors, summary };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const graphPath = process.argv[2] ?? fileURLToPath(new URL('../data/graph.json', import.meta.url));
  try {
    const graph = JSON.parse(await readFile(graphPath, 'utf8'));
    const result = validateGraph(graph);
    if (!result.valid) {
      console.error(`Graph validation failed (${result.errors.length}):\n${result.errors.map((error) => `  • ${error}`).join('\n')}`);
      process.exitCode = 1;
    } else {
      console.log(`Graph valid: ${result.summary.verifiedNodes} verified nodes, ${result.summary.relationships} relationships, ${result.summary.sources} CV sources, ${result.summary.clusters} clusters.`);
      console.log(Object.entries(result.summary.counts).map(([type, count]) => `${type}: ${count}`).join(' · '));
      if (result.summary.placeholderNodes) console.log(`${result.summary.placeholderNodes} documented draft placeholders are hidden from production content.`);
    }
  } catch (error) {
    console.error(`Unable to validate ${graphPath}: ${error.message}`);
    process.exitCode = 1;
  }
}
