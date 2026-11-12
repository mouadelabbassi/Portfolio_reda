import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateGraph, isSafeLink } from '../scripts/validate-graph.mjs';
const graph = JSON.parse(readFileSync(new URL('../data/graph.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../public/projects/4s-bms.html', import.meta.url), 'utf8');
test('4S BMS has its own project node, retains the SOH predictor, and validates', () => {
 const result = validateGraph(graph);
 assert.equal(result.valid,true,result.errors.join('\n'));
 assert.ok(graph.nodes.some(n=>n.id==='project-bms' && /XGBoost/u.test(n.details.summary)));
 const node=graph.nodes.find(n=>n.id==='project-4s-bms');
 assert.equal(node.type,'Project');
 assert.equal(node.details.stackNodeIds.length,7);
 assert.equal(node.details.links[0].url,'/projects/4s-bms.html');
 assert.ok(graph.tour.find(x=>x.id==='tour-projects').nodeIds.includes(node.id));
});
test('case study contains all six sections and does not claim hardware results', () => {
 for(const id of ['objective','hardware','simulation','scenarios','cockpit','skills'])assert.ok(html.includes('id="'+id+'"'));
 for(const label of ['16.8 V','10 A','BQ76942','KiCad','MATLAB','Simulink','PNG','hardware implementation pending'])assert.ok(html.toLowerCase().includes(label.toLowerCase()),label);
 assert.match(html,/not supplied yet/u);
 assert.match(html,/not live hardware data/u);
});
test('only approved same-origin case-study route is accepted as HTML', () => {
 assert.equal(isSafeLink('/projects/4s-bms.html'),true);
 assert.equal(isSafeLink('/random.html'),false);
 assert.equal(isSafeLink('/projects/../private.html'),false);
});
