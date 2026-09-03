import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { PersonDraft, Sex } from "@/lib/tree/types";

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "female", label: "Mujer" },
  { value: "male", label: "Hombre" },
  { value: "unspecified", label: "Sin especificar" },
];

type PersonFormFieldsProps = {
  idPrefix: string;
  draft: PersonDraft;
  onChange: (draft: PersonDraft) => void;
  required?: boolean;
};

export function PersonFormFields({ idPrefix, draft, onChange, required = true }: PersonFormFieldsProps) {
  function patch(partial: Partial<PersonDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-given`}>Nombre</Label>
          <Input
            id={`${idPrefix}-given`}
            value={draft.givenName}
            onChange={(e) => patch({ givenName: e.target.value })}
            placeholder="Lucía"
            autoComplete="off"
            required={required}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-family`}>Apellidos</Label>
          <Input
            id={`${idPrefix}-family`}
            value={draft.familyName}
            onChange={(e) => patch({ familyName: e.target.value })}
            placeholder="Pérez Quintanar"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Género</Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
          {SEX_OPTIONS.map((opt) => {
            const active = draft.sex === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch({ sex: opt.value })}
                className={cn(
                  "h-10 rounded-md px-2 text-xs font-medium transition-colors duration-150 sm:text-sm",
                  active
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-birth`}>Año de nacimiento</Label>
          <Input
            id={`${idPrefix}-birth`}
            value={draft.birthYear}
            onChange={(e) => patch({ birthYear: e.target.value })}
            placeholder="1952"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-death`}>Año de fallecimiento</Label>
          <Input
            id={`${idPrefix}-death`}
            value={draft.deathYear}
            onChange={(e) => patch({ deathYear: e.target.value })}
            placeholder="Opcional"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notas</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Oficio, lugar, recuerdos…"
          rows={3}
        />
      </div>
    </div>
  );
}
