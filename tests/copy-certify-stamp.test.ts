/**
 * @file: copy-certify-stamp.test.ts
 * @description: Минимальная проверка геометрии и кириллического рендера штампа.
 * @dependencies: node:test, pdf-lib, server/copyCertifyStamp
 * @created: 2026-08-01
 */

import assert from "node:assert/strict";
import test from "node:test";
import { degrees, PDFDocument } from "pdf-lib";
import {
  drawCopyCertifyStamp,
  embedCopyCertifyStampFont,
  getCopyCertifyStampLayout,
} from "../server/copyCertifyStamp";

const mm = (value: number) => value * 72 / 25.4;

test("copy-certify stamp renders Cyrillic, uses fixed geometry and scales on small pages", async () => {
  const pdf = await PDFDocument.create();
  const normalPage = pdf.addPage([595.28, 841.89]);
  const smallPage = pdf.addPage([mm(80), mm(50)]);
  const rotatedPage = pdf.addPage([400, 600]);
  rotatedPage.setCropBox(20, 30, 300, 500);
  rotatedPage.setRotation(degrees(90));
  const font = await embedCopyCertifyStampFont(pdf);

  const normal = drawCopyCertifyStamp(normalPage, font, {
    position: "Начальник строительного участка с очень длинным названием должности",
    personName: "Иванов Иван Иванович",
  });
  const small = drawCopyCertifyStamp(smallPage, font, {});
  const rotated = drawCopyCertifyStamp(rotatedPage, font, { position: "Прораб", personName: "Иванов И.И." });

  assert.equal(normal.angle, -12);
  assert.equal(normal.scale, 1);
  assert.ok(Math.abs(normal.width - mm(70)) < 0.001);
  assert.ok(Math.abs(normal.height - mm(35)) < 0.001);
  assert.ok(Math.abs(normal.margin - mm(10)) < 0.001);
  const rightEdge = normal.x + normal.width * Math.cos(-12 * Math.PI / 180)
    - normal.height * Math.sin(-12 * Math.PI / 180);
  assert.ok(Math.abs(rightEdge - (normalPage.getWidth() - mm(10))) < 0.001);
  assert.ok(small.scale < 1);
  assert.ok(Math.abs(small.margin - mm(5)) < 0.001);
  assert.equal(rotated.scale, 1);
  assert.equal(rotatedPage.getRotation().angle, 90);
  assert.deepEqual(rotatedPage.getCropBox(), { x: 20, y: 30, width: 300, height: 500 });
  assert.equal(getCopyCertifyStampLayout(595.28, 841.89).x, normal.x);

  const bytes = await pdf.save();
  const loaded = await PDFDocument.load(bytes);
  assert.equal(loaded.getPageCount(), 3);
  assert.ok(bytes.length > 10_000);
});
