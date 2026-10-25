// Landing page motion: layered parallax, a 3D photo tilt, a pinned
// "How it works" sequence and a scroll-driven category ticker.
// Everything is inside one function, so names can't clash with other scripts.

(function () {
  const root = document.documentElement;

  // ---------- Respect "reduce motion" ----------
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("lp-still");
    return;
  }
  root.classList.add("lp-motion");

  // ---------- Helpers ----------
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  // ---------- Elements ----------
  const hero = $(".lp-hero");
  const lines = $$(".lp-line");
  const depthLayers = $$(".lp-depth [data-depth]");
  const stage = $(".lp-stage");
  const photo = $(".lp-photo");
  const photoImg = $(".lp-photo img"); // only used if you swap the mockup for a photo
  const floats = $$(".lp-float");

  const steps = $(".lp-steps");
  const stepCards = $$(".lp-steps .step");
  const progressBar = $(".lp-progress span");
  const pinSteps = window.matchMedia("(min-width: 861px)");

  const marquees = $$("[data-marquee]");
  const drifters = $$("[data-speed]");

  // ---------- Mouse position (smoothed), desktop only ----------
  const mouse = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

  if (window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;   // -1 (left) to 1 (right)
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;  // -1 (top) to 1 (bottom)
    }, { passive: true });
  }

  // ---------- 1. Hero ----------
  function updateHero(scrollY, vh) {
    if (!hero) return;
    if (scrollY > hero.offsetHeight + vh) return; // off screen: skip the work

    // 0 at the top of the page, 1 once you've scrolled ~90% of a screen
    const progress = clamp(scrollY / (vh * 0.9));

    // Headline splits apart and fades
    lines.forEach((line, i) => {
      const direction = i === 0 ? -1 : 1;
      line.style.transform = `translate3d(${direction * progress * 22}vw, 0, 0)`;
      line.style.opacity = 1 - progress * 0.9;
    });

    // Floating listings: each depth moves at its own speed, and follows the mouse
    depthLayers.forEach((layer) => {
      const depth = parseFloat(layer.dataset.depth) || 0;
      const x = smooth.x * depth * 24;
      const y = -scrollY * depth * 0.45 + smooth.y * depth * 16;
      layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });

    // Photo: starts tilted back in 3D, flattens as it scrolls into view
    if (stage && photo) {
      const box = stage.getBoundingClientRect();
      const reveal = clamp((vh - box.top) / (vh * 0.85));
      const tilt = (1 - reveal) * 18;
      const scale = 0.86 + reveal * 0.14;
      photo.style.transform = `rotateX(${tilt}deg) scale(${scale})`;

      // The image inside drifts slower than its frame
      const fromCentre = box.top + box.height / 2 - vh / 2;
      if (photoImg) {
        photoImg.style.transform = `translate3d(0, ${fromCentre * -0.12}px, 0)`;
      }

      // Floating cards drift faster, and with the mouse
      floats.forEach((card) => {
        const depth = parseFloat(card.dataset.depth) || 0;
        const x = smooth.x * depth * 14;
        const y = fromCentre * depth * 0.22 + smooth.y * depth * 10;
        card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    }
  }

  // ---------- 2. How it works: pinned, plays one step at a time ----------
  function updateSteps(vh) {
    if (!steps || stepCards.length === 0) return;

    if (!pinSteps.matches) {
      // Phones: no pinning, just show every step normally
      stepCards.forEach((card) => {
        card.style.transform = "";
        card.style.opacity = "";
        card.classList.remove("is-active");
      });
      return;
    }

    const box = steps.getBoundingClientRect();
    const scrollable = box.height - vh;
    const progress = clamp(-box.top / scrollable);

    progressBar.style.transform = `scaleX(${progress})`;

    let active = 0;

    stepCards.forEach((card, i) => {
      // Step 1 is visible from the start; each next one arrives in turn
      const reveal = clamp(progress * 3.3 - i + 1);
      if (reveal >= 1) active = i;

      card.style.transform =
        `translate3d(0, ${(1 - reveal) * 90}px, 0) rotate(${(1 - reveal) * -4}deg)`;
      card.style.opacity = 0.2 + reveal * 0.8;
    });

    stepCards.forEach((card, i) => card.classList.toggle("is-active", i === active));
  }

  // ---------- 3. Category ticker: slides sideways as you scroll ----------
  function updateMarquees(vh) {
    marquees.forEach((row) => {
      const box = row.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;

      const speed = parseFloat(row.dataset.marquee) || 0;
      const travelled = vh - box.top;
      row.style.transform = `translate3d(${travelled * speed}px, 0, 0)`;
    });
  }

  // ---------- 4. Gentle depth drift for cards, stats and CTA rings ----------
  function updateDrifters(vh) {
    drifters.forEach((el) => {
      const box = el.parentElement.getBoundingClientRect();
      if (box.bottom < -200 || box.top > vh + 200) return;

      const speed = parseFloat(el.dataset.speed) || 0;
      const fromCentre = box.top + box.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${fromCentre * speed}px, 0)`;
    });
  }

  // ---------- The animation loop ----------
  function frame() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    // Ease the mouse position towards the real one, so movement feels floaty
    smooth.x += (mouse.x - smooth.x) * 0.06;
    smooth.y += (mouse.y - smooth.y) * 0.06;

    updateHero(scrollY, vh);
    updateSteps(vh);
    updateMarquees(vh);
    updateDrifters(vh);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();