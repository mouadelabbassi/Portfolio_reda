# ME/SIGNAL — Rida Faradi

A Vite + Three.js portfolio built as a vehicle electrical knowledge graph. Source code is in `C:\Users\Administrator\Downloads\portfolio`.

The destination was empty. No existing checkout, assets, or Worker bindings were available to merge. The reference URL in the brief was inaccessible from this environment, so this implementation retains the specified ME/SIGNAL name, dark signal/transmission language and telemetry aesthetic. It does not claim to reproduce unseen source. No production deployment was performed.

## Run

Use Node.js 22+ and pnpm 11.25.0:

```powershell
cd C:\Users\Administrator\Downloads\portfolio
pnpm install --frozen-lockfile
pnpm run dev
```

Open `http://127.0.0.1:5173`. The port is fixed; stop a previous instance before starting another.

The Codex desktop runtime used here provides pnpm at this path if it is not on your PATH:

```powershell
& "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" run dev
```

Production checks and preview:

```powershell
pnpm run check
pnpm run build
pnpm run perf
pnpm run preview
```

Preview serves the built output on `http://127.0.0.1:4173`. Opening `index.html` directly is not supported; use the server.

## Explore

- **Network / Vehicle / Schematic:** GPU interpolation between three deterministic layouts. Labels and hit targets use the same interpolated coordinates. The vehicle is procedural geometry, with no downloaded model.
- **Node selection:** select an assembly or its label to inspect its CV-backed details, related nodes and weighted signal trace. Waveforms and streams are clearly labeled illustrative; they are not recorded measurements.
- **Domain controllers:** filter the graph by four CV-derived subject areas. “View entire network” clears the filter.
- **Road trip:** six chapters follow profile, education, skills, experience, projects and contact. Scroll or use the chapter controls; leave with Free explore. Certifications are omitted because none were supplied.
- **Diagnostic terminal:** `/` opens it, Enter runs the query and Escape closes it. Native autocomplete includes verified node names and five suggested routes. Clicking a result opens its detail card.
- **Node index:** searchable access to every verified entity. Use Tab, Up/Down, Home/End and Enter. Classic view exposes the content as a conventional document.
- **Motion:** the footer control pauses signals and camera flights. The OS reduced-motion setting is respected; ignition is skipped and layout changes become immediate. Ignition is skippable and runs once per browser-tab session.
- **Contact:** email, LinkedIn, phone and the supplied automotive CV are available through the contact port. No GitHub profile is guessed.
- **Easter eggs:** `salam` in the terminal toggles a Darija greeting. Up, Up, Down, Down, Left, Right, Left, Right, B, A toggles the engineering metrics display.

Audio ambience is omitted. Glow uses lightweight additive shader passes rather than a full-screen post-processing stack. There is no chromatic-aberration pass. These choices keep the focus on legible connections and a small rendering budget.

## Diagnostic query grammar

Supported shortcuts: `projects`, `skills`, `experience`, `education`, `certifications`, `contact`, `hire me`, `all`. Plain text searches verified names and descriptions.

```text
MATCH (p:Project) RETURN p
MATCH (e:Experience)-[:USES]->(s:Skill {name:"CAN"}) RETURN e
MATCH (p:Project)-[:BUILT_WITH]->(t:Technology {name:"ESP32"}) RETURN p
```

The parser supports one node or one relationship, direction/reverse/undirected edges, an optional exact `name` filter, and one bound RETURN variable. Labels, relation types and name filters are case-insensitive; variables are case-sensitive. Both quote styles and a trailing semicolon are accepted. Unsupported syntax returns an explanation; no code is evaluated. There is no multi-hop, WHERE, mutation or general Cypher execution.

CAN is evidenced in the UTAC experience. The engine returns zero for a Project→CAN relation rather than inventing one. Suggestions are generated from actual graph relationships.

## Edit content

All personal content is in `data/graph.json`; the build uses the same file for WebGL, cards, queries, metadata and prerendered Classic content. `CV_EXTRACTION.md` contains the verification table and reconciliation decisions. The three source CV filenames and SHA-256 checksums are recorded in the graph. The public download is `public/cv-rida-faradi.pdf`.

The automotive CV is primary; PFE corroborates it and clarifies SAFETYBRAIN; Maroc format documents the earlier OCP observation internship. Application targets are not listed as employers. The degree remains explicitly in progress. Missing links, certifications, dates and metrics are documented in `placeholders` and omitted from public claims.

### Schema

