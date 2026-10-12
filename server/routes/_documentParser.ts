/**
 * @file: _documentParser.ts
 * @description: Извлечение plaintext из PDF, DOCX и DOC буферов для последующего AI-разбора.
 *   PDF — через pdf-parse (Node.js). DOCX/DOC/TXT — через Python-скрипт (scripts/extract_doc_text.py).
 * @dependencies: pdf-parse, child_process, scripts/extract_doc_text.py
 * @created: 2026-10-11
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

// Работает и в dev (ESM, нет __filename), и в CJS-сборке (import.meta.url пустой) — как в pdfGenerator
const require = createRequire(join(process.cwd(), 'server/routes/_documentParser.ts'));
// pdf-parse v2: экспортирует класс PDFParse (в v1 был default-функцией)
const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse');
const execFileAsync = promisify(execFile);

const MAX_CHARS = 15_000;

const PYTHON_SCRIPT = join(process.cwd(), 'scripts', 'extract_doc_text.py');

/**
 * Извлекает текст из Buffer по расширению файла.
 * Возвращает не более MAX_CHARS символов.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const lower = originalName.toLowerCase();

  let text: string;

  if (lower.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      await parser.destroy();
    }
  } else if (lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.txt')) {
    text = await extractViaScript(buffer, lower.endsWith('.docx') ? '.docx' : lower.endsWith('.doc') ? '.doc' : '.txt');
  } else {
    throw new Error('Неподдерживаемый формат файла. Принимаются: PDF, DOCX, DOC, TXT.');
  }

  return text.slice(0, MAX_CHARS);
}

async function extractViaScript(buffer: Buffer, ext: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'doc-extract-'));
  const tmpFile = join(dir, `upload${ext}`);
  try {
    await writeFile(tmpFile, buffer);
    const { stdout } = await execFileAsync('python3', [PYTHON_SCRIPT, tmpFile], {
      maxBuffer: 4 * 1024 * 1024,
      timeout: 30_000,
    });
    return stdout;
  } finally {
    await unlink(tmpFile).catch(() => undefined);
  }
}
