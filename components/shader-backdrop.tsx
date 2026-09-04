'use client';

import { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Vivid rose-gold aurora shader with marble veins and golden sparkles.
// blend-mode: normal so colors are always visible against any background.
const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2  u_resolution;
  uniform float u_time;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
    return fract(sin(p) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    float a = dot(hash2(i          )*2.0-1.0, f          );
    float b = dot(hash2(i+vec2(1,0))*2.0-1.0, f-vec2(1,0));
    float c = dot(hash2(i+vec2(0,1))*2.0-1.0, f-vec2(0,1));
    float d = dot(hash2(i+vec2(1,1))*2.0-1.0, f-vec2(1,1));
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y) * 0.5 + 0.5;
  }
  float fbm(vec2 p) {
    return noise(p)*0.5 + noise(p*2.1)*0.3 + noise(p*4.3)*0.2;
  }

  void main() {
    vec2 uv  = gl_FragCoord.xy / u_resolution.xy;
    vec2 asp = vec2(u_resolution.x / u_resolution.y, 1.0);
    float t  = u_time * 0.04;

    /* Warm cream base */
    vec3 col = vec3(1.00, 0.965, 0.945);

    /* Marble veins */
    vec2 wuv = uv * 3.0 + vec2(t*0.12, t*0.08);
    float vein = fbm(wuv + vec2(fbm(wuv*1.4)*0.6));
    float vl = smoothstep(0.54,0.58,vein) + smoothstep(0.72,0.76,vein);
    col = mix(col, vec3(0.88,0.78,0.65), vl * 0.22);

    /* Rose aurora – top-right */
    vec2 rp = vec2(0.82+sin(t)*0.07, 0.78+cos(t*1.1)*0.05);
    float rose = pow(1.0-smoothstep(0.0,0.55,length((uv-rp)*asp)), 1.8);
    col = mix(col, vec3(0.98,0.72,0.78), rose * 0.62);

    /* Gold aurora – left-mid */
    vec2 gp = vec2(0.14+cos(t*0.75)*0.08, 0.44+sin(t*0.9)*0.07);
    float gold = pow(1.0-smoothstep(0.0,0.48,length((uv-gp)*asp)), 1.6);
    col = mix(col, vec3(0.99,0.86,0.42), gold * 0.55);

    /* Blush aurora – bottom-center */
    vec2 bp = vec2(0.50+sin(t*0.55)*0.10, 0.08+cos(t*0.8)*0.04);
    float blush = pow(1.0-smoothstep(0.0,0.42,length((uv-bp)*asp)), 2.0);
    col = mix(col, vec3(0.97,0.65,0.76), blush * 0.52);

    /* Pearl pool – top-left */
    vec2 pp = vec2(0.18+sin(t*0.6)*0.06, 0.88+cos(t)*0.04);
    float pearl = pow(1.0-smoothstep(0.0,0.38,length((uv-pp)*asp)), 2.2);
    col = mix(col, vec3(0.84,0.78,0.96), pearl * 0.40);

    /* Studio light – top-right corner */
    float halo = 1.0-smoothstep(0.0,0.80,length((uv-vec2(1.0,1.0))*vec2(0.68,1.0)));
    col = mix(col, vec3(1.0,0.96,0.90), halo * 0.28);

    /* Golden sparkles */
    vec3 spk = vec3(0.0);
    spk += (1.0-smoothstep(0.0,0.028,length((uv-vec2(0.18+sin(t*1.2)*0.04,0.70+cos(t*0.9)*0.03))*asp)))*vec3(1.0,0.82,0.30);
    spk += (1.0-smoothstep(0.0,0.022,length((uv-vec2(0.72+cos(t*0.8)*0.05,0.55+sin(t*1.1)*0.04))*asp)))*vec3(1.0,0.86,0.36);
    spk += (1.0-smoothstep(0.0,0.018,length((uv-vec2(0.40+sin(t*0.7)*0.05,0.28+cos(t*1.3)*0.03))*asp)))*vec3(1.0,0.76,0.45);
    spk += (1.0-smoothstep(0.0,0.020,length((uv-vec2(0.88+cos(t*1.1)*0.03,0.35+sin(t*0.7)*0.05))*asp)))*vec3(0.95,0.83,0.30);
    spk += (1.0-smoothstep(0.0,0.016,length((uv-vec2(0.60+sin(t*0.9)*0.06,0.90+cos(t*1.2)*0.03))*asp)))*vec3(1.0,0.88,0.40);
    spk += (1.0-smoothstep(0.0,0.014,length((uv-vec2(0.08+cos(t*1.4)*0.03,0.22+sin(t*0.8)*0.04))*asp)))*vec3(0.98,0.78,0.34);
    col += spk * 0.60;

    col = clamp(col, 0.0, 1.0);

    float a = 0.74 + rose*0.16 + gold*0.14 + blush*0.12 + pearl*0.08;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
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
    const gl = canvas?.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uRes  = gl.getUniformLocation(program, 'u_resolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth  * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = (now: number) => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) frame = requestAnimationFrame(render);
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
