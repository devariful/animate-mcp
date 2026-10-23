# animate-mcp

Local MCP server (stdio, TypeScript) that drives Adobe Animate via JSFL to create and render 2D animation.
Companion project to `flow-mcp` (Google Flow automation) - built separately because Animate's automation surface
(a local scripting language, JSFL) is fundamentally different from Flow's (a web UI driven over CDP), not because
it's unrelated in purpose: both exist to produce animated video, Flow via AI generation credits, this one via
free local rendering once Adobe Animate is installed and licensed.

- `src/animate.ts` the driver (find Animate, kill-then-launch pattern, JSFL exec wrapper, URI helpers)
- `src/assemble.ts` turns an exported PNG frame sequence into an MP4 via ffmpeg
- `src/cheatsheet.ts` growing catalogue of live-verified JSFL API patterns, returned by `animate_status`
- `src/index.ts` the three MCP tools (`animate_status`, `animate_exec`, `animate_assemble_video`)

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

**Also verified live, working (2026-10-23, second pass):**
- Classic motion tween: shape -> `convertToSymbol` -> move/scale the instance at a later keyframe -> set
  `tweenType = "motion"` on the span's first frame. Visually verified with 3 sample frames (start/middle/end) that
  Animate genuinely interpolates position AND scale smoothly - this is real animation, not a guess.
- `exportPNG(basePath, ...)` exports the ENTIRE TIMELINE as a numbered PNG sequence (`<base>0001.png`, `0002.png`,
  ...), regardless of `doc.currentFrame` - this was a wrong assumption in the first pass (thought it exported only
  the current frame). This is actually more useful: one call gets every frame.
- `doc.exportVideo(...)` exists but does not reliably produce a file - looks like an async hand-off (likely Adobe
  Media Encoder) that doesn't complete before `execJsfl` kills Animate. **Not the way to get video.**
- New tool `animate_assemble_video`: takes the PNG sequence from `exportPNG` and turns it into a real MP4 via
  ffmpeg - the same technique flow-mcp's `assemble.ts` already uses. This is the actual, confirmed path to a
  finished animated clip. End-to-end pipeline (exec -> exportPNG sequence -> assemble -> playable MP4) verified by
  producing and watching a real 36-frame clip of a ball moving and scaling up.

**Found but NOT working / not yet resolved:**
- `fl.saveDocumentAs(doc, uri)` returns `true` but the `.fla` was not found on disk afterwards in testing. Don't
  rely on persisting an editable `.fla` yet - the exportPNG-sequence path above is the confirmed-reliable output.
