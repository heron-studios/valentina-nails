'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Sparkles, Wand2, Gem, ShieldCheck } from 'lucide-react';

export type LiquidGlassHeroProps = {
  currentShape?: string;
  onSelectShape?: (shapeId: string) => void;
  currentLength?: string;
  onSelectLength?: (lengthId: string) => void;
  currentTechnique?: string;
  onSelectTechnique?: (techId: string) => void;
  totalPrice: number;
  formatMoney: (val: number) => string;
  onStartCustomizing: () => void;
};

type NailTone = 'rose' | 'glazed' | 'milk' | 'champagne';

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

    // Fluid liquid-glass coordinate distortion
    float t = u_time * 0.22;
    vec2 p = uv * 3.4;
    vec2 q = vec2(fbm(p + t * 0.38), fbm(p + vec2(5.2, 1.3) - t * 0.28));
    vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + t * 0.32),
                  fbm(p + 3.2 * q + vec2(8.3, 2.8) - t * 0.22));
    float caustic = fbm(p + 3.6 * r);

    // Interactive ripples from touch/mouse pointer
    vec2 pVec = (uv - u_pointer) * aspect;
    float dist = length(pVec);
    float wave = sin(dist * 34.0 - u_time * 7.5) * exp(-dist * 5.2) * u_intensity;
    vec2 waveDisp = (dist > 0.001 ? normalize(pVec) : vec2(0.0)) * wave * 0.1;

    // Apple-style Liquid Glass base gradients: warm nacre, blush & crystal
    vec3 baseGlass = mix(
      vec3(0.99, 0.98, 0.96),
      vec3(0.96, 0.90, 0.86),
      uv.y * 0.75 + caustic * 0.25
    );

    vec3 goldCaustic = vec3(0.93, 0.76, 0.44); // 18k Champagne gold
    vec3 blushGlow   = vec3(0.96, 0.78, 0.84); // Rose quartz
    vec3 crystalPure = vec3(1.00, 1.00, 1.00); // Diamond specular

    // Chromatic refraction
    float dispR = fbm(p + 3.6 * r + waveDisp * 1.10);
    float dispG = fbm(p + 3.6 * r + waveDisp * 1.00);
    float dispB = fbm(p + 3.6 * r + waveDisp * 0.90);

    float causticEdge = pow(1.0 - abs(dispG * 2.0 - 1.0), 3.4) * 0.95;
    float causticGold = pow(dispR, 3.8) * 0.75;
    float causticRose = pow(dispB, 3.0) * 0.55;

    float specRipple = pow(max(0.0, wave * 1.9), 2.7) * u_intensity * 1.1;

    vec3 color = baseGlass;
    color = mix(color, blushGlow, causticRose * 0.8);
    color = mix(color, goldCaustic, causticGold * 0.85);
    color += crystalPure * (causticEdge * 0.45 + specRipple);

    float rim = length((uv - 0.5) * 1.7);
    color = mix(color, vec3(0.95, 0.88, 0.83), smoothstep(0.65, 1.35, rim) * 0.4);

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

