import { forwardRef } from 'react';
import { useInteractiveSurface } from '../hooks/useInteractiveSurface';

const presetGlowMap = {
  button: true,
  card: true,
  heroCard: true,
  nav: true,
  row: true,
};

const presetSpotlightMap = {
  button: false,
  card: false,
  heroCard: true,
  nav: false,
  row: true,
};

function mergeRefs(...refs) {
  return (value) => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      if (typeof ref === 'function') {
        ref(value);
        return;
      }

      ref.current = value;
    });
  };
}

export const InteractiveSurface = forwardRef(function InteractiveSurface(
  {
    as: Component = 'div',
    children,
    className = '',
    preset = 'card',
    disabled = false,
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
    inlineContent = false,
    ...rest
  },
  forwardedRef,
) {
  const localRef = useInteractiveSurface({
    preset,
    disabled,
    glowColor,
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
  });

  const enableGlow = borderGlow ?? presetGlowMap[preset] ?? true;
  const enableSpotlight = spotlight ?? presetSpotlightMap[preset] ?? false;

  const baseClassName = [
    'interactive-surface',
    enableGlow ? 'interactive-surface--glow' : '',
    enableSpotlight ? 'interactive-surface--spotlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = inlineContent ? <span className="interactive-surface__inline">{children}</span> : children;

  const componentProps = {
    ...rest,
    ref: mergeRefs(localRef, forwardedRef),
    className:
      typeof className === 'function'
        ? (state) =>
            [baseClassName, className(state)]
              .filter(Boolean)
              .join(' ')
        : [baseClassName, className].filter(Boolean).join(' '),
  };

  return (
    <Component {...componentProps}>
      {content}
      <span aria-hidden="true" className="interactive-surface__spotlight" />
      <span aria-hidden="true" className="interactive-surface__border" />
    </Component>
  );
});
