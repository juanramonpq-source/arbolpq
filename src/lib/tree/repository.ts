import { isPgliteAssetError, useDocumentStore } from "@/lib/runtime-env";
import { createSeed } from "@/lib/tree/seed";
import type { FamilyData, Person, PersonDraft, Sex, Union } from "@/lib/tree/types";
import type { OtherParent } from "@/lib/tree/types";
import type { Sql } from "@/lib/db";

type PersonRow = {
  id: string;
  given_name: string;
  family_name: string;
  sex: string;
  birth_year: string;
  death_year: string;
  notes: string;
  founder: boolean;
};

type UnionRow = {
  id: string;
  a_id: string;
  b_id: string | null;
};

type ChildRow = {
  union_id: string;
  child_id: string;
  position: number;
};

const SEX: Sex[] = ["female", "male", "unspecified"];

function asSex(value: string): Sex {
  return SEX.includes(value as Sex) ? (value as Sex) : "unspecified";
}

function uid(): string {
  return crypto.randomUUID();
}

async function sqlClient(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

async function viaDocument<T>(blobs: () => Promise<T>, sqlFn: () => Promise<T>): Promise<T> {
  if (useDocumentStore()) return blobs();
  try {
    return await sqlFn();
  } catch (error) {
    if (isPgliteAssetError(error) || useDocumentStore()) return blobs();
    throw error;
  }
}

function fromDraft(draft: PersonDraft): Person {
  return {
    id: uid(),
    givenName: draft.givenName.trim(),
    familyName: draft.familyName.trim(),
    sex: draft.sex,
    birthYear: draft.birthYear.trim(),
    deathYear: draft.deathYear.trim(),
    notes: draft.notes.trim(),
  };
}

async function insertPerson(sql: Sql, person: Person) {
  await sql`
    insert into people (id, given_name, family_name, sex, birth_year, death_year, notes, founder)
    values (
      ${person.id},
      ${person.givenName},
      ${person.familyName},
      ${person.sex},
      ${person.birthYear},
      ${person.deathYear},
      ${person.notes},
      ${Boolean(person.founder)}
    )
  `;
}

async function insertUnion(sql: Sql, union: Union) {
  await sql`
    insert into unions (id, a_id, b_id)
    values (${union.id}, ${union.aId}, ${union.bId})
  `;
  for (let i = 0; i < union.childrenIds.length; i += 1) {
    await sql`
      insert into union_children (union_id, child_id, position)
      values (${union.id}, ${union.childrenIds[i]}, ${i})
    `;
  }
}

async function readTree(sql: Sql): Promise<FamilyData> {
  const people = await sql<PersonRow>`
    select id, given_name, family_name, sex, birth_year, death_year, notes, founder
    from people
    order by created_at, id
  `;
  const unions = await sql<UnionRow>`
    select id, a_id, b_id from unions order by created_at, id
  `;
  const children = await sql<ChildRow>`
    select union_id, child_id, position from union_children order by position, child_id
  `;

  const childrenByUnion = new Map<string, string[]>();
  for (const row of children) {
    const list = childrenByUnion.get(row.union_id) ?? [];
    list.push(row.child_id);
    childrenByUnion.set(row.union_id, list);
  }

  return {
    people: people.map((p) => ({
      id: p.id,
      givenName: p.given_name,
      familyName: p.family_name,
      sex: asSex(p.sex),
      birthYear: p.birth_year,
      deathYear: p.death_year,
      notes: p.notes,
      founder: Boolean(p.founder),
    })),
    unions: unions.map((u) => ({
      id: u.id,
      aId: u.a_id,
      bId: u.b_id,
      childrenIds: childrenByUnion.get(u.id) ?? [],
    })),
  };
}

async function ensureSeeded(sql: Sql) {
  const existing = await sql<{ n: number }>`select count(*)::int as n from people`;
  if ((existing[0]?.n ?? 0) > 0) return;
  const seed = createSeed();
  for (const person of seed.people) await insertPerson(sql, person);
  for (const union of seed.unions) await insertUnion(sql, union);
}

export async function loadFamilyTree(): Promise<FamilyData> {
  try {
    return await viaDocument(
      async () => {
        const { loadDocumentTree } = await import("./document-store");
        return loadDocumentTree();
      },
      async () => {
        const sql = await sqlClient();
        await ensureSeeded(sql);
        return readTree(sql);
      },
    );
  } catch {
    return createSeed();
  }
}

export async function addChildToTree(
  parentId: string,
  draft: PersonDraft,
  other: OtherParent,
): Promise<{ tree: FamilyData; focusId: string }> {
  return viaDocument(
    async () => {
      const { mutateDocument } = await import("./document-store");
      const { addChild } = await import("./ops");
      return mutateDocument((tree) => addChild(tree, parentId, draft, other));
    },
    async () => addChildSql(parentId, draft, other),
  );
}

async function addChildSql(
  parentId: string,
  draft: PersonDraft,
  other: OtherParent,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (!draft.givenName.trim()) throw new Error("El nombre es obligatorio.");
  const sql = await sqlClient();
  await ensureSeeded(sql);
  const { people, unions } = await readTree(sql);
  if (!people.some((p) => p.id === parentId)) throw new Error("Persona no encontrada.");

  const child = fromDraft(draft);
  await insertPerson(sql, child);

  let otherId: string | null = null;
  if (other.kind === "new") {
    if (!other.draft.givenName.trim()) throw new Error("Completa el nombre del otro progenitor.");
    const partner = fromDraft(other.draft);
    await insertPerson(sql, partner);
    otherId = partner.id;
  } else if (other.kind === "existing") {
    otherId = other.id;
  }

  const existing = unions.find((u) => {
    const isParent = u.aId === parentId || u.bId === parentId;
    if (!isParent) return false;
    if (!otherId) return true;
    return u.aId === otherId || u.bId === otherId || u.bId === null;
  });

  if (existing) {
    if (otherId && existing.bId === null && existing.aId !== otherId) {
      await sql`update unions set b_id = ${otherId} where id = ${existing.id}`;
    }
    const nextPos = existing.childrenIds.length;
    await sql`
      insert into union_children (union_id, child_id, position)
      values (${existing.id}, ${child.id}, ${nextPos})
    `;
  } else {
    await insertUnion(sql, {
      id: uid(),
      aId: parentId,
      bId: otherId,
      childrenIds: [child.id],
    });
  }

  return { tree: await readTree(sql), focusId: child.id };
}

export async function addPartnerToTree(
  personId: string,
  draft: PersonDraft,
): Promise<{ tree: FamilyData; focusId: string }> {
  return viaDocument(
    async () => {
      const { mutateDocument } = await import("./document-store");
      const { addPartner } = await import("./ops");
      return mutateDocument((tree) => addPartner(tree, personId, draft));
    },
    async () => addPartnerSql(personId, draft),
  );
}

async function addPartnerSql(
  personId: string,
  draft: PersonDraft,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (!draft.givenName.trim()) throw new Error("El nombre es obligatorio.");
  const sql = await sqlClient();
  await ensureSeeded(sql);
  const { people, unions } = await readTree(sql);
  if (!people.some((p) => p.id === personId)) throw new Error("Persona no encontrada.");

  const existing = unions.find((u) => u.aId === personId || u.bId === personId);
  if (existing && existing.bId) throw new Error("Esta persona ya tiene pareja.");

  const partner = fromDraft(draft);
  await insertPerson(sql, partner);

  if (existing && existing.bId === null) {
    await sql`update unions set b_id = ${partner.id} where id = ${existing.id}`;
  } else {
    await insertUnion(sql, {
      id: uid(),
      aId: personId,
      bId: partner.id,
      childrenIds: [],
    });
  }

  return { tree: await readTree(sql), focusId: partner.id };
}

export async function addParentsToTree(
  personId: string,
  parentA: PersonDraft,
  parentB: PersonDraft | null,
): Promise<{ tree: FamilyData; focusId: string }> {
  return viaDocument(
    async () => {
      const { mutateDocument } = await import("./document-store");
      const { addParents } = await import("./ops");
      return mutateDocument((tree) => addParents(tree, personId, parentA, parentB));
    },
    async () => addParentsSql(personId, parentA, parentB),
  );
}

async function addParentsSql(
  personId: string,
  parentA: PersonDraft,
  parentB: PersonDraft | null,
): Promise<{ tree: FamilyData; focusId: string }> {
  const father = parentA.givenName.trim() ? parentA : null;
  const mother = parentB?.givenName.trim() ? parentB : null;
  if (!father && !mother) throw new Error("Indica al menos el nombre del padre o de la madre.");
  const sql = await sqlClient();
  await ensureSeeded(sql);
  const { people, unions } = await readTree(sql);
  if (!people.some((p) => p.id === personId)) throw new Error("Persona no encontrada.");
  if (unions.some((u) => u.childrenIds.includes(personId))) {
    throw new Error("Esta persona ya tiene progenitores en el árbol.");
  }

  let aId: string;
  let bId: string | null = null;
  let focusId: string;
  if (father) {
    const a = fromDraft(father);
    await insertPerson(sql, a);
    aId = a.id;
    focusId = a.id;
    if (mother) {
      const b = fromDraft(mother);
      await insertPerson(sql, b);
      bId = b.id;
    }
  } else {
    const b = fromDraft(mother!);
    await insertPerson(sql, b);
    aId = b.id;
    focusId = b.id;
  }
  await insertUnion(sql, { id: uid(), aId, bId, childrenIds: [personId] });
  return { tree: await readTree(sql), focusId };
}

export async function updatePersonInTree(id: string, draft: PersonDraft): Promise<FamilyData> {
  return viaDocument(
    async () => {
      const { mutateDocument } = await import("./document-store");
      const { updatePerson } = await import("./ops");
      return mutateDocument((tree) => updatePerson(tree, id, draft));
    },
    async () => updatePersonSql(id, draft),
  );
}

async function updatePersonSql(id: string, draft: PersonDraft): Promise<FamilyData> {
  if (!draft.givenName.trim()) throw new Error("El nombre es obligatorio.");
  const sql = await sqlClient();
  await ensureSeeded(sql);
  await sql`
    update people
    set
      given_name = ${draft.givenName.trim()},
      family_name = ${draft.familyName.trim()},
      sex = ${draft.sex},
      birth_year = ${draft.birthYear.trim()},
      death_year = ${draft.deathYear.trim()},
      notes = ${draft.notes.trim()},
      updated_at = now()
    where id = ${id}
  `;
  const tree = await readTree(sql);
  if (!tree.people.some((p) => p.id === id)) throw new Error("Persona no encontrada.");
  return tree;
}

export async function removePersonFromTree(id: string): Promise<FamilyData> {
  return viaDocument(
    async () => {
      const { mutateDocument } = await import("./document-store");
      const { removePerson } = await import("./ops");
      return mutateDocument((tree) => removePerson(tree, id));
    },
    async () => removePersonSql(id),
  );
}

async function removePersonSql(id: string): Promise<FamilyData> {
  const sql = await sqlClient();
  await ensureSeeded(sql);

  await sql`delete from union_children where child_id = ${id}`;

  const asPrimary = await sql<UnionRow>`select id, a_id, b_id from unions where a_id = ${id}`;
  for (const union of asPrimary) {
    if (union.b_id) {
      await sql`update unions set a_id = ${union.b_id}, b_id = null where id = ${union.id}`;
    } else {
      await sql`delete from union_children where union_id = ${union.id}`;
      await sql`delete from unions where id = ${union.id}`;
    }
  }
  await sql`update unions set b_id = null where b_id = ${id}`;
  await sql`delete from people where id = ${id}`;

  return readTree(sql);
}
