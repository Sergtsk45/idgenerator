/**
 * @file: materialsParser.ts
 * @description: Парсинг Excel-файла с материалами для импорта в глобальный справочник
 * @dependencies: xlsx, @shared/routes
 * @created: 2026-02-26
 */

import * as XLSX from "xlsx";
import type { ImportMaterialItem } from "@shared/routes";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function parseMaterialsExcel(file: File): Promise<ImportMaterialItem[]> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Размер файла превышает 10 МБ");
  }

  const validExtensions = [".xlsx", ".xls"];
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!validExtensions.includes(fileExtension)) {
    throw new Error("Неподдерживаемый формат файла. Используйте .xlsx или .xls");
  }

  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array" });
  } catch (parseError) {
    throw new Error(
      "Не удалось прочитать Excel файл. Убедитесь, что файл не поврежден и имеет формат .xlsx или .xls"
    );
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Файл не содержит листов");
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) {
    throw new Error("Не удалось прочитать первый лист файла");
  }

  const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

  const items: ImportMaterialItem[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) {
      skippedCount++;
      continue;
    }

    // Пропустить заголовок (если первая строка содержит "№", "Наименование" и т.д.)
    if (
      row[0] === "№" ||
      row[1] === "Наименование" ||
      String(row[1] || "").toLowerCase().includes("наименование")
    ) {
      skippedCount++;
      continue;
    }

    // Колонки: A=№, B=Наименование, C=Ед.изм., D=ГОСТ/ТУ, E=Категория
    const name = String(row[1] ?? "").trim();
    const unit = String(row[2] ?? "").trim();
    const gostTu = String(row[3] ?? "").trim();
    const categoryRaw = String(row[4] ?? "").trim().toLowerCase();

    if (!name) {
      skippedCount++;
      continue;
    }

    // Валидация категории
    const validCategories = ["material", "equipment", "product"];
    const category = validCategories.includes(categoryRaw)
      ? (categoryRaw as "material" | "equipment" | "product")
      : undefined;

    items.push({
      name,
      unit: unit || undefined,
      gostTu: gostTu || undefined,
      category,
    });
  }

  if (items.length === 0) {
    throw new Error("В файле не найдено подходящих строк для импорта");
  }

  return items;
}
