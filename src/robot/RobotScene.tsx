import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import pavingSource from "@/assets/robot/stone-paving.jpg";
import rockSource from "@/assets/robot/red-rock.jpg";
import { ProjectedRobotYard } from "./RobotSceneFallback";
import type { DeliveryStop, RobotMission } from "./types";

export type RobotVisualPose = {
  x: number;
  y: number;
  direction: number;
  wheelSpin: number;
  pitch: number;
  speed: number;
};

type SceneProps = {
  mission: RobotMission;
  pose: React.MutableRefObject<RobotVisualPose>;
  delivered: string[];
  phase: "editing" | "running" | "failure" | "success";
  lastDelivery: string | null;
  eventNonce: number;
  reducedMotion: boolean;
};

function referenceTexture(source: string) {
  const texture = new THREE.TextureLoader().load(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function mailTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff0cf";
  ctx.roundRect(18, 18, 220, 220, 32); ctx.fill();
  ctx.strokeStyle = "#b8543d"; ctx.lineWidth = 17; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeRect(55, 76, 146, 112);
  ctx.beginPath(); ctx.moveTo(58, 82); ctx.lineTo(128, 142); ctx.lineTo(198, 82); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28, 100); ctx.lineTo(48, 100); ctx.moveTo(22, 127); ctx.lineTo(48, 127); ctx.moveTo(30, 154); ctx.lineTo(48, 154); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function labelTexture(icon: string, delivered: boolean, order: number, ordered: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = delivered ? "#77b995" : "#f3c748";
  ctx.roundRect(12, 12, 232, 232, 40); ctx.fill();
  ctx.strokeStyle = delivered ? "#d9f4d7" : "#fff0a5";
  ctx.lineWidth = 10; ctx.roundRect(25, 25, 206, 206, 30); ctx.stroke();
  ctx.font = "112px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#7e4c2d";
  ctx.fillText(delivered ? "✓" : icon, 128, 128);
  if (ordered && !delivered) {
    ctx.fillStyle = "#263b55"; ctx.beginPath(); ctx.arc(200, 55, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff7dc"; ctx.font = "bold 34px sans-serif"; ctx.fillText(String(order + 1), 200, 58);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function tilePosition(cell: { x: number; y: number }, size: number): [number, number, number] {
  return [cell.x - (size - 1) / 2, 0, cell.y - (size - 1) / 2];
}

function StoneYard({ mission }: { mission: RobotMission }) {
  const texture = useMemo(() => referenceTexture(pavingSource), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group>
    {Array.from({ length: mission.size * mission.size }, (_, i) => {
      const cell = { x: i % mission.size, y: Math.floor(i / mission.size) };
      const [x, y, z] = tilePosition(cell, mission.size);
      return <RoundedBox key={i} args={[.94, .12, .94]} radius={.055} smoothness={2} position={[x, y - .08, z]} receiveShadow>
        <meshStandardMaterial map={texture} color="#e4c5a0" roughness={.92} metalness={0} />
      </RoundedBox>;
    })}
  </group>;
}

function Destination({ stop, index, mission, delivered, active }: { stop: DeliveryStop; index: number; mission: RobotMission; delivered: boolean; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef(0);
  const texture = useMemo(() => labelTexture(stop.subject.icon, delivered, index, mission.ordered), [stop.subject.icon, delivered, index, mission.ordered]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => { if (active) pulse.current = 1; }, [active]);
  useFrame((_, delta) => {
    if (!group.current) return;
    pulse.current = Math.max(0, pulse.current - delta * 1.8);
    const s = 1 + Math.sin(pulse.current * Math.PI * 4) * pulse.current * .08;
    group.current.scale.setScalar(s);
  });
  const [x, , z] = tilePosition(stop, mission.size);
  return <group ref={group} position={[x, .03, z]}>
    <RoundedBox args={[.82, .09, .82]} radius={.1} smoothness={3} receiveShadow>
      <meshStandardMaterial color={delivered ? "#5d9e77" : "#dcae32"} roughness={.55} metalness={.12} />
    </RoundedBox>
    <mesh position={[0, .068, 0]}>
      <boxGeometry args={[.72, .025, .72]} /><meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  </group>;
}

function RockObstacle({ cell, size, index }: { cell: { x: number; y: number }; size: number; index: number }) {
  const [x, , z] = tilePosition(cell, size);
  const texture = useMemo(() => referenceTexture(rockSource), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={[x, .13, z]} rotation={[0, index * 1.7, 0]}>
    <mesh castShadow receiveShadow scale={[.72, .85 + (index % 3) * .09, .7]} position={[0, .27, 0]}>
      <dodecahedronGeometry args={[.43, 0]} /><meshStandardMaterial map={texture} color={index % 2 ? "#c7a493" : "#d8b09a"} roughness={.9} flatShading />
    </mesh>
    {[-1, 1].map(side => <mesh key={side} castShadow position={[side * .33, .05, .23]} scale={[.18, .12, .16]}>
      <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial map={texture} color="#bd9a88" roughness={.95} flatShading />
    </mesh>)}
  </group>;
}

function DepositParcel({ stop, size, nonce, reducedMotion }: { stop: DeliveryStop; size: number; nonce: number; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const started = useRef<number | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => { started.current = null; setDone(false); }, [nonce]);
  useFrame(({ clock }) => {
    if (!group.current || done) return;
    started.current ??= clock.elapsedTime;
    const t = reducedMotion ? 1 : Math.min(1, (clock.elapsedTime - started.current) / .75);
    const bounce = Math.sin(t * Math.PI);
    group.current.position.y = 1.55 - t * 1.25 + bounce * .12;
    group.current.rotation.y = t * Math.PI * 2;
    group.current.scale.setScalar(1 - Math.max(0, t - .78) * 3.5);
    if (t >= 1) setDone(true);
  });
  if (done) return null;
  const [x, , z] = tilePosition(stop, size);
  return <group ref={group} position={[x, 1.5, z]}>
    <RoundedBox args={[.42, .34, .38]} radius={.045} smoothness={2} castShadow>
      <meshStandardMaterial color={stop.subject.color} roughness={.72} />
    </RoundedBox>
    <mesh position={[0, 0, .195]}><planeGeometry args={[.24, .19]} /><meshBasicMaterial color="#fff0cf" /></mesh>
  </group>;
}

export function RobotModel({ pose, phase, reducedMotion }: Pick<SceneProps, "pose" | "phase" | "reducedMotion">) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const antenna = useRef<THREE.Group>(null);
  const wheels = useRef<Array<THREE.Group | null>>([]);
  const eyeMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const mail = useMemo(mailTexture, []);
  useEffect(() => () => mail.dispose(), [mail]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const p = pose.current;
    root.current.position.set(p.x, .06, p.y);
    root.current.rotation.y = Math.PI - p.direction * Math.PI / 2;
    if (body.current) {
      body.current.rotation.x = reducedMotion ? 0 : p.pitch;
      body.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.4) * .012;
    }
    if (antenna.current) antenna.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 7) * .025 + p.pitch * 1.8;
    wheels.current.forEach(w => { if (w) w.rotation.x = p.wheelSpin; });
    eyeMaterials.current.forEach(material => {
      if (!material) return;
      material.emissive.set(phase === "failure" ? "#f5b642" : "#48e5ef");
      material.emissiveIntensity = phase === "success" ? 2.2 + Math.sin(clock.elapsedTime * 8) * .6 : 1.65;
    });
  });
  const cream = "#f3dfb3";
  const orange = "#d97939";
  return <group ref={root} scale={.78}>
    <group ref={body}>
      <RoundedBox args={[.8, .2, .64]} radius={.075} smoothness={4} position={[0, .43, 0]} castShadow>
        <meshStandardMaterial color={orange} roughness={.36} metalness={.28} />
      </RoundedBox>
      <RoundedBox args={[.66, .59, .54]} radius={.14} smoothness={5} position={[0, .73, 0]} castShadow>
        <meshStandardMaterial color={cream} roughness={.3} metalness={.14} />
      </RoundedBox>
      <RoundedBox args={[.47, .39, .035]} radius={.07} smoothness={3} position={[0, .75, .282]}>
        <meshStandardMaterial color="#fff0cf" roughness={.48} metalness={.05} />
      </RoundedBox>
      <mesh position={[0, .75, .304]}><planeGeometry args={[.34, .34]} /><meshBasicMaterial map={mail} transparent toneMapped={false} /></mesh>
      {[-1, 1].map(side => <group key={side} position={[side * .36, .77, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.105, .105, .09, 20]} /><meshStandardMaterial color={orange} roughness={.38} metalness={.25} /></mesh>
        <mesh position={[side * .065, -.13, .04]} rotation={[0, 0, side * .25]}><capsuleGeometry args={[.045, .22, 5, 10]} /><meshStandardMaterial color="#e8c894" roughness={.45} metalness={.15} /></mesh>
      </group>)}
      <RoundedBox args={[.48, .5, .29]} radius={.07} smoothness={4} position={[0, .86, -.39]} castShadow>
        <meshStandardMaterial color="#a98052" roughness={.76} metalness={.02} />
      </RoundedBox>
      {[-.15, .15].map(x => <mesh key={x} position={[x, .87, -.548]}><boxGeometry args={[.055, .47, .025]} /><meshStandardMaterial color="#ead3a4" roughness={.68} /></mesh>)}
      <RoundedBox args={[.84, .58, .64]} radius={.16} smoothness={6} position={[0, 1.22, .015]} castShadow>
        <meshStandardMaterial color={cream} roughness={.27} metalness={.16} />
      </RoundedBox>
      <RoundedBox args={[.75, .4, .075]} radius={.12} smoothness={5} position={[0, 1.22, .337]}>
        <meshStandardMaterial color="#8f532f" roughness={.32} metalness={.32} />
      </RoundedBox>
      <RoundedBox args={[.66, .31, .035]} radius={.095} smoothness={4} position={[0, 1.22, .384]}>
        <meshStandardMaterial color="#102c35" roughness={.16} metalness={.5} />
      </RoundedBox>
      {[-.17, .17].map((x, index) => <RoundedBox key={x} args={[.105, .215, .035]} radius={.05} smoothness={4} position={[x, 1.22, .412]}>
        <meshStandardMaterial ref={node => { eyeMaterials.current[index] = node; }} color="#8bfff6" emissive="#48e5ef" emissiveIntensity={1.65} toneMapped={false} />
      </RoundedBox>)}
      {[-1, 1].map(side => <group key={side} position={[side * .455, 1.22, .01]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[.18, .18, .09, 24]} /><meshStandardMaterial color={orange} roughness={.35} metalness={.28} /></mesh>
        <mesh position={[0, side * .055, 0]}><cylinderGeometry args={[.09, .09, .025, 20]} /><meshStandardMaterial color="#f4d9a5" roughness={.35} metalness={.25} /></mesh>
      </group>)}
      <RoundedBox args={[.36, .09, .5]} radius={.04} smoothness={3} position={[0, .95, .01]}>
        <meshStandardMaterial color={orange} roughness={.38} metalness={.22} />
      </RoundedBox>
      <group ref={antenna} position={[0, 1.51, -.02]}>
        <mesh position={[0, .1, 0]} castShadow><cylinderGeometry args={[.025, .035, .22, 12]} /><meshStandardMaterial color="#574738" metalness={.65} roughness={.25} /></mesh>
        {[.025, .075, .125].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.052, .012, 7, 18]} /><meshStandardMaterial color="#6e5a43" metalness={.7} roughness={.25} /></mesh>)}
        <mesh position={[0, .25, 0]} castShadow><sphereGeometry args={[.075, 20, 14]} /><meshStandardMaterial color={orange} roughness={.28} metalness={.25} /></mesh>
      </group>
    </group>
    {[-1, 1].flatMap(side => [-.21, .21].map((z, i) => <group key={`${side}-${z}`} ref={node => { wheels.current[side < 0 ? i : i + 2] = node; }} position={[side * .43, .28, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.235, .235, .18, 28]} /><meshStandardMaterial color="#303b3d" roughness={.8} metalness={.08} /></mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[.19, .052, 10, 28]} /><meshStandardMaterial color="#3e4848" roughness={.88} /></mesh>
      <mesh position={[side * .102, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.13, .13, .028, 24]} /><meshStandardMaterial color="#db9138" metalness={.38} roughness={.36} /></mesh>
      <mesh position={[side * .121, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.047, .047, .035, 16]} /><meshStandardMaterial color="#f0bd5e" metalness={.42} roughness={.3} /></mesh>
    </group>))}
    {[-.21, .21].map(z => <mesh key={z} position={[0, .28, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.045, .045, .75, 12]} /><meshStandardMaterial color="#77644c" metalness={.55} roughness={.35} /></mesh>)}
  </group>;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    camera.fov = aspect < 1 ? Math.min(44, 31 / aspect) : 31;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

