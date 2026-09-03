import type { FamilyData, Person, Union } from "./types";

const people: Person[] = [
  {
    id: "juan-perez-martinez",
    givenName: "Juan",
    familyName: "Pérez Martínez",
    sex: "male",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "maria-angeles-alcarria-plaza",
    givenName: "María Ángeles",
    familyName: "Alcarria Plaza",
    sex: "female",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "miguel-quintanar-ucendo",
    givenName: "Miguel",
    familyName: "Quintanar Ucendo",
    sex: "male",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "consuelo-calonge-alamo",
    givenName: "Consuelo",
    familyName: "Calonge Álamo",
    sex: "female",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "juan-ramon-perez-alcarria",
    givenName: "Juan Ramón",
    familyName: "Pérez Alcarria",
    sex: "male",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "esperanza-quintanar-calonge",
    givenName: "Esperanza",
    familyName: "Quintanar Calonge",
    sex: "female",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "lucia-perez-quintanar",
    givenName: "Lucía",
    familyName: "Pérez Quintanar",
    sex: "female",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
  {
    id: "juan-ramon-perez-quintanar",
    givenName: "Juan Ramón",
    familyName: "Pérez Quintanar",
    sex: "male",
    birthYear: "",
    deathYear: "",
    notes: "",
    founder: true,
  },
];

const unions: Union[] = [
  {
    id: "union-paternal-grandparents",
    aId: "juan-perez-martinez",
    bId: "maria-angeles-alcarria-plaza",
    childrenIds: ["juan-ramon-perez-alcarria"],
  },
  {
    id: "union-maternal-grandparents",
    aId: "miguel-quintanar-ucendo",
    bId: "consuelo-calonge-alamo",
    childrenIds: ["esperanza-quintanar-calonge"],
  },
  {
    id: "union-parents",
    aId: "juan-ramon-perez-alcarria",
    bId: "esperanza-quintanar-calonge",
    childrenIds: ["lucia-perez-quintanar", "juan-ramon-perez-quintanar"],
  },
];

export const FOCUS_PERSON_ID = "lucia-perez-quintanar";
export const SIBLING_PERSON_ID = "juan-ramon-perez-quintanar";


export function createSeed(): FamilyData {
  return {
    people: people.map((p) => ({ ...p })),
    unions: unions.map((u) => ({ ...u, childrenIds: [...u.childrenIds] })),
  };
}
