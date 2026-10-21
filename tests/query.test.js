import test from 'node:test';
import assert from 'node:assert/strict';
import { getSuggestions, runQuery } from '../src/query.js';
import { isSafeLink, validateGraph } from '../scripts/validate-graph.mjs';

// Synthetic fixture: these names, relationships and evidence are parser test
// data, unrelated to the portfolio owner or the supplied CVs.
function fixture() {
  const evidence = [{ sourceId: 'demo-cv', locator: 'Synthetic fixture, page 1', evidence: 'Fictional parser test evidence only.' }];
  const node = (id, type, name) => ({ id, type, name, status: 'verified', clusterId: null, sourceRefs: structuredClone(evidence), details: {} });
  const edge = (id, source, target, type = 'USES') => ({ id, source, target, type, weight: 0.75, sourceRefs: structuredClone(evidence) });
  return {
    schemaVersion: '1.0.0', status: 'verified',
    identity: { brand: 'TEST ONLY', referenceUrl: 'https://example.org', source: 'user-brief' },
    sources: [{ id: 'demo-cv', kind: 'cv', fileName: 'synthetic-fixture.pdf' }],
    profile: { personNodeId: 'demo-person', name: 'Demo Engineer', headline: 'Synthetic profile', summary: 'Test data only', cvDownloadUrl: '/demo-cv.pdf' },
    clusters: [],
    nodes: [
      node('demo-person', 'Person', 'Demo Engineer'),
      node('demo-project', 'Project', 'Signal Rig'),
      node('demo-project-two', 'Project', 'Other Rig'),
      node('demo-can', 'Skill', 'CAN'),
      node('demo-c', 'Skill', 'C'),
      node('demo-quoted', 'Skill', 'O\'Brien "signal"'),
      node('demo-tool', 'Technology', 'Oscilloscope'),
      node('demo-experience', 'Experience', 'Demo Laboratory'),
      node('demo-education', 'Education', 'Demo School'),
      node('demo-cert', 'Certification', 'Demo Certificate'),
      node('demo-contact', 'Contact', 'Demo email'),
    ],
    edges: [
      edge('demo-project-uses-can', 'demo-project', 'demo-can'),
      edge('demo-project-uses-can-duplicate', 'demo-project', 'demo-can'),
      edge('demo-experience-uses-can', 'demo-experience', 'demo-can'),
      edge('demo-project-built-with-tool', 'demo-project', 'demo-tool', 'BUILT_WITH'),
    ],
    tour: [{ id: 'demo-tour', title: 'Synthetic stop', nodeIds: ['demo-person'] }],
    placeholders: [],
  };
}

test('shortcuts return verified categories, normalized whitespace, and contact intent', () => {
  const graph = fixture();
  assert.deepEqual(runQuery('  PROJECTS  ', graph).ids, ['demo-project', 'demo-project-two']);
  assert.deepEqual(runQuery('hire   me', graph).ids, ['demo-contact']);
  assert.deepEqual(runQuery('tools', graph).ids, ['demo-tool']);
  assert.deepEqual(runQuery('education', graph).ids, ['demo-education']);
  assert.deepEqual(runQuery('certifications', graph).ids, ['demo-cert']);
  assert.equal(runQuery('all', graph).ids.length, graph.nodes.length);
});

test('plain search is case insensitive substring search; name filters are exact', () => {
  const graph = fixture();
  assert.deepEqual(runQuery('rIg', graph).ids, ['demo-project', 'demo-project-two']);
  assert.deepEqual(runQuery('MATCH (s:Skill {name:"c"}) RETURN s', graph).ids, ['demo-c']);
  assert.deepEqual(runQuery('MATCH (s:Skill {name:"CA"}) RETURN s', graph).ids, []);
});

test('single-node grammar handles casing, arbitrary whitespace, quotes, and semicolon', () => {
  const graph = fixture();
  assert.deepEqual(runQuery('\n mAtCh ( p : pRoJeCt )\n RETURN p ; ', graph).ids, ['demo-project', 'demo-project-two']);
  assert.deepEqual(runQuery("MATCH (s:Skill {name:'can'}) RETURN s", graph).ids, ['demo-can']);
  assert.deepEqual(runQuery('MATCH (n:Tech) RETURN n', graph).ids, ['demo-tool']);
  assert.deepEqual(runQuery('MATCH (n:Tool) RETURN n', graph).ids, ['demo-tool']);
  const escaped = `MATCH (s:Skill {name:${JSON.stringify('O\'Brien "signal"')}}) RETURN s`;
  assert.deepEqual(runQuery(escaped, graph).ids, ['demo-quoted']);
});

