import type { TDocumentDefinitions } from "pdfmake/interfaces";
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";
import type { PartyDto, PersonDto, SourceDataDto } from "@shared/routes";
import { storage } from "./storage";

const require = createRequire(import.meta.url);
const PdfPrinter = require("pdfmake/js/Printer.js").default;

const fontsDir = path.join(process.cwd(), "server/fonts");
function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolveFontOrFallback(input: {
  familyName: string;
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
  fallbackFamilyName: string;
  fallbackNormal: string;
  fallbackBold: string;
  fallbackItalics: string;
  fallbackBolditalics: string;
}): Record<string, { normal: string; bold: string; italics: string; bolditalics: string }> {
  const wanted = [input.normal, input.bold, input.italics, input.bolditalics];
  const ok = wanted.every(fileExists);

  if (!ok) {
    console.warn(
      `[AOSR] Font '${input.familyName}' not found in server/fonts. ` +
        `Falling back to '${input.fallbackFamilyName}'. ` +
        `Expected files: ${wanted.map((p) => path.basename(p)).join(", ")}`,
    );
  }

  return {
    [input.familyName]: {
      normal: ok ? input.normal : input.fallbackNormal,
      bold: ok ? input.bold : input.fallbackBold,
      italics: ok ? input.italics : input.fallbackItalics,
      bolditalics: ok ? input.bolditalics : input.fallbackBolditalics,
    },
  };
}

const roboto = {
  normal: path.join(fontsDir, "Roboto-Regular.ttf"),
  bold: path.join(fontsDir, "Roboto-Medium.ttf"),
  italics: path.join(fontsDir, "Roboto-Italic.ttf"),
  bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
};

const timesNewRoman = {
  normal: path.join(fontsDir, "TimesNewRoman.ttf"),
  bold: path.join(fontsDir, "TimesNewRomanBold.ttf"),
  italics: path.join(fontsDir, "TimesNewRomanItalic.ttf"),
  bolditalics: path.join(fontsDir, "TimesNewRomanBoldItalic.ttf"),
};

const windowsFontsDir = "/mnt/c/Windows/Fonts";
const timesNewRomanWindows = {
  normal: path.join(windowsFontsDir, "times.ttf"),
  bold: path.join(windowsFontsDir, "timesbd.ttf"),
  italics: path.join(windowsFontsDir, "timesi.ttf"),
  bolditalics: path.join(windowsFontsDir, "timesbi.ttf"),
};

function resolveTimesNewRomanOrFallback(): Record<
  string,
  { normal: string; bold: string; italics: string; bolditalics: string }
> {
  const localWanted = [timesNewRoman.normal, timesNewRoman.bold, timesNewRoman.italics, timesNewRoman.bolditalics];
  const localOk = localWanted.every(fileExists);

  if (localOk) {
    return { TimesNewRoman: timesNewRoman };
  }

  const winWanted = [
    timesNewRomanWindows.normal,
    timesNewRomanWindows.bold,
    timesNewRomanWindows.italics,
    timesNewRomanWindows.bolditalics,
  ];
  const winOk = winWanted.every(fileExists);

  if (winOk) {
    console.warn(
      `[AOSR] Font 'TimesNewRoman' not found in server/fonts. ` +
        `Using Windows fonts from ${windowsFontsDir} (WSL).`,
    );
    return { TimesNewRoman: timesNewRomanWindows };
  }

  console.warn(
    `[AOSR] Font 'TimesNewRoman' not found. Falling back to 'Roboto'. ` +
      `Expected local: ${localWanted.map((p) => path.basename(p)).join(", ")}; ` +
      `or Windows: ${winWanted.map((p) => path.basename(p)).join(", ")}`,
  );
  return { TimesNewRoman: roboto };
}

const fontDescriptors = {
  Roboto: roboto,
  ...resolveTimesNewRomanOrFallback(),
};

const printer = new PdfPrinter(fontDescriptors);

export interface ActData {
  actNumber: string;
  actDate: string;

  // Legacy (старый упрощённый шаблон)
  city?: string;
  objectName?: string;
  objectAddress?: string;
  developerRepName?: string;
  developerRepPosition?: string;
  contractorRepName?: string;
  contractorRepPosition?: string;
  supervisorRepName?: string;
  supervisorRepPosition?: string;
  workDescription?: string;
  projectDocumentation?: string;
  dateStart?: string;
  dateEnd?: string;
  qualityDocuments?: string;

  // Эталонный шаблон (005_АОСР 4.pdf)
  objectFullName?: string;
  developerOrgFull?: string;
  builderOrgFull?: string;
  designerOrgFull?: string;

