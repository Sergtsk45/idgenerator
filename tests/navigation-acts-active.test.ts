/**
 * @file: navigation-acts-active.test.ts
 * @description: Smoke-test active-state primary nav для /acts и /acts/:id.
 * @dependencies: node:test, node:assert/strict, client/src/lib/navigation.ts
 * @created: 2026-07-22
 */

import test from "node:test";
import assert from "node:assert/strict";
import { getNavigationItemsForSurface, isNavigationItemActive } from "../client/src/lib/navigation.ts";

test("acts nav item stays active on detail route", () => {
  const primary = getNavigationItemsForSurface("shellPrimaryMdUp", { groups: "primary" });
  const actsItem = primary.find((item) => item.id === "acts");

  assert.ok(actsItem, "acts nav item must exist");
  assert.equal(isNavigationItemActive(actsItem!, "/acts"), true);
  assert.equal(isNavigationItemActive(actsItem!, "/acts/25"), true);
  assert.equal(isNavigationItemActive(actsItem!, "/acts/25/export"), true);
  assert.equal(isNavigationItemActive(actsItem!, "/schedule"), false);
});
