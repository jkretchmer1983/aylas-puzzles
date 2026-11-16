import type { Pose, ProgramToken, RobotPhase } from "./types";

export type StoredRobotSession = {
  started: boolean;
  program: ProgramToken[];
  phase: RobotPhase;
  pose: Pose;
  delivered: string[];
  message: string;
};

const memory = new Map<string, StoredRobotSession>();
export function robotSessionKey(band: number, instanceSeed: number, boardSeed: number) {
  return `robot-session:v1:${band}:${instanceSeed}:${boardSeed}`;
}

export function readRobotSession(key: string): StoredRobotSession | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as StoredRobotSession;
    memory.set(key, saved);
    return saved;
  } catch { return null; }
}

export function saveRobotSession(key: string, value: StoredRobotSession) {
  memory.set(key, value);
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
