import { useEffect, useRef } from "react";
import direction0 from "@/assets/robot/robot-direction-0.png";
import direction1 from "@/assets/robot/robot-direction-1.png";
import direction2 from "@/assets/robot/robot-direction-2.png";
import direction3 from "@/assets/robot/robot-direction-3.png";
import paving from "@/assets/robot/stone-paving.jpg";
import rock from "@/assets/robot/red-rock.jpg";
import type { RobotVisualPose } from "./RobotScene";
import type { RobotMission, RobotPhase } from "./types";

const directionFrames = [direction0, direction1, direction2, direction3];
const directionNames = ["north", "east", "south", "west"];

function projected(cell: { x: number; y: number }, size: number) {
  const u = (cell.x + .5) / size;
  const v = (cell.y + .5) / size;
  const scale = .66 + v * .44;
  return {
    left: `${50 + (u - .5) * 82 * scale}%`,
    top: `${17 + v * 66}%`,
    scale,
  };
}

export function ProjectedRobotYard({ mission, pose, delivered, phase, lastDelivery, eventNonce }: {
  mission: RobotMission;
  pose: React.MutableRefObject<RobotVisualPose>;
  delivered: string[];
  phase: RobotPhase;
  lastDelivery: string | null;
  eventNonce: number;
  reducedMotion: boolean;
}) {
  const robot = useRef<HTMLImageElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const current = robot.current;
      if (current) {
        const p = pose.current;
        const point = projected({ x: p.x + (mission.size - 1) / 2, y: p.y + (mission.size - 1) / 2 }, mission.size);
        const direction = ((Math.round(p.direction) % 4) + 4) % 4;
        if (current.dataset.direction !== String(direction)) {
          current.src = directionFrames[direction]!;
          current.alt = `Pip the postal robot facing ${directionNames[direction]}`;
          current.dataset.direction = String(direction);
        }
        current.style.left = point.left;
        current.style.top = point.top;
        current.style.height = `${34 * point.scale}%`;
        current.style.zIndex = String(20 + Math.round(p.y + mission.size));
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [mission.size, pose]);

  const activeStop = mission.stops.find(stop => stop.id === lastDelivery && delivered.includes(stop.id));
  return <div className="robot-three robot-projected-yard" data-scene-ready="fallback">
    <div className="robot-projected-board" aria-label="Projected stone delivery yard">
      {Array.from({ length: mission.size * mission.size }, (_, index) => {
        const cell = { x: index % mission.size, y: Math.floor(index / mission.size) };
        const point = projected(cell, mission.size);
        const obstacle = mission.obstacles.some(rockCell => rockCell.x === cell.x && rockCell.y === cell.y);
        const stopIndex = mission.stops.findIndex(stop => stop.x === cell.x && stop.y === cell.y);
        const stop = mission.stops[stopIndex];
        const isDelivered = stop && delivered.includes(stop.id);
        return <div
          key={index}
          className={`robot-projected-tile ${stop ? "destination" : ""} ${isDelivered ? "delivered" : ""}`}
          style={{ left: point.left, top: point.top, width: `${15.2 * point.scale}%`, backgroundImage: `url(${paving})`, zIndex: cell.y + 1 }}
        >
          {stop && <span className="robot-projected-destination">{isDelivered ? "✓" : stop.subject.icon}{mission.ordered && !isDelivered ? <small>{stopIndex + 1}</small> : null}</span>}
          {obstacle && <span className="robot-projected-rock" style={{ backgroundImage: `url(${rock})` }} aria-label="Boulder" />}
        </div>;
      })}
    </div>
    <img ref={robot} className={`robot-projected-robot ${phase}`} src={directionFrames[0]} alt="Pip the postal robot facing north" draggable={false} />
    {activeStop && <span
      key={eventNonce}
      className="robot-projected-deposit"
      style={{ left: projected(activeStop, mission.size).left, top: projected(activeStop, mission.size).top }}
      aria-hidden="true"
    >{activeStop.subject.icon}</span>}
    <p className="robot-capability-note" role="status">3D isn’t available here · using directional robot views</p>
  </div>;
}
