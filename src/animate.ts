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
// instance, which shows an interactive "Open JSFL File" dialog (Run as command / Open to edit) instead of
// running anything - and even after a human dismisses it with "Don't Show Again", that preference does not
// reliably persist (it needed re-dismissing multiple times the same session). The only reliable pattern is:
// kill every Animate process, then launch fresh with the script path.
//
// A WARM-REUSE VARIANT WAS TRIED AND ABANDONED (2026-10-23): keeping one Animate instance open across calls
// (closing/reopening documents via JSFL instead of restarting the process) seemed promising - no window flicker,
// much faster per call when it worked - but repeatedly hit "Invalid JavaScript object" errors when a new document
// was created shortly after closing old ones (tried both immediately and with an 800ms busy-wait settle delay),
// and on one attempt crashed Adobe Animate outright (its own native crash-report dialog, not a JSFL error). That
// instability is a worse tradeoff than a slower, fully reliable cold launch per call - reverted. If this is
// revisited, the real fix is probably Animate's Toolbox/CEP persistent-extension architecture instead of fighting
// JSFL's single-instance command-line routing, not another variation on open/close timing.
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
