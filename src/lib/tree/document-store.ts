import { createSeed } from "./seed";
import type { FamilyData } from "./types";

const STORE_NAME = "arbol-perez-quintanar";
const TREE_KEY = "tree";

function isFamilyData(value: unknown): value is FamilyData {
  if (!value || typeof value !== "object") return false;
  const record = value as { people?: unknown; unions?: unknown };
  return Array.isArray(record.people) && Array.isArray(record.unions);
}

async function treeStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function loadDocumentTree(): Promise<FamilyData> {
  try {
    const store = await treeStore();
    const data = await store.get(TREE_KEY, { type: "json" });
    if (isFamilyData(data) && data.people.length > 0) return data;
    const seed = createSeed();
    await store.setJSON(TREE_KEY, seed);
    return seed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    throw new Error(
      message.includes("store") || message.includes("blobs") || message.includes("NETLIFY")
        ? "No se pudo abrir el árbol en Netlify. Vuelve a publicar el sitio."
        : "No se pudo cargar el árbol compartido.",
    );
  }
}

export async function mutateDocument<T>(fn: (tree: FamilyData) => T): Promise<T> {
  const tree = await loadDocumentTree();
  const result = fn(tree);
  const next =
    result && typeof result === "object" && "tree" in result
      ? (result as { tree: FamilyData }).tree
      : (result as FamilyData);
  const store = await treeStore();
  await store.setJSON(TREE_KEY, next);
  return result;
}
