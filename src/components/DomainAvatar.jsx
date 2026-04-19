import { useMemo, useState } from 'react';

export function DomainAvatar({ domain, src }) {
  const [failed, setFailed] = useState(false);
  const initial = useMemo(() => (domain?.charAt(0) || '?').toUpperCase(), [domain]);

  return (
    <div className="domain-avatar" aria-hidden="true">
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
