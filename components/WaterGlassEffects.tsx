'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const WaterGlassEffects: React.FC = () => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const cursorOrbRef = useRef<HTMLDivElement>(null);
  const rippleSeq = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.35;
    let currentX = targetX;
    let currentY = targetY;
    let rafId = 0;

    const updateCursorWaterPlate = () => {
      // Fluid damping so the light refraction trails like a glass plate in water
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      if (cursorOrbRef.current) {
        cursorOrbRef.current.style.transform = `translate3d(${currentX - 220}px, ${currentY - 220}px, 0)`;
      }
      rafId = requestAnimationFrame(updateCursorWaterPlate);
    };

    const handlePointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const handlePointerDown = (e: MouseEvent) => {
      const id = ++rippleSeq.current;
      const size = 220;
      setRipples((prev) => [...prev.slice(-6), { id, x: e.clientX, y: e.clientY, size }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 880);
    };

    rafId = requestAnimationFrame(updateCursorWaterPlate);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('mousedown', handlePointerDown, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  return (
    <>
      {/* Fixed blurred colour blobs behind the frosted glass panels */}
      <div aria-hidden="true" className="blob -left-24 -top-20" />
      <div aria-hidden="true" className="blob blob--pink right-[-6rem] top-[28%]" />
      <div aria-hidden="true" className="blob blob--blue bottom-[-8rem] left-[22%]" />

      {/* Subtle fluid caustic lens that glides with the cursor like a glass plate in water */}
      <div
        ref={cursorOrbRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-0 h-[440px] w-[440px] rounded-full opacity-45"
        style={{
          background:
            'radial-gradient(circle, rgba(32, 178, 170, 0.42) 0%, rgba(0, 128, 255, 0.22) 45%, transparent 72%)',
          filter: 'blur(42px)',
        }}
      />

      {/* Active on-click water ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          className="water-ripple"
          style={{
            left: `${r.x}px`,
            top: `${r.y}px`,
            width: `${r.size}px`,
            height: `${r.size}px`,
          }}
        />
      ))}
    </>
  );
};

interface WaterScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}

/**
 * Animates elements when scrolling down so they arise from behind the screen
 * with a buoyant, liquid wave motion like a glass plate emerging from water.
 */
export const WaterScrollReveal: React.FC<WaterScrollRevealProps> = ({
  children,
  className = '',
  delay = 0,
  id,
}) => {
  return (
    <motion.div
      id={id}
      initial={{
        opacity: 0,
        y: 64,
        scale: 0.91,
        rotateX: 16,
        rotateZ: -0.8,
        filter: 'blur(8px)',
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        scale: 1,
        rotateX: 0,
        rotateZ: 0,
        filter: 'blur(0px)',
      }}
      viewport={{ once: false, amount: 0.14 }}
      transition={{
        type: 'spring',
        stiffness: 92,
        damping: 14,
        mass: 0.95,
        delay,
      }}
      style={{ transformStyle: 'preserve-3d' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
