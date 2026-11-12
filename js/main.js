// The Flash Electric: page behaviour. Everything here is progressive; the page reads fine without it.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // fluid glass: the specular highlight follows the pointer across every button
  document.addEventListener('pointermove', (e) => {
    const b = e.target.closest?.('.btn'); if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', (e.clientX - r.left) + 'px'); b.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // one reveal, visible by default
  const rv = $$('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rv.forEach((el) => io.observe(el));
  } else rv.forEach((el) => el.classList.add('is-in'));

  // nav: mark the section in view
  const links = $$('.nav-links a');
  const secs = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id))); }), { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach((s) => so.observe(s));
  }
  $$('.menu-panel a').forEach((a) => a.addEventListener('click', () => $('.menu')?.removeAttribute('open')));

  // reviews: only offer "Read more" where the text is clamped
  $$('.review').forEach((r) => {
    const q = $('blockquote', r), b = $('.more', r); if (!q || !b) return;
    if (q.scrollHeight > q.clientHeight + 2) {
      b.hidden = false;
      b.addEventListener('click', () => { const open = r.classList.toggle('is-open'); b.textContent = open ? 'Show less' : 'Read more'; });
    }
  });
  const hcp = $('.hcp-reviews');
  hcp?.addEventListener('toggle', () => { const f = $('iframe', hcp); if (hcp.open && f && !f.src) f.src = f.dataset.src; });

  // forms
  const rules = {
    name: (v) => v.trim().length < 2 ? 'Enter your name.' : '',
    phone: (v) => v.replace(/\D/g, '').length < 10 ? 'Enter a 10-digit phone number.' : '',
    email: (v) => v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? 'Enter a valid email address.' : '',
  };
  function validate(form) {
    let ok = true;
    $$('input,select,textarea', form).forEach((el) => {
      const f = el.closest('.field'); if (!f || !rules[el.name]) return;
      const msg = (el.required || el.value) ? rules[el.name](el.value) : '';
      f.classList.toggle('has-error', !!msg); const err = $('.field-error', f); if (err) err.textContent = msg; el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (msg) ok = false;
    });
    return ok;
  }
  async function send(form, subject) {
    const status = $('.form-status', form), btn = $('button[type=submit]', form);
    if ($('[name=website]', form)?.value) return; // honeypot
    if (!validate(form)) { status.dataset.state = 'err'; status.textContent = 'Check the highlighted fields.'; $('.has-error input', form)?.focus(); return; }
    const data = Object.fromEntries(new FormData(form)); delete data.website;
    btn.classList.add('is-loading'); btn.disabled = true; status.dataset.state = ''; status.textContent = '';
    const endpoint = form.dataset.endpoint;
    try {
      if (endpoint) {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ subject, ...data }) });
        if (!res.ok) throw new Error('bad status');
        status.dataset.state = 'ok'; status.textContent = 'Sent. We reply within 24 hours.'; form.reset();
      } else {
        // no endpoint wired yet: hand the request to the visitor's mail app so nothing is silently lost
        const body = Object.entries(data).filter(([, v]) => v).map(([k, v]) => k + ': ' + v).join('\n');
        location.href = 'mailto:' + form.dataset.mailto + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        status.dataset.state = 'ok'; status.textContent = 'Opening your email app. You can also call 770-584-6186.';
      }
    } catch (e) {
      status.dataset.state = 'err'; status.textContent = 'That did not send. Call 770-584-6186 or try again.';
    } finally { btn.classList.remove('is-loading'); btn.disabled = false; }
  }
  const est = $('#estimate');
  est?.addEventListener('submit', (e) => { e.preventDefault(); send(est, 'Free estimate request'); });
  est?.addEventListener('blur', (e) => { if (e.target.name && rules[e.target.name]) validate(est); }, true);

  // offers dialog
  const dlg = $('#offer'), of = $('#offer-form');
  if (dlg && typeof dlg.showModal === 'function') {
    $$('[data-offer]').forEach((b) => b.addEventListener('click', () => {
      $('#offer-for').textContent = b.dataset.amount + ' off: ' + b.dataset.offer; $('#o-offer').value = b.dataset.amount + ' off ' + b.dataset.offer;
      $('.form-status', dlg).textContent = ''; dlg.showModal(); $('#o-name').focus();
    }));
    $('[data-close]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    of.addEventListener('submit', (e) => { e.preventDefault(); send(of, 'Text me this offer: ' + $('#o-offer').value); });
  } else $$('[data-offer]').forEach((b) => b.setAttribute('hidden', ''));
})();
