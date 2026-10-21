// Site-wide behavior: mobile navigation, backdrop, scroll-lock, and dynamic WhatsApp links.
(function () {
  /* Mobile Navigation ---------------------------------------------------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");

  if (toggle && nav) {
    const label = toggle.querySelector(".visually-hidden");

    // Create backdrop element if it doesn't already exist
    let backdrop = document.querySelector(".nav-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "nav-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      document.body.appendChild(backdrop);
    }

    function setOpen(isOpen) {
      toggle.setAttribute("aria-expanded", String(isOpen));
      nav.classList.toggle("is-open", isOpen);
      backdrop.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("nav-open", isOpen);
      if (label) label.textContent = isOpen ? "Cerrar menú" : "Abrir menú";
    }

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    backdrop.addEventListener("click", () => setOpen(false));

    // Close menu when clicking any nav link inside
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset when resizing past mobile breakpoint
    window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  }

  /* WhatsApp Link Population ---------------------------------------------- */
  function syncWhatsAppLinks() {
    const phone = window.MICAR_CONFIG?.whatsappPhone || "";
    const phoneDigits = phone.replace(/\D/g, "");
    const defaultMsg = encodeURIComponent(
      window.MICAR_CONFIG?.defaultMessage || "¡Hola! Quisiera consultar por disponibilidad en Cabañas MICAR."
    );

    const href = phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${defaultMsg}`
      : `https://api.whatsapp.com/send?text=${defaultMsg}`;

    document.querySelectorAll("[data-whatsapp-link]").forEach((el) => {
      el.href = href;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncWhatsAppLinks);
  } else {
    syncWhatsAppLinks();
  }
})();
