export type Direction = 0 | 1 | 2 | 3;
export type Cell = { x: number; y: number };
export type Pose = Cell & { direction: Direction };
export type BaseOp = "forward" | "left" | "right";
export type ProgramToken =
  | { id: string; op: BaseOp }
  | { id: string; op: "repeat"; times: 2 | 3; body: BaseOp };

export type ParcelSubject = {
  id: string;
  parcel: string;
  destination: string;
  icon: string;
  color: string;
};

export type RobotBinding = {
  policyVersion: string;
  instanceId: string;
  themeId: string;
  title: string;
  story: string;
  mission: string;
  subjects: ParcelSubject[];
};

export type DeliveryStop = Cell & {
  id: string;
  subject: ParcelSubject;
};

export type RobotMission = {
  seed: number;
  band: number;
  size: 5 | 6;
  start: Pose;
  obstacles: Cell[];
  stops: DeliveryStop[];
  ordered: boolean;
  maxTokens: number;
  allowsRepeat: boolean;
  witness: ProgramToken[];
};

export type PrimitiveStep = {
  op: BaseOp;
  tokenId: string;
  repeatIndex?: number;
};

export type RobotPhase = "editing" | "running" | "failure" | "success";

export type RobotState = {
  mission: RobotMission;
  program: ProgramToken[];
  phase: RobotPhase;
  pose: Pose;
  delivered: string[];
  cursor: number;
  runId: number;
  eventNonce: number;
  lastDelivery: string | null;
  message: string;
};

export type RobotAction =
  | { type: "add"; op: BaseOp }
  | { type: "insert"; op: BaseOp; index: number }
  | { type: "repeatLast" }
  | { type: "cycleRepeat"; index: number }
  | { type: "remove"; index: number }
  | { type: "move"; from: number; to: number }
  | { type: "clear" }
  | { type: "load"; program: ProgramToken[] }
  | { type: "run" }
  | { type: "commit"; runId: number; cursor: number }
  | { type: "stop" }
  | { type: "reset" };
