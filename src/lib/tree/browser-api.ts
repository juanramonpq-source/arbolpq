import {
  addChildFn,
  addParentsFn,
  addPartnerFn,
  loadTree,
  removePersonFn,
  updatePersonFn,
} from "./api";
import { addChild, addParents, addPartner, removePerson, updatePerson } from "./ops";
import { createSeed } from "./seed";
import type { FamilyData, OtherParent, PersonDraft } from "./types";

function onNetlifySite(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith(".netlify.app") || host.endsWith(".netlify.com");
}

function isFamilyData(value: unknown): value is FamilyData {
  if (!value || typeof value !== "object") return false;
  const record = value as { people?: unknown; unions?: unknown };
  return Array.isArray(record.people) && Array.isArray(record.unions);
}

async function readHttpTree(): Promise<FamilyData> {
  const paths = ["/api/tree", "/.netlify/functions/tree"];
  for (const path of paths) {
    try {
      const response = await fetch(path, { method: "GET", cache: "no-store" });
      if (!response.ok) continue;
      const data: unknown = await response.json();
      if (isFamilyData(data) && data.people.length > 0) return data;
      if (isFamilyData(data)) {
        const seed = createSeed();
        await writeHttpTree(seed);
        return seed;
      }
    } catch {
      // try the next endpoint
    }
  }
  return createSeed();
}

async function writeHttpTree(tree: FamilyData): Promise<FamilyData> {
  const paths = ["/api/tree", "/.netlify/functions/tree"];
  for (const path of paths) {
    try {
      const response = await fetch(path, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tree),
      });
      if (!response.ok) continue;
      const data: unknown = await response.json();
      if (isFamilyData(data)) return data;
      return tree;
    } catch {
      // try the next endpoint
    }
  }
  throw new Error("No se pudo guardar el árbol. Recarga la página e inténtalo de nuevo.");
}

export async function loadFamily(): Promise<FamilyData> {
  if (onNetlifySite()) return readHttpTree();
  try {
    return await loadTree();
  } catch {
    return createSeed();
  }
}

export async function createChild(
  parentId: string,
  draft: PersonDraft,
  other: OtherParent,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (onNetlifySite()) {
    const result = addChild(await readHttpTree(), parentId, draft, other);
    await writeHttpTree(result.tree);
    return result;
  }
  return addChildFn({ data: { parentId, draft, other } });
}

export async function createPartner(
  personId: string,
  draft: PersonDraft,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (onNetlifySite()) {
    const result = addPartner(await readHttpTree(), personId, draft);
    await writeHttpTree(result.tree);
    return result;
  }
  return addPartnerFn({ data: { personId, draft } });
}

export async function createParents(
  personId: string,
  parentA: PersonDraft,
  parentB: PersonDraft | null,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (onNetlifySite()) {
    const result = addParents(await readHttpTree(), personId, parentA, parentB);
    await writeHttpTree(result.tree);
    return result;
  }
  return addParentsFn({ data: { personId, parentA, parentB } });
}

export async function savePerson(id: string, draft: PersonDraft): Promise<FamilyData> {
  if (onNetlifySite()) {
    const tree = updatePerson(await readHttpTree(), id, draft);
    return writeHttpTree(tree);
  }
  return updatePersonFn({ data: { id, draft } });
}

export async function deletePerson(id: string): Promise<FamilyData> {
  if (onNetlifySite()) {
    const tree = removePerson(await readHttpTree(), id);
    return writeHttpTree(tree);
  }
  return removePersonFn({ data: { id } });
}
