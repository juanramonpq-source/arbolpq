import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Download,
  Link2,
  Maximize2,
  MoreHorizontal,
  Search,
  Share2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PersonDialog } from "@/components/family/PersonDialog";
import { TreeCanvas } from "@/components/family/TreeCanvas";
import { TreeMark } from "@/components/family/TreeMark";
import type { Panel } from "@/components/family/panel";
import { loadTree } from "@/lib/tree/api";
import { copyText, familyShare } from "@/lib/tree/share";
import type { FamilyData } from "@/lib/tree/types";

function treesEqual(a: FamilyData, b: FamilyData): boolean {
  return JSON.stringify(a.people) === JSON.stringify(b.people) && JSON.stringify(a.unions) === JSON.stringify(b.unions);
}

export function FamilyApp({ initial }: { initial: FamilyData }) {
  const [tree, setTree] = useState(initial);
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const generation = useRef(0);
  const people = tree.people;
  const unions = tree.unions;

  function hydrate(data: FamilyData) {
    generation.current += 1;
    treeRef.current = data;
    setTree(data);
  }

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scale, setScale] = useState(0.85);
  const [panel, setPanel] = useState<Panel>({ type: "closed" });
  const [shareOpen, setShareOpen] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const shareUrlRef = useRef<HTMLInputElement>(null);
  const share = familyShare();

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      const gen = generation.current;
      try {
        const next = await loadTree();
        if (cancelled || generation.current !== gen) return;
        if (!treesEqual(treeRef.current, next)) {
          treeRef.current = next;
          setTree(next);
        }
      } catch {
        // Keep the last good tree if a refresh fails.
      }
    }
    const timer = window.setInterval(refresh, 8000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function exportJson() {
    const payload = JSON.stringify({ people, unions }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arbol-perez-quintanar.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Árbol exportado.");
  }

  async function copyShareLink() {
    const current = familyShare();
    if (!current.isPublic) {
      toast.error("Comparte la dirección publicada de la web, no este visor.");
      return;
    }
    const ok = await copyText(current.url);
    if (ok) {
      toast.success("Enlace copiado. Quien lo abra puede ver y actualizar el mismo árbol.");
    } else {
      shareUrlRef.current?.select();
      toast.error("Selecciona la dirección y cópiala a mano.");
    }
  }

  async function nativeShare() {
    const current = familyShare();
    if (!current.isPublic || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "Árbol Pérez Quintanar",
        text: "Árbol familiar abierto: con este enlace se puede ver y actualizar.",
        url: current.url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyShareLink();
    }
  }

  function zoomBy(factor: number) {
    setScale((s) => Math.min(1.35, Math.max(0.4, Number((s * factor).toFixed(3)))));
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a
        href="/arbol-perez-quintanar-netlify.zip"
        download="arbol-perez-quintanar-netlify.zip"
        className="flex min-h-11 items-center justify-center gap-2 bg-primary px-3 text-sm font-medium text-primary-foreground"
      >
        <Download className="size-4" />
        Descargar zip para GitHub
      </a>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <TreeMark className="size-9" />
            <div className="min-w-0">
              <p className="font-display text-lg leading-tight font-semibold tracking-tight sm:text-xl">
                Árbol Pérez Quintanar
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Abierto a quien tenga el enlace · {people.length} personas
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar persona"
                className="h-11 w-56 pl-9"
                aria-label="Buscar persona"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => zoomBy(0.9)} aria-label="Alejar">
                  <ZoomOut />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alejar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => zoomBy(1.1)} aria-label="Acercar">
                  <ZoomIn />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Acercar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:inline-flex"
                  onClick={() => setScale(0.85)}
                  aria-label="Ajustar zoom"
                >
                  <Maximize2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajustar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => setShareOpen(true)}
                  aria-label="Compartir árbol"
                >
                  <Link2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Compartir con la familia</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Más acciones">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                  <Link2 className="size-4" />
                  Compartir árbol
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportJson}>
                  <Download className="size-4" />
                  Exportar JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const a = document.createElement("a");
                    a.href = "/arbol-perez-quintanar-netlify.zip";
                    a.download = "arbol-perez-quintanar-netlify.zip";
                    a.click();
                  }}
                >
                  <Download className="size-4" />
                  Descargar para Netlify
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="px-3 pb-2.5 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar persona"
              className="h-11 pl-9"
              aria-label="Buscar persona"
            />
          </div>
        </div>
      </header>

      <TreeCanvas
        people={people}
        unions={unions}
        selectedId={selectedId}
        query={query}
        scale={scale}
        onScaleChange={setScale}
        onSelect={(id) => {
          setSelectedId(id);
          setPanel({ type: "edit", id });
        }}
        onAddChild={(parentId) => {
          setSelectedId(parentId);
          setPanel({ type: "child", parentId });
        }}
        onAddParents={(personId) => {
          setSelectedId(personId);
          setPanel({ type: "parents", personId });
        }}
        onAddPartner={(personId) => {
          setSelectedId(personId);
          setPanel({ type: "partner", personId });
        }}
      />

      <footer className="border-t border-border/80 px-4 py-2.5 text-center text-xs text-muted-foreground sm:text-left">
        Sin cuentas: quien abre el enlace puede añadir, editar y borrar. El recuadro de al lado añade pareja; el +
        debajo, hijos.
      </footer>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir el árbol</DialogTitle>
            <DialogDescription>
              {share.isPublic
                ? "No hay cuentas ni permisos que dar. Quien tenga esta dirección ve el mismo árbol y puede actualizarlo."
                : "Este visor es solo para ti. A tu hermana pásale la dirección de la web publicada, no un chat."}
            </DialogDescription>
          </DialogHeader>

          {share.isPublic ? (
            <div className="grid gap-2">
              <Label htmlFor="family-share-url">Dirección del árbol</Label>
              <Input
                ref={shareUrlRef}
                id="family-share-url"
                readOnly
                value={share.url}
                onFocus={(event) => event.currentTarget.select()}
                aria-label="Dirección del árbol"
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Si al abrirla aparece una pantalla de Grok pidiendo entrar, que entre una vez. Eso es de Grok, no
                del árbol: después edita igual que tú.
              </p>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground">
              El árbol no pide permiso a nadie. Para publicarlo fuera de Grok, descarga el zip e impórtalo en
              Netlify.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant={share.isPublic ? "secondary" : "default"} asChild>
              <a href="/arbol-perez-quintanar-netlify.zip" download="arbol-perez-quintanar-netlify.zip">
                <Download />
                Descargar zip
              </a>
            </Button>
            {share.isPublic && canNativeShare ? (
              <Button type="button" variant="secondary" onClick={() => void nativeShare()}>
                <Share2 />
                Enviar
              </Button>
            ) : null}
            {share.isPublic ? (
              <Button type="button" onClick={() => void copyShareLink()}>
                <Copy />
                Copiar enlace
              </Button>
            ) : (
              <Button type="button" onClick={() => setShareOpen(false)}>
                Entendido
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PersonDialog
        panel={panel}
        people={people}
        unions={unions}
        hydrate={hydrate}
        onChange={(next) => {
          setPanel(next);
          if (next.type === "edit") setSelectedId(next.id);
          if (next.type === "parents") setSelectedId(next.personId);
          if (next.type === "child") setSelectedId(next.parentId);
          if (next.type === "partner") setSelectedId(next.personId);
          if (next.type === "closed") setSelectedId(null);
        }}
      />
    </div>
  );
}
