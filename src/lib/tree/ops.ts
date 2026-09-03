import type { FamilyData, OtherParent, Person, PersonDraft, Union } from "./types";

function uid(): string {
  return crypto.randomUUID();
}

function cloneTree(tree: FamilyData): FamilyData {
  return {
    people: tree.people.map((person) => ({ ...person })),
    unions: tree.unions.map((union) => ({ ...union, childrenIds: [...union.childrenIds] })),
  };
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

export function addChild(
  source: FamilyData,
  parentId: string,
  draft: PersonDraft,
  other: OtherParent,
): { tree: FamilyData; focusId: string } {
  if (!draft.givenName.trim()) throw new Error("El nombre es obligatorio.");
  const tree = cloneTree(source);
  if (!tree.people.some((person) => person.id === parentId)) {
    throw new Error("Persona no encontrada.");
  }

  const child = fromDraft(draft);
  tree.people.push(child);

  let otherId: string | null = null;
  if (other.kind === "new") {
    if (!other.draft.givenName.trim()) throw new Error("Completa el nombre del otro progenitor.");
    const partner = fromDraft(other.draft);
    tree.people.push(partner);
    otherId = partner.id;
  } else if (other.kind === "existing") {
    otherId = other.id;
  }

  const existing = tree.unions.find((union) => {
    const isParent = union.aId === parentId || union.bId === parentId;
    if (!isParent) return false;
    if (!otherId) return true;
    return union.aId === otherId || union.bId === otherId || union.bId === null;
  });

  if (existing) {
    if (otherId && existing.bId === null && existing.aId !== otherId) {
      existing.bId = otherId;
    }
    existing.childrenIds.push(child.id);
  } else {
    tree.unions.push({
      id: uid(),
      aId: parentId,
      bId: otherId,
      childrenIds: [child.id],
    });
  }

  return { tree, focusId: child.id };
}

export function addPartner(
  source: FamilyData,
  personId: string,
  draft: PersonDraft,
): { tree: FamilyData; focusId: string } {
  if (!draft.givenName.trim()) throw new Error("El nombre es obligatorio.");
  const tree = cloneTree(source);
  if (!tree.people.some((person) => person.id === personId)) {
    throw new Error("Persona no encontrada.");
  }

  const existing = tree.unions.find((union) => union.aId === personId || union.bId === personId);
  if (existing && existing.bId) throw new Error("Esta persona ya tiene pareja.");

  const partner = fromDraft(draft);
  tree.people.push(partner);

  if (existing && existing.bId === null) {
    existing.bId = partner.id;
  } else {
    tree.unions.push({
      id: uid(),
      aId: personId,
      bId: partner.id,
      childrenIds: [],
    });
  }

  return { tree, focusId: partner.id };
}

export function addParents(
  source: FamilyData,
  personId: string,
  parentA: PersonDraft,
  parentB: PersonDraft | null,
): { tree: FamilyData; focusId: string } {
  const father = parentA.givenName.trim() ? parentA : null;
  const mother = parentB?.givenName.trim() ? parentB : null;
  if (!father && !mother) {
    throw new Error("Indica al menos el nombre del padre o de la madre.");
  }

  const tree = cloneTree(source);
  if (!tree.people.some((person) => person.id === personId)) {
    throw new Error("Persona no encontrada.");
  }
  if (tree.unions.some((union) => union.childrenIds.includes(personId))) {
    throw new Error("Esta persona ya tiene progenitores en el árbol.");
  }

  let aId: string;
  let bId: string | null = null;
  let focusId: string;
  if (father) {
    const a = fromDraft(father);
    tree.people.push(a);
    aId = a.id;
    focusId = a.id;
    if (mother) {
      const b = fromDraft(mother);
      tree.people.push(b);
      bId = b.id;
    }
  } else {
    const b = fromDraft(mother!);
    tree.people.push(b);
    aId = b.id;
    focusId = b.id;
  }

  tree.unions.push({ id: uid(), aId, bId, childrenIds: [personId] });
  return { tree, focusId };
}

export function updatePerson(source: FamilyData, id: string, draft: PersonDraft): FamilyData {
  if (!draft.givenName.trim()) throw new Error("El nombre es obligatorio.");
  const tree = cloneTree(source);
  const person = tree.people.find((entry) => entry.id === id);
  if (!person) throw new Error("Persona no encontrada.");
  person.givenName = draft.givenName.trim();
  person.familyName = draft.familyName.trim();
  person.sex = draft.sex;
  person.birthYear = draft.birthYear.trim();
  person.deathYear = draft.deathYear.trim();
  person.notes = draft.notes.trim();
  return tree;
}

export function removePerson(source: FamilyData, id: string): FamilyData {
  const tree = cloneTree(source);

  for (const union of tree.unions) {
    union.childrenIds = union.childrenIds.filter((childId) => childId !== id);
  }

  const nextUnions: Union[] = [];
  for (const union of tree.unions) {
    if (union.aId === id) {
      if (union.bId) {
        nextUnions.push({ ...union, aId: union.bId, bId: null });
      }
      continue;
    }
    if (union.bId === id) {
      nextUnions.push({ ...union, bId: null });
      continue;
    }
    nextUnions.push(union);
  }

  tree.unions = nextUnions;
  tree.people = tree.people.filter((person) => person.id !== id);
  return tree;
}
