/**
 * @file: object-create-cache-invalidation.test.ts
 * @description: Регрессионная проверка сброса объектного кэша после создания объекта
 * @dependencies: node:test, node:assert, client/src/hooks/use-objects.ts
 * @created: 2026-10-11
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("creating an object reloads all object-scoped queries", async () => {
  // Arrange
  const source = await readFile("client/src/hooks/use-objects.ts", "utf8");
  const createHook = source.slice(
    source.indexOf("export function useCreateObject"),
    source.indexOf("export function useUpdateObject"),
  );

  // Act
  const invalidatesAllQueries =
    /onSuccess:\s*async\s*\(\)\s*=>[\s\S]*?await queryClient\.invalidateQueries\(\)/.test(createHook);

  // Assert
  assert.equal(invalidatesAllQueries, true);
});
