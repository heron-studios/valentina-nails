'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, Wand2, Gem } from 'lucide-react';

export type LiquidGlassHeroProps = {
  startingPrice: number;
  formatMoney: (val: number) => string;
  onExplore: () => void;
};

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform vec2 u_pointer;
  uniform float u_intensity;
  varying vec2 v_uv;

  // Hash & Noise for fluid caustics
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 uv = v_uv;

    // 1. Fluid liquid-glass coordinate distortion (domain warping)
    float t = u_time * 0.25;
    vec2 p = uv * 3.2;
    vec2 q = vec2(fbm(p + t * 0.4), fbm(p + vec2(5.2, 1.3) - t * 0.3));
    vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.35),
                  fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.25));
    float caustic = fbm(p + 3.5 * r);

    // 2. Interactive ripples from touch/mouse pointer
    vec2 pVec = (uv - u_pointer) * aspect;
    float dist = length(pVec);
    float wave = sin(dist * 32.0 - u_time * 7.0) * exp(-dist * 5.5) * u_intensity;
    vec2 waveDisp = (dist > 0.001 ? normalize(pVec) : vec2(0.0)) * wave * 0.08;

    // 3. Apple-style Liquid Glass base gradients: Rose blush, crystal champagne, molten nacre
    vec3 baseGlass = mix(
      vec3(0.99, 0.97, 0.95), // ultra-clear liquid glass
      vec3(0.97, 0.92, 0.89), // soft blush milk glass
      uv.y * 0.8 + caustic * 0.2
    );

    // Aurora pool highlights in glass
    vec3 goldCaustic = vec3(0.92, 0.76, 0.48);  // 18k Champagne gold
    vec3 blushGlow   = vec3(0.95, 0.80, 0.85);  // Delicate rose quartz
    vec3 crystalPure = vec3(1.00, 1.00, 1.00);  // Diamond specular reflection

    // Chromatic refraction (Prismatic dispersion through thick curved glass)
    float dispR = fbm(p + 3.5 * r + waveDisp * 1.08);
    float dispG = fbm(p + 3.5 * r + waveDisp * 1.00);
    float dispB = fbm(p + 3.5 * r + waveDisp * 0.92);

    // Sharp glass caustic light ridges (simulating sunlight passing through liquid glass)
    float causticEdge = pow(1.0 - abs(dispG * 2.0 - 1.0), 3.5) * 0.85;
    float causticGold = pow(dispR, 4.0) * 0.65;
    float causticRose = pow(dispB, 3.2) * 0.45;

    // Specular highlight on wave ripples
    float specRipple = pow(max(0.0, wave * 1.8), 2.8) * u_intensity * 0.9;

    // Final color composition
    vec3 color = baseGlass;
    color = mix(color, blushGlow, causticRose * 0.7);
    color = mix(color, goldCaustic, causticGold * 0.8);
    color += crystalPure * (causticEdge * 0.4 + specRipple);

    // Soft glass vignette rim
    float rim = length((uv - 0.5) * 1.8);
    color = mix(color, vec3(0.96, 0.91, 0.87), smoothstep(0.7, 1.4, rim) * 0.35);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function LiquidGlassHero({ startingPrice, formatMoney, onExplore }: LiquidGlassHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedShape, setSelectedShape] = useState<'almendra' | 'coffin' | 'stiletto'>('almendra');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // WebGL Liquid Glass Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setWebglSupported(false);
      return;
    }

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      setWebglSupported(false);
      return;
    }

    const vert = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vert || !frag) {
      setWebglSupported(false);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglSupported(false);
      return;
    }

    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglSupported(false);
      return;
    }

    gl.useProgram(program);

    // Quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uPointer = gl.getUniformLocation(program, 'u_pointer');
    const uIntensity = gl.getUniformLocation(program, 'u_intensity');

    const currentPointer = { x: 0.5, y: 0.5 };
    const targetPointer = { x: 0.5, y: 0.5 };
    let intensity = 0.35;
    let animId = 0;
    const startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = () => {
      resize();

      currentPointer.x += (targetPointer.x - currentPointer.x) * 0.12;
      currentPointer.y += (targetPointer.y - currentPointer.y) * 0.12;
      intensity = intensity * 0.96 + 0.18 * 0.04;

      const time = (performance.now() - startTime) * 0.001;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uPointer, currentPointer.x, currentPointer.y);
      gl.uniform1f(uIntensity, intensity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const updatePointer = (clientX: number, clientY: number, impulse = 0.5) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      targetPointer.x = (clientX - rect.left) / rect.width;
      targetPointer.y = 1.0 - (clientY - rect.top) / rect.height; // flip for GL
      intensity = Math.min(intensity + impulse, 1.3);
      setHasInteracted(true);
    };

    const onMouseMove = (e: MouseEvent) => updatePointer(e.clientX, e.clientY, 0.35);
    const onMouseDown = (e: MouseEvent) => updatePointer(e.clientX, e.clientY, 0.85);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) updatePointer(e.touches[0].clientX, e.touches[0].clientY, 0.45);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) updatePointer(e.touches[0].clientX, e.touches[0].clientY, 0.8);
    };

    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mousedown', onMouseDown, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', onTouchStart);

      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    };
  }, []);

  const handleShapeSelect = useCallback((shape: 'almendra' | 'coffin' | 'stiletto') => {
    setSelectedShape(shape);
    setHasInteracted(true);
  }, []);

  return (
    <div ref={containerRef} className="liquid-glass-hero" aria-label="Escaparate interactivo de cristal líquido">
      {/* Background WebGL Liquid Glass Canvas */}
      {webglSupported ? (
        <canvas ref={canvasRef} className="liquid-glass-canvas" aria-hidden="true" />
      ) : (
        <div className="liquid-glass-fallback" aria-hidden="true" />
      )}

      {/* Floating Apple Liquid Glass UI Elements */}
      <div className="liquid-glass-content">
        {/* Top Status Capsule */}
        <div className="liquid-glass-badge">
          <span className="live-dot" />
          <span>Atelier Exclusivo · Agenda disponible</span>
        </div>

        {/* Central Luxury Nail Glass Display */}
        <div className="liquid-nail-display">
          <div className="nail-silhouette-glass">
            <svg viewBox="0 0 160 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="nail-svg" aria-hidden="true">
              <defs>
                <linearGradient id="nailGelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffedf1" stopOpacity="0.85" />
                  <stop offset="40%" stopColor="#f7d4dc" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#eec1cc" stopOpacity="0.88" />
                </linearGradient>
                <linearGradient id="goldVeinGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d5aa58" />
                  <stop offset="50%" stopColor="#fdf3db" />
                  <stop offset="100%" stopColor="#b48739" />
                </linearGradient>
                <filter id="glassRefract" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#4a2820" floodOpacity="0.18" />
                </filter>
              </defs>

              {/* Dynamic Path depending on selected shape */}
              {selectedShape === 'almendra' && (
                <path
                  d="M36 240 C32 180 24 100 80 18 C136 100 128 180 124 240 Z"
                  fill="url(#nailGelGradient)"
                  filter="url(#glassRefract)"
                  className="nail-path"
                />
              )}
              {selectedShape === 'coffin' && (
                <path
                  d="M38 240 L48 50 L112 50 L122 240 Z"
                  fill="url(#nailGelGradient)"
                  filter="url(#glassRefract)"
                  className="nail-path"
                />
              )}
              {selectedShape === 'stiletto' && (
                <path
                  d="M36 240 C34 170 30 110 80 8 C130 110 126 170 124 240 Z"
                  fill="url(#nailGelGradient)"
                  filter="url(#glassRefract)"
                  className="nail-path"
                />
              )}

              {/* Artisan Golden Foil Vein */}
              <path
                d="M52 210 C70 170 58 130 92 90 C106 72 110 50 102 34"
                stroke="url(#goldVeinGradient)"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="gold-foil-vein"
              />

              {/* Gloss shine streak */}
              <path
                d="M56 220 C48 160 46 110 76 34"
                stroke="#ffffff"
                strokeWidth="2"
                strokeOpacity="0.65"
                strokeLinecap="round"
              />
            </svg>

            {/* Specular gloss glint */}
            <div className="nail-glint-orb" />
          </div>

          {/* Shape Selector Glass Pills */}
          <div className="glass-shape-selector" aria-label="Elegir punta">
            <button
              type="button"
              className={`glass-chip ${selectedShape === 'almendra' ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('almendra')}
              aria-pressed={selectedShape === 'almendra'}
            >
              <Gem className="w-3.5 h-3.5" /> Almendra
            </button>
            <button
              type="button"
              className={`glass-chip ${selectedShape === 'coffin' ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('coffin')}
              aria-pressed={selectedShape === 'coffin'}
            >
              <Wand2 className="w-3.5 h-3.5" /> Coffin
            </button>
            <button
              type="button"
              className={`glass-chip ${selectedShape === 'stiletto' ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('stiletto')}
              aria-pressed={selectedShape === 'stiletto'}
            >
              <Sparkles className="w-3.5 h-3.5" /> Stiletto
            </button>
          </div>
        </div>

        {/* Bottom Floating Price Dock & CTA */}
        <div className="liquid-glass-dock">
          <div className="glass-price-info">
            <small>Sets de autor</small>
            <strong>desde {formatMoney(Number.isFinite(startingPrice) ? startingPrice : 22)}</strong>
          </div>
          <button
            type="button"
            className="glass-dock-cta"
            onClick={onExplore}
            aria-label="Ir a la calculadora para cotizar tu set"
          >
            <span>Personalizar</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Subtle Hint */}
        {!hasInteracted && (
          <div className="liquid-glass-hint" aria-hidden="true">
            <span>Toca o mueve el cursor para mover el cristal líquido</span>
          </div>
        )}
      </div>
    </div>
  );
}
