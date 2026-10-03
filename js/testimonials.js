// Testimonial carousel: slides quotes horizontally, auto-advances every few seconds
// and pauses while the user hovers or focuses it.
// "forward" (autoplay and next arrow): the new quote enters from the left, the old one exits right.
// "backward" (previous arrow): the new quote enters from the right, the old one exits left.
(function () {
  const AUTOPLAY_MS = 5000;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.querySelectorAll("[data-testimonials]").forEach((slider) => {
    const track = slider.querySelector(".testimonial-slider__track");
    const slides = Array.from(slider.querySelectorAll(".testimonial"));
    const prev = slider.querySelector("[data-testimonial-prev]");
    const next = slider.querySelector("[data-testimonial-next]");
    if (slides.length < 2 || !track || !prev || !next) return;

    let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
    let timer = null;
    let isHovered = false;
    let hasFocus = false;

    function syncAria() {
      slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== current)));
    }

    function show(index, direction) {
      const nextIndex = (index + slides.length) % slides.length;
      if (nextIndex === current) return;

      const outgoing = slides[current];
      const incoming = slides[nextIndex];
      track.dataset.direction = direction;

      // Snap the incoming quote to this direction's entry side without animating,
      // so it always slides in from the correct edge.
      incoming.classList.add("no-transition");
      incoming.classList.remove("is-leaving");
      void incoming.offsetWidth;
      incoming.classList.remove("no-transition");

      outgoing.classList.remove("is-active");
      outgoing.classList.add("is-leaving");
      incoming.classList.add("is-active");

      current = nextIndex;
      syncAria();
    }

    function stop() {
      window.clearInterval(timer);
      timer = null;
    }

    function start() {
      stop();
      if (reducedMotion.matches || isHovered || hasFocus || document.hidden) return;
      timer = window.setInterval(() => show(current + 1, "forward"), AUTOPLAY_MS);
    }

    // Manual navigation: announce the change to screen readers and restart the countdown.
    function goTo(index, direction) {
      track.setAttribute("aria-live", "polite");
      show(index, direction);
      start();
    }

    prev.addEventListener("click", () => goTo(current - 1, "backward"));
    next.addEventListener("click", () => goTo(current + 1, "forward"));

    slider.addEventListener("mouseenter", () => {
      isHovered = true;
      stop();
    });
    slider.addEventListener("mouseleave", () => {
      isHovered = false;
      start();
    });
    slider.addEventListener("focusin", () => {
      hasFocus = true;
      stop();
    });
    slider.addEventListener("focusout", (event) => {
      if (slider.contains(event.relatedTarget)) return;
      hasFocus = false;
      start();
    });
    document.addEventListener("visibilitychange", start);
    reducedMotion.addEventListener("change", start);

    // Automatic changes stay silent so screen readers are not interrupted every few seconds.
    track.setAttribute("aria-live", "off");
    track.dataset.direction = "forward";
    syncAria();
    start();
  });
})();
