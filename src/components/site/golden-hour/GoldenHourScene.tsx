"use client";

/**
 * A living photograph. The base is the villa's own shot of the bay from the
 * pool at golden hour; a fragment shader (three.js through react-three-fiber)
 * brings it to life on top of the real pixels, region by region, using the
 * hand-traced masks in /media/golden (R sky · G sea · B pool · A vegetation):
 *
 *  - the sea swells and the sun's path glitters on the water,
 *  - the pool ripples, and rings spread where the visitor touches it,
 *  - the clouds drift and the trees move in the breeze,
 *  - the hour sinks the sun behind the hills, turns the sky violet then
 *    navy, brings the stars out and lights the pool from below,
 *  - the pointer leans the picture in depth (sky far, pool near).
 *
 * Nothing synthetic is painted over the horizon: the hills, the vegetation
 * and the colours of the light are the photograph's own.
 */
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/** where the sun sits in the photograph, in texture uv (y up) */
const SUN = new THREE.Vector2(0.275, 0.536);
/** where the crop is centred when the canvas is wider or taller than the photo (uv, y up) */
export const ANCHOR = { x: 0.42, y: 0.42 };

export interface Tap {
  /** canvas position, 0–1, y up */
  x: number;
  y: number;
  /** filled in by the scene once placed */
  placed?: boolean;
}

export interface SceneControls {
  /** -1..1 pointer position over the block, for the depth lean */
  pointer: { x: number; y: number };
  /** touches on the water, consumed by the scene */
  taps: Tap[];
}

