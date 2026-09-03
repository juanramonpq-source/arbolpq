export type Sex = "female" | "male" | "unspecified";

export type Person = {
  id: string;
  givenName: string;
  familyName: string;
  sex: Sex;
  birthYear: string;
  deathYear: string;
  notes: string;
  founder?: boolean;
};

export type Union = {
  id: string;
  aId: string;
  bId: string | null;
  childrenIds: string[];
};

export type PersonDraft = {
  givenName: string;
  familyName: string;
  sex: Sex;
  birthYear: string;
  deathYear: string;
  notes: string;
};

export type OtherParent =
  | { kind: "none" }
  | { kind: "new"; draft: PersonDraft }
  | { kind: "existing"; id: string };

export type FamilyData = {
  people: Person[];
  unions: Union[];
};


export const emptyDraft = (familyName = ""): PersonDraft => ({
  givenName: "",
  familyName,
  sex: "unspecified",
  birthYear: "",
  deathYear: "",
  notes: "",
});

export function fullName(person: Pick<Person, "givenName" | "familyName">): string {
  return [person.givenName, person.familyName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function initials(person: Pick<Person, "givenName" | "familyName">): string {
  const a = person.givenName.trim().split(/\s+/).filter(Boolean)[0]?.[0] ?? "";
  const b = person.familyName.trim().split(/\s+/).filter(Boolean)[0]?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function yearsLabel(person: Pick<Person, "birthYear" | "deathYear">): string {
  const b = person.birthYear.trim();
  const d = person.deathYear.trim();
  if (b && d) return `${b} – ${d}`;
  if (b) return `n. ${b}`;
  if (d) return `† ${d}`;
  return "";
}
