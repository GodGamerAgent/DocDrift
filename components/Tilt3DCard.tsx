'use client';

import React, { useRef, useState } from 'react';

interface Tilt3DCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  disabled?: boolean;
}

export const Tilt3DCard: React.FC<Tilt3DCardProps> = ({
  children,
  className = '',
  intensity = 3.5,
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;
    if (typeof document !== 'undefined' && document.documentElement.dataset.uiMode === 'classic') return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * intensity * 2;
    const rotateX = (0.5 - y) * intensity * 2;

    setStyle({
      transform: `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(4px)`,
      backgroundImage: `radial-gradient(420px circle at ${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%, rgb(var(--accent) / 0.06), transparent 70%)`,
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
      backgroundImage: 'none',
    });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={`card-3d ${className}`}
    >
      {children}
    </div>
  );
};
