import "./landing.css";
import KineticGrid from "./KineticGrid.jsx";

/* ---------- Hand-drawn doodles ---------- */
// Hand-drawn style inline SVG doodles.
const s = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };

const Star = ({ className, color }) => (
  <svg viewBox="0 0 40 40" className={className} style={{ color }}><path {...s} d="M20 4 L24 16 L36 17 L26 24 L30 36 L20 29 L10 36 L14 24 L4 17 L16 16 Z" /></svg>
);
const Sparkle = ({ className, color }) => (
  <svg viewBox="0 0 30 30" className={className} style={{ color }}><path {...s} d="M15 3 Q16 14 27 15 Q16 16 15 27 Q14 16 3 15 Q14 14 15 3Z" /></svg>
);
const Heart = ({ className, color }) => (
  <svg viewBox="0 0 40 36" className={className} style={{ color }}><path {...s} d="M20 32 C6 22 2 14 6 8 C10 2 18 4 20 11 C22 4 30 2 34 8 C38 14 34 22 20 32Z" /></svg>
);
const Squiggle = ({ className, color }) => (
  <svg viewBox="0 0 120 30" className={className} style={{ color }}><path {...s} d="M4 18 Q14 4 24 16 T44 16 T64 16 T84 16 T104 16 T116 12" /></svg>
);
const Arrow = ({ className, color }) => (
  <svg viewBox="0 0 120 80" className={className} style={{ color }}><path {...s} d="M8 12 C30 60 70 70 104 50" /><path {...s} d="M92 40 L105 50 L90 58" /></svg>
);
const Spiral = ({ className, color }) => (
  <svg viewBox="0 0 60 60" className={className} style={{ color }}><path {...s} d="M30 30 m0 -3 a3 3 0 1 1 -3 3 a7 7 0 1 1 7 7 a11 11 0 1 1 -11 -11 a15 15 0 1 1 15 15" /></svg>
);
const Cloud = ({ className, color }) => (
  <svg viewBox="0 0 100 50" className={className} style={{ color }}><path {...s} d="M18 40 C6 40 6 24 18 24 C18 12 34 8 40 18 C46 6 66 8 66 22 C80 18 90 40 74 40 Z" /></svg>
);
const Bulb = ({ className, color }) => (
  <svg viewBox="0 0 50 60" className={className} style={{ color }}><path {...s} d="M25 6 C12 6 8 18 12 26 C15 32 18 34 18 42 L32 42 C32 34 35 32 38 26 C42 18 38 6 25 6Z M19 48 L31 48 M21 53 L29 53 M25 0 L25 2 M6 10 L9 12 M44 10 L41 12" /></svg>
);
const PencilIcon = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className}><path {...s} d="M6 26 L8 19 L21 6 Q24 4 26 6 Q28 8 26 11 L13 24 Z M8 19 L13 24 M19 8 L24 13" /><path {...s} d="M4 29 Q10 27 16 29 T28 28" /></svg>
);

