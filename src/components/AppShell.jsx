import { NavLink } from 'react-router-dom';
import DotGrid from './DotGrid';
import { InteractiveSurface } from './InteractiveSurface';
import { isSupabaseConfigured } from '../lib/config';

const navigation = [
  { label: 'Home', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Detection History', to: '/history' },
  { label: 'Threat Details', to: '/threat-details' },
  { label: 'About', to: '/about' },
];

export function AppShell({ children }) {
  const configured = isSupabaseConfigured();

  return (
    <div className="app-shell">
      <div className="background-layer" />
      <div className="background-dots">
        <DotGrid
          dotSize={6}
          gap={22}
          baseColor="#0d3145"
          activeColor="#00d1ff"
          proximity={130}
          speedTrigger={260}
          shockRadius={180}
          shockStrength={0.24}
          maxSpeed={1800}
          resistance={0.16}
          returnDuration={1.05}
        />
      </div>
      <div className="background-grid" />
      <header className="site-header">
        <NavLink to="/" className="brand">
          <span className="brand-mark" />
          <span>
            <strong>BrowseShield</strong>
            <small>Browser defense intelligence</small>
          </span>
        </NavLink>
        <nav className="site-nav">
          {navigation.map((item) => (
            <InteractiveSurface
              key={item.to}
              as={NavLink}
              preset="nav"
              inlineContent
              glowColor="0, 209, 255"
              className={({ isActive }) =>
                `nav-link${isActive ? ' is-active' : ''}`
              }
              to={item.to}
            >
              {item.label}
            </InteractiveSurface>
          ))}
        </nav>
        <div className="header-status">
          <span className={`status-dot ${configured ? 'is-safe' : 'is-warning'}`} />
          {configured ? 'Supabase linked' : 'Demo mode'}
        </div>
      </header>
      <main className="page-frame">{children}</main>
    </div>
  );
}
