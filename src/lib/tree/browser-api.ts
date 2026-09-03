import {
  addChildFn,
  addParentsFn,
  addPartnerFn,
  loadTree,
  removePersonFn,
  updatePersonFn,
} from "./api";
import { addChild, addParents, addPartner, removePerson, updatePerson } from "./ops";
import { loadPersistedTree, savePersistedTree } from "./persist";
import type { FamilyData, OtherParent, PersonDraft } from "./types";

function onNetlifySite(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith(".netlify.app") || host.endsWith(".netlify.com");
}

export async function loadFamily(): Promise<FamilyData> {
  if (onNetlifySite()) return loadPersistedTree();
  try {
    return await loadTree();
  } catch {
    return loadPersistedTree();
  }
}

export async function createChild(
  parentId: string,
  draft: PersonDraft,
  other: OtherParent,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (onNetlifySite()) {
    const result = addChild(await loadPersistedTree(), parentId, draft, other);
    return { tree: await savePersistedTree(result.tree), focusId: result.focusId };
  }
  return addChildFn({ data: { parentId, draft, other } });
}

export async function createPartner(
  personId: string,
  draft: PersonDraft,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (onNetlifySite()) {
    const result = addPartner(await loadPersistedTree(), personId, draft);
    return { tree: await savePersistedTree(result.tree), focusId: result.focusId };
  }
  return addPartnerFn({ data: { personId, draft } });
}

export async function createParents(
  personId: string,
  parentA: PersonDraft,
  parentB: PersonDraft | null,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (onNetlifySite()) {
    const result = addParents(await loadPersistedTree(), personId, parentA, parentB);
    return { tree: await savePersistedTree(result.tree), focusId: result.focusId };
  }
  return addParentsFn({ data: { personId, parentA, parentB } });
}

export async function savePerson(id: string, draft: PersonDraft): Promise<FamilyData> {
  if (onNetlifySite()) {
    return savePersistedTree(updatePerson(await loadPersistedTree(), id, draft));
  }
  return updatePersonFn({ data: { id, draft } });
}

export async function deletePerson(id: string): Promise<FamilyData> {
  if (onNetlifySite()) {
    return savePersistedTree(removePerson(await loadPersistedTree(), id));
  }
  return removePersonFn({ data: { id } });
}
