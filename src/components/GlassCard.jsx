import { InteractiveSurface } from './InteractiveSurface';

export function GlassCard({
  className = '',
  children,
  interactive = false,
  preset = 'card',
  glowColor = '0, 209, 255',
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
}) {
  if (!interactive) {
    return <section className={`glass-card ${className}`.trim()}>{children}</section>;
  }

  return (
    <InteractiveSurface
      as="section"
      className={`glass-card ${className}`.trim()}
      preset={preset}
      glowColor={glowColor}
      borderGlow={borderGlow}
      spotlight={spotlight}
      ripple={ripple}
      tilt={tilt}
      magnetism={magnetism}
      lift={lift}
      scale={scale}
      spotlightRadius={spotlightRadius}
      tiltStrength={tiltStrength}
      magnetStrength={magnetStrength}
    >
      {children}
    </InteractiveSurface>
  );
}
