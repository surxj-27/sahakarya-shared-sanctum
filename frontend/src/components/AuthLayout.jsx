import KineticGrid from "./KineticGrid";
import "./Auth.css";

const doodleStyle = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function PencilMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path {...doodleStyle} d="M6 26 L8 19 L21 6 Q24 4 26 6 Q28 8 26 11 L13 24 Z M8 19 L13 24 M19 8 L24 13 M4 29 Q10 27 16 29 T28 28" />
    </svg>
  );
}

function AuthDoodles() {
  return (
    <div className="auth-doodles" aria-hidden="true">
      <svg className="auth-doodle auth-star" viewBox="0 0 40 40">
        <path {...doodleStyle} d="M20 4 L24 16 L36 17 L26 24 L30 36 L20 29 L10 36 L14 24 L4 17 L16 16 Z" />
      </svg>
      <svg className="auth-doodle auth-heart" viewBox="0 0 40 36">
        <path {...doodleStyle} d="M20 32 C6 22 2 14 6 8 C10 2 18 4 20 11 C22 4 30 2 34 8 C38 14 34 22 20 32Z" />
      </svg>
      <svg className="auth-doodle auth-squiggle" viewBox="0 0 120 30">
        <path {...doodleStyle} d="M4 18 Q14 4 24 16 T44 16 T64 16 T84 16 T104 16 T116 12" />
      </svg>
      <svg className="auth-doodle auth-cloud" viewBox="0 0 100 50">
        <path {...doodleStyle} d="M18 40 C6 40 6 24 18 24 C18 12 34 8 40 18 C46 6 66 8 66 22 C80 18 90 40 74 40 Z" />
      </svg>
      <svg className="auth-doodle auth-spiral" viewBox="0 0 60 60">
        <path {...doodleStyle} d="M30 30 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 1 1 7 7 a11 11 0 1 1 -11 -11 a15 15 0 1 1 15 15" />
      </svg>
      <svg className="auth-doodle auth-bulb" viewBox="0 0 50 60">
        <path {...doodleStyle} d="M25 6 C12 6 8 18 12 26 C15 32 18 34 18 42 L32 42 C32 34 35 32 38 26 C42 18 38 6 25 6Z M19 48 L31 48 M21 53 L29 53 M25 0 L25 2 M6 10 L9 12 M44 10 L41 12" />
      </svg>
    </div>
  );
}

export default function AuthLayout({ eyebrow, title, children }) {
  return (
    <main className="landing auth-page">
      <KineticGrid />
      <div className="landing-layer auth-layer">
        <nav className="nav auth-nav">
          <a href="/" className="brand">
            <PencilMark />
            The Shared Sanctum
          </a>
          <span className="auth-nav-note">a collaborative whiteboard</span>
        </nav>
        <section className="auth-hero">
          <div className="hero-paper auth-paper">
            <AuthDoodles />
            <div className="auth-content">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="hero-title auth-title">{title}</h1>
              {children}
            </div>
          </div>
          <p className="hint auth-hint">make a little room for big ideas ✦</p>
        </section>
      </div>
    </main>
  );
}
