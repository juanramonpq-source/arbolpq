import { createSeed } from "./seed";
import type { FamilyData } from "./types";

const STORAGE_KEY = "arbolpq-family-tree-v1";

type Envelope = FamilyData & { savedAt?: number };

function isFamilyData(value: unknown): value is Envelope {
  if (!value || typeof value !== "object") return false;
  const record = value as { people?: unknown; unions?: unknown };
  return Array.isArray(record.people) && Array.isArray(record.unions);
}

function stamp(tree: FamilyData, savedAt = Date.now()): Envelope {
  return {
    people: tree.people,
    unions: tree.unions,
    savedAt,
  };
}

export function preferTree(a: FamilyData | null | undefined, b: FamilyData | null | undefined): Envelope | null {
  const left = isFamilyData(a) && a.people.length > 0 ? a : null;
  const right = isFamilyData(b) && b.people.length > 0 ? b : null;
  if (!left) return right ? stamp(right, Number(right.savedAt) || 0) : null;
  if (!right) return stamp(left, Number(left.savedAt) || 0);
  if (left.people.length !== right.people.length) {
    return left.people.length > right.people.length ? stamp(left, Number(left.savedAt) || 0) : stamp(right, Number(right.savedAt) || 0);
  }
  const leftAt = Number(left.savedAt) || 0;
  const rightAt = Number(right.savedAt) || 0;
  if (leftAt !== rightAt) return leftAt > rightAt ? stamp(left, leftAt) : stamp(right, rightAt);
  const leftSize = JSON.stringify(left).length;
  const rightSize = JSON.stringify(right).length;
  return leftSize >= rightSize ? stamp(left, leftAt) : stamp(right, rightAt);
}

export function readLocalTree(): Envelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isFamilyData(parsed) && parsed.people.length > 0 ? stamp(parsed, Number(parsed.savedAt) || 0) : null;
  } catch {
    return null;
  }
}

export function writeLocalTree(tree: FamilyData): Envelope {
  const next = stamp(tree);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // quota / private mode — keep going with the in-memory tree
    }
  }
  return next;
}

async function parseTree(response: Response): Promise<Envelope | null> {
  if (!response.ok) return null;
  try {
    const data: unknown = await response.json();
    return isFamilyData(data) && data.people.length > 0 ? stamp(data, Number(data.savedAt) || 0) : null;
  } catch {
    return null;
  }
}

const REMOTE_PATHS = ["/api/tree", "/.netlify/functions/tree"];

export async function readRemoteTree(): Promise<Envelope | null> {
  for (const path of REMOTE_PATHS) {
    try {
      const response = await fetch(path, { method: "GET", cache: "no-store" });
      const tree = await parseTree(response);
      if (tree) return tree;
    } catch {
      // try the next endpoint
    }
  }
  return null;
}

export async function writeRemoteTree(tree: Envelope): Promise<Envelope | null> {
  const body = JSON.stringify(tree);
  for (const path of REMOTE_PATHS) {
    try {
      const response = await fetch(path, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
      });
      const saved = await parseTree(response);
      if (saved) return saved;
      if (response.ok) return tree;
    } catch {
      // try the next endpoint
    }
  }
  return null;
}

export async function loadPersistedTree(): Promise<FamilyData> {
  const local = readLocalTree();
  const remote = await readRemoteTree();
  const best = preferTree(remote, local);
  if (!best) {
    const seed = stamp(createSeed());
    writeLocalTree(seed);
    void writeRemoteTree(seed);
    return seed;
  }
  writeLocalTree(best);
  if (!remote || preferTree(best, remote) !== remote) {
    void writeRemoteTree(best);
  }
  return best;
}

export async function savePersistedTree(tree: FamilyData): Promise<FamilyData> {
  const local = writeLocalTree(tree);
  const remote = await writeRemoteTree(local);
  return remote ?? local;
}
