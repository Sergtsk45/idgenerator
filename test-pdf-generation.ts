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
    actNumber: "3",
    actDate: "2026-02-18",

    // Реквизиты объекта и участников (новый формат)
    objectFullName: "ЖК Северный · Корпус 2 по адресу: г. Москва, ул. Примерная, д. 10",

    developerOrgFull: 'МУ "ГУКС". ОГРН 1082801002657, ИНН 2801130220, адрес: 675000, Россия, Амурская область, г. Благовещенск, ул. Зейская, д. 173А',
    builderOrgFull: 'ООО "Теплосервис-Комплект". ОГРН 1082801003944, ИНН 2801131520, адрес: 675000, Амурская обл, Благовещенск г, Зейская ул., дом № 319/1',
    designerOrgFull: 'ООО "Амурземпроект". ИНН 2801118167, адрес: 675505 Амурская область, Благовещенский район, с. Усть-Ивановка, ул. Ленина, 75/1',

    repCustomerControlLine: "инженер 1 категории производственного отдела МУ «ГУКС» Чечевская Елена Александровна приказ № 323 от 16.09.2022",
    repBuilderLine: 'директор ООО "Теплосервис-Комплект" Анищенко Сергей Сергеевич приказ № 11 от 10.09.2022',
    repBuilderControlLine: 'прораб ООО "Теплосервис-Комплект" Корнеев Михаил Михайлович приказ № 12 от 10.09.2022',
    repDesignerLine: 'инженер ООО "Теплосервис-Комплект" Булатова Лариса Вильгельмовна приказ № 1-09/2022',
    repWorkPerformerLine: 'прораб ООО "Теплосервис-Комплект" Корнеев Михаил Михайлович приказ № 12 от 10.09.2022',

    worksPerformedByOrg: 'ООО "Теплосервис-Комплект"',

    p1Works: "Монтаж лотков непроходного канала",
    p2ProjectDocs: "АЗП-49-2022-Р-ТС лист 4",
    p5DateStart: "2026-02-14",
    p5DateEnd: "2026-02-18",
    p6NormativeRefs: "АЗП-49-2022-Р-ТС лист 4",
    p7NextWorks: "Монтаж трубопроводов и компенсаторов",

    additionalInfo: "",
    copiesCount: "3",

    sigCustomerControl: "Чечевская Е.А.",
    sigBuilder: "Анищенко С.С.",
    sigBuilderControl: "Корнеев М.М.",
    sigDesigner: "Булатова Л.В.",
    sigWorkPerformer: "Корнеев М.М.",

    materials: [
      {
        name: "Лоток Л11-8",
        unit: "",
        quantity: "",
        qualityDoc: "паспорт 567 01.09.2022",
      },
      {
        name: "Цементный раствор",
        unit: "",
        quantity: "",
        qualityDoc: "паспорт 22-2289 27.09.2022",
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
