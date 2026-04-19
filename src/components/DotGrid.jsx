import { useCallback, useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import './DotGrid.css';

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function throttle(callback, limit) {
  let lastCall = 0;

  return (...args) => {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      callback(...args);
    }
  };
}

export default function DotGrid({
  dotSize = 8,
  gap = 18,
  baseColor = '#123247',
  activeColor = '#00d1ff',
  proximity = 120,
  speedTrigger = 220,
  shockRadius = 220,
  shockStrength = 0.3,
  maxSpeed = 2200,
  resistance = 0.2,
  returnDuration = 1.15,
  className = '',
  style = {},
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const dotsRef = useRef([]);
  const pointerRef = useRef({
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    inside: false,
  });

  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);

  const buildGrid = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);

    const cell = dotSize + gap;
    const columns = Math.max(1, Math.floor((width + gap) / cell));
    const rows = Math.max(1, Math.floor((height + gap) / cell));
    const gridWidth = columns * cell - gap;
    const gridHeight = rows * cell - gap;
    const startX = (width - gridWidth) / 2 + dotSize / 2;
    const startY = (height - gridHeight) / 2 + dotSize / 2;

    dotsRef.current = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;

      return {
        cx: startX + column * cell,
        cy: startY + row * cell,
        xOffset: 0,
        yOffset: 0,
      };
    });
  }, [dotSize, gap]);

  useEffect(() => {
    buildGrid();

    const resizeObserver = new ResizeObserver(() => {
      buildGrid();
    });

    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [buildGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const proximitySquared = proximity * proximity;
    let frameId = 0;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);

      const pointer = pointerRef.current;

      dotsRef.current.forEach((dot) => {
        const x = dot.cx + dot.xOffset;
        const y = dot.cy + dot.yOffset;
        const dx = pointer.x - dot.cx;
        const dy = pointer.y - dot.cy;
        const distanceSquared = dx * dx + dy * dy;

        let fill = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.55)`;

        if (pointer.inside && distanceSquared <= proximitySquared) {
          const ratio = 1 - Math.sqrt(distanceSquared) / proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * ratio);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * ratio);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * ratio);
          const alpha = 0.38 + ratio * 0.55;
          fill = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        context.beginPath();
        context.arc(x, y, dotSize / 2, 0, Math.PI * 2);
        context.fillStyle = fill;
        context.shadowBlur = pointer.inside && distanceSquared <= proximitySquared ? 16 : 0;
        context.shadowColor = `rgba(${activeRgb.r}, ${activeRgb.g}, ${activeRgb.b}, 0.28)`;
        context.fill();
      });

      frameId = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeRgb, baseRgb, dotSize, proximity]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return undefined;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const applyRepel = (centerX, centerY, forceMultiplier = 1) => {
      dotsRef.current.forEach((dot) => {
        const dx = dot.cx - centerX;
        const dy = dot.cy - centerY;
        const distance = Math.hypot(dx, dy);

        if (!distance || distance > shockRadius) {
          return;
        }

        const influence = 1 - distance / shockRadius;
        const directionX = dx / distance;
        const directionY = dy / distance;
        const targetX = directionX * shockRadius * shockStrength * influence * forceMultiplier;
        const targetY = directionY * shockRadius * shockStrength * influence * forceMultiplier;

        gsap.killTweensOf(dot);
        gsap.to(dot, {
          xOffset: targetX,
          yOffset: targetY,
          duration: 0.18,
          ease: 'power2.out',
          overwrite: true,
          onComplete: () => {
            gsap.to(dot, {
              xOffset: 0,
              yOffset: 0,
              duration: returnDuration,
              ease: 'expo.out',
            });
          },
        });
      });
    };

    const handlePointerMove = throttle((event) => {
      const rect = wrapper.getBoundingClientRect();
      const pointer = pointerRef.current;
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!isInside) {
        pointer.inside = false;
        pointer.x = -9999;
        pointer.y = -9999;
        return;
      }

      const now = performance.now();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const deltaTime = pointer.lastTime ? now - pointer.lastTime : 16;
      const deltaX = event.clientX - pointer.lastX;
      const deltaY = event.clientY - pointer.lastY;
      const speed = clamp((Math.hypot(deltaX, deltaY) / Math.max(deltaTime, 1)) * 1000, 0, maxSpeed);

      pointer.x = localX;
      pointer.y = localY;
      pointer.vx = deltaX;
      pointer.vy = deltaY;
      pointer.speed = speed;
      pointer.lastTime = now;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.inside = true;

      if (!reducedMotion && speed > speedTrigger) {
        const forceMultiplier = 0.18 + (speed / maxSpeed) * (1 + resistance);
        applyRepel(localX, localY, forceMultiplier);
      }
    }, 42);

    const handlePointerLeave = () => {
      pointerRef.current.inside = false;
      pointerRef.current.x = -9999;
      pointerRef.current.y = -9999;
    };

    const handleClick = (event) => {
      if (reducedMotion) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!isInside) {
        return;
      }

      applyRepel(event.clientX - rect.left, event.clientY - rect.top, 1.45);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('mouseout', handlePointerLeave);
    window.addEventListener('blur', handlePointerLeave);
    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseout', handlePointerLeave);
      window.removeEventListener('blur', handlePointerLeave);
      window.removeEventListener('click', handleClick);
    };
  }, [maxSpeed, resistance, returnDuration, shockRadius, shockStrength, speedTrigger]);

  return (
    <section className={`dot-grid ${className}`.trim()} style={style} aria-hidden="true">
      <div ref={wrapperRef} className="dot-grid__wrap">
        <canvas ref={canvasRef} className="dot-grid__canvas" />
      </div>
    </section>
  );
}
