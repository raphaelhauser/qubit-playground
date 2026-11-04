import { Line } from '@react-three/drei';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Vec3, rotate3, dot3, scale3, sub3, len3, normalize3, cross3 } from '../../quantum';
import { COLORS } from '../../theme';
import { Label3D, toThree, fromThree, circlePoints, tv } from './BlochCanvas';

const UP = new THREE.Vector3(0, 1, 0);
const quatFor = (dir: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());

// ---------------------------------------------------------------------------
// Arrow (state vector)
// ---------------------------------------------------------------------------

export function Arrow({
  v,
  color = COLORS.state,
  radius = 0.022,
  headLength = 0.12,
  headRadius = 0.055,
  opacity = 1,
  emissive = 0.35,
  label,
  labelColor,
}: {
  v: Vec3;
  color?: string;
  radius?: number;
  headLength?: number;
  headRadius?: number;
  opacity?: number;
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
          <cylinderGeometry args={[radius, radius, shaft, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} transparent={transparent} opacity={opacity} depthWrite={!transparent} roughness={0.4} />
        </mesh>
        <mesh position={[0, shaft + headLength / 2, 0]}>
          <coneGeometry args={[headRadius, headLength, 24]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} transparent={transparent} opacity={opacity} depthWrite={!transparent} roughness={0.4} />
        </mesh>
      </group>
      {label && <Label3D position={scale3(v, 1 + 0.22 / Math.max(len, 0.3))} tex={label} color={labelColor ?? color} size={13} />}
    </group>
  );
}

/** The Bloch vector of the state, with a soft glow at the tip. */
export function StateArrow({ v, color = COLORS.state, label, opacity = 1, emphasized = false }: { v: Vec3; color?: string; label?: string; opacity?: number; emphasized?: boolean }) {
  return (
    <group>
      <Arrow v={v} color={color} opacity={opacity} radius={emphasized ? 0.028 : 0.022} label={label} />
      <mesh position={tv(v)}>
        <sphereGeometry args={[emphasized ? 0.05 : 0.038, 20, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9 * opacity} />
      </mesh>
    </group>
  );
}

/** A labelled point on (or in) the sphere, e.g. an eigenstate. */
export function PointMarker({ v, color, label, size = 0.045, opacity = 1, ring = false }: { v: Vec3; color: string; label?: string; size?: number; opacity?: number; ring?: boolean }) {
  const n = toThree(v);
  return (
    <group>
      <mesh position={n}>
        <sphereGeometry args={[size, 20, 16]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {ring && (
        <Line points={circlePoints(normalize3(v), v, size * 2.2, 40)} color={color} lineWidth={1.5} transparent opacity={0.8 * opacity} />
      )}
      {label && <Label3D position={scale3(normalize3(v), len3(v) + 0.2)} tex={label} color={color} size={12.5} opacity={opacity} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Axis line (rotation axis, measurement axis)
// ---------------------------------------------------------------------------

export function AxisLine({
  n,
  color = COLORS.axis,
  length = 1.42,
  dashed = false,
  label,
  lineWidth = 2,
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
      <Line points={[a, b]} color={color} lineWidth={lineWidth} dashed={dashed} dashSize={0.06} gapSize={0.045} transparent opacity={opacity} />
      <mesh position={b} quaternion={quatFor(toThree(u))}>
        <coneGeometry args={[0.04, 0.11, 20]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {bothArrows && (
        <mesh position={a} quaternion={quatFor(toThree(scale3(u, -1)))}>
          <coneGeometry args={[0.04, 0.11, 20]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
      )}
      {label && <Label3D position={scale3(u, length + 0.16)} tex={label} color={color} size={12.5} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trails, orbits and arcs
// ---------------------------------------------------------------------------

/** Polyline through Bloch-space points; `fade` fades the oldest points out. */
export function Trail({ points, color = COLORS.state, lineWidth = 2, fade = true, opacity = 1, dashed = false }: { points: Vec3[]; color?: string; lineWidth?: number; fade?: boolean; opacity?: number; dashed?: boolean }) {
  const { pts, colors } = useMemo(() => {
    const pts = points.map((p) => toThree(p));
    const base = new THREE.Color(color);
    const bg = new THREE.Color(COLORS.bg);
    const colors = points.map((_, i) => {
      const f = fade ? 0.15 + 0.85 * (i / Math.max(1, points.length - 1)) : 1;
      return bg.clone().lerp(base, f);
    });
    return { pts, colors };
  }, [points, color, fade]);
  if (pts.length < 2) return null;
  return <Line points={pts} vertexColors={colors as unknown as [number, number, number][]} color="white" lineWidth={lineWidth} transparent={opacity < 1} opacity={opacity} dashed={dashed} dashSize={0.05} gapSize={0.04} />;
}

/** The full circle a point p sweeps out when rotated about axis n (precession cone rim). */
export function OrbitCircle({ n, through, color = COLORS.axis, opacity = 0.45, dashed = true, lineWidth = 1.2 }: { n: Vec3; through: Vec3; color?: string; opacity?: number; dashed?: boolean; lineWidth?: number }) {
  const pts = useMemo(() => {
    const u = normalize3(n);
    const center = scale3(u, dot3(through, u));
    const rho = len3(sub3(through, center));
    if (rho < 1e-4) return null;
    return circlePoints(u, center, rho);
  }, [n, through]);
  if (!pts) return null;
  return <Line points={pts} color={color} lineWidth={lineWidth} dashed={dashed} dashSize={0.05} gapSize={0.04} transparent opacity={opacity} />;
}

/** Arc traced by rotating `from` about n by `angle` (right-hand rule), with an arrowhead. */
export function RotationArc({ n, from, angle, color = COLORS.axis, label, lineWidth = 2.4 }: { n: Vec3; from: Vec3; angle: number; color?: string; label?: string; lineWidth?: number }) {
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
          <coneGeometry args={[0.035, 0.09, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
      {label && <Label3D position={scale3(normalize3(data.mid), 1.18)} tex={label} color={color} size={12.5} />}
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
    const R2 = 0.42;
    for (let k = 0; k <= 48; k++) {
      const p = (phi * k) / 48;
      phiArc.push(toThree([R2 * Math.cos(p), R2 * Math.sin(p), 0]));
    }
    const tl: Vec3 = [0.5 * Math.sin(theta / 2) * Math.cos(phi), 0.5 * Math.sin(theta / 2) * Math.sin(phi), 0.5 * Math.cos(theta / 2)];
    const pl: Vec3 = [0.56 * Math.cos(phi / 2), 0.56 * Math.sin(phi / 2), 0];
    return { theta, phi, rho, proj, thetaArc, phiArc, tl, pl };
  }, [v]);
  const hotT = highlight === 'theta';
  const hotP = highlight === 'phi';
  return (
    <group>
      {data.rho > 1e-3 && (
        <>
          <Line points={[toThree(v), toThree(data.proj)]} color={COLORS.faint} lineWidth={1} dashed dashSize={0.04} gapSize={0.03} />
          <Line points={[new THREE.Vector3(0, 0, 0), toThree(data.proj)]} color={hotP ? COLORS.phase : COLORS.faint} lineWidth={hotP ? 2 : 1} dashed dashSize={0.04} gapSize={0.03} />
        </>
      )}
      {data.theta > 1e-3 && (
        <>
          <Line points={data.thetaArc} color={COLORS.text} lineWidth={hotT ? 3 : 1.4} transparent opacity={hotT ? 1 : 0.7} />
          <Label3D position={data.tl} tex="\theta" color={hotT ? COLORS.text : COLORS.muted} size={hotT ? 15 : 12.5} />
        </>
      )}
      {data.rho > 1e-3 && data.phi > 1e-3 && (
        <>
          <Line points={data.phiArc} color={COLORS.phase} lineWidth={hotP ? 3 : 1.4} transparent opacity={hotP ? 1 : 0.75} />
          <Label3D position={data.pl} tex="\varphi" color={COLORS.phase} size={hotP ? 15 : 12.5} />
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
        <meshBasicMaterial color={color} transparent opacity={hover ? 0.2 : 0.06} depthWrite={false} />
      </mesh>
    </group>
  );
}

