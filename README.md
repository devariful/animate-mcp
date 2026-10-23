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

See `CLAUDE.md` for what's been verified to actually work, what hasn't, and what's next.

## Status

Early stage — document creation, shape drawing, and single-frame PNG export are confirmed working. Tweening/motion
and full video export are the next things being mapped. See `CLAUDE.md` for the detailed, dated log of what's
been tested live against the real application.
