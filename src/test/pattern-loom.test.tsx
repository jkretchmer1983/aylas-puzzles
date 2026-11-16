import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatternInteraction } from "@/gen/Renderer";
import { generate } from "@/gen/templates";
import { patchOverPocket } from "@/gen/pattern/PatternLoom";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("pattern loom", () => {
  it("keeps every generated symbol and choice index across enabled bands", () => {
    for (let band = 0; band <= 6; band++) {
      const spec = generate("pattern", band, 45678),
        report = vi.fn();
      if (spec.kind.type !== "choice" || spec.visual?.type !== "rows") throw Error("Wrong kind");
      render(<PatternInteraction spec={spec} report={report} />);
      spec.visual.rows.flat().slice(0, -1).forEach((symbol, i) =>
        expect(screen.getByLabelText(`Position ${i + 1}: ${symbol}`)).toBeInTheDocument(),
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: `Pick patch ${spec.kind.answer + 1}: ${spec.kind.options[spec.kind.answer]}`,
        }),
      );
      expect(report).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Empty pocket, place selected patch" }));
      expect(report).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Check" }));
      expect(report).toHaveBeenCalledExactlyOnceWith(true);
      expect(screen.getByText(/Your cloth is woven/)).toBeInTheDocument();
      cleanup();
    }
  });
  it("retries and replaces without altering sequence or checking on placement", () => {
    const spec = generate("pattern", 5, 12345),
      report = vi.fn();
    if (spec.kind.type !== "choice") throw Error("Wrong kind");
    const k = spec.kind,
      wrong = (k.answer + 1) % k.options.length;
    render(<PatternInteraction spec={spec} report={report} />);
    fireEvent.click(screen.getByLabelText(`Pick patch ${wrong + 1}: ${k.options[wrong]}`));
    fireEvent.click(screen.getByLabelText("Empty pocket, place selected patch"));
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(report).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByLabelText(`Pick patch ${k.answer + 1}: ${k.options[k.answer]}`));
    fireEvent.click(
      screen.getByLabelText(`Pocket contains ${k.options[wrong]}, pick up or replace`),
    );
    expect(report).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
    expect(report).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: "Woven!" })).toBeDisabled();
  });
  it("holds, drags using the visible center, and returns missed drops", () => {
    vi.useFakeTimers();
    vi.stubGlobal("PointerEvent", MouseEvent);
    const spec = generate("pattern", 1, 12345);
    render(<PatternInteraction spec={spec} report={vi.fn()} />);
    const patch = screen.getByRole("button", { name: /Pick patch 1:/ });
    const pocket = screen.getByLabelText("Empty pocket, place selected patch");
    pocket.getBoundingClientRect = () => ({
      left: 100,
      right: 180,
      top: 100,
      bottom: 180,
      width: 80,
      height: 80,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(patch, { button: 0, clientX: 300, clientY: 250 });
    act(() => vi.advanceTimersByTime(331));
    fireEvent.pointerMove(patch, { clientX: 140, clientY: 220 });
    expect(pocket.className).toContain("loom-over");
    fireEvent.pointerUp(patch, { clientX: 140, clientY: 220 });
    expect(screen.getByLabelText(/Pocket contains/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    act(() => vi.advanceTimersByTime(1));
    fireEvent.pointerDown(patch, { button: 0, clientX: 300, clientY: 250 });
    act(() => vi.advanceTimersByTime(331));
    fireEvent.pointerMove(patch, { clientX: 20, clientY: 350 });
    fireEvent.pointerUp(patch, { clientX: 20, clientY: 350 });
    act(() => vi.advanceTimersByTime(231));
    expect(screen.getByLabelText("Empty pocket, place selected patch")).toHaveTextContent(
      "Place here",
    );
    expect(document.querySelector(".loom-carry")).toBeNull();
  });
  it("retains placement through resizing and restores saved state without awarding on mount", () => {
    const spec = generate("pattern", 6, 12345), report = vi.fn(), save = vi.fn();
    if (spec.kind.type !== "choice") throw Error("Wrong kind");
    const { unmount } = render(<PatternInteraction spec={spec} report={report} save={save} />);
    fireEvent.click(screen.getByLabelText(`Pick patch 1: ${spec.kind.options[0]}`));
    fireEvent.click(screen.getByLabelText("Empty pocket, place selected patch"));
    fireEvent(window, new Event("resize"));
    expect(screen.getByLabelText(/Pocket contains/)).toBeInTheDocument();
    expect(save).toHaveBeenLastCalledWith({ placed: 0, result: "ready" });
    unmount();
    render(<PatternInteraction spec={spec} report={report} saved={{placed: 0, result: "ready"}} />);
    expect(screen.getByLabelText(/Pocket contains/)).toBeInTheDocument();
    expect(report).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", {name:"Undo"}));
    expect(screen.getByLabelText("Empty pocket, place selected patch")).toBeInTheDocument();
  });
  it("only creates sound on a check gesture when enabled", () => {
    const close = vi.fn().mockResolvedValue(undefined), frequency = {value: 0};
    const oscillator = () => ({type: "", frequency, connect: vi.fn(), start: vi.fn(), stop: vi.fn()});
    const Audio = vi.fn(function() { return { currentTime: 0, destination: {}, close, createOscillator: oscillator, createGain: () => ({gain: {setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn()}, connect: vi.fn()}) }; });
    vi.stubGlobal("AudioContext", Audio);
    const spec = generate("pattern", 1, 12345);
    const {rerender} = render(<PatternInteraction spec={spec} report={vi.fn()} sound={false} />);
    fireEvent.click(screen.getByLabelText(/Pick patch 1:/));
    fireEvent.click(screen.getByLabelText("Empty pocket, place selected patch"));
    expect(Audio).not.toHaveBeenCalled();
    rerender(<PatternInteraction spec={spec} report={vi.fn()} sound />);
    fireEvent.click(screen.getByRole("button", {name:"Check"}));
    expect(Audio).toHaveBeenCalledTimes(1);
  });
  it("uses the lifted center with a forgiving target, independent of finger position", () => {
    const rect = { left: 100, right: 180, top: 100, bottom: 180 };
    expect(patchOverPocket(140, 220 - 52, rect)).toBe(true);
    expect(patchOverPocket(140, 220, rect)).toBe(false);
    expect(patchOverPocket(80, 120, rect)).toBe(true);
    expect(patchOverPocket(20, 120, rect)).toBe(false);
  });
});
