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
- Export a single frame as PNG: doc.exportPNG(uri, bTransparent, bSelectionOnly) - confirmed working, produced a
  correct, visually-verified image.
- Export the whole timeline as video/movie (exportMovie or similar) - NOT yet mapped. This is the actual path to
  a finished animated clip and should be the next thing tested live.
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
