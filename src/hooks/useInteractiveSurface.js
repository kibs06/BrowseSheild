import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

const MOBILE_BREAKPOINT = 768;
const CYAN_GLOW = '0, 209, 255';

const PRESETS = {
  button: {
    borderGlow: true,
    spotlight: false,
    ripple: true,
    lift: 2,
    scale: 1.005,
    tilt: false,
    magnetism: true,
    magnetStrength: 0.035,
    tiltStrength: 4,
    spotlightRadius: 140,
  },
  card: {
    borderGlow: true,
    spotlight: false,
    ripple: true,
    lift: 3,
    scale: 1.008,
    tilt: false,
    magnetism: false,
    magnetStrength: 0.03,
    tiltStrength: 5,
    spotlightRadius: 220,
  },
  heroCard: {
    borderGlow: true,
    spotlight: true,
    ripple: true,
    lift: 4,
    scale: 1.01,
    tilt: true,
    magnetism: false,
    magnetStrength: 0.025,
    tiltStrength: 6,
    spotlightRadius: 260,
  },
  nav: {
    borderGlow: true,
    spotlight: false,
    ripple: true,
    lift: 2,
    scale: 1.005,
    tilt: false,
    magnetism: true,
    magnetStrength: 0.03,
    tiltStrength: 3,
    spotlightRadius: 130,
  },
  row: {
    borderGlow: true,
    spotlight: true,
    ripple: false,
    lift: 2,
    scale: 1.002,
    tilt: false,
    magnetism: false,
    magnetStrength: 0.02,
    tiltStrength: 4,
    spotlightRadius: 240,
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createRipple(element, event, glowColor) {
  const rect = element.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const maxDistance = Math.max(
    Math.hypot(x, y),
    Math.hypot(x - rect.width, y),
    Math.hypot(x, y - rect.height),
    Math.hypot(x - rect.width, y - rect.height),
  );

  const ripple = document.createElement('span');
  ripple.className = 'interactive-surface__ripple';
  ripple.style.width = `${maxDistance * 2}px`;
  ripple.style.height = `${maxDistance * 2}px`;
  ripple.style.left = `${x - maxDistance}px`;
  ripple.style.top = `${y - maxDistance}px`;
  ripple.style.background = `radial-gradient(circle, rgba(${glowColor}, 0.28) 0%, rgba(${glowColor}, 0.14) 34%, transparent 72%)`;

  element.appendChild(ripple);

  gsap.fromTo(
    ripple,
    { scale: 0, opacity: 1 },
    {
      scale: 1,
      opacity: 0,
      duration: 0.55,
      ease: 'power2.out',
      onComplete: () => ripple.remove(),
    },
  );
}

export function useInteractiveSurface({
  preset = 'card',
  disabled = false,
  glowColor = CYAN_GLOW,
  borderGlow,
  spotlight,
  ripple,
  tilt,
  magnetism,
  lift,
  scale,
  spotlightRadius,
  tiltStrength,
  magnetStrength,
} = {}) {
  const ref = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const config = useMemo(() => {
    const base = PRESETS[preset] || PRESETS.card;
    return {
      borderGlow: borderGlow ?? base.borderGlow,
      spotlight: spotlight ?? base.spotlight,
      ripple: ripple ?? base.ripple,
      tilt: tilt ?? base.tilt,
      magnetism: magnetism ?? base.magnetism,
      lift: lift ?? base.lift,
      scale: scale ?? base.scale,
      spotlightRadius: spotlightRadius ?? base.spotlightRadius,
      tiltStrength: tiltStrength ?? base.tiltStrength,
      magnetStrength: magnetStrength ?? base.magnetStrength,
    };
  }, [borderGlow, glowColor, lift, magnetStrength, magnetism, preset, ripple, scale, spotlight, spotlightRadius, tilt, tiltStrength]);

  useEffect(() => {
    const updateMobileState = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    updateMobileState();
    window.addEventListener('resize', updateMobileState);
    return () => window.removeEventListener('resize', updateMobileState);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) {
      return undefined;
    }

    const effectiveTilt = config.tilt && !isMobile;
    const effectiveMagnetism = config.magnetism && !isMobile;
    const effectiveSpotlight = config.spotlight && !isMobile;
    const effectiveBorderGlow = config.borderGlow;
    const effectiveRipple = config.ripple;

    element.style.setProperty('--interactive-glow-color', glowColor);
    element.style.setProperty('--interactive-radius', `${config.spotlightRadius}px`);

    const setPointerVars = (clientX, clientY) => {
      const rect = element.getBoundingClientRect();
      const relativeX = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const relativeY = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
      element.style.setProperty('--interactive-x', `${relativeX}%`);
      element.style.setProperty('--interactive-y', `${relativeY}%`);
    };

    const handlePointerEnter = () => {
      element.classList.add('is-interactive-hovered');
      gsap.to(element, {
        y: -config.lift,
        scale: config.scale,
        duration: 0.24,
        ease: 'power2.out',
      });
    };

    const handlePointerMove = (event) => {
      setPointerVars(event.clientX, event.clientY);

      if (!effectiveTilt && !effectiveMagnetism) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotationX = effectiveTilt ? ((y - centerY) / centerY) * -config.tiltStrength : 0;
      const rotationY = effectiveTilt ? ((x - centerX) / centerX) * config.tiltStrength : 0;
      const magnetX = effectiveMagnetism ? (x - centerX) * config.magnetStrength : 0;
      const magnetY = effectiveMagnetism ? (y - centerY) * config.magnetStrength : 0;

      gsap.to(element, {
        x: magnetX,
        y: magnetY - config.lift,
        rotateX: rotationX,
        rotateY: rotationY,
        scale: config.scale,
        duration: 0.2,
        ease: 'power2.out',
        transformPerspective: 1000,
      });
    };

    const handlePointerLeave = () => {
      element.classList.remove('is-interactive-hovered');
      gsap.to(element, {
        x: 0,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        duration: 0.28,
        ease: 'power2.out',
      });
    };

    const handleClick = (event) => {
      if (!effectiveRipple) {
        return;
      }

      createRipple(element, event, glowColor);
    };

    if (effectiveBorderGlow || effectiveSpotlight) {
      element.addEventListener('pointermove', handlePointerMove);
    }

    element.addEventListener('pointerenter', handlePointerEnter);
    element.addEventListener('pointerleave', handlePointerLeave);

    if (effectiveRipple) {
      element.addEventListener('click', handleClick);
    }

    return () => {
      gsap.killTweensOf(element);
      if (effectiveBorderGlow || effectiveSpotlight) {
        element.removeEventListener('pointermove', handlePointerMove);
      }
      element.removeEventListener('pointerenter', handlePointerEnter);
      element.removeEventListener('pointerleave', handlePointerLeave);
      if (effectiveRipple) {
        element.removeEventListener('click', handleClick);
      }
    };
  }, [config, disabled, glowColor, isMobile]);

  return ref;
}
