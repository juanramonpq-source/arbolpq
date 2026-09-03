import { emptyDraft, type Person, type PersonDraft, type Union } from "./types";

export type { OtherParent } from "./types";

function partnerUnion(unions: Union[], personId: string): Union | undefined {
  return unions.find((u) => u.aId === personId || u.bId === personId);
}

function childUnion(unions: Union[], personId: string): Union | undefined {
  return unions.find((u) => u.childrenIds.includes(personId));
}

function otherPartnerId(union: Union, personId: string): string | null {
  if (union.aId === personId) return union.bId;
  if (union.bId === personId) return union.aId;
  return null;
}

export function suggestedChildSurnames(parentA: Person, parentB: Person | null): string {
  const first = (familyName: string) => familyName.trim().split(/\s+/).filter(Boolean)[0] ?? "";
  if (!parentB) return parentA.familyName;
  const father =
    parentA.sex === "male" ? parentA : parentB.sex === "male" ? parentB : null;
  const mother =
    parentA.sex === "female" ? parentA : parentB.sex === "female" ? parentB : null;
  if (father && mother && father.id !== mother.id) {
    return `${first(father.familyName)} ${first(mother.familyName)}`.trim();
  }
  return `${first(parentA.familyName)} ${first(parentB.familyName)}`.trim();
}

export function suggestedParentSurnames(child: Person): { parentA: string; parentB: string } {
  const parts = child.familyName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { parentA: parts[0]!, parentB: parts.slice(1).join(" ") };
  }
  return { parentA: child.familyName, parentB: "" };
}

export function getPartner(personId: string, people: Person[], unions: Union[]): Person | null {
  const u = partnerUnion(unions, personId);
  if (!u) return null;
  const other = otherPartnerId(u, personId);
  if (!other) return null;
  return people.find((p) => p.id === other) ?? null;
}

export function hasParents(personId: string, unions: Union[]): boolean {
  return Boolean(childUnion(unions, personId));
}

export function getParents(personId: string, people: Person[], unions: Union[]): Person[] {
  const u = childUnion(unions, personId);
  if (!u) return [];
  return [u.aId, u.bId]
    .filter((id): id is string => typeof id === "string")
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));
}

export function ancestorRoots(personId: string, people: Person[], unions: Union[]): Person[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const roots: Person[] = [];
  const seen = new Set<string>();

  function walk(id: string) {
    if (seen.has(id)) return;
    seen.add(id);
    const union = childUnion(unions, id);
    if (!union) {
      const person = byId.get(id);
      if (person) roots.push(person);
      return;
    }
    walk(union.aId);
    if (union.bId) walk(union.bId);
  }

  walk(personId);
  return roots;
}

export { emptyDraft };
export type { PersonDraft };
