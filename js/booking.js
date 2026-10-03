// Booking form: date constraints, inline validation messages and submit handling.
(function () {
  const form = document.querySelector("[data-booking-form]");
  if (!form) return;

  const checkIn = form.elements.namedItem("checkin");
  const checkOut = form.elements.namedItem("checkout");
  const status = form.querySelector("[data-booking-status]");

  /* Dates ---------------------------------------------------------------- */

  function toISODate(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function addDays(isoDate, days) {
    const date = new Date(`${isoDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  const today = toISODate(new Date());
  checkIn.min = today;
  checkOut.min = addDays(today, 1);

  // Check-out must always be at least one night after check-in.
  checkIn.addEventListener("change", () => {
    if (!checkIn.value) return;
    checkOut.min = addDays(checkIn.value, 1);
    if (checkOut.value && checkOut.value < checkOut.min) checkOut.value = "";
  });

  /* Validation ----------------------------------------------------------- */

  const messages = {
    checkin: {
      valueMissing: "Elegí la fecha de ingreso.",
      rangeUnderflow: "La fecha de ingreso no puede ser anterior a hoy.",
    },
    checkout: {
      valueMissing: "Elegí la fecha de egreso.",
      rangeUnderflow: "La fecha de egreso tiene que ser posterior a la de ingreso.",
    },
    guests: { valueMissing: "Elegí la cantidad de huéspedes." },
    name: { valueMissing: "Ingresá tu nombre y apellido." },
    email: {
      valueMissing: "Ingresá tu email.",
      typeMismatch: "Ingresá un email válido, por ejemplo nombre@email.com.",
    },
    phone: {
      valueMissing: "Ingresá un teléfono de contacto.",
      patternMismatch: "Ingresá un teléfono válido: solo números, espacios, guiones o +.",
    },
  };

  function errorFor(field) {
    const { validity } = field;
    if (validity.valid) return "";
    const fieldMessages = messages[field.name] || {};
    const failed = Object.keys(fieldMessages).find((key) => validity[key]);
    return fieldMessages[failed] || "Revisá este campo.";
  }

  function showError(field) {
    const message = errorFor(field);
    const errorEl = document.getElementById(`${field.id}-error`);
    field.setAttribute("aria-invalid", String(Boolean(message)));
    if (errorEl) errorEl.textContent = message;
    return !message;
  }

  const fields = Array.from(form.querySelectorAll(".form-control"));

  fields.forEach((field) => {
    // Validate once the user leaves a field, then live while they fix it.
    field.addEventListener("blur", () => {
      if (field.value || field.hasAttribute("aria-invalid")) showError(field);
    });
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") showError(field);
    });
  });

  /* Submit --------------------------------------------------------------- */

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "";

    const invalid = fields.filter((field) => !showError(field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    // TODO: send the request once the delivery method is defined (e-mail service, WhatsApp, backend).
    status.textContent =
      "Tu consulta está completa, pero el envío todavía no está configurado en este sitio. Mientras tanto, escribinos por WhatsApp.";
  });
})();
