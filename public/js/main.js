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

  /* ---------- carrossel dos encontros (passa sozinho) ---------- */
  var ecar = document.getElementById('encontrosCarousel');
  if (ecar) {
    var slides = Array.prototype.slice.call(ecar.querySelectorAll('.eslide'));
    var esetas = Array.prototype.slice.call(ecar.querySelectorAll('[data-enav]'));
    var eAtual = 0;
    var INTERVALO = 6000;
    var relogio = null;
    var pausado = false;
    var semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function pintaEncontros() {
      slides.forEach(function (el, i) { el.classList.toggle('is-active', i === eAtual); });
    }
    function vaiPara(i) {
      eAtual = (i + slides.length) % slides.length;
      pintaEncontros();
    }
    // reagenda do zero a cada troca, para o slide recém-aberto ter o tempo cheio
    function agenda() {
      clearTimeout(relogio);
      if (semMovimento || pausado || document.hidden || slides.length < 2) return;
      relogio = setTimeout(function () { vaiPara(eAtual + 1); agenda(); }, INTERVALO);
    }

    esetas.forEach(function (b) {
      b.addEventListener('click', function () {
        vaiPara(eAtual + (b.dataset.enav === 'prev' ? -1 : 1));
        agenda();
      });
    });

    // não troca embaixo do cursor nem enquanto navegam pelo teclado
    ecar.addEventListener('mouseenter', function () { pausado = true; clearTimeout(relogio); });
    ecar.addEventListener('mouseleave', function () { pausado = false; agenda(); });
    ecar.addEventListener('focusin', function () { pausado = true; clearTimeout(relogio); });
    ecar.addEventListener('focusout', function () { pausado = false; agenda(); });
    document.addEventListener('visibilitychange', agenda);

    if (slides.length < 2) {
      var setas = ecar.querySelector('.enav');
      if (setas) setas.style.display = 'none';
    }

    pintaEncontros();
    agenda();
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
    // Troca em duas etapas: some o que está na tela, troca, e o novo entra.
    // Sem a saída a mudança fica seca, porque os dois membros trocam de
    // lugar de uma vez só.
    var trilho = dcar.querySelector('.dtrack');
    var trocando = false;
    var semMovimentoD = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function trocaPara(i) {
      if (trocando) return;
      var destino = (i + membros.length) % membros.length;
      if (destino === atual) return;
      if (semMovimentoD || !trilho) { atual = destino; pintaDiretoria(); return; }

      trocando = true;
      trilho.classList.add('is-saindo');
      setTimeout(function () {
        atual = destino;
        pintaDiretoria();
        trilho.classList.remove('is-saindo');
        trocando = false;
      }, 220);
    }

    setas.forEach(function (b) {
      b.addEventListener('click', function () { trocaPara(atual + (b.dataset.dnav === 'prev' ? -1 : 1)); });
    });
    // clicar no card compacto promove aquele membro a destaque
    membros.forEach(function (el, i) {
      el.addEventListener('click', function () {
        if (el.classList.contains('is-next')) trocaPara(i);
      });
    });
    // com um membro só não há o que navegar
    if (membros.length < 2) setas.forEach(function (b) { b.style.display = 'none'; });

    pintaDiretoria();
  }

  /* ---------- reveal ao rolar ---------- */
  var revealTargets = document.querySelectorAll(
    '.hero__left, .hero__right, .stat, .pastoral, .eside, .ehero, .ethumb, .board, .partners, .pilar, .footer__inner'
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
