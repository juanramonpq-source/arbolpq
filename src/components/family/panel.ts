export type Panel =
  | { type: "closed" }
  | { type: "edit"; id: string }
  | { type: "child"; parentId: string }
  | { type: "partner"; personId: string }
  | { type: "parents"; personId: string };
