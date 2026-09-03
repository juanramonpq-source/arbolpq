import { useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowUp, Trash2, UserPlus, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { PersonFormFields } from "@/components/family/PersonFormFields";
import { createChild, createParents, createPartner, deletePerson, savePerson } from "@/lib/tree/browser-api";
import {
  ancestorRoots,
  emptyDraft,
  getParents,
  getPartner,
  hasParents,
  suggestedChildSurnames,
  suggestedParentSurnames,
} from "@/lib/tree/store";
import { fullName, type FamilyData, type Person, type PersonDraft, type Union } from "@/lib/tree/types";
import type { Panel } from "@/components/family/panel";

type PersonDialogProps = {
  panel: Panel;
  people: Person[];
  unions: Union[];
  hydrate: (data: FamilyData) => void;
  onChange: (panel: Panel) => void;
};

function errorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (/unauthor|forbidden|permission|not allowed|401|403/i.test(raw)) {
    return "No se pudo guardar. Recarga la página e inténtalo de nuevo.";
  }
  if (raw && raw.length < 180 && !/https?:| at |stack/i.test(raw)) return raw;
  return fallback;
}


export function PersonDialog({ panel, people, unions, hydrate, onChange }: PersonDialogProps) {
  const treeRef = useRef({ people, unions });
  treeRef.current = { people, unions };

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [includePartner, setIncludePartner] = useState(false);
  const [draft, setDraft] = useState<PersonDraft>(emptyDraft());
  const [partnerDraft, setPartnerDraft] = useState<PersonDraft>(emptyDraft());
  const [parentA, setParentA] = useState<PersonDraft>(emptyDraft());
  const [parentB, setParentB] = useState<PersonDraft>(emptyDraft());

  const person = useMemo(() => {
    if (panel.type === "closed") return null;
    const id =
      panel.type === "edit"
        ? panel.id
        : panel.type === "child"
          ? panel.parentId
          : panel.personId;
    return people.find((p) => p.id === id) ?? null;
  }, [panel, people]);

  const partner = person ? getPartner(person.id, people, unions) : null;
  const alreadyHasParents = person ? hasParents(person.id, unions) : false;
  const parents = person ? getParents(person.id, people, unions) : [];
  const roots = person ? ancestorRoots(person.id, people, unions) : [];
  const ancestorTargets = alreadyHasParents ? roots : person ? [person] : [];

  useLayoutEffect(() => {
    setConfirmDelete(false);
    const state = treeRef.current;
    if (panel.type === "child") {
      const parent = state.people.find((p) => p.id === panel.parentId);
      const other = parent ? getPartner(parent.id, state.people, state.unions) : null;
      setDraft(emptyDraft(parent ? suggestedChildSurnames(parent, other) : ""));
      setPartnerDraft(emptyDraft());
      setIncludePartner(false);
    } else if (panel.type === "partner") {
      const p = state.people.find((x) => x.id === panel.personId);
      const sex = p?.sex === "female" ? "male" : p?.sex === "male" ? "female" : "unspecified";
      setDraft({ ...emptyDraft(), sex });
    } else if (panel.type === "parents") {
      const child = state.people.find((p) => p.id === panel.personId);
      const surnames = child ? suggestedParentSurnames(child) : { parentA: "", parentB: "" };
      setParentA({ ...emptyDraft(surnames.parentA), sex: "male" });
      setParentB({ ...emptyDraft(surnames.parentB), sex: "female" });
    } else if (panel.type === "edit") {
      const p = state.people.find((x) => x.id === panel.id);
      if (p) {
        setDraft({
          givenName: p.givenName,
          familyName: p.familyName,
          sex: p.sex,
          birthYear: p.birthYear,
          deathYear: p.deathYear,
          notes: p.notes,
        });
      }
    }
  }, [panel]);

  function close() {
    onChange({ type: "closed" });
    setConfirmDelete(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (panel.type === "edit") {
        if (!draft.givenName.trim()) {
          toast.error("El nombre es obligatorio.");
          return;
        }
        const tree = await savePerson(panel.id, draft);
        hydrate(tree);
        toast.success("Guardado en el árbol compartido.");
        close();
        return;
      }
      if (panel.type === "child") {
        const result = await createChild(
          panel.parentId,
          draft,
          includePartner && !partner
            ? { kind: "new", draft: partnerDraft }
            : { kind: "none" },
        );
        hydrate(result.tree);
        toast.success("Rama guardada en el árbol compartido.");
        onChange({ type: "edit", id: result.focusId });
        return;
      }
      if (panel.type === "partner") {
        const result = await createPartner(panel.personId, draft);
        hydrate(result.tree);
        toast.success("Pareja guardada en el árbol compartido.");
        onChange({ type: "edit", id: result.focusId });
        return;
      }
      if (panel.type === "parents") {
        if (!parentA.givenName.trim() && !parentB.givenName.trim()) {
          toast.error("Indica al menos el nombre del padre o de la madre.");
          return;
        }
        const result = await createParents(panel.personId, parentA, parentB);
        hydrate(result.tree);
        toast.success("Progenitores guardados en el árbol compartido.");
        onChange({ type: "edit", id: result.focusId });
      }
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo guardar. Inténtalo de nuevo."));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (panel.type !== "edit" || saving) return;
    setSaving(true);
    try {
      const tree = await deletePerson(panel.id);
      hydrate(tree);
      toast.success("Persona eliminada del árbol compartido.");
      setConfirmDelete(false);
      close();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo eliminar."));
    } finally {
      setSaving(false);
    }
  }

  const open = panel.type !== "closed";
  const title =
    panel.type === "edit"
      ? fullName(draft) || "Persona"
      : panel.type === "child"
        ? "Nuevo descendiente"
        : panel.type === "partner"
          ? "Añadir pareja"
          : panel.type === "parents"
            ? "Añadir progenitores"
            : "Persona";

  const description =
    panel.type === "edit"
      ? "Los cambios se guardan para toda la familia que abra este enlace."
      : panel.type === "child"
        ? person
          ? `Hijo o hija de ${fullName(person)}${partner ? ` y ${fullName(partner)}` : ""}.`
          : ""
        : panel.type === "partner"
          ? person
            ? `Pareja de ${fullName(person)}.`
            : ""
          : panel.type === "parents"
            ? person
              ? `Padre y madre de ${fullName(person)}. Rellena uno o los dos.`
              : ""
            : "";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && !saving && close()}>
        <DialogContent className={panel.type === "parents" ? "sm:max-w-3xl" : undefined}>
          <form onSubmit={(event) => void onSubmit(event)} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            {panel.type === "edit" && person ? (
              <div className="grid gap-2 rounded-lg bg-secondary p-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Hacia los ancestros
                </p>
                {parents.length > 0 ? (
                  <p className="text-sm text-foreground">
                    Padres: {parents.map((p) => fullName(p)).join(" y ")}.
                  </p>
                ) : (
                  <p className="text-sm text-foreground">
                    Aún no tiene padre ni madre en el árbol. Así se tira hacia arriba.
                  </p>
                )}
                {ancestorTargets.map((target) => (
                  <Button
                    key={target.id}
                    type="button"
                    variant="default"
                    disabled={saving}
                    onClick={() => onChange({ type: "parents", personId: target.id })}
                  >
                    <ArrowUp />
                    Añadir padres de {target.givenName}
                  </Button>
                ))}
              </div>
            ) : null}

            {panel.type === "edit" || panel.type === "child" || panel.type === "partner" ? (
              <PersonFormFields idPrefix="person" draft={draft} onChange={setDraft} />
            ) : null}

            {panel.type === "child" && !partner ? (
              <div className="grid gap-3 rounded-lg bg-secondary p-3">
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={includePartner}
                    onChange={(e) => setIncludePartner(e.target.checked)}
                  />
                  Añadir también al otro progenitor
                </label>
                {includePartner ? (
                  <PersonFormFields
                    idPrefix="other-parent"
                    draft={partnerDraft}
                    onChange={setPartnerDraft}
                  />
                ) : null}
              </div>
            ) : null}

            {panel.type === "parents" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid content-start gap-3 rounded-lg bg-secondary p-3">
                  <p className="text-sm font-medium">Padre</p>
                  <PersonFormFields
                    idPrefix="parent-a"
                    draft={parentA}
                    onChange={setParentA}
                    required={false}
                  />
                </div>
                <div className="grid content-start gap-3 rounded-lg bg-secondary p-3">
                  <p className="text-sm font-medium">Madre</p>
                  <PersonFormFields
                    idPrefix="parent-b"
                    draft={parentB}
                    onChange={setParentB}
                    required={false}
                  />
                </div>
              </div>
            ) : null}

            {panel.type === "edit" && person ? (
              <>
                <Separator />
                <div className="grid gap-2 rounded-lg bg-secondary p-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Pareja
                  </p>
                  {partner ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => onChange({ type: "edit", id: partner.id })}
                    >
                      <Users />
                      {fullName(partner)}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      disabled={saving}
                      onClick={() => onChange({ type: "partner", personId: person.id })}
                    >
                      <Users />
                      Añadir pareja
                    </Button>
                  )}
                </div>
                <div className="grid gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Hacia los descendientes
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => onChange({ type: "child", parentId: person.id })}
                  >
                    <UserPlus />
                    Añadir hijo/a
                  </Button>
                </div>
              </>
            ) : null}

            <DialogFooter className={panel.type === "edit" ? "sm:justify-between" : undefined}>
              {panel.type === "edit" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={saving}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 />
                  Eliminar
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled={saving} onClick={close}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Guardando…"
                  : panel.type === "edit"
                    ? "Guardar cambios"
                    : "Añadir al árbol"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {person ? fullName(person) : "esta persona"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará del árbol compartido para toda la familia. Las ramas que
              dependan solo de esta persona quedarán como raíces independientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void onDelete();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
