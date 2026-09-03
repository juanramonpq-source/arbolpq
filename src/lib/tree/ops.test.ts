import assert from "node:assert/strict";
import { test } from "node:test";
import { addChild, addParents, addPartner, removePerson, updatePerson } from "./ops.ts";
import { createSeed } from "./seed.ts";
import { emptyDraft } from "./types.ts";

test("ops: child, partner, parents and delete keep the seed couples", () => {
  const seed = createSeed();
  const child = addChild(seed, "lucia-perez-quintanar", { ...emptyDraft("Pérez"), givenName: "Sofía" }, {
    kind: "none",
  });
  assert.equal(child.tree.people.some((p) => p.givenName === "Sofía"), true);

  const partner = addPartner(child.tree, "lucia-perez-quintanar", {
    ...emptyDraft(),
    givenName: "Carlos",
    sex: "male",
  });
  const luciaUnion = partner.tree.unions.find(
    (u) => u.aId === "lucia-perez-quintanar" || u.bId === "lucia-perez-quintanar",
  );
  assert.ok(luciaUnion?.bId || luciaUnion?.aId);
  assert.equal(luciaUnion?.childrenIds.includes(child.focusId), true);

  const parents = addParents(
    partner.tree,
    "juan-perez-martinez",
    { ...emptyDraft("Pérez"), givenName: "Abuelo", sex: "male" },
    { ...emptyDraft("Martínez"), givenName: "Abuela", sex: "female" },
  );
  assert.equal(parents.tree.unions.some((u) => u.childrenIds.includes("juan-perez-martinez")), true);

  const renamed = updatePerson(parents.tree, "lucia-perez-quintanar", {
    ...emptyDraft("Pérez Quintanar"),
    givenName: "Lucía María",
    sex: "female",
  });
  assert.equal(renamed.people.find((p) => p.id === "lucia-perez-quintanar")?.givenName, "Lucía María");

  const trimmed = removePerson(renamed, child.focusId);
  assert.equal(trimmed.people.some((p) => p.id === child.focusId), false);
  assert.ok(trimmed.people.some((p) => p.id === "esperanza-quintanar-calonge"));
  assert.ok(
    trimmed.unions.some(
      (u) =>
        (u.aId === "juan-ramon-perez-alcarria" && u.bId === "esperanza-quintanar-calonge") ||
        (u.aId === "esperanza-quintanar-calonge" && u.bId === "juan-ramon-perez-alcarria"),
    ),
  );
});
