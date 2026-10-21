import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { createLayouts } from '../src/layouts.js';
import { getSuggestions, runQuery } from '../src/query.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = path.join(projectRoot, 'dist');
const KiB = 1024;
const BUDGETS = { eagerInitialGzipBytes: 70 * KiB, totalJavaScriptGzipBytes: 180 * KiB };
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const decodeHTML = (value) => value.replace(/&(?:amp|quot|apos|lt|gt|#39);/gu, (entity) => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&#39;': "'" }[entity]));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const slash = (value) => value.split(path.sep).join('/');
const relative = (absolute) => slash(path.relative(distRoot, absolute));
const localFile = (reference, parent = path.join(distRoot, 'index.html')) => {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/iu.test(reference)) return null;
  const bare = reference.split(/[?#]/u)[0];
  if (!bare) return null;
  const resolved = path.resolve(reference.startsWith('/') ? distRoot : path.dirname(parent), `.${reference.startsWith('/') ? '' : '/'}${bare}`);
  const fromRoot = path.relative(distRoot, resolved);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) throw new Error(`Asset escapes dist/: ${reference}`);
  return resolved;
};

function attributes(tag) {
  const output = {};
  for (const match of tag.matchAll(/\b([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/giu)) output[match[1].toLowerCase()] = decodeHTML(match[2] ?? match[3]);
  return output;
}

/** Static import graph only: dynamic import() chunks are measured separately. */
function staticImports(source) {
  const imports = [];
  for (const match of source.matchAll(/\bimport\s*(?:(?:[^('"`;]*?)\bfrom\s*)?(['"])([^'"]+)\1/gu)) imports.push(match[2]);
  for (const match of source.matchAll(/\bexport\s*[^'"`;]*?\bfrom\s*(['"])([^'"]+)\1/gu)) imports.push(match[2]);
  return imports;
}

function benchmark(name, operation, { samples = 120, batch = 20, warmup = 100 } = {}) {
  let checksum = 0;
  for (let i = 0; i < warmup; i++) checksum += operation();
  const timings = [];
  for (let sample = 0; sample < samples; sample++) {
    const start = performance.now();
    for (let i = 0; i < batch; i++) checksum += operation();
    timings.push((performance.now() - start) / batch);
  }
  timings.sort((a, b) => a - b);
  return {
    name,
    unit: 'milliseconds per operation',
    medianMs: Number(timings[Math.floor(timings.length * 0.5)].toFixed(5)),
    p95Ms: Number(timings[Math.ceil(timings.length * 0.95) - 1].toFixed(5)),
    samples, operationsPerSample: batch, warmupOperations: warmup, checksum,
  };
}

export async function checkPerformance() {
  const files = await walk(distRoot); // A missing build must fail visibly.
  const htmlPath = path.join(distRoot, 'index.html');
  if (!files.includes(htmlPath)) throw new Error('dist/index.html is missing. Run npm run build first.');
  const graph = JSON.parse(await readFile(path.join(projectRoot, 'data', 'graph.json'), 'utf8'));
  const html = await readFile(htmlPath, 'utf8');
  const assets = new Map();
  for (const file of files.filter((file) => /\.(?:m?js|css|html)$/iu.test(file))) {
    const buffer = await readFile(file);
    assets.set(file, { file: relative(file), bytes: buffer.length, gzipBytes: gzipSync(buffer, { level: 9 }).length, source: buffer.toString('utf8') });
  }
  const javaScript = [...assets.values()].filter((asset) => /\.m?js$/iu.test(asset.file));
  const css = [...assets.values()].filter((asset) => /\.css$/iu.test(asset.file));
  const htmlAssets = [...assets.values()].filter((asset) => /\.html$/iu.test(asset.file));
  if (!javaScript.length || !css.length) throw new Error('Expected built JavaScript and CSS assets in dist/.');

  const eagerScripts = new Set();
  const eagerStyles = new Set();
  const modulepreloads = [];
  const queue = [];
  const checks = [];
  const verified = graph.nodes.filter((node) => node.status === 'verified');
  const contactURLs = new Set(verified.filter((node) => node.type === 'Contact').flatMap((node) => node.details?.links ?? []).map((link) => link.url));
  const knownFiles = new Set(files);
  let inlineScriptCount = 0;
  for (const match of html.matchAll(/<(script|link|a|img|iframe|audio|video|source)\b[^>]*>/giu)) {
    const tagName = match[1].toLowerCase();
    const attr = attributes(match[0]);
    const reference = attr.src ?? attr.href;
    if (tagName === 'script' && !attr.src) inlineScriptCount += 1;
    if (reference) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(reference)) {
        if (!(tagName === 'a' && contactURLs.has(reference))) checks.push(`Unexpected external ${tagName} URL: ${reference}`);
      } else {
        const resolved = localFile(reference);
        if (resolved && !knownFiles.has(resolved)) checks.push(`Missing built asset: ${reference}`);
      }
    }
    if (tagName === 'script' && attr.src) {
      const file = localFile(attr.src);
      if (file) queue.push(file);
    }
    if (tagName === 'link' && attr.href) {
      const file = localFile(attr.href);
      if (file && (attr.rel ?? '').split(/\s/u).includes('modulepreload')) { queue.push(file); modulepreloads.push(relative(file)); }
      if (file && (attr.rel ?? '').split(/\s/u).includes('stylesheet')) eagerStyles.add(file);
    }
  }
  if (inlineScriptCount) checks.push(`${inlineScriptCount} unexpected inline script tag(s)`);
  if (/<[^>]+\son[a-z]+\s*=/iu.test(html)) checks.push('Unexpected inline event handler in built HTML');
  for (const node of verified) if (!html.includes(escapeHTML(node.name))) checks.push(`Verified name missing from prerendered HTML: ${node.id}`);
  for (const node of graph.nodes.filter((node) => node.status === 'placeholder')) if (html.includes(escapeHTML(node.name))) checks.push(`Placeholder name leaked into HTML: ${node.id}`);
  while (queue.length) {
    const file = queue.shift();
    if (eagerScripts.has(file)) continue;
    const asset = assets.get(file);
    if (!asset) throw new Error(`Missing eager JavaScript asset ${relative(file)}`);
    eagerScripts.add(file);
    for (const reference of staticImports(asset.source)) {
      const dependency = localFile(reference, file);
      if (dependency) queue.push(dependency);
      else checks.push(`External JavaScript import in ${asset.file}: ${reference}`);
    }
  }
  for (const file of eagerStyles) if (!assets.has(file)) throw new Error(`Missing stylesheet ${relative(file)}`);
  const total = (items, key) => items.reduce((sum, asset) => sum + asset[key], 0);
  const eagerGzip = assets.get(htmlPath).gzipBytes + total([...eagerScripts, ...eagerStyles].map((file) => assets.get(file)), 'gzipBytes');
  const totalJsGzip = total(javaScript, 'gzipBytes');
  const budgets = [
    { name: 'Eager HTML + CSS + JavaScript', bytes: eagerGzip, limitBytes: BUDGETS.eagerInitialGzipBytes, pass: eagerGzip <= BUDGETS.eagerInitialGzipBytes },
    { name: 'All JavaScript chunks', bytes: totalJsGzip, limitBytes: BUDGETS.totalJavaScriptGzipBytes, pass: totalJsGzip <= BUDGETS.totalJavaScriptGzipBytes },
  ];
  const queries = ['projects', 'skills', 'experience', 'hire me', 'CAN', 'MATCH (p:Project) RETURN p', ...getSuggestions(graph).map((suggestion) => suggestion.query)];
  for (const query of queries) if (runQuery(query, graph).error) throw new Error(`Representative benchmark query failed: ${query}`);
  let queryCursor = 0;
  const cpu = [
    benchmark('Create all three graph layouts', () => createLayouts(graph).maps.network.size),
    benchmark('Representative diagnostic queries', () => runQuery(queries[queryCursor++ % queries.length], graph).ids.length, { batch: 100, warmup: 250 }),
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, architecture: process.arch, graphNodes: verified.length, graphRelationships: graph.edges.length },
    passed: budgets.every((budget) => budget.pass) && checks.length === 0,
    scope: 'Static build sizes and CPU-only Node microbenchmarks. No browser, GPU, FPS, Lighthouse or mobile-device performance was measured.',
    budgets,
    totals: {
      javaScript: { bytes: total(javaScript, 'bytes'), gzipBytes: totalJsGzip },
      css: { bytes: total(css, 'bytes'), gzipBytes: total(css, 'gzipBytes') },
      html: { bytes: total(htmlAssets, 'bytes'), gzipBytes: total(htmlAssets, 'gzipBytes') },
      eagerInitialGzipBytes: eagerGzip,
      allHtmlCssJavaScriptGzipBytes: total([...javaScript, ...css, ...htmlAssets], 'gzipBytes'),
    },
    eagerJavaScript: [...eagerScripts].map(relative),
    modulepreloads,
    sceneChunks: javaScript.filter((asset) => /(?:^|\/)scene-/u.test(asset.file)).map(({ source, ...asset }) => ({ ...asset, eager: eagerScripts.has(path.join(distRoot, asset.file)) })),
    splitJavaScript: javaScript.filter((asset) => !eagerScripts.has(path.join(distRoot, asset.file))).map(({ source, ...asset }) => asset),
    startupNote: 'The scene is split into dynamic chunks, but main.js requests it during bootstrap. The eager budget excludes dynamic chunks; the full HTML/CSS/JavaScript total shows the complete startup transfer upper bound.',
    contentChecks: { verifiedNamesChecked: verified.length, inlineScriptCount, unexpectedReferences: checks, pass: checks.length === 0 },
    cpu,
  };
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await checkPerformance();
    const format = (bytes) => `${(bytes / KiB).toFixed(2)} KiB`;
    console.log('Static build performance check (gzip level 9)');
    for (const budget of report.budgets) console.log(`${budget.pass ? 'PASS' : 'FAIL'}  ${budget.name}: ${format(budget.bytes)} / ${format(budget.limitBytes)}`);
    console.log(`Totals: JS ${format(report.totals.javaScript.gzipBytes)} · CSS ${format(report.totals.css.gzipBytes)} · HTML ${format(report.totals.html.gzipBytes)}`);
    console.log(`Complete HTML/CSS/JS transfer: ${format(report.totals.allHtmlCssJavaScriptGzipBytes)}`);
    console.log(`HTML modulepreloads: ${report.modulepreloads.length ? report.modulepreloads.join(', ') : 'none'}`);
    for (const asset of report.sceneChunks) console.log(`Scene chunk: ${asset.file} · ${format(asset.gzipBytes)} gzip · ${asset.eager ? 'eager' : 'dynamic split'}`);
    console.log(`${report.contentChecks.pass ? 'PASS' : 'FAIL'}  Prerendered content and reference checks: ${report.contentChecks.verifiedNamesChecked} verified names`);
    for (const issue of report.contentChecks.unexpectedReferences) console.error(`  ${issue}`);
    for (const result of report.cpu) console.log(`CPU only — ${result.name}: median ${result.medianMs.toFixed(5)} ms · p95 ${result.p95Ms.toFixed(5)} ms`);
    console.log(report.startupNote);
    console.log(report.scope);
    if (process.argv.includes('--report')) {
      const reportDirectory = path.join(projectRoot, 'work');
      await mkdir(reportDirectory, { recursive: true });
      await writeFile(path.join(reportDirectory, 'perf-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      console.log('Saved work/perf-report.json');
    }
    if (!report.passed) process.exitCode = 1;
  } catch (error) {
    console.error(`Performance check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
