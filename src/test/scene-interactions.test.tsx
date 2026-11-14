import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PuzzleBody } from "@/gen/Renderer";
import { generate } from "@/gen/templates";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("scene interactions retain generator answers", () => {
  it("serves one treat at a time equally, then checks the entered answer", () => {
    const spec = generate("share", 0, 12345);
    const report = vi.fn();
    render(<PuzzleBody spec={spec} report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "Serve one treat to the next friend" }));
    expect(screen.getByRole("button", { name: "Friend 1, 1 treats; reset serving" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Friend 2, 0 treats; reset serving" })).toBeInTheDocument();
    expect(report).not.toHaveBeenCalled();
    if (spec.kind.type !== "number") throw new Error("Expected number puzzle");
    for (const digit of String(spec.kind.answer)) fireEvent.click(screen.getByRole("button", { name: digit }));
    fireEvent.click(screen.getByRole("button", { name: "Check my answer ✓" }));
    expect(report).toHaveBeenCalledWith(true);
  });

  it("collects selected river stones, takes the robot turn, and permits a winning finish", () => {
    vi.useFakeTimers();
    const spec = generate("nim", 5, 12345), report = vi.fn();
    if (spec.kind.type !== "nim") throw new Error("Expected stone game");
    const k = spec.kind;
    render(<PuzzleBody spec={spec} report={report} />);
    const firstTake = k.stones % (k.maxTake + 1);
    for (let i = 1; i <= firstTake; i++) fireEvent.click(screen.getByRole("button", { name: `Stone ${i}` }));
    fireEvent.click(screen.getByRole("button", { name: `Collect ${firstTake}` }));
    expect(screen.getByText(/Robo is thinking/)).toBeInTheDocument();
    let left = k.stones - firstTake;
    while (left > 0) {
      act(() => { vi.advanceTimersByTime(800); });
      left -= left % (k.maxTake + 1) || 1;
      expect(screen.getByText(new RegExp(`${left} left`))).toBeInTheDocument();
      const take = left % (k.maxTake + 1);
      fireEvent.click(screen.getByRole("button", { name: `Take ${take}` }));
      left -= take;
    }
    expect(report).toHaveBeenCalledWith(true);
  });

  it("moving coins never changes the expected total", () => {
    const spec = generate("coins", 5, 12345), report = vi.fn();
    render(<PuzzleBody spec={spec} report={report} />);
    const coin = screen.getAllByRole("button", { name: /cent coin/ })[0];
    if (!coin) throw new Error("Missing coins");
    fireEvent.click(coin);
    expect(coin).toHaveAttribute("aria-pressed", "true");
    if (spec.kind.type !== "number") throw new Error("Expected number puzzle");
    for (const digit of String(spec.kind.answer)) fireEvent.click(screen.getByRole("button", { name: digit }));
    fireEvent.click(screen.getByRole("button", { name: "Check my answer ✓" }));
    expect(report).toHaveBeenCalledWith(true);
  });
});