  repCustomerControlLine?: string;
  repCustomerControlOrder?: string;
  repBuilderLine?: string;
  repBuilderOrder?: string;
  repBuilderControlLine?: string;
  repBuilderControlOrder?: string;
  repDesignerLine?: string;
  repDesignerOrder?: string;
  repWorkPerformerLine?: string;
  repWorkPerformerOrder?: string;

  worksPerformedByOrg?: string;

  p1Works?: string;
  p2ProjectDocs?: string;
  p3MaterialsText?: string;
  p4AsBuiltDocs?: string;
  p5DateStart?: string;
  p5DateEnd?: string;
  p6NormativeRefs?: string;
  p7NextWorks?: string;

  additionalInfo?: string;
  copiesCount?: string;
  attachments?: string[];
  attachmentsText?: string;

  sigCustomerControl?: string;
  sigBuilder?: string;
  sigBuilderControl?: string;
  sigDesigner?: string;
  sigWorkPerformer?: string;

  materials?: Array<{
    name: string;
    unit: string;
    quantity: string;
    qualityDoc: string;
  }>;
}

function buildRepLine(person: PersonDto | undefined): string | undefined {
  const lineText = person?.lineText?.trim();
  if (lineText) return lineText;
  
  const position = person?.position?.trim();
  const name = person?.personName?.trim();
  const basis = person?.basisText?.trim();
  
  const parts: string[] = [];
  if (position) parts.push(position);
  if (name) parts.push(name);
  if (basis) parts.push(basis);
  
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function buildSig(person: PersonDto | undefined): string | undefined {
  const signText = person?.signText?.trim();
  if (signText) return signText;
  const name = person?.personName?.trim();
  return name || undefined;
}

function buildOrder(person: PersonDto | undefined): string | undefined {
  const basisText = person?.basisText?.trim();
  return basisText || undefined;
}

function buildOrg(party: PartyDto | undefined): string | undefined {
  const fullName = party?.fullName?.trim();
  if (!fullName) return undefined;

  const inn = party?.inn?.trim();
  const kpp = party?.kpp?.trim();
  const ogrn = party?.ogrn?.trim();
  const addressLegal = party?.addressLegal?.trim();
  const phone = party?.phone?.trim();
  const sroFullName = party?.sroFullName?.trim();
  const sroOgrn = party?.sroOgrn?.trim();
  const sroInn = party?.sroInn?.trim();

  // “Бланковый” формат (удобен для PDF): одна сущность = несколько строк.
  // Пустые поля не выводим.
  // Компактный формат (как в образце): одна строка с запятыми-разделителями
  const parts: string[] = [fullName];

  if (ogrn) parts.push(`ОГРН ${ogrn}`);
  
  if (inn && kpp) parts.push(`ИНН ${inn}/${kpp}`);
  else if (inn) parts.push(`ИНН ${inn}`);

  if (addressLegal) parts.push(`адрес: ${addressLegal}`);

  return parts.join(", ");
}

function buildOrgShortName(party: PartyDto | undefined): string | undefined {
  return party?.fullName?.trim() || undefined;
}

export function buildActDataFromSourceData(sourceData: SourceDataDto): Partial<ActData> {
  const objectName = sourceData.object.title?.trim() || undefined;
  const objectAddress = sourceData.object.address?.trim() || undefined;

  const objectFullName =
    objectName && objectAddress
      ? `${objectName} по адресу: ${objectAddress}`
      : objectName || objectAddress || undefined;

  const developerOrgFull = buildOrg(sourceData.parties.customer);
  const builderOrgFull = buildOrg(sourceData.parties.builder);
  const designerOrgFull = buildOrg(sourceData.parties.designer);

  const repCustomerControl = sourceData.persons.rep_customer_control;
  const repBuilder = sourceData.persons.rep_builder;
  const repBuilderControl = sourceData.persons.rep_builder_control;
  const repDesigner = sourceData.persons.rep_designer;
  const repWorkPerformer = sourceData.persons.rep_work_performer;

  return {
    // legacy (для обратной совместимости и для фолбэков в buildAosrPlaceholderValues)
    city: sourceData.object.city?.trim() || undefined,
    objectName,
    objectAddress,
    developerRepName: sourceData.persons.developer_rep.personName?.trim() || undefined,
    developerRepPosition: sourceData.persons.developer_rep.position?.trim() || undefined,
    contractorRepName: sourceData.persons.contractor_rep.personName?.trim() || undefined,
    contractorRepPosition: sourceData.persons.contractor_rep.position?.trim() || undefined,
    supervisorRepName: sourceData.persons.supervisor_rep.personName?.trim() || undefined,
    supervisorRepPosition: sourceData.persons.supervisor_rep.position?.trim() || undefined,

    // эталонные поля
    objectFullName,
    developerOrgFull,
    builderOrgFull,
    designerOrgFull,

    repCustomerControlLine: buildRepLine(repCustomerControl),
    repCustomerControlOrder: buildOrder(repCustomerControl),
    sigCustomerControl: buildSig(repCustomerControl),

    repBuilderLine: buildRepLine(repBuilder),
    repBuilderOrder: buildOrder(repBuilder),
    sigBuilder: buildSig(repBuilder),

    repBuilderControlLine: buildRepLine(repBuilderControl),
    repBuilderControlOrder: buildOrder(repBuilderControl),
    sigBuilderControl: buildSig(repBuilderControl),

    repDesignerLine: buildRepLine(repDesigner),
    repDesignerOrder: buildOrder(repDesigner),
    sigDesigner: buildSig(repDesigner),

    repWorkPerformerLine: buildRepLine(repWorkPerformer),
    repWorkPerformerOrder: buildOrder(repWorkPerformer),
    sigWorkPerformer: buildSig(repWorkPerformer),

    worksPerformedByOrg: buildOrgShortName(sourceData.parties.builder),
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const formatted = date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long", 
      year: "numeric",
    });
    // Добавляем кавычки-ёлочки вокруг дня, как в образце
    return formatted.replace(/^(\d+)/, "« $1 »");
  } catch {
    return dateStr;
  }
}

export async function generateAosrPdf(data: ActData): Promise<Buffer> {
  const docDefinition = loadAosrTemplateDefinition();
  replacePlaceholdersDeep(docDefinition, buildAosrPlaceholderValues(data));

  // Кастомный layout таблиц для "бланковых" подчёркиваний.
  // ВАЖНО: в node-версии pdfmake кастомные layout'ы нужно передавать
  // вторым аргументом в createPdfKitDocument, иначе layout-имя будет
  // игнорироваться и применится дефолтная сетка/рамка.
  const tableLayouts = {
    thinUnderline: {
      // Рисуем линию через layout (без явных border у ячеек)
      defaultBorder: true,
      hLineWidth: function (i: number, node: any) {
        // Только нижняя линия (i === node.table.body.length)
        return i === node.table.body.length ? 0.5 : 0;
      },
      vLineWidth: function () {
        return 0;
      },
      hLineColor: function () {
        return "#000000";
      },
      paddingLeft: function () {
        return 0;
      },
      paddingRight: function () {
        return 0;
      },
      paddingTop: function () {
        return 1;
      },
      paddingBottom: function () {
        return 1;
      },
    },
    // Подчёркивание каждой строки таблицы (линия под каждой строкой),
    // без рамок и без вертикальных линий.
    rowUnderline: {
      // Линии тоже через layout (без явных border у ячеек)
      defaultBorder: true,
      hLineWidth: function (i: number) {
        // i=0 — верхняя линия (не нужна), дальше рисуем линию 0.5pt
        return i === 0 ? 0 : 0.5;
      },
      vLineWidth: function () {
        return 0;
      },
      hLineColor: function () {
        return "#000000";
      },
      paddingLeft: function () {
        return 0;
      },
      paddingRight: function () {
        return 0;
      },
      paddingTop: function () {
        return 1;
      },
      paddingBottom: function () {
        return 1;
      },
    },
  };

  try {
    const pdfDoc = await printer.createPdfKitDocument(docDefinition, { tableLayouts });

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (err: Error) => reject(err));
      pdfDoc.end();
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    throw err;
  }
}

const AOSR_TEMPLATE_PATH = path.join(process.cwd(), "server/templates/aosr/aosr-template.json");
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

let cachedAosrTemplateRaw: any | null = null;

