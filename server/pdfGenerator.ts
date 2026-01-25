import type { TDocumentDefinitions } from "pdfmake/interfaces";
import * as fs from "fs";
import * as path from "path";
import { createRequire } from "module";

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

const fontDescriptors = {
  Roboto: roboto,
  ...resolveFontOrFallback({
    familyName: "TimesNewRoman",
    ...timesNewRoman,
    fallbackFamilyName: "Roboto",
    fallbackNormal: roboto.normal,
    fallbackBold: roboto.bold,
    fallbackItalics: roboto.italics,
    fallbackBolditalics: roboto.bolditalics,
  }),
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

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function generateAosrPdf(data: ActData): Promise<Buffer> {
  const docDefinition = loadAosrTemplateDefinition();
  replacePlaceholdersDeep(docDefinition, buildAosrPlaceholderValues(data));

  try {
    const pdfDoc = await printer.createPdfKitDocument(docDefinition);

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
    buildAttachmentsText({
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

function buildAttachmentsText(input: {
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
