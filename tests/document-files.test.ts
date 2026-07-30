import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { api } from "../shared/routes.ts";
import {
  DOCUMENT_FILE_MAX_BYTES,
  documentFilename,
  documentFileUrl,
  isPdf,
  resolveDocumentFile,
} from "../server/document-files.ts";

test("document file contract exposes authenticated upload/download/delete paths", () => {
  assert.equal(api.documents.uploadFile.method, "POST");
  assert.equal(api.documents.uploadFile.path, "/api/documents/:id/file");
  assert.equal(api.documents.getFile.path, "/api/documents/files/:objectId/:filename");
  assert.equal(api.documents.deleteFile.method, "DELETE");
  assert.equal(api.documents.deleteFile.path, "/api/documents/:id/file");
});

test("document PDF validation and safe application URL", () => {
  const filename = documentFilename(58, "../../passport intep.pdf");
  assert.match(filename, /^58_passport_intep_[a-f0-9]{8}\.pdf$/);
  assert.equal(documentFileUrl(6, filename), `/api/documents/files/6/${filename}`);
  assert.equal(DOCUMENT_FILE_MAX_BYTES, 50 * 1024 * 1024);
  assert.equal(isPdf(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(isPdf(Buffer.from("<html>not pdf</html>")), false);
  assert.doesNotThrow(() => resolveDocumentFile(6, filename));
  assert.throws(() => resolveDocumentFile(6, "../secret.pdf"), /Invalid document file path/);
  assert.throws(() => resolveDocumentFile(6, "58_passport.pdf/../secret.pdf"), /Invalid document file path/);
});

test("document fileUrl accepts protected relative paths and keeps external https support", () => {
  const relative = "/api/documents/files/6/58_passport_ab12cd34.pdf";
  assert.equal(api.documents.create.input.parse({ docType: "passport", fileUrl: relative }).fileUrl, relative);
  assert.equal(api.documents.patch.input.parse({ fileUrl: "https://example.com/passport.pdf" }).fileUrl, "https://example.com/passport.pdf");
  assert.throws(() => api.documents.patch.input.parse({ fileUrl: "http://" }));
  assert.throws(() => api.documents.patch.input.parse({ fileUrl: "/api/pdfs/public.pdf" }));
});

test("document file routes share project ownership checks and never use public PDF serving", async () => {
  const routes = await readFile("server/routes/materials.ts", "utf8");
  const storage = await readFile("server/storage.ts", "utf8");
  const client = await readFile("client/src/lib/document-file.ts", "utf8");

  assert.match(routes, /app\.post\(\s*api\.documents\.uploadFile\.path,[\s\S]*\.\.\.appAuth[\s\S]*storage\.getProjectDocument/);
  assert.match(routes, /app\.get\(api\.documents\.getFile\.path,\s*\.\.\.appAuth[\s\S]*storage\.getProjectDocument/);
  assert.match(routes, /document\.fileUrl !== documentFileUrl\(objectId, filename\)/);
  assert.match(routes, /File content is not a PDF/);
  assert.match(storage, /getProjectDocument\(id: number,\s*userId: number,\s*objectId: number\)/);
  assert.match(storage, /eq\(objects\.userId,\s*userId as any\)/);
  assert.match(storage, /eq\(documents\.scope,\s*"project"\)/);
  assert.match(client, /fetch\(url,[\s\S]*headers: createApiHeaders\(\)/);
  assert.match(client, /URL\.createObjectURL/);
});
