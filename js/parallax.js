// Parallax: anything with data-parallax="speed" moves at its own speed while scrolling.
// Negative speed = slower (feels further away), positive = faster (feels closer).

(function () {
  const layers = document.querySelectorAll("[data-parallax]");
  if (layers.length === 0) return;

  // Respect people who've asked their device for less motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;

  function update() {
    const middle = window.innerHeight / 2;

    layers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.parallax) || 0;

      // Measure the parent (which doesn't move) to avoid a feedback loop
      const box = layer.parentElement.getBoundingClientRect();
      const distance = box.top + box.height / 2 - middle;

      layer.style.transform = `translate3d(0, ${distance * speed}px, 0)`;
    });

    ticking = false;
  }

  // Update at most once per screen refresh, however fast the scroll events come in
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();