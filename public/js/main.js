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
  var alvos = links.map(function (l) {
    var id = (l.getAttribute('href') || '').replace('#', '');
    return id ? document.getElementById(id) : null;
  });

  // getBoundingClientRect e confiavel mesmo com ancestrais posicionados,
  // ao contrario de offsetTop
  function topoDe(el) { return el.getBoundingClientRect().top + window.scrollY; }

  function marcarSecaoAtual() {
    var y = window.scrollY + 130;                 // compensa o header fixo
    var alturaDoc = document.documentElement.scrollHeight;
    var noFim = window.scrollY + window.innerHeight >= alturaDoc - 2;

    var atual = -1, maiorTopo = -Infinity;
    alvos.forEach(function (sec, i) {
      if (!sec) return;
      var t = topoDe(sec);
      if (t > y) return;
      // '>' e nao '>=' de proposito: quando dois itens do menu apontam para a
      // mesma secao (INICIO e SOBRE NOS), o primeiro deles e que fica ativo
      if (t > maiorTopo) { maiorTopo = t; atual = i; }
    });

    // no fim da pagina o rodape pode nunca cruzar a linha de corte
    if (noFim) {
      for (var j = alvos.length - 1; j >= 0; j--) { if (alvos[j]) { atual = j; break; } }
    }

    links.forEach(function (l, i) { l.classList.toggle('is-active', i === atual); });
  }

  var agendado = false;
  function onScroll() {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(function () { agendado = false; marcarSecaoAtual(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', marcarSecaoAtual);   // posicoes finais apos as imagens
  marcarSecaoAtual();

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

  /* ---------- diretoria: informacoes completas do integrante ---------- */
  var mModal = document.getElementById('membroModal');
  var mConteudo = document.getElementById('membroConteudo');
  function setMembro(aberto) {
    if (!mModal) return;
    mModal.classList.toggle('is-open', aberto);
    mModal.setAttribute('aria-hidden', aberto ? 'false' : 'true');
    document.body.style.overflow = aberto ? 'hidden' : '';
  }
  document.querySelectorAll('[data-membro]').forEach(function (card) {
    function abre(e) {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      mConteudo.innerHTML = card.querySelector('.member__full').innerHTML;
      setMembro(true);
    }
    card.addEventListener('click', abre);
    card.addEventListener('keydown', abre);
  });
  var btnPrimeiro = document.querySelector('[data-membro-primeiro]');
  if (btnPrimeiro) btnPrimeiro.addEventListener('click', function (e) {
    var primeiro = document.querySelector('[data-membro]');
    if (primeiro) { e.preventDefault(); primeiro.click(); }
  });
  document.querySelectorAll('[data-membro-close]').forEach(function (b) {
    b.addEventListener('click', function () { setMembro(false); });
  });
  if (mModal) mModal.addEventListener('click', function (e) { if (e.target === mModal) setMembro(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMembro(false); });

  /* ---------- reveal ao rolar ---------- */
  var revealTargets = document.querySelectorAll(
    '.hero__text, .stat, .sobre__grid, .ecard, .album, .member, .pastoral__grid, .pilar'
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
