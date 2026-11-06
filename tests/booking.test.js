const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bookingScript = fs.readFileSync(path.join(__dirname, '../js/booking.js'), 'utf8');

const desktopNavigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 };
const mobileNavigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile', userAgentData: { mobile: true }, maxTouchPoints: 5 };

function bookingForm({ contactEmail = 'consultas+web@example.com', invalidName = false, navigator = desktopNavigator, innerWidth = 1350 } = {}) {
  const values = {
    name: 'María Pérez & familia',
    accommodation: 'cabana1',
    guests: '4',
    checkin: '2030-01-10',
    checkout: '2030-01-13',
    nights: '3',
    message: '¿Pileta + desayuno? #Vacaciones &bcc=otro@example.com\nGracias.\rOtra consulta.',
  };
  let focusedField;
  const fields = Object.fromEntries(Object.entries(values).map(([name, value]) => {
    const attributes = new Map();
    return [name, {
      name,
      id: name,
      value,
      validity: { valid: name !== 'name' || !invalidName, valueMissing: name === 'name' && invalidName },
      validationMessage: '',
      addEventListener() {},
      setAttribute: (key, attribute) => attributes.set(key, attribute),
      getAttribute: (key) => attributes.get(key),
      hasAttribute: (key) => attributes.has(key),
      focus: () => { focusedField = name; },
    }];
  }));
  const status = { textContent: '' };
  const listeners = new Map();
  const buttons = Object.fromEntries(['email', 'whatsapp'].map((channel) => [channel, {
    getAttribute: () => channel,
    addEventListener() {},
  }]));
  const form = {
    elements: { namedItem: (name) => fields[name] },
    querySelector: () => status,
    querySelectorAll: () => Object.values(buttons),
    addEventListener: (event, callback) => listeners.set(event, callback),
  };
  const navigations = [];
  const windows = [];
  vm.runInNewContext(bookingScript, {
    document: {
      querySelector: () => form,
      getElementById: () => null,
    },
    window: {
      navigator,
      innerWidth,
      MICAR_CONFIG: { contactEmail, whatsappPhone: '+54 9 351 1234567' },
      location: { search: '', assign: (url) => navigations.push(url) },
      open: (...args) => windows.push(args),
    },
    URLSearchParams,
  });
  return {
    values,
    navigations,
    windows,
    status,
    focusedField: () => focusedField,
    submit: (channel) => listeners.get('submit')({ preventDefault() {}, submitter: buttons[channel] }),
  };
}

function assertDraft(form, destination, subjectKey) {
  const draft = new URL(destination);
  assert.equal(draft.searchParams.get(subjectKey), 'Consulta de disponibilidad - Cabaña 1');
  assert.equal(draft.searchParams.has('bcc'), false);
  const body = draft.searchParams.get('body');
  for (const value of [form.values.name, 'Cabaña 1', '10/01/2030', '13/01/2030', 'noches: 3', 'personas: 4', '¿Pileta + desayuno? #Vacaciones &bcc=otro@example.com']) {
    assert.ok(body.includes(value), `Missing inquiry detail: ${value}`);
  }
  assert.ok(body.includes('\r\nGracias.\r\nOtra consulta.'));
  assert.ok(!/[\r\n]/.test(body.replace(/\r\n/g, '')), 'Mail body line breaks must be CRLF');
  assert.match(destination, /%0D%0A/);
  return draft;
}

test('mobile email inquiries use the configured mail client with a complete encoded draft', () => {
  const form = bookingForm({ navigator: mobileNavigator });
  form.submit('email');

  assert.equal(form.windows.length, 0, 'Email must not open a webmail tab');
  assert.equal(form.navigations.length, 1);
  const draft = assertDraft(form, form.navigations[0], 'subject');
  assert.equal(draft.protocol, 'mailto:');
  assert.equal(decodeURIComponent(draft.pathname), 'consultas+web@example.com');
  assert.deepEqual([...draft.searchParams.keys()], ['subject', 'body']);
});

