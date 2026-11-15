import { makeSixSudoku } from "./sudoku-six";
import { makeRng, type Rng } from "./rng";
import type { Band, PuzzleSpec, ShapeName } from "./types";

export const BANDS: Band[] = [3, 4, 5, 6, 7, 8, 9].map((min, id) => ({ id, min, max: min + 1, label: `Ages ${min}–${min + 1}` }));

type Template = { id: string; name: string; icon: string; min: number; max: number; make: (r: Rng, b: number) => PuzzleSpec };

const ANIMALS = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐸", "🐵", "🐯", "🦁", "🐷", "🐨"];
const ANIMAL_NAMES: Record<string, string> = { "🐶": "Dog", "🐱": "Cat", "🐰": "Bunny", "🦊": "Fox", "🐻": "Bear", "🐼": "Panda", "🐸": "Frog", "🐵": "Monkey", "🐯": "Tiger", "🦁": "Lion", "🐷": "Pig", "🐨": "Koala" };
const FRUITS = ["🍎", "🍌", "🍓", "🍇", "🍊", "🍐", "🍒", "🍉"];
const CATS: Record<string, string[]> = {
  fruit: FRUITS,
  animal: ANIMALS,
  vehicle: ["🚗", "🚌", "🚲", "🚀", "🚂", "🚁", "⛵", "🚒"],
  weather: ["☀️", "🌧️", "❄️", "🌈", "⛅", "🌪️"],
  sport: ["⚽", "🏀", "🏈", "🎾", "⚾", "🏐"],
};
const SIZES = [["🐜", "Ant"], ["🐭", "Mouse"], ["🐱", "Cat"], ["🐶", "Dog"], ["🐴", "Horse"], ["🐘", "Elephant"], ["🐋", "Whale"]] as const;
const SIDES: Record<ShapeName, number> = { circle: 0, triangle: 3, square: 4, pentagon: 5, hexagon: 6, star: 10 };

const nm = (e: string) => ANIMAL_NAMES[e] ?? e;
const choiceWith = (r: Rng, answer: string | number, wrong: (string | number)[]) => {
  const opts = r.shuffle([String(answer), ...[...new Set(wrong.map(String))].filter((w) => w !== String(answer)).slice(0, 3)]);
  return { options: opts, answer: opts.indexOf(String(answer)) };
};
const near = (r: Rng, n: number, spread = 3) => {
  const s = new Set<number>();
  while (s.size < 3) { const v = n + r.int(-spread, spread); if (v !== n && v >= 0) s.add(v); }
  return [...s];
};

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