function deepCloneJson<T>(value: T): T {
  const sc = (globalThis as any).structuredClone as ((v: any) => any) | undefined;
  if (typeof sc === "function") return sc(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadAosrTemplateRaw(): any {
  if (cachedAosrTemplateRaw) return cachedAosrTemplateRaw;
  const raw = fs.readFileSync(AOSR_TEMPLATE_PATH, "utf-8");
  cachedAosrTemplateRaw = JSON.parse(raw);
  return cachedAosrTemplateRaw;
}

function loadAosrTemplateDefinition(): TDocumentDefinitions {
  const raw = loadAosrTemplateRaw();
  const { placeholders: _placeholders, ...docDefinition } = raw ?? {};
  return deepCloneJson(docDefinition) as TDocumentDefinitions;
}

function buildAosrPlaceholderValues(data: ActData): Record<string, string> {
  const objectName = data.objectName ?? "";
  const objectAddress = data.objectAddress ?? "";
  const objectFullName =
    data.objectFullName ??
    (objectName && objectAddress
      ? `${objectName} по адресу: ${objectAddress}`
      : objectName || objectAddress || "");

  const developerRepName = data.developerRepName ?? "";
  const developerRepPosition = data.developerRepPosition ?? "";
  const contractorRepName = data.contractorRepName ?? "";
  const contractorRepPosition = data.contractorRepPosition ?? "";
  const supervisorRepName = data.supervisorRepName ?? "";
  const supervisorRepPosition = data.supervisorRepPosition ?? "";

  const repCustomerControlLine =
    data.repCustomerControlLine ??
    [developerRepPosition, developerRepName].filter(Boolean).join(" ");
  const repBuilderLine =
    data.repBuilderLine ?? [contractorRepPosition, contractorRepName].filter(Boolean).join(" ");
  const repBuilderControlLine =
    data.repBuilderControlLine ?? [supervisorRepPosition, supervisorRepName].filter(Boolean).join(" ");

  const p1Works = data.p1Works ?? data.workDescription ?? "";
  const p2ProjectDocs = data.p2ProjectDocs ?? data.projectDocumentation ?? "";
  const p3MaterialsText =
    data.p3MaterialsText ?? buildMaterialsTextFromMaterials(data.materials ?? []);
  const p4AsBuiltDocs = data.p4AsBuiltDocs ?? "";
  const p5DateStart = data.p5DateStart ?? formatDate(data.dateStart ?? "");
  const p5DateEnd = data.p5DateEnd ?? formatDate(data.dateEnd ?? "");
  const p6NormativeRefs = data.p6NormativeRefs ?? data.projectDocumentation ?? "";
  const p7NextWorks = data.p7NextWorks ?? "";

  const attachmentsText =
    data.attachmentsText ??
    buildAttachmentsTextFallback({
      attachments: data.attachments ?? [],
      materials: data.materials ?? [],
    });

  return {
    actNumber: data.actNumber ?? "",
    actDate: formatDate(data.actDate),

    // legacy placeholders (могут оставаться в шаблонах/тексте)
    city: data.city ?? "",
    objectName,
    objectAddress,
    developerRepName,
    developerRepPosition,
    contractorRepName,
    contractorRepPosition,
    supervisorRepName,
    supervisorRepPosition,
    workDescription: data.workDescription ?? "",
    projectDocumentation: data.projectDocumentation ?? "",
    dateStart: formatDate(data.dateStart ?? ""),
    dateEnd: formatDate(data.dateEnd ?? ""),
    qualityDocuments: data.qualityDocuments ?? "",

    // эталонные placeholders
    objectFullName,
    developerOrgFull: data.developerOrgFull ?? "",
    builderOrgFull: data.builderOrgFull ?? "",
    designerOrgFull: data.designerOrgFull ?? "",

    repCustomerControlLine,
    repCustomerControlOrder: data.repCustomerControlOrder ?? "",
    repBuilderLine,
    repBuilderOrder: data.repBuilderOrder ?? "",
    repBuilderControlLine,
    repBuilderControlOrder: data.repBuilderControlOrder ?? "",
    repDesignerLine: data.repDesignerLine ?? "",
    repDesignerOrder: data.repDesignerOrder ?? "",
    repWorkPerformerLine: data.repWorkPerformerLine ?? "",
    repWorkPerformerOrder: data.repWorkPerformerOrder ?? "",

    worksPerformedByOrg: data.worksPerformedByOrg ?? data.builderOrgFull ?? "",

    p1Works,
    p2ProjectDocs,
    p3MaterialsText,
    p4AsBuiltDocs,
    p5DateStart,
    p5DateEnd,
    p6NormativeRefs,
    p7NextWorks,

    additionalInfo: data.additionalInfo ?? "",
    copiesCount: data.copiesCount ?? "",
    attachmentsText,

    sigCustomerControl: data.sigCustomerControl ?? developerRepName ?? "",
    sigBuilder: data.sigBuilder ?? contractorRepName ?? "",
    sigBuilderControl: data.sigBuilderControl ?? supervisorRepName ?? "",
    sigDesigner: data.sigDesigner ?? "",
    sigWorkPerformer: data.sigWorkPerformer ?? "",
  };
}

function replacePlaceholdersInString(input: string, values: Record<string, string>): string {
  return input.replace(PLACEHOLDER_RE, (_m, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key] ?? "";
    console.warn(`[AOSR] Missing placeholder value: ${key}`);
    return "";
  });
}

function replacePlaceholdersDeep(node: any, values: Record<string, string>): any {
  if (typeof node === "string") return replacePlaceholdersInString(node, values);
  if (!node) return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      node[i] = replacePlaceholdersDeep(node[i], values);
    }
    return node;
  }
  if (typeof node === "object") {
    for (const key of Object.keys(node)) {
      node[key] = replacePlaceholdersDeep(node[key], values);
    }
    return node;
  }
  return node;
}

