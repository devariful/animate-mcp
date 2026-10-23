// JSFL API patterns confirmed live against a real Adobe Animate 2024 install (2026-10-23). Keep this file growing
// as more is mapped - see CLAUDE.md's "Status" section for what's verified vs still unknown, same convention
// as flow-mcp's own CLAUDE.md.
export const CHEATSHEET = `
Proven JSFL patterns (live-verified, Adobe Animate 2024, Windows):

- Create a document: var doc = fl.createDocument("timeline");
- Save as: fl.saveDocumentAs(doc, uri) -> returns true/false. NOTE: returned true in testing but the .fla was NOT
  found on disk afterwards - unresolved, don't rely on this for persistence yet. Prefer exportPNG/exportMovie for
  actual deliverables until this is re-verified.
- Draw a shape: doc.addNewOval({left, top, right, bottom}, isOvalQuadrant) - draws directly on the current frame of
  the current layer, filled with the default fill color. addNewRectangle({left,top,right,bottom}, cornerRadius)
  follows the same shape. Setting the fill color via doc.setSelectionRect(...) + doc.selection[i].fill.color was
  NOT verified to work (export still showed the default blue) - needs remapping.
- Timeline: var tl = doc.getTimeline(); tl.layers.length; tl.insertKeyframe(frameNum) adds a keyframe at that frame
  (frameCount updates accordingly) - confirmed working. Tweening (motion tween creation, tl.layers[i].frames[n].tweenType
  etc.) is NOT yet mapped - next thing to test live before building any "animate X moving" tool.
- Export frames as PNG: doc.exportPNG(basePath, bTransparent, bSelectionOnly). IMPORTANT, confirmed live: this
  exports the WHOLE TIMELINE as a numbered sequence (<basePath-without-.png>0001.png, 0002.png, ...), not just
  doc.currentFrame's single frame as the name might suggest. Use animate_assemble_video (ffmpeg) to turn that
  sequence into a real video file - this is the actual path to a finished clip, not exportVideo (below).
- Layers for a multi-part character (confirmed working, with TWO real bugs found and fixed along the way - see
  CLAUDE.md's dated entry for the full story; both are load-bearing, not optional cleanup):
  1. tl.addNewLayer(name, "normal", false) adds a layer and returns its index. To actually target it for new
     drawing, set tl.currentLayer = index DIRECTLY as a property assignment - tl.setSelectedLayers(index) reads
     back as if it worked (tl.currentLayer matches) but does NOT reliably redirect where addNewOval/
     addNewRectangle actually draw, at least once a symbol conversion has happened earlier in the script.
  2. NEVER call doc.selectAll() before doc.convertToSymbol() when building multiple parts in one script -
     selectAll() selects everything on the WHOLE STAGE (all layers, standard Animate behavior, same as Edit >
     Select All in the GUI), not just the shape you just drew. Doing this in a loop silently nests every previous
     part's symbol inside each new conversion - one deeply-nested symbol stack ending up on one layer, while the
     exported image still looks completely correct (nesting preserves visual position), which is what made this
     so easy to miss. Instead select ONLY the just-drawn shape: it is NOT auto-selected after addNewOval/
     addNewRectangle (doc.selection.length is 0 right after drawing, confirmed), so call
     doc.setSelectionRect({left,top,right,bottom}, true) with the shape's own bounding box immediately after
     drawing it, before setCustomFill/setCustomStroke/convertToSymbol.
  tl.deleteLayer(0) to remove the default "Layer_1" ONLY WORKS AFTER other layers exist - Animate refuses to
  delete the last remaining layer in a document, so call it AFTER adding the real layers, not before (confirmed:
  calling it on a document with only the default layer silently no-ops, no error, layer just stays).
  VERIFYING layer separation: layer.visible = false/true round-trips correctly when read back, but does NOT
  reliably affect doc.exportPNG()'s rendered output for layers holding symbol instances (confirmed: toggling
  visibility and exporting produced either a blank image or the full composite, never the correctly isolated
  single part). Don't trust a hide-and-export test for this. The reliable check is
  tl.layers[i].frames[0].elements.length (and .elements[j].libraryItem.name) - confirmed accurate throughout.
- Convert a shape to a symbol instance (needed before a classic motion tween): doc.selectAll(); then
  doc.convertToSymbol("graphic", "SomeName", "center") - confirmed working.
- Classic motion tween (THE core animation primitive, confirmed working and visually verified - a ball smoothly
  moved and scaled up across 36 frames): draw a shape, convert it to a symbol, tl.insertKeyframe(endFrame), move
  to that frame (doc.currentFrame = endFrame-1), select the instance and change its properties
  (instance.x/y/scaleX/scaleY/rotation), then set tl.layers[i].frames[startFrameIndex].tweenType = "motion" on the
  FIRST frame of the span. Animate interpolates everything in between automatically - position AND scale both
  confirmed animating smoothly together.
- Easing on a classic tween: tl.layers[i].frames[startFrame].tweenEasing = N, range -100..100. Negative = "ease in"
  (slow start, accelerating - matches a falling object speeding up toward impact), positive = "ease out" (fast
  start, decelerating - matches an object slowing as it reaches the top of an arc against gravity). Confirmed
  working visually in a squash-and-stretch bounce demo (alternating +100 rising / -100 falling per bounce segment).
- FILL COLOR: doc.setFillColor(color) (set BEFORE drawing, meant to set the "next shape" default) is UNRELIABLE -
  confirmed broken on a fresh document/process (produced Animate's hardcoded default blue, #0066CC, instead of the
  requested color), and separately confirmed to go stale/stuck on a cached previous value once Animate has been
  kept open and reused across several animate_exec calls (the continuity feature itself seems to make this worse).
  doc.setCustomFill({style:"solid", color:"#RRGGBB"}) applied to the SELECTED shape AFTER drawing it is the
  reliable pattern - confirmed correct across a 6-part character with two different fill colors (skin tone vs a
  blue shirt) after setFillColor had just given both parts the same wrong color. Always draw the shape with
  doc.addNewOval/addNewRectangle first, select it, THEN set its real fill with setCustomFill - never trust
  setFillColor's effect on what gets drawn next.
- STROKE COLOR works the same way as fill: doc.setCustomStroke({style:"solid", thickness:N, color:"#RRGGBB"}) on a
  selected shape is confirmed reliable (full property readback matched: style, thickness, color, capType, joinType
  etc. all as set). doc.setStrokeColor(color) was not separately stress-tested but given the fill-color finding
  above, treat it with the same suspicion and prefer setCustomStroke after drawing.
- PIVOT POINTS FOR NATURAL JOINT ROTATION (confirmed working, 2026-10-23 - see the adobe-animate-rigging skill for
  the full rigging context this came from): instance.transformX/transformY are just aliases for x/y (the
  instance's STAGE position) - setting them MOVES the whole instance rather than repositioning its pivot, which is
  NOT what you want for a joint. The real technique is choosing the registration point AT CONVERSION TIME via
  convertToSymbol's third argument, which takes a 9-point grid ("top left", "center left", "center", "bottom
  right", etc. - same grid as the Convert to Symbol dialog). For a horizontal arm whose shoulder is at its own
  left edge, convertToSymbol("graphic", "Arm", "center left") puts the pivot exactly there - confirmed with a real
  45-degree rotation: the shoulder end stayed fixed, the hand end swung naturally around it.
- LAYER PARENTING AND THE BONE TOOL: NEITHER IS SCRIPTABLE VIA JSFL (confirmed, not just unverified - seven
  attempts total across two sessions, 2026-10-23). layer.parentLayer is a real, enumerable property that DOES
  type-check (a layer index or name both throw "Invalid value for property parentLayer" immediately) but silently
  refuses an actual Layer object reference too (no error, reads back null). Also tried and ruled out: reversed
  layer order (parent above vs below the child), the reverse assignment direction (treating parentLayer as "I am
  the parent of X"), and setting layerType/animationType to guessed values first ("armature", "parented", "motion"
  - animationType turned out to be READ-ONLY, a computed status reflecting the current tween type, not something
  you configure). The Bone/Asset Warp tool has no JSFL surface at all - doc.addNewBone, addBoneToSelection,
  addArmature, createArmature are all \`undefined\`. CONCLUSION: automatic parent-child rigging is a GUI-only
  feature in this Animate version. Pose a rig by directly keyframing/tweening each child's position+rotation to
  match its parent's - this is not a workaround, it IS the real solution here, already proven in
  scripts/project-wave-hello.mjs (a waving arm, manually keyframed, looks completely natural). Don't re-attempt
  parentLayer or bone-tool JSFL calls without a genuinely new lead (e.g. a different JSFL version, a CEP/UXP panel
  instead of pure JSFL, or Adobe documentation that specifically names a working method).
- Squash and stretch (animation principle #1, verified working): set a symbol instance's scaleX/scaleY at a
  keyframe just like x/y - e.g. scaleX=1.3, scaleY=0.65 at a "ground contact" keyframe for a squashed pose, back
  to scaleX=1/scaleY=1 at the next keyframe for round/normal. Animate tweens scale smoothly along with position.
  One gotcha: setting scale on frame 0 specifically (the very first frame, before any insertKeyframe calls) did
  NOT visibly apply in testing, even though the same code worked for every other keyframe - if frame 0 needs a
  non-default pose, re-verify it separately rather than assuming the general pattern covers it.
- doc.exportVideo(...) EXISTS (doc.exportVideo = "function") but does NOT reliably produce a file in this setup -
  it appears to hand off asynchronously (likely to Adobe Media Encoder) and returns before anything is written, so
  killing Animate right after (which execJsfl always does) leaves no output. Use the exportPNG-sequence +
  animate_assemble_video path instead; it's slower but actually verified to work end to end.
- URIs: Windows paths need the JSFL drive-letter-pipe form: file:///C|/Users/... (not file:///C:/...). Use
  toJsflUri() from animate.ts rather than hand-building these.

Continuity across calls (2026-10-23, verified with 7 consecutive calls building one document): animate_exec no
longer kills or closes anything automatically. Start every script with var doc = getDoc(); instead of
fl.createDocument(...) - it returns the already-open document if one exists, or creates one only if none does.
This lets a whole sequence of animate_exec calls keep building the same project (first call ~30s cold launch,
every call after that against the already-open instance ~1-3s). Call fl.createDocument() directly only if you
deliberately want to abandon whatever's open and start a new project; call the separate animate_reset tool only
if Animate needs a genuine force-restart (it's not automatic any more - see its own description for why).

Operating model (not optional, found the hard way):
- Animate.exe only runs a .jsfl passed as an argument when NO Animate instance is already running. If one is
  already open, the launch gets routed to it and shows an interactive "Open JSFL File" dialog (Run as command /
  Open to edit) that blocks forever with no error and no timeout unless a human clicks it. animate_exec always
  kills every Animate process before AND after each run - never assume a warm session.
- Each call is a full GUI process launch (15-30s). Batch everything one call needs to do into a single script
  rather than many small animate_exec calls.
- fl.quit() does not reliably close the window within a reasonable wait - don't rely on it; the kill-after-run in
  execJsfl() is what actually cleans up.
- A warm-reuse variant (keep Animate open, close/reopen documents between calls via JSFL instead of restarting the
  process) was tried and abandoned: the "Open JSFL" dialog's "Don't Show Again" setting doesn't reliably persist,
  closing+immediately creating a new document threw "Invalid JavaScript object" even with a settle delay, and one
  attempt crashed Animate outright. Not worth the instability versus a slower but fully reliable cold launch per
  call. Don't re-attempt this without a genuinely different mechanism (e.g. a persistent CEP/Toolbox extension).
`;
