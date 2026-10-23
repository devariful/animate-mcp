#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execJsfl, findAnimate, projectDir, toJsflUri } from "./animate.js";
import { CHEATSHEET } from "./cheatsheet.js";

const server = new McpServer({ name: "animate-mcp", version: "0.1.0" });

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };
const reply = async (work: Promise<unknown>): Promise<ToolResult> => {
  try {
    const data = await work;
    const body = typeof data === "string" ? { log: data } : data;
    return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
  }
};

server.registerTool(
  "animate_status",
  {
    title: "Check Adobe Animate availability",
    description: "Checks whether Adobe Animate is installed and findable, and returns the JSFL API cheat-sheet mapped live against a real install. Call this first.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  () =>
    reply(
      (async () => {
        const exe = findAnimate();
        return { found: true, path: exe, cheatsheet: CHEATSHEET };
      })().catch((err) => ({ found: false, error: err instanceof Error ? err.message : String(err) })),
    ),
);

server.registerTool(
  "animate_exec",
  {
    title: "Run JSFL in Adobe Animate",
    description:
      "Runs a JSFL script body in a fresh Adobe Animate instance (it kills any already-running Animate first - that's required, not optional, see animate_status's cheatsheet) and returns whatever the script logged via the injected log(msg) function. Write real JSFL against the `fl` and `doc`/`document` objects - this is a code-execution tool, not a fixed menu of operations. A variable OUTPUT_DIR (a JSFL file:/// URI) is injected for the project's output folder - use it for exportPNG/exportMovie/saveDocumentAs paths rather than hard-coding a path. Each call launches the full Animate GUI process and takes 15-30s minimum; it is not a warm session, so batch multiple operations into one script rather than calling this many times in a row where possible.",
    inputSchema: {
      project: z.string().min(1).describe("Folder name under the output root for this project's files."),
      script: z.string().min(1).describe("JSFL script body (not a whole file - no need to wrap in try/catch, that's handled for you). Call log('...') to report progress/results; always log() something meaningful, since that's the only way to tell what happened."),
      timeout_seconds: z.number().int().min(10).max(600).default(90),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
  ({ project, script, timeout_seconds }) =>
    reply(
      (async () => {
        const dir = projectDir(project);
        const outputDirUri = toJsflUri(dir);
        const body = `var OUTPUT_DIR = "${outputDirUri}";\n${script}`;
        const log = await execJsfl(body, timeout_seconds * 1000);
        return { output_dir: dir, log };
      })(),
    ),
);

await server.connect(new StdioServerTransport());
