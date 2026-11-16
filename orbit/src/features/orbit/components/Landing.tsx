"use client";
import { useEffect, useRef } from "react";
import { drawOrbit } from "./orbital";
export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = root.current?.querySelector("canvas");
    if (canvas) return drawOrbit(canvas);
  }, []);
  function choose(e: React.MouseEvent<HTMLDivElement>) {
    const button = (e.target as HTMLElement).closest(".sample-option");
    if (!button) return;
    root.current
      ?.querySelectorAll<HTMLButtonElement>(".sample-option")
      .forEach((b) => {
        b.classList.toggle("selected", b === button);
        b.querySelector("span")!.textContent = b === button ? "✓" : "○";
        b.setAttribute("aria-pressed", String(b === button));
      });
  }
  return (
    <div className="landing" ref={root} onClick={choose}>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span aria-hidden="true">♡</span> DATING &amp; FRIENDSHIP
            </div>
            <h1>
              A little closer
              <br />
              <span className="serif">to love.</span>
            </h1>
            <p>
              The best connections start with the little things. Answer 40
              questions and meet people who share what matters to you.
            </p>
            <div className="hero-actions">
              <a className="btn" href="#register">
                Find my orbit <span className="arrow">↗</span>
              </a>
              <a
                className="video-link"
                href="#how-it-works"
                data-scroll="how-it-works"
              >
                <span className="play">▶</span> Here's how it works
              </a>
            </div>
            <div className="hero-note">
              <div className="mini-orbs" aria-hidden="true">
                <i>✿</i>
                <i>♥</i>
                <i>✦</i>
              </div>
              <span>For the slow burns and the late-night talks.</span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Two interlocking rose and champagne rings"
          >
            <div className="halo"></div>
            <div className="orbit-path"></div>
            <div className="orbit-path two"></div>
            <canvas id="orbital" aria-hidden="true"></canvas>
            <span className="star" aria-hidden="true">
              ✧
            </span>
            <span className="star second" aria-hidden="true">
              ♡
            </span>
            <span className="orbit-heart" aria-hidden="true">
              ♥
            </span>
            <div className="float-card glass match-chip">
              <span className="chip-icon">♡</span>
              <span>
                Same wavelength.
                <br />
                <small>Shared values. Mutual interest.</small>
              </span>
            </div>
            <div className="float-card glass vibe-card">
              <span className="overline">IT'S THE LITTLE THINGS</span>
              <h3>Things to fall for.</h3>
              <div className="tags">
                <span className="tag">☕ Chai & deep talks</span>
                <span className="tag">♫ Shared playlists</span>
                <span className="tag">✧ A little spontaneous</span>
              </div>
            </div>
            <div className="float-card glass spark-card">
              <span className="chip-icon">♡</span>
              <span>
                Connection, with intention.
                <small>Let your personality make the first move.</small>
              </span>
            </div>
            <span className="art-caption">It starts with a little spark.</span>
          </div>
        </section>
        <div className="ribbon">
          <span>
            <b>✳</b> Personality comes first
          </span>
          <span>
            <b>⌁</b> Thoughtful matching
          </span>
          <span>
            <b>♡</b> Every identity belongs
          </span>
          <span>
            <b>↗</b> No endless swiping
          </span>
        </div>
        <section className="section" id="how-it-works">
          <div className="section-head">
            <div>
              <div className="eyebrow">A DIFFERENT WAY TO MEET</div>
              <h2>
                Less scrolling. <span className="serif">More possibility.</span>
              </h2>
            </div>
            <p>
              A few honest answers. A little anticipation.
              <br />
              And someone worth getting to know.
            </p>
          </div>
          <div className="steps">
            <article className="step">
              <div className="step-top">
                <span className="step-icon">✎</span>
                <span className="step-num">01 / BE YOURSELF</span>
              </div>
              <h3>Tell us your kind of weird.</h3>
              <p>
                Your Sunday rituals. Your big dreams. How you show up for
                people. The stuff a selfie can't say.
              </p>
              <div className="step-footer">
                <span>40 questions. All you.</span>
                <span>↗</span>
              </div>
            </article>
            <article className="step">
              <div className="step-top">
                <span className="step-icon">⌘</span>
                <span className="step-num">02 / TRUST THE TIMING</span>
              </div>
              <h3>A little room for chemistry.</h3>
              <p>
                Join a matching round. When it closes, we look for mutual
                preferences, shared values, and natural connection.
              </p>
              <div className="step-footer">
                <span>Intentional rounds, not infinite feeds.</span>
                <span>↗</span>
              </div>
            </article>
            <article className="step">
              <div className="step-top">
                <span className="step-icon">✧</span>
                <span className="step-num">03 / MEET YOUR ORBIT</span>
              </div>
              <h3>Open a new possibility.</h3>
              <p>
                Get a heads-up by email and see your matches in your dashboard,
                with real reasons you might get along.
              </p>
              <div className="step-footer">
                <span>A thoughtful start to your story.</span>
                <span>↗</span>
              </div>
            </article>
          </div>
        </section>
        <section
          className="section"
          style={{ paddingTop: "5px" }}
          id="our-approach"
        >
          <div className="personality">
            <div>
              <div className="eyebrow">MORE THAN YOUR TYPE</div>
              <h2>
                Good chemistry starts
                <br />
                with the <span className="serif">real you.</span>
              </h2>
              <p>
                Big feelings. Tiny habits. Unreasonably strong opinions about
                chai. We make space for all of it.
              </p>
              <p>
                Our questions go beyond the basics, because the best connections
                usually do too.
              </p>
              <a href="#register" className="btn outline">
                Let's get to know you <span>↗</span>
              </a>
            </div>
            <div className="question-preview glass">
              <span className="overline">A LITTLE TASTE OF THE QUESTIONS</span>
              <h3>
                Your ideal Sunday
                <br />
                looks a little like…
              </h3>
              <button className="sample-option selected">
                ☕ A quiet café and a good book <span>✓</span>
              </button>
              <button className="sample-option">
                ↗ An adventure with no itinerary <span>○</span>
              </button>
              <button className="sample-option">
                ♫ Good food, better company <span>○</span>
              </button>
              <button className="sample-option">
                ☁ My bed. No further questions. <span>○</span>
              </button>
              <div className="question-progress">
                <i></i>
              </div>
              <span className="tiny">No right answers. Just your answers.</span>
            </div>
          </div>
        </section>
        <section className="section" style={{ paddingTop: "0" }}>
          <div className="values">
            <article className="value">
              <span>◌</span>
              <h3>You belong here. As you are.</h3>
              <p>
                Straight, gay, lesbian, bi, questioning, or beyond labels. You
                choose your identity and who you'd like to meet.
              </p>
            </article>
            <article className="value">
              <span>⌑</span>
              <h3>Personal stays personal.</h3>
              <p>
                Your raw survey answers stay private. Matches see a short
                profile and shared interests, not your whole life story.
              </p>
            </article>
            <article className="value">
              <span>✳</span>
              <h3>A starting point. Not a prediction.</h3>
              <p>
                We look for common ground, not a soulmate score. What happens
                next is beautifully, entirely up to you.
              </p>
            </article>
          </div>
        </section>
        <section className="section" style={{ paddingTop: "0" }} id="questions">
          <div className="faq-grid">
            <div>
              <div className="eyebrow">THE LITTLE DETAILS</div>
              <h2>
                Curious?
                <br />
                <span className="serif">We like that.</span>
              </h2>
            </div>
            <div>
              <details>
                <summary>Is this another dating app?</summary>
                <p>
                  Orbit is built around intentional matching rounds. There is no
                  swipe feed: complete your profile, answer the survey, and
                  discover a small set of people when the round is revealed.
                </p>
              </details>
              <details>
                <summary>Who is Orbit for?</summary>
                <p>
                  Adults 18 and over who want to meet people thoughtfully. Set
                  your own identity, mutual gender preferences, age range, and
                  intention — dating or friendship.
                </p>
              </details>
              <details>
                <summary>When will I see my matches?</summary>
                <p>
                  Your dashboard shows when the current round closes. After the
                  administrator runs matching and publishes results, your
                  dashboard updates and a notification email is queued. A match
                  is not guaranteed in a small pool.
                </p>
              </details>
              <details>
                <summary>How does matching actually work?</summary>
                <p>
                  We first check mutual age, gender, location, and intention
                  preferences. Then we compare your survey choices, giving more
                  weight to communication, values, and relationship
                  expectations. Orbit explains shared ground locally, with
                  optional OpenRouter explanations when both people opt in. AI
                  cannot override your preferences.
                </p>
              </details>
              <details>
                <summary>Can I change my answers?</summary>
                <p>
                  Yes. Save a draft, come back later, or edit a submitted survey
                  while the round is open. Answers are locked after the round
                  closes.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section className="section" style={{ padding: "0" }}>
          <div className="cta">
            <div className="eyebrow">YOUR PEOPLE ARE OUT THERE</div>
            <h2>
              Every love story
              <br />
              starts with <span className="serif">a hello.</span>
            </h2>
            <p>Bring your whole self. We'll help you find the common ground.</p>
            <a className="btn" href="#register">
              Find my orbit <span>↗</span>
            </a>
            <div className="tiny" style={{ marginTop: "17px" }}>
              18+ only · Every identity welcome · Always your choice
            </div>
          </div>
        </section>
        <section className="inspiration-credit" aria-label="Inspiration">
          <span>THE SPARK BEHIND ORBIT</span>
          <p>
            Inspired by <cite>13 Reasons Why</cite> —{" "}
            <em>Oh My Dollar Valentine.</em>
          </p>
          <small>
            An independent project, developed by priyx. Not affiliated with the
            show.
          </small>
        </section>
      </main>
    </div>
  );
}
