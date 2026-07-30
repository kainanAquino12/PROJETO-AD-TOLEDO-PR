/* EDR — interações do site público */
(function () {
  'use strict';

  /* ---------- menu mobile ---------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- link ativo conforme a seção visível ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'));
  var sections = links
    .map(function (l) {
      var id = (l.getAttribute('href') || '').replace('#', '');
      return id ? document.getElementById(id) : null;
    });

  function onScroll() {
    var y = window.scrollY + 120;
    var current = -1;
    sections.forEach(function (sec, i) {
      if (sec && sec.offsetTop <= y) current = i;
    });
    links.forEach(function (l, i) { l.classList.toggle('is-active', i === current); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- lightbox da galeria ---------- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxClose');

  function openLightbox(src) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-lightbox]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openLightbox(el.getAttribute('href'));
    });
  });
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });

  /* ---------- carrossel dos encontros ---------- */
  var ecar = document.getElementById('encontrosCarousel');
  if (ecar) {
    var slides = Array.prototype.slice.call(ecar.querySelectorAll('.eslide'));
    var esetas = Array.prototype.slice.call(ecar.querySelectorAll('[data-enav]'));
    var eAtual = 0;

    function pintaEncontros() {
      slides.forEach(function (el, i) { el.classList.toggle('is-active', i === eAtual); });
    }
    esetas.forEach(function (b) {
      b.addEventListener('click', function () {
        var passo = b.dataset.enav === 'prev' ? -1 : 1;
        eAtual = (eAtual + passo + slides.length) % slides.length;
        pintaEncontros();
      });
    });
    if (slides.length < 2) ecar.querySelector('.enav').style.display = 'none';

    pintaEncontros();
  }

  /* ---------- carrossel da diretoria ---------- */
  var dcar = document.getElementById('diretoriaCarousel');
  if (dcar) {
    var membros = Array.prototype.slice.call(dcar.querySelectorAll('.dmember'));
    var setas = Array.prototype.slice.call(dcar.querySelectorAll('[data-dnav]'));
    var atual = 0;

    function pintaDiretoria() {
      membros.forEach(function (el, i) {
        el.classList.remove('is-active', 'is-next');
        if (i === atual) el.classList.add('is-active');
        else if (membros.length > 1 && i === (atual + 1) % membros.length) el.classList.add('is-next');
      });
    }
    function vai(passo) {
      atual = (atual + passo + membros.length) % membros.length;
      pintaDiretoria();
    }

    setas.forEach(function (b) {
      b.addEventListener('click', function () { vai(b.dataset.dnav === 'prev' ? -1 : 1); });
    });
    // clicar no card compacto promove aquele membro a destaque
    membros.forEach(function (el, i) {
      el.addEventListener('click', function () {
        if (el.classList.contains('is-next')) { atual = i; pintaDiretoria(); }
      });
    });
    // com um membro só não há o que navegar
    if (membros.length < 2) setas.forEach(function (b) { b.style.display = 'none'; });

    pintaDiretoria();
  }

  /* ---------- reveal ao rolar ---------- */
  var revealTargets = document.querySelectorAll(
    '.hero__left, .hero__right, .stat, .pastoral, .ehero, .ethumb, .board, .partners, .pilar, .footer__inner'
  );
  revealTargets.forEach(function (el, i) {
    el.classList.add('reveal');
    el.style.transitionDelay = (i % 4) * 0.07 + 's';
  });

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach(function (el) { obs.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
  }
})();
