// Gallery page: category filters, 10-item pagination, and a lightbox built on the native <dialog> element.
(function () {
  const grid = document.querySelector("[data-gallery]");
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll(".gallery-item"));
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const status = document.querySelector("[data-gallery-status]");
  const pagination = document.querySelector("[data-gallery-pagination]");

  const PAGE_SIZE = 9;
  let currentCategory = "todo";
  let currentPage = 1;

  /* Filter & Pagination --------------------------------------------------- */

  function getMatchingItems(category) {
    return items.filter((item) => {
      const categories = (item.dataset.category || "").split(" ");
      return category === "todo" || categories.includes(category);
    });
  }

  function renderPagination(totalItems, totalPages) {
    if (!pagination) return;
    if (totalPages <= 1) {
      pagination.hidden = true;
      pagination.innerHTML = "";
      return;
    }

    pagination.hidden = false;
    pagination.innerHTML = "";

    // Prev button
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "gallery-pagination__btn gallery-pagination__btn--prev";
    prevBtn.setAttribute("aria-label", "Página anterior");
    prevBtn.disabled = currentPage === 1;
    prevBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) goToPage(currentPage - 1);
    });
    pagination.appendChild(prevBtn);

    // Numbered buttons
    for (let p = 1; p <= totalPages; p++) {
      const pageBtn = document.createElement("button");
      pageBtn.type = "button";
      pageBtn.className = "gallery-pagination__btn";
      pageBtn.textContent = String(p);
      pageBtn.setAttribute("aria-label", `Página ${p}`);
      if (p === currentPage) {
        pageBtn.classList.add("is-active");
        pageBtn.setAttribute("aria-current", "page");
      }
      pageBtn.addEventListener("click", () => {
        if (currentPage !== p) goToPage(p);
      });
      pagination.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "gallery-pagination__btn gallery-pagination__btn--next";
    nextBtn.setAttribute("aria-label", "Página siguiente");
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) goToPage(currentPage + 1);
    });
    pagination.appendChild(nextBtn);
  }

  function updateView(shouldScroll = false) {
    const matching = getMatchingItems(currentCategory);
    const totalItems = matching.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    if (currentPage > totalPages) {
      currentPage = 1;
    }

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);

    items.forEach((item) => {
      const matchIndex = matching.indexOf(item);
      const isVisible = matchIndex >= startIndex && matchIndex < endIndex;
      item.hidden = !isVisible;
      delete item.dataset.bento;
    });

    const isEvenPage = currentPage % 2 === 0;
    grid.dataset.pageVariant = isEvenPage ? "even" : "odd";

    // 4x3 Bento: 1 Large Hero (2x2 = 4 cells) + 8 Standard (1x1 = 8 cells) = 12 cells, exactly 3 rows.
    // Preserves broad, uncropped 4:3 perspectives without flat letterboxing.
    const pageItems = matching.slice(startIndex, endIndex);
    if (pageItems.length >= 5) {
      pageItems[0].dataset.bento = "large";
    }

    grid.classList.toggle("is-filtered", currentCategory !== "todo");
    filters.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === currentCategory));
    });

    if (status) {
      if (totalItems === 0) {
        status.textContent = "No hay fotos en esta categoría.";
      } else {
        status.textContent = `Mostrando fotos ${startIndex + 1} a ${endIndex} de ${totalItems}`;
      }
    }

    renderPagination(totalItems, totalPages);

    if (shouldScroll) {
      const topOffset = grid.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: Math.max(0, topOffset), behavior: "smooth" });
    }
  }

  function goToPage(page) {
    currentPage = page;
    updateView(true);
  }

  function applyFilter(category) {
    currentCategory = category;
    currentPage = 1;
    updateView(false);
  }

  const validFilters = filters.map((button) => button.dataset.filter);

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.filter;
      applyFilter(category);
      history.replaceState(null, "", category === "todo" ? location.pathname : `#${category}`);
    });
  });

  function filterFromHash() {
    let category = decodeURIComponent(location.hash.slice(1));
    if (category === "cabanas") category = "cabana1";
    if (validFilters.includes(category)) {
      applyFilter(category);
    } else {
      applyFilter("todo");
    }
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

  // Real photos that match the active filter can be browsed in the lightbox across pages
  function openablePhotos() {
    return getMatchingItems(currentCategory)
      .map((item) => item.querySelector("button.gallery-card"))
      .filter(Boolean);
  }

  function setFading(isFading) {
    image.classList.toggle("is-fading", isFading);
    caption.classList.toggle("is-fading", isFading);
  }

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
      image.src = trigger.dataset.full || thumb.currentSrc || thumb.src;
      image.alt = thumb.alt;
      caption.textContent = trigger.dataset.caption || "";
    };

    if (!animate || reducedMotion.matches) {
      apply();
      setFading(false);
      return;
    }

    const id = ++changeId;
    setFading(true);
    window.setTimeout(() => {
      if (id !== changeId) return;
      apply();
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
    const photos = openablePhotos();
    const idx = photos.indexOf(trigger);
    if (idx !== -1) {
      show(idx);
      dialog.showModal();
    }
  });

  prev.addEventListener("click", () => show(currentIndex - 1, true));
  next.addEventListener("click", () => show(currentIndex + 1, true));
  close.addEventListener("click", () => dialog.close());

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(currentIndex - 1, true);
    if (event.key === "ArrowRight") show(currentIndex + 1, true);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    if (lastTrigger && !lastTrigger.closest(".gallery-item").hidden) {
      lastTrigger.focus();
    }
  });
})();
