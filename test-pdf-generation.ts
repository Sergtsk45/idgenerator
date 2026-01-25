/**
 * @file: test-pdf-generation.ts
 * @description: Тестовый скрипт для проверки генерации PDF АОСР из шаблона
 * @created: 2026-01-24
 */

import { generateAosrPdf } from "./server/pdfGenerator.js";
import * as fs from "fs";
import * as path from "path";

async function testPdfGeneration() {
  console.log("🧪 Тестирование генерации PDF АОСР из шаблона...\n");

  // Тест 1: PDF с материалами
  console.log("📄 Тест 1: Генерация PDF с материалами...");
  const dataWithMaterials = {
    actNumber: "123",
    actDate: "2026-01-24",
    city: "Москва",
    objectName: "Жилой дом по ул. Тестовой, д. 1",
    objectAddress: "г. Москва, ул. Тестовая, д. 1",
    developerRepName: "Иванов Иван Иванович",
    developerRepPosition: "Главный инженер проекта",
    contractorRepName: "Петров Петр Петрович",
    contractorRepPosition: "Прораб",
    supervisorRepName: "Сидоров Сидор Сидорович",
    supervisorRepPosition: "Инженер строительного контроля",
    workDescription: "Устройство песчаной подготовки оснований",
    projectDocumentation: "Рабочая документация, раздел КЖ",
    dateStart: "2026-01-20",
    dateEnd: "2026-01-24",
    qualityDocuments: "Сертификаты соответствия, паспорта качества",
    materials: [
      {
        name: "Песок строительный",
        unit: "м³",
        quantity: "50",
        qualityDoc: "Паспорт качества №123",
      },
      {
        name: "Щебень гранитный",
        unit: "м³",
        quantity: "30",
        qualityDoc: "Сертификат №456",
      },
    ],
  };

  try {
    const pdfBuffer1 = await generateAosrPdf(dataWithMaterials);
    const file1 = path.join(process.cwd(), "test-output-with-materials.pdf");
    fs.writeFileSync(file1, pdfBuffer1);
    console.log(`✅ PDF с материалами создан: ${file1} (${pdfBuffer1.length} байт)`);
    
    // Проверка размера (должен быть разумным)
    if (pdfBuffer1.length < 1000) {
      console.error("❌ ОШИБКА: PDF слишком маленький, возможно ошибка генерации!");
      process.exit(1);
    }
    console.log("✅ PDF имеет корректный размер");
  } catch (error) {
    console.error("❌ Ошибка при генерации PDF с материалами:", error);
    process.exit(1);
  }

  // Тест 2: PDF без материалов
  console.log("\n📄 Тест 2: Генерация PDF без материалов...");
  const dataWithoutMaterials = {
    ...dataWithMaterials,
    materials: undefined,
  };

  try {
    const pdfBuffer2 = await generateAosrPdf(dataWithoutMaterials);
    const file2 = path.join(process.cwd(), "test-output-no-materials.pdf");
    fs.writeFileSync(file2, pdfBuffer2);
    console.log(`✅ PDF без материалов создан: ${file2} (${pdfBuffer2.length} байт)`);
    
    // Проверка размера (должен быть разумным)
    if (pdfBuffer2.length < 1000) {
      console.error("❌ ОШИБКА: PDF слишком маленький, возможно ошибка генерации!");
      process.exit(1);
    }
    console.log("✅ PDF имеет корректный размер");
  } catch (error) {
    console.error("❌ Ошибка при генерации PDF без материалов:", error);
    process.exit(1);
  }

  console.log("\n✅ Все тесты пройдены успешно!");
  console.log("\n📋 Следующие шаги для проверки:");
  console.log("   1. Откройте созданные PDF файлы в браузере/PDF-ридере");
  console.log("   2. Проверьте, что все данные подставлены корректно");
  console.log("   3. Проверьте формат дат (должны быть в формате '24 января 2026')");
  console.log("   4. Проверьте таблицу материалов (в первом PDF должны быть 2 строки)");
  console.log("   5. Проверьте, что во втором PDF есть строка 'Согласно проектной документации'");
}

testPdfGeneration().catch((error) => {
  console.error("❌ Критическая ошибка:", error);
  process.exit(1);
});
