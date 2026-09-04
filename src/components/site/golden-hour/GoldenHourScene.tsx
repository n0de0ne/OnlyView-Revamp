"use client";

/**
 * A living photograph. The base is the villa's own shot of the bay from the
 * pool at golden hour; a fragment shader (three.js through react-three-fiber)
 * brings it to life on top of the real pixels, region by region, using the
 * masks in /media/golden, derived from the photograph by scripts/golden-mask.mjs
 * (file a: R sky · G sea · B pool; file b: R vegetation):
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
  uniform sampler2D uMask;   // R sky · G sea · B pool
  uniform sampler2D uMaskB;  // R vegetation (no alpha anywhere: browsers premultiply it)
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

  // the pool's far edge, printed by scripts/golden-mask.mjs (texture space, y up):
  // the water line under the tiled wall, and the underside of the coping above it
  const float POOL_TOP = 0.3206;
  const float COPING = 0.3522;

  // no sin() in the hash: on Apple GPUs it collapses into blocks at large arguments
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
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
    float veg0 = texture2D(uMaskB, uv).r;
    float sky0 = smoothstep(0.15, 0.55, m0.r);
    float other = clamp(1.0 - (sky0 + m0.g + m0.b + veg0), 0.0, 1.0);
    float depth = 0.10 * sky0 + 0.28 * m0.g + 0.62 * veg0 + 0.92 * m0.b + other * mix(0.92, 0.14, smoothstep(0.36, 0.5, uv.y));
    uv += uParallax * (depth - 0.35);

    vec4 m = texture2D(uMask, uv);
    // skyG: everything that takes the sky's colour (the canopy included); sky: open sky only
    float skyG = smoothstep(0.15, 0.55, m.r);
    float sky = smoothstep(0.6, 0.95, m.r);
    float sea = m.g, pool = m.b;
    float veg = texture2D(uMaskB, uv).r;
    float land = clamp(1.0 - (skyG + sea + pool + veg), 0.0, 1.0);
    // the hills across the bay: the land above the terrace
    float hills = land * smoothstep(0.42, 0.47, uv.y);

    // ---- motion: the clouds, the swell, the pool, the breeze. Each region's
    // displacement is dropped where it would sample across that region's edge,
    // so a hill never wobbles and the coping never bulges into the water.
    float skyFar = sky * smoothstep(0.60, 0.72, uv.y); // well above the highest ridge
    vec2 dS = skyFar * ((vec2(noise(uv * 3.0 + t * 0.02), noise(uv * 3.0 + 7.0 - t * 0.017)) - 0.5) * 0.014 + vec2(sin(t * 0.05) * 0.004, 0.0));
    dS *= smoothstep(0.5, 0.9, texture2D(uMask, uv + dS).r);

    float near = clamp((0.49 - uv.y) / 0.08, 0.0, 1.0);
    float swell = sin(uv.x * 90.0 + t * 0.9 + noise(uv * 20.0) * 4.0) * 0.5 + sin(uv.x * 160.0 - t * 1.4 + uv.y * 400.0) * 0.5;
    vec2 dW = sea * vec2(swell * 0.25, swell) * 0.0012 * (0.25 + near);
    dW *= texture2D(uMask, uv + dW).g;

    vec2 pr = vec2(sin(uv.y * 70.0 + t * 1.6) + sin(uv.x * 48.0 - t * 1.1 + uv.y * 30.0), cos(uv.x * 55.0 + t * 1.35) + sin(uv.y * 90.0 - t * 0.9)) * 0.0017;
    // a touch on the water: a drop. Three dispersive rings (the short waves run
    // ahead), fading as they spread; signed, so the crests catch the light and
    // the troughs go dark; and a small splash at the first instant.
    float rings = 0.0;
    float splash = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uRipples[i];
      if (r.w < 0.5) continue;
      float age = t - r.z;
      if (age < 0.0) continue;
      vec2 q = (uv - r.xy) * vec2(1.333, 1.0);
      float dist = length(q);
      // at this scale a hand's splash makes rings a centimetre or two apart that
      // travel a few decimetres a second: fine, slow, and gone in a few seconds
      float wave = 0.0;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float rad = 0.004 + age * (0.036 - fk * 0.007);
        float env = exp(-pow((dist - rad) * 120.0, 2.0));
        wave += sin((dist - rad) * (520.0 + fk * 190.0)) * env * (1.0 - fk * 0.3);
      }
      wave *= exp(-age * 0.35) / (1.0 + dist * 25.0);
      pr += normalize(q + 1e-5) * wave * 0.006;
      rings += wave;
      splash += exp(-dist * dist * 20000.0) * exp(-age * 5.0);
    }
    // the water moves, the coping around it does not; the surface settles toward
    // the right-hand edge (a straight line in the photograph) so the coping's
    // reflection never scallops
    float edgeX = 0.5565 + (0.3333 - uv.y) * 0.3844; // printed by scripts/golden-mask.mjs
    float edgeIn = smoothstep(0.0, 0.035, edgeX - uv.x);
    float water = pool * smoothstep(POOL_TOP + 0.003, POOL_TOP - 0.012, uv.y) * edgeIn;
    vec2 dP = water * pr;
    dP *= texture2D(uMask, uv + dP).b;

    vec2 dV = veg * vec2(sin(t * 1.1 + uv.y * 40.0 + uv.x * 12.0) * 0.0014, sin(t * 0.8 + uv.x * 50.0) * 0.0006) * (0.6 + 0.4 * sin(t * 0.3));
    dV *= texture2D(uMaskB, uv + dV).r;

    vec2 d = dS + dW + dP + dV;
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
    c += water * (rings * 0.4 + splash * 0.5) * vec3(1.0, 0.95, 0.85) * (1.0 - uNight * 0.6);

    // ---- the evening. Each region has its own dusk and night colour; they are
    // blended by the masks first and applied once, so a soft edge between two
    // regions becomes the average of two dark colours and never a pale rim.
    float ridgeBand = exp(-max(uv.y - 0.50, 0.0) * 7.0);
    float wsum = max(skyG + sea + pool + veg + land, 1e-3);
    float deck = max(land - hills, 0.0);

    // dusk: violet sky, an orange band on the ridge, the hills in silhouette
    vec3 duskSky = mix(vec3(0.42, 0.30, 0.56), vec3(0.98, 0.56, 0.34), ridgeBand);
    vec3 duskSea = mix(vec3(0.30, 0.28, 0.42), vec3(0.78, 0.48, 0.38), ridgeBand * 0.7);
    vec3 dSky = mix(c, (lum * 0.5 + 0.42) * duskSky, 0.85);
    vec3 dSea = mix(c, (lum * 0.9 + 0.16) * duskSea, 0.8);
    vec3 dLand = mix(c, c * vec3(0.55, 0.50, 0.62), 0.75);
    vec3 dHills = mix(dLand, dLand * vec3(0.40, 0.36, 0.48), 0.7);
    vec3 dPool = mix(c, (lum * 0.8 + 0.2) * duskSky * 0.9, 0.6);
    vec3 duskTarget = (skyG * dSky + sea * dSea + pool * dPool + veg * dLand + deck * dLand + hills * dHills) / wsum;
    vec3 g = mix(c, duskTarget, uDusk);

    // night: navy sky, the sea flat and dark (the sun's path is gone), foliage and
    // hills near black, the terrace lights on the deck, the pool lit from below
    vec3 nightSky = mix(vec3(0.05, 0.08, 0.20), vec3(0.15, 0.10, 0.24), ridgeBand);
    // a flat night sky: the haze rim the camera saw above the ridge must not glow
    vec3 nSky = (lum * 0.22 + 0.24) * nightSky * 1.6;
    // the night sea: flat and dark, with the lights of the far shore drawn out into
    // streaks by the swell, and the faintest shimmer
    vec3 nSea = (lum * 0.22 + 0.07) * vec3(0.07, 0.10, 0.20);
    // the village across the bay: scattered dim lights up the slope, a few of them
    // brighter, each with a short broken reflection on the water below
    float shoreY = mix(0.479, 0.489, smoothstep(0.15, 0.4, uv.x));
    float townDot = 0.0;
    float streak = 0.0;
    for (int k = 0; k < 2; k++) {
      float cells = 210.0 + float(k) * 130.0;
      float cellX = floor(uv.x * cells);
      float h1 = hash(vec2(cellX, 3.7 + float(k)));
      float on = step(0.93 - float(k) * 0.03, h1) * smoothstep(0.78, 0.7, uv.x) * smoothstep(0.86, 0.9, h1 + hash(vec2(cellX, 5.5)) * 0.4);
      float bright = 0.25 + 0.75 * pow(hash(vec2(cellX, 9.1 + float(k))), 3.0);
      float lift = hash(vec2(cellX, 12.3 + float(k))) * 0.032; // how far up the slope the house sits
      float cx = fract(uv.x * cells) - 0.5;
      // a round point: the same width in x (cell units) as in y (texture units)
      townDot += on * bright * exp(-cx * cx * 5.0) * exp(-pow((uv.y - shoreY - lift) * 420.0, 2.0));
      streak += on * bright * exp(-cx * cx * 14.0) * smoothstep(shoreY + 0.004, shoreY - 0.01, uv.y) * exp(-(shoreY - uv.y) * 40.0)
        * (0.3 + 0.7 * noise(vec2(uv.x * 500.0, uv.y * 90.0 - t * 0.5)));
    }
    nSea += vec3(0.95, 0.72, 0.45) * streak * 0.18;
    nSea += sp * 0.02 * vec3(0.7, 0.8, 1.0);
    vec3 nLand = mix(g, g * vec3(0.22, 0.24, 0.32), 0.9) + vec3(0.22, 0.15, 0.08) * smoothstep(0.5, 0.0, uv.y);
    vec3 nHills = nLand * 0.3;
    vec3 nVeg = nLand * 0.4;
    // the pool at night is the photograph's own water surface, re-lit: what reflected
    // the sky turns light turquoise, the ripples stay deep teal, the far wall is
    // brighter where the lights are, and a faint caustic shimmer moves underneath
    float wall = smoothstep(0.04, POOL_TOP, uv.y);
    // the surface keeps the photograph's own soft gradients (linear, never posterised);
    // the water line by the coping stays dark
    float structure = clamp((lum - 0.08) * 1.05, 0.0, 1.0) * mix(0.35, 1.0, edgeIn);
    // the water lit from below: turquoise where the light scatters up through the
    // ripples, deeper teal in the troughs, deeper still away from the lights
    vec3 surface = mix(vec3(0.01, 0.12, 0.19), vec3(0.14, 0.58, 0.64), structure * (0.4 + 0.6 * wall));
    // fine ripple texture moving over it, faint
    float caus = noise(uv * vec2(170.0, 260.0) + t * 0.3) * noise(uv * vec2(140.0, 220.0) - t * 0.25);
    surface += vec3(0.05, 0.2, 0.22) * (caus - 0.25) * 0.35;
    // the underwater lights along the far wall and their halo in the water
    float lights = 0.0;
    for (int i = 0; i < 3; i++) {
      vec2 q = (uv - vec2(0.10 + float(i) * 0.2, POOL_TOP - 0.004)) * vec2(1.333, 2.2);
      lights += exp(-dot(q, q) * 90.0);
    }
    surface += vec3(0.25, 0.65, 0.62) * lights * 0.5;
    vec3 nPool = surface + rings * 0.25 + splash * 0.4;
    vec3 nightTarget = (skyG * nSky + sea * nSea + pool * nPool + veg * nVeg + deck * nLand + hills * nHills) / wsum;
    g = mix(g, nightTarget, uNight);
    // the tiled wall above the water line is lit from the pool below
    float wallBand = smoothstep(POOL_TOP - 0.004, POOL_TOP + 0.004, uv.y) * smoothstep(COPING + 0.002, COPING - 0.006, uv.y) * step(uv.x, edgeX);
    g += wallBand * uNight * vec3(0.05, 0.32, 0.36) * (0.45 + lum * 0.8);
    // the lights of the village come on, on the hillside only
    g += townDot * hills * uNight * uNight * vec3(1.0, 0.82, 0.55) * 0.8;

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
  maskB,
  hour,
  dim,
  controls,
  onReady,
}: {
  photo: string;
  mask: string;
  maskB: string;
  hour: number;
  dim: number;
  controls: React.MutableRefObject<SceneControls>;
  onReady?: () => void;
}) {
  const [tex, maskTex, maskTexB] = useLoader(THREE.TextureLoader, [photo, mask, maskB]);
  const { size } = useThree();
  const mat = useRef<THREE.ShaderMaterial>(null);
  const shift = useRef(new THREE.Vector2());
  const nextRipple = useRef(0);
  const ready = useRef(false);

  useEffect(() => {
    // the masks were traced on a 4:3 frame; any other shape means the wrong file was served
    const img = tex.image as { width: number; height: number } | undefined;
    if (img && Math.abs(img.width / img.height - 4 / 3) > 0.01) {
      console.warn(`golden hour: frame is ${img.width}×${img.height}, the masks expect 4:3 — contours will not line up`);
    }
    for (const t of [tex, maskTex, maskTexB]) {
      // the shader works in display space: no decoding, no re-encoding
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [tex, maskTex, maskTexB]);

  const uniforms = useMemo(
    () => ({
      uPhoto: { value: tex },
      uMask: { value: maskTex },
      uMaskB: { value: maskTexB },
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
    // no zoom: the scene stays pixel-aligned with the still under it
    const zoom = 1;
    u.uZoom.value = zoom;
    if (!ready.current) {
      ready.current = true;
      onReady?.();
    }

    const c = controls.current;
    // a small lean: enough to feel the depth, not enough to tear the contours
    shift.current.lerp(new THREE.Vector2(c.pointer.x * 0.009, -c.pointer.y * 0.006), Math.min(1, dt * 3));
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
  maskB,
  hour,
  dim,
  active,
  controls,
  onReady,
}: {
  photo: string;
  mask: string;
  maskB: string;
  hour: number;
  dim: number;
  active: boolean;
  controls: React.MutableRefObject<SceneControls>;
  /** called once the first frame has been drawn: the still under the canvas can go */
  onReady?: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={active ? "always" : "never"}
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
      gl={{ antialias: false, powerPreference: "low-power", alpha: false, premultipliedAlpha: false }}
      className="!absolute inset-0"
      style={{ background: "#0b1220" }}
    >
      <Picture photo={photo} mask={mask} maskB={maskB} hour={hour} dim={dim} controls={controls} onReady={onReady} />
    </Canvas>
  );
}
