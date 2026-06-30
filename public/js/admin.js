/* EDR — Painel administrativo (editor de conteúdo) */
(function () {
  'use strict';

  var data = null;
  var currentTab = 'identidade';
  var uid = 0;

  var main = document.getElementById('adminMain');
  var menu = document.getElementById('adminMenu');
  var toastEl = document.getElementById('toast');
  var btnSalvar = document.getElementById('btnSalvar');

  /* ----------------------------------------------------- utils --------- */
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function getByPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setByPath(obj, path, val) {
    var keys = path.split('.');
    var last = keys.pop();
    var o = obj;
    keys.forEach(function (k) { if (o[k] == null) o[k] = {}; o = o[k]; });
    o[last] = val;
  }
  function toast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className = 'toast is-show ' + (type === 'err' ? 'toast--err' : 'toast--ok');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.className = 'toast'; }, 2600);
  }

  /* ----------------------------------------------------- componentes --- */
  function fieldText(label, path, placeholder) {
    return '<div class="field"><label>' + label + '</label>' +
      '<input type="text" data-bind="' + path + '" value="' + escAttr(getByPath(data, path)) +
      '" placeholder="' + escAttr(placeholder || '') + '"></div>';
  }
  function fieldArea(label, path, placeholder) {
    return '<div class="field"><label>' + label + '</label>' +
      '<textarea data-bind="' + path + '" placeholder="' + escAttr(placeholder || '') + '">' +
      escHtml(getByPath(data, path)) + '</textarea></div>';
  }
  function imgField(label, path, hint) {
    var val = getByPath(data, path);
    var id = 'up' + (++uid);
    return '<div class="field"><label>' + label + '</label><div class="imgfield">' +
      '<div class="imgfield__preview">' + (val ? '<img src="' + escAttr(val) + '">' : 'sem imagem') + '</div>' +
      '<div class="imgfield__actions">' +
        '<button type="button" class="btn-admin btn-admin--navy btn-admin--sm" data-action="pick" data-target="' + id + '">Enviar imagem</button>' +
        (val ? '<button type="button" class="btn-remove" data-action="clear" data-path="' + path + '">Remover imagem</button>' : '') +
        '<input type="file" accept="image/*" hidden data-upload="' + path + '" id="' + id + '">' +
        '<span class="imgfield__hint">' + (hint || 'JPG ou PNG, até 8MB') + '</span>' +
      '</div></div></div>';
  }
  function panelHead(title, desc) {
    return '<div class="panel__head"><div class="panel__title">' + title + '</div>' +
      (desc ? '<div class="panel__desc">' + desc + '</div>' : '') + '</div>';
  }

  /* ----------------------------------------------------- builders ------ */
  var builders = {};

  builders.identidade = function () {
    return panelHead('Identidade', 'Logo e informações principais da marca.') +
      '<div class="card"><div class="card__title">Logo</div>' +
        imgField('Logo do site (substitui o logo padrão "ER")', 'site.logo', 'Envie a logo oficial em PNG (fundo transparente de preferência).') +
      '</div>' +
      '<div class="card"><div class="card__title">Dados da marca</div>' +
        '<div class="grid-2">' +
          fieldText('Nome', 'site.nome') +
          fieldText('Sigla', 'site.sigla') +
        '</div>' +
        fieldText('Cidade / UF', 'site.cidade') +
      '</div>';
  };

  builders.menu = function () {
    var html = panelHead('Menu de navegação', 'Itens do menu no topo do site.') + '<div class="card">';
    (data.nav || []).forEach(function (item, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Item ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="nav" data-index="' + i + '">Remover</button>' +
        '</div><div class="grid-2">' +
        fieldText('Texto', 'nav.' + i + '.label') +
        fieldText('Link (ex: #encontros)', 'nav.' + i + '.href') +
        '</div></div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="nav">+ Adicionar item</button></div>';
    return html;
  };

  builders.inicio = function () {
    var html = panelHead('Início / Hero', 'O topo do site: títulos, textos e a Palavra Pastoral.');
    html += '<div class="card"><div class="card__title">Títulos</div>' +
      fieldText('Título — linha 1', 'hero.titulo1') +
      fieldText('Título — linha 2 (dourado)', 'hero.titulo2') +
      '</div>';

    html += '<div class="card"><div class="card__title">Textos de apresentação</div>';
    (data.hero.paragrafos || []).forEach(function (p, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Parágrafo ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="hero.paragrafos" data-index="' + i + '">Remover</button>' +
        '</div>' + fieldArea('', 'hero.paragrafos.' + i) + '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="hero.paragrafos">+ Adicionar parágrafo</button></div>';

    html += '<div class="card"><div class="card__title">Imagem do topo</div>' +
      imgField('Foto principal (encontro)', 'hero.imagem') +
      fieldText('Legenda sobre a imagem', 'hero.imagem_legenda') +
      '</div>';

    html += '<div class="card"><div class="card__title">Palavra Pastoral</div>' +
      fieldText('Título', 'hero.pastoral_titulo') +
      fieldArea('Texto', 'hero.pastoral_texto') +
      '</div>';
    return html;
  };

  builders.encontros = function () {
    var html = panelHead('Nossos Encontros', 'Galeria de fotos dos encontros.');
    html += '<div class="card">' + fieldText('Título da seção', 'encontros.titulo') + '</div>';

    html += '<div class="card"><div class="card__title">Fotos da galeria</div><div class="photo-grid">';
    (data.encontros.fotos || []).forEach(function (foto, i) {
      html += '<div class="photo-tile"><img src="' + escAttr(foto) + '">' +
        '<button type="button" class="photo-tile__del" data-action="remove" data-arr="encontros.fotos" data-index="' + i + '">&times;</button></div>';
    });
    html += '</div>';
    var id = 'upgal' + (++uid);
    html += '<button type="button" class="btn-add" data-action="pick" data-target="' + id + '">+ Adicionar foto(s)</button>' +
      '<input type="file" accept="image/*" hidden multiple data-upload-arr="encontros.fotos" id="' + id + '"></div>';

    html += '<div class="card"><div class="card__title">Botão</div><div class="grid-2">' +
      fieldText('Texto do botão', 'encontros.botao_texto') +
      fieldText('Link do botão', 'encontros.botao_link') +
      '</div></div>';
    return html;
  };

  builders.diretoria = function () {
    var html = panelHead('Diretoria', 'Membros da diretoria do EDR.');
    html += '<div class="card">' + fieldText('Título da seção', 'diretoria.titulo') + '</div><div class="card">';
    (data.diretoria.membros || []).forEach(function (m, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Membro ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="diretoria.membros" data-index="' + i + '">Remover</button>' +
        '</div>' + imgField('Foto', 'diretoria.membros.' + i + '.foto') +
        '<div class="grid-2">' +
        fieldText('Nome', 'diretoria.membros.' + i + '.nome') +
        fieldText('Cargo', 'diretoria.membros.' + i + '.cargo') +
        '</div></div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="diretoria.membros">+ Adicionar membro</button></div>';
    html += '<div class="card"><div class="card__title">Botão</div><div class="grid-2">' +
      fieldText('Texto do botão', 'diretoria.botao_texto') +
      fieldText('Link do botão', 'diretoria.botao_link') +
      '</div></div>';
    return html;
  };

  builders.parceiras = function () {
    var html = panelHead('Empresas Parceiras', 'Texto e logos das empresas parceiras.');
    html += '<div class="card">' + fieldText('Título', 'parceiras.titulo') + fieldArea('Texto', 'parceiras.texto') + '</div>';
    html += '<div class="card"><div class="card__title">Empresas</div>';
    (data.parceiras.lista || []).forEach(function (p, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Empresa ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="parceiras.lista" data-index="' + i + '">Remover</button>' +
        '</div>' + imgField('Logo', 'parceiras.lista.' + i + '.logo') +
        '<div class="grid-2">' +
        fieldText('Nome', 'parceiras.lista.' + i + '.nome') +
        fieldText('Link (site)', 'parceiras.lista.' + i + '.link') +
        '</div></div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="parceiras.lista">+ Adicionar empresa</button></div>';
    html += '<div class="card"><div class="card__title">Botão</div><div class="grid-2">' +
      fieldText('Texto do botão', 'parceiras.botao_texto') +
      fieldText('Link do botão', 'parceiras.botao_link') +
      '</div></div>';
    return html;
  };

  builders.pilares = function () {
    var icons = ['crown', 'users', 'growth', 'target', 'handshake', 'quote', 'user'];
    var html = panelHead('Nossos Pilares', 'Os pilares do movimento (ícone, título e descrição).');
    html += '<div class="card">' + fieldText('Título da seção', 'pilares.titulo') + '</div><div class="card">';
    (data.pilares.itens || []).forEach(function (item, i) {
      var opts = icons.map(function (ic) {
        return '<option value="' + ic + '"' + (item.icone === ic ? ' selected' : '') + '>' + ic + '</option>';
      }).join('');
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Pilar ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="pilares.itens" data-index="' + i + '">Remover</button>' +
        '</div>' +
        '<div class="field"><label>Ícone</label><select data-bind="pilares.itens.' + i + '.icone">' + opts + '</select></div>' +
        fieldText('Título', 'pilares.itens.' + i + '.titulo') +
        fieldText('Descrição', 'pilares.itens.' + i + '.descricao') +
        '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="pilares.itens">+ Adicionar pilar</button></div>';
    return html;
  };

  builders.rodape = function () {
    return panelHead('Rodapé', 'Texto final e redes sociais.') +
      '<div class="card"><div class="card__title">Textos</div>' +
        fieldText('Título', 'footer.titulo') +
        fieldText('Subtítulo', 'footer.subtitulo') +
      '</div>' +
      '<div class="card"><div class="card__title">Redes sociais (cole o link completo)</div>' +
        fieldText('Instagram', 'footer.instagram') +
        fieldText('Facebook', 'footer.facebook') +
        fieldText('WhatsApp (ex: https://wa.me/5545999999999)', 'footer.whatsapp') +
      '</div>';
  };

  builders.senha = function () {
    return panelHead('Trocar senha', 'Defina uma nova senha de acesso ao painel.') +
      '<div class="card" style="max-width:440px">' +
        '<div class="field"><label>Senha atual</label><input type="password" id="senhaAtual"></div>' +
        '<div class="field"><label>Nova senha</label><input type="password" id="senhaNova"></div>' +
        '<button type="button" class="btn-admin btn-admin--navy" id="btnSenha">Salvar nova senha</button>' +
      '</div>';
  };

  /* ----------------------------------------------------- render -------- */
  function showTab(name) {
    currentTab = name;
    main.innerHTML = (builders[name] || function () { return ''; })();
    Array.prototype.forEach.call(menu.children, function (b) {
      b.classList.toggle('is-active', b.dataset.tab === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ----------------------------------------------------- add templates - */
  function makeNew(arrPath) {
    switch (arrPath) {
      case 'nav': return { label: 'NOVO', href: '#' };
      case 'hero.paragrafos': return '';
      case 'diretoria.membros': return { nome: 'NOME', cargo: 'CARGO', foto: '' };
      case 'parceiras.lista': return { nome: 'Empresa', logo: '', link: '#' };
      case 'pilares.itens': return { icone: 'crown', titulo: 'NOVO', descricao: '' };
      default: return {};
    }
  }

  /* ----------------------------------------------------- uploads ------- */
  function uploadFile(file) {
    var fd = new FormData();
    fd.append('imagem', file);
    return fetch('/api/upload', { method: 'POST', body: fd })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Falha no upload'); return j; }); });
  }

  /* ----------------------------------------------------- eventos ------- */
  // edição de campos (texto / textarea / select)
  main.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.bind) setByPath(data, el.dataset.bind, el.value);
  });
  main.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.bind) setByPath(data, el.dataset.bind, el.value);

    // upload simples (1 imagem)
    if (el.dataset && el.dataset.upload && el.files && el.files[0]) {
      var path = el.dataset.upload;
      uploadFile(el.files[0]).then(function (j) {
        setByPath(data, path, j.url); showTab(currentTab); toast('Imagem enviada.');
      }).catch(function (err) { toast(err.message, 'err'); });
    }

    // upload múltiplo (galeria)
    if (el.dataset && el.dataset.uploadArr && el.files && el.files.length) {
      var arrPath = el.dataset.uploadArr;
      var arr = getByPath(data, arrPath) || [];
      var files = Array.prototype.slice.call(el.files);
      toast('Enviando ' + files.length + ' foto(s)…');
      Promise.all(files.map(function (f) { return uploadFile(f); }))
        .then(function (results) {
          results.forEach(function (j) { arr.push(j.url); });
          setByPath(data, arrPath, arr); showTab(currentTab); toast('Foto(s) adicionada(s).');
        }).catch(function (err) { toast(err.message, 'err'); });
    }
  });

  // cliques (add / remove / pick / clear / senha)
  main.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) {
      if (e.target.id === 'btnSenha') return trocarSenha();
      return;
    }
    var action = btn.dataset.action;

    if (action === 'pick') {
      var inp = document.getElementById(btn.dataset.target);
      if (inp) inp.click();
    } else if (action === 'clear') {
      setByPath(data, btn.dataset.path, ''); showTab(currentTab);
    } else if (action === 'add') {
      var arrP = btn.dataset.arr;
      var arr = getByPath(data, arrP) || [];
      arr.push(makeNew(arrP));
      setByPath(data, arrP, arr); showTab(currentTab);
    } else if (action === 'remove') {
      var ap = btn.dataset.arr;
      var idx = parseInt(btn.dataset.index, 10);
      var a = getByPath(data, ap) || [];
      a.splice(idx, 1);
      setByPath(data, ap, a); showTab(currentTab);
    }
  });

  // menu lateral
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) showTab(b.dataset.tab);
  });

  // salvar tudo
  btnSalvar.addEventListener('click', function () {
    btnSalvar.disabled = true;
    var original = btnSalvar.textContent;
    btnSalvar.textContent = 'Salvando…';
    fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Erro'); return j; });
    }).then(function () {
      toast('Alterações salvas com sucesso!');
    }).catch(function (err) {
      toast(err.message, 'err');
    }).finally(function () {
      btnSalvar.disabled = false; btnSalvar.textContent = original;
    });
  });

  function trocarSenha() {
    var atual = document.getElementById('senhaAtual').value;
    var nova = document.getElementById('senhaNova').value;
    fetch('/api/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atual: atual, nova: nova })
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Erro'); return j; });
    }).then(function () {
      toast('Senha alterada com sucesso!');
      document.getElementById('senhaAtual').value = '';
      document.getElementById('senhaNova').value = '';
    }).catch(function (err) { toast(err.message, 'err'); });
  }

  // atalho: Ctrl+S salva
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); btnSalvar.click(); }
  });

  /* ----------------------------------------------------- init ---------- */
  fetch('/api/content')
    .then(function (r) { return r.json(); })
    .then(function (json) {
      data = json;
      // garante estruturas mínimas
      data.site = data.site || {}; data.hero = data.hero || {}; data.hero.paragrafos = data.hero.paragrafos || [];
      data.nav = data.nav || []; data.encontros = data.encontros || {}; data.encontros.fotos = data.encontros.fotos || [];
      data.diretoria = data.diretoria || {}; data.diretoria.membros = data.diretoria.membros || [];
      data.parceiras = data.parceiras || {}; data.parceiras.lista = data.parceiras.lista || [];
      data.pilares = data.pilares || {}; data.pilares.itens = data.pilares.itens || [];
      data.footer = data.footer || {};
      showTab('identidade');
    })
    .catch(function () {
      main.innerHTML = '<div class="admin-loading">Erro ao carregar o conteúdo. Atualize a página.</div>';
    });
})();
