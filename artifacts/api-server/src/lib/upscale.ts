import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

export interface UpscaleResult {
  buffer: Buffer;
  mimeType: string;
}

export async function upscaleMedia(
  inputBuffer: Buffer,
  mimeType: string,
  factor: number,
): Promise<UpscaleResult> {
  const isVideo = VIDEO_MIME_TYPES.has(mimeType);
  const workDir = await mkdtemp(join(tmpdir(), "upscale-"));
  const inputExt = isVideo ? "mp4" : "jpg";
  const inputPath = join(workDir, `input.${inputExt}`);
  const outputExt = isVideo ? "mp4" : "jpg";
  const outputPath = join(workDir, `output.${outputExt}`);

  try {
    await writeFile(inputPath, inputBuffer);

    const scaleFilter = `scale=iw*${factor}:ih*${factor}:flags=lanczos`;

    if (isVideo) {
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        inputPath,
        "-vf",
        scaleFilter,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-c:a",
        "copy",
        outputPath,
      ]);
    } else {
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        inputPath,
        "-vf",
        scaleFilter,
        "-q:v",
        "2",
        outputPath,
      ]);
    }

    const outputBuffer = await readFile(outputPath);
    return {
      buffer: outputBuffer,
      mimeType: isVideo ? "video/mp4" : "image/jpeg",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
