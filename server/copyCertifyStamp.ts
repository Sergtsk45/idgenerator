/**
 * @file: copyCertifyStamp.ts
 * @description: Отрисовка штампа «Копия верна» поверх страницы PDF.
 * @dependencies: pdf-lib, fontkit, server/fonts/Roboto-Medium.ttf
 * @created: 2026-08-01
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import {
  concatTransformationMatrix,
  degrees,
  PDFDocument,
  PDFFont,
  PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from "pdf-lib";

const require = createRequire(path.join(process.cwd(), "server/copyCertifyStamp.ts"));
const fontkit = require("fontkit") as Parameters<PDFDocument["registerFontkit"]>[0];

const POINTS_PER_MM = 72 / 25.4;
const STAMP_WIDTH = 70 * POINTS_PER_MM;
const STAMP_HEIGHT = 35 * POINTS_PER_MM;
const NORMAL_MARGIN = 10 * POINTS_PER_MM;
const MIN_MARGIN = 5 * POINTS_PER_MM;
const ANGLE = -12;
const ANGLE_RADIANS = (ANGLE * Math.PI) / 180;
const INK = rgb(48 / 255, 40 / 255, 145 / 255);
const OPACITY = 0.72;

export interface CopyCertifyStampData {
  position?: string | null;
  personName?: string | null;
}

export interface CopyCertifyStampLayout {
  x: number;
  y: number;
  scale: number;
  margin: number;
  width: number;
  height: number;
  angle: number;
}

/** Встраивает имеющийся в проекте кириллический шрифт один раз на PDF-документ. */
export async function embedCopyCertifyStampFont(document: PDFDocument): Promise<PDFFont> {
  document.registerFontkit(fontkit);
  const bytes = await readFile(path.join(process.cwd(), "server/fonts/Roboto-Medium.ttf"));
  // pdfmake's installed fontkit implements the layout API pdf-lib needs, but
  // not pdf-lib's legacy subset stream API; embedding the small font whole is compatible.
  return document.embedFont(bytes);
}

/** Геометрия вынесена для проверяемого и одинакового позиционирования на всех страницах. */
export function getCopyCertifyStampLayout(pageWidth: number, pageHeight: number): CopyCertifyStampLayout {
  const cos = Math.cos(ANGLE_RADIANS);
  const sin = Math.sin(ANGLE_RADIANS);
  const rotatedWidth = STAMP_WIDTH * cos - STAMP_HEIGHT * sin;
  const rotatedHeight = STAMP_HEIGHT * cos - STAMP_WIDTH * sin;
  const fitsNormally =
    rotatedWidth + 2 * NORMAL_MARGIN <= pageWidth &&
    rotatedHeight + 2 * NORMAL_MARGIN <= pageHeight;
  const requestedMargin = fitsNormally ? NORMAL_MARGIN : MIN_MARGIN;
  const availableWidth = Math.max(0, pageWidth - 2 * requestedMargin);
  const availableHeight = Math.max(0, pageHeight - 2 * requestedMargin);
  const scale = Math.min(1, availableWidth / rotatedWidth, availableHeight / rotatedHeight);
  // Pages smaller than the two required margins cannot satisfy the margin contract;
  // keep the stamp inside the page instead of producing negative geometry.
  const margin = scale > 0 ? requestedMargin : 0;
  const safeScale = scale > 0
    ? scale
    : Math.max(0, Math.min(pageWidth / rotatedWidth, pageHeight / rotatedHeight));
  const width = STAMP_WIDTH * safeScale;
  const height = STAMP_HEIGHT * safeScale;

  return {
    x: pageWidth - margin - (width * cos - height * sin),
    y: margin - width * sin,
    scale: safeScale,
    margin,
    width,
    height,
    angle: ANGLE,
  };
}

function fitText(font: PDFFont, text: string, maxWidth: number): { text: string; size: number } {
  for (let size = 10; size >= 7; size -= 0.5) {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size };
  }

  const ellipsis = "…";
  const characters = Array.from(text);
  while (characters.length && font.widthOfTextAtSize(`${characters.join("")}${ellipsis}`, 7) > maxWidth) {
    characters.pop();
  }
  return { text: `${characters.join("")}${ellipsis}`, size: 7 };
}

