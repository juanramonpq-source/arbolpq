import { isSandboxPreviewGuestHost } from "@/lib/preview-embedder-origin";

export type FamilyShare = {
  url: string;
  isPublic: boolean;
};

function injectedPublicHost(): string {
  const raw = String(
    (import.meta.env as Record<string, string | undefined>).VITE_PUBLIC_HOSTNAME ?? "",
  )
    .trim()
    .split(",")[0]
    ?.trim()
    .split(":")[0]
    ?.toLowerCase() ?? "";
  if (!raw || !/^[a-z0-9.-]+$/.test(raw) || !raw.includes(".")) return "";
  return raw.replace(/\/$/, "");
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
  if (isSandboxPreviewGuestHost(host)) return true;
  if (host.includes(".preview.")) return true;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  return false;
}

/** Address to hand to family. Prefers the published host so a preview URL is never sent. */
export function familyShare(): FamilyShare {
  const injected = injectedPublicHost();
  if (injected) return { url: `https://${injected}/`, isPublic: true };
  if (typeof window === "undefined") return { url: "", isPublic: false };
  const host = window.location.hostname;
  return {
    url: window.location.href,
    isPublic: !isPrivateHost(host),
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to a selection copy that does not prompt for clipboard access.
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.setAttribute("aria-hidden", "true");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}
