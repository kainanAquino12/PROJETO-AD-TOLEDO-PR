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
    if (!alvos.some(Boolean)) return;             // pagina interna: o link ativo vem do servidor
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

  /* ---------- carrossel dos encontros ---------- */
  document.querySelectorAll('.slider').forEach(function (sl) {
    var track = sl.querySelector('.slider__track');
    var prev = sl.querySelector('[data-slider-prev]');
    var next = sl.querySelector('[data-slider-next]');
    var dotsBox = sl.querySelector('[data-slider-dots]');
    var slides = [].slice.call(track.children);
    var reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dots = [];

    function passo() {
      return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth;
    }
    function indiceAtual() {
      return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / passo())));
    }
    function vaPara(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: i * passo(), behavior: reduz ? 'auto' : 'smooth' });
    }
    function atualiza() {
      var fim = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      var ini = track.scrollLeft <= 2;
      if (prev) prev.disabled = ini;
      if (next) next.disabled = fim;
      var i = fim ? dots.length - 1 : Math.min(indiceAtual(), dots.length - 1);
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
    }
    function montaPontos() {
      if (!dotsBox) return;
      var visiveis = Math.max(1, Math.round(track.clientWidth / passo()));
      var n = Math.max(1, slides.length - visiveis + 1);
      if (n === dots.length) return;
      dotsBox.innerHTML = ''; dots = [];
      for (var k = 0; k < n; k++) { var d = document.createElement('span'); d.className = 'slider__dot'; dotsBox.appendChild(d); dots.push(d); }
    }

    /* troca automatica a cada 4 s; ao chegar na ultima foto volta suavemente para a primeira.
       Um unico temporizador, reiniciado a cada acao manual (seta, tecla, toque, roda do mouse). */
    var timerAuto = null, emFoco = false, visivel = true;
    function ocupadoPorOutraCoisa() {
      var lb = document.getElementById('lightbox');
      return document.hidden || !visivel || emFoco || (lb && lb.classList.contains('is-open'));
    }
    function agenda() {
      clearTimeout(timerAuto);
      if (slides.length < 2) return;
      timerAuto = setTimeout(function () {
        if (!ocupadoPorOutraCoisa() && track.scrollWidth > track.clientWidth + 2) {
          var fim = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
          if (fim) track.scrollTo({ left: 0, behavior: reduz ? 'auto' : 'smooth' });
          else vaPara(indiceAtual() + 1);
        }
        agenda();
      }, 4000);
    }
    ['touchstart', 'pointerdown', 'wheel'].forEach(function (ev) { track.addEventListener(ev, agenda, { passive: true }); });
    track.addEventListener('focusin', function () { emFoco = true; });
    track.addEventListener('focusout', function () { emFoco = false; agenda(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; }).observe(sl);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) agenda(); });

    if (prev) prev.addEventListener('click', function () { vaPara(indiceAtual() - 1); agenda(); });
    if (next) next.addEventListener('click', function () { vaPara(indiceAtual() + 1); agenda(); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); vaPara(indiceAtual() + 1); agenda(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); vaPara(indiceAtual() - 1); agenda(); }
    });

    var ag = false;
    track.addEventListener('scroll', function () {
      if (ag) return; ag = true;
      window.requestAnimationFrame(function () { ag = false; atualiza(); });
    }, { passive: true });
    window.addEventListener('resize', function () { montaPontos(); atualiza(); });
    montaPontos(); atualiza(); agenda();
  });

  /* ---------- carrossel de empresas em destaque ----------
     Anel infinito movido por transform: as empresas reais ficam no meio e copias (clones) delas
     nas pontas, entao "depois da ultima vem a primeira" sem salto. Um unico temporizador
     (setTimeout reagendado) controla o automatico; qualquer navegacao manual reinicia a contagem. */
  (function () {
    var box = document.getElementById('destaques'); if (!box) return;
    var viewport = box.querySelector('.fslider__viewport');
    var track = box.querySelector('.fslider__track');
    var prev = box.querySelector('[data-fprev]'), next = box.querySelector('[data-fnext]'), dotsBox = box.querySelector('[data-fdots]');
    var reais = [].slice.call(track.children);       // so as empresas marcadas no painel, na ordem do painel
    var n = reais.length; if (!n) return;

    var INTERVALO = 4000, DURACAO = 600;
    var reduzMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var K = 0;              // quantos clones em cada ponta
    var gira = false;       // true = anel com navegacao; false = parado (poucas empresas)
    var idx = 0;            // posicao logica: 0..n-1 (pode passar por -1 / n durante a animacao)
    var ocupado = false, timerAnim = null, timerAuto = null, arrastando = false;
    var porTelaAtual = 0, centradoAtual = null;

    function css(nome) { return getComputedStyle(box).getPropertyValue(nome).trim(); }
    function porTela() { return parseInt(css('--per'), 10) || 1; }
    function centrado() { return css('--centered') === '1'; }
    function mod(a) { return ((a % n) + n) % n; }
    function filhos() { return [].slice.call(track.children); }
    function passo() { var f = filhos(); return f.length > 1 ? f[1].offsetLeft - f[0].offsetLeft : 0; }
    function x(i) { return -(K + i) * passo(); }

    function posiciona(animado, i) {
      track.style.transition = (animado && !reduzMov) ? 'transform ' + DURACAO + 'ms cubic-bezier(.22, .61, .36, 1)' : 'none';
      track.style.transform = gira ? 'translate3d(' + x(i) + 'px,0,0)' : 'none';
    }

    /* (re)monta o anel conforme o tamanho da tela e a quantidade de empresas */
    function monta() {
      var per = porTela();
      track.innerHTML = '';
      reais.forEach(function (r) { track.appendChild(r); });
      gira = n >= 3 || n > per;
      box.classList.toggle('is-static', !gira);
      prev.hidden = next.hidden = dotsBox.hidden = !gira;
      K = 0;
      if (gira) {
        K = per + 1;
        var clone = function (r) {
          var c = r.cloneNode(true);
          c.classList.add('fslide--clone'); c.setAttribute('aria-hidden', 'true');
          [].forEach.call(c.querySelectorAll('a'), function (el) { el.tabIndex = -1; });
          return c;
        };
        for (var j = 1; j <= K; j++) {
          track.insertBefore(clone(reais[mod(-j)]), track.firstChild);   // ..., penultimo, ultimo | reais
          track.appendChild(clone(reais[mod(j - 1)]));                    // reais | primeiro, segundo, ...
        }
      }
      porTelaAtual = per; centradoAtual = centrado();
      pontos();
      idx = mod(idx);
      posiciona(false, idx);
      marca();
    }

    function pontos() {
      dotsBox.innerHTML = '';
      if (!gira) return;
      for (var k = 0; k < n; k++) {
        var d = document.createElement('button');
        d.type = 'button'; d.className = 'fslider__dot'; d.dataset.i = k;
        d.setAttribute('aria-label', 'Empresa ' + (k + 1) + ' de ' + n);
        dotsBox.appendChild(d);
      }
    }
    function marca() {
      var ativo = mod(idx);
      [].forEach.call(dotsBox.children, function (d, k) { d.classList.toggle('is-active', k === ativo); });
    }

    /* depois da animacao, se caiu num clone, volta ao real equivalente sem transicao (invisivel) */
    function normaliza() {
      timerAnim = null; ocupado = false;
      if (idx < 0 || idx >= n) { idx = mod(idx); posiciona(false, idx); }
    }
    function vaPara(i, manual) {
      if (!gira || ocupado) return;
      ocupado = true;
      idx = i;
      posiciona(true, idx);
      marca();
      clearTimeout(timerAnim);
      timerAnim = setTimeout(normaliza, reduzMov ? 30 : DURACAO + 40);
      if (manual) agenda();
    }
    function avanca(passos, manual) { vaPara(idx + passos, manual); }

    /* automatico: um unico temporizador, sempre reagendado; navegacao manual reinicia a contagem */
    function agenda() {
      clearTimeout(timerAuto);
      timerAuto = setTimeout(function () {
        if (gira && !document.hidden && !arrastando && !box.matches(':focus-within')) avanca(1, false);
        agenda();
      }, INTERVALO);
    }

    prev.addEventListener('click', function () { avanca(-1, true); });
    next.addEventListener('click', function () { avanca(1, true); });
    dotsBox.addEventListener('click', function (e) { var b = e.target.closest('[data-i]'); if (b) vaPara(parseInt(b.dataset.i, 10), true); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); avanca(1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); avanca(-1, true); }
    });

    /* arrastar (toque e mouse): passa de empresa com um gesto horizontal; a rolagem vertical continua livre */
    var ini = null, dx = 0, base = 0, moveu = false;
    track.addEventListener('pointerdown', function (e) {
      if (!gira || ocupado || (e.pointerType === 'mouse' && e.button !== 0)) return;
      ini = { x: e.clientX, y: e.clientY, id: e.pointerId }; dx = 0; moveu = false; base = x(idx);
    });
    track.addEventListener('pointermove', function (e) {
      if (!ini || e.pointerId !== ini.id) return;
      var mx = e.clientX - ini.x, my = e.clientY - ini.y;
      if (!moveu) {
        if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return;
        moveu = true; arrastando = true;
        try { track.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
      }
      dx = mx;
      track.style.transition = 'none';
      track.style.transform = 'translate3d(' + (base + dx) + 'px,0,0)';
    });
    function solta(e) {
      if (!ini || (e && e.pointerId !== ini.id)) return;
      var d = dx, foi = moveu; ini = null; arrastando = false;
      if (!foi) return;
      var limiar = Math.min(60, passo() / 4);
      if (d <= -limiar) { ocupado = false; avanca(1, true); }
      else if (d >= limiar) { ocupado = false; avanca(-1, true); }
      else { posiciona(true, idx); agenda(); }
    }
    track.addEventListener('pointerup', solta);
    track.addEventListener('pointercancel', solta);
    // depois de um arrasto o navegador dispararia o clique no link da empresa: bloqueia
    track.addEventListener('click', function (e) { if (moveu) { e.preventDefault(); e.stopPropagation(); moveu = false; } }, true);

    var agRe = false;
    window.addEventListener('resize', function () {
      if (agRe) return; agRe = true;
      requestAnimationFrame(function () {
        agRe = false;
        if (porTela() !== porTelaAtual || centrado() !== centradoAtual) monta(); else posiciona(false, idx);
      });
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) agenda(); });
    window.addEventListener('load', function () { posiciona(false, idx); });

    monta();
    agenda();
  })();

  /* ---------- coordenacao: informacoes completas do integrante ---------- */
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
