import { useEffect, useMemo, useRef, type PointerEvent, type WheelEvent } from "react";
import { ArrowUp, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GEN_H,
  PAD_Y,
  generationTitle,
  layoutTree,
} from "@/lib/tree/layout";
import { FOCUS_PERSON_ID } from "@/lib/tree/seed";
import { hasParents } from "@/lib/tree/store";
import { fullName, initials, yearsLabel, type Person, type Union } from "@/lib/tree/types";

type TreeCanvasProps = {
  people: Person[];
  unions: Union[];
  selectedId: string | null;
  query: string;
  scale: number;
  onScaleChange: (scale: number) => void;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddParents: (personId: string) => void;
  onAddPartner: (personId: string) => void;
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.35;

export function TreeCanvas({
  people,
  unions,
  selectedId,
  query,
  scale,
  onScaleChange,
  onSelect,
  onAddChild,
  onAddParents,
  onAddPartner,
}: TreeCanvasProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  const layout = useMemo(() => layoutTree({ people, unions }), [people, unions]);
  const q = query.trim().toLowerCase();

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || fitted.current || Object.keys(layout.boxes).length === 0) return;
    fitted.current = true;
    const focus = layout.boxes[FOCUS_PERSON_ID] ?? Object.values(layout.boxes)[0];
    if (!focus) return;
    const next = Math.min(1, Math.max(0.55, (el.clientWidth / layout.width) * 0.92));
    onScaleChange(next);
    requestAnimationFrame(() => {
      const node = scrollerRef.current;
      if (!node) return;
      const cx = (focus.x + focus.w / 2) * next - node.clientWidth / 2;
      const cy = (focus.y + focus.h / 2) * next - node.clientHeight / 2.4;
      node.scrollTo({ left: Math.max(0, cx), top: Math.max(0, cy) });
    });
  }, [layout, onScaleChange]);

  useEffect(() => {
    if (!selectedId) return;
    const el = scrollerRef.current;
    const box = layout.boxes[selectedId];
    if (!el || !box || !fitted.current) return;
    const left = box.x * scale;
    const top = (box.y - 24) * scale;
    const right = left + box.w * scale;
    const bottom = (box.y + box.h + 24) * scale;
    const pad = 20;
    const viewL = el.scrollLeft;
    const viewT = el.scrollTop;
    const viewR = viewL + el.clientWidth;
    const viewB = viewT + el.clientHeight;
    if (left >= viewL + pad && right <= viewR - pad && top >= viewT + pad && bottom <= viewB - pad) {
      return;
    }
    el.scrollTo({
      left: Math.max(0, left + (box.w * scale) / 2 - el.clientWidth / 2),
      top: Math.max(0, top + (box.h * scale) / 2 - el.clientHeight / 2.6),
      behavior: "smooth",
    });
  }, [selectedId, layout, scale]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-person-card]")) return;
    const el = scrollerRef.current;
    if (!el) return;
    drag.current = { x: event.clientX, y: event.clientY, sl: el.scrollLeft, st: el.scrollTop };
    el.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    const el = scrollerRef.current;
    if (!d || !el) return;
    el.scrollLeft = d.sl - (event.clientX - d.x);
    el.scrollTop = d.st - (event.clientY - d.y);
  }

  function endDrag() {
    drag.current = null;
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const el = scrollerRef.current;
    if (!el) return;
    const delta = event.deltaY > 0 ? 0.92 : 1.08;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));
    const rect = el.getBoundingClientRect();
    const px = event.clientX - rect.left + el.scrollLeft;
    const py = event.clientY - rect.top + el.scrollTop;
    const ratio = next / scale;
    onScaleChange(next);
    requestAnimationFrame(() => {
      el.scrollLeft = px * ratio - (event.clientX - rect.left);
      el.scrollTop = py * ratio - (event.clientY - rect.top);
    });
  }

  return (
    <div
      ref={scrollerRef}
      className="relative min-h-0 flex-1 cursor-grab overflow-auto overscroll-contain active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
    >
      <div
        style={{
          width: layout.width * scale,
          height: layout.height * scale,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `scale(${scale})`,
          }}
        >
          {layout.peopleByGen.map((_, g) => (
            <div
              key={g}
              className="pointer-events-none absolute right-0 left-0 px-6 text-xs font-medium tracking-widest text-muted-foreground uppercase"
              style={{ top: PAD_Y + g * GEN_H - 56 }}
            >
              {generationTitle(g, layout.focusGen)}
            </div>
          ))}

          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.connectors.map((c, i) => (
              <g key={i} className="stroke-line">
                <path
                  d={`M ${c.parentX} ${c.parentY} V ${c.barY} M ${c.barX1} ${c.barY} H ${c.barX2}`}
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {c.drops.map((d, j) => (
                  <path
                    key={j}
                    d={`M ${d.x} ${c.barY} V ${d.y2}`}
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ))}
                <circle cx={c.parentX} cy={c.barY} r="3.5" className="fill-primary" />
              </g>
            ))}
            {layout.coupleBars.map((bar, i) => (
              <g key={`c-${i}`}>
                <path
                  d={`M ${bar.x1 + 4} ${bar.y} H ${bar.x2 - 4}`}
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle
                  cx={(bar.x1 + bar.x2) / 2}
                  cy={bar.y}
                  r="3.25"
                  className="fill-primary"
                />
              </g>
            ))}
          </svg>

          {people.map((person) => {
            const box = layout.boxes[person.id];
            if (!box) return null;
            const match = !q || fullName(person).toLowerCase().includes(q);
            const selected = person.id === selectedId;
            const canAddParents = !hasParents(person.id, unions);
            return (
              <article
                key={person.id}
                data-person-card
                className="absolute"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              >
                {canAddParents ? (
                  <button
                    type="button"
                    data-person-card
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddParents(person.id);
                    }}
                    className="absolute -top-5 right-2 left-2 z-10 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-secondary text-xs font-medium text-primary shadow-[var(--shadow-card)] transition-[transform,background-color] duration-150 hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
                    aria-label={`Añadir padres de ${fullName(person)}`}
                  >
                    <ArrowUp className="size-3.5" />
                    Añadir padres
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSelect(person.id)}
                  aria-pressed={selected}
                  aria-label={fullName(person)}
                  className={cn(
                    "group relative flex h-full w-full flex-col rounded-xl bg-card p-3.5 text-left text-card-foreground shadow-[var(--shadow-card)]",
                    "transition-[transform,box-shadow,opacity] duration-150 ease-out",
                    "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80",
                    selected && "ring-2 ring-primary shadow-[var(--shadow-card-hover)]",
                    !match && "opacity-30",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0 left-4 h-0.5 w-8 rounded-full",
                      person.sex === "female"
                        ? "bg-accent"
                        : person.sex === "male"
                          ? "bg-primary"
                          : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-primary">
                      {initials(person)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg leading-tight font-semibold tracking-tight">
                        {person.givenName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {person.familyName}
                      </span>
                    </span>
                  </span>
                  <span className="mt-auto pt-2 text-xs tabular-nums text-muted-foreground">
                    {yearsLabel(person) || "Años por completar"}
                  </span>
                </button>
                <button
                  type="button"
                  data-person-card
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(person.id);
                  }}
                  className="absolute -bottom-4 left-1/2 z-10 inline-flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-[var(--shadow-card)] transition-[transform,background-color] duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
                  aria-label={`Añadir descendiente de ${fullName(person)}`}
                >
                  <Plus className="size-3.5" />
                </button>
              </article>
            );
          })}

          {layout.partnerSlots.map((slot) => {
            const person = people.find((p) => p.id === slot.personId);
            if (!person) return null;
            const match = !q || fullName(person).toLowerCase().includes(q);
            return (
              <button
                key={`pareja-${slot.personId}`}
                type="button"
                data-person-card
                onClick={(e) => {
                  e.stopPropagation();
                  onAddPartner(slot.personId);
                }}
                style={{ left: slot.x, top: slot.y, width: slot.w, height: slot.h }}
                className={cn(
                  "absolute z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/45 bg-secondary/70 px-3 text-center text-primary",
                  "transition-[transform,background-color,border-color,opacity] duration-150",
                  "hover:-translate-y-0.5 hover:border-primary hover:bg-secondary",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80",
                  !match && "opacity-30",
                )}
                aria-label={`Añadir pareja de ${fullName(person)}`}
              >
                <Users className="size-5" />
                <span className="text-xs font-medium leading-tight">Añadir pareja</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
