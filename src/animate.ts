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

function isAnimateRunning(): boolean {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq Animate.exe"', { encoding: "utf8" });
    return /Animate\.exe/i.test(out);
  } catch {
    return false;
  }
}

// THE CORE FINDING (mapped live, 2026-10-23): Animate.exe only runs a .jsfl file passed on its command line when
// NO Animate instance is already running. If one is already open, Windows routes the launch to that single
// instance, which (on some PCs, some of the time) shows an interactive "Open JSFL File" dialog (Run as command /
// Open to edit) instead of running anything - a human has had to dismiss it more than once in testing, so "Don't
// Show Again" does not reliably stick.
//
// A CLOSE-AND-RECREATE warm-reuse variant was tried and abandoned the same day: closing all documents and
// immediately creating a new one threw "Invalid JavaScript object" and once crashed Animate outright. THIS IS
// DIFFERENT AND DELIBERATELY SAFER (the user's own correction, 2026-10-23): never close or recreate anything.
// Keep Animate open, keep whatever document is already open open, and just keep running more JSFL against it -
// getDoc() in every wrapped script returns the current document if one exists rather than creating a fresh one.
// If Animate is already running, this does NOT kill it to force a cold launch any more: killing is what destroys
// the "Don't Show Again" dialog preference in the first place, so recovering from a stuck dialog by killing was
// working against the very feature being asked for. Instead, a stuck warm dispatch surfaces a clear error asking
// a human to click the dialog - the process is left alone either way.
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
  // stuck on a dialog" instead of guessing from a fixed delay. getDoc() is the new continuity primitive: scripts
  // should call it instead of fl.createDocument() directly, so a whole session of animate_exec calls keeps
  // building on the SAME project instead of each one starting a fresh document.
  const wrapped = `
var __log = [];
function log(msg) { __log.push(String(msg)); FLfile.write("${logUri}", __log.join("\\n")); }
function getDoc() { return fl.documents.length > 0 ? fl.getDocumentDOM() : fl.createDocument("timeline"); }
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

  const exe = findAnimate();
  const wasRunning = isAnimateRunning();
  spawn(exe, [scriptPath], { detached: true, stdio: "ignore" }).unref();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(donePath)) break;
    await sleep(1000);
  }
  const finished = existsSync(donePath);
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";

  if (!finished) {
    throw new Error(
      wasRunning
        ? `Animate didn't finish within ${Math.round(timeoutMs / 1000)}s, and it was already running, so this is almost certainly ` +
          `the "Open JSFL File" dialog sitting on screen waiting for a click (Run as command + Don't Show Again). ` +
          `Animate was left running, nothing was killed - check the screen, dismiss it, and retry. ` +
          `Partial log:\n${log || "(nothing was logged before it got stuck)"}`
        : `Animate did not finish within ${Math.round(timeoutMs / 1000)}s on a fresh launch - this is unusual since no dialog ` +
          `should be possible here. Check the screen for an unexpected prompt (crash recovery, a compatibility warning). ` +
          `Partial log:\n${log || "(nothing was logged before it got stuck)"}`,
    );
  }
  return log;
}

// Explicit, user-requested reset - NOT called automatically any more (see execJsfl's comment: auto-killing to
// recover from a stuck dialog was destroying the very "Don't Show Again" preference that avoids the dialog).
export function resetAnimate(): void {
  killExistingInstances();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function projectDir(project: string): string {
  const dir = join(OUTPUT_ROOT, project.replace(/[^\w.-]+/g, "_"));
  mkdirSync(dir, { recursive: true });
  return dir;
}
