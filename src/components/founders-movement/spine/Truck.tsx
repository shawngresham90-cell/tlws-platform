'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_LEN } from './consts';

/**
 * FM-2: the truck as a character.
 *
 * A procedural low-poly semi (no external assets) that drives AHEAD of the
 * camera for the entire page — the visitor never passes it; they follow it.
 * It is the guide, and the story ends when it finally gets where it has been
 * going all along:
 *
 *  - wheels roll with actual scroll distance; the cab breathes with a
 *    barely-there sway (≤2cm — restraint rule);
 *  - when the visitor STOPS scrolling, the truck brakes: taillights flare.
 *    Scroll again and they dim — the truck responds to you;
 *  - headlights throw a soft additive cone + ground pool, the only warmth
 *    in the scene until dawn;
 *  - at ~92% progress it signals, eases right, and pulls into the school
 *    lot as dawn breaks — the arrival the whole page has been driving toward.
 *
 * Everything is boxes, cylinders and sprites: ~20 draw calls, no textures
 * beyond two tiny canvas gradients, negligible cost on the 220KB budget.
 */

const AHEAD = 22; // meters the truck leads the camera by, until the arrival

function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,150,0.5)');
  grad.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function Truck() {
  const group = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Object3D[]>([]);
  const tailL = useRef<THREE.MeshBasicMaterial>(null);
  const tailR = useRef<THREE.MeshBasicMaterial>(null);
  const signal = useRef<THREE.MeshBasicMaterial>(null);
  const lastZ = useRef<number | null>(null);
  const speed = useRef(1); // smoothed |camera dz/dt|
  const poolTex = useMemo(() => poolTexture(), []);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const camZ = state.camera.position.z;
    const p = THREE.MathUtils.clamp(-camZ / (ROAD_LEN - 26), 0, 1);

    // Smoothed camera speed — drives wheels, sway, and the brake lights.
    if (lastZ.current === null) lastZ.current = camZ;
    const dz = Math.abs(camZ - lastZ.current);
    lastZ.current = camZ;
    const inst = dt > 0 ? dz / dt : 0;
    speed.current += (inst - speed.current) * Math.min(1, dt * 4);

    // The arrival: past 92%, ease right and let the camera close the gap.
    const arrive = THREE.MathUtils.clamp((p - 0.92) / 0.08, 0, 1);
    const targetX = 1.7 + arrive * 2.9;
    const ahead = AHEAD - arrive * 9;
    g.position.z = camZ - ahead;
    g.position.x += (targetX - g.position.x) * Math.min(1, dt * 2.5);

    // Breathing sway — capped tiny; zero when parked.
    const sway = (1 - arrive) * Math.min(1, speed.current / 8);
    g.position.y = Math.sin(state.clock.elapsedTime * 1.7) * 0.02 * sway;
    g.rotation.z = Math.sin(state.clock.elapsedTime * 1.3) * 0.004 * sway;
    g.rotation.y = arrive * -0.18; // gentle nose-right into the lot

    // Wheels roll with real distance.
    const roll = dz / 0.52;
    for (const w of wheels.current) w.rotation.x -= roll;

    // Brake lights: flare when the visitor stops, dim while rolling.
    const braking = THREE.MathUtils.clamp(1 - speed.current / 2.5, 0, 1);
    const tail = 0.35 + braking * 0.65;
    if (tailL.current) tailL.current.opacity = tail;
    if (tailR.current) tailR.current.opacity = tail;

    // Right turn signal blinks only during the arrival (soft, ~1.2Hz).
    if (signal.current) {
      const blink =
        arrive > 0 && arrive < 0.95 ? (Math.sin(state.clock.elapsedTime * 7.5) + 1) / 2 : 0;
      signal.current.opacity = 0.15 + blink * 0.85 * (arrive > 0 ? 1 : 0);
    }
  });

  const wheelRef = (node: THREE.Object3D | null) => {
    if (node && !wheels.current.includes(node)) wheels.current.push(node);
  };

  return (
    <group ref={group} position={[1.7, 0, -AHEAD]}>
      {/* Trailer (nearest the camera) */}
      <mesh position={[0, 1.95, 3.2]}>
        <boxGeometry args={[2.5, 2.8, 8.2]} />
        <meshStandardMaterial color="#161a20" roughness={0.85} />
      </mesh>
      {/* Signal-yellow brand stripe along the trailer */}
      <mesh position={[-1.26, 1.1, 3.2]}>
        <boxGeometry args={[0.02, 0.1, 7.8]} />
        <meshStandardMaterial color="#8a7d1a" roughness={0.6} />
      </mesh>
      {/* Cab */}
      <mesh position={[0, 1.55, -2.2]}>
        <boxGeometry args={[2.35, 2.5, 2.6]} />
        <meshStandardMaterial color="#12151b" roughness={0.7} />
      </mesh>
      {/* Hood */}
      <mesh position={[0, 0.95, -4.0]}>
        <boxGeometry args={[2.2, 1.3, 1.4]} />
        <meshStandardMaterial color="#12151b" roughness={0.7} />
      </mesh>
      {/* Exhaust stacks */}
      {[-1.05, 1.05].map((x) => (
        <mesh key={x} position={[x, 2.6, -1.0]}>
          <cylinderGeometry args={[0.07, 0.07, 1.5, 8]} />
          <meshStandardMaterial color="#3a4048" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* Wheels (axles simplified) */}
      {[
        [-4.35, 0],
        [-1.1, 0],
        [5.6, 0],
        [6.9, 0],
      ].map(([z]) =>
        [-1.15, 1.15].map((x) => (
          <mesh
            key={`${x}-${z}`}
            ref={wheelRef}
            position={[x, 0.52, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.52, 0.52, 0.4, 14]} />
            <meshStandardMaterial color="#07090c" roughness={0.9} />
          </mesh>
        )),
      )}
      {/* Headlights + beam cone + ground pool */}
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.85, -4.75]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color="#ffe9c4" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.8, -9.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[2.2, 9, 20, 1, true]} />
        <meshBasicMaterial
          color="#ffdca0"
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, 0.015, -8.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 8]} />
        <meshBasicMaterial
          map={poolTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Taillights — the truck talks back when you stop. */}
      <mesh position={[-1.05, 1.15, 7.32]}>
        <boxGeometry args={[0.28, 0.12, 0.03]} />
        <meshBasicMaterial
          ref={tailL}
          color="#ff2d20"
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[1.05, 1.15, 7.32]}>
        <boxGeometry args={[0.28, 0.12, 0.03]} />
        <meshBasicMaterial
          ref={tailR}
          color="#ff2d20"
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>
      {/* Right turn signal (arrival only) */}
      <mesh position={[1.22, 0.95, -4.7]}>
        <boxGeometry args={[0.1, 0.1, 0.03]} />
        <meshBasicMaterial
          ref={signal}
          color="#ffb020"
          transparent
          opacity={0.15}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
