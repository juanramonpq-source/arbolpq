import { getStore } from "@netlify/blobs";

const STORE_NAME = "arbol-perez-quintanar";
const TREE_KEY = "tree";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function isFamilyData(value) {
  if (!value || typeof value !== "object") return false;
  return Array.isArray(value.people) && Array.isArray(value.unions);
}

async function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export default async (request) => {
  try {
    const blobs = await store();
    if (request.method === "GET") {
      const data = await blobs.get(TREE_KEY, { type: "json" });
      return json(isFamilyData(data) ? data : { people: [], unions: [] });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const body = await request.json();
      if (!isFamilyData(body)) {
        return json({ error: "Árbol no válido." }, 400);
      }
      await blobs.setJSON(TREE_KEY, body);
      return json(body);
    }
    return json({ error: "Método no permitido." }, 405);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return json({ error: message }, 500);
  }
};

export const config = {
  path: "/api/tree",
  method: ["GET", "PUT", "POST"],
};