test('a relationship query respects type, direction, endpoint filters and returned variable', () => {
  const graph = fixture();
  assert.deepEqual(runQuery('MATCH (p:Project)-[:USES]->(s:Skill {name:"CAN"}) RETURN p', graph).ids, ['demo-project']);
  assert.deepEqual(runQuery('MATCH (p:Project)-[:USES]->(s:Skill {name:"CAN"}) RETURN s', graph).ids, ['demo-can']);
  assert.deepEqual(runQuery('MATCH (s:Skill {name:"CAN"})<-[:USES]-(p:Project) RETURN p', graph).ids, ['demo-project']);
  assert.deepEqual(runQuery('MATCH (s:Skill {name:"CAN"})-[:USES]-(p:Project) RETURN p', graph).ids, ['demo-project']);
  assert.deepEqual(runQuery('MATCH (s:Skill {name:"CAN"})-[:USES]->(p:Project) RETURN p', graph).ids, []);
  assert.deepEqual(runQuery('MATCH (p:Project)-[:BUILT_WITH]->(t:Technology) RETURN t', graph).ids, ['demo-tool']);
});

test('valid zero results are not confused with syntax errors', () => {
  const graph = fixture();
  const empty = runQuery('MATCH (s:Skill {name:"No such skill"}) RETURN s', graph);
  assert.deepEqual(empty.ids, []);
  assert.equal(empty.error, undefined);
  assert.match(empty.message, /No verified/u);
  const malformed = runQuery('MATCH (p:Project) RETURN missing', graph);
  assert.equal(malformed.error, true);
  assert.match(malformed.message, /bound node variable/u);
});

test('unsupported or malformed syntax recovers without executing code', () => {
  const graph = fixture();
  const invalid = [
    'MATCH (p:Unknown) RETURN p',
    'MATCH (p:Project) RETURN P',
    'MATCH (p:Project) RETURN p, p',
    'MATCH (p:Project) RETURN *',
    'MATCH (:Project) RETURN p',
    'MATCH (p) RETURN p',
    'MATCH (p:Project {name:CAN}) RETURN p',
    'MATCH (p:Project {id:"demo-project"}) RETURN p',
    'MATCH (p:Project {name:"open}) RETURN p',
    'MATCH (p:Project)-[:OWNS]->(s:Skill) RETURN p',
    'MATCH (p:Project)<-[:USES]->(s:Skill) RETURN p',
    'MATCH (p:Project)-[:USES]->(p:Skill) RETURN p',
    'MATCH (p:Project)-[:USES]->(s:Skill)-[:USES]->(t:Skill) RETURN p',
    'MATCH (p:Project) RETURN p; DELETE p',
    'MATCH (p:Project) WHERE p.name = "test" RETURN p',
    'CREATE (p:Project)',
    'globalThis.queryTestSideEffect = true; RETURN p',
    null, {}, 'x'.repeat(2001),
  ];
  for (const query of invalid) {
    const result = runQuery(query, graph);
    assert.equal(result.error, true, `should reject ${String(query)}`);
    assert.deepEqual(result.ids, []);
    assert.ok(result.message.length > 10);
  }
  assert.equal(globalThis.queryTestSideEffect, undefined);
  assert.equal(runQuery('', graph).error, undefined);
  assert.doesNotThrow(() => runQuery('projects', null));
});

test('placeholders and relationships touching them are excluded from query results', () => {
  const graph = fixture();
  graph.nodes.find((node) => node.id === 'demo-project').status = 'placeholder';
  assert.deepEqual(runQuery('projects', graph).ids, ['demo-project-two']);
  assert.deepEqual(runQuery('MATCH (p:Project)-[:USES]->(s:Skill) RETURN s', graph).ids, []);
  assert.ok(!runQuery('all', graph).ids.includes('demo-project'));
});

test('five suggestions use present categories and a real automotive skill', () => {
  const graph = fixture();
  const suggestions = getSuggestions(graph);
  assert.equal(suggestions.length, 5);
  assert.equal(new Set(suggestions.map((suggestion) => suggestion.query)).size, 5);
  assert.ok(suggestions.some(({ query }) => query === 'projects'));
  assert.ok(suggestions.some(({ query }) => query === 'skills'));
  assert.ok(suggestions.some(({ query }) => query === 'experience'));
  assert.ok(suggestions.some(({ query }) => query.includes('"CAN"')));
  assert.ok(suggestions.some(({ query }) => query === 'contact'));
  for (const { query } of suggestions) {
    const result = runQuery(query, graph);
    assert.equal(result.error, undefined);
    assert.ok(result.ids.length > 0, `suggested query must have evidence: ${query}`);
  }
});

