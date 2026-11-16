import { describe, expect, it } from "vitest";
import { generateRobotMission, witnessIsWithinBudget } from "@/robot/generator";
import { createRobotState, expandProgram, robotReducer, runProgramInstantly } from "@/robot/engine";
import type { ProgramToken, RobotBinding } from "@/robot/types";

const binding: RobotBinding = {
  policyVersion: "test", instanceId: "test", themeId: "test", title: "Test", story: "Test", mission: "Deliver",
  subjects: Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, parcel: `parcel ${i}`, destination: `destination ${i}`, icon: "📦", color: "#000" })),
};

function mission(band = 4, seed = 42) { return generateRobotMission(seed, band, binding); }

describe("Robot Shortcut authoritative engine", () => {
  it("generates a budgeted witness that truly completes missions across many seeds and ages", () => {
    for (const band of [4, 5, 6]) {
      for (let seed = 1; seed <= 180; seed++) {
        const m = mission(band, seed);
        expect(m.size).toBe(band === 6 ? 6 : 5);
        expect(m.stops).toHaveLength(band === 4 ? 2 : band === 5 ? 3 : 4);
        expect(witnessIsWithinBudget(m)).toBe(true);
        const result = runProgramInstantly(m, m.witness);
        expect(result.phase, `band ${band}, seed ${seed}: ${result.message}`).toBe("success");
        expect(result.delivered).toHaveLength(m.stops.length);
      }
    }
  });

  it("delivers multiple stops exactly once and succeeds only after remaining commands finish", () => {
    const m = mission(4, 11);
    const extra: ProgramToken = { id: "extra-turn", op: "left" };
    const program = [...m.witness, extra];
    const state = runProgramInstantly(m, program);
    expect(state.phase).toBe("success");
    expect(new Set(state.delivered).size).toBe(m.stops.length);
    expect(state.delivered).toHaveLength(m.stops.length);
  });

  it("supports consecutive runs without duplicate deliveries or a stale cursor", () => {
    const m = mission(5, 92);
    for (let run = 0; run < 3; run++) {
      const result = runProgramInstantly(m, m.witness);
      expect(result.phase).toBe("success");
      expect(result.cursor).toBe(expandProgram(m.witness).length - 1);
      expect(result.delivered).toHaveLength(m.stops.length);
    }
  });

  it("preserves the program after failure and permits editing then retry", () => {
    const m = mission(4, 8);
    let state = createRobotState(m, [{ id: "bad", op: "forward" }, { id: "bad2", op: "forward" }, { id: "bad3", op: "forward" }, { id: "bad4", op: "forward" }, { id: "bad5", op: "forward" }]);
    state = robotReducer(state, { type: "run" });
    for (let cursor = 0; cursor < 5 && state.phase === "running"; cursor++) state = robotReducer(state, { type: "commit", runId: state.runId, cursor });
    expect(state.phase).toBe("failure");
    expect(state.program).toHaveLength(5);
    state = robotReducer(state, { type: "clear" });
    for (const token of m.witness) state = robotReducer(state, { type: "add", op: token.op === "repeat" ? token.body : token.op });
    expect(state.program.length).toBeGreaterThan(0);
    expect(state.phase).toBe("editing");
  });

  it("stop cancels a pending commit and reset restores the initial pose and delivery count", () => {
    const m = mission(4, 21);
    let state = createRobotState(m, m.witness);
    state = robotReducer(state, { type: "run" });
    const runId = state.runId;
    state = robotReducer(state, { type: "stop" });
    const stopped = robotReducer(state, { type: "commit", runId, cursor: 0 });
    expect(stopped).toEqual(state);
    state = robotReducer(state, { type: "reset" });
    expect(state.pose).toEqual(m.start);
    expect(state.delivered).toEqual([]);
    expect(state.program).toEqual(m.witness);
  });

  it("repeat blocks expand to the exact primitive count", () => {
    const tokens: ProgramToken[] = [{ id: "r", op: "repeat", times: 3, body: "forward" }, { id: "l", op: "left" }];
    expect(expandProgram(tokens).map(s => s.op)).toEqual(["forward", "forward", "forward", "left"]);
  });

  it("an unfinished route fails without claiming mission success", () => {
    const m = mission(4, 99);
    const result = runProgramInstantly(m, [m.witness[0]!]);
    expect(result.phase).toBe("failure");
    expect(result.delivered.length).toBeLessThan(m.stops.length);
  });
});
