// Gallery page: category filters and a lightbox built on the native <dialog> element.
(function () {
  const grid = document.querySelector("[data-gallery]");
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll(".gallery-item"));
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const status = document.querySelector("[data-gallery-status]");

  /* Filters -------------------------------------------------------------- */

  function applyFilter(category) {
    let visibleCount = 0;

    items.forEach((item) => {
      const categories = item.dataset.category.split(" ");
      const isVisible = category === "todo" || categories.includes(category);
      item.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
    });

    grid.classList.toggle("is-filtered", category !== "todo");
    filters.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === category));
    });

    if (status) {
      status.textContent = `Mostrando ${visibleCount} ${visibleCount === 1 ? "foto" : "fotos"}`;
    }
  }

  const validFilters = filters.map((button) => button.dataset.filter);

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.filter;
      applyFilter(category);
      // Keep the active filter in the URL so it can be shared (e.g. galeria.html#casa).
      history.replaceState(null, "", category === "todo" ? location.pathname : `#${category}`);
    });
  });

  // Links like galeria.html#cabanas open the gallery already filtered.
  function filterFromHash() {
    const category = decodeURIComponent(location.hash.slice(1));
    if (validFilters.includes(category)) applyFilter(category);
  }

  filterFromHash();
  window.addEventListener("hashchange", filterFromHash);

  /* Lightbox ------------------------------------------------------------- */

  const dialog = document.querySelector("[data-lightbox]");
  if (!dialog || typeof dialog.showModal !== "function") return;

  const image = dialog.querySelector(".lightbox__img");
  const caption = dialog.querySelector(".lightbox__caption");
  const prev = dialog.querySelector("[data-lightbox-prev]");
  const next = dialog.querySelector("[data-lightbox-next]");
  const close = dialog.querySelector("[data-lightbox-close]");

  const FADE_MS = 220;
  const DECODE_CAP_MS = 600;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let currentIndex = 0;
  let lastTrigger = null;
  let changeId = 0;

  // Only real photos (not placeholders) that match the active filter can be opened.
  function openablePhotos() {
    return items
      .filter((item) => !item.hidden)
      .map((item) => item.querySelector("button.gallery-card"))
      .filter(Boolean);
  }

  function setFading(isFading) {
    image.classList.toggle("is-fading", isFading);
    caption.classList.toggle("is-fading", isFading);
  }

  // Shows the photo at `index`; with `animate`, cross-fades from the current one.
  function show(index, animate = false) {
    const photos = openablePhotos();
    if (!photos.length) return;
    currentIndex = (index + photos.length) % photos.length;

    const trigger = photos[currentIndex];
    const thumb = trigger.querySelector("img");
    const single = photos.length < 2;
    prev.hidden = single;
    next.hidden = single;

    const apply = () => {
      // The grid loads small versions; the lightbox shows the full-size file.
      image.src = trigger.dataset.full || thumb.currentSrc || thumb.src;
      image.alt = thumb.alt;
      caption.textContent = trigger.dataset.caption || "";
    };

    if (!animate || reducedMotion.matches) {
      apply();
      setFading(false);
      return;
    }

    // Ignore stale transitions when the user clicks through photos quickly.
    const id = ++changeId;
    setFading(true);
    window.setTimeout(() => {
      if (id !== changeId) return;
      apply();
      // Fade back in once the new photo is decoded, or after a cap so it never stays hidden.
      const decoded = image.decode().catch(() => {});
      const cap = new Promise((resolve) => window.setTimeout(resolve, DECODE_CAP_MS));
      Promise.race([decoded, cap]).then(() => {
        if (id === changeId) setFading(false);
      });
    }, FADE_MS);
  }

  grid.addEventListener("click", (event) => {
    const trigger = event.target.closest("button.gallery-card");
    if (!trigger) return;
    lastTrigger = trigger;
    show(openablePhotos().indexOf(trigger));
    dialog.showModal();
  });

  prev.addEventListener("click", () => show(currentIndex - 1, true));
  next.addEventListener("click", () => show(currentIndex + 1, true));
  close.addEventListener("click", () => dialog.close());

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(currentIndex - 1, true);
    if (event.key === "ArrowRight") show(currentIndex + 1, true);
  });

  // Clicking the backdrop (outside the figure) closes the lightbox.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    if (lastTrigger) lastTrigger.focus();
  });
})();