test('sparse suggestions do not invent CAN, certifications or other missing data', () => {
  const graph = fixture();
  graph.nodes = graph.nodes.filter((node) => node.type === 'Person');
  graph.edges = [];
  const suggestions = getSuggestions(graph);
  assert.equal(suggestions.length, 5);
  assert.ok(!suggestions.some(({ query }) => /CAN|Certification|Project|Skill/u.test(query)));
  assert.ok(suggestions.every(({ query }) => !runQuery(query, graph).error));
});

test('graph validation accepts a fully evidenced graph and summarizes verified types', () => {
  const result = validateGraph(fixture());
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.summary.verifiedNodes, 11);
  assert.equal(result.summary.counts.Project, 2);
});

test('graph validation catches duplicate IDs, dangling relations and invalid weights', () => {
  const graph = fixture();
  graph.nodes.push(structuredClone(graph.nodes[0]));
  graph.edges[0].target = 'missing';
  graph.edges[1].weight = Infinity;
  graph.profile.personNodeId = 'demo-can';
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  for (const expected of [/duplicate ID/u, /unknown node missing/u, /finite number/u, /Person gateway/u]) {
    assert.match(result.errors.join('\n'), expected);
  }
});

test('graph validation requires usable evidence for nodes, relationships and links', () => {
  const graph = fixture();
  graph.nodes[1].sourceRefs = [];
  graph.edges[0].sourceRefs[0].sourceId = 'missing-source';
  graph.nodes.at(-1).details.links = [{ label: 'Demo', url: 'https://example.org', sourceRefs: [] }];
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /verified content requires CV evidence/u);
  assert.match(result.errors.join('\n'), /unknown source missing-source/u);
});

test('graph validation rejects references to hidden content and missing stack IDs', () => {
  const graph = fixture();
  graph.nodes.find((node) => node.id === 'demo-can').status = 'placeholder';
  graph.nodes[1].details.stackNodeIds = ['does-not-exist'];
  const result = validateGraph(graph);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unknown node does-not-exist/u);
  assert.match(result.errors.join('\n'), /verified relationships cannot reference placeholders/u);
});

test('a documented draft placeholder can build, without becoming public content', () => {
  const graph = fixture();
  graph.status = 'draft';
  graph.nodes = [{ id: 'demo-person', type: 'Person', name: '[PLACEHOLDER: CV name]', status: 'placeholder', clusterId: null, sourceRefs: [], details: {} }];
  graph.sources = [];
  graph.edges = [];
  graph.tour = [];
  graph.profile = { personNodeId: 'demo-person', name: null, headline: null, summary: null, cvDownloadUrl: null };
  graph.placeholders = [{ path: 'nodes', reason: 'Synthetic draft, awaiting a fictional CV.' }];
  const result = validateGraph(graph);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.summary.placeholderNodes, 1);
  assert.deepEqual(runQuery('all', graph).ids, []);
  graph.placeholders = [];
  assert.equal(validateGraph(graph).valid, false);
});

test('safe link validation rejects executable, external-relative and traversal URLs', () => {
  for (const link of ['https://example.org/profile', 'mailto:demo@example.org', 'tel:+12025550123', '/cv/demo.pdf', './cv.pdf', 'cv.pdf']) {
    assert.equal(isSafeLink(link), true, link);
  }
  for (const link of [
    'javascript:alert(1)', 'data:text/html,test', 'http://example.org', '//evil.example/cv.pdf',
    '../cv.pdf', '/cv/../private.pdf', '/%2e%2e/private.pdf', '/%2f%2fevil.example/cv.pdf',
    'https://user:password@example.org', 'mailto:demo@example.org%0aBcc:evil@example.org',
    'C:\\private.pdf', '/cv\\private.pdf', 'https://example.org/\nmalformed',
    'tel:javascript:alert(1)', 'tel:123', 'tel:+12025550123;ext=1',
  ]) assert.equal(isSafeLink(link), false, link);
  const graph = fixture();
  graph.profile.cvDownloadUrl = 'javascript:alert(1)';
  assert.equal(validateGraph(graph).valid, false);
});
