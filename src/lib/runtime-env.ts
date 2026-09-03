/** Shared runtime flags. No heavy imports — safe from any server module. */

import { existsSync } from "node:fs";

export function hasDatabaseUrl(): boolean {
  if (typeof process === "undefined") return false;
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * True inside a Netlify Function / AWS Lambda, not on the Netlify build
 * machine. Vite often strips `process.env.NETLIFY` from the server bundle,
 * so we detect the Lambda filesystem instead.
 */
export function isNetlifyRuntime(): boolean {
  if (typeof process === "undefined") return false;
  try {
    const cwd = process.cwd();
    if (cwd === "/var/task" || cwd.startsWith("/var/task/")) return true;
  } catch {
    // ignore
  }
  try {
    if (existsSync("/var/task/_libs") || existsSync("/var/task")) return true;
  } catch {
    // ignore
  }
  const env = process.env;
  if (env.AWS_LAMBDA_FUNCTION_NAME) return true;
  if (env.LAMBDA_TASK_ROOT) return true;
  if (env.NETLIFY_BLOBS_CONTEXT) return true;
  return false;
}

export function isPgliteAssetError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /pglite\.(data|wasm)|\/var\/task\/_libs/i.test(message);
}

/** Persist the family tree in Netlify Blobs (no Postgres, no login). */
export function useDocumentStore(): boolean {
  return isNetlifyRuntime() && !hasDatabaseUrl();
}
