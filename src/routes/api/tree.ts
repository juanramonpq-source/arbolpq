import { createFileRoute } from "@tanstack/react-router";
import { loadDocumentTree, saveDocumentTree } from "@/lib/tree/document-store";
import { createSeed } from "@/lib/tree/seed";
import type { FamilyData } from "@/lib/tree/types";

function isFamilyData(value: unknown): value is FamilyData {
  if (!value || typeof value !== "object") return false;
  const record = value as { people?: unknown; unions?: unknown };
  return Array.isArray(record.people) && Array.isArray(record.unions);
}

export const Route = createFileRoute("/api/tree")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const tree = await loadDocumentTree();
          return Response.json(tree, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json(createSeed(), { headers: { "cache-control": "no-store" } });
        }
      },
      PUT: async ({ request }) => {
        const body = await request.json();
        if (!isFamilyData(body)) {
          return Response.json({ error: "Árbol no válido." }, { status: 400 });
        }
        const tree = await saveDocumentTree(body);
        return Response.json(tree);
      },
      POST: async ({ request }) => {
        const body = await request.json();
        if (!isFamilyData(body)) {
          return Response.json({ error: "Árbol no válido." }, { status: 400 });
        }
        const tree = await saveDocumentTree(body);
        return Response.json(tree);
      },
    },
  },
});