export const TEMPLATES: Template[] = [
  { id: "count", name: "Counting", icon: "🔢", min: 0, max: 3, make: (r, b) => {
    const e = r.pick([...FRUITS, "⭐", "🐞", "🎈"]);
    const n = r.int([3, 5, 9, 12][b]!, [6, 10, 18, 24][b]!);
    const rows: string[][] = [];
    for (let i = 0; i < n; i += 5) rows.push(Array(Math.min(5, n - i)).fill(e));
    return { template: "count", title: "Count them all", story: `Look at all the ${e} in the basket!`, task: `How many ${e} are there?`, hint: "Touch each one as you count out loud.", theme: `counting ${e}`, scene: [e, "🧺", "✨"], visual: { type: "rows", rows }, kind: { type: "number", answer: n } };
  } },
  { id: "pattern", name: "Patterns", icon: "🧩", min: 0, max: 6, make: (r, b) => {
    const units = [["A", "B"], ["A", "A", "B"], ["A", "B", "C"], ["A", "B", "B", "C"], ["A", "B", "C", "C", "B"]];
    const unit = units[Math.min(b + r.int(0, 1), units.length - 1)]!;
    const syms = r.shuffle(r.pick(Object.values(CATS))).slice(0, 3);
    const map = (k: string) => syms["ABC".indexOf(k)]!;
    const len = unit.length * 2 + r.int(1, unit.length - 1);
    const seq = Array.from({ length: len + 1 }, (_, i) => map(unit[i % unit.length]!));
    const answer = seq.pop()!;
    const options = r.shuffle([...new Set([...syms, r.pick(FRUITS)])]).slice(0, 3);
    if (!options.includes(answer)) options[0] = answer;
    const opts = r.shuffle(options);
    return { template: "pattern", title: "What comes next?", story: "A magic parade marches by in a special pattern.", task: "Which one comes next?", hint: "Say the pattern out loud. Where does it start again?", theme: "a repeating parade pattern", scene: syms, visual: { type: "rows", rows: [[...seq, "❓"]] }, kind: { type: "choice", options: opts, answer: opts.indexOf(answer), bigOptions: true } };
  } },
  { id: "odd", name: "Odd one out", icon: "🔍", min: 0, max: 6, make: (r) => {
    const keys = r.shuffle(Object.keys(CATS));
    const main = r.shuffle(CATS[keys[0]!]!).slice(0, 3);
    const odd = r.pick(CATS[keys[1]!]!);
    const opts = r.shuffle([...main, odd]);
    return { template: "odd", title: "Odd one out", story: `Three of these belong together. One sneaked in!`, task: "Tap the one that does not belong.", hint: `Three of them are a ${keys[0]}. What is the other one?`, theme: `a sneaky ${odd} hiding among ${keys[0]} things`, scene: [...main, "🕵️"], kind: { type: "choice", options: opts, answer: opts.indexOf(odd), bigOptions: true } };
  } },
  { id: "add", name: "Adding up", icon: "➕", min: 0, max: 6, make: (r, b) => {
    const e = r.pick(FRUITS);
    const lim = [3, 5, 10, 40, 90, 300, 900][b]!;
    const a = r.int(1, lim), c = r.int(1, lim);
    const who = r.pick(ANIMALS);
    const three = b >= 5;
    const d = three ? r.int(1, lim) : 0;
    const total = a + c + d;
    return { template: "add", title: "Picking time", story: `${nm(who)} is collecting ${e} for a party.`, task: three ? `${nm(who)} picks ${a}, then ${c}, then ${d} more. How many altogether?` : `${nm(who)} has ${a} ${e} and finds ${c} more. How many now?`, hint: b < 2 ? "Count the first group, then keep counting." : "Add the biggest numbers first.", theme: `${nm(who)} gathering fruit`, scene: [who, e, "🧺"], visual: b < 2 ? { type: "rows", rows: [Array(a).fill(e), Array(c).fill(e)] } : undefined, kind: { type: "number", answer: total } };
  } },
  { id: "take", name: "Taking away", icon: "➖", min: 0, max: 6, make: (r, b) => {
    const lim = [5, 8, 15, 50, 100, 500, 1000][b]!;
    const a = r.int(Math.ceil(lim / 2), lim), c = r.int(1, a - 1 || 1);
    const e = r.pick(["🎈", "🍪", "🧁", "🍬"]);
    return { template: "take", title: "Oops, they're gone!", story: `There were treats everywhere — then some disappeared!`, task: `There were ${a} ${e}. ${c} were taken. How many are left?`, hint: "Start at the big number and count back.", theme: `treats vanishing at a party`, scene: [e, "🎉", "😮"], visual: b < 2 ? { type: "rows", rows: [Array(a).fill(e)] } : undefined, kind: { type: "number", answer: a - c } };
  } },
  { id: "size", name: "Smallest to biggest", icon: "📏", min: 0, max: 6, make: (r, b) => {
    if (b <= 2) {
      const pick = r.shuffle(SIZES).slice(0, 3 + b).sort((x, y) => SIZES.indexOf(x) - SIZES.indexOf(y));
      const answer = pick.map(([e, n]) => `${e} ${n}`);
      return { template: "size", title: "Line up by size", story: "The animals want a photo, smallest in front!", task: "Tap them from smallest to biggest.", hint: "Which animal could fit in your hand?", theme: "animals lining up for a photo", scene: pick.map(([e]) => e), kind: { type: "order", items: r.shuffle(answer), answer, first: "smallest", last: "biggest" } };
    }
    const nums = new Set<number>(); while (nums.size < 5) nums.add(r.int(10, b === 3 ? 99 : b <= 5 ? 999 : 9999));
    const answer = [...nums].sort((x, y) => x - y).map(String);
    return { template: "size", title: "Number lineup", story: "The robots wear number badges and need to line up.", task: "Tap the numbers from smallest to biggest.", hint: "Compare the first digit, then the next.", theme: "robots lining up by number", scene: ["🤖", "🔢", "⚡"], kind: { type: "order", items: r.shuffle(answer), answer, first: "smallest", last: "biggest" } };
  } },
  { id: "sequence", name: "Number trail", icon: "🪜", min: 0, max: 6, make: (r, b) => {
    let seq: number[];
    if (b <= 2) { const s = r.int(1, 5), k = b === 0 ? 1 : r.int(1, 2); seq = [0, 1, 2, 3, 4].map((i) => s + i * k); }
    else if (b === 3) { const k = r.pick([5, 10]), s = k * r.int(0, 3); seq = [0, 1, 2, 3, 4].map((i) => s + i * k); }
    else if (b === 4) { const k = r.int(3, 9), s = r.int(50, 80); seq = [0, 1, 2, 3, 4].map((i) => s - i * k); }
    else if (b === 5) { const s = r.int(1, 4), m = r.pick([2, 3]); seq = [0, 1, 2, 3, 4].map((i) => s * m ** i); }
    else { const s = r.int(1, 10), k = r.int(1, 3); seq = [s]; for (let i = 1; i < 5; i++) seq.push(seq[i - 1]! + k * i); }
    const answer = seq.pop()!;
    return { template: "sequence", title: "The stepping-stone trail", story: "Each stone on the river has a number. One is missing!", task: `${seq.join(", ")}, … What number comes next?`, hint: "How much does it change each step?", theme: "numbered stepping stones across a river", scene: ["🪨", "🌊", "🐸"], kind: { type: "number", answer } };
  } },
  { id: "sudoku", name: "Mini sudoku", icon: "🔲", min: 2, max: 6, make: (r, b) => {
    if(b >= 5) return {template:"sudoku",title:"The Missing Treasure Tiles",story:"The treasure grid lost some of its pieces.",task:"Fill every square. Each row, column and 2×3 box needs one of each.",hint:"Look for a row, column or box with just one missing number.",theme:"a magic treasure grid",scene:["🗝️"],kind:makeSixSudoku(r,b===5?18:22)};
    const base = [0, 1, 2, 3, 2, 3, 0, 1, 1, 0, 3, 2, 3, 2, 1, 0];
    const digit = r.shuffle([0, 1, 2, 3]);
    const rowOrder = [...(r.next() < 0.5 ? [0, 1] : [1, 0]), ...(r.next() < 0.5 ? [2, 3] : [3, 2])];
    const bands = r.next() < 0.5 ? rowOrder : [...rowOrder.slice(2), ...rowOrder.slice(0, 2)];
    const colOrder = [...(r.next() < 0.5 ? [0, 1] : [1, 0]), ...(r.next() < 0.5 ? [2, 3] : [3, 2])];
    const solution = Array.from({ length: 16 }, (_, i) => digit[base[bands[Math.floor(i / 4)]! * 4 + colOrder[i % 4]!]!]!);
    const hide = new Set(r.shuffle([...Array(16).keys()]).slice(0, [0, 0, 4, 6, 8, 9, 10][b]!));
    const symbols = b <= 3 ? r.shuffle(r.pick([FRUITS, ANIMALS])).slice(0, 4) : ["1", "2", "3", "4"];
    return { template: "sudoku", title: "The Missing Treasure Tiles", story: "The treasure grid lost some of its pieces.", task: "Fill every square. Each row, column and 2×2 box needs one of each.", hint: "Find a row with only one empty square first.", theme: "a magic treasure grid", scene: [...symbols.slice(0, 2), "🗝️"], kind: { type: "sudoku", symbols, given: solution.map((v, i) => (hide.has(i) ? null : v)), solution } };
  } },
  { id: "lineup", name: "Who's where?", icon: "🕵️", min: 2, max: 6, make: (r, b) => {
    const n = b < 4 ? 3 : b < 6 ? 4 : 5;
    const pets = r.shuffle(ANIMALS).slice(0, n);
    const truth = r.shuffle(pets);
    const pos = (p: string[], x: string) => p.indexOf(x);
    type Clue = { text: string; ok: (p: string[]) => boolean };
    const pool: Clue[] = [];
    for (const a of pets) {
      for (const c of pets) if (a !== c) {
        if (pos(truth, a) < pos(truth, c)) pool.push({ text: `${nm(a)} is somewhere ahead of ${nm(c)}.`, ok: (p) => pos(p, a) < pos(p, c) });
        if (pos(truth, a) + 1 === pos(truth, c)) pool.push({ text: `${nm(a)} is right in front of ${nm(c)}.`, ok: (p) => pos(p, a) + 1 === pos(p, c) });
      }
      if (pos(truth, a) === 0) pool.push({ text: `${nm(a)} is first.`, ok: (p) => pos(p, a) === 0 });
      else if (pos(truth, a) === n - 1) pool.push({ text: `${nm(a)} is last.`, ok: (p) => pos(p, a) === n - 1 });
      else pool.push({ text: `${nm(a)} is not first and not last.`, ok: (p) => pos(p, a) > 0 && pos(p, a) < n - 1 });
    }
    const all = permutations(pets);
    const clues: Clue[] = [];
    for (const c of r.shuffle(pool)) {
      const before = all.filter((p) => clues.every((k) => k.ok(p))).length;
      if (before === 1) break;
      if (all.filter((p) => [...clues, c].every((k) => k.ok(p))).length < before) clues.push(c);
    }
    const answer = truth.map((e) => `${e} ${nm(e)}`);
    return { template: "lineup", title: "The race finish", story: `The animals ran a race! ${clues.map((c) => c.text).join(" ")}`, task: "Tap them in finishing order, first to last.", hint: "Start with the clue that tells you the most.", theme: `${pets.map(nm).join(", ")} in a race`, scene: [...pets, "🏁"], kind: { type: "order", items: r.shuffle(answer), answer, first: "1st", last: "last" } };
  } },
  { id: "coins", name: "Coin counting", icon: "🪙", min: 2, max: 6, make: (r, b) => {
    const kinds = b <= 2 ? [1, 5] : b === 3 ? [1, 5, 10] : [1, 5, 10, 25];
    const coins = Array.from({ length: r.int(3, 3 + b) }, () => r.pick(kinds)).sort((x, y) => y - x);
    return { template: "coins", title: "The piggy bank", story: "Piggy shook out some coins!", task: "How many cents is that altogether?", hint: "Count the biggest coins first, then add the small ones.", theme: "a piggy bank spilling coins", scene: ["🐷", "🪙", "💰"], visual: { type: "coins", coins }, kind: { type: "number", answer: coins.reduce((s, c) => s + c, 0) } };
  } },
  { id: "sides", name: "Shape sides", icon: "🔺", min: 0, max: 6, make: (r, b) => {
    const pool: ShapeName[] = b <= 2 ? ["triangle", "square", "circle"] : ["triangle", "square", "pentagon", "hexagon", "circle"];
    const shapes = Array.from({ length: r.int(2, 2 + Math.min(b, 4)) }, () => r.pick(pool));
    return { template: "sides", title: "The shape builders", story: "The builders need one stick for every straight side.", task: "How many straight sides are there in total?", hint: "A circle has no straight sides!", theme: "builders making shapes from sticks", scene: ["🔺", "🟦", "🛠️"], visual: { type: "shapes", shapes }, kind: { type: "number", answer: shapes.reduce((s, x) => s + SIDES[x], 0) } };
  } },
  { id: "balance", name: "Balance scale", icon: "⚖️", min: 3, max: 6, make: (r, b) => {
    const [x, y, z] = r.shuffle(FRUITS).slice(0, 3);
    const k = r.int(2, 4), w = r.int(2, 6);
    if (b < 5) return { template: "balance", title: "The wobbly scale", story: "The shop scale balances perfectly.", task: `How many blocks does one ${y} weigh?`, hint: `Swap each ${x} for its blocks.`, theme: "a market scale with fruit", scene: [x!, y!, "⚖️"], visual: { type: "equations", lines: [`${x} = ${w} 🧱`, `${y} = ${Array(k).fill(x).join(" ")}`] }, kind: { type: "number", answer: k * w } };
    const j = r.int(2, 3);
    return { template: "balance", title: "The wobbly scale", story: "The shop scale balances perfectly.", task: `How many blocks does one ${z} weigh?`, hint: `Work it out one fruit at a time.`, theme: "a market scale with fruit", scene: [x!, y!, z!, "⚖️"], visual: { type: "equations", lines: [`${x} = ${w} 🧱`, `${y} = ${Array(k).fill(x).join(" ")}`, `${z} = ${Array(j).fill(y).join(" ")} + ${x}`] }, kind: { type: "number", answer: j * k * w + w } };
  } },
  { id: "magic", name: "Magic square", icon: "✨", min: 4, max: 6, make: (r, b) => {
    let g = [2, 7, 6, 9, 5, 1, 4, 3, 8];
    for (let t = r.int(0, 3); t > 0; t--) g = [6, 3, 0, 7, 4, 1, 8, 5, 2].map((i) => g[i]!);
    if (r.next() < 0.5) g = [2, 1, 0, 5, 4, 3, 8, 7, 6].map((i) => g[i]!);
    const k = b >= 6 ? r.int(1, 10) : 0;
    g = g.map((v) => v + k);
    const hidden = r.shuffle([...Array(9).keys()]).slice(0, b >= 5 ? 3 : 2);
    const ask = hidden[0]!;
    const grid = g.map((v, i) => (hidden.includes(i) ? null : v));
    grid[ask] = null;
    return { template: "magic", title: "The magic square", story: "In this wizard's square, every row, column and diagonal adds up to the same number.", task: "What number goes in the glowing ❓ square?", hint: "Find a full row first to learn the magic total.", theme: "a glowing wizard's number square", scene: ["🧙", "✨", "🔮"], visual: { type: "magic", grid: grid.map((v, i) => (i === ask ? -1 : v)) }, kind: { type: "number", answer: g[ask]! } };
  } },
  { id: "nim", name: "Stone game", icon: "🪨", min: 2, max: 6, make: (r, b) => {
    const maxTake = b < 4 ? 2 : 3;
    let stones = r.int(6 + b, 9 + b * 2);
    if (stones % (maxTake + 1) === 0) stones++;
    const icon = r.pick(["🪨", "🍪", "💎", "🥕"]);
    return { template: "nim", title: "Beat the robot", story: "Robo challenges you to a game!", task: `Take 1–${maxTake} at a time. Whoever takes the LAST one wins. You go first.`, hint: `Try to leave Robo a multiple of ${maxTake + 1}.`, theme: "a friendly robot playing a game", scene: ["🤖", icon, "🏆"], kind: { type: "nim", stones, maxTake, icon } };
  } },
  { id: "compare", name: "Which is more?", icon: "🐊", min: 0, max: 6, make: (r, b) => {
    if (b <= 2) {
      const e = r.pick(FRUITS), f = r.pick(ANIMALS);
      let a = r.int(2, 4 + b * 2), c = r.int(2, 4 + b * 2); if (a === c) c++;
      const opts = ["Top row", "Bottom row"];
      return { template: "compare", title: "Who has more?", story: "Two friends are sharing snacks.", task: "Which row has MORE?", hint: "Match them up one by one.", theme: "two friends comparing snacks", scene: [f, e, "🤔"], visual: { type: "rows", rows: [Array(a).fill(e), Array(c).fill(e)] }, kind: { type: "choice", options: opts, answer: a > c ? 0 : 1 } };
    }
    const lim = b + 3;
    const exprs: [string, number][] = [];
    while (exprs.length < 3) {
      const x = r.int(2, lim + 3), y = r.int(2, lim);
      const e: [string, number] = b >= 4 && r.next() < 0.6 ? [`${x} × ${y}`, x * y] : [`${x * 3} + ${y}`, x * 3 + y];
      if (!exprs.some((q) => q[1] === e[1])) exprs.push(e);
    }
    const best = exprs.reduce((m, e) => (e[1] > m[1] ? e : m));
    const opts = exprs.map((e) => e[0]);
    return { template: "compare", title: "The hungry crocodile", story: "Croc always eats the BIGGEST number.", task: "Which one will Croc eat?", hint: "Work out each one first.", theme: "a hungry crocodile choosing numbers", scene: ["🐊", "🔢", "😋"], kind: { type: "choice", options: opts, answer: opts.indexOf(best[0]) } };
  } },
  { id: "clock", name: "Tell the time", icon: "⏰", min: 2, max: 6, make: (r, b) => {
    const h = r.int(1, 12);
    const m = b <= 3 ? 0 : b === 4 ? r.pick([0, 30]) : b === 5 ? r.pick([0, 15, 30, 45]) : r.int(1, 11) * 5;
    const fmt = (hh: number, mm: number) => `${hh}:${String(mm).padStart(2, "0")}`;
    const wrong = [fmt(h % 12 + 1, m), fmt(h, (m + 30) % 60), fmt(((h + 10) % 12) + 1, m), fmt(m / 5 || 12, h * 5 % 60)];
    const c = choiceWith(r, fmt(h, m), wrong);
    return { template: "clock", title: "What time is it?", story: "The clock tower chimes for the festival.", task: "What time does the clock show?", hint: "The short hand shows the hour. The long hand shows minutes.", theme: "a clock tower at a festival", scene: ["🕰️", "🔔", "🎪"], visual: { type: "clock", h, m }, kind: { type: "choice", ...c } };
  } },
  { id: "evenodd", name: "Number detective", icon: "🔎", min: 2, max: 6, make: (r, b) => {
    const k = b <= 3 ? 2 : r.int(3, b + 2);
    const isMul = (n: number) => n % k === 0;
    const findOdd = b <= 3 && r.next() < 0.5;
    const target = (n: number) => (findOdd ? n % 2 === 1 : isMul(n));
    const top = 10 + b * 10;
    let ans = r.int(2, top); while (!target(ans)) ans++;
    const wrong: number[] = []; while (wrong.length < 3) { const v = r.int(2, top); if (!target(v) && !wrong.includes(v)) wrong.push(v); }
    const c = choiceWith(r, ans, wrong);
    const what = findOdd ? "an ODD number" : k === 2 ? "an EVEN number" : `a multiple of ${k}`;
    return { template: "evenodd", title: "Number detective", story: `Only one of these suspects is ${what}.`, task: `Tap the number that is ${what}.`, hint: k === 2 ? "Even numbers can be split into two equal groups." : `Count by ${k}s.`, theme: "a detective looking for a number", scene: ["🕵️", "🔢", "🔍"], kind: { type: "choice", ...c } };
  } },
  { id: "groups", name: "Groups of", icon: "🎁", min: 0, max: 6, make: (r, b) => {
    const k = r.int(2, Math.max(2, b + 1)), m = r.int(2, Math.max(3, b + 2));
    const e = r.pick(["🍪", "🍬", "🌸", "⭐"]);
    return { template: "groups", title: "Party bags", story: `Every party bag gets the same number of ${e}.`, task: `There are ${k} bags with ${m} ${e} each. How many ${e} in total?`, hint: `Count by ${m}s, ${k} times.`, theme: "packing party bags", scene: ["🎁", e, "🎉"], visual: b <= 4 ? { type: "rows", rows: Array.from({ length: k }, () => ["🎁", ...Array(m).fill(e)]) } : undefined, kind: { type: "number", answer: k * m } };
  } },
  { id: "cipher", name: "Secret symbols", icon: "🔐", min: 3, max: 6, make: (r, b) => {
    const [x, y, z] = r.shuffle(["🐱", "🐶", "⭐", "🌙", "🍄", "💎"]);
    const vx = r.int(1, 5 + b), vy = r.int(1, 5 + b), vz = r.int(1, 5 + b);
    const lines = b < 5
      ? [`${x} + ${x} = ${2 * vx}`, `${x} + ${y} = ${vx + vy}`]
      : [`${x} + ${x} + ${x} = ${3 * vx}`, `${x} + ${y} = ${vx + vy}`, `${y} + ${z} = ${vy + vz}`];
    const ask = b < 5 ? `${y} + ${y} + ${x}` : `${x} + ${y} + ${z}`;
    const answer = b < 5 ? 2 * vy + vx : vx + vy + vz;
    return { template: "cipher", title: "The secret code", story: "Each symbol hides a number. Crack the code!", task: `What is ${ask}?`, hint: "Solve the first line, then use it in the next.", theme: "a secret code on an ancient wall", scene: [x!, y!, "🔐"], visual: { type: "equations", lines }, kind: { type: "number", answer } };
  } },
  { id: "riddle", name: "Mystery number", icon: "❓", min: 4, max: 6, make: (r, b) => {
    const top = b === 4 ? 30 : b === 5 ? 50 : 99;
    const ans = r.int(10, top);
    const ds = String(ans).split("").reduce((s, d) => s + +d, 0);
    type C = { text: string; ok: (n: number) => boolean };
    const lo = r.int(1, ans - 1), hi = r.int(ans + 1, top + 5);
    const pool: C[] = [
      { text: `It is more than ${lo}.`, ok: (n) => n > lo },
      { text: `It is less than ${hi}.`, ok: (n) => n < hi },
      { text: `It is ${ans % 2 ? "odd" : "even"}.`, ok: (n) => n % 2 === ans % 2 },
      { text: `Its digits add up to ${ds}.`, ok: (n) => String(n).split("").reduce((s, d) => s + +d, 0) === ds },
      ...[3, 4, 5].filter((k) => ans % k === 0).map((k) => ({ text: `It is in the ${k} times table.`, ok: (n: number) => n % k === 0 })),
    ];
    const cands = Array.from({ length: top }, (_, i) => i + 1);
    const used: C[] = [];
    for (const c of r.shuffle(pool)) {
      if (cands.filter((n) => used.every((u) => u.ok(n))).length === 1) break;
      used.push(c);
    }
    const left = cands.filter((n) => used.every((u) => u.ok(n)));
    if (left.length > 1) used.push({ text: `It is one of: ${left.slice(0, 4).join(", ")}${left.length > 4 ? "…" : ""} — and it's the ${left.indexOf(ans) + 1 === 1 ? "smallest" : `number #${left.indexOf(ans) + 1}`} of those.`, ok: (n) => n === ans });
    return { template: "riddle", title: "The mystery number", story: `The owl is thinking of a number from 1 to ${top}. ${used.map((u) => u.text).join(" ")}`, task: "What is the owl's number?", hint: "Write down the numbers that fit the first clue, then cross some out.", theme: "a wise owl with a number riddle", scene: ["🦉", "❓", "🌙"], kind: { type: "number", answer: ans } };
  } },
  { id: "position", name: "Who's in line?", icon: "🚩", min: 0, max: 4, make: (r, b) => {
    const line = r.shuffle(ANIMALS).slice(0, 3 + Math.min(b, 2));
    const k = r.int(0, line.length - 1);
    const ord = ["1st", "2nd", "3rd", "4th", "5th"][k]!;
    const opts = line.map((e) => `${e} ${nm(e)}`);
    return { template: "position", title: "The ice-cream line", story: "The animals are waiting for ice cream. The flag shows the front of the line!", task: `Who is ${ord} in line, counting from the flag?`, hint: "Put your finger on the flag and count each animal.", theme: "animals queueing at an ice-cream truck", scene: [...line.slice(0, 2), "🍦"], visual: { type: "rows", rows: [["🚩", ...line]] }, kind: { type: "choice", options: opts, answer: k } };
  } },
  { id: "colors", name: "Color mixing", icon: "🎨", min: 0, max: 2, make: (r) => {
    const [a, c, ans] = r.pick([["🔴", "🟡", "🟠"], ["🔵", "🟡", "🟢"], ["🔴", "🔵", "🟣"]] as const);
    const opts = r.shuffle(["🟠", "🟢", "🟣", "🟤"]);
    return { template: "colors", title: "The paint pots", story: "Bunny the painter is mixing two paints together.", task: "What color do they make?", hint: "Think of something that has both colors in it.", theme: "a bunny painter mixing paint pots", scene: ["🐰", "🎨", "🖌️"], visual: { type: "rows", rows: [[a, "➕", c, "🟰", "❓"]] }, kind: { type: "choice", options: opts, answer: opts.indexOf(ans), bigOptions: true } };
  } },
  { id: "shapepick", name: "Shape hunt", icon: "🔷", min: 0, max: 2, make: (r, b) => {
    const pool = [["🔺", "triangle", 3], ["🟦", "square", 4], ["⚪", "circle", 0], ["🛑", "octagon", 8]] as const;
    const [e, name, n] = r.pick(pool);
    const opts = r.shuffle(pool.map((x) => x[0] as string));
    const task = b === 0 ? `Tap the ${name}.` : n === 0 ? "Tap the shape with no corners." : `Tap the shape with ${n} sides.`;
    return { template: "shapepick", title: "The shape hunt", story: "The shapes are playing hide and seek in the toy box.", task, hint: "Trace around each shape with your finger.", theme: "shapes hiding in a toy box", scene: ["🧸", "🔷", "🔺"], kind: { type: "choice", options: opts, answer: opts.indexOf(e), bigOptions: true } };
  } },
  { id: "double", name: "Doubles & halves", icon: "👯", min: 0, max: 6, make: (r, b) => {
    const n = r.int(1, [3, 5, 10, 25, 50, 100, 250][b]!);
    const e = r.pick(["🦋", "🐞", "🌟", "🍩"]);
    const half = b >= 3 && r.next() < 0.5;
    return { template: "double", title: half ? "Split in half" : "Mirror magic", story: half ? "The twins share everything exactly in half." : "A magic mirror doubles everything that looks into it!", task: half ? `The twins share ${n * 2} ${e} equally. How many does each twin get?` : `${n} ${e} look into the mirror. How many ${e} are there now, counting the reflections?`, hint: half ? "What number plus itself makes the total?" : "Add the number to itself.", theme: half ? "twins sharing treats" : "a sparkling magic mirror", scene: [e, "🪞", "✨"], visual: !half && b < 2 ? { type: "rows", rows: [Array(n).fill(e), Array(n).fill(e)] } : undefined, kind: { type: "number", answer: half ? n : n * 2 } };
  } },
  { id: "share", name: "Fair shares", icon: "🍕", min: 0, max: 6, make: (r, b) => {
    const k = b < 2 ? 2 : r.int(2, Math.min(b + 1, 6));
    const m = r.int(1, [2, 3, 5, 6, 8, 10, 12][b]!);
    const e = r.pick(["🍪", "🍓", "🍬", "🧁"]);
    const kids = r.shuffle(ANIMALS).slice(0, k);
    return { template: "share", title: "Fair shares", story: `${kids.map(nm).join(", ")} found a pile of ${e} to share fairly.`, task: `${k * m} ${e} shared equally between ${k} friends. How many does each friend get?`, hint: "Hand them out one at a time, like dealing cards.", theme: "friends sharing a picnic", scene: [...kids.slice(0, 2), e], visual: b < 2 ? { type: "rows", rows: [Array(k * m).fill(e), kids] } : undefined, kind: { type: "number", answer: m } };
  } },
  { id: "missing", name: "Missing number", icon: "🕳️", min: 1, max: 6, make: (r, b) => {
    const mul = b >= 5 && r.next() < 0.5;
    const lim = [0, 5, 10, 20, 50, 100, 500][b]!;
    const a = mul ? r.int(2, 12) : r.int(1, lim), x = mul ? r.int(2, 12) : r.int(1, lim);
    return { template: "missing", title: "The hole in the sum", story: "A sneaky mole dug a hole right through the number sum!", task: mul ? `${a} × ❓ = ${a * x}. What number fell in the hole?` : `${a} + ❓ = ${a + x}. What number fell in the hole?`, hint: mul ? `Count up in ${a}s.` : `Count up from ${a}.`, theme: "a mole popping out of a hole", scene: ["🦫", "🕳️", "🔢"], kind: { type: "number", answer: x } };
  } },
  { id: "days", name: "Days of the week", icon: "📅", min: 1, max: 6, make: (r, b) => {
    const D = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const i = r.int(0, 6);
    const step = b === 1 ? 1 : b === 2 ? -1 : b <= 4 ? r.int(2, 4) : r.int(8, 30);
    const ans = D[(((i + step) % 7) + 7) % 7]!;
    const task = step === 1 ? `Today is ${D[i]}. What day is tomorrow?` : step === -1 ? `Today is ${D[i]}. What day was yesterday?` : `Today is ${D[i]}. What day will it be in ${step} days?`;
    const c = choiceWith(r, ans, r.shuffle(D));
    return { template: "days", title: "The party calendar", story: "Owl is counting down the days to a big party.", task, hint: step > 7 ? "Every 7 days it's the same day again." : "Say the days out loud in order.", theme: "an owl with a party calendar", scene: ["🦉", "📅", "🎉"], kind: { type: "choice", ...c } };
  } },
  { id: "legs", name: "Leg count", icon: "🐔", min: 1, max: 6, make: (r, b) => {
    const kinds = b < 4 ? [["🐔", 2], ["🐄", 4]] as const : [["🐔", 2], ["🐄", 4], ["🕷️", 8]] as const;
    const counts = kinds.map(() => r.int(1, b < 3 ? 3 : 2 + b));
    const total = kinds.reduce((s, [, l], i) => s + l * counts[i]!, 0);
    return { template: "legs", title: "Farm legs", story: "The farmer peeked under the fence and saw only legs!", task: `There are ${kinds.map(([e], i) => `${counts[i]} ${e}`).join(" and ")}. How many legs altogether?`, hint: "A hen has 2 legs, a cow has 4" + (kinds.length > 2 ? ", a spider has 8." : "."), theme: "a busy farmyard", scene: kinds.map(([e]) => e), visual: b < 3 ? { type: "rows", rows: kinds.map(([e], i) => Array(counts[i]!).fill(e)) } : undefined, kind: { type: "number", answer: total } };
  } },
  { id: "change", name: "Shop change", icon: "🛒", min: 3, max: 6, make: (r, b) => {
    const item = r.pick(["🧃", "🍭", "🎈", "📒", "🪀"]);
    if (b <= 4) {
      const p = r.int(2, 19) * 5, q = b === 4 ? r.int(1, 19 - p / 5) * 5 : 0;
      const pay = 100;
      return { template: "change", title: "The corner shop", story: "Fox runs a tiny corner shop full of treasures.", task: q ? `You buy ${item} for ${p}¢ and a 🍬 for ${q}¢ with a 100¢ coin. How much change?` : `You buy ${item} for ${p}¢ and pay with a 100¢ coin. How much change in cents?`, hint: "Count up from the price to 100.", theme: "a fox shopkeeper in a tiny shop", scene: ["🦊", item, "🪙"], kind: { type: "number", answer: pay - p - q } };
    }
    const pay = b === 5 ? 20 : 50, p = r.int(2, pay / 2 - 1), q = r.int(1, pay / 2 - 1);
    return { template: "change", title: "The toy market", story: "The toy market is busy and you have money to spend.", task: `${item} costs $${p} and a 🧸 costs $${q}. You pay with $${pay}. How many dollars change?`, hint: "Add the prices first, then take away from what you paid.", theme: "a bustling toy market", scene: [item, "🧸", "💵"], kind: { type: "number", answer: pay - p - q } };
  } },
  { id: "fraction", name: "Fraction feast", icon: "🥧", min: 4, max: 6, make: (r, b) => {
    const [num, den] = b === 4 ? r.pick([[1, 2], [1, 4]] as const) : b === 5 ? r.pick([[1, 3], [1, 4], [1, 5], [2, 3]] as const) : r.pick([[3, 4], [2, 5], [3, 8], [5, 6]] as const);
    const total = den * r.int(2, b === 6 ? 12 : 8);
    const e = r.pick(["🍒", "🫐", "🍓"]);
    return { template: "fraction", title: "The berry pie", story: `Bear picked ${total} ${e} for a pie.`, task: `${num}/${den} of the ${total} ${e} go in the pie. How many is that?`, hint: `Split ${total} into ${den} equal groups, then take ${num}.`, theme: "a bear baking a berry pie", scene: ["🐻", e, "🥧"], kind: { type: "number", answer: (total / den) * num } };
  } },
];

export const templatesFor = (band: number) => TEMPLATES.filter((t) => band >= t.min && band <= t.max);

export function generate(templateId: string, band: number, seed: number): PuzzleSpec {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? templatesFor(band)[0]!;
  return t.make(makeRng(seed), band);
}
