import { makeRng, type Rng } from "@/gen/rng";
import type { BaseOp, Cell, DeliveryStop, Direction, Pose, ProgramToken, RobotBinding, RobotMission } from "./types";
import { expandProgram } from "./engine";

const DIRECTIONS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const key = (c: Cell) => `${c.x},${c.y}`;
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

function directionTo(from: Cell, to: Cell): Direction {
  const dx = to.x - from.x, dy = to.y - from.y;
  const index = DIRECTIONS.findIndex(d => d.x === dx && d.y === dy);
  return (index < 0 ? 0 : index) as Direction;
}

function turns(from: Direction, to: Direction): BaseOp[] {
  const right = (to - from + 4) % 4;
  if (right === 0) return [];
  if (right === 1) return ["right"];
  if (right === 3) return ["left"];
  return ["right", "right"];
}

function witnessFor(path: Cell[], startDirection: Direction, compress: boolean): ProgramToken[] {
  const primitives: BaseOp[] = [];
  let direction = startDirection;
  for (let i = 1; i < path.length; i++) {
    const nextDirection = directionTo(path[i - 1]!, path[i]!);
    primitives.push(...turns(direction, nextDirection), "forward");
    direction = nextDirection;
  }
  let serial = 0;
  const id = (op: string) => `w-${serial++}-${op}`;
  if (!compress) return primitives.map(op => ({ id: id(op), op }));
  const program: ProgramToken[] = [];
  for (let i = 0; i < primitives.length;) {
    const op = primitives[i]!;
    let count = 1;
    while (i + count < primitives.length && primitives[i + count] === op && count < 3) count++;
    if (count >= 2) program.push({ id: id(`repeat-${op}`), op: "repeat", times: count as 2 | 3, body: op });
    else program.push({ id: id(op), op });
    i += count;
  }
  return program;
}

function randomPath(rng: Rng, size: number, desired: number, attempt: number): Cell[] {
  const start = { x: rng.int(0, size - 1), y: size - 1 - rng.int(0, attempt % 2) };
  const path = [start];
  const used = new Set([key(start)]);
  let direction = rng.int(0, 3) as Direction;
  for (let step = 0; step < desired; step++) {
    const from = path[path.length - 1]!;
    const options = DIRECTIONS.map((d, index) => ({
      cell: { x: from.x + d.x, y: from.y + d.y },
      index,
      score: rng.next() + (index === direction ? 0.7 : 0),
    })).filter(o => o.cell.x >= 0 && o.cell.y >= 0 && o.cell.x < size && o.cell.y < size && !used.has(key(o.cell)));
    if (!options.length) break;
    options.sort((a, b) => b.score - a.score);
    const choice = options[rng.int(0, Math.min(1, options.length - 1))]!;
    path.push(choice.cell);
    used.add(key(choice.cell));
    direction = choice.index as Direction;
  }
  return path;
}

function stopIndexes(length: number, count: number) {
  const result: number[] = [];
  for (let i = 1; i <= count; i++) {
    const index = Math.max(1, Math.round(i * (length - 1) / count));
    if (!result.includes(index)) result.push(index);
  }
  return result;
}

export function generateRobotMission(seed: number, band: number, binding: RobotBinding): RobotMission {
  const supportedBand = Math.max(4, Math.min(6, Math.round(band)));
  const size = supportedBand >= 6 ? 6 : 5;
  const stopCount = supportedBand === 4 ? 2 : supportedBand === 5 ? 3 : 4;
  const desired = stopCount * 2 + 1;
  const maxTokens = supportedBand === 4 ? 10 : supportedBand === 5 ? 9 : 11;
  for (let attempt = 0; attempt < 120; attempt++) {
    const rng = makeRng((seed + attempt * 104729) >>> 0);
    const path = randomPath(rng, size, desired, attempt);
    const indexes = stopIndexes(path.length, stopCount);
    if (indexes.length !== stopCount || path.length < desired + 1) continue;
    const startDirection: Direction = 2;
    const witness = witnessFor(path, startDirection, supportedBand >= 5);
    if (witness.length > maxTokens || witness.length < 3) continue;
    const pathKeys = new Set(path.map(key));
    const stops: DeliveryStop[] = indexes.map((index, i) => ({
      ...path[index]!, id: `stop-${i}`, subject: binding.subjects[i % binding.subjects.length]!,
    }));
    const available = rng.shuffle(Array.from({ length: size * size }, (_, i) => ({ x: i % size, y: Math.floor(i / size) }))
      .filter(c => !pathKeys.has(key(c))));
    const obstacleCount = supportedBand === 4 ? 3 : supportedBand === 5 ? 4 : 6;
    const obstacles = available.slice(0, obstacleCount);
    if (obstacles.length !== obstacleCount) continue;
    return {
      seed, band: supportedBand, size,
      start: { ...path[0]!, direction: startDirection },
      obstacles, stops, ordered: supportedBand >= 6,
      maxTokens, allowsRepeat: supportedBand >= 5, witness,
    };
  }
  // Deterministic, known-solvable fallback; generation constraints are tested broadly.
  const path = Array.from({ length: size }, (_, i) => ({ x: 0, y: size - 1 - i }));
  const indexes = stopIndexes(path.length, stopCount);
  const stops = indexes.map((index, i) => ({ ...path[index]!, id: `stop-${i}`, subject: binding.subjects[i % binding.subjects.length]! }));
  return {
    seed, band: supportedBand, size, start: { x: 0, y: size - 1, direction: 2 },
    obstacles: [], stops, ordered: supportedBand >= 6, maxTokens, allowsRepeat: supportedBand >= 5,
    witness: witnessFor(path, 2, supportedBand >= 5),
  };
}

export function witnessIsWithinBudget(mission: RobotMission) {
  return mission.witness.length <= mission.maxTokens && expandProgram(mission.witness).length > 0;
}

export function isSameCell(a: Cell, b: Cell) { return same(a, b); }
