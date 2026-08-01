import assert from "node:assert/strict";
import test from "node:test";

import { COPY_CERTIFIER_ROLE, sourceDataDtoSchema } from "../shared/routes";

test("source data defaults a missing copy certifier and preserves its fields", () => {
  const legacy = {
    object: { title: "", address: "", city: "" },
    parties: {
      customer: { fullName: "" },
      builder: { fullName: "" },
      designer: { fullName: "" },
    },
    persons: Object.fromEntries(
      [
        "developer_rep",
        "contractor_rep",
        "supervisor_rep",
        "rep_customer_control",
        "rep_builder",
        "rep_builder_control",
        "rep_designer",
        "rep_work_performer",
      ].map((role) => [role, { personName: "" }]),
    ),
  };

  assert.deepEqual(sourceDataDtoSchema.parse(legacy).persons[COPY_CERTIFIER_ROLE], { personName: "" });
  assert.deepEqual(
    sourceDataDtoSchema.parse({
      ...legacy,
      persons: { ...legacy.persons, [COPY_CERTIFIER_ROLE]: { personName: "Иванов И.И.", position: "Инженер" } },
    }).persons[COPY_CERTIFIER_ROLE],
    { personName: "Иванов И.И.", position: "Инженер" },
  );
});