test('desktop email inquiries open a new Gmail tab with a complete encoded draft', () => {
  const form = bookingForm();
  form.submit('email');

  assert.equal(form.navigations.length, 0);
  assert.equal(form.windows.length, 1);
  const [destination, target, features] = form.windows[0];
  const draft = assertDraft(form, destination, 'su');
  assert.equal(draft.origin, 'https://mail.google.com');
  assert.equal(draft.pathname, '/mail/');
  assert.deepEqual([...draft.searchParams.keys()], ['view', 'fs', 'to', 'su', 'body']);
  assert.equal(draft.searchParams.get('view'), 'cm');
  assert.equal(draft.searchParams.get('fs'), '1');
  assert.equal(draft.searchParams.get('to'), 'consultas+web@example.com');
  assert.equal(target, '_blank');
  assert.ok(features.split(',').includes('noopener'));
  assert.ok(features.split(',').includes('noreferrer'));
});

test('email routing follows device signals instead of viewport width or touch alone', () => {
  const cases = [
    { label: 'mobile client hint', navigator: { userAgentData: { mobile: true } }, mobile: true },
    { label: 'Android without client hints in landscape', navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Mobile' }, mobile: true, innerWidth: 1100 },
    { label: 'iPhone Safari', navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }, mobile: true },
    { label: 'iPad Safari', navigator: { userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }, mobile: true },
    { label: 'iPad desktop user agent', navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }, mobile: true },
    { label: 'Android tablet with non-phone client hint', navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Tablet)', userAgentData: { mobile: false } }, mobile: true },
    { label: 'narrow Windows desktop', navigator: desktopNavigator, mobile: false, innerWidth: 390 },
    { label: 'touchscreen Windows desktop', navigator: { ...desktopNavigator, maxTouchPoints: 10, userAgentData: { mobile: false } }, mobile: false },
    { label: 'Mac desktop', navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 0 }, mobile: false },
    { label: 'browser without device signals', navigator: {}, mobile: false },
  ];
  for (const scenario of cases) {
    const form = bookingForm(scenario);
    form.submit('email');
    assert.equal(form.navigations.length, Number(scenario.mobile), scenario.label);
    assert.equal(form.windows.length, Number(!scenario.mobile), scenario.label);
    if (scenario.mobile) assert.equal(new URL(form.navigations[0]).protocol, 'mailto:', scenario.label);
    else assert.equal(new URL(form.windows[0][0]).origin, 'https://mail.google.com', scenario.label);
  }
});

test('invalid inquiries stay on the form without opening email on either device type', () => {
  for (const navigator of [desktopNavigator, mobileNavigator]) {
    const form = bookingForm({ invalidName: true, navigator });
    form.submit('email');
    assert.equal(form.navigations.length, 0);
    assert.equal(form.windows.length, 0);
    assert.equal(form.focusedField(), 'name');
  }
});

test('an unconfigured contact email keeps the inquiry available on the form', () => {
  for (const navigator of [desktopNavigator, mobileNavigator]) {
    const form = bookingForm({ contactEmail: '', navigator });
    form.submit('email');
    assert.equal(form.navigations.length, 0);
    assert.equal(form.windows.length, 0);
    assert.match(form.status.textContent, /WhatsApp/);
  }
});

test('WhatsApp inquiries retain their recipient and prefilled message', () => {
  for (const navigator of [desktopNavigator, mobileNavigator]) {
    const form = bookingForm({ navigator });
    form.submit('whatsapp');
    assert.equal(form.navigations.length, 0);
    assert.equal(form.windows.length, 1);
    const [destination, target] = form.windows[0];
    const inquiry = new URL(destination);
    assert.equal(inquiry.origin, 'https://api.whatsapp.com');
    assert.equal(inquiry.searchParams.get('phone'), '5493511234567');
    assert.ok(inquiry.searchParams.get('text').includes(form.values.name));
    assert.equal(target, '_blank');
  }
});
