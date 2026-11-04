import { Canvas } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { ReactNode, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec3 } from '../../quantum';
import { COLORS } from '../../theme';
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

const FRESNEL_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRESNEL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uBase;
uniform float uRim;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  gl_FragColor = vec4(uColor, uBase + uRim * pow(f, 2.4));
}`;

function SphereShell() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FRESNEL_VERT,
        fragmentShader: FRESNEL_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color('#8fb6ff') },
          uBase: { value: 0.025 },
          uRim: { value: 0.32 },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[1, 64, 48]} />
    </mesh>
  );
}

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

function GridCircles() {
  const equator = useMemo(() => circlePoints([0, 0, 1], [0, 0, 0], 1), []);
  const merXZ = useMemo(() => circlePoints([0, 1, 0], [0, 0, 0], 1), []);
  const merYZ = useMemo(() => circlePoints([1, 0, 0], [0, 0, 0], 1), []);
  const lat = useMemo(
    () => [Math.PI / 6, Math.PI / 3, (2 * Math.PI) / 3, (5 * Math.PI) / 6].map((t) => circlePoints([0, 0, 1], [0, 0, Math.cos(t)], Math.sin(t), 72)),
    [],
  );
  return (
    <group>
      <Line points={equator} color={COLORS.gridStrong} lineWidth={1.4} />
      <Line points={merXZ} color={COLORS.grid} lineWidth={1} />
      <Line points={merYZ} color={COLORS.grid} lineWidth={1} />
      {lat.map((p, i) => (
        <Line key={i} points={p} color={COLORS.grid} lineWidth={0.8} transparent opacity={0.55} />
      ))}
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
  return (
    <Html position={tv(position)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className={`whitespace-nowrap select-none ${className}`}
        style={{ color, fontSize: size, opacity, textShadow: '0 0 6px #0b0d12, 0 0 2px #0b0d12' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Html>
  );
}

function Axes({ labels }: { labels: 'kets' | 'xyz' | 'both' | 'none' }) {
  const { active } = useHighlight();
  const L = 1.32;
  const axes: { v: Vec3; key: 'x' | 'y' | 'z'; plus: string; minus: string }[] = [
    { v: [1, 0, 0], key: 'x', plus: '|{+}\\rangle', minus: '|{-}\\rangle' },
    { v: [0, 1, 0], key: 'y', plus: '|{+i}\\rangle', minus: '|{-i}\\rangle' },
    { v: [0, 0, 1], key: 'z', plus: '|0\\rangle', minus: '|1\\rangle' },
  ];
  return (
    <group>
      {axes.map((a) => {
        const hot = active === a.key;
        const col = hot ? COLORS[a.key] : COLORS.faint;
        const p: Vec3 = [a.v[0] * L, a.v[1] * L, a.v[2] * L];
        const m: Vec3 = [-a.v[0] * L, -a.v[1] * L, -a.v[2] * L];
        return (
          <group key={a.key}>
            <Line points={[toThree(m), toThree(p)]} color={col} lineWidth={hot ? 2 : 1} transparent opacity={hot ? 1 : 0.8} />
            <mesh position={tv(a.v, L)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toThree(a.v))}>
              <coneGeometry args={[0.025, 0.08, 16]} />
              <meshBasicMaterial color={col} />
            </mesh>
            {(labels === 'kets' || labels === 'both') && (
              <>
                <Label3D position={[a.v[0] * 1.46, a.v[1] * 1.46, a.v[2] * 1.46]} tex={a.plus} color={hot ? COLORS.text : COLORS.muted} />
                <Label3D position={[-a.v[0] * 1.45, -a.v[1] * 1.45, -a.v[2] * 1.45]} tex={a.minus} color={COLORS.faint} size={12} />
              </>
            )}
            {(labels === 'xyz' || labels === 'both') && (
              <Label3D
                position={labels === 'both' ? [a.v[0] * 1.32 + (a.key === 'z' ? 0.12 : 0), a.v[1] * 1.32 + (a.key === 'x' ? -0.1 : 0), a.v[2] * 1.32 + (a.key === 'z' ? 0 : 0.09)] : [a.v[0] * 1.45, a.v[1] * 1.45, a.v[2] * 1.45]}
                tex={a.key}
                color={COLORS[a.key]}
                size={12}
                className="italic"
              />
            )}
          </group>
        );
      })}
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
 * The shared 3D Bloch sphere: glassy sphere, grid circles, axes with basis-state labels and
 * orbit controls. Compose state arrows, axes, trails etc. as children (see ./primitives).
 */
export function BlochCanvas({ children, className = '', height = '100%', labels = 'both', overlay, zoom = 1, interactive = true }: BlochCanvasProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const cam = useMemo(() => new THREE.Vector3(1.6, 1.3, 4.3).multiplyScalar(zoom), [zoom]);
  return (
    <div className={`relative h-full w-full ${className}`} style={{ height }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: cam, fov: 38, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ touchAction: 'none' }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        <directionalLight position={[-4, -2, -3]} intensity={0.35} />
        <Suspense fallback={null}>
          <SphereShell />
          <GridCircles />
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
          className="absolute bottom-2 right-2 rounded-md bg-ink-800/80 px-2 py-1 text-[11px] text-ink-300 ring-1 ring-inset ring-ink-600 backdrop-blur hover:text-ink-100"
          title="Reset camera"
        >
          reset view
        </button>
      )}
    </div>
  );
}
