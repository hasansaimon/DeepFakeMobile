import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExtractFramesOptions {
  maxFrames: number;
  intervalSeconds: number;
}

export async function extractVideoFrames(
  videoBuffer: Buffer,
  { maxFrames, intervalSeconds }: ExtractFramesOptions,
): Promise<Buffer[]> {
  const workDir = await mkdtemp(join(tmpdir(), "video-frames-"));
  const inputPath = join(workDir, "input.mp4");
  const outputPattern = join(workDir, "frame_%03d.jpg");

  try {
    await writeFile(inputPath, videoBuffer);

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `fps=1/${intervalSeconds}`,
      "-frames:v",
      String(maxFrames),
      "-q:v",
      "3",
      outputPattern,
    ]);

    const files = (await readdir(workDir))
      .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
      .sort();

    const buffers: Buffer[] = [];
    for (const file of files) {
      buffers.push(await readFile(join(workDir, file)));
    }
    return buffers;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
