import test from "node:test";
import assert from "node:assert/strict";
import { QUALITY_BINDING_ROLES, isQualityBindingRole } from "../shared/documentBinding.ts";

test("quality binding roles include certificates, passports, and protocols only", () => {
  assert.deepEqual(QUALITY_BINDING_ROLES, ["quality", "passport", "protocol"]);

  for (const role of QUALITY_BINDING_ROLES) assert.equal(isQualityBindingRole(role), true);
  for (const role of ["scheme", "other", "", null, undefined]) assert.equal(isQualityBindingRole(role), false);
});
