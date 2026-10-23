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
- Convert a shape to a symbol instance (needed before a classic motion tween): doc.selectAll(); then
  doc.convertToSymbol("graphic", "SomeName", "center") - confirmed working.
- Classic motion tween (THE core animation primitive, confirmed working and visually verified - a ball smoothly
  moved and scaled up across 36 frames): draw a shape, convert it to a symbol, tl.insertKeyframe(endFrame), move
  to that frame (doc.currentFrame = endFrame-1), select the instance and change its properties
  (instance.x/y/scaleX/scaleY/rotation), then set tl.layers[i].frames[startFrameIndex].tweenType = "motion" on the
  FIRST frame of the span. Animate interpolates everything in between automatically - position AND scale both
  confirmed animating smoothly together.
- doc.exportVideo(...) EXISTS (doc.exportVideo = "function") but does NOT reliably produce a file in this setup -
  it appears to hand off asynchronously (likely to Adobe Media Encoder) and returns before anything is written, so
  killing Animate right after (which execJsfl always does) leaves no output. Use the exportPNG-sequence +
  animate_assemble_video path instead; it's slower but actually verified to work end to end.
- URIs: Windows paths need the JSFL drive-letter-pipe form: file:///C|/Users/... (not file:///C:/...). Use
  toJsflUri() from animate.ts rather than hand-building these.

Operating model (not optional, found the hard way):
- Animate.exe only runs a .jsfl passed as an argument when NO Animate instance is already running. If one is
  already open, the launch gets routed to it and shows an interactive "Open JSFL File" dialog (Run as command /
  Open to edit) that blocks forever with no error and no timeout unless a human clicks it. animate_exec always
  kills every Animate process before AND after each run - never assume a warm session.
- Each call is a full GUI process launch (15-30s). Batch everything one call needs to do into a single script
  rather than many small animate_exec calls.
- fl.quit() does not reliably close the window within a reasonable wait - don't rely on it; the kill-after-run in
  execJsfl() is what actually cleans up.
`;