/** the phases of the evening for an hour of the day */
export function phases(hour: number) {
  const s = (a: number, b: number) => THREE.MathUtils.smoothstep(hour, a, b);
  return {
    sunk: s(17.75, 18.05), // the sun goes down behind the hills
    dusk: s(17.9, 18.55), // violet sky, orange band on the ridge
    night: s(18.45, 19.35), // navy sky, stars, the pool lit from below
  };
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
  uniform sampler2D uPhoto;
  uniform sampler2D uMask;
  uniform float uTime;
  uniform float uSunk;
  uniform float uDusk;
  uniform float uNight;
  uniform float uDim;
  uniform float uZoom;
  uniform vec2 uCover;
  uniform vec2 uAnchor;
  uniform vec2 uParallax;
  uniform vec2 uSun;
  uniform vec4 uRipples[4];
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    float t = uTime;
    // cover fit anchored a little below the middle (the pool matters), a slow breath of zoom
    vec2 uv = (vUv - 0.5) * uCover + uAnchor;
    uv = (uv - 0.5) / uZoom + 0.5;

    // depth lean: the sky barely moves, the pool moves most
    vec4 m0 = texture2D(uMask, uv);
    float sky0 = smoothstep(0.15, 0.55, m0.r);
    float other = clamp(1.0 - (sky0 + m0.g + m0.b + m0.a), 0.0, 1.0);
    float depth = 0.10 * sky0 + 0.28 * m0.g + 0.62 * m0.a + 0.92 * m0.b + other * mix(0.92, 0.14, smoothstep(0.36, 0.5, uv.y));
    uv += uParallax * (depth - 0.35);

    vec4 m = texture2D(uMask, uv);
    // skyG: everything that takes the sky's colour (the canopy included); sky: open sky only
    float skyG = smoothstep(0.15, 0.55, m.r);
    float sky = smoothstep(0.6, 0.95, m.r);
    float sea = m.g, pool = m.b, veg = m.a;
    float land = clamp(1.0 - (skyG + sea + pool + veg), 0.0, 1.0);

    // ---- motion: the clouds, the swell, the pool, the breeze
    vec2 d = vec2(0.0);
    float skyFar = sky * smoothstep(0.53, 0.64, uv.y);
    d += skyFar * ((vec2(noise(uv * 3.0 + t * 0.02), noise(uv * 3.0 + 7.0 - t * 0.017)) - 0.5) * 0.014 + vec2(sin(t * 0.05) * 0.004, 0.0));

    float near = clamp((0.49 - uv.y) / 0.08, 0.0, 1.0);
    float swell = sin(uv.x * 90.0 + t * 0.9 + noise(uv * 20.0) * 4.0) * 0.5 + sin(uv.x * 160.0 - t * 1.4 + uv.y * 400.0) * 0.5;
    d += sea * vec2(swell * 0.25, swell) * 0.0012 * (0.25 + near);

    vec2 pr = vec2(sin(uv.y * 70.0 + t * 1.6) + sin(uv.x * 48.0 - t * 1.1 + uv.y * 30.0), cos(uv.x * 55.0 + t * 1.35) + sin(uv.y * 90.0 - t * 0.9)) * 0.0017;
    float rings = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uRipples[i];
      if (r.w < 0.5) continue;
      float age = t - r.z;
      if (age < 0.0) continue;
      vec2 q = (uv - r.xy) * vec2(1.333, 1.0);
      float dist = length(q);
      float rad = age * 0.11;
      float ring = sin((dist - rad) * 110.0) * exp(-abs(dist - rad) * 40.0) * exp(-age * 0.8);
      pr += normalize(q + 1e-5) * ring * 0.012;
      rings += abs(ring);
    }
    // the water moves, the coping around it does not: fade at the pool's edges
    float water = pool * pool * smoothstep(0.338, 0.318, uv.y);
    d += water * pr;

    d += veg * vec2(sin(t * 1.1 + uv.y * 40.0 + uv.x * 12.0) * 0.0014, sin(t * 0.8 + uv.x * 50.0) * 0.0006) * (0.6 + 0.4 * sin(t * 0.3));

    vec3 c = texture2D(uPhoto, uv + d).rgb;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));

    // ---- the sun: sinks behind the hills as the hour passes
    vec2 sunNow = uSun + vec2(0.035, -0.075) * smoothstep(0.2, 1.0, uSunk);
    vec2 aspect = vec2(1.333, 1.0);
    float sd = length((uv - uSun) * aspect);
    // the photographed disc gives way to haze once the sun is down
    vec3 haze = texture2D(uPhoto, uSun + vec2(0.16, 0.02)).rgb;
    c = mix(c, haze * (0.9 + 0.2 * noise(uv * 40.0 + t * 0.1)), exp(-sd * sd * 350.0) * smoothstep(0.0, 0.6, uSunk));
    // and the moving sun takes over, hidden by the ridge (only the sky shows it)
    float sn = length((uv - sunNow) * aspect);
    float sunGlow = exp(-sn * sn * 1400.0) * 1.3 + exp(-sn * 9.0) * 0.32;
    c += sky * sunGlow * vec3(1.0, 0.82, 0.55) * smoothstep(0.0, 0.35, uSunk) * (1.0 - uNight);
    // the water below the sun keeps a warm path while it is up
    c += sea * exp(-sn * 6.0) * vec3(0.35, 0.2, 0.08) * smoothstep(0.0, 0.35, uSunk) * (1.0 - uDusk * 0.6);

    // ---- glitter on the sea, along the sun's path, and a general shimmer
    float sp = pow(noise(uv * vec2(420.0, 700.0) + vec2(t * 0.5, -t * 2.0)) * noise(uv * vec2(380.0, 650.0) - vec2(t * 0.7, t * 1.5)), 3.0) * 6.0;
    float column = exp(-pow((uv.x - sunNow.x) / (0.035 + near * 0.13), 2.0) * 2.0);
    c += sea * sp * (column * 0.9 * (1.0 - uSunk * 0.6) + 0.12) * vec3(1.0, 0.88, 0.65) * (1.0 - uNight * 0.92) * (0.5 + near);
    // the pool: highlights on the ripples
    c += water * rings * 0.5 * vec3(1.0, 0.95, 0.85) * (1.0 - uNight * 0.6);

    // ---- the evening: dusk
    float ridgeBand = exp(-max(uv.y - 0.50, 0.0) * 7.0);
    vec3 duskSky = mix(vec3(0.42, 0.30, 0.56), vec3(0.98, 0.56, 0.34), ridgeBand);
    vec3 duskSea = mix(vec3(0.30, 0.28, 0.42), vec3(0.78, 0.48, 0.38), ridgeBand * 0.7);
    vec3 g = c;
    g = mix(g, (lum * 0.7 + 0.28) * duskSky, skyG * uDusk * 0.85);
    g = mix(g, (lum * 0.9 + 0.16) * duskSea, sea * uDusk * 0.8);
    g = mix(g, c * vec3(0.55, 0.50, 0.62), (land + veg) * uDusk * 0.75);
    g = mix(g, (lum * 0.8 + 0.2) * duskSky * 0.9, pool * uDusk * 0.6);

    // ---- night
    vec3 nightSky = mix(vec3(0.05, 0.08, 0.20), vec3(0.15, 0.10, 0.24), ridgeBand);
    g = mix(g, (lum * 0.45 + 0.12) * nightSky * 1.6, skyG * uNight);
    g = mix(g, (lum * 0.5 + 0.05) * vec3(0.06, 0.09, 0.18), sea * uNight);
    g = mix(g, g * vec3(0.22, 0.24, 0.32), (land + veg) * uNight * 0.9);
    float caus = pow(noise(uv * vec2(110.0, 160.0) + t * 0.3) * noise(uv * vec2(85.0, 130.0) - t * 0.25) * 4.0, 1.4);
    caus = caus * 0.6 + noise(uv * vec2(30.0, 45.0) + t * 0.1) * 0.4;
    // lit from the far wall: bright teal there, deep water nearer, the reflections kept
    float wall = smoothstep(0.04, 0.335, uv.y);
    float poolLight = 0.18 + 0.82 * wall * wall;
    vec3 poolNight = (vec3(0.05, 0.50, 0.58) * (0.55 + caus * 0.45) + vec3(0.01, 0.10, 0.16)) * poolLight * (0.55 + lum * 0.9);
    g = mix(g, poolNight + rings * 0.35, pool * uNight * 0.9);
    // the terrace lights come on: a warm wash on the deck
    g += land * uNight * vec3(0.22, 0.15, 0.08) * smoothstep(0.5, 0.0, uv.y);

    // ---- stars, above the hills only
    vec2 sg = uv * vec2(260.0, 200.0);
    vec2 id = floor(sg);
    vec2 f = fract(sg) - 0.5;
    float h = hash(id);
    vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.7;
    float star = smoothstep(0.13, 0.0, length(f - off)) * step(0.935, h) * (0.55 + 0.45 * sin(t * (2.0 + h * 4.0) + h * 40.0));
    g += sky * star * uNight * uNight * smoothstep(0.55, 0.75, uv.y) * vec3(0.9, 0.95, 1.0);

    gl_FragColor = vec4(g * (1.0 - uDim), 1.0);
  }
