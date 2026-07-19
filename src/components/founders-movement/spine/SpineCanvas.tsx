'use client';

import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * FM-1 "spine": the continuous drive rendered behind the whole story.
 *
 * One world, one camera, no cuts — the camera dollies down a pre-dawn
 * interstate as the visitor scrolls the page. Mile markers count the real
 * years (2009 → 2026), then keep counting into the future (2036 → 2076)
 * past the school. Dawn is *withheld* until ~85% scroll: the sky, sun and
 * school sign all warm together as the visitor reaches the school chapter —
 * the page's single lighting payoff.
 *
 * Scroll drive: progress = document scroll fraction, read per-frame from the
 * DOM (no React state per frame) and followed with critical damping — native
 * scrolling is never hijacked.
 *
 * Performance: no shadows, no postprocessing, instanced dashes, canvas-texture
 * signs, fog-culled draw distance. DPR starts at min(devicePixelRatio, 2) and
 * steps down once if a rolling FPS sample dips below ~34.
 *
 * This chunk is loaded lazily by ExperienceShell only on capable devices and
 * never under prefers-reduced-motion (see the shell for the ladder).
 */

const ROAD_LEN = 420;
const YEARS = [2009, 2012, 2015, 2018, 2021, 2024, 2026, 2036, 2056, 2076];

/** Pre-dawn → dawn color stops (sky, fog share them). */
const SKY_STOPS: [number, string][] = [
  [0.0, '#0a0f16'],
  [0.55, '#131c26'],
  [0.8, '#1d2430'],
  [0.9, '#4a341f'],
  [1.0, '#8a4f1d'],
];

function skyColor(p: number, out: THREE.Color): THREE.Color {
  const stops = SKY_STOPS;
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (p - p0) / (p1 - p0);
      return out.set(c0).lerp(new THREE.Color(c1), THREE.MathUtils.clamp(t, 0, 1));
    }
  }
  return out.set(stops[stops.length - 1][1]);
}

function yearSignTexture(year: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0f2418';
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 3;
  g.strokeRect(4, 4, 120, 56);
  g.fillStyle = '#f2efe6';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(year), 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,190,110,0.9)');
  grad.addColorStop(0.4, 'rgba(255,150,60,0.35)');
  grad.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function Dashes() {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  const count = Math.floor((ROAD_LEN + 60) / 6);
  const matrices = useMemo(() => {
    const m = new THREE.Matrix4();
    const arr: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      arr.push(m.clone().setPosition(0, 0.012, -i * 6));
    }
    return arr;
  }, [count]);
  return (
    <instancedMesh
      ref={(node) => {
        if (node && ref.current !== node) {
          matrices.forEach((m, i) => node.setMatrixAt(i, m));
          node.instanceMatrix.needsUpdate = true;
        }
        ref.current = node;
      }}
      args={[undefined, undefined, count]}
    >
      <boxGeometry args={[0.18, 0.02, 2.4]} />
      <meshBasicMaterial color="#cbb98f" />
    </instancedMesh>
  );
}

