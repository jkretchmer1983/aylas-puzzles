import type { BaseOp, Cell, Direction, Pose, PrimitiveStep, ProgramToken, RobotAction, RobotMission, RobotState } from "./types";

const DELTAS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
let tokenSerial = 0;
export function tokenId(op: string) { return `token-${Date.now().toString(36)}-${tokenSerial++}-${op}`; }

export function expandProgram(program: ProgramToken[]): PrimitiveStep[] {
  return program.flatMap(token => token.op === "repeat"
    ? Array.from({ length: token.times }, (_, repeatIndex): PrimitiveStep => ({ op: token.body, tokenId: token.id, repeatIndex }))
    : [{ op: token.op, tokenId: token.id }]);
}

export function nextPose(pose: Pose, op: BaseOp): Pose {
  if (op === "left") return { ...pose, direction: ((pose.direction + 3) % 4) as Direction };
  if (op === "right") return { ...pose, direction: ((pose.direction + 1) % 4) as Direction };
  const delta = DELTAS[pose.direction]!;
  return { ...pose, x: pose.x + delta.x, y: pose.y + delta.y };
}

export function collisionAt(mission: RobotMission, pose: Pose): string | null {
  if (pose.x < 0 || pose.y < 0 || pose.x >= mission.size || pose.y >= mission.size) return "That shortcut leaves the stone yard.";
  if (mission.obstacles.some(c => c.x === pose.x && c.y === pose.y)) return "Boulder brake! This route needs a different turn.";
  return null;
}

function freshRun(state: RobotState, message = "Route ready. Add commands or press Run route!"): RobotState {
  return { ...state, phase: "editing", pose: { ...state.mission.start }, delivered: [], cursor: 0,
    runId: state.runId + 1, lastDelivery: null, message };
}

function edit(state: RobotState, program: ProgramToken[], message = "Program updated. Try your new route!"): RobotState {
  return { ...freshRun(state, message), program };
}

export function createRobotState(mission: RobotMission, program: ProgramToken[] = []): RobotState {
  return {
    mission, program, phase: "editing", pose: { ...mission.start }, delivered: [], cursor: 0,
    runId: 0, eventNonce: 0, lastDelivery: null,
    message: "Add direction tokens, then press Run route!",
  };
}

export function robotReducer(state: RobotState, action: RobotAction): RobotState {
  if (action.type === "run") {
    if (state.phase === "running" || !state.program.length) return state.phase === "running" ? state : { ...state, message: "Add at least one direction token first." };
    return { ...state, phase: "running", pose: { ...state.mission.start }, delivered: [], cursor: 0,
      runId: state.runId + 1, eventNonce: state.eventNonce + 1, lastDelivery: null, message: "Pip is following your route…" };
  }
  if (action.type === "stop") return state.phase === "running"
    ? { ...state, phase: "editing", runId: state.runId + 1, message: "Route stopped. Your program is safe." } : state;
  if (action.type === "reset") return freshRun(state);
  if (state.phase === "running" && action.type !== "commit") return state;
  if (action.type === "add" || action.type === "insert") {
    if (state.program.length >= state.mission.maxTokens) return { ...state, message: `The trolley holds ${state.mission.maxTokens} blocks. Try a repeat block!` };
    const token: ProgramToken = { id: tokenId(action.op), op: action.op };
    if (action.type === "add") return edit(state, [...state.program, token]);
    const program = [...state.program];
    program.splice(Math.max(0, Math.min(action.index, program.length)), 0, token);
    return edit(state, program);
  }
  if (action.type === "remove") return edit(state, state.program.filter((_, i) => i !== action.index), "Token removed. Keep building!");
  if (action.type === "move") {
    if (action.to < 0 || action.to >= state.program.length || action.from === action.to) return state;
    const program = [...state.program];
    const [token] = program.splice(action.from, 1);
    if (!token) return state;
    program.splice(action.to, 0, token);
    return edit(state, program, "Command moved. The order matters!");
  }
  if (action.type === "clear") return edit(state, [], "Trolley cleared. Build a fresh route!");
  if (action.type === "load") return edit(state, action.program.slice(0, state.mission.maxTokens), "Program restored.");
  if (action.type === "repeatLast") {
    if (!state.mission.allowsRepeat || !state.program.length) return state;
    const index = state.program.length - 1;
    const token = state.program[index]!;
    if (token.op === "repeat") {
      const replacement: ProgramToken = { ...token, times: token.times === 2 ? 3 : 2 };
      return edit(state, state.program.map((t, i) => i === index ? replacement : t));
    }
    const replacement: ProgramToken = { id: token.id, op: "repeat", times: 2, body: token.op };
    return edit(state, state.program.map((t, i) => i === index ? replacement : t), "Repeat block made: one token now runs twice!");
  }
  if (action.type === "cycleRepeat") {
    const token = state.program[action.index];
    if (!token || token.op !== "repeat") return state;
    const replacement: ProgramToken = token.times === 2 ? { ...token, times: 3 } : { id: token.id, op: token.body };
    return edit(state, state.program.map((t, i) => i === action.index ? replacement : t));
  }
  if (action.type === "commit") {
    if (state.phase !== "running" || state.runId !== action.runId || state.cursor !== action.cursor) return state;
    const steps = expandProgram(state.program);
    const step = steps[state.cursor];
    if (!step) return { ...state, phase: "failure", message: "The route ended unexpectedly. Try editing it." };
    const candidate = nextPose(state.pose, step.op);
    const collision = step.op === "forward" ? collisionAt(state.mission, candidate) : null;
    if (collision) return { ...state, phase: "failure", eventNonce: state.eventNonce + 1, lastDelivery: null, message: collision };
    const delivered = [...state.delivered];
    let lastDelivery: string | null = null;
    let message = `${Math.min(state.cursor + 1, steps.length)} of ${steps.length} commands complete`;
    if (step.op === "forward") {
      const stop = state.mission.stops.find(s => s.x === candidate.x && s.y === candidate.y);
      if (stop && !delivered.includes(stop.id)) {
        if (state.mission.ordered && state.mission.stops[delivered.length]?.id !== stop.id) {
          return { ...state, phase: "failure", pose: candidate, eventNonce: state.eventNonce + 1,
            message: `Pip is puzzled: deliver to ${state.mission.stops[delivered.length]?.subject.destination} first.` };
        }
        delivered.push(stop.id);
        lastDelivery = stop.id;
        message = `${stop.subject.parcel} delivered to ${stop.subject.destination}!`;
      }
    }
    const finished = state.cursor === steps.length - 1;
    const success = finished && delivered.length === state.mission.stops.length;
    return {
      ...state, pose: candidate, delivered, lastDelivery,
      eventNonce: state.eventNonce + 1,
      cursor: finished ? state.cursor : state.cursor + 1,
      phase: finished ? (success ? "success" : "failure") : "running",
      message: finished
        ? success ? "Every parcel delivered! Pip found the perfect shortcut!" : `Pip delivered ${delivered.length} of ${state.mission.stops.length} parcels. Adjust the route and try again!`
        : message,
    };
  }
  return state;
}

export function runProgramInstantly(mission: RobotMission, program: ProgramToken[]) {
  let state = createRobotState(mission, program);
  state = robotReducer(state, { type: "run" });
  const steps = expandProgram(program);
  for (let cursor = 0; cursor < steps.length; cursor++) {
    const runId = state.runId;
    state = robotReducer(state, { type: "commit", runId, cursor });
  }
  return state;
}