/** Рисует штамп поверх содержимого страницы, не изменяя исходный PDF-файл. */
export function drawCopyCertifyStamp(
  page: PDFPage,
  font: PDFFont,
  data: CopyCertifyStampData,
): CopyCertifyStampLayout {
  const crop = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const pageWidth = rotation === 90 || rotation === 270 ? crop.height : crop.width;
  const pageHeight = rotation === 90 || rotation === 270 ? crop.width : crop.height;
  const layout = getCopyCertifyStampLayout(pageWidth, pageHeight);
  if (layout.scale === 0) return layout;

  const transform: [number, number, number, number, number, number] = rotation === 90
    ? [0, 1, -1, 0, crop.x + crop.width, crop.y]
    : rotation === 180
      ? [-1, 0, 0, -1, crop.x + crop.width, crop.y + crop.height]
      : rotation === 270
        ? [0, -1, 1, 0, crop.x, crop.y + crop.height]
        : [1, 0, 0, 1, crop.x, crop.y];
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...transform));

  const { x, y, scale } = layout;
  const cos = Math.cos(ANGLE_RADIANS);
  const sin = Math.sin(ANGLE_RADIANS);
  const point = (localX: number, localY: number) => ({
    x: x + scale * (localX * cos - localY * sin),
    y: y + scale * (localX * sin + localY * cos),
  });
  const line = (x1: number, y1: number, x2: number, y2: number, thickness = 1) =>
    page.drawLine({
      start: point(x1, y1),
      end: point(x2, y2),
      thickness: thickness * scale,
      color: INK,
      opacity: OPACITY,
    });
  const text = (value: string, localX: number, localY: number, size: number) => {
    const start = point(localX, localY);
    page.drawText(value, {
      x: start.x,
      y: start.y,
      size: size * scale,
      font,
      color: INK,
      opacity: OPACITY,
      rotate: degrees(ANGLE),
    });
  };

  // Slightly imperfect double frame reads closer to a physical office stamp.
  line(0, 0, STAMP_WIDTH, 0, 1.2);
  line(STAMP_WIDTH, 0, STAMP_WIDTH, STAMP_HEIGHT, 1.2);
  line(STAMP_WIDTH, STAMP_HEIGHT, 0, STAMP_HEIGHT, 1.2);
  line(0, STAMP_HEIGHT, 0, 0, 1.2);
  const inset = 3;
  line(inset, inset, STAMP_WIDTH - inset, inset, 0.45);
  line(STAMP_WIDTH - inset, inset, STAMP_WIDTH - inset, STAMP_HEIGHT - inset, 0.45);
  line(STAMP_WIDTH - inset, STAMP_HEIGHT - inset, inset, STAMP_HEIGHT - inset, 0.45);
  line(inset, STAMP_HEIGHT - inset, inset, inset, 0.45);

  const title = "Копия верна";
  const titleSize = 15;
  text(title, (STAMP_WIDTH - font.widthOfTextAtSize(title, titleSize)) / 2, 68, titleSize);

  const position = data.position?.trim() || "___________";
  const personName = data.personName?.trim() || "___________";
  const info = fitText(font, `${position} / ${personName}`, STAMP_WIDTH - 24);
  text(info.text, (STAMP_WIDTH - font.widthOfTextAtSize(info.text, info.size)) / 2, 42, info.size);

  line(48, 24, STAMP_WIDTH - 48, 24, 0.8);

  // Deterministic sparse ink flecks: best-effort texture without raster assets.
  const flecks = [
    [13, 15], [28, 82], [45, 9], [63, 88], [82, 31], [101, 76],
    [121, 12], [140, 91], [158, 34], [176, 69], [188, 17],
  ];
  for (const [fleckX, fleckY] of flecks) {
    line(fleckX, fleckY, fleckX + 1.5, fleckY + 0.3, 0.55);
  }
  page.pushOperators(popGraphicsState());

  return layout;
}
