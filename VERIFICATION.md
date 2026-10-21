# Verification — 21 October 2026

## Passed

| Check | Result |
| --- | --- |
| Production build | Vite production builds passed after renderer integration, ignition/shader refinement, terminal/card/tour integration and final accessibility/performance corrections. Final build: 14 modules transformed successfully. |
| Graph invariants | 48 verified nodes, 77 evidenced relations, 3 CV sources, 4 domain clusters. Unique IDs, references, evidence, weights and contact URL checks pass. |
| JSON Schema | Full draft 2020-12 schema and instance validation passed using Python `jsonschema`, including format checking. |
| Tests | 15/15 Node tests passed: bounded grammar, direction, exact filters, syntax failures, real zero results, safe links, evidence and hidden placeholders. |
| Prerender | All 48 verified names appear in the built semantic HTML. No remote service references, inline scripts or HTML event-handler attributes detected by the static content check. |
| Startup asset budget | Eager HTML/CSS/static JS: 25.79 KiB gzip, within the 70 KiB budget. All JS chunks: 159.76 KiB gzip, within the 180 KiB budget. Complete HTML/CSS/JS: 170.25 KiB gzip. |
| CPU layout benchmark | Creating all three layouts: median 0.096 ms, p95 0.174 ms on the execution host. This is a Node microbenchmark. |
| CPU query benchmark | Representative terminal queries: median 0.0056 ms, p95 0.0099 ms on the execution host. This is a Node microbenchmark. |
| CPU projection arithmetic | All 48 node centers fit the three settled camera presets at 1920×943, 1440×763, 1024×647, 768×903, 390×736, 375×667 and 320×660 stage sizes. This does not verify label overlap or rendered appearance. |
| Shared morph audit | CPU labels/picking and GPU nodes use matching layout weights; routed edges begin/end at the same positions. Trace vertex attributes use 15 active locations and nodes use 13, within WebGL2’s minimum 16. |
| HTTP readiness | Local page, CV PDF, social preview PNG and favicon all returned HTTP 200 with expected content types. |
| CV integrity | Public CV SHA-256 matches the recorded primary source: `3d6bd00fd53134139bb55ca1bdd2b24148794869f854a8d448f46bd96f41d896`. |
| Cloudflare packaging | `pnpm exec wrangler deploy --dry-run --outdir work/worker-check` exited successfully with Wrangler 4.45.0. No bindings or account credentials required; nothing uploaded or published. |

Gzip figures use the perf script’s level-9 compression. Vite’s displayed compression estimates may differ slightly. The scene is split into a dynamic chunk, but requested during bootstrap; the complete startup payload therefore includes it and Three.js. PDF and social-preview assets are not part of the initial HTML/CSS/JS budget.

## Corrected during source review

- Tour mode disables orbit interception so wheel/touch scrolling can advance chapters.
- Camera framing adapts to portrait screens; unclustered contact and activity nodes stay near the central gateway rather than adding an unsupported fifth domain.
- Relation weights affect ribbon thickness and preserve a valid zero weight.
- Hover halos share time/motion uniforms; paused transitions retain their active timeline.
- FPS accounting uses unclamped elapsed time, avoiding inflated figures during slow frames.
- Skip-to-content opens and focuses Classic view. Tour/detail exits restore focus; the node index remains available at tablet widths.
- Classic content includes verified problem, contribution and outcome fields.
- Terminal syntax errors preserve prior visual context. Autocomplete and suggestions come from verified content.
- Renderer and query results exclude unverified placeholder nodes.
- Reduced motion, session ignition skipping, graphics-context failure fallback and hidden-tab suspension are wired in the source.

## Not verified

The browser origin permission gate denied inspection of `http://127.0.0.1:5173`. No alternate browser, raw browser automation or indirect screenshot method was used.

As a result, real WebGL shader execution, screenshots, visual spacing, pointer/touch interaction, screen-reader behavior, actual keyboard flow, real-device rendering performance and Lighthouse mobile were not tested in a browser. No 60 FPS / 30 FPS result or Lighthouse >85 score is claimed. The CPU benchmarks and static asset budgets are not substitutes for those measurements.

No Cloudflare account login or production deployment was performed. The dry run verifies local packaging/configuration, not account permissions, a live hostname or production delivery.

## Reproduce

```powershell
pnpm run check
pnpm run build
pnpm run perf
pnpm exec wrangler deploy --dry-run --outdir work/worker-check
```

For browser QA when access is available, check all three layouts and selection during their transitions, run the five terminal suggestions, trace a CAN-related experience, complete and exit the tour, test keyboard-only/index/Classic navigation, disable WebGL, test reduced motion, and measure frame times during orbit/morph on desktop and an actual phone. Run Lighthouse against the production preview rather than the Vite development server.
