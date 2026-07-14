import sharp from "sharp";

export async function grayscaleHash(frame: Buffer): Promise<number[]> {
  const { data } = await sharp(frame)
    .resize(64, 64)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Array.from(data);
}

export function hashSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / (a.length * 255);
}

export async function eyesOpenCount(frame: Buffer): Promise<number> {
  const { data, info } = await sharp(frame)
    .resize(200, 200)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const upperHalf: number[] = [];
  for (let y = 20; y < 100; y++) {
    for (let x = 40; x < 160; x++) {
      upperHalf.push(data[y * w + x]);
    }
  }

  const mid = Math.floor(upperHalf.length / 2);
  const left = upperHalf.slice(0, mid);
  const right = upperHalf.slice(mid);
  const brightEnough = (arr: number[]) => arr.filter(p => p > 170).length / arr.length > 0.04;

  let count = 0;
  if (brightEnough(left)) count++;
  if (brightEnough(right)) count++;
  return count;
}

// ponytail: heuristic, not ML. Catches static photo + closed eyes. Add MediaPipe FaceMesh if deepfakes appear.
