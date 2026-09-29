"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Showcase = {
  available: boolean;
  tourAvailable: boolean;
  tourURL: string;
  duration: number;
};
const listingURL =
  "https://www.hemnet.se/bostad/radhus-5rum-alvsjo-herrangen-stockholms-kommun-noaks-vag-3b-21789722";
const questions = [
  [
    "Can I use any Hemnet listing?",
    "Start with a public Hemnet listing and photos you have permission to use. Some listings block automated imports. If that happens, you can upload your own photos and floor plans in the studio.",
  ],
  [
    "Is this an exact replica of the home?",
    "It is a photo-based reconstruction with estimated dimensions. Floor plans help establish room connections, but hidden details and some furnishings need manual review. Use it to understand the space, then confirm the details at your viewing.",
  ],
  [
    "Do I need an API key?",
    "You can explore the example and use the studio without a key. Creating a new draft with OpenAI vision requires your own API key and an explicit photo-upload confirmation. API charges apply. You can also use the included local Codex skill.",
  ],
  [
    "Can I choose Three.js or Unreal Engine?",
    "Yes. Explore and record a tour in your browser with Three.js, or export an editable Unreal Engine project to refine and render locally. The Noaks example on this page is the existing Three.js walkthrough.",
  ],
  [
    "What happens to my photos?",
    "The studio runs on your computer and stores each project locally. Selected photos are sent to OpenAI only when you explicitly choose AI generation. The demo does not require an account or API key.",
  ],
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function Brand() {
  return (
    <a href="/" className="wordmark" aria-label="Walkthrough Studio home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 27V12L16 4l12 8v15H4Zm8 0V15l9-7m-9 7 16-3M21 8v19" />
      </svg>
      <span>
        Walkthrough<span className="brand-light">Studio</span>
      </span>
    </a>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"poster" | "video" | "tour">("poster");
  const [showcase, setShowcase] = useState<Showcase | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [link, setLink] = useState("");
  const [formError, setFormError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const demo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/showcase/config", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Unavailable");
        return r.json();
      })
      .then(setShowcase)
      .catch((error) => {
        if (error.name !== "AbortError")
          setShowcase({
            available: false,
            tourAvailable: false,
            tourURL: "",
            duration: 0,
          });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  function showDemo(next: "video" | "tour") {
    video.current?.pause();
    setMediaError("");
    setMode(next);
    setMenuOpen(false);
    document.getElementById("demo")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const url = new URL(link.trim());
      if (
        url.protocol !== "https:" ||
        !["hemnet.se", "www.hemnet.se"].includes(url.hostname) ||
        url.username ||
        url.password ||
        url.port ||
        !/^\/bostad\/[\w%-]+\/?$/.test(url.pathname)
      )
        throw new Error();
      window.location.assign(
        `/studio/?listing=${encodeURIComponent(`https://www.hemnet.se${url.pathname}`)}`,
      );
    } catch {
      setFormError(
        "Enter a Hemnet listing link, like https://www.hemnet.se/bostad/…",
      );
    }
  }

  return (
    <>
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <section className="hero" id="home">
        <img
          className="hero-photo"
          src="/showcase/noaks/kitchen.jpg"
          alt="The kitchen and dining area at Noaks väg 3B"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          fetchPriority="high"
        />
        <div className="hero-shade" />
        <header className="site-header">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            <a href="#demo">The walkthrough</a>
            <a href="#how-it-works">How it works</a>
            <a href="#questions">Questions</a>
          </nav>
          <a href="#try-it" className="header-cta">
            Try your listing <Arrow />
          </a>
          <button
            className="menu-toggle"
            ref={menuButton}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span /> <span />
          </button>
          {menuOpen && (
            <nav
              className="mobile-nav"
              id="mobile-navigation"
              aria-label="Mobile navigation"
            >
              {[
                ["#demo", "The walkthrough"],
                ["#how-it-works", "How it works"],
                ["#questions", "Questions"],
                ["#try-it", "Try your listing"],
                ["/studio/", "Open studio"],
              ].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                  {label}
                  <Arrow />
                </a>
              ))}
            </nav>
          )}
        </header>
        <div className="hero-content page-width">
          <div className="hero-intro">
            <p>
              Photos show the rooms.
              <br />A walkthrough shows how home feels.
            </p>
            <a className="text-link" href="#try-it">
              Start with a Hemnet link <Arrow />
            </a>
          </div>
          <h1>
            Before the viewing.
            <br />
            <span>Step inside.</span>
          </h1>
          <div className="hero-bottom">
            <div className="hero-actions">
              <button className="button light" onClick={() => showDemo("tour")}>
                Explore the home <Arrow />
              </button>
              <button className="film-link" onClick={() => showDemo("video")}>
                <span className="play-small" aria-hidden="true">
                  ▶
                </span>{" "}
                Watch the film
              </button>
            </div>
            <div className="hero-location">
              <span>Noaks väg 3B</span>
              <span>Älvsjö, Stockholm · Listing photograph</span>
            </div>
          </div>
        </div>
      </section>

      <main id="main">
        <section
          className="intro-section page-width"
          aria-labelledby="intro-title"
        >
          <div className="section-label">
            <i /> A better feel for home
          </div>
          <div>
            <h2 id="intro-title">
              Less guessing.
              <br />
              <span>More room to imagine.</span>
            </h2>
            <p>
              Get beyond a collection of photographs. Follow the stairs, find
              the room next door, and see how a home fits together before you
              visit.
            </p>
            <div className="intro-detail">
              <span>Built from listing photos & floor plans</span>
              <span>
                Made to explore at your own pace <Arrow />
              </span>
            </div>
          </div>
        </section>

        <section
          className="demo-section page-width"
          id="demo"
          aria-labelledby="demo-title"
        >
          <div className="section-heading">
            <div>
              <div className="section-label">
                <i /> Step inside a real example
              </div>
              <h2 id="demo-title">
                Noaks väg 3B<span className="heading-dot">.</span>
              </h2>
            </div>
            <p>
              A home in Älvsjö, Stockholm.
              <br />
              One connected journey, from hall to attic.
            </p>
          </div>
          <div className="demo-bar">
            <div
              className="demo-tabs"
              role="group"
              aria-label="Choose your experience"
            >
              <button
                aria-pressed={mode !== "tour"}
                onClick={() => showDemo("video")}
              >
                Watch the film <span>↗</span>
              </button>
              <button
                aria-pressed={mode === "tour"}
                onClick={() => showDemo("tour")}
              >
                Explore in 3D <span>↗</span>
              </button>
            </div>
            <span className="demo-quality">
              {mode === "tour" ? "MOVE AT YOUR OWN PACE" : "4K · 60 FPS · 3:09"}
            </span>
          </div>
          <div
            className={`demo-stage ${mode === "tour" ? "tour-stage" : ""}`}
            ref={demo}
          >
            <button
              className="exit-fullscreen"
              onClick={() => document.exitFullscreen().catch(() => {})}
            >
              Exit full screen ×
            </button>
            {mode === "poster" && (
              <>
                <img
                  className="demo-poster"
                  src="/showcase/noaks/poster.jpg"
                  alt="A frame from the existing Noaks väg 3B 3D film"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <button
                  className="play-film"
                  onClick={() => showDemo("video")}
                  aria-label="Play Noaks väg 3B walkthrough film"
                >
                  <span aria-hidden="true">▶</span>
                  <span>
                    Take the tour<small>3 minutes inside Noaks väg 3B</small>
                  </span>
                </button>
                <span className="frame-label">The original 3D walkthrough</span>
              </>
            )}
            {mode !== "poster" && !showcase && (
              <div className="media-message" role="status">
                <p>Preparing your view…</p>
              </div>
            )}
            {mode === "video" && showcase?.available && !mediaError && (
              <video
                ref={video}
                className="demo-video"
                src="/showcase/noaks/film.mp4"
                poster="/showcase/noaks/poster.jpg"
                controls
                playsInline
                autoPlay
                preload="metadata"
                aria-label="Noaks väg 3B full walkthrough video"
                onError={() =>
                  setMediaError(
                    "The film could not be loaded. You can retry or explore the interactive tour.",
                  )
                }
              />
            )}
            {mode === "tour" && showcase?.tourAvailable && (
              <iframe
                key={mode}
                className="tour-frame"
                src={`${showcase.tourURL}?room=1&mode=explore&quality=maximum`}
                title="Interactive Noaks väg 3B walkthrough"
                allow="fullscreen; autoplay"
                allowFullScreen
              />
            )}
            {(mediaError ||
              (mode === "video" && showcase && !showcase.available) ||
              (mode === "tour" && showcase && !showcase.tourAvailable)) && (
              <div className="media-message" role="status">
                <span className="section-label">Your local showcase</span>
                <h3>
                  {mediaError
                    ? "Let’s try that again."
                    : "The example isn’t running here yet."}
                </h3>
                <p>
                  {mediaError ||
                    (mode === "tour"
                      ? "Start the existing Noaks browser tour, then reload this page. You can still watch the film or try your own listing."
                      : "The original film is stored with the Noaks project. Connect that folder to see it here, or explore the studio’s included demo.")}
                </p>
                <div className="inline-actions">
                  {mediaError && (
                    <button
                      className="button light"
                      onClick={() => setMediaError("")}
                    >
                      Retry film
                    </button>
                  )}
                  <a className="button light" href="/studio/">
                    Open the studio <Arrow />
                  </a>
                  {mode === "tour" && showcase?.available && (
                    <button
                      className="text-link"
                      onClick={() => showDemo("video")}
                    >
                      Watch the film <Arrow />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {mode === "tour" && showcase?.tourAvailable && (
            <div className="tour-help">
              <p>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> to move <span>·</span> Drag to look around{" "}
                <span>·</span> Use the on-screen controls on touch devices
              </p>
              <button
                onClick={() => {
                  demo.current
                    ?.requestFullscreen()
                    .catch(() =>
                      setMediaError(
                        "Your browser does not support full screen here. Use the tour’s Focus view instead.",
                      ),
                    );
                }}
              >
                Full screen <Arrow />
              </button>
            </div>
          )}
          <div className="demo-facts">
            <span>
              <strong>3</strong> floors connected
            </span>
            <span>
              <strong>65</strong> reference images
            </span>
            <span>
              <strong>26</strong> film chapters
            </span>
            <a href={listingURL} target="_blank" rel="noreferrer">
              View the Hemnet listing <Arrow />
            </a>
          </div>
          <p className="evidence-note">
            Photo-based reconstruction. Dimensions and some details are
            estimated. Source photography: Jean Vanrop / Vanrop Photography.
          </p>
        </section>

        <section
          className="details-section page-width"
          aria-labelledby="details-title"
        >
          <div className="detail-photo">
            <img
              src="/showcase/noaks/attic.jpg"
              alt="The attic sitting room and circular window at Noaks väg 3B"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span>NOAKS VÄG 3B / LISTING PHOTOGRAPH</span>
          </div>
          <div className="detail-copy">
            <div className="section-label">
              <i /> The spaces between the photos
            </div>
            <h2 id="details-title">
              See the room.
              <br />
              Understand
              <br />
              <span>the whole home.</span>
            </h2>
            <p>
              A floor plan gives you the outline. Moving through it gives you a
              sense of the space. Explore the original home, with its rooms,
              stairs and surroundings kept together.
            </p>
            <button className="text-link" onClick={() => showDemo("tour")}>
              Find your way around <Arrow />
            </button>
          </div>
        </section>

        <section className="process-section" id="how-it-works">
          <div className="page-width">
            <div className="section-heading">
              <div>
                <div className="section-label">
                  <i /> From a link to a sense of place
                </div>
                <h2>
                  Your next viewing,
                  <br />
                  <span>with a little more clarity.</span>
                </h2>
              </div>
              <a className="text-link" href="#try-it">
                Try it yourself <Arrow />
              </a>
            </div>
            <div className="process-grid">
              {[
                [
                  "01",
                  "Bring the listing.",
                  "Paste a Hemnet link. Import the listing photos and floor plans, or upload your own references.",
                ],
                [
                  "02",
                  "Build the picture.",
                  "Review your references, add what you know, and create an editable 3D draft with AI or the local Codex skill.",
                ],
                [
                  "03",
                  "Walk through it.",
                  "Explore with your keyboard, follow the camera tour, or refine and render the scene in Unreal Engine.",
                ],
              ].map(([number, title, description]) => (
                <article key={number}>
                  <span className="step-number">/{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="try-section page-width"
          id="try-it"
          aria-labelledby="try-title"
        >
          <div>
            <div className="section-label">
              <i /> Make room for your next home
            </div>
            <h2 id="try-title">
              Found a place?
              <br />
              <span>Let’s step inside.</span>
            </h2>
            <p>
              Bring the Hemnet listing you keep coming back to.
              <br />
              Your walkthrough starts with a closer look.
            </p>
          </div>
          <form className="listing-form" onSubmit={submit}>
            <label htmlFor="hemnet-link">Your Hemnet listing</label>
            <div className="listing-field">
              <input
                id="hemnet-link"
                name="listing"
                type="url"
                placeholder="https://www.hemnet.se/bostad/…"
                required
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setFormError("");
                }}
                aria-describedby={formError ? "listing-error" : "listing-hint"}
                aria-invalid={!!formError}
              />
              <button className="button dark" type="submit">
                Continue to studio <Arrow />
              </button>
            </div>
            {formError && (
              <p className="form-error" id="listing-error" role="alert">
                {formError}
              </p>
            )}
            <p id="listing-hint">
              Confirm photo permission in the studio, then review the imported
              references. AI generation uses your own API key.
            </p>
            <div className="form-bottom">
              <span>No link yet?</span>
              <a href="/studio/">
                Upload photos or explore the demo <Arrow />
              </a>
            </div>
          </form>
        </section>

        <section
          className="faq-section page-width"
          id="questions"
          aria-labelledby="faq-title"
        >
          <div>
            <div className="section-label">
              <i /> A few things to know
            </div>
            <h2 id="faq-title">
              Before you
              <br />
              <span>step inside.</span>
            </h2>
          </div>
          <div className="faq-list">
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer" id="footer">
        <div className="page-width">
          <div className="footer-invitation">
            <h2>
              Your next home.
              <br />A little closer.
            </h2>
            <a href="#try-it" className="text-link">
              Start with a Hemnet link <Arrow />
            </a>
          </div>
          <div className="footer-directory">
            <nav aria-label="Explore Walkthrough Studio">
              <span className="footer-label">Explore</span>
              <a href="#home">Home</a>
              <a href="#demo">Noaks väg 3B</a>
              <a href="#how-it-works">How it works</a>
              <a href="#questions">Questions</a>
            </nav>
            <nav aria-label="Studio resources">
              <span className="footer-label">Make it yours</span>
              <a href="#try-it">Try your listing</a>
              <a href="/studio/">Open studio</a>
              <a
                href="https://github.com/akkikumar72/hemnet-walkthrough-studio/tree/main/skills/unreal-home-wizard"
                target="_blank"
                rel="noreferrer"
              >
                Local Codex skill <Arrow />
              </a>
              <a
                href="https://github.com/akkikumar72/hemnet-walkthrough-studio"
                target="_blank"
                rel="noreferrer"
              >
                GitHub <Arrow />
              </a>
            </nav>
            <div className="footer-note">
              <span className="footer-label">Stockholm, Sweden</span>
              <p>
                Built during a home search.
                <br />
                Made for a better first look.
              </p>
              <span>Photos. Floor plans. A sense of place.</span>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Walkthrough Studio</span>
            <span>Independent project. Not affiliated with Hemnet.</span>
            <a href="#home">Back to top ↑</a>
          </div>
          <a
            className="footer-wordmark"
            href="#home"
            aria-label="Walkthrough Studio, back to top"
          >
            <span>Walkthrough</span> <span>Studio</span>
          </a>
        </div>
      </footer>
    </>
  );
}