`;

function Picture({
  photo,
  mask,
  hour,
  dim,
  controls,
}: {
  photo: string;
  mask: string;
  hour: number;
  dim: number;
  controls: React.MutableRefObject<SceneControls>;
}) {
  const [tex, maskTex] = useLoader(THREE.TextureLoader, [photo, mask]);
  const { size } = useThree();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const shift = useRef(new THREE.Vector2());
  const nextRipple = useRef(0);

  useEffect(() => {
    for (const t of [tex, maskTex]) {
      // the shader works in display space: no decoding, no re-encoding
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [tex, maskTex]);

  const uniforms = useMemo(
    () => ({
      uPhoto: { value: tex },
      uMask: { value: maskTex },
      uTime: { value: 0 },
      uSunk: { value: 0 },
      uDusk: { value: 0 },
      uNight: { value: 0 },
      uDim: { value: 0 },
      uZoom: { value: 1 },
      uCover: { value: new THREE.Vector2(1, 1) },
      uAnchor: { value: new THREE.Vector2(0.5, 0.5) },
      uParallax: { value: new THREE.Vector2() },
      uSun: { value: SUN.clone() },
      uRipples: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
    }),
    // the textures are loaded once per photo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame(({ clock }, dt) => {
    const m = mat.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    const u = m.uniforms;
    u.uTime.value = t;
    const p = phases(hour);
    u.uSunk.value = p.sunk;
    u.uDusk.value = p.dusk;
    u.uNight.value = p.night;
    u.uDim.value = dim;

    const img = tex.image as { width: number; height: number } | undefined;
    const ia = img && img.width && img.height ? img.width / img.height : 4 / 3;
    const ca = size.width / size.height;
    const cover: THREE.Vector2 = u.uCover.value;
    if (ia > ca) cover.set(ca / ia, 1);
    else cover.set(1, ia / ca);
    // the crop favours the sun and the pool: centred left of and below the middle
    const anchor: THREE.Vector2 = u.uAnchor.value;
    anchor.set(
      THREE.MathUtils.clamp(ANCHOR.x, cover.x / 2, 1 - cover.x / 2),
      THREE.MathUtils.clamp(ANCHOR.y, cover.y / 2, 1 - cover.y / 2)
    );
    const zoom = 1.04 + Math.sin(t * 0.11) * 0.018;
    u.uZoom.value = zoom;

    const c = controls.current;
    shift.current.lerp(new THREE.Vector2(c.pointer.x * 0.014, -c.pointer.y * 0.01), Math.min(1, dt * 3));
    u.uParallax.value.copy(shift.current);

    // touches on the water, placed in photo space
    for (const tap of c.taps) {
      if (tap.placed) continue;
      tap.placed = true;
      const ux = ((tap.x - 0.5) * cover.x + anchor.x - 0.5) / zoom + 0.5;
      const uy = ((tap.y - 0.5) * cover.y + anchor.y - 0.5) / zoom + 0.5;
      const slot: THREE.Vector4 = u.uRipples.value[nextRipple.current % 4];
      slot.set(ux, uy, t, 1);
      nextRipple.current++;
    }
    if (c.taps.length > 8) c.taps.splice(0, c.taps.length - 8);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={mat} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} depthTest={false} />
    </mesh>
  );
}

export default function GoldenHourScene({
  photo,
  mask,
  hour,
  dim,
  active,
  controls,
}: {
  photo: string;
  mask: string;
  hour: number;
  dim: number;
  active: boolean;
  controls: React.MutableRefObject<SceneControls>;
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
      <Picture photo={photo} mask={mask} hour={hour} dim={dim} controls={controls} />
    </Canvas>
  );
}
