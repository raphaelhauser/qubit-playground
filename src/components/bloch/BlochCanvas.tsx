import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { ReactNode, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Line2, OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec3 } from '../../quantum';
import { COLORS, mixHex, phaseColor } from '../../theme';
import { renderTex } from '../Tex';
import { useHighlight } from '../Highlight';

/**
 * Physics → three.js coordinates.
 * Bloch (x, y, z) with z = |0⟩ "up"  ↦  three (y, z, x) so that z points up on screen and
 * the x axis comes out of the screen towards the viewer. This is a cyclic permutation,
 * i.e. a proper rotation, so handedness and rotation senses are preserved.
 */
export const toThree = (v: Vec3): THREE.Vector3 => new THREE.Vector3(v[1], v[2], v[0]);
export const fromThree = (p: THREE.Vector3): Vec3 => [p.z, p.x, p.y];
export const tv = (v: Vec3, s = 1): [number, number, number] => [v[1] * s, v[2] * s, v[0] * s];

/** Points of a circle of radius ρ around unit axis n, centred at c (physics coords). */
export function circlePoints(n: Vec3, center: Vec3, rho: number, segments = 96): THREE.Vector3[] {
  const N = toThree(n).normalize();
  const helper = Math.abs(N.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(N, helper).normalize();
  const w = new THREE.Vector3().crossVectors(N, u).normalize();
  const C = toThree(center);
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= segments; k++) {
    const a = (2 * Math.PI * k) / segments;
    pts.push(C.clone().addScaledVector(u, rho * Math.cos(a)).addScaledVector(w, rho * Math.sin(a)));
  }
  return pts;
}

// ---------------------------------------------------------------------------
// hidden-line drawing of the sphere
// ---------------------------------------------------------------------------

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * A circle on the sphere, drawn solid where it faces the camera and faded where it runs behind.
 * Visibility of a surface point p (|p| = 1) seen from camera C is p·Ĉ > 1/|C|; the per-vertex
 * colours are recomputed whenever the camera moves.
 */
function SphereCircle({ pts, colors, lineWidth = 1, back = 0.26 }: { pts: THREE.Vector3[]; colors: string | string[]; lineWidth?: number; back?: number }) {
  const ref = useRef<Line2>(null);
  const camera = useThree((s) => s.camera);
  const last = useRef(new THREE.Vector3(Infinity, 0, 0));
  const front = useMemo(() => pts.map((_, i) => new THREE.Color(Array.isArray(colors) ? colors[i] : colors)), [pts, colors]);
  const bg = useMemo(() => new THREE.Color(COLORS.bg), []);
  const initial = useMemo(() => front.map((c) => [c.r, c.g, c.b] as [number, number, number]), [front]);
  useFrame(() => {
    const line = ref.current;
    if (!line || camera.position.distanceToSquared(last.current) < 1e-9) return;
    last.current.copy(camera.position);
    const d = camera.position.length();
    const dir = camera.position.clone().normalize();
    const flat = new Float32Array(pts.length * 3);
    const tmp = new THREE.Color();
    pts.forEach((p, i) => {
      const f = back + (1 - back) * smooth(-0.05, 0.05, p.dot(dir) / p.length() - 1 / d);
      tmp.copy(bg).lerp(front[i], f);
      flat[3 * i] = tmp.r;
      flat[3 * i + 1] = tmp.g;
      flat[3 * i + 2] = tmp.b;
    });
    (line.geometry as unknown as { setColors: (a: Float32Array) => void }).setColors(flat);
  });
  return <Line ref={ref as never} points={pts} vertexColors={initial} color="white" lineWidth={lineWidth} />;
}