function SceneContent(props: SceneProps) {
  const { mission, pose, delivered, phase, lastDelivery, eventNonce, reducedMotion } = props;
  const activeStop = mission.stops.find(s => s.id === lastDelivery && delivered.includes(s.id));
  return <>
    <ambientLight intensity={.65} color="#ffe7c0" />
    <hemisphereLight args={["#c3e3ff", "#8c5535", 1.25]} />
    <directionalLight position={[-4, 8, 5]} intensity={2.5} color="#ffd9a0" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
    <Environment resolution={64}>
      <Lightformer intensity={1.5} position={[0, 5, 0]} scale={[8, 8, 1]} color="#fff0d0" />
      <Lightformer intensity={.7} position={[-5, 2, -1]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color="#b8d9ef" />
    </Environment>
    <StoneYard mission={mission} />
    {mission.stops.map((stop, i) => <Destination key={stop.id} stop={stop} index={i} mission={mission} delivered={delivered.includes(stop.id)} active={lastDelivery === stop.id} />)}
    {mission.obstacles.map((cell, i) => <RockObstacle key={`${cell.x}-${cell.y}`} cell={cell} size={mission.size} index={i} />)}
    <RobotModel pose={pose} phase={phase} reducedMotion={reducedMotion} />
    {activeStop && <DepositParcel key={eventNonce} stop={activeStop} size={mission.size} nonce={eventNonce} reducedMotion={reducedMotion} />}
    <ContactShadows position={[0, .015, 0]} opacity={.42} scale={mission.size + 2} blur={2.2} far={4} resolution={256} color="#4d2f24" frames={reducedMotion ? 1 : Infinity} />
  </>;
}

class RobotSceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onError(); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
}

export function RobotScene(props: SceneProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => { setWebgl(supportsWebGL()); }, []);
  if (webgl === false) return <ProjectedRobotYard {...props} />;
  if (webgl === null) return <div className="robot-three robot-scene-checking" role="status">Preparing Pip’s yard…</div>;
  return <div className="robot-three" ref={wrapper} aria-label="Interactive three-dimensional postal yard">
    <RobotSceneBoundary fallback={<ProjectedRobotYard {...props} />} onError={() => setWebgl(false)}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 7.4, 8.4], fov: 31, near: .1, far: 60 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0, 0);
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener("webglcontextlost", event => { event.preventDefault(); setWebgl(false); });
          if (wrapper.current) wrapper.current.dataset.sceneReady = "1";
        }}
      >
        <ResponsiveCamera />
        <SceneContent {...props} />
      </Canvas>
    </RobotSceneBoundary>
  </div>;
}
