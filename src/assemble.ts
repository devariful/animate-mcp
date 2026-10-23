import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const FFMPEG = process.env.ANIMATE_MCP_FFMPEG ?? "ffmpeg";

// exportPNG(basePath, ...) in Animate writes a FULL frame sequence named <base>0001.png, <base>0002.png, ... for
// the whole timeline, zero-padded to 4 digits (confirmed live, 2026-10-23 - NOT the single current-frame export
// the JSFL docs' wording suggests). This turns that sequence into a real video file with ffmpeg, the same
// technique already proven in flow-mcp's assemble.ts.
export async function assembleSequence(dir: string, baseName: string, fps: number, outputName: string): Promise<string> {
  const prefix = baseName.replace(/\.png$/i, "");
  const frames = readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && /\.png$/i.test(f))
    .sort();
  if (!frames.length) throw new Error(`No frames found matching "${prefix}*.png" in ${dir}. Did exportPNG actually run? Check the exec log.`);

  const output = join(dir, outputName.endsWith(".mp4") ? outputName : `${outputName}.mp4`);
  // The sequence numbering is contiguous from 0001, so a printf-style pattern works directly rather than needing
  // a concat list - simpler and matches what's actually on disk.
  const digits = frames[0].slice(prefix.length).match(/^(\d+)\.png$/)?.[1]?.length ?? 4;
  const pattern = join(dir, `${prefix}%0${digits}d.png`);

  await run(FFMPEG, [
    "-y", "-framerate", String(fps), "-i", pattern,
    "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=white", // libx264 needs even dimensions; Animate's export can be odd-sized
    "-c:v", "libx264", "-pix_fmt", "yuv420p", output,
  ]);
  if (!existsSync(output)) throw new Error("ffmpeg ran but no output file appeared.");
  return output;
}
