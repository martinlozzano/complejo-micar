// Booking form: accommodation selection, capacity limits, date/nights sync,
// and redirection to WhatsApp with a pre-formatted message.
(function () {
  const form = document.querySelector("[data-booking-form]");
  if (!form) return;

  // WhatsApp contact number from centralized config (or fallback)
  const WHATSAPP_PHONE = window.MICAR_CONFIG?.whatsappPhone || "";

  const nameInput = form.elements.namedItem("name");
  const accommodation = form.elements.namedItem("accommodation");
  const guests = form.elements.namedItem("guests");
  const guestsHint = document.getElementById("guests-hint");
  const checkIn = form.elements.namedItem("checkin");
  const checkOut = form.elements.namedItem("checkout");
  const nights = form.elements.namedItem("nights");
  const messageInput = form.elements.namedItem("message");
  const status = form.querySelector("[data-booking-status]");

  const ACCOMMODATIONS = {
    casa: { label: "Casa principal", maxGuests: 12 },
    cabana1: { label: "Cabaña 1", maxGuests: 6 },
    cabana2: { label: "Cabaña 2", maxGuests: 3 },
    cabana3: { label: "Cabaña 3", maxGuests: 6 },
  };

  /* Dates and nights helpers ---------------------------------------------- */

  function toISODate(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function addDays(isoDate, days) {
    const date = new Date(`${isoDate}T00:00:00`);
    date.setDate(date.getDate() + Number(days));
    return toISODate(date);
  }

  function getDaysBetween(isoDate1, isoDate2) {
    const d1 = new Date(`${isoDate1}T00:00:00`);
    const d2 = new Date(`${isoDate2}T00:00:00`);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  function formatDisplayDate(isoDate) {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  const today = toISODate(new Date());
  checkIn.min = today;
  checkOut.min = addDays(today, 1);
  if (nights) nights.min = "1";

  // Check-in listener: update check-out minimum and synchronize nights.
  checkIn.addEventListener("change", () => {
    if (!checkIn.value) return;
    checkOut.min = addDays(checkIn.value, 1);

    if (nights && nights.value && Number(nights.value) >= 1) {
      checkOut.value = addDays(checkIn.value, nights.value);
    } else if (checkOut.value) {
      if (checkOut.value <= checkIn.value) {
        checkOut.value = addDays(checkIn.value, 1);
        if (nights) nights.value = 1;
      } else if (nights) {
        nights.value = getDaysBetween(checkIn.value, checkOut.value);
      }
    }
    showError(checkIn);
    if (checkOut.value) showError(checkOut);
  });

  // Check-out listener: calculate nights from dates.
  checkOut.addEventListener("change", () => {
    if (checkIn.value && checkOut.value) {
      if (checkOut.value > checkIn.value) {
        if (nights) nights.value = getDaysBetween(checkIn.value, checkOut.value);
      }
    }
    showError(checkOut);
  });

  // Nights listener: calculate check-out from nights.
  if (nights) {
    nights.addEventListener("input", () => {
      const numNights = Number(nights.value);
      if (numNights >= 1 && checkIn.value) {
        checkOut.value = addDays(checkIn.value, numNights);
      }
      showError(nights);
    });
  }

  /* Accommodation and capacity handling ------------------------------------ */

  function updateCapacityLimit() {
    const selectedKey = accommodation.value;
    const place = ACCOMMODATIONS[selectedKey];

    if (!place) {
      guests.disabled = true;
      guests.value = "";
      guests.placeholder = "Elegí primero el lugar";
      if (guestsHint) {
        guestsHint.textContent = "Elegí un lugar para habilitar este campo.";
      }
      return;
    }

    guests.disabled = false;
    guests.max = place.maxGuests;
    guests.placeholder = `Hasta ${place.maxGuests} personas`;
    if (guestsHint) {
      guestsHint.textContent = `Capacidad máxima: ${place.maxGuests} personas.`;
    }

    validateGuestsCapacity();
  }

  function validateGuestsCapacity() {
    const selectedKey = accommodation.value;
    const place = ACCOMMODATIONS[selectedKey];

    if (!place) {
      guests.setCustomValidity("");
      return true;
    }

    if (!guests.value) {
      guests.setCustomValidity("");
      return false;
    }

    const val = Number(guests.value);
    if (val > place.maxGuests) {
      guests.setCustomValidity(
        `${place.label} permite un máximo de ${place.maxGuests} personas.`
      );
      showError(guests);
      return false;
    }

    if (val < 1) {
      guests.setCustomValidity("Ingresá al menos 1 persona.");
      showError(guests);
      return false;
    }

    guests.setCustomValidity("");
    showError(guests);
    return true;
  }

  accommodation.addEventListener("change", () => {
    updateCapacityLimit();
    showError(accommodation);
  });

  guests.addEventListener("input", () => {
    validateGuestsCapacity();
  });

  /* Validation messages --------------------------------------------------- */

  const messages = {
    name: { valueMissing: "Ingresá tu nombre y apellido." },
    accommodation: { valueMissing: "Seleccioná el lugar a reservar." },
    guests: {
      valueMissing: "Ingresá la cantidad de personas.",
      rangeOverflow: "Supera la capacidad máxima del lugar.",
      rangeUnderflow: "Debe ser al menos 1 persona.",
    },
    checkin: {
      valueMissing: "Elegí la fecha de ingreso.",
      rangeUnderflow: "La fecha de ingreso no puede ser anterior a hoy.",
    },
    checkout: {
      valueMissing: "Elegí la fecha de egreso.",
      rangeUnderflow: "La fecha de egreso tiene que ser posterior a la de ingreso.",
    },
    nights: {
      valueMissing: "Ingresá la cantidad de noches.",
      rangeUnderflow: "Debe ser al menos 1 noche.",
    },
  };

  function errorFor(field) {
    if (field.validationMessage) return field.validationMessage;
    const { validity } = field;
    if (validity.valid) return "";
    const fieldMessages = messages[field.name] || {};
    const failed = Object.keys(fieldMessages).find((key) => validity[key]);
    return fieldMessages[failed] || "Revisá este campo.";
  }

  function showError(field) {
    if (!field) return true;
    const message = errorFor(field);
    const errorEl = document.getElementById(`${field.id}-error`);
    field.setAttribute("aria-invalid", String(Boolean(message)));
    if (errorEl) errorEl.textContent = message;
    return !message;
  }

  const fields = [nameInput, accommodation, guests, checkIn, checkOut, nights].filter(Boolean);

  fields.forEach((field) => {
    field.addEventListener("blur", () => {
      if (field.value || field.hasAttribute("aria-invalid")) showError(field);
    });
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") showError(field);
    });
  });

  /* Submit: redirect to WhatsApp ------------------------------------------ */

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "";

    // Force validation on all fields
    validateGuestsCapacity();
    const invalid = fields.filter((field) => !showError(field));

    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const place = ACCOMMODATIONS[accommodation.value]?.label || accommodation.value;
    const clientName = nameInput.value.trim();
    const numNights = nights ? nights.value : getDaysBetween(checkIn.value, checkOut.value);
    const inDate = formatDisplayDate(checkIn.value);
    const outDate = formatDisplayDate(checkOut.value);
    const numGuests = guests.value;
    const extraMessage = messageInput ? messageInput.value.trim() : "";

    let text = `¡Hola! Me gustaría hacer una reserva en Cabañas MICAR.\n\n` +
      `*Datos de la reserva:*\n` +
      `• *Nombre:* ${clientName}\n` +
      `• *Lugar:* ${place}\n` +
      `• *Fecha de ingreso:* ${inDate}\n` +
      `• *Fecha de egreso:* ${outDate}\n` +
      `• *Cantidad de noches:* ${numNights}\n` +
      `• *Cantidad de personas:* ${numGuests}`;

    if (extraMessage) {
      text += `\n• *Consulta:* ${extraMessage}`;
    }

    const phoneDigits = WHATSAPP_PHONE.replace(/\D/g, "");
    const whatsappUrl = phoneDigits
      ? `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    status.textContent = "¡Redirigiendo a WhatsApp para enviar tu reserva!";
    window.open(whatsappUrl, "_blank");
  });
})();
