# animate-mcp

Local MCP server (stdio, TypeScript) that drives Adobe Animate via JSFL to create and render 2D animation.
Companion project to `flow-mcp` (Google Flow automation) - built separately because Animate's automation surface
(a local scripting language, JSFL) is fundamentally different from Flow's (a web UI driven over CDP), not because
it's unrelated in purpose: both exist to produce animated video, Flow via AI generation credits, this one via
free local rendering once Adobe Animate is installed and licensed.

- `src/animate.ts` the driver (find Animate, kill-then-launch pattern, JSFL exec wrapper, URI helpers)
- `src/cheatsheet.ts` growing catalogue of live-verified JSFL API patterns, returned by `animate_status`
- `src/index.ts` the two MCP tools

## Rules

- Never guess JSFL behavior. Map it live against a real, installed Animate first (see `scripts/test.mjs` for the
  pattern: write a script with defensive per-step try/catch + log(), run it via `animate_exec` or a standalone
  driver script, read back what actually happened). This project exists because flow-mcp's own CLAUDE.md enforces
  the same rule for Flow's selectors - same discipline, different surface.
- MCP FIRST, ALWAYS. When a new JSFL capability or quirk is learned, add it to `cheatsheet.ts` and wire it into a
  tool before moving on, so the next call benefits from it instead of rediscovering it.
- Nothing here has been tested on macOS or Linux. The Mac path in `ANIMATE_PATHS` is a guess at the normal install
  location, unverified - Windows is the only platform this has actually run on.

## Why a code-execution tool, not a fixed menu of operations

Flow is a web UI: automating it means finding buttons and clicking them in order, so flow-mcp's tools are shaped
like that UI (`flow_generate`, `flow_character`, ...). JSFL is a scripting language with a real object model
(`fl`, `document`, `Timeline`, `Layer`, `Frame`, `Shape`...) - the natural fit is a tool that *runs JSFL*, the way
a Python/shell execution tool runs code, rather than reverse-engineering a rigid API for every possible drawing or
animation operation. `animate_exec` takes a JSFL body and returns whatever it logs. This also means Claude (not
just this codebase) is the thing getting smarter about JSFL over time, the same way it writes better ffmpeg
commands over time in flow-mcp rather than needing a dedicated tool per ffmpeg filter.

## Status (as of 2026-10-23, Windows, Adobe Animate 2024)

**Verified live, working:**
- Launch pattern: `Animate.exe "<script.jsfl>"` runs the script directly ONLY when no Animate instance is already
  running. `execJsfl()` always kills every `Animate.exe` process first (and after, as cleanup) - this is load-bearing,
  not defensive paranoia: see the next point.
- **THE DIALOG TRAP** (cost real time to find): if Animate is already open and you launch it again with a script
  argument, Windows routes the launch to the existing instance via its single-instance handling, which shows an
  interactive "Open JSFL File" dialog (*Run as command* / *Open to edit*, unfocused on the latter by default) -
  with no error, no timeout, just silently stuck forever waiting for a human to click it. There's a "Don't Show
  Again" checkbox that works if a human clicks "Run as command" once by hand, but that's an unverifiable per-install
  manual step, so the kill-then-launch pattern is the real fix and needs no setup.
- `fl.createDocument("timeline")` - creates a new in-memory document.
- `doc.addNewOval({left,top,right,bottom}, isOvalQuadrant)` and presumably `addNewRectangle({left,top,right,bottom},
  cornerRadius)` (tested, worked) - draw directly onto the current frame/layer.
- `doc.exportPNG(uri, bTransparent, bSelectionOnly)` - exports the current frame; result visually verified twice
  (an oval, then a rounded rectangle), correct output both times.
- `doc.getTimeline()` -> `tl.layers.length`, `tl.insertKeyframe(frameNumber)` (frameCount updates correctly) -
  basic timeline manipulation confirmed callable without error. NOT yet verified: that the keyframe actually holds
  independently animatable content, or how to build an actual tween between two keyframes.
- Defensive logging pattern (`log()` injected per exec, flushed after every step, final `.done` sentinel file
  polled by the host rather than a fixed delay) - necessary because a thrown JSFL error otherwise fails completely
  silently (no visible console, no exit code signal) and a script that never finishes looks identical to one still
  running.

**Found but NOT working / not yet resolved:**
- `fl.saveDocumentAs(doc, uri)` returns `true` but the `.fla` was not found on disk afterwards in testing. Don't
  rely on persisting an editable `.fla` yet - `exportPNG` (and presumably `exportMovie`, untested) are the
  confirmed-reliable output paths. Re-test this before building anything that depends on saved project files.
- Setting a shape's fill color after drawing (via `doc.setSelectionRect` + `selection[i].fill.color`) did not
  visibly change the export (came out Animate's default blue both times). Needs remapping - possibly the
  selection/fill object shape is different from what was assumed, or color needs to be set via `doc.fillColor`
  *before* drawing rather than after.

**Not attempted yet (the actual next steps toward real animation, in priority order):**
1. Motion/shape tweening between two keyframes - the core "animation" primitive. Nothing works until this is mapped.
2. `doc.exportMovie()` or equivalent - rendering the full timeline to a video file (MP4/SWF/image sequence), the
   actual deliverable format. `exportPNG` only gets one static frame.
3. Re-test `fl.saveDocumentAs` and fill-color setting (above).
4. Importing reference art (e.g. a character drawn in Flow/Nano Banana) as a symbol to animate, rather than only
   primitive shapes drawn via JSFL.
5. A real "assemble a short animation" tool once 1-2 are solid - almost certainly keyframe stills exported via
   `exportPNG` per frame + ffmpeg assembly (the same technique already proven in flow-mcp's `assemble.ts`), unless
   `exportMovie` turns out to handle it directly.

Smoke-tested end to end through the actual compiled MCP server (not just ad hoc scripts) via `scripts/test.mjs`:
`animate_status` found the real install and returned the cheatsheet; `animate_exec` drew a rounded rectangle and
exported it, verified by viewing the resulting PNG.
