'use client';

import { useEffect, useRef } from 'react';
import lottie, { type AnimationItem } from 'lottie-web';
import botAnimationData from '@/assets/assistant-bot.json';

export type LottieAssistantBotProps = {
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
};

export function LottieAssistantBot({
  className = 'w-11 h-11',
  loop = true,
  autoplay = true,
}: LottieAssistantBotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      animRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop,
        autoplay,
        animationData: botAnimationData,
        rendererSettings: {
          preserveAspectRatio: 'xMidYMid meet',
        },
      });
    } catch (err) {
      console.error('Error cargando animación Lottie:', err);
    }

    return () => {
      animRef.current?.destroy();
      animRef.current = null;
    };
  }, [loop, autoplay]);

  return (
    <div
      ref={containerRef}
      className={`lottie-bot-container flex items-center justify-center pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    />
  );
}