function MileMarkers() {
  const items = useMemo(
    () =>
      YEARS.map((year, i) => ({
        year,
        z: -28 - (i * (ROAD_LEN - 40)) / (YEARS.length - 1),
        tex: yearSignTexture(year),
      })),
    [],
  );
  return (
    <>
      {items.map(({ year, z, tex }) => (
        <group key={year} position={[5.4, 0, z]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.07, 1.8, 0.07]} />
            <meshStandardMaterial color="#3a4048" />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <planeGeometry args={[1.15, 0.58]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function School({ litRef }: { litRef: React.MutableRefObject<number> }) {
  const signMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (signMat.current) signMat.current.opacity = 0.08 + litRef.current * 0.92;
  });
  return (
    <group position={[-11, 0, -(ROAD_LEN + 4)]}>
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[14, 3.2, 8]} />
        <meshStandardMaterial color="#0b0d10" />
      </mesh>
      <mesh position={[5.5, 3.9, 0]}>
        <boxGeometry args={[3, 1.4, 3]} />
        <meshStandardMaterial color="#0b0d10" />
      </mesh>
      {/* Sign strip that lights as dawn breaks. */}
      <mesh position={[0, 3.4, 4.05]}>
        <planeGeometry args={[9, 0.6]} />
        <meshBasicMaterial ref={signMat} color="#ffeb00" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function World() {
  const { scene, camera, setDpr } = useThree();
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const litRef = useRef(0);
  const skyTmp = useMemo(() => new THREE.Color(), []);
  const glowTex = useMemo(() => glowTexture(), []);
  const fps = useRef({ t: 0, n: 0, degraded: false });

  useFrame((state, dt) => {
    // Scroll progress straight from the document — single source of truth.
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const target = THREE.MathUtils.clamp(window.scrollY / max, 0, 1);

    // Critically-damped camera follow along the road.
    const targetZ = -target * (ROAD_LEN - 26);
    const k = 1 - Math.exp(-3 * Math.min(dt, 0.1));
    camera.position.z += (targetZ - camera.position.z) * k;
    camera.position.x += (0 - camera.position.x) * k;
    camera.position.y += (3.1 - camera.position.y) * k;
    camera.lookAt(0, 1.2, camera.position.z - 34);

    // Dawn timeline (withheld until ~0.8 of the page).
    const p = THREE.MathUtils.clamp(-camera.position.z / (ROAD_LEN - 26), 0, 1);
    const dawn = THREE.MathUtils.clamp((p - 0.78) / 0.22, 0, 1);
    litRef.current = dawn;
    skyColor(p, skyTmp);
    scene.background = skyTmp;
    if (scene.fog instanceof THREE.FogExp2) scene.fog.color.copy(skyTmp);
    if (ambRef.current) {
      ambRef.current.intensity = 0.28 + dawn * 0.5;
      ambRef.current.color.setHSL(0.58 - dawn * 0.5, 0.35, 0.6 + dawn * 0.1);
    }
    if (dirRef.current) dirRef.current.intensity = dawn * 1.25;
    if (sunRef.current) {
      sunRef.current.position.y = -9 + dawn * 17;
      (sunRef.current.material as THREE.MeshBasicMaterial).opacity = dawn;
    }
    if (glowRef.current) {
      glowRef.current.position.y = -6 + dawn * 16;
      (glowRef.current.material as THREE.SpriteMaterial).opacity = dawn * 0.9;
    }

    // One-shot adaptive DPR: sample fps over ~1.5s windows, step down once.
    const f = fps.current;
    f.t += dt;
    f.n += 1;
    if (f.t >= 1.5) {
      const avg = f.n / f.t;
      if (!f.degraded && avg < 34) {
        f.degraded = true;
        setDpr(1);
      }
      f.t = 0;
      f.n = 0;
    }
  });

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.3} />
      <directionalLight ref={dirRef} position={[-30, 24, -(ROAD_LEN + 40)]} intensity={0} />
      <fogExp2 attach="fog" args={['#0a0f16', 0.0105]} />

      {/* Road bed + shoulders */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -(ROAD_LEN / 2)]}>
        <planeGeometry args={[9.5, ROAD_LEN + 120]} />
        <meshStandardMaterial color="#14181d" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -(ROAD_LEN / 2)]}>
        <planeGeometry args={[80, ROAD_LEN + 160]} />
        <meshStandardMaterial color="#0d1116" />
      </mesh>
      {[-4.45, 4.45].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.008, -(ROAD_LEN / 2)]}>
          <planeGeometry args={[0.14, ROAD_LEN + 120]} />
          <meshBasicMaterial color="#5a6068" />
        </mesh>
      ))}
      <Dashes />
      <MileMarkers />
      <School litRef={litRef} />

      {/* The sun — below the horizon until the school chapter. */}
      <mesh ref={sunRef} position={[6, -9, -(ROAD_LEN + 70)]}>
        <circleGeometry args={[7, 40]} />
        <meshBasicMaterial color="#ffb35c" transparent opacity={0} toneMapped={false} />
      </mesh>
      <sprite ref={glowRef} position={[6, -6, -(ROAD_LEN + 66)]} scale={[46, 46, 1]}>
        <spriteMaterial
          map={glowTex}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </>
  );
}

export default function SpineCanvas({ onFail }: { onFail: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        dpr={[1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
        gl={{ antialias: true, powerPreference: 'low-power' }}
        camera={{ fov: 60, near: 0.1, far: 400, position: [0, 3.1, 0] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            setFailed(true);
            onFail();
          });
        }}
      >
        <World />
      </Canvas>
    </div>
  );
}
