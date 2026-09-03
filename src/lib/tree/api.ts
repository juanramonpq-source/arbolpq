import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const personDraftSchema = z.object({
  givenName: z.string(),
  familyName: z.string(),
  sex: z.enum(["female", "male", "unspecified"]),
  birthYear: z.string(),
  deathYear: z.string(),
  notes: z.string(),
});

const otherParentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("new"), draft: personDraftSchema }),
  z.object({ kind: z.literal("existing"), id: z.string() }),
]);

export const loadTree = createServerFn({ method: "GET" }).handler(async () => {
  const { loadFamilyTree } = await import("./repository");
  return loadFamilyTree();
});

export const addChildFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      parentId: z.string(),
      draft: personDraftSchema,
      other: otherParentSchema,
    }),
  )
  .handler(async ({ data }) => {
    const { addChildToTree } = await import("./repository");
    return addChildToTree(data.parentId, data.draft, data.other);
  });

export const addPartnerFn = createServerFn({ method: "POST" })
  .validator(z.object({ personId: z.string(), draft: personDraftSchema }))
  .handler(async ({ data }) => {
    const { addPartnerToTree } = await import("./repository");
    return addPartnerToTree(data.personId, data.draft);
  });

export const addParentsFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      personId: z.string(),
      parentA: personDraftSchema,
      parentB: personDraftSchema.nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { addParentsToTree } = await import("./repository");
    return addParentsToTree(data.personId, data.parentA, data.parentB);
  });

export const updatePersonFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string(), draft: personDraftSchema }))
  .handler(async ({ data }) => {
    const { updatePersonInTree } = await import("./repository");
    return updatePersonInTree(data.id, data.draft);
  });

export const removePersonFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { removePersonFromTree } = await import("./repository");
    return removePersonFromTree(data.id);
  });