function buildMaterialsTextFromMaterials(materials: NonNullable<ActData["materials"]>): string {
  if (!materials || materials.length === 0) return "";

  // Под эталон: "ФБС ... — паспорт ...; Песок ... — протокол ..."
  return materials
    .map((m) => {
      const name = String(m?.name ?? "").trim();
      const doc = String(m?.qualityDoc ?? "").trim();
      const qty = String(m?.quantity ?? "").trim();
      const unit = String(m?.unit ?? "").trim();

      const qtyPart = qty ? `${qty}${unit ? ` ${unit}` : ""}` : "";
      const docPart = doc ? `— ${doc}` : "";

      // Если есть количество, добавим в скобках (не ломая эталонный формат)
      const qtySuffix = qtyPart ? ` (${qtyPart})` : "";

      return `${name}${qtySuffix} ${docPart}`.trim();
    })
    .filter(Boolean)
    .join("; ");
}

function buildNumberedListText(items: string[]): string {
  const clean = (items ?? []).map((x) => String(x ?? "").trim()).filter(Boolean);
  return clean.map((x, idx) => `${idx + 1}. ${x}`).join("\n");
}

function translateDocTypeRu(docType: string | null | undefined): string {
  switch (String(docType ?? "")) {
    case "certificate":
      return "Сертификат";
    case "declaration":
      return "Декларация";
    case "passport":
      return "Паспорт";
    case "protocol":
      return "Протокол";
    case "scheme":
      return "Схема";
    default:
      return "Документ";
  }
}

export async function buildP3MaterialsText(actId: number): Promise<string> {
  const usages = await storage.getActMaterialUsages(actId);
  if (!usages || usages.length === 0) return "";

  const lines = usages.map((u) => {
    const name =
      String(u.catalogMaterial?.name ?? "").trim() ||
      String(u.projectMaterial?.nameOverride ?? "").trim() ||
      `Материал #${String(u.projectMaterialId)}`;

    const standardRef = String((u.catalogMaterial as any)?.standardRef ?? "").trim();
    const namePart = standardRef ? `${name} (${standardRef})` : name;

    const qd = u.qualityDocument;
    const docPart = qd
      ? `${translateDocTypeRu((qd as any).docType)}${(qd as any).docNumber ? ` №${String((qd as any).docNumber)}` : ""}${
          (qd as any).docDate ? ` от ${formatDate(String((qd as any).docDate))}` : ""
        }`
      : "документ качества: не указан";

    return `Материал: ${namePart} — Документ: ${docPart}`;
  });

  return buildNumberedListText(lines);
}

export async function buildAttachmentsText(actId: number): Promise<string> {
  const list = await storage.getActDocAttachments(actId);
  if (!list || list.length === 0) return "";

  const lines = list.map((a, idx) => {
    const d: any = (a as any).document ?? null;
    const type = translateDocTypeRu(d?.docType);
    const number = d?.docNumber ? ` №${String(d.docNumber)}` : "";
    const date = d?.docDate ? ` от ${formatDate(String(d.docDate))}` : "";
    return `Приложение ${idx + 1} — ${type}${number}${date}`.trim();
  });

  return lines.join("\n");
}

function buildAttachmentsTextFallback(input: {
  attachments: string[];
  materials: NonNullable<ActData["materials"]>;
}): string {
  // Приоритет: явные приложения (из формы)
  const explicit = buildNumberedListText(input.attachments ?? []);
  if (explicit) return explicit;

  // Фолбэк: если приложений нет, но есть материалы — попробуем собрать список документов качества
  const docs = (input.materials ?? [])
    .map((m) => String(m?.qualityDoc ?? "").trim())
    .filter(Boolean);

  const uniqueDocs = Array.from(new Set(docs));
  return buildNumberedListText(uniqueDocs);
}

export function loadTemplateCatalog(): any {
  const catalogPath = path.join(process.cwd(), "server/templates/aosr/templates-catalog.json");
  const data = fs.readFileSync(catalogPath, "utf-8");
  return JSON.parse(data);
}
