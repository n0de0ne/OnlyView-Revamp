"use client";

/**
 * The view from the terrace, in the villa's own photographs: five shots of
 * the bay from afternoon to nightfall, dissolved into one another by the
 * hour (three.js through react-three-fiber). The highlights of the earlier
 * frame linger a beat longer than its shadows, so the sun seems to sink
 * rather than switch; the pointer shifts the picture a little, as if
 * leaning over the rail. Rendered only while on screen.
 */
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export interface Frame {
  url: string;
  hour: number;
}

/** which two frames the hour sits between, and how far across the dissolve */
export function blendFor(frames: Frame[], hour: number) {
  let i = 0;
  while (i < frames.length - 1 && hour >= frames[i + 1].hour) i++;
  const a = frames[i];
  const b = frames[Math.min(i + 1, frames.length - 1)];
  if (a === b) return { a: i, b: i, mix: 0 };
  // hold each frame, dissolve across the middle third of the gap
  const span = b.hour - a.hour;
  const mix = THREE.MathUtils.smoothstep((hour - a.hour) / span, 0.33, 0.67);
  return { a: i, b: i + 1, mix };
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform float uMix;
  uniform vec2 uCoverA;
  uniform vec2 uCoverB;
  uniform vec2 uParallax;
  uniform float uZoom;
  varying vec2 vUv;

  vec2 cover(vec2 uv, vec2 scale) {
    // scale < 1 on the axis that overflows: crop toward the centre
    vec2 c = (uv - 0.5) * scale + 0.5;
    // Ken Burns zoom and the pointer's small shift
    c = (c - 0.5) / uZoom + 0.5 + uParallax;
    return c;
  }

  void main() {
    vec4 a = texture2D(uA, cover(vUv, uCoverA));
    vec4 b = texture2D(uB, cover(vUv, uCoverB));
    float lumA = dot(a.rgb, vec3(0.299, 0.587, 0.114));
    // brighter parts of the earlier frame (the sun, its path) dissolve last
    float k = smoothstep(0.0, 1.0, (uMix - 0.5) * 1.6 + 0.5 - (lumA - 0.45) * 0.6);
    gl_FragColor = vec4(mix(a.rgb, b.rgb, k), 1.0);
  }
`;

function Picture({
  frames,
  hour,
  pointer,
}: {
  frames: Frame[];
  hour: number;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const textures = useLoader(THREE.TextureLoader, frames.map((f) => f.url));
  const { size } = useThree();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const shift = useRef(new THREE.Vector2());

  useEffect(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
    }
  }, [textures]);

  const uniforms = useMemo(
    () => ({
      uA: { value: textures[0] },
      uB: { value: textures[1] ?? textures[0] },
      uMix: { value: 0 },
      uCoverA: { value: new THREE.Vector2(1, 1) },
      uCoverB: { value: new THREE.Vector2(1, 1) },
      uParallax: { value: new THREE.Vector2() },
      uZoom: { value: 1 },
    }),
    // the textures are loaded once per frame set
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const coverScale = (t: THREE.Texture) => {
    const img = t.image as { width: number; height: number } | undefined;
    const ia = img && img.width && img.height ? img.width / img.height : 4 / 3;
    const ca = size.width / size.height;
    // the picture fills the canvas; the overflowing axis is cropped
    return ia > ca ? new THREE.Vector2(ca / ia, 1) : new THREE.Vector2(1, ia / ca);
  };

  useFrame(({ clock }, dt) => {
    const m = mat.current;
    if (!m) return;
    const { a, b, mix } = blendFor(frames, hour);
    m.uniforms.uA.value = textures[a];
    m.uniforms.uB.value = textures[b];
    m.uniforms.uMix.value = mix;
    m.uniforms.uCoverA.value.copy(coverScale(textures[a]));
    m.uniforms.uCoverB.value.copy(coverScale(textures[b]));
    // a slow breath of zoom, and the pointer eased in
    m.uniforms.uZoom.value = 1.04 + Math.sin(clock.getElapsedTime() * 0.12) * 0.02;
    const p = pointer.current;
    shift.current.lerp(new THREE.Vector2(p.x * 0.012, -p.y * 0.008), Math.min(1, dt * 3));
    m.uniforms.uParallax.value.copy(shift.current);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} depthTest={false} />
    </mesh>
  );
}

export default function GoldenHourScene({
  frames,
  hour,
  active,
  pointer,
}: {
  frames: Frame[];
  hour: number;
  active: boolean;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
      gl={{ antialias: false, powerPreference: "low-power", alpha: false }}
      className="!absolute inset-0"
    >
      <Picture frames={frames} hour={hour} pointer={pointer} />
    </Canvas>
  );
}