/** The sphere's outline as seen from the camera: a circle of radius √(1 − 1/d²) at distance 1/d. */
function Silhouette() {
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const last = useRef(new THREE.Vector3(Infinity, 0, 0));
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let k = 0; k <= 128; k++) out.push(new THREE.Vector3(Math.cos((2 * Math.PI * k) / 128), Math.sin((2 * Math.PI * k) / 128), 0));
    return out;
  }, []);
  useFrame(() => {
    const g = group.current;
    if (!g || camera.position.distanceToSquared(last.current) < 1e-9) return;
    last.current.copy(camera.position);
    const d = camera.position.length();
    const dir = camera.position.clone().normalize();
    g.position.copy(dir).multiplyScalar(1 / d);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    g.scale.setScalar(Math.sqrt(Math.max(0, 1 - 1 / (d * d))));
  });
  return (
    <group ref={group}>
      {/* opaque backing drawn first and without depth, so nothing that follows is dimmed by it */}
      <mesh renderOrder={-10}>
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial color={COLORS.panel} depthWrite={false} depthTest={false} />
      </mesh>
      <Line points={pts} color={COLORS.muted} lineWidth={1.25} />
    </group>
  );
}

function SphereDrawing() {
  const equator = useMemo(() => circlePoints([0, 0, 1], [0, 0, 0], 1, 144), []);
  // hue along the equator = azimuth φ, i.e. the relative phase of the state above it
  const equatorColors = useMemo(
    () =>
      equator.map((p) => {
        const [x, y] = fromThree(p);
        return phaseColor(Math.atan2(y, x));
      }),
    [equator],
  );
  const merXZ = useMemo(() => circlePoints([0, 1, 0], [0, 0, 0], 1), []);
  const merYZ = useMemo(() => circlePoints([1, 0, 0], [0, 0, 0], 1), []);
  const lat = useMemo(
    () => [Math.PI / 6, Math.PI / 3, (2 * Math.PI) / 3, (5 * Math.PI) / 6].map((t) => circlePoints([0, 0, 1], [0, 0, Math.cos(t)], Math.sin(t), 72)),
    [],
  );
  const mer = mixHex(COLORS.bg, COLORS.muted, 0.55);
  const latc = mixHex(COLORS.bg, COLORS.muted, 0.3);
  return (
    <group>
      <Silhouette />
      {lat.map((p, i) => (
        <SphereCircle key={i} pts={p} colors={latc} lineWidth={0.8} back={0.15} />
      ))}
      <SphereCircle pts={merXZ} colors={mer} lineWidth={0.9} back={0.2} />
      <SphereCircle pts={merYZ} colors={mer} lineWidth={0.9} back={0.2} />
      <SphereCircle pts={equator} colors={equatorColors} lineWidth={2.4} back={0.3} />
    </group>
  );
}

