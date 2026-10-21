import test from 'node:test';
import assert from 'node:assert/strict';
import { Color } from 'three';
import { makeAssembly, createTraceGeometry } from '../src/scene.js';
import { createLayouts } from '../src/layouts.js';
import { traceVertex } from '../src/shaders.js';
import { readFileSync } from 'node:fs';

for (const kind of ['person', 'experience', 'project', 'education', 'certification', 'skill', 'contact']) {
  test(`${kind} assembly merges into renderable geometry`, () => {
    const geometry = makeAssembly(kind);
    try {
      const count = geometry.getAttribute('position').count;
      assert.ok(count > 0);
      for (const name of ['normal', 'uv', 'aSurface']) {
        assert.equal(geometry.getAttribute(name).count, count);
      }
      assert.ok(Number.isFinite(geometry.boundingSphere.radius));
      assert.ok(geometry.boundingSphere.radius > 0);
    } finally {
      geometry.dispose();
    }
  });
}

test('connection geometry fits the attribute budget and preserves zero-weight links', () => {
  const graph = JSON.parse(readFileSync(new URL('../data/graph.json', import.meta.url), 'utf8'));
  graph.edges[0].weight = 0;
  const { geometry, edgeRanges } = createTraceGeometry(graph, createLayouts(graph), () => new Color('#c9f57a'));
  try {
    const count = geometry.getAttribute('position').count;
    assert.ok(count > 0);
    // Reserve room below WebGL2's 16 slots for renderer/driver attributes.
    assert.ok(Object.keys(geometry.attributes).length <= 14);
    for (const [, name] of traceVertex.matchAll(/attribute\s+\w+\s+(\w+);/g)) {
      assert.equal(geometry.getAttribute(name).count, count, name);
    }
    const style = geometry.getAttribute('aStyle');
    assert.equal(style.getX(0), -1);
    assert.equal(style.getX(1), 1);
    for (let i = 0; i < edgeRanges[0].count; i++) assert.equal(style.getZ(i), 0);
    assert.equal(edgeRanges.length, graph.edges.length);
  } finally {
    geometry.dispose();
  }
});
