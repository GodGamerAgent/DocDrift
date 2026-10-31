'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WaterScrollRevealProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export const WaterScrollReveal: React.FC<WaterScrollRevealProps> = ({
  children,
  id,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setInView(entry.isIntersecting);
        });
      },
      { threshold: 0.01, rootMargin: '60px 0px 60px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={id}
      ref={ref}
      className={`transition-transform duration-500 ease-out ${
        inView ? 'translate-y-0 scale-100' : 'translate-y-2 scale-[0.995]'
      } ${className}`}
    >
      {children}
    </div>
  );
};
