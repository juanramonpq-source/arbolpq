import type { FamilyData, Person, Union } from "./types";
import { FOCUS_PERSON_ID, SIBLING_PERSON_ID } from "./seed";

export const CARD_W = 196;
export const CARD_H = 118;
export const COUPLE_GAP = 14;
export const H_GAP = 32;
export const GEN_H = 214;
export const PAD_X = 48;
export const PAD_Y = 108;


export type PersonBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  gen: number;
};

export type CoupleBar = {
  x1: number;
  x2: number;
  y: number;
};

export type UnionConnector = {
  parentX: number;
  parentY: number;
  barY: number;
  barX1: number;
  barX2: number;
  drops: { x: number; y2: number }[];
};

export type PartnerSlot = {
  personId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TreeLayout = {
  boxes: Record<string, PersonBox>;
  coupleBars: CoupleBar[];
  connectors: UnionConnector[];
  partnerSlots: PartnerSlot[];
  width: number;
  height: number;
  maxGen: number;
  peopleByGen: string[][];
  focusGen: number;
};

type Block = {
  key: string;
  personIds: string[];
  width: number;
  x: number;
  desired: number;
  slotSide: "before" | "after" | null;
};

function coupleWidth(count: number): number {
  if (count <= 1) return CARD_W;
  return count * CARD_W + (count - 1) * COUPLE_GAP;
}

function parentsOf(id: string, unions: Union[]): string[] {
  for (const u of unions) {
    if (u.childrenIds.includes(id)) {
      return [u.aId, u.bId].filter((x): x is string => Boolean(x));
    }
  }
  return [];
}

function childrenOf(id: string, unions: Union[]): string[] {
  const ids: string[] = [];
  for (const u of unions) {
    if (u.aId === id || u.bId === id) ids.push(...u.childrenIds);
  }
  return ids;
}

function parentUnionId(id: string, unions: Union[]): string | null {
  return unions.find((u) => u.childrenIds.includes(id))?.id ?? null;
}

function partnerIdOf(id: string, unions: Union[]): string | null {
  for (const u of unions) {
    if (u.aId === id) return u.bId;
    if (u.bId === id) return u.aId;
  }
  return null;
}

/**
 * Generations are measured from Lucía (or Juan Ramón), not from whoever
 * currently has no parents. Adding bisabuelos on one branch only opens a
 * row above that branch; the other grandparents stay put and couples stay
 * on the same row.
 */
function assignGenerations(people: Person[], unions: Union[]): Map<string, number> {
  const known = new Set(people.map((p) => p.id));
  const gen = new Map<string, number>();
  const queue: string[] = [];

  function trySet(id: string | null, g: number) {
    if (!id || !known.has(id) || gen.has(id)) return;
    gen.set(id, g);
    queue.push(id);
  }

  const seedId = known.has(FOCUS_PERSON_ID)
    ? FOCUS_PERSON_ID
    : known.has(SIBLING_PERSON_ID)
      ? SIBLING_PERSON_ID
      : people[0]?.id;
  if (seedId) trySet(seedId, 0);

  function flood() {
    while (queue.length > 0) {
      const id = queue.shift()!;
      const g = gen.get(id) ?? 0;
      trySet(partnerIdOf(id, unions), g);
      for (const parentId of parentsOf(id, unions)) trySet(parentId, g - 1);
      for (const childId of childrenOf(id, unions)) trySet(childId, g + 1);
    }
  }

  flood();
  for (const person of people) {
    if (gen.has(person.id)) continue;
    trySet(person.id, 0);
    flood();
  }

  let min = 0;
  for (const g of gen.values()) min = Math.min(min, g);
  if (min !== 0) {
    for (const [id, g] of gen) gen.set(id, g - min);
  }
  return gen;
}

function orderPartners(ids: string[], byId: Map<string, Person>): string[] {
  if (ids.length < 2) return ids;
  const [a, b] = ids;
  const pa = byId.get(a);
  const pb = byId.get(b);
  if (pa?.sex === "male" && pb?.sex !== "male") return [a, b];
  if (pb?.sex === "male" && pa?.sex !== "male") return [b, a];
  return ids;
}

function personCenter(block: Block, personId: string): number {
  const i = Math.max(0, block.personIds.indexOf(personId));
  return block.x + i * (CARD_W + COUPLE_GAP) + CARD_W / 2;
}

const PACK_GAP = H_GAP + 24;

function packGeneration(blocks: Block[]) {
  if (blocks.length === 0) return;
  const sorted = [...blocks].sort((a, b) => a.desired - b.desired);
  let cursor = Number.NEGATIVE_INFINITY;
  for (const block of sorted) {
    let x = block.desired;
    if (x < cursor) x = cursor;
    block.x = x;
    cursor = x + block.width + PACK_GAP;
  }
}

export function generationTitle(index: number, focusGen = 2): string {
  const delta = index - focusGen;
  const descendants = ["Hijos", "Nietos", "Bisnietos", "Tataranietos", "Choznos"];
  const ancestors = ["Padres", "Abuelos", "Bisabuelos", "Tatarabuelos", "Trastatarabuelos"];
  const label = delta >= 0 ? descendants[delta] : ancestors[-delta - 1];
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][index] ?? String(index + 1);
  return label ? `Generación ${roman} · ${label}` : `Generación ${roman}`;
}

