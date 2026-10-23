import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Everything here was mapped live against a real, installed Adobe Animate 2024 on Windows (2026-10-23) - see
// CLAUDE.md for what was tested and how. Nothing in this file is guessed from Adobe's docs alone.

export const HOME_DIR = process.env.ANIMATE_MCP_HOME ?? join(homedir(), ".animate-mcp");
export const OUTPUT_ROOT = process.env.ANIMATE_MCP_OUTPUT ?? join(homedir(), "animate-mcp-out");
const WORK_DIR = join(HOME_DIR, "work");

const ANIMATE_PATHS = [
  process.env.ANIMATE_MCP_EXE,
  "C:\\Program Files\\Adobe\\Adobe Animate 2025\\Animate.exe",
  "C:\\Program Files\\Adobe\\Adobe Animate 2024\\Animate.exe",
  "C:\\Program Files\\Adobe\\Adobe Animate 2026\\Animate.exe",
  "C:\\Program Files (x86)\\Adobe\\Adobe Animate 2024\\Animate.exe",
  // macOS path pattern - NOT yet verified on a real Mac (Windows is the machine this was built and tested on).
  "/Applications/Adobe Animate 2024/Adobe Animate 2024.app/Contents/MacOS/Adobe Animate 2024",
].filter((p): p is string => Boolean(p));

export function findAnimate(): string {
  const found = ANIMATE_PATHS.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `Could not find Adobe Animate. Looked in:\n${ANIMATE_PATHS.join("\n")}\n` +
        `Set ANIMATE_MCP_EXE to the exact path to Animate.exe if it's installed somewhere else.`,
    );
  }
  return found;
}

// Windows drive-letter JSFL URIs use "C|" instead of "C:" (file:///C|/Users/...). JSFL has used this since the
// Flash IDE era and Animate 2024 still expects it - a plain file:///C:/... URI silently fails FLfile calls.
export function toJsflUri(winPath: string): string {
  const normalized = winPath.replace(/\\/g, "/");
  const withPipe = normalized.replace(/^([A-Za-z]):/, "$1|");
  return `file:///${withPipe}`;
}

function killExistingInstances(): void {
  try {
    execSync("taskkill /IM Animate.exe /F", { stdio: "ignore" });
  } catch {
    // Nothing was running - fine.
  }
}

// THE CORE FINDING (mapped live, 2026-10-23): Animate.exe only runs a .jsfl file passed on its command line when
// NO Animate instance is already running. If one is already open, Windows routes the launch to that single
// instance, which then shows an interactive "Open JSFL File" dialog (Run as command / Open to edit) instead of
// running anything - silently, with no error, no timeout, just stuck forever waiting for a human click. There is
// no documented flag to suppress this. The only reliable pattern found: kill every Animate process, THEN launch
// fresh with the script path. This is how every exec() call behaves - a 10-20s process launch per call, not a
// warm persistent session like Flow's. (The user can also set "Don't Show Again" + "Run as command" once by hand
// on that dialog, which would allow reusing a running instance, but relying on an install-specific one-time human
// setup step is unverifiable on another PC - the kill-then-launch pattern below needs no such setup at all.)
export async function execJsfl(body: string, timeoutMs = 90_000): Promise<string> {
  mkdirSync(WORK_DIR, { recursive: true });
  const id = randomUUID().slice(0, 8);
  const scriptPath = join(WORK_DIR, `run-${id}.jsfl`);
  const logPath = join(WORK_DIR, `run-${id}.log`);
  const donePath = join(WORK_DIR, `run-${id}.done`);
  const logUri = toJsflUri(logPath);
  const doneUri = toJsflUri(donePath);

  // __log / log() / flush() are injected so every exec() gets partial output even if the body throws partway -
  // JSFL has no stack unwinding protection of its own, and a script that dies silently (no window, no console a
  // human can see) is undebuggable without this. The .done sentinel is written in a `finally`-equivalent (both the
  // success path and the catch path reach it) so the host can tell "finished" apart from "Animate is still busy or
  // stuck on a dialog" instead of guessing from a fixed delay.
  const wrapped = `
var __log = [];
function log(msg) { __log.push(String(msg)); FLfile.write("${logUri}", __log.join("\\n")); }
function __finish() { FLfile.write("${logUri}", __log.join("\\n")); FLfile.write("${doneUri}", "done"); }
try {
${body}
  __finish();
} catch (__e) {
  log("UNCAUGHT ERROR: " + __e.toString());
  __finish();
}
`;
  writeFileSync(scriptPath, wrapped, "utf8");
  rmSync(logPath, { force: true });
  rmSync(donePath, { force: true });

  killExistingInstances();
  await sleep(1500);

  const exe = findAnimate();
  const child = spawn(exe, [scriptPath], { detached: true, stdio: "ignore" });
  child.unref();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(donePath)) break;
    await sleep(1000);
  }
  const finished = existsSync(donePath);
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  killExistingInstances();

  if (!finished) {
    throw new Error(
      `Animate did not finish within ${Math.round(timeoutMs / 1000)}s (killed it just now). ` +
        `This usually means an unexpected dialog appeared (a save prompt, a compatibility warning) that no one was there to click. ` +
        `Partial log:\n${log || "(nothing was logged before it got stuck)"}`,
    );
  }
  return log;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function projectDir(project: string): string {
  const dir = join(OUTPUT_ROOT, project.replace(/[^\w.-]+/g, "_"));
  mkdirSync(dir, { recursive: true });
  return dir;
}
