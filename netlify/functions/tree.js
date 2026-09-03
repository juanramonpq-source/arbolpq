import { connectLambda, getStore } from "@netlify/blobs";

const STORE_NAME = "arbol-perez-quintanar";
const TREE_KEY = "tree";

function json(status, data) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
    body: JSON.stringify(data),
  };
}

function isFamilyData(value) {
  if (!value || typeof value !== "object") return false;
  return Array.isArray(value.people) && Array.isArray(value.unions);
}

export async function handler(event) {
  const method = String(event.httpMethod || event.method || "GET").toUpperCase();
  if (method === "OPTIONS") return json(200, { ok: true });

  try {
    // Netlify deploys this legacy handler in Lambda compatibility mode. Give
    // Blobs the runtime credentials carried by the invocation before opening
    // the shared store.
    connectLambda(event);
    // Lambda compatibility invocations provide the edge Blobs endpoint. Its
    // reads are shared between devices, but do not support strong consistency.
    const store = getStore(STORE_NAME);
    if (method === "GET") {
      const data = await store.get(TREE_KEY, { type: "json" });
      return json(200, isFamilyData(data) ? data : { people: [], unions: [] });
    }
    if (method === "PUT" || method === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!isFamilyData(body)) return json(400, { error: "Árbol no válido." });
      await store.setJSON(TREE_KEY, body);
      return json(200, body);
    }
    return json(405, { error: "Método no permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return json(500, { error: message });
  }
}
