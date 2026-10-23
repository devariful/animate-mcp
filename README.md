# animate-mcp

A local MCP server that drives Adobe Animate (via JSFL scripting) to create and render 2D animation — a free,
local alternative/companion to AI video credits.

## Requirements

- Node.js 20+
- Adobe Animate installed and licensed (tested against Adobe Animate 2024 on Windows)

## Setup

```bash
npm install
npm run build
```

Point your MCP client (Claude Desktop, Claude Code, etc.) at `dist/index.js`. If Animate isn't in one of the
default install locations checked in `src/animate.ts`, set `ANIMATE_MCP_EXE` to the full path to `Animate.exe`.

## Tools

- `animate_status` — checks Animate is installed and findable, returns a cheat-sheet of live-verified JSFL patterns.
- `animate_exec` — runs a JSFL script body in a fresh Animate instance and returns whatever it logged. This is a
  code-execution tool (like running Python or shell), not a fixed menu of animation operations — write real JSFL
  against Animate's own object model (`fl`, `document`, `Timeline`, ...).
- `animate_assemble_video` — turns the PNG frame sequence `animate_exec`/`exportPNG` produces into a real MP4
  via ffmpeg (Animate's own `exportVideo` doesn't reliably produce a file in this setup).

See `CLAUDE.md` for what's been verified to actually work, what hasn't, and what's next.

## Status

Working end to end: document/shape creation, converting a shape to a symbol, classic motion tweens (position +
scale, smoothly interpolated, visually verified), exporting the full timeline as a PNG sequence, and assembling
that into a playable MP4. Not yet solved: fill/stroke color control, importing external artwork to animate instead
of primitive shapes, and saving an editable `.fla`. See `CLAUDE.md` for the detailed, dated log of what's been
tested live against the real application.