function focusGeneration(genMap: Map<string, number>, maxGen: number): number {
  const focus = genMap.get(FOCUS_PERSON_ID) ?? genMap.get(SIBLING_PERSON_ID);
  if (focus !== undefined) return focus;
  return Math.min(2, maxGen);
}

export function layoutTree(data: FamilyData): TreeLayout {
  const { people, unions } = data;
  if (people.length === 0) {
    return {
      boxes: {},
      coupleBars: [],
      connectors: [],
      partnerSlots: [],
      width: 640,
      height: 400,
      maxGen: 0,
      peopleByGen: [],
      focusGen: 0,
    };
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const genMap = assignGenerations(people, unions);
  const maxGen = people.reduce((m, p) => Math.max(m, genMap.get(p.id) ?? 0), 0);
  const focusGen = focusGeneration(genMap, maxGen);

  const peopleByGen: string[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const p of people) {
    peopleByGen[genMap.get(p.id) ?? 0].push(p.id);
  }

  const blocksByGen: Block[][] = peopleByGen.map((ids) => {
    const idSet = new Set(ids);
    const used = new Set<string>();
    const blocks: Block[] = [];

    for (const u of unions) {
      const partners = [u.aId, u.bId].filter((id): id is string => {
        return typeof id === "string" && idSet.has(id) && !used.has(id);
      });
      if (partners.length === 2) {
        const ordered = orderPartners(partners, byId);
        ordered.forEach((id) => used.add(id));
        blocks.push({
          key: u.id,
          personIds: ordered,
          width: coupleWidth(2),
          x: 0,
          desired: 0,
          slotSide: null,
        });
      }
    }

    for (const id of ids) {
      if (used.has(id)) continue;
      used.add(id);
      const sex = byId.get(id)?.sex;
      blocks.push({
        key: id,
        personIds: [id],
        width: coupleWidth(2),
        x: 0,
        desired: 0,
        slotSide: sex === "female" ? "before" : "after",
      });
    }

    const order = new Map(people.map((p, i) => [p.id, i]));
    blocks.sort((a, b) => (order.get(a.personIds[0]) ?? 0) - (order.get(b.personIds[0]) ?? 0));
    return blocks;
  });

  const personToBlock = new Map<string, Block>();
  function reindex() {
    personToBlock.clear();
    for (const blocks of blocksByGen) {
      for (const b of blocks) {
        for (const id of b.personIds) personToBlock.set(id, b);
      }
    }
  }

  function placeTowardParents(g: number) {
    reindex();
    type Cluster = { blocks: Block[]; anchor: number };
    const clusters = new Map<string, Cluster>();
    for (const block of blocksByGen[g] ?? []) {
      const parentUnions = new Set<string>();
      const parentCenters: number[] = [];
      for (const pid of block.personIds) {
        const uid = parentUnionId(pid, unions);
        if (uid) parentUnions.add(uid);
        for (const parentId of parentsOf(pid, unions)) {
          const pb = personToBlock.get(parentId);
          if (pb) parentCenters.push(personCenter(pb, parentId));
        }
      }
      const key = parentUnions.size === 1 ? [...parentUnions][0]! : `block:${block.key}`;
      const anchor =
        parentCenters.length > 0
          ? parentCenters.reduce((a, b) => a + b, 0) / parentCenters.length
          : block.desired;
      const existing = clusters.get(key);
      if (existing) existing.blocks.push(block);
      else clusters.set(key, { blocks: [block], anchor });
    }
    const list = [...clusters.values()].sort((a, b) => a.anchor - b.anchor);
    let cursor = Number.NEGATIVE_INFINITY;
    for (const cluster of list) {
      let width = 0;
      for (let i = 0; i < cluster.blocks.length; i += 1) {
        if (i > 0) width += H_GAP;
        width += cluster.blocks[i]!.width;
      }
      let start = cluster.anchor - width / 2;
      if (start < cursor) start = cursor;
      let x = start;
      for (const b of cluster.blocks) {
        b.x = x;
        b.desired = x;
        x += b.width + H_GAP;
      }
      cursor = x + 24;
    }
  }

  function placeTowardChildren(g: number) {
    reindex();
    for (const block of blocksByGen[g] ?? []) {
      const childCenters: number[] = [];
      for (const pid of block.personIds) {
        for (const childId of childrenOf(pid, unions)) {
          const cb = personToBlock.get(childId);
          if (cb) childCenters.push(personCenter(cb, childId));
        }
      }
      const mid =
        childCenters.length > 0
          ? childCenters.reduce((a, b) => a + b, 0) / childCenters.length
          : 0;
      block.desired = mid - block.width / 2;
    }
    packGeneration(blocksByGen[g] ?? []);
  }

  {
    let x = 0;
    for (const b of blocksByGen[focusGen] ?? []) {
      b.x = x;
      b.desired = x;
      x += b.width + PACK_GAP;
    }
  }

  for (let g = focusGen + 1; g <= maxGen; g++) placeTowardParents(g);
  for (let g = focusGen - 1; g >= 0; g--) placeTowardChildren(g);

  let minX = Infinity;
  for (const blocks of blocksByGen) {
    for (const b of blocks) minX = Math.min(minX, b.x);
  }
  const shift = Number.isFinite(minX) ? PAD_X - minX : 0;
  if (shift !== 0) {
    for (const blocks of blocksByGen) {
      for (const b of blocks) b.x += shift;
    }
  }

  const boxes: Record<string, PersonBox> = {};
  const partnerSlots: PartnerSlot[] = [];
  for (let g = 0; g <= maxGen; g++) {
    for (const b of blocksByGen[g] ?? []) {
      let x = b.x;
      const y = PAD_Y + g * GEN_H;
      if (b.slotSide === "before") {
        partnerSlots.push({ personId: b.personIds[0]!, x, y, w: CARD_W, h: CARD_H });
        x += CARD_W + COUPLE_GAP;
      }
      for (const id of b.personIds) {
        boxes[id] = {
          id,
          x,
          y,
          w: CARD_W,
          h: CARD_H,
          gen: g,
        };
        x += CARD_W + COUPLE_GAP;
      }
      if (b.slotSide === "after") {
        partnerSlots.push({
          personId: b.personIds[b.personIds.length - 1]!,
          x,
          y,
          w: CARD_W,
          h: CARD_H,
        });
      }
    }
  }

  const coupleBars: CoupleBar[] = [];
  const connectors: UnionConnector[] = [];

  for (const u of unions) {
    const a = boxes[u.aId];
    const b = u.bId ? boxes[u.bId] : undefined;
    const partners = [a, b].filter((x): x is PersonBox => Boolean(x));
    if (partners.length === 2 && a && b && a.gen === b.gen) {
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      coupleBars.push({
        x1: left.x + left.w,
        x2: right.x,
        y: left.y + left.h / 2,
      });
    }

    const children = u.childrenIds.map((id) => boxes[id]).filter((x): x is PersonBox => Boolean(x));
    if (partners.length === 0 || children.length === 0) continue;

    const parentX = partners.reduce((s, p) => s + p.x + p.w / 2, 0) / partners.length;
    const parentY = Math.max(...partners.map((p) => p.y + p.h));
    const childXs = children.map((c) => c.x + c.w / 2);
    const barY = parentY + 36;
    const xs = [parentX, ...childXs];
    connectors.push({
      parentX,
      parentY,
      barY,
      barX1: Math.min(...xs),
      barX2: Math.max(...xs),
      drops: children.map((c) => ({ x: c.x + c.w / 2, y2: c.y })),
    });
  }

  let maxR = 480;
  let maxB = 320;
  for (const box of Object.values(boxes)) {
    maxR = Math.max(maxR, box.x + box.w);
    maxB = Math.max(maxB, box.y + box.h);
  }
  for (const slot of partnerSlots) {
    maxR = Math.max(maxR, slot.x + slot.w);
    maxB = Math.max(maxB, slot.y + slot.h);
  }

  return {
    boxes,
    coupleBars,
    connectors,
    partnerSlots,
    width: maxR + PAD_X,
    height: maxB + PAD_Y + 40,
    maxGen,
    peopleByGen,
    focusGen,
  };
}
