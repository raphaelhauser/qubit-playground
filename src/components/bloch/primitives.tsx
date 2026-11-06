import { Billboard, Line } from '@react-three/drei';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Vec3, rotate3, dot3, scale3, sub3, len3, normalize3, cross3 } from '../../quantum';
import { COLORS, phaseColor } from '../../theme';
import { isHollow } from '../ui';
import { Label3D, toThree, fromThree, circlePoints, tv } from './BlochCanvas';

const UP = new THREE.Vector3(0, 1, 0);
const quatFor = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());

// ---------------------------------------------------------------------------
// Arrow (state vector)
// ---------------------------------------------------------------------------

export function Arrow({
  v,
  color = COLORS.state,
  radius = 0.016,
  headLength = 0.11,
  headRadius = 0.045,
  opacity = 1,
  label,
  labelColor,
}: {
  v: Vec3;
  color?: string;
  radius?: number;
  headLength?: number;
  headRadius?: number;
  opacity?: number;
  /** kept for API compatibility; arrows are drawn flat, like ink */
  emissive?: number;
  label?: string;
  labelColor?: string;
}) {
  const len = len3(v);
  if (len < 1e-6) return null;
  const dir = toThree(v).normalize();
  const shaft = Math.max(0, len - headLength);
  const q = quatFor(dir);
  const transparent = opacity < 1;
  return (
    <group>
      <group quaternion={q}>
        <mesh position={[0, shaft / 2, 0]}>
          <cylinderGeometry args={[radius, radius, shaft, 16]} />
          <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} depthWrite={!transparent} />
        </mesh>
        <mesh position={[0, shaft + headLength / 2, 0]}>
          <coneGeometry args={[headRadius, headLength, 24]} />
          <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} depthWrite={!transparent} />
        </mesh>
      </group>
      {label && <Label3D position={scale3(v, 1 + 0.22 / Math.max(len, 0.3))} tex={label} color={labelColor ?? color} size={13.5} />}
    </group>
  );
}

/** Hue of the relative phase of a Bloch vector (its azimuth), or null at the poles. */
const azimuthHue = (v: Vec3): string | null => (Math.hypot(v[0], v[1]) > 0.04 ? phaseColor(Math.atan2(v[1], v[0])) : null);

/**
 * The Bloch vector of the state, drawn in ink. Its tip and a tick on the equator below it carry
 * the hue of the state's relative phase φ — the same colour its |1⟩ amplitude has in the complex plane.
 */
