'use client';

import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Advanced premium fragment shader
//  • Simplex-style 2D smooth noise  → animated marble veins
//  • Multi-layer iridescent aurora  → rose, gold, pearl, blush halos
//  • Nacreous diffraction tint shift (UV-angle based hue shift)
//  • 6 tiny golden floating particle glows
//  • Top-right studio ceiling light beam
// ─────────────────────────────────────────────────────────────────────────────
const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2  u_resolution;
  uniform float u_time;

  /* ── Smooth noise ─────────────────────────────────────── */
  vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float snoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash22(i + vec2(0.0,0.0)), f - vec2(0.0,0.0)),
          dot(hash22(i + vec2(1.0,0.0)), f - vec2(1.0,0.0)), u.x),
      mix(dot(hash22(i + vec2(0.0,1.0)), f - vec2(0.0,1.0)),
          dot(hash22(i + vec2(1.0,1.0)), f - vec2(1.0,1.0)), u.x),
    u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.52; float fr = 1.0;
    for (int i = 0; i < 3; i++) { v += a * snoise(p * fr); fr *= 2.1; a *= 0.48; }
    return v;
  }

  /* ── Glow ─────────────────────────────────────────────── */
  float glow(float d, float r, float s) { return 1.0 - smoothstep(r, r + s, d); }

  void main() {
    vec2 uv  = gl_FragCoord.xy / u_resolution.xy;
    vec2 asp = vec2(u_resolution.x / u_resolution.y, 1.0);
    float t  = u_time * 0.038;

    /* 1. Marble veins via domain-warped fbm */
    vec2  warp = vec2(fbm(uv * 3.2 + t * 0.5), fbm(uv * 3.2 + t * 0.4 + 5.2));
    float vein = fbm(uv * 4.5 + warp * 0.55 + t * 0.18);
    float veinLine = smoothstep(0.62, 0.72, abs(vein)) * 0.052;

    /* 2. Aurora halos */
    vec2 a1 = vec2(0.78 + sin(t)        * 0.09, 0.70 + cos(t * 1.25) * 0.07);
    vec2 a2 = vec2(0.20 + cos(t * 0.68) * 0.11, 0.28 + sin(t * 1.10) * 0.06);
    vec2 a3 = vec2(0.50 + sin(t * 0.52) * 0.13, 0.06 + cos(t * 0.90) * 0.04);
    vec2 a4 = vec2(0.88 + cos(t * 0.44) * 0.06, 0.15 + sin(t * 0.72) * 0.08);
    float rose  = glow(length((uv - a1) * asp), 0.04, 0.42);
    float gold  = glow(length((uv - a2) * asp), 0.03, 0.35);
    float pearl = glow(length((uv - a3) * asp), 0.02, 0.45);
    float blush = glow(length((uv - a4) * asp), 0.03, 0.30);

    /* 3. Nacreous diffraction */
    float nacre = pow(abs(sin(uv.x * 3.14159 * 2.8 + t * 0.6)) * 0.5 + 0.5, 3.8) * 0.055;

    /* 4. Studio ceiling light beam (top-right) */
    float beam = smoothstep(1.0, 0.0, length((uv - vec2(1.0, 1.0)) * vec2(0.85, 1.0))) * 0.10;

    /* 5. Ribbon shimmer */
    float shimmer = smoothstep(0.88, 1.0, sin((uv.x * 6.0 + uv.y * 3.5 + t) * 3.14159) * 0.5 + 0.5) * 0.038;

    /* 6. Six floating golden particles */
    float pt = 0.0;
    pt += glow(length((uv - vec2(0.14 + sin(t * 1.20) * 0.05, 0.84 + cos(t * 0.90) * 0.04)) * asp), 0.008, 0.040) * 0.50;
    pt += glow(length((uv - vec2(0.63 + cos(t * 0.85) * 0.06, 0.72 + sin(t * 1.15) * 0.05)) * asp), 0.010, 0.035) * 0.45;
    pt += glow(length((uv - vec2(0.88 + sin(t * 0.70) * 0.04, 0.48 + cos(t * 1.30) * 0.06)) * asp), 0.007, 0.032) * 0.55;
    pt += glow(length((uv - vec2(0.32 + cos(t * 1.05) * 0.05, 0.18 + sin(t * 0.80) * 0.04)) * asp), 0.009, 0.038) * 0.40;
    pt += glow(length((uv - vec2(0.55 + sin(t * 0.60) * 0.07, 0.94 + cos(t * 0.95) * 0.03)) * asp), 0.006, 0.030) * 0.60;
    pt += glow(length((uv - vec2(0.08 + cos(t * 1.40) * 0.04, 0.42 + sin(t * 1.00) * 0.05)) * asp), 0.008, 0.036) * 0.50;

    /* Compose */
    vec3 c = vec3(1.0, 0.988, 0.978);
    c = mix(c, vec3(0.96, 0.64, 0.74), rose  * 0.28);
    c = mix(c, vec3(0.82, 0.60, 0.22), gold  * 0.22);
    c = mix(c, vec3(1.00, 0.92, 0.95), pearl * 0.24);
    c = mix(c, vec3(0.97, 0.72, 0.80), blush * 0.18);
    c += veinLine * vec3(0.20, 0.14, 0.10);
    c += shimmer  * vec3(0.14, 0.07, 0.04);
    c += beam     * vec3(1.00, 0.94, 0.88);
    c += nacre    * vec3(0.12, 0.06, 0.10);
    c += pt       * vec3(0.82, 0.60, 0.18);
    c  = clamp(c, vec3(0.92, 0.89, 0.87), vec3(1.0));

    gl_FragColor = vec4(c, 0.78);
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

export function ShaderBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!canvas || !gl) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const vertex   = createShader(gl, gl.VERTEX_SHADER,   VERTEX_SHADER);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uTime       = gl.getUniformLocation(program, 'u_time');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const resize = () => {
      const scale  = Math.min(window.devicePixelRatio || 1, 1.5);
      const width  = Math.floor(canvas.clientWidth  * scale);
      const height = Math.floor(canvas.clientHeight * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width  = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (now: number) => {
      resize();
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduceMotion) frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return <canvas ref={canvasRef} className="shader-backdrop" aria-hidden="true" />;
}

