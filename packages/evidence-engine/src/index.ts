import Jimp from "jimp";

export interface AnnotationBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function annotateScreenshot(
  sourcePath: string,
  destPath: string,
  box: AnnotationBox | null,
): Promise<void> {
  const image = await Jimp.read(sourcePath);
  if (box) {
    const x = Math.max(0, Math.round(box.x));
    const y = Math.max(0, Math.round(box.y));
    const width = Math.max(2, Math.round(box.width));
    const height = Math.max(2, Math.round(box.height));
    const color = 0xff3b30ff;
    const thickness = 4;
    for (let i = 0; i < thickness; i += 1) {
      drawRect(image, x - i, y - i, width + i * 2, height + i * 2, color);
    }
  }
  await image.writeAsync(destPath);
}

function drawRect(
  image: Awaited<ReturnType<typeof Jimp.read>>,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): void {
  const maxX = image.bitmap.width - 1;
  const maxY = image.bitmap.height - 1;
  const x1 = Math.max(0, Math.min(maxX, x));
  const y1 = Math.max(0, Math.min(maxY, y));
  const x2 = Math.max(0, Math.min(maxX, x + width));
  const y2 = Math.max(0, Math.min(maxY, y + height));
  for (let px = x1; px <= x2; px += 1) {
    image.setPixelColor(color, px, y1);
    image.setPixelColor(color, px, y2);
  }
  for (let py = y1; py <= y2; py += 1) {
    image.setPixelColor(color, x1, py);
    image.setPixelColor(color, x2, py);
  }
}

export function cropHint(box: AnnotationBox | null, padding = 24): AnnotationBox | null {
  if (!box) return null;
  return {
    x: Math.max(0, box.x - padding),
    y: Math.max(0, box.y - padding),
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

export async function cropScreenshot(
  sourcePath: string,
  destPath: string,
  box: AnnotationBox,
): Promise<void> {
  const image = await Jimp.read(sourcePath);
  const x = Math.max(0, Math.round(box.x));
  const y = Math.max(0, Math.round(box.y));
  const width = Math.min(image.bitmap.width - x, Math.max(8, Math.round(box.width)));
  const height = Math.min(image.bitmap.height - y, Math.max(8, Math.round(box.height)));
  await image.crop(x, y, width, height).writeAsync(destPath);
}
