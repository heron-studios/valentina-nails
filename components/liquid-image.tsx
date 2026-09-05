'use client';

import { useEffect, useRef, useState } from 'react';

export type LiquidImageProps = {
  src: string;
  alt: string;
  className?: string;
};

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform sampler2D u_texture;
  uniform vec2 u_resolution;
  uniform vec2 u_imageResolution;
  uniform float u_time;
  uniform vec2 u_pointer;
  uniform float u_intensity;
  varying vec2 v_uv;

  // Cover aspect ratio mapping so texture is never distorted
  vec2 getCoverUV(vec2 uv, vec2 canvasRes, vec2 imgRes) {
    float sAspect = canvasRes.x / canvasRes.y;
    float iAspect = imgRes.x / imgRes.y;
    vec2 st = uv;
    if (sAspect > iAspect) {
      float scale = iAspect / sAspect;
      st.y = (uv.y - 0.5) * scale + 0.5;
    } else {
      float scale = sAspect / iAspect;
      st.x = (uv.x - 0.5) * scale + 0.5;
    }
    return st;
  }

  void main() {
    vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 uv = getCoverUV(v_uv, u_resolution, u_imageResolution);

    // 1. Ambient gentle liquid breathing (organic fluid motion)
    float t = u_time * 0.8;
    float amb1 = sin(uv.x * 7.0 + uv.y * 5.0 + t) * 0.0024;
    float amb2 = cos(uv.x * 9.0 - uv.y * 6.0 + t * 0.85) * 0.0024;
    vec2 ambDisp = vec2(amb1, amb2);

    // 2. Interactive liquid wave distortion from pointer
    vec2 pDistVec = (v_uv - u_pointer) * aspect;
    float pDist = length(pDistVec);
    
    // Wave ripple ring that expands outward from touch/pointer
    float wavePhase = pDist * 30.0 - u_time * 7.0;
    float waveDecay = exp(-pDist * 6.0);
    float ripple = sin(wavePhase) * waveDecay * u_intensity;

    vec2 rippleDir = pDist > 0.0001 ? normalize(pDistVec) : vec2(0.0);
    vec2 interactDisp = rippleDir * ripple * 0.04;

    // Total displacement
    vec2 totalDisp = ambDisp + interactDisp;

    // 3. Chromatic liquid refraction (gel coat effect)
    vec2 uvR = clamp(uv + totalDisp * 1.04, 0.0, 1.0);
    vec2 uvG = clamp(uv + totalDisp * 1.00, 0.0, 1.0);
    vec2 uvB = clamp(uv + totalDisp * 0.96, 0.0, 1.0);

    float r = texture2D(u_texture, uvR).r;
    float g = texture2D(u_texture, uvG).g;
    float b = texture2D(u_texture, uvB).b;
    vec3 color = vec3(r, g, b);

    // 4. Specular champagne liquid reflection along wave crests
    float spec = pow(max(0.0, ripple * 1.5), 2.6) * u_intensity;
    vec3 highlight = vec3(1.0, 0.92, 0.78) * spec * 0.42;

    gl_FragColor = vec4(clamp(color + highlight, 0.0, 1.0), 1.0);
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

export function LiquidImage({ src, alt, className = '' }: LiquidImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

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

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      setWebglSupported(false);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebglSupported(false);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglSupported(false);
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'u_resolution');
    const uImageResolution = gl.getUniformLocation(program, 'u_imageResolution');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uPointer = gl.getUniformLocation(program, 'u_pointer');
    const uIntensity = gl.getUniformLocation(program, 'u_intensity');
    const uTexture = gl.getUniformLocation(program, 'u_texture');

    const texture = gl.createTexture();
    const image = new Image();
    image.crossOrigin = 'anonymous';

    let animFrame = 0;
    let imgNaturalW = 1672;
    let imgNaturalH = 941;

    const currentPointer = { x: 0.5, y: 0.5 };
    const targetPointer = { x: 0.5, y: 0.5 };
    let intensity = 0.2;

    image.onload = () => {
      imgNaturalW = image.naturalWidth || 1672;
      imgNaturalH = image.naturalHeight || 941;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

      setLoaded(true);

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

      const startTime = performance.now();

      const render = () => {
        resize();

        currentPointer.x += (targetPointer.x - currentPointer.x) * 0.12;
        currentPointer.y += (targetPointer.y - currentPointer.y) * 0.12;
        intensity = intensity * 0.95 + 0.14 * 0.05;

        const time = (performance.now() - startTime) * 0.001;

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform2f(uImageResolution, imgNaturalW, imgNaturalH);
        gl.uniform1f(uTime, time);
        gl.uniform2f(uPointer, currentPointer.x, currentPointer.y);
        gl.uniform1f(uIntensity, intensity);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(uTexture, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        animFrame = requestAnimationFrame(render);
      };

      animFrame = requestAnimationFrame(render);
    };

    image.src = src;

    const updatePointerPos = (clientX: number, clientY: number, impulse = 0.45) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      targetPointer.x = Math.max(0, Math.min(1, x));
      targetPointer.y = Math.max(0, Math.min(1, y));
      intensity = Math.min(intensity + impulse, 1.2);
    };

    const handleMouseMove = (e: MouseEvent) => {
      updatePointerPos(e.clientX, e.clientY, 0.35);
    };

    const handleMouseDown = (e: MouseEvent) => {
      updatePointerPos(e.clientX, e.clientY, 0.75);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updatePointerPos(touch.clientX, touch.clientY, 0.45);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updatePointerPos(touch.clientX, touch.clientY, 0.8);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mousedown', handleMouseDown, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);

      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
      gl.deleteTexture(texture);
    };
  }, [src]);

  return (
    <div ref={containerRef} className={`liquid-image-container ${className}`}>
      {webglSupported ? (
        <canvas
          ref={canvasRef}
          className={`liquid-image-canvas ${loaded ? 'is-ready' : 'is-loading'}`}
          aria-hidden="true"
        />
      ) : null}
      <img
        src={src}
        alt={alt}
        className={`liquid-image-fallback ${loaded && webglSupported ? 'is-hidden' : ''}`}
        loading="eager"
      />
    </div>
  );
}