export function StateArrow({
  v,
  color = COLORS.state,
  label,
  opacity = 1,
  emphasized = false,
  phaseTick = true,
}: {
  v: Vec3;
  color?: string;
  label?: string;
  opacity?: number;
  emphasized?: boolean;
  phaseTick?: boolean;
}) {
  const isInk = color.toLowerCase() === COLORS.state.toLowerCase();
  const hue = isInk ? azimuthHue(v) : null;
  const rho = Math.hypot(v[0], v[1]);
  const tick: Vec3 | null = hue && phaseTick && len3(v) > 0.5 ? [v[0] / rho, v[1] / rho, 0] : null;
  return (
    <group>
      <Arrow v={v} color={color} opacity={opacity} radius={emphasized ? 0.022 : 0.016} label={label} />
      <mesh position={tv(v)}>
        <sphereGeometry args={[emphasized ? 0.05 : 0.04, 20, 16]} />
        <meshBasicMaterial color={hue ?? color} transparent opacity={opacity} />
      </mesh>
      {tick && (
        <>
          <Line points={[toThree(v), toThree([v[0], v[1], 0])]} color={hue!} lineWidth={1} dashed dashSize={0.035} gapSize={0.03} transparent opacity={0.75 * opacity} />
          <mesh position={tv(tick)}>
            <sphereGeometry args={[0.03, 16, 12]} />
            <meshBasicMaterial color={hue!} transparent opacity={opacity} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** A labelled point on (or in) the sphere, e.g. an eigenstate. Outcome "−" colours are drawn hollow. */
export function PointMarker({ v, color, label, size = 0.045, opacity = 1, ring = false }: { v: Vec3; color: string; label?: string; size?: number; opacity?: number; ring?: boolean }) {
  const n = toThree(v);
  const hollow = isHollow(color);
  return (
    <group>
      {hollow ? (
        <Billboard position={n}>
          <mesh>
            <ringGeometry args={[size * 0.5, size, 32]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <circleGeometry args={[size * 0.5, 24]} />
            <meshBasicMaterial color={COLORS.bg} transparent opacity={opacity} />
          </mesh>
        </Billboard>
      ) : (
        <mesh position={n}>
          <sphereGeometry args={[size, 20, 16]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
      {ring && <Line points={circlePoints(normalize3(v), v, size * 2.2, 40)} color={color} lineWidth={1.3} transparent opacity={0.8 * opacity} />}
      {label && <Label3D position={scale3(normalize3(v), len3(v) + 0.2)} tex={label} color={color} size={13} opacity={opacity} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Axis line (rotation axis, measurement axis) — a construction, so dashed by default
// ---------------------------------------------------------------------------

export function AxisLine({
  n,
  color = COLORS.axis,
  length = 1.42,
  dashed = true,
  label,
  lineWidth = 1.6,
  opacity = 1,
  bothArrows = false,
}: {
  n: Vec3;
  color?: string;
  length?: number;
  dashed?: boolean;
  label?: string;
  lineWidth?: number;
  opacity?: number;
  bothArrows?: boolean;
}) {
  const u = normalize3(n);
  const a = toThree(scale3(u, -length));
  const b = toThree(scale3(u, length));
  return (
    <group>
      <Line points={[a, b]} color={color} lineWidth={lineWidth} dashed={dashed} dashSize={0.07} gapSize={0.045} transparent opacity={opacity} />
      <mesh position={b} quaternion={quatFor(toThree(u))}>
        <coneGeometry args={[0.034, 0.1, 20]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {bothArrows && (
        <mesh position={a} quaternion={quatFor(toThree(scale3(u, -1)))}>
          <coneGeometry args={[0.034, 0.1, 20]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
      {label && <Label3D position={scale3(u, length + 0.16)} tex={label} color={color} size={13} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trails, orbits and arcs
// ---------------------------------------------------------------------------

/**
 * Polyline through Bloch-space points; `fade` fades the oldest points out. With the default ink
 * colour each point takes the hue of its relative phase, so a precession draws the phase wheel.
 */
export function Trail({ points, color: given, lineWidth = 2, fade = true, opacity = 1, dashed = false }: { points: Vec3[]; color?: string; lineWidth?: number; fade?: boolean; opacity?: number; dashed?: boolean }) {
  // the state's own path (no colour given) is drawn in phase hues; explicit colours are kept
  const color = given ?? COLORS.state;
  const byPhase = given === undefined || given.toLowerCase() === COLORS.state.toLowerCase();
  const { pts, colors } = useMemo(() => {
    const pts = points.map((p) => toThree(p));
    const bg = new THREE.Color(COLORS.bg);
    const base = new THREE.Color(color);
    const colors = points.map((p, i) => {
      const f = fade ? 0.12 + 0.88 * (i / Math.max(1, points.length - 1)) : 1;
      const hue = byPhase ? azimuthHue(p) : null;
      return bg.clone().lerp(hue ? new THREE.Color(hue) : base, f);
    });
    return { pts, colors };
  }, [points, color, fade, byPhase]);
  if (pts.length < 2) return null;
  return <Line points={pts} vertexColors={colors as unknown as [number, number, number][]} color="white" lineWidth={lineWidth} transparent={opacity < 1} opacity={opacity} dashed={dashed} dashSize={0.05} gapSize={0.04} />;
}

/** The full circle a point p sweeps out when rotated about axis n (precession cone rim). */
export function OrbitCircle({ n, through, color = COLORS.axis, opacity = 0.5, dashed = true, lineWidth = 1 }: { n: Vec3; through: Vec3; color?: string; opacity?: number; dashed?: boolean; lineWidth?: number }) {
  const pts = useMemo(() => {
    const u = normalize3(n);
    const center = scale3(u, dot3(through, u));
    const rho = len3(sub3(through, center));
    if (rho < 1e-4) return null;
    return circlePoints(u, center, rho);
  }, [n, through]);
  if (!pts) return null;
  return <Line points={pts} color={color} lineWidth={lineWidth} dashed={dashed} dashSize={0.04} gapSize={0.035} transparent opacity={opacity} />;
}

/** Arc traced by rotating `from` about n by `angle` (right-hand rule), with an arrowhead. */
export function RotationArc({ n, from, angle, color = COLORS.axis, label, lineWidth = 2 }: { n: Vec3; from: Vec3; angle: number; color?: string; label?: string; lineWidth?: number }) {
  const data = useMemo(() => {
    if (Math.abs(angle) < 1e-4) return null;
    const segs = Math.max(8, Math.ceil(Math.abs(angle) * 30));
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= segs; k++) pts.push(toThree(rotate3(from, n, (angle * k) / segs)));
    const end = rotate3(from, n, angle);
    const tangent = toThree(cross3(normalize3(n), end)).multiplyScalar(Math.sign(angle));
    const mid = rotate3(from, n, angle / 2);
    return { pts, end, tangent, mid };
  }, [n, from, angle]);
  if (!data || data.pts.length < 2) return null;
  const chord = data.tangent.length();
  return (
    <group>
      <Line points={data.pts} color={color} lineWidth={lineWidth} />
      {chord > 1e-3 && (
        <mesh position={toThree(data.end)} quaternion={quatFor(data.tangent)}>
          <coneGeometry args={[0.03, 0.085, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {label && <Label3D position={scale3(normalize3(data.mid), 1.18)} tex={label} color={color} size={13} />}
    </group>
  );
}

/** Small arc around the axis itself, near the origin, to visualize a rotation angle. */
export function AngleAroundAxis({ n, angle, radius = 0.28, color = COLORS.axis, label }: { n: Vec3; angle: number; radius?: number; color?: string; label?: string }) {
  const data = useMemo(() => {
    const u = normalize3(n);
    const helper: Vec3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const perp = normalize3(cross3(u, helper));
    const base = scale3(u, 0.55);
    const pts: THREE.Vector3[] = [];
    const segs = Math.max(6, Math.ceil(Math.abs(angle) * 24));
    for (let k = 0; k <= segs; k++) {
      const p = rotate3(scale3(perp, radius), u, (angle * k) / segs);
      pts.push(toThree([base[0] + p[0], base[1] + p[1], base[2] + p[2]]));
    }
    const mid = rotate3(scale3(perp, radius * 1.5), u, angle / 2);
    return { pts, labelPos: [base[0] + mid[0], base[1] + mid[1], base[2] + mid[2]] as Vec3 };
  }, [n, angle, radius]);
  if (Math.abs(angle) < 1e-3) return null;
  return (
    <group>
      <Line points={data.pts} color={color} lineWidth={1.6} transparent opacity={0.9} />
      {label && <Label3D position={data.labelPos} tex={label} color={color} size={12} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// θ / φ guides
// ---------------------------------------------------------------------------

export function AngleGuides({ v, highlight }: { v: Vec3; highlight?: string | null }) {
  const data = useMemo(() => {
    const r = len3(v) || 1;
    const theta = Math.acos(Math.max(-1, Math.min(1, v[2] / r)));
    let phi = Math.atan2(v[1], v[0]);
    if (phi < 0) phi += 2 * Math.PI;
    const rho = Math.hypot(v[0], v[1]);
    const proj: Vec3 = [v[0], v[1], 0];
    const thetaArc: THREE.Vector3[] = [];
    const R1 = 0.34;
    for (let k = 0; k <= 32; k++) {
      const t = (theta * k) / 32;
      thetaArc.push(toThree([R1 * Math.sin(t) * Math.cos(phi), R1 * Math.sin(t) * Math.sin(phi), R1 * Math.cos(t)]));
    }
    const phiArc: THREE.Vector3[] = [];
    const phiCols: THREE.Color[] = [];
    const R2 = 0.42;
    for (let k = 0; k <= 48; k++) {
      const p = (phi * k) / 48;
      phiArc.push(toThree([R2 * Math.cos(p), R2 * Math.sin(p), 0]));
      phiCols.push(new THREE.Color(phaseColor(p)));
    }
    const tl: Vec3 = [0.5 * Math.sin(theta / 2) * Math.cos(phi), 0.5 * Math.sin(theta / 2) * Math.sin(phi), 0.5 * Math.cos(theta / 2)];
    const pl: Vec3 = [0.56 * Math.cos(phi / 2), 0.56 * Math.sin(phi / 2), 0];
    return { theta, phi, rho, proj, thetaArc, phiArc, phiCols, tl, pl };
  }, [v]);
  const hotT = highlight === 'theta';
  const hotP = highlight === 'phi';
  return (
    <group>
      {data.rho > 1e-3 && (
        <>
          <Line points={[new THREE.Vector3(0, 0, 0), toThree(data.proj)]} color={hotP ? phaseColor(data.phi) : COLORS.faint} lineWidth={hotP ? 2 : 1} dashed dashSize={0.04} gapSize={0.03} />
        </>
      )}
      {data.theta > 1e-3 && (
        <>
          <Line points={data.thetaArc} color={COLORS.text} lineWidth={hotT ? 2.6 : 1.2} transparent opacity={hotT ? 1 : 0.75} />
          <Label3D position={data.tl} tex="\theta" color={hotT ? COLORS.text : COLORS.muted} size={hotT ? 15 : 12.5} />
        </>
      )}
      {data.rho > 1e-3 && data.phi > 1e-3 && (
        <>
          <Line points={data.phiArc} vertexColors={data.phiCols as unknown as [number, number, number][]} color="white" lineWidth={hotP ? 3 : 1.8} />
          <Label3D position={data.pl} tex="\varphi" color={phaseColor(data.phi)} size={hotP ? 15.5 : 13} />
        </>
      )}
    </group>
  );
}

/** Dashed line from the tip of v to its orthogonal projection onto axis n (Born-rule geometry). */
export function ProjectionOnAxis({ v, n, color = COLORS.muted }: { v: Vec3; n: Vec3; color?: string }) {
  const u = normalize3(n);
  const foot = scale3(u, dot3(v, u));
  if (len3(sub3(v, foot)) < 1e-4) return null;
  return (
    <group>
      <Line points={[toThree(v), toThree(foot)]} color={color} lineWidth={1.2} dashed dashSize={0.04} gapSize={0.03} />
      <mesh position={toThree(foot)}>
        <sphereGeometry args={[0.025, 14, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Direct manipulation
// ---------------------------------------------------------------------------

/**
 * Makes the Bloch vector draggable. Grab the glowing tip and drag across the sphere, or click
 * anywhere on the sphere to jump there. Orbit controls are suspended while dragging.
 */
export function DragHandle({ v, onChange, color = COLORS.state, onDragStart, onDragEnd }: { v: Vec3; onChange: (v: Vec3) => void; color?: string; onDragStart?: () => void; onDragEnd?: () => void }) {
  const { camera, gl, controls, invalidate } = useThree();
  const dragging = useRef(false);
  const down = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState(false);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const cb = useRef({ onChange, onDragEnd });
  cb.current = { onChange, onDragEnd };

  const pick = (clientX: number, clientY: number): Vec3 => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin;
    const d = ray.ray.direction;
    const b = o.dot(d);
    const disc = b * b - (o.lengthSq() - 1);
    const t = disc >= 0 ? -b - Math.sqrt(disc) : -b;
    const p = o.clone().addScaledVector(d, t).normalize();
    return fromThree(p);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      cb.current.onChange(pick(e.clientX, e.clientY));
      invalidate();
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true;
      document.body.style.cursor = '';
      cb.current.onDragEnd?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, controls]);

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragging.current = true;
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
    document.body.style.cursor = 'grabbing';
    onDragStart?.();
  };

  return (
    <group>
      {/* invisible sphere: click-to-place */}
      <mesh
        visible={false}
        onPointerDown={(e) => {
          down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
        }}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (!d || dragging.current) return;
          if (Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) < 5) {
            onChange(fromThree(e.point.clone().normalize()));
          }
        }}
      >
        <sphereGeometry args={[1, 40, 30]} />
        <meshBasicMaterial />
      </mesh>
      {/* grab handle */}
      <mesh
        position={tv(v)}
        onPointerDown={startDrag}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          if (!dragging.current) document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setHover(false);
          if (!dragging.current) document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.13, 20, 16]} />
        <meshBasicMaterial color={color} transparent opacity={hover ? 0.14 : 0.035} depthWrite={false} />
      </mesh>
    </group>
  );
}