export function Label3D({
  position,
  tex,
  color = COLORS.muted,
  size = 13,
  className = '',
  opacity = 1,
}: {
  position: Vec3;
  tex: string;
  color?: string;
  size?: number;
  className?: string;
  opacity?: number;
}) {
  const html = useMemo(() => renderTex(tex, false), [tex]);
  const bg = COLORS.bg;
  return (
    <Html position={tv(position)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className={`select-none whitespace-nowrap ${className}`}
        style={{ color, fontSize: size, opacity, textShadow: `0 0 5px ${bg}, 0 0 2px ${bg}, 0 0 1px ${bg}` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Html>
  );
}

function Axes({ labels }: { labels: 'kets' | 'xyz' | 'both' | 'none' }) {
  const { active } = useHighlight();
  const L = 1.3;
  const axes: { v: Vec3; key: 'x' | 'y' | 'z'; plus: string; minus: string }[] = [
    { v: [1, 0, 0], key: 'x', plus: '|{+}\\rangle', minus: '|{-}\\rangle' },
    { v: [0, 1, 0], key: 'y', plus: '|{+i}\\rangle', minus: '|{-i}\\rangle' },
    { v: [0, 0, 1], key: 'z', plus: '|0\\rangle', minus: '|1\\rangle' },
  ];
  return (
    <group>
      {axes.map((a) => {
        const hot = active === a.key;
        const col = hot ? COLORS.text : mixHex(COLORS.bg, COLORS.muted, 0.7);
        const p: Vec3 = [a.v[0] * L, a.v[1] * L, a.v[2] * L];
        const m: Vec3 = [-a.v[0] * L, -a.v[1] * L, -a.v[2] * L];
        return (
          <group key={a.key}>
            <Line points={[toThree(m), toThree(p)]} color={col} lineWidth={hot ? 1.8 : 0.9} />
            <mesh position={tv(a.v, L)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toThree(a.v))}>
              <coneGeometry args={[0.022, 0.075, 16]} />
              <meshBasicMaterial color={col} />
            </mesh>
            {(labels === 'kets' || labels === 'both') && (
              <>
                <Label3D position={[a.v[0] * 1.47, a.v[1] * 1.47, a.v[2] * 1.47]} tex={a.plus} color={hot ? COLORS.text : COLORS.muted} size={13.5} />
                <Label3D position={[-a.v[0] * 1.44, -a.v[1] * 1.44, -a.v[2] * 1.44]} tex={a.minus} color={COLORS.faint} size={12.5} />
              </>
            )}
            {(labels === 'xyz' || labels === 'both') && (
              <Label3D
                position={
                  labels === 'both'
                    ? [a.v[0] * 1.3 + (a.key === 'z' ? 0.11 : 0), a.v[1] * 1.3 + (a.key === 'x' ? -0.1 : 0), a.v[2] * 1.3 + (a.key === 'z' ? 0 : 0.09)]
                    : [a.v[0] * 1.45, a.v[1] * 1.45, a.v[2] * 1.45]
                }
                tex={a.key}
                color={hot ? COLORS.text : COLORS.faint}
                size={12}
              />
            )}
          </group>
        );
      })}
      <mesh>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshBasicMaterial color={COLORS.muted} />
      </mesh>
    </group>
  );
}

export interface BlochCanvasProps {
  children?: ReactNode;
  className?: string;
  /** CSS height of the canvas area */
  height?: number | string;
  labels?: 'kets' | 'xyz' | 'both' | 'none';
  /** DOM overlay rendered on top of the canvas (legends, badges) */
  overlay?: ReactNode;
  /** camera distance factor (1 = default) */
  zoom?: number;
  interactive?: boolean;
}

/**
 * The shared Bloch sphere, drawn like a figure in a physics text: outline, hidden-line grid and
 * an equator coloured by phase. Compose state arrows, axes, trails etc. as children (./primitives).
 */
export function BlochCanvas({ children, className = '', height = '100%', labels = 'both', overlay, zoom = 1, interactive = true }: BlochCanvasProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const cam = useMemo(() => new THREE.Vector3(1.6, 1.3, 4.3).multiplyScalar(zoom), [zoom]);
  return (
    <div className={`relative h-full w-full ${className}`} style={{ height }}>
      <Canvas flat frameloop="demand" dpr={[1, 2]} camera={{ position: cam, fov: 38, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }} style={{ touchAction: 'none' }}>
        <Suspense fallback={null}>
          <SphereDrawing />
          <Axes labels={labels} />
          {children}
        </Suspense>
        <OrbitControls
          ref={controls as never}
          makeDefault
          enablePan={false}
          enableZoom={interactive}
          enableRotate={interactive}
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.7}
          minDistance={2.6}
          maxDistance={7}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">{overlay}</div>
      {interactive && (
        <button
          onClick={() => controls.current?.reset()}
          className="absolute bottom-2.5 right-2.5 rounded-[5px] px-2 py-1 font-mono text-[10.5px] text-ink-400 ring-1 ring-inset ring-ink-700 hover:text-ink-100 hover:ring-ink-500"
          title="Reset camera"
        >
          reset view
        </button>
      )}
    </div>
  );
}