- Setting a shape's fill color after drawing (via `doc.setSelectionRect` + `selection[i].fill.color`) did not
  visibly change the export (came out Animate's default blue both times). Needs remapping - possibly the
  selection/fill object shape is different from what was assumed, or color needs to be set via `doc.fillColor`
  *before* drawing rather than after.

**Also verified live, working (2026-10-23, third pass - multi-part character setup):**
- A 6-layer character (Head, Torso, LeftArm, RightArm, LeftLeg, RightLeg), each its own named layer AND its own
  named symbol, drawn correctly and exported as one clean figure - visually verified. `tl.addNewLayer(name,
  "normal", false)` + `tl.setSelectedLayers(index)` to target it before drawing. **Gotcha**: `tl.deleteLayer(0)`
  to remove the default "Layer_1" only works once OTHER layers already exist - Animate refuses to delete a
  document's last remaining layer and silently no-ops (no error) if you try before adding the real ones.
- This is the real prep step toward actual rigging (Asset Warp/bone tool - NOT yet mapped) or at minimum
  independent per-part animation: separate layers/symbols mean each body part CAN be keyframed/tweened on its own,
  unlike the single-symbol ball demo.

**First warm-reuse attempt (2026-10-23): CLOSE-and-recreate - tried and abandoned.** Worth recording in detail
since it cost real time and very nearly looked like it was working:
- The "Open JSFL File" dialog's "Don't Show Again" checkbox does NOT reliably persist - it had to be re-dismissed
  by hand multiple times in the same session, for reasons not fully understood (possibly tied to Animate's
  preferences only saving on a clean quit, which a forced `taskkill` never gives it).
- Even when the dialog wasn't the problem, closing all open documents and immediately creating a new one in the
  same script threw `Invalid JavaScript object. The original object may have been deleted or the document may
  have been closed.` - tried both with no delay and with an 800ms busy-wait settle (JSFL has no native sleep).
  Moving the cleanup to the END of each script (closing documents after the body's work was done, instead of at
  the start of the next one) didn't fix it either.
- On one attempt, Animate crashed outright - its own native "Sorry, an error occurred" crash-report dialog, not a
  JSFL-level error at all.
- Reverted to kill-before-every-call as a result.

**Second warm-reuse attempt (2026-10-23, same day, the user's own correction): NEVER close anything - verified
working, this is now the default.** The crash above came specifically from the close-then-immediately-recreate
sequence; the fix was to stop doing that entirely rather than to tune its timing further:
- `execJsfl` no longer kills Animate automatically at all (before OR after a run) - only `animate_reset` does,
  and only when explicitly called. Every wrapped script gets a `getDoc()` helper: returns `fl.getDocumentDOM()` if
  a document is already open, or `fl.createDocument("timeline")` only if none exists. Scripts call `getDoc()`
  instead of `fl.createDocument()` directly to continue the same project across calls.
- Stress-tested with 7 consecutive `animate_exec` calls building up the same document (a circle, a rectangle, then
  5 more circles added one call at a time) - zero errors, zero crashes, and all 7 shapes present together in the
  final export, visually confirmed. The first call is a normal ~30s cold launch; every call after that against the
  already-open instance took 1-3s, far faster than a kill+relaunch cycle.
- If `animate_exec` times out while Animate was already running, that's surfaced as "likely the dialog is stuck
  on screen, go dismiss it" rather than auto-killing - auto-killing was exactly what broke the dialog preference
  in the first attempt, so recovering from a stuck dialog by killing was fighting against the very feature this
  was built for.

**Also verified live, working (2026-10-23, fourth pass - animation principles applied to the ping pong demo):**
- `tweenEasing` (-100..100 on a classic tween's starting frame) confirmed working: positive for decelerating
  motion (rising against gravity), negative for accelerating motion (falling) - visually verified on a 5s, 4-bounce
  animation, motion reads as physically weighted rather than linear/robotic.
- Squash and stretch confirmed working: scaleX/scaleY set per keyframe (squashed wide-and-short at ground contact,
  normal round in the air) tweens smoothly along with position. One gotcha: setting scale specifically on frame 0
  (before any insertKeyframe call) did not visibly apply, unlike every later keyframe set the same way - minor,
  unresolved, worth another look if frame 0 ever needs a non-default pose.
- These were applied directly from Disney's 12 animation principles (squash & stretch, ease in/out) at the user's
  prompt - worth remembering that classic animation theory maps onto JSFL properties fairly directly and is a good
  source of "what to build next" for anything that still looks robotic.

**Not attempted yet (next steps, in priority order):**
1. Fill/stroke color control - needed for anything beyond default-blue shapes.
2. Importing reference art (e.g. a character drawn in Flow/Nano Banana) as a symbol to animate, rather than only
   primitive shapes drawn via JSFL - this is the real path to animating an actual character, not a ball.
3. The Asset Warp Tool / bone-based rigging JSFL API - independent limb movement (an arm bending at the elbow),
   as opposed to the whole-symbol position/scale tweening built so far. This is what "rigging" actually means and
   hasn't been touched yet; the multi-layer character above is the prep step for it, not the rigging itself.
4. Shape tweens (morphing) as a second animation primitive, for effects a motion tween on a symbol can't do.
5. Other animation principles worth mapping onto JSFL as real needs come up: Arcs (the bounce demo already has
   this via its keyframe path), Anticipation, Follow Through/Overlapping Action (would matter once there are
   multi-part characters with independent timing per part), Secondary Action.
6. Re-test `fl.saveDocumentAs` if an editable `.fla` deliverable is ever actually needed (it may not be - video is
   the real deliverable for this project's purposes).

Smoke-tested end to end through the actual compiled MCP server (not ad hoc scripts) three times: `scripts/test.mjs`
(shape + PNG export), `scripts/test-full-pipeline.mjs` (full exec -> exportPNG -> animate_assemble_video ->
playable MP4, watched and confirmed correct), and `scripts/test-character-parts.mjs` (6-part character, separate
named layers and symbols, visually verified).
