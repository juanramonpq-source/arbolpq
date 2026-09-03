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

function useLocalPersistence(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".grok.me") || host.endsWith(".vercel.app")) return false;
  return true;
}

export async function loadFamily(): Promise<FamilyData> {
  if (useLocalPersistence()) return loadPersistedTree();
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
  if (!useLocalPersistence()) {
    try {
      return await addChildFn({ data: { parentId, draft, other } });
    } catch {
      // Netlify / static hosts have no PGLite. Fall through.
    }
  }
  const result = addChild(await loadPersistedTree(), parentId, draft, other);
  return { tree: await savePersistedTree(result.tree), focusId: result.focusId };
}

export async function createPartner(
  personId: string,
  draft: PersonDraft,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (!useLocalPersistence()) {
    try {
      return await addPartnerFn({ data: { personId, draft } });
    } catch {
      // Fall through to local save.
    }
  }
  const result = addPartner(await loadPersistedTree(), personId, draft);
  return { tree: await savePersistedTree(result.tree), focusId: result.focusId };
}

export async function createParents(
  personId: string,
  parentA: PersonDraft,
  parentB: PersonDraft | null,
): Promise<{ tree: FamilyData; focusId: string }> {
  if (!useLocalPersistence()) {
    try {
      return await addParentsFn({ data: { personId, parentA, parentB } });
    } catch {
      // Fall through to local save.
    }
  }
  const result = addParents(await loadPersistedTree(), personId, parentA, parentB);
  return { tree: await savePersistedTree(result.tree), focusId: result.focusId };
}

export async function savePerson(id: string, draft: PersonDraft): Promise<FamilyData> {
  if (!useLocalPersistence()) {
    try {
      return await updatePersonFn({ data: { id, draft } });
    } catch {
      // Fall through to local save.
    }
  }
  return savePersistedTree(updatePerson(await loadPersistedTree(), id, draft));
}

export async function deletePerson(id: string): Promise<FamilyData> {
  if (!useLocalPersistence()) {
    try {
      return await removePersonFn({ data: { id } });
    } catch {
      // Fall through to local save.
    }
  }
  return savePersistedTree(removePerson(await loadPersistedTree(), id));
}