export function LiquidGlassHero({
  currentShape = 'almond',
  onSelectShape,
  currentLength = 'length-4',
  onSelectLength,
  currentTechnique = '',
  onSelectTechnique,
  totalPrice,
  formatMoney,
  onStartCustomizing,
}: LiquidGlassHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTone, setSelectedTone] = useState<NailTone>('rose');
  const [localShape, setLocalShape] = useState<string>(currentShape || 'almond');
  const [localLength, setLocalLength] = useState<string>(currentLength || 'length-4');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Sync external props with local state
  useEffect(() => {
    if (currentShape) setLocalShape(currentShape);
  }, [currentShape]);

  useEffect(() => {
    if (currentLength) setLocalLength(currentLength);
  }, [currentLength]);

  // WebGL Liquid Glass Background Engine
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
      targetPointer.y = 1.0 - (clientY - rect.top) / rect.height;
      intensity = Math.min(intensity + impulse, 1.4);
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

  // Shape change handler
  const handleShapeSelect = useCallback((shapeId: string) => {
    setLocalShape(shapeId);
    onSelectShape?.(shapeId);
    setHasInteracted(true);
  }, [onSelectShape]);

  // Length change handler
  const handleLengthSelect = useCallback((lengthId: string) => {
    setLocalLength(lengthId);
    onSelectLength?.(lengthId);
    setHasInteracted(true);
  }, [onSelectLength]);

  // Quick technique handler
  const handleTechniqueSelect = useCallback((techId: string) => {
    onSelectTechnique?.(techId);
    setHasInteracted(true);
  }, [onSelectTechnique]);

  // Compute tip Y position based on length
  const tipY = useMemo(() => {
    if (['length-1', 'length-2'].includes(localLength)) return 66; // Corto
    if (['length-5', 'length-6', 'length-7', 'length-8'].includes(localLength)) return 14; // Largo
    return 38; // Medio
  }, [localLength]);

  // SVG Nail Path calculation according to active shape & length
  const nailPath = useMemo(() => {
    const shape = localShape === 'almendra' ? 'almond' : localShape;

    switch (shape) {
      case 'coffin':
        return `M36 236 C35 180 43 ${tipY + 44} 54 ${tipY} L106 ${tipY} C117 ${tipY + 44} 125 180 124 236 C105 244 55 244 36 236 Z`;
      case 'stiletto':
        return `M36 236 C34 175 32 ${tipY + 70} 80 ${Math.max(8, tipY - 4)} C128 ${tipY + 70} 126 175 124 236 C105 244 55 244 36 236 Z`;
      case 'square':
        return `M36 236 L36 ${tipY + 8} C36 ${tipY + 2} 40 ${tipY} 46 ${tipY} L114 ${tipY} C120 ${tipY} 124 ${tipY + 2} 124 ${tipY + 8} L124 236 C105 244 55 244 36 236 Z`;
      case 'almond':
      default:
        return `M36 236 C34 185 30 ${tipY + 60} 80 ${tipY} C130 ${tipY + 60} 126 185 124 236 C105 244 55 244 36 236 Z`;
    }
  }, [localShape, tipY]);

  // Nail Gel gradient colors based on selected tone
  const gelColors = useMemo(() => {
    switch (selectedTone) {
      case 'glazed':
        return {
          start: '#faf2f8',
          mid: '#f1dced',
          end: '#e5c4e0',
          glint: 'rgba(235, 205, 255, 0.9)',
        };
      case 'milk':
        return {
          start: '#ffffff',
          mid: '#fbeff2',
          end: '#f4dde3',
          glint: 'rgba(255, 255, 255, 0.95)',
        };
      case 'champagne':
        return {
          start: '#fffbf0',
          mid: '#faecd0',
          end: '#e9d2a4',
          glint: 'rgba(255, 230, 160, 0.9)',
        };
      case 'rose':
      default:
        return {
          start: '#fff0f3',
          mid: '#f9d5de',
          end: '#efbac7',
          glint: 'rgba(255, 255, 255, 0.92)',
        };
    }
  }, [selectedTone]);

  const hasSelectedTechnique = Boolean(currentTechnique);

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
          <span>Atelier Exclusivo · Simulador en vivo</span>
        </div>

        {/* Central Luxury Nail Glass Display */}
        <div className="liquid-nail-display">
          <div className="nail-silhouette-glass">
            <svg
              viewBox="0 0 160 260"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="nail-svg"
              aria-hidden="true"
            >
              <defs>
                {/* Dynamic Base Gradient */}
                <linearGradient id="nailGelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gelColors.start} stopOpacity="0.88" />
                  <stop offset="42%" stopColor={gelColors.mid} stopOpacity="0.94" />
                  <stop offset="100%" stopColor={gelColors.end} stopOpacity="0.9" />
                </linearGradient>

                {/* 18k Metallic Gold Vein Gradient */}
                <linearGradient id="goldVeinGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d5aa58" />
                  <stop offset="45%" stopColor="#fff2d6" />
                  <stop offset="70%" stopColor="#deb05a" />
                  <stop offset="100%" stopColor="#b48739" />
                </linearGradient>

                {/* Lateral 3D Curvature Depth Shading */}
                <linearGradient id="lateralCurveShade" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#5a2f26" stopOpacity="0.32" />
                  <stop offset="18%" stopColor="#ffffff" stopOpacity="0.08" />
                  <stop offset="50%" stopColor="#ffffff" stopOpacity="0.25" />
                  <stop offset="82%" stopColor="#ffffff" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#5a2f26" stopOpacity="0.32" />
                </linearGradient>

                {/* Glazed Holographic Sheen */}
                <linearGradient id="glazedShimmer" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d4b5ff" stopOpacity="0.35" />
                  <stop offset="50%" stopColor="#ffe6f3" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#a3e7ff" stopOpacity="0.35" />
                </linearGradient>

                {/* Soft Organic Cuticle Shadow */}
                <filter id="glassRefract" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#4a2820" floodOpacity="0.16" />
                </filter>

                {/* CRITICAL: Vector clip path that strictly bounds all internal veins & glints */}
                <clipPath id="nailShapeClip">
                  <path d={nailPath} />
                </clipPath>
              </defs>

              {/* Base Nail Silhouette */}
              <path
                d={nailPath}
                fill="url(#nailGelGradient)"
                filter="url(#glassRefract)"
                className="nail-path"
              />

              {/* STRICTLY CLIPPED INTERNAL ARTWORK: CANNOT EXTEND OUTSIDE THE NAIL */}
              <g clipPath="url(#nailShapeClip)">
                {/* 3D Curvature shading */}
                <path d={nailPath} fill="url(#lateralCurveShade)" />

                {/* Glazed effect overlay when active */}
                {selectedTone === 'glazed' && (
                  <rect x="0" y="0" width="160" height="260" fill="url(#glazedShimmer)" />
                )}

                {/* Artisan Golden Foil Vein (100% contained inside clip path) */}
                <path
                  d="M50 225 C68 180 54 130 92 88 C104 74 108 52 98 26"
                  stroke="url(#goldVeinGradient)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  className="gold-foil-vein"
                />
                <path
                  d="M66 148 C78 138 84 126 82 110"
                  stroke="url(#goldVeinGradient)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity="0.85"
                />

                {/* Liquid Glass Curved Specular Highlight Streak */}
                <path
                  d="M54 220 C46 160 46 110 74 30"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeOpacity="0.75"
                  strokeLinecap="round"
                />

                {/* Cuticle crescent highlight */}
                <path
                  d="M44 234 C58 240 102 240 116 234"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  strokeOpacity="0.45"
                  strokeLinecap="round"
                />
              </g>
            </svg>

            {/* Specular gloss glint orb */}
            <div
              className="nail-glint-orb"
              style={{
                background: `radial-gradient(circle, ${gelColors.glint} 0%, rgba(255, 255, 255, 0) 75%)`,
              }}
            />
          </div>

          {/* Tone / Finish Color Swatches */}
          <div className="glass-swatches-dock" aria-label="Seleccionar acabado de esmalte">
            <button
              type="button"
              className={`glass-swatch-pill ${selectedTone === 'rose' ? 'is-active' : ''}`}
              onClick={() => setSelectedTone('rose')}
              title="Nude Rosé"
              aria-label="Acabado Nude Rosé"
            >
              <span className="swatch-circle" style={{ background: 'linear-gradient(135deg, #ffeef2, #f3bcc7)' }} />
              <small>Rosé</small>
            </button>
            <button
              type="button"
              className={`glass-swatch-pill ${selectedTone === 'glazed' ? 'is-active' : ''}`}
              onClick={() => setSelectedTone('glazed')}
              title="Glazed Pearl"
              aria-label="Acabado Glazed Pearl con brillo perla"
            >
              <span className="swatch-circle" style={{ background: 'linear-gradient(135deg, #f7edff, #dfc4ff)' }} />
              <small>Glazed</small>
            </button>
            <button
              type="button"
              className={`glass-swatch-pill ${selectedTone === 'milk' ? 'is-active' : ''}`}
              onClick={() => setSelectedTone('milk')}
              title="Cuarzo Milk"
              aria-label="Acabado Cuarzo Milk francés"
            >
              <span className="swatch-circle" style={{ background: 'linear-gradient(135deg, #ffffff, #f7e6eb)' }} />
              <small>Milk</small>
            </button>
            <button
              type="button"
              className={`glass-swatch-pill ${selectedTone === 'champagne' ? 'is-active' : ''}`}
              onClick={() => setSelectedTone('champagne')}
              title="Oro Champaña"
              aria-label="Acabado Champaña Gold"
            >
              <span className="swatch-circle" style={{ background: 'linear-gradient(135deg, #fff7e4, #e2c086)' }} />
              <small>Champaña</small>
            </button>
          </div>

          {/* Useful Controls: Shape Selector Glass Pills */}
          <div className="glass-shape-selector" aria-label="Elegir punta">
            <button
              type="button"
              className={`glass-chip ${(localShape === 'almond' || localShape === 'almendra') ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('almond')}
              aria-pressed={localShape === 'almond' || localShape === 'almendra'}
            >
              <Gem className="w-3.5 h-3.5" /> Almendra
            </button>
            <button
              type="button"
              className={`glass-chip ${localShape === 'coffin' ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('coffin')}
              aria-pressed={localShape === 'coffin'}
            >
              <Wand2 className="w-3.5 h-3.5" /> Coffin
            </button>
            <button
              type="button"
              className={`glass-chip ${localShape === 'stiletto' ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('stiletto')}
              aria-pressed={localShape === 'stiletto'}
            >
              <Sparkles className="w-3.5 h-3.5" /> Stiletto
            </button>
            <button
              type="button"
              className={`glass-chip ${localShape === 'square' ? 'is-active' : ''}`}
              onClick={() => handleShapeSelect('square')}
              aria-pressed={localShape === 'square'}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Cuadrada
            </button>
          </div>

          {/* Quick Length Stepper for Real Utility */}
          <div className="glass-length-row" aria-label="Elegir largo aproximado">
            <span className="length-label">Largo:</span>
            <button
              type="button"
              className={`glass-length-btn ${['length-1', 'length-2'].includes(localLength) ? 'is-active' : ''}`}
              onClick={() => handleLengthSelect('length-2')}
            >
              Corto
            </button>
            <button
              type="button"
              className={`glass-length-btn ${['length-3', 'length-4'].includes(localLength) ? 'is-active' : ''}`}
              onClick={() => handleLengthSelect('length-4')}
            >
              Medio
            </button>
            <button
              type="button"
              className={`glass-length-btn ${['length-5', 'length-6', 'length-7', 'length-8'].includes(localLength) ? 'is-active' : ''}`}
              onClick={() => handleLengthSelect('length-6')}
            >
              Largo
            </button>
          </div>
        </div>

        {/* Bottom Floating Price Dock & CTA: Starts at 0 */}
        <div className="liquid-glass-dock">
          <div className="glass-price-info">
            <small>{hasSelectedTechnique ? 'Cotización estimada' : 'Cotización en vivo'}</small>
            <strong className="price-display">
              {formatMoney(totalPrice)}
            </strong>
            <span className="price-hint">
              {hasSelectedTechnique
                ? 'Base y largo incluidos'
                : 'Comienza en S/ 0 · Elige opciones'}
            </span>
          </div>
          <button
            type="button"
            className="glass-dock-cta"
            onClick={onStartCustomizing}
            aria-label="Personalizar este set y continuar"
          >
            <span>{hasSelectedTechnique ? 'Continuar con este set' : 'Personalizar mi set'}</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Technique Pill Tray if not yet chosen */}
        {!hasSelectedTechnique && (
          <div className="hero-quick-techs" aria-label="Elegir técnica base">
            <span className="quick-tech-lead">O escoge tu base:</span>
            <button
              type="button"
              className="quick-tech-chip"
              onClick={() => handleTechniqueSelect('gel')}
            >
              Gel S/ 150
            </button>
            <button
              type="button"
              className="quick-tech-chip"
              onClick={() => handleTechniqueSelect('rubber')}
            >
              Rubber S/ 200
            </button>
            <button
              type="button"
              className="quick-tech-chip is-gold"
              onClick={() => handleTechniqueSelect('acrylic')}
            >
              Acrílico S/ 280
            </button>
          </div>
        )}

        {/* Subtle Interactive Hint */}
        {!hasInteracted && (
          <div className="liquid-glass-hint" aria-hidden="true">
            <span>Toca o desliza para interactuar con el cristal líquido</span>
          </div>
        )}
      </div>
    </div>
  );
}
