/* =========================================================
   Clara Leal — animações
   Abertura, timecode, revelações, troca de planos da
   filmografia, abertura de enquadramento e película.
   ========================================================= */
(() => {
  const body = document.body;
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Abertura ---------- */
  // A abertura completa só roda na primeira visita da sessão.
  let seen = false;
  try {
    seen = sessionStorage.getItem('cl-intro') === '1';
    sessionStorage.setItem('cl-intro', '1');
  } catch (e) { /* armazenamento indisponível: segue normal */ }

  const introMs = reduce ? 0 : seen ? 150 : 2700;
  if (seen || reduce) body.classList.add('skip-intro');

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    body.classList.remove('is-loading');
    body.classList.add('is-ready');
    setTimeout(() => body.classList.add('lb-settled'), reduce ? 0 : 2000);
  };
  setTimeout(start, introMs);
  // Clique ou tecla pula a abertura
  ['click', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, () => setTimeout(start, 0), { once: true, passive: true })
  );

  /* ---------- Timecode (24 fps) ---------- */
  const tc = document.querySelector('[data-timecode]');
  const t0 = performance.now();
  const pad = n => String(n).padStart(2, '0');
  let heroVisible = true;
  const tick = now => {
    if (tc && heroVisible) {
      const s = (now - t0) / 1000;
      const f = Math.floor(s * 24) % 24;
      const sec = Math.floor(s) % 60;
      const min = Math.floor(s / 60) % 60;
      const hr = Math.floor(s / 3600);
      tc.textContent = `${pad(hr)}:${pad(min)}:${pad(sec)}:${pad(f)}`;
    }
    requestAnimationFrame(tick);
  };
  if (!reduce) requestAnimationFrame(tick);

  /* ---------- Divide títulos em palavras (para a máscara) ---------- */
  const splitWords = el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
  };
  document.querySelectorAll('[data-reveal="words"]').forEach(splitWords);
  document.querySelectorAll('[data-reveal="credits"] > *').forEach((el, i) => el.style.setProperty('--i', i));
  document.querySelectorAll('.film__still').forEach(el => { el.dataset.reveal = 'focus'; });

  /* ---------- Contadores ---------- */
  const runCounter = el => {
    const to = +el.dataset.count;
    const from = +(el.dataset.from || 0);
    const padTo = +(el.dataset.pad || 0);
    const fmt = n => String(n).padStart(padTo, '0');
    if (reduce) { el.textContent = fmt(to); return; }
    const dur = 1600;
    const s = performance.now();
    const step = now => {
      const p = clamp((now - s) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(from);
    requestAnimationFrame(step);
  };

  /* ---------- Revelações ao entrar na tela ---------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      entry.target.querySelectorAll('[data-count]').forEach(runCounter);
      revealIO.unobserve(entry.target);
    });
  }, { threshold: .18, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => revealIO.observe(el));

  /* ---------- Filmografia: troca de planos ---------- */
  const shots = [...document.querySelectorAll('.screen__shot')];
  const films = [...document.querySelectorAll('.film')];
  const sceneNum = document.querySelector('[data-scene]');
  const sceneYear = document.querySelector('[data-scene-year]');
  let current = 0;
  let changes = 0;
  let cutTimer = null;

  const startCuts = shot => {
    clearInterval(cutTimer);
    if (!shot || !shot.hasAttribute('data-cuts') || reduce) return;
    const imgs = [...shot.querySelectorAll('img')];
    let k = 0;
    imgs.forEach((im, j) => im.classList.toggle('on', j === 0));
    cutTimer = setInterval(() => {
      k = (k + 1) % imgs.length;
      imgs.forEach((im, j) => im.classList.toggle('on', j === k));
    }, 2600);
  };

  const setActive = n => {
    films.forEach((f, i) => f.classList.toggle('is-active', i === n));
    if (n === current || !shots.length) return;
    const prev = shots[current];
    const next = shots[n];
    shots.forEach(s => { if (s !== prev) s.classList.remove('is-prev'); });
    prev.classList.remove('is-active');
    delete prev.dataset.tr;
    prev.classList.add('is-prev');

    next.classList.remove('is-prev');
    delete next.dataset.tr;
    void next.offsetWidth;
    // Alterna entre dissolve e wipe, como numa montagem
    next.dataset.tr = changes++ % 2 ? 'dissolve' : 'wipe';
    void next.offsetWidth;
    next.classList.add('is-active');
    current = n;

    if (sceneNum) sceneNum.textContent = pad(n + 1);
    const y = films[n].querySelector('.film__meta span');
    if (sceneYear && y) sceneYear.textContent = y.textContent;
    startCuts(next);
  };

  if (films.length) {
    films[0].classList.add('is-active');
    const filmIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(films.indexOf(entry.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    films.forEach(f => filmIO.observe(f));
  }

  // Corte seco no Fim de Jogo também no celular (imagem do card)
  const fimCard = document.querySelector('.film[data-film="4"] .film__still img');
  if (fimCard && !reduce) {
    const srcs = ['assets/img/fim-de-jogo-1.jpg', 'assets/img/fim-de-jogo-2.jpg'];
    new Image().src = srcs[1];
    let k = 0;
    setInterval(() => {
      if (window.innerWidth > 960) return;
      k = (k + 1) % 2;
      fimCard.src = srcs[k];
    }, 2600);
  }

  /* ---------- Rolagem: hero, cabeçalho, parallax, íris, película ---------- */
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const heroMedia = document.querySelector('.hero__media');
  const parallaxEls = [...document.querySelectorAll('[data-parallax]')];
  const sections = [...document.querySelectorAll('main > section, main > div')];

  const iris = document.querySelector('.iris');
  const irisMedia = document.querySelector('[data-iris]');
  const irisImg = irisMedia && irisMedia.querySelector('img');
  const irisText = document.querySelector('[data-iris-text]');

  const reel = document.querySelector('.reel');
  const strip = document.querySelector('[data-strip]');
  const stripImgs = strip ? [...strip.querySelectorAll('img')] : [];
  const reelBar = document.querySelector('[data-reel-bar]');
  let pinReel = false;

  const isDark = el => el.matches('.hero, .section--dark, .iris');

  const layout = () => {
    pinReel = !reduce && window.innerWidth > 960;
    if (reel && strip) {
      if (pinReel) {
        const distance = strip.offsetWidth + 2 * parseFloat(getComputedStyle(strip).marginLeft) - window.innerWidth;
        reel.style.height = `${window.innerHeight + Math.max(0, distance)}px`;
      } else {
        reel.style.height = '';
        strip.style.transform = '';
        stripImgs.forEach(im => { im.style.transform = ''; });
      }
    }
    update();
  };

  let ticking = false;
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };

  function update() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Hero: barras somem e imagem desce mais devagar que a página
    if (hero) {
      const h = hero.offsetHeight;
      heroVisible = y < h;
      if (body.classList.contains('lb-settled')) root.style.setProperty('--hp', clamp(y / (h * .55)).toFixed(4));
      if (heroMedia && heroVisible && !reduce) heroMedia.style.transform = `translate3d(0, ${y * .32}px, 0)`;
    }

    // Cabeçalho: fundo sólido e cor conforme a seção por baixo
    if (header) {
      header.classList.toggle('is-solid', y > 24);
      const probe = header.offsetHeight / 2;
      const under = sections.find(s => {
        const r = s.getBoundingClientRect();
        return r.top <= probe && r.bottom > probe;
      });
      header.dataset.theme = under && !isDark(under) ? 'light' : 'dark';
    }

    if (reduce) return;

    // Parallax leve dentro de molduras
    parallaxEls.forEach(el => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const off = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    });

    // Íris: o enquadramento abre de um scope 2.39:1 até a tela cheia,
    // enquanto a imagem "puxa o foco"
    if (iris && irisMedia) {
      const r = iris.getBoundingClientRect();
      const total = iris.offsetHeight - vh;
      const p = clamp(-r.top / total);
      const e = easeInOut(clamp(p / .72));
      const w0 = Math.min(vw * (vw < 700 ? .84 : .56), 980);
      const h0 = w0 / 2.39;
      const ix = ((vw - w0) / 2) * (1 - e);
      const iy = ((vh - h0) / 2) * (1 - e);
      irisMedia.style.clipPath = `inset(${iy.toFixed(1)}px ${ix.toFixed(1)}px round ${(2 * (1 - e)).toFixed(2)}px)`;
      if (irisImg) {
        irisImg.style.transform = `scale(${(1.18 - .18 * e).toFixed(4)})`;
        irisImg.style.filter = `blur(${(8 * (1 - e)).toFixed(2)}px)`;
      }
      if (irisText) {
        const t = clamp((p - .55) / .25);
        irisText.style.opacity = t.toFixed(3);
        irisText.style.transform = `translate3d(0, ${(30 * (1 - t)).toFixed(1)}px, 0)`;
      }
    }

    // Película: rolagem vertical vira deslocamento horizontal
    if (pinReel && reel && strip) {
      const r = reel.getBoundingClientRect();
      const total = reel.offsetHeight - vh;
      const p = clamp(-r.top / total);
      const distance = reel.offsetHeight - vh;
      strip.style.transform = `translate3d(${(-p * distance).toFixed(1)}px, 0, 0)`;
      if (reelBar) reelBar.style.transform = `scaleX(${p.toFixed(4)})`;
      stripImgs.forEach(im => {
        const fr = im.parentElement.getBoundingClientRect();
        if (fr.right < 0 || fr.left > vw) return;
        const off = (fr.left + fr.width / 2 - vw / 2) * -.06;
        im.style.transform = `translate3d(${off.toFixed(1)}px, 0, 0)`;
      });
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  layout();

  // Quando a abertura termina, passa a ligar as barras à rolagem
  const settleWatch = new MutationObserver(() => {
    if (body.classList.contains('lb-settled')) { update(); settleWatch.disconnect(); }
  });
  settleWatch.observe(body, { attributes: true, attributeFilter: ['class'] });
})();
