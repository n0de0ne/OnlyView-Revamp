"use client";

/**
 * The view from the terrace, in WebGL: sky, sun and sea (three.js through
 * react-three-fiber and drei). `hour` runs the sun from mid-afternoon to
 * night — the sky reddens, the glitter path stretches across the water,
 * the stars come out. Rendered only while on screen, at a capped pixel
 * ratio; the page never depends on it.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** 15:00 → 20:00 mapped to sun elevation (deg) and colour temperature */
export function sunFor(hour: number) {
  const t = THREE.MathUtils.clamp((hour - 15) / 5, 0, 1);
  const elevation = THREE.MathUtils.lerp(38, -8, t); // sets around 18:45
  // theta from +z: 180° is straight ahead of the camera — the sun drifts in
  // from the left and sets in front of the terrace, its path on the water
  const azimuth = THREE.MathUtils.lerp(212, 174, t);
  return { elevation, azimuth, t };
}

const WATER_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  // three gentle swells crossing each other
  float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
    return sin(dot(p, dir) * freq + uTime * speed) * amp;
  }
  void main() {
    vUv = uv;
    vec3 pos = position;
    float h = wave(pos.xy, vec2(1.0, 0.3), 0.55, 0.9, 0.09)
            + wave(pos.xy, vec2(-0.6, 1.0), 0.9, 1.3, 0.05)
            + wave(pos.xy, vec2(0.2, -1.0), 1.7, 1.9, 0.02);
    pos.z += h;
    // finite-difference normal
    float e = 0.15;
    float hx = wave(pos.xy + vec2(e, 0.0), vec2(1.0, 0.3), 0.55, 0.9, 0.09)
             + wave(pos.xy + vec2(e, 0.0), vec2(-0.6, 1.0), 0.9, 1.3, 0.05)
             + wave(pos.xy + vec2(e, 0.0), vec2(0.2, -1.0), 1.7, 1.9, 0.02);
    float hy = wave(pos.xy + vec2(0.0, e), vec2(1.0, 0.3), 0.55, 0.9, 0.09)
             + wave(pos.xy + vec2(0.0, e), vec2(-0.6, 1.0), 0.9, 1.3, 0.05)
             + wave(pos.xy + vec2(0.0, e), vec2(0.2, -1.0), 1.7, 1.9, 0.02);
    vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
    vNormal = normalize(normalMatrix * n);
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunColor;
  uniform vec3 uHorizon;
  uniform float uNight;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal);
    // Fresnel: the sea mirrors the sky at grazing angles
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    vec3 base = mix(uDeep, uShallow, fresnel * 0.5);
    // the sun's glitter path: a broad specular lobe toward the sun
    vec3 h = normalize(uSunDir + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 140.0);
    float glitter = pow(max(dot(n, h), 0.0), 900.0) * 2.5;
    float sunUp = smoothstep(-0.02, 0.06, uSunDir.y);
    vec3 col = base * (0.55 + 0.45 * sunUp) + uSunColor * (spec * 0.9 + glitter) * sunUp;
    // dusk: a cooler, darker sea, faint moon-glow on the crests
    col = mix(col, uDeep * 0.35 + vec3(0.02, 0.03, 0.06) + spec * 0.15, uNight);
    // haze toward the horizon
    float dist = smoothstep(40.0, 300.0, length(vWorld.xz - cameraPosition.xz));
    vec3 haze = mix(uHorizon, vec3(0.04, 0.06, 0.1), uNight);
    col = mix(col, haze, dist * 0.65);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sea({ hour }: { hour: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uDeep: { value: new THREE.Color("#0b2f4c") },
      uShallow: { value: new THREE.Color("#3d7a94") },
      uSunColor: { value: new THREE.Color("#ffd9a0") },
      uHorizon: { value: new THREE.Color("#8fb6c9") },
      uNight: { value: 0 },
    }),
    []
  );
  useFrame((_, dt) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uTime.value += dt;
    const { elevation, azimuth, t } = sunFor(hour);
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    m.uniforms.uSunDir.value.setFromSphericalCoords(1, phi, theta);
    m.uniforms.uNight.value = THREE.MathUtils.smoothstep(t, 0.72, 0.98);
    // warmer light and a warmer sea as the sun drops
    m.uniforms.uSunColor.value.setHSL(THREE.MathUtils.lerp(0.12, 0.04, t), 0.95, THREE.MathUtils.lerp(0.8, 0.55, t));
    // the sea stays navy and only darkens; the far haze takes the sky's
    // colour — pale blue by day, rose-amber at dusk
    const dusk = THREE.MathUtils.smoothstep(t, 0.5, 0.85);
    m.uniforms.uShallow.value.setHSL(0.55, 0.42, THREE.MathUtils.lerp(0.42, 0.28, dusk));
    m.uniforms.uHorizon.value.setHSL(THREE.MathUtils.lerp(0.56, 0.05, dusk), THREE.MathUtils.lerp(0.35, 0.55, dusk), THREE.MathUtils.lerp(0.68, 0.5, dusk));
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[640, 640, 240, 240]} />
      <shaderMaterial ref={mat} vertexShader={WATER_VERT} fragmentShader={WATER_FRAG} uniforms={uniforms} />
    </mesh>
  );
}

function SkyDome({ hour }: { hour: number }) {
  const { elevation, azimuth, t } = sunFor(hour);
  const pos = useMemo(() => {
    const v = new THREE.Vector3();
    v.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
    return [v.x, v.y, v.z] as [number, number, number];
  }, [elevation, azimuth]);
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={pos}
        turbidity={THREE.MathUtils.lerp(1.2, 10, t)}
        rayleigh={THREE.MathUtils.lerp(3.4, 3.2, t)}
        mieCoefficient={THREE.MathUtils.lerp(0.0012, 0.012, t)}
        mieDirectionalG={0.8}
      />
      {t > 0.7 && <Stars radius={200} depth={40} count={t > 0.9 ? 3000 : 1200} factor={5} saturation={0} fade speed={0.6} />}
    </>
  );
}

function Rig() {
  // a slow drift, as if leaning on the terrace rail
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const s = clock.getElapsedTime();
    camera.position.x = Math.sin(s * 0.08) * 0.6;
    camera.position.y = 1.7 + Math.sin(s * 0.11) * 0.06;
    camera.lookAt(-6, 4.5, -80);
  });
  return null;
}

export default function GoldenHourScene({ hour, active }: { hour: number; active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 1.7, 8], fov: 50, near: 0.1, far: 2000 }}
      gl={{ antialias: true, powerPreference: "low-power", toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 0.42;
      }}
      className="!absolute inset-0"
    >
      <SkyDome hour={hour} />
      <Sea hour={hour} />
      <Rig />
    </Canvas>
  );
}