`data/graph.schema.json` documents JSON Schema draft 2020-12. Keep stable IDs when changing display text.

| Field | Editing rule |
| --- | --- |
| `profile` | Name, headline, summary, central Person ID and local CV download URL. |
| `sources` | CV source IDs, filenames and checksums. |
| `nodes` | `id`, `type`, `name`, `status`, `clusterId`, `sourceRefs`, `details`. Types: Person, Project, Skill, Technology, Experience, Education, Certification, Contact. |
| `details` | Optional summary, organization, dateLabel, problem, role, outcome, stackNodeIds, visualization and links. Omit unsupported content or use `null` and document why. |
| `sourceRefs` | Source ID, page/section locator, and supporting CV evidence. Required for verified facts and relations; not displayed as passages in the UI. |
| `clusters` | Derived editorial groups with color and supporting node IDs. They are not additional qualifications. |
| `edges` | Source and target IDs; USES, BUILT_WITH, LEARNED_AT, PRODUCED or RELATED_TO; weight in [0,1]; evidence. |
| `tour` | Ordered titles and existing verified node IDs. Descriptions fall back to the first node’s summary. |
| `placeholders` | A record of missing optional facts and limitations. Do not create invented public nodes to fill gaps. |

Relation weight controls visual emphasis, not skill proficiency. Node positions are generated in `src/layouts.js`; content authors do not edit coordinates. Any mini visualization remains illustrative even if the project deals with real vehicle or battery data.

`pnpm run check` validates unique IDs, references, source evidence, weights, the Person root, stack links and safe contact URLs. It runs the query/graph tests. Full JSON Schema validation was also run with Python `jsonschema` during authoring; it is not required by the JavaScript build. Publish only verified nodes. The renderer and query engine exclude draft placeholders, while optional omissions may remain documented.

## Source map

```text
data/graph.json               CV-backed content and evidence
data/graph.schema.json        Editable data contract
scripts/content.js           Semantic HTML and SEO prerendering
scripts/validate-graph.mjs     Graph/content validation
scripts/perf-check.mjs        Asset budgets and CPU-only benchmarks
src/main.js                  Terminal, details, tour, focus and fallbacks
src/query.js                 Bounded graph query parser/evaluator
src/layouts.js               Deterministic layouts and shared interpolation
src/scene.js                 Assemblies, controls, selection and quality scaling
src/shaders.js               Nodes, traces, dust, grid and halos
src/style.css                Responsive dashboard and Classic view
public/                      CV, favicon and social preview
tests/query.test.js          Parser and data-safety tests
wrangler.jsonc               Cloudflare Worker static assets configuration
```

## Performance and accessibility

The renderer instances assemblies by type and uses one batched ribbon geometry for edges. DPR is capped; slow frame samples lower quality and sustained headroom restores it. Low quality hides dust and the glow pass. Hidden tabs and Classic view suspend rendering. Reduced motion uses demand rendering. Labels are culled to limit DOM work; the node index retains access to all verified content.

Classic content and metadata are emitted into `dist/index.html` at build time. They are available without JavaScript or WebGL. Runtime WebGL creation failure switches to Classic. Keyboard focus styles, accessible labels, result announcements, a working skip link and focus restoration are included. Contact URLs are ordinary links; there are no remote scripts, analytics, trackers or service calls. Browser storage contains only the local ignition-session flag.

See `VERIFICATION.md` for the actual measured results and limits. The perf script’s CPU timings and transfer budgets are not GPU frame rates. Lighthouse mobile >85 and 60/30 FPS remain targets until browser/device measurement is available.

## Cloudflare Workers deployment

This uses [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/), with `dist` as the asset directory. There are no secrets, database bindings, server routes or external runtime dependencies.

The configured Worker name is `rida-faradi-signal`. This is a new explicit name because the original Worker account/configuration was not supplied. To update an existing Worker, set its exact authorized name in `wrangler.jsonc` before deployment and preserve any existing bindings if integrating later.

Authenticate once, then deploy:

```powershell
cd C:\Users\Administrator\Downloads\portfolio
pnpm exec wrangler login
pnpm run deploy
```

**Exact deploy command: `pnpm run deploy`.** It runs validation, tests and the production build before `wrangler deploy`. To perform the packaging check without publication:

```powershell
pnpm exec wrangler deploy --dry-run --outdir work/worker-check
```

Tooling telemetry can be disabled in the shell with `$env:WRANGLER_SEND_METRICS = "false"`. No site telemetry is present. No account identifiers, tokens, credentials or hardcoded workers.dev address are included.
