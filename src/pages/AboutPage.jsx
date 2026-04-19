import { GlassCard } from '../components/GlassCard';
import { SectionHeader } from '../components/SectionHeader';

const aboutPoints = [
  'BrowseShield focuses on browser security monitoring, phishing detection, suspicious website analysis, and healthy cyber hygiene.',
  'It helps users understand why a destination looks unsafe instead of only showing a generic warning.',
  'The system is designed to support safer browsing decisions with clear risk signals, historical visibility, and guided protective actions.',
];

export function AboutPage() {
  return (
    <div className="page about-page">
      <SectionHeader
        eyebrow="About BrowseShield"
        title="Security intelligence for everyday browsing"
        description="BrowseShield is built to help users and teams recognize malicious or deceptive browser experiences before harm occurs."
      />

      <div className="about-grid">
        <GlassCard className="about-primary" interactive preset="heroCard" borderGlow spotlight ripple tilt={false} spotlightRadius={240}>
          <h3>What BrowseShield does</h3>
          <p>
            BrowseShield monitors browser activity for indicators linked to phishing,
            suspicious websites, insecure connections, deceptive login flows, and poor
            privacy posture. It turns technical findings into understandable risk signals.
          </p>
        </GlassCard>

        <GlassCard className="about-secondary" interactive preset="card" borderGlow ripple>
          <h3>Why it matters</h3>
          <p>
            Modern browsing threats often look polished and legitimate. Users can be
            pressured into trusting cloned pages, unsafe redirects, or tracker-heavy
            sites before they realize something is wrong. BrowseShield closes that gap
            with real-time analysis and response guidance.
          </p>
        </GlassCard>

        <GlassCard className="about-list-card" interactive preset="card" borderGlow spotlight ripple spotlightRadius={220}>
          <h3>Core focus areas</h3>
          <div className="about-points">
            {aboutPoints.map((point) => (
              <div key={point} className="recommendation-item">
                <span className="recommendation-mark" />
                <p>{point}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
