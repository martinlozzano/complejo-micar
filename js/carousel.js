// Horizontal carousel built on native scroll-snap; buttons scroll one slide at a time.
(function () {
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector(".carousel__track");
    const prev = carousel.querySelector("[data-carousel-prev]");
    const next = carousel.querySelector("[data-carousel-next]");
    if (!track || !prev || !next) return;

    function slideStep() {
      const slide = track.querySelector(".carousel__slide");
      if (!slide) return track.clientWidth;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return slide.getBoundingClientRect().width + gap;
    }

    function updateButtons() {
      const maxScroll = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= maxScroll - 1;
    }

    prev.addEventListener("click", () => {
      track.scrollBy({ left: -slideStep() });
    });

    next.addEventListener("click", () => {
      track.scrollBy({ left: slideStep() });
    });

    track.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    updateButtons();
  });

  // Amenities mobile infinite auto-displacement carousel
  document.querySelectorAll("[data-amenities-track]").forEach((amenitiesTrack) => {
    const originalList = amenitiesTrack.querySelector(".feature-strip");
    if (originalList) {
      const clone = originalList.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("feature-strip--clone");
      amenitiesTrack.appendChild(clone);

      amenitiesTrack.addEventListener(
        "touchstart",
        () => amenitiesTrack.classList.add("is-paused"),
        { passive: true }
      );
      amenitiesTrack.addEventListener(
        "touchend",
        () => amenitiesTrack.classList.remove("is-paused"),
        { passive: true }
      );
    }
  });
})();