const Cat = ({ className }) => (
  <svg viewBox="0 0 160 130" className={className}>
    <g {...s}>
      <path d="M40 110 C30 80 40 60 60 56 L56 34 L70 46 Q80 43 90 46 L104 34 L100 58 C118 66 122 90 112 110 Z" />
      <path d="M112 104 C135 104 148 88 140 72 C136 64 128 68 132 76" />
      <circle cx="70" cy="64" r="1.6" fill="currentColor" /><circle cx="90" cy="64" r="1.6" fill="currentColor" />
      <path d="M77 71 L80 74 L83 71 M80 74 Q76 79 72 76 M80 74 Q84 79 88 76" />
      <path d="M60 72 L46 70 M60 76 L47 79 M100 72 L114 70 M100 76 L113 79" />
      <path d="M60 110 L60 100 M96 110 L96 100" />
      <path d="M30 112 L130 112" strokeWidth="1.6" />
    </g>
    <path d="M72 88 Q80 94 88 88" fill="none" stroke="#e8955a" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const LaptopPerson = ({ className }) => (
  <svg viewBox="0 0 260 230" className={className}>
    <g {...s}>
      {/* head + hair */}
      <circle cx="120" cy="52" r="24" />
      <path d="M96 48 C98 22 140 20 144 44 C136 38 120 40 110 32 C106 40 100 44 96 48" fill="currentColor" />
      <path d="M113 58 Q118 62 124 58" />
      {/* body */}
      <path d="M86 150 C84 110 94 86 120 84 C146 86 156 110 154 150" />
      {/* arms to keyboard */}
      <path d="M96 110 C92 132 110 148 140 150" /><path d="M146 112 C152 130 160 144 170 150" />
      {/* laptop */}
      <path d="M150 104 L210 96 L206 150 L146 152 Z" fill="#fbf6ec" />
      <path d="M130 152 L222 150 L230 160 L124 162 Z" />
      <path d="M170 116 Q178 110 186 118 T200 116" stroke="#6aa7d8" />
      {/* legs + floor */}
      <path d="M86 150 C80 176 92 190 120 196 L178 196 M154 152 C160 170 150 182 132 186" />
      <path d="M30 206 L240 206" strokeWidth="1.6" />
    </g>
    <circle cx="186" cy="132" r="5" fill="none" stroke="#7fb77e" strokeWidth="2.2" />
    <path d="M50 60 L58 68 M58 60 L50 68" stroke="#e8955a" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/* ---------- Page ---------- */

const ORANGE = "#e8955a", BLUE = "#6aa7d8", GREEN = "#7fb77e", INK = "#1f1d1a";

function Navbar({ onLogin, onSignup }) {
  return (
    <nav className="nav reveal">
      <a href="#top" className="brand"><PencilIcon className="brand-icon" /> The Shared Sanctum</a>
      <div className="nav-links">
        <a href="#features" className="nav-link hide-sm">Features</a>
        <a href="#about" className="nav-link hide-sm">About</a>
        <button onClick={onLogin} className="nav-link">Login</button>
<button onClick={onSignup} className="btn btn-dark btn-sm">
  Get Started
</button>
      </div>
    </nav>
  );
}

function Hero({ onSignup }) {
  return (
    <section className="hero" id="top">
      <div className="hero-paper">
        <Star className="d d-star1 float" color={ORANGE} />
        <Sparkle className="d d-sp1 twinkle" color={BLUE} />
        <Heart className="d d-heart1 float-slow" color={ORANGE} />
        <Squiggle className="d d-sq1" color={GREEN} />
        <Spiral className="d d-spiral" color={INK} />
        <Cloud className="d d-cloud float-slow" color={BLUE} />
        <Bulb className="d d-bulb wobble" color={INK} />
        <Sparkle className="d d-sp2 twinkle" color={GREEN} />
        <Star className="d d-star2 float" color={BLUE} />
        <Heart className="d d-heart2 float" color={GREEN} />
        <Arrow className="d d-arrow" color={INK} />
        <Cat className="d d-cat" />
        <LaptopPerson className="d d-person" />

        <div className="hero-content">
          <p className="eyebrow reveal d1">a collaborative whiteboard</p>
          <h1 className="hero-title reveal d2">
            Every great idea starts with a <span className="underline-doodle">doodle.</span>
          </h1>
          <p className="hero-desc reveal d3">
            A shared canvas to sketch your thoughts, explore ideas, and create something amazing together.
          </p>
          <div className="hero-actions reveal d4">
           <button onClick={onSignup} className="btn btn-dark">
  Start Creating
</button>
            <a href="#features" className="btn btn-ghost">Explore Workspace →</a>
          </div>
        </div>
      </div>
      <p className="hint">psst — move your cursor, click the grid ✦</p>
    </section>
  );
}

function FeatureCard({ icon, title, text, accent, tilt }) {
  return (
    <div className="card" style={{ "--accent": accent, "--tilt": tilt }}>
      <div className="card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Features() {
  return (
    <section className="section" id="features">
      <h2 className="section-title">Tools for wandering minds</h2>
      <Squiggle className="title-squiggle" color={ORANGE} />
      <div className="cards">
        <FeatureCard tilt="-1.2deg" accent={ORANGE} icon={<PencilIcon className="ci" />} title="Draw & Create"
          text="Pens, shapes, sticky notes and an endless canvas that never runs out of pages." />
        <FeatureCard tilt="0.8deg" accent={BLUE} icon={<Cloud className="ci" color={INK} />} title="Real-Time Collaboration"
          text="See every stroke and cursor live, as if you were all leaning over the same table." />
        <FeatureCard tilt="-0.6deg" accent={GREEN} icon={<Heart className="ci" color={INK} />} title="Private Rooms"
          text="Invite-only spaces for the half-formed ideas that need a little quiet first." />
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="section about" id="about">
      <Spiral className="about-doodle" color={BLUE} />
      <h2 className="section-title">A sanctum, not a spreadsheet.</h2>
      <p className="about-text">
        We believe the best thinking is messy, visual and shared. The Shared Sanctum is a calm,
        paper-like place where teams, classrooms and friends can sketch freely — no templates
        to fill, no boxes to tick. Just a blank page and the people you love making things with.
      </p>
    </section>
  );
}

function CTA({ onSignup }) {
  return (
    <section className="section cta" id="start">
      <div className="cta-box">
        <Star className="cta-star" color={ORANGE} />
        <Sparkle className="cta-spark" color={GREEN} />
        <h2 className="section-title">Your blank page is waiting.</h2>
        <p>Grab a pen. Invite a friend. See where the line goes.</p>
       <button onClick={onSignup} className="btn btn-dark">
  Start Creating — it's free
</button>
      </div>
      <footer className="footer">© {new Date().getFullYear()} The Shared Sanctum · drawn with care</footer>
    </section>
  );
}

export default function Landing({ onLogin, onSignup }) {
  return (
    <div className="landing">
      <KineticGrid />
      <div className="landing-layer">
        <Navbar onLogin={onLogin} onSignup={onSignup} />
<Hero onSignup={onSignup} />
        <Features />
        <About />
       <CTA onSignup={onSignup} />
      </div>
    </div>
  );
}
