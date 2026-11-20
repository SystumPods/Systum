/* SYSTUM static site — plain JS, no framework, no dev server. */
(function () {
  'use strict';

  // ---- Settings -----------------------------------------------------------
  // The old form posted to an Emergent preview URL that no longer exists.
  // Put your real endpoint here (expects POST JSON). Left empty, the form opens
  // the visitor's email app with the enquiry pre-filled instead.
  var ENQUIRY_ENDPOINT = '';
  var ENQUIRY_EMAIL = 'hello@systum.in';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Images: never leave a broken icon, never block on a bad file ---------
  function markFailed(img) {
    img.classList.add('img-failed');
    if (img.parentElement) img.parentElement.classList.add('img-failed-wrap');
  }
  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') markFailed(e.target);
  }, true);
  $$('img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) markFailed(img);
  });

  // ---- Scroll reveal --------------------------------------------------------
  var revealEls = $$('.reveal, .mask-up');
  var wrapMap = new Map();
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        (wrapMap.get(en.target) || []).forEach(function (c, i) {
          setTimeout(function () { c.classList.add('in'); }, i * 90);   // staggered lines
        });
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    // Headline lines sit inside overflow:hidden wrappers, so the line itself is always
    // "clipped" and never intersects. Watch the wrapper and reveal the line when it shows.
    revealEls.forEach(function (el) {
      if (el.classList.contains('mask-up')) {
        var w = el.parentElement;
        if (!wrapMap.has(w)) { wrapMap.set(w, []); io.observe(w); }
        wrapMap.get(w).push(el);
      } else { io.observe(el); }
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  // ---- Scroll-zoom image (only works while on screen) ------------------------
  var zoomImg = $('[data-testid="scroll-zoom-image"]');
  if (zoomImg && !reduceMotion) {
    var box = zoomImg.parentElement, ticking = false, visible = false;
    zoomImg.style.willChange = 'transform';
    var update = function () {
      ticking = false;
      var r = box.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      zoomImg.style.transform = 'translateY(' + (24 - 48 * p).toFixed(1) + 'px) scale(' + (0.86 + 0.19 * p).toFixed(3) + ')';
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    new IntersectionObserver(function (es) {
      var now = es[0].isIntersecting;
      if (now && !visible) { window.addEventListener('scroll', onScroll, { passive: true }); update(); }
      if (!now && visible) { window.removeEventListener('scroll', onScroll); }
      visible = now;
    }, { rootMargin: '100px' }).observe(box);
  }


  // ---- Spring engine (replaces framer-motion). The rAF loop only runs while something is moving. ----
  var springs = [], raf = 0, lastT = 0;
  function Spring(k, c, apply) { this.k = k; this.c = c; this.x = 0; this.v = 0; this.to = 0; this.on = false; this.apply = apply; }
  Spring.prototype.set = function (t) {
    this.to = t;
    if (!this.on) { this.on = true; springs.push(this); if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(step); } }
  };
  function step(now) {
    var dt = Math.min((now - lastT) / 1000, 1 / 30), n = Math.max(1, Math.round(dt * 240)), h = dt / n;
    lastT = now; raf = 0;
    for (var i = springs.length - 1; i >= 0; i--) {
      var s = springs[i];
      for (var k = 0; k < n; k++) { s.v += (s.k * (s.to - s.x) - s.c * s.v) * h; s.x += s.v * h; }
      if (Math.abs(s.to - s.x) < 0.005 && Math.abs(s.v) < 0.005) { s.x = s.to; s.v = 0; s.on = false; springs.splice(i, 1); }
      s.apply();
    }
    if (springs.length) raf = requestAnimationFrame(step);
  }
  var finePointer = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var motionOK = !reduceMotion && finePointer;

  if (motionOK) {
    // ---- Kova product cards: 3D tilt that follows the mouse (±3.5°, springy) ----
    $$('[data-testid^="product-card-"]').forEach(function (card) {
      var sX, sY, paint = function () {
        card.style.transform = 'perspective(1200px) rotateX(' + sX.x.toFixed(3) + 'deg) rotateY(' + sY.x.toFixed(3) + 'deg)';
        if (!sX.on && !sY.on && Math.abs(sX.x) + Math.abs(sY.x) < 0.001) card.style.transform = '';
      };
      sX = new Spring(140, 16, paint); sY = new Spring(140, 16, paint);
      card.classList.add('tilt');
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        sY.set(((e.clientX - r.left) / r.width - 0.5) * 7);
        sX.set(((e.clientY - r.top) / r.height - 0.5) * -7);
      });
      card.addEventListener('mouseleave', function () { sX.set(0); sY.set(0); });
    });

    // ---- Magnetic buttons: drift toward the cursor, spring back on leave ----
    $$('div.inline-block').forEach(function (w) {
      var c = w.firstElementChild;
      if (!c || (c.tagName !== 'BUTTON' && c.tagName !== 'A')) return;
      var mx, my, paint = function () { w.style.transform = 'translate3d(' + mx.x.toFixed(2) + 'px,' + my.x.toFixed(2) + 'px,0)'; };
      mx = new Spring(200, 16, paint); my = new Spring(200, 16, paint);
      w.addEventListener('mousemove', function (e) {
        var r = w.getBoundingClientRect();
        mx.set((e.clientX - (r.left + r.width / 2)) * 0.28);
        my.set((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      w.addEventListener('mouseleave', function () { mx.set(0); my.set(0); });
    });
  }

  // ---- Hero: entrance, mouse-follow tilt, scroll parallax ----
  var hero = $('#home'), pod = $('[data-testid="hero-pod-image"]');
  pod = pod && pod.closest('.max-w-\\[620px\\]');
  if (hero && pod) {
    if (!reduceMotion) pod.classList.add('hero-in');
    if (motionOK) {
      var hx, hy, paintHero = function () {
        pod.style.transform = 'perspective(1100px) rotateX(' + (hy.x * -0.04).toFixed(3) + 'deg) rotateY(' + (hx.x * 0.06).toFixed(3) + 'deg)';
      };
      hx = new Spring(60, 14, paintHero); hy = new Spring(60, 14, paintHero);
      pod.classList.add('tilt');
      // listen on the window (the floating header sits above the hero and would swallow events),
      // but only react while the hero is actually on screen
      window.addEventListener('mousemove', function (e) {
        if (hero.getBoundingClientRect().bottom < 0) return;
        hx.set(e.clientX - window.innerWidth / 2);
        hy.set(e.clientY - window.innerHeight / 2);
      }, { passive: true });
    }
    if (!reduceMotion) {
      var podWrap = pod.parentElement, mark = $('.select-none', hero), pTick = false, heroVis = false;
      var parallax = function () {
        pTick = false;
        var r = hero.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / r.height));
        podWrap.style.transform = 'translate3d(0,' + (90 * p).toFixed(1) + 'px,0)';
        if (mark) mark.style.transform = 'translate3d(' + (-60 * p).toFixed(1) + 'px,0,0)';
      };
      var onHeroScroll = function () { if (!pTick) { pTick = true; requestAnimationFrame(parallax); } };
      new IntersectionObserver(function (es) {
        var now = es[0].isIntersecting;
        if (now && !heroVis) window.addEventListener('scroll', onHeroScroll, { passive: true });
        if (!now && heroVis) window.removeEventListener('scroll', onHeroScroll);
        heroVis = now;
      }).observe(hero);
    }
  }

  // ---- Hotspots ----------------------------------------------------------------
  var HOTSPOTS = {
    'hs-glass':     ['Tempered glass door', 'A clear, solid-glass entrance with precise hardware.', 27],
    'hs-display':   ['Display and video camera', 'Mini PC, smart display and camera — meeting-ready out of the box.', 57],
    'hs-light':     ['Smart LED lighting', 'Even, glare-free light tuned for long sessions.', 45],
    'hs-air':       ['Ventilation, HEPA + AQI', 'Filtered airflow with live air-quality sensing and temperature control.', 65],
    'hs-acoustic':  ['Acoustic insulation panels', 'An insulated wall build-up keeps speech inside the pod.', 84],
    'hs-occupancy': ['Occupancy sensing + booking', 'Sensors and booking software keep the pod fair and available.', 74]
  };
  var hsWraps = [];
  Object.keys(HOTSPOTS).forEach(function (id) {
    var btn = $('[data-testid="hotspot-' + id + '"]');
    if (!btn) return;
    var wrap = btn.parentElement, d = HOTSPOTS[id];
    var pop = document.createElement('div');
    pop.className = 'hs-pop ' + (d[2] > 50 ? 'to-left' : 'to-right');
    pop.innerHTML = '<p></p><p></p>';
    pop.children[0].textContent = d[0]; pop.children[1].textContent = d[1];
    wrap.appendChild(pop);
    hsWraps.push(wrap);
    var activate = function () {
      hsWraps.forEach(function (w) { w.classList.toggle('hs-on', w === wrap); });
    };
    ['mouseenter', 'focus', 'click'].forEach(function (ev) { btn.addEventListener(ev, activate); });
    if (id === 'hs-display') wrap.classList.add('hs-on');   // same default as the original
  });

  // ---- Navigation ------------------------------------------------------------------
  var toggle = $('[data-testid="nav-mobile-toggle"]');
  if (toggle) {
    var menu = document.createElement('div');
    menu.id = 'mobile-menu';
    $$('[data-testid^="nav-link-"]').forEach(function (a) {
      var c = document.createElement('a');
      c.href = a.getAttribute('href'); c.textContent = a.textContent.trim();
      menu.appendChild(c);
    });
    document.body.appendChild(menu);
    var setOpen = function (o) {
      menu.classList.toggle('open', o);
      toggle.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
      toggle.setAttribute('aria-expanded', o ? 'true' : 'false');
    };
    toggle.addEventListener('click', function () { setOpen(!menu.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  function go(sel) {
    var el = $(sel);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  // ---- Form + CTA wiring ---------------------------------------------------------------
  var form = $('[data-testid="contact-form"]');
  var state = { interest: '' };
  var interestBtns = {
    'interest-option-meeting-pods': 'Meeting Pods',
    'interest-option-sleeping-pods': 'Sleeping Pods',
    'interest-option-both': 'Both'
  };
  function setInterest(v) {
    state.interest = v;
    Object.keys(interestBtns).forEach(function (tid) {
      var b = $('[data-testid="' + tid + '"]');
      if (b) { b.setAttribute('data-interest', interestBtns[tid]); b.classList.toggle('is-selected', interestBtns[tid] === v); }
    });
  }
  setInterest('');
  Object.keys(interestBtns).forEach(function (tid) {
    var b = $('[data-testid="' + tid + '"]');
    if (b) b.addEventListener('click', function () { setInterest(interestBtns[tid]); });
  });
  function chooseInterest(v) { setInterest(state.interest !== 'Both' ? (v || state.interest) : state.interest); }

  var on = function (tid, fn) { var b = $('[data-testid="' + tid + '"]'); if (b) b.addEventListener('click', fn); };
  on('hero-cta-meeting', function () { go('#kova'); });
  on('hero-cta-sleeping', function () { go('#silencia'); });
  on('problem-to-solution-btn', function () { go('#solution'); });
  on('solution-to-products-btn', function () { go('#kova'); });
  ['explore-kova-1-btn', 'explore-kova-2-btn', 'explore-kova-3-btn'].forEach(function (t) {
    on(t, function () { chooseInterest('Meeting Pods'); go('#contact'); });
  });
  on('silencia-enquire-btn', function () { chooseInterest('Sleeping Pods'); go('#contact'); });

  var toastEl, toastT;
  function toast(msg, isErr) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.toggle('err', !!isErr);
    void toastEl.offsetWidth; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 3600);
  }

  if (form) {
    var val = function (tid) { var f = $('[data-testid="' + tid + '"]', form); return f ? f.value.trim() : ''; };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        name: val('contact-name-input'), company: val('contact-company-input'), email: val('contact-email-input'),
        phone: val('contact-phone-input'), interest: state.interest, message: val('contact-message-input')
      };
      if (!data.name || !data.interest) return toast('Please add your name and product interest.', true);
      if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) return toast("That email doesn't look right.", true);

      var submitBtn = $('[data-testid="contact-submit-btn"]', form);
      if (!ENQUIRY_ENDPOINT) {                                   // no backend configured -> email fallback
        var body = ['Name: ' + data.name, 'Company: ' + data.company, 'Email: ' + data.email, 'Phone: ' + data.phone,
                    'Interested in: ' + data.interest, '', data.message].join('\n');
        window.location.href = 'mailto:' + ENQUIRY_EMAIL + '?subject=' + encodeURIComponent('Enquiry — ' + data.interest) +
                               '&body=' + encodeURIComponent(body);
        return toast('Opening your email app…');
      }
      if (submitBtn) submitBtn.disabled = true;
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 10000);   // can never hang
      fetch(ENQUIRY_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: ctl.signal })
        .then(function (r) { if (!r.ok) throw new Error(r.status); form.reset(); setInterest(''); toast("Enquiry received — we'll reach out shortly."); })
        .catch(function () { toast("Couldn't send right now — please try again.", true); })
        .then(function () { clearTimeout(t); if (submitBtn) submitBtn.disabled = false; });
    });
  }
})();
