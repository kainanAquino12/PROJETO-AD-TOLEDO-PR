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
  function fieldArea(label, path, placeholder, cls) {
    return '<div class="field' + (cls ? ' ' + cls : '') + '"><label>' + label + '</label>' +
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

  // icones disponiveis em views/partials/icon.ejs
  var ICONS = ['crown', 'users', 'growth', 'target', 'handshake', 'calendar', 'coffee', 'impact',
               'globe', 'briefcase', 'quote', 'user'];

  function fieldRange(label, path, opt) {
    var val = getByPath(data, path);
    if (val === undefined || val === null || val === '') val = opt.padrao;
    return '<div class="field field--range">' +
      '<label>' + label + '<span class="range-val">' + escHtml(val) + '%</span></label>' +
      '<input type="range" data-bind="' + path + '" min="' + opt.min + '" max="' + opt.max +
      '" step="' + (opt.passo || 1) + '" value="' + escAttr(val) + '">' +
      '<div class="range-hint"><span>' + escHtml(opt.rotuloMin) + '</span><span>' + escHtml(opt.rotuloMax) + '</span></div>' +
      '</div>';
  }

  function fieldSelect(label, path, options) {
    var atual = String(getByPath(data, path) == null ? '' : getByPath(data, path));
    var opts = options.map(function (o) {
      return '<option value="' + escAttr(o.value) + '"' + (atual === o.value ? ' selected' : '') + '>' + escHtml(o.label) + '</option>';
    }).join('');
    return '<div class="field"><label>' + label + '</label>' +
      '<select data-bind="' + path + '">' + opts + '</select></div>';
  }

  function fieldIcon(label, path) {
    var atual = getByPath(data, path);
    var opts = ICONS.map(function (ic) {
      return '<option value="' + ic + '"' + (atual === ic ? ' selected' : '') + '>' + ic + '</option>';
    }).join('');
    return '<div class="field"><label>' + label + '</label>' +
      '<select data-bind="' + path + '">' + opts + '</select></div>';
  }

  function cardBotao(titulo, pathTexto, pathLink) {
    return '<div class="card"><div class="card__title">' + titulo + '</div><div class="grid-2">' +
      fieldText('Texto do botão', pathTexto) +
      fieldText('Link (ex: #encontros, #rodape ou https://…)', pathLink) +
      '</div></div>';
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
    var html = panelHead('Início / Hero', 'O topo do site: foto de fundo, títulos, textos, botões e os destaques ao lado da logo.');

    html += '<div class="card"><div class="card__title">Foto de fundo do topo</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">Aparece atrás da logo, no lado escuro do topo. Use uma foto horizontal e larga — uma vista da cidade ou um encontro do EDR funcionam bem. Sem foto, o fundo fica azul-marinho liso.</div>' +
      imgField('Foto de fundo', 'hero.imagem', 'JPG ou PNG, até 8MB. De preferência com 1600px de largura ou mais.') +
      fieldRange('Zoom da foto', 'hero.imagem_zoom', { min: 100, max: 200, padrao: 100, rotuloMin: 'foto inteira', rotuloMax: 'bem aproximada' }) +
      fieldSelect('Intensidade da foto', 'hero.imagem_intensidade', [
        { value: 'suave', label: 'Suave — quase só uma textura' },
        { value: 'media', label: 'Média — equilibrada (padrão)' },
        { value: 'forte', label: 'Forte — a foto aparece bem' }
      ]) +
      '</div>';

    html += '<div class="card"><div class="card__title">Títulos</div>' +
      fieldText('Antetítulo (linha pequena dourada acima do título)', 'hero.eyebrow') +
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

    html += cardBotao('Botão 1 (escuro)', 'hero.botao1_texto', 'hero.botao1_link');
    html += cardBotao('Botão 2 (contorno dourado)', 'hero.botao2_texto', 'hero.botao2_link');

    html += '<div class="card"><div class="card__title">Destaques (ao lado da logo)</div>';
    (data.hero.destaques || []).forEach(function (d, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Destaque ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="hero.destaques" data-index="' + i + '">Remover</button>' +
        '</div>' +
        fieldIcon('Ícone', 'hero.destaques.' + i + '.icone') +
        fieldText('Título (ex: NETWORKING)', 'hero.destaques.' + i + '.titulo') +
        fieldText('Descrição', 'hero.destaques.' + i + '.texto') +
        '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="hero.destaques">+ Adicionar destaque</button></div>';

    html += '<div class="card"><div class="card__title">Palavra Pastoral</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">O card escuro logo abaixo da faixa de números. Deixe o título, a frase e a carta vazios para esconder a seção inteira.</div>' +
      fieldText('Título (o rótulo dourado)', 'hero.pastoral_titulo') +
      fieldArea('Frase de destaque (texto grande ao lado da foto)', 'hero.pastoral_texto',
        'As aspas já entram sozinhas — escreva só a frase.') +
      '<div class="grid-3">' +
        fieldText('Boas-vindas (linha menor)', 'hero.pastoral_saudacao') +
        fieldText('Nome em destaque (branco)', 'hero.pastoral_marca') +
        fieldText('Complemento (dourado)', 'hero.pastoral_marca_destaque') +
      '</div>' +
      '<div class="panel__desc" style="margin:10px 0 8px">Texto da carta: cada linha vira um parágrafo — dê Enter para separar. ' +
        'Linha começando com <strong>•</strong> ou <strong>-</strong> vira item de lista com bolinha dourada.</div>' +
      fieldArea('Texto da carta', 'hero.pastoral_carta', '', 'field--alta') +
      '<div class="grid-2">' +
        fieldText('Nome do pastor (ex: Pr. Marcos Oliveira)', 'hero.pastoral_autor') +
        fieldText('Cargo (ex: Líder do EDR Toledo/PR)', 'hero.pastoral_autor_cargo') +
      '</div>' +
      imgField('Foto do pastor (coluna da esquerda do card)', 'hero.pastoral_foto', 'De preferência uma foto em pé / retrato. Sem foto, o card fica só com o texto.') +
      fieldRange('Zoom da foto', 'hero.pastoral_foto_zoom', { min: 100, max: 250, padrao: 100, rotuloMin: 'foto inteira', rotuloMax: 'perto do rosto' }) +
      '</div>';

    html += '<div class="card"><div class="card__title">Valores (faixa de ícones da Palavra Pastoral)</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">A faixa com os ícones dourados no meio do card escuro. Sem nenhum valor, a faixa some.</div>' +
      fieldText('Título da faixa (ex: NOSSOS VALORES)', 'hero.pastoral_valores_titulo');
    (data.hero.pastoral_valores || []).forEach(function (v, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Valor ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="hero.pastoral_valores" data-index="' + i + '">Remover</button>' +
        '</div>' +
        fieldIcon('Ícone', 'hero.pastoral_valores.' + i + '.icone') +
        fieldText('Título (ex: HONRAR A DEUS)', 'hero.pastoral_valores.' + i + '.titulo') +
        fieldText('Descrição', 'hero.pastoral_valores.' + i + '.texto') +
        '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="hero.pastoral_valores">+ Adicionar valor</button></div>';

    html += '<div class="card"><div class="card__title">Versículo (rodapé do card)</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">Fica na faixa final da Palavra Pastoral, ao lado da assinatura do pastor. As aspas entram sozinhas.</div>' +
      fieldArea('Versículo', 'hero.pastoral_verso') +
      fieldText('Referência (ex: Provérbios 16:3)', 'hero.pastoral_verso_ref') +
      '</div>';

    return html;
  };

  builders.numeros = function () {
    var html = panelHead('Números / Destaques', 'A faixa clara logo abaixo do topo do site.');
    html += '<div class="card">';
    (data.numeros.itens || []).forEach(function (n, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Item ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="numeros.itens" data-index="' + i + '">Remover</button>' +
        '</div>' +
        fieldIcon('Ícone', 'numeros.itens.' + i + '.icone') +
        '<div class="grid-2">' +
        fieldText('Destaque (ex: +120)', 'numeros.itens.' + i + '.valor') +
        fieldText('Descrição (ex: EMPRESÁRIOS CONECTADOS)', 'numeros.itens.' + i + '.texto') +
        '</div></div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="numeros.itens">+ Adicionar item</button></div>';
    return html;
  };

  builders.encontros = function () {
    var html = panelHead('Nossos Encontros', 'Um destaque grande em carrossel, a faixa de miniaturas e o bloco contador.');
    html += '<div class="card">' +
      fieldText('Título da seção', 'encontros.titulo') +
      fieldText('Subtítulo (frase abaixo do título)', 'encontros.subtitulo') +
      '</div>';

    html += '<div class="card"><div class="card__title">Encontros em destaque (carrossel)</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">Aparece um por vez no banner grande; as setas passam para o próximo. Todo campo vazio simplesmente não aparece.</div>';
    (data.encontros.cards || []).forEach(function (k, i) {
      var p = 'encontros.cards.' + i + '.';
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Encontro ' + (i + 1) + (i === 0 ? ' — o primeiro do carrossel' : '') + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="encontros.cards" data-index="' + i + '">Remover</button>' +
        '</div>' +
        imgField('Foto de fundo', p + 'foto') +
        fieldRange('Zoom da foto', p + 'zoom', { min: 100, max: 200, padrao: 100, rotuloMin: 'foto inteira', rotuloMax: 'bem aproximada' }) +
        '<div class="grid-2">' +
        fieldText('Selo dourado (ex: DESTAQUE)', p + 'selo') +
        fieldText('Etiqueta (ex: ENCONTRO #31)', p + 'badge') +
        '</div>' +
        fieldText('Título (ex: Café com Propósito)', p + 'titulo') +
        '<div class="grid-2">' +
        fieldText('Data (ex: 12 de julho de 2026)', p + 'data') +
        fieldText('Local (ex: Toledo/PR)', p + 'local') +
        '</div>' +
        fieldText('Público (ex: +120 empresários presentes)', p + 'publico') +
        '<div class="grid-2">' +
        fieldText('Texto do botão', p + 'botao_texto') +
        fieldText('Link do botão', p + 'botao_link') +
        '</div>' +
        '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="encontros.cards">+ Adicionar encontro</button></div>';

    html += '<div class="card"><div class="card__title">Faixa de miniaturas</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">As 5 primeiras fotos aparecem na faixa, ao lado do bloco contador. Clicar numa miniatura abre a foto ampliada.</div>' +
      '<div class="photo-grid">';
    (data.encontros.galeria.fotos || []).forEach(function (foto, i) {
      html += '<div class="photo-tile"><img src="' + escAttr(foto) + '">' +
        '<button type="button" class="photo-tile__del" data-action="remove" data-arr="encontros.galeria.fotos" data-index="' + i + '">&times;</button></div>';
    });
    html += '</div>';
    var idg = 'upgal' + (++uid);
    html += '<button type="button" class="btn-add" data-action="pick" data-target="' + idg + '">+ Adicionar foto(s)</button>' +
      '<input type="file" accept="image/*" hidden multiple data-upload-arr="encontros.galeria.fotos" id="' + idg + '"></div>';

    html += '<div class="card"><div class="card__title">Bloco contador (último quadrado da faixa)</div>' +
      '<div class="grid-2">' +
      fieldText('Destaque (ex: +150 FOTOS)', 'encontros.galeria.titulo') +
      fieldText('Linha menor (ex: em nossa galeria)', 'encontros.galeria.subtitulo') +
      '</div><div class="grid-2">' +
      fieldText('Texto do botão', 'encontros.galeria.botao_texto') +
      fieldText('Link do botão', 'encontros.galeria.botao_link') +
      '</div></div>';

    html += cardBotao('Botão do rodapé da seção', 'encontros.botao_texto', 'encontros.botao_link');
    return html;
  };

  builders.diretoria = function () {
    var html = panelHead('Diretoria', 'Cada pessoa aparece num card com foto, cargo e nome; ao clicar abre a descrição completa e as redes.');
    html += '<div class="card">' +
      fieldText('Linha pequena acima do título (ex: DIRETORIA EDR)', 'diretoria.eyebrow') +
      fieldText('Título da seção', 'diretoria.titulo') +
      fieldText('Subtítulo (frase abaixo do título)', 'diretoria.subtitulo') +
      '</div><div class="card"><div class="card__title">Membros</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">A ordem aqui é a ordem do carrossel. Cada contato preenchido vira um botão redondo; os vazios não aparecem.</div>';
    (data.diretoria.membros || []).forEach(function (m, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Membro ' + (i + 1) + (i === 0 ? ' — em destaque' : '') + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="diretoria.membros" data-index="' + i + '">Remover</button>' +
        '</div>' + imgField('Foto', 'diretoria.membros.' + i + '.foto') +
        fieldRange('Zoom da foto', 'diretoria.membros.' + i + '.zoom', { min: 100, max: 250, padrao: 100, rotuloMin: 'foto inteira', rotuloMax: 'perto do rosto' }) +
        '<div class="grid-2">' +
        fieldText('Nome', 'diretoria.membros.' + i + '.nome') +
        fieldText('Cargo', 'diretoria.membros.' + i + '.cargo') +
        '</div>' +
        fieldArea('Descrição (aparece ao clicar no card)', 'diretoria.membros.' + i + '.descricao') +
        fieldText('E-mail', 'diretoria.membros.' + i + '.email') +
        '<div class="grid-2">' +
        fieldText('LinkedIn (link completo)', 'diretoria.membros.' + i + '.linkedin') +
        fieldText('Instagram (link completo)', 'diretoria.membros.' + i + '.instagram') +
        '</div>' +
        '</div>';
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
    var usadas = [];
    (data.parceiras.lista || []).forEach(function (q) {
      var c = String(q.segmento || '').trim();
      if (c && usadas.indexOf(c) < 0) usadas.push(c);
    });
    html += '<datalist id="listaCategorias">' + usadas.map(function (c) { return '<option value="' + escAttr(c) + '">'; }).join('') + '</datalist>';
    html += '<div class="card"><div class="card__title">Empresas</div>' +
      '<div class="panel__desc" style="margin-bottom:14px">Toda empresa precisa de uma <strong>Categoria</strong>; sem ela, aparece em "Outras".</div>';
    (data.parceiras.lista || []).forEach(function (p, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Empresa ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="parceiras.lista" data-index="' + i + '">Remover</button>' +
        '</div>' + imgField('Logo', 'parceiras.lista.' + i + '.logo') +
        fieldRange('Zoom da logo', 'parceiras.lista.' + i + '.zoom', { min: 100, max: 220, padrao: 108, rotuloMin: 'logo inteira', rotuloMax: 'sem margem sobrando' }) +
        '<div class="grid-2">' +
        fieldText('Nome', 'parceiras.lista.' + i + '.nome') +
        fieldText('Link (site ou Instagram — abre em nova aba)', 'parceiras.lista.' + i + '.link') +
        '</div>' +
        '<div class="field"><label>Categoria — empresas com a mesma categoria ficam juntas na página de parceiras</label>' +
        '<input type="text" list="listaCategorias" data-bind="parceiras.lista.' + i + '.segmento" value="' + escAttr(p.segmento) +
        '" placeholder="Escolha uma da lista ou digite uma nova"></div>' +
        fieldArea('Descrição (mais informações sobre a empresa)', 'parceiras.lista.' + i + '.descricao') +
        '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="parceiras.lista">+ Adicionar empresa</button></div>';
    html += '<div class="card"><div class="card__title">Botão</div><div class="grid-2">' +
      fieldText('Texto do botão', 'parceiras.botao_texto') +
      fieldText('Link do botão', 'parceiras.botao_link') +
      '</div></div>';
    return html;
  };

  builders.sobre = function () {
    var html = panelHead('Sobre nós', 'Texto de apresentação, os três blocos (propósito, missão…) e o convite para o Instagram.');
    html += '<div class="card">' +
      fieldText('Título da seção', 'sobre.titulo') +
      fieldArea('Texto de abertura', 'sobre.intro') +
      '</div><div class="card"><div class="card__title">Blocos</div>';
    (data.sobre.itens || []).forEach(function (it, i) {
      var p = 'sobre.itens.' + i + '.';
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Bloco ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="sobre.itens" data-index="' + i + '">Remover</button>' +
        '</div>' + fieldIcon('Ícone', p + 'icone') + fieldText('Título', p + 'titulo') + fieldArea('Texto', p + 'texto') + '</div>';
    });
    html += '<button type="button" class="btn-add" data-action="add" data-arr="sobre.itens">+ Adicionar bloco</button></div>';
    html += '<div class="card"><div class="card__title">Conhecendo o EDR (usa o Instagram do Rodapé)</div>' +
      fieldText('Título', 'sobre.insta_titulo') + fieldArea('Texto', 'sobre.insta_texto') +
      fieldText('Texto do botão', 'sobre.insta_botao') + '</div>';
    return html;
  };

  builders.albuns = function () {
    var html = panelHead('Galeria por mês', 'Cada mês é um álbum. Os mais recentes aparecem primeiro no site; clicar numa foto abre ampliada.');
    var meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
      .map(function (m, i) { return { value: String(i + 1), label: m }; });
    (data.encontros.albuns || []).forEach(function (a, i) {
      var p = 'encontros.albuns.' + i + '.';
      html += '<div class="card"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Álbum ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="encontros.albuns" data-index="' + i + '">Remover álbum</button></div>' +
        '<div class="grid-2">' + fieldSelect('Mês', p + 'mes', meses) + fieldText('Ano (ex: 2026)', p + 'ano') + '</div>' +
        '<div class="photo-grid">';
      (a.fotos || []).forEach(function (foto, k) {
        html += '<div class="photo-tile"><img src="' + escAttr(foto) + '">' +
          '<button type="button" class="photo-tile__del" data-action="remove" data-arr="' + p + 'fotos" data-index="' + k + '">&times;</button></div>';
      });
      var idu = 'upalb' + (++uid);
      html += '</div><button type="button" class="btn-add" data-action="pick" data-target="' + idu + '">+ Adicionar foto(s)</button>' +
        '<input type="file" accept="image/*" hidden multiple data-upload-arr="' + p + 'fotos" id="' + idu + '"></div>';
    });
    html += '<div class="card"><button type="button" class="btn-add" data-action="add" data-arr="encontros.albuns">+ Novo álbum (mês)</button></div>';
    return html;
  };

  builders.links = function () {
    return panelHead('Links e extras', 'Link do grupo de WhatsApp e itens adicionais do rodapé.') +
      '<div class="card"><div class="card__title">Quero participar</div>' +
        fieldText('Link de convite do grupo do WhatsApp (https://chat.whatsapp.com/…)', 'config.whatsapp_grupo') +
      '</div>' +
      '<div class="card"><div class="card__title">Logo adicional (rodapé)</div>' +
        imgField('Logo', 'config.logo_extra') + fieldText('Nome (texto alternativo)', 'config.logo_extra_nome') +
      '</div>' +
      '<div class="card"><div class="card__title">Instagram adicional (rodapé)</div>' +
        fieldText('Link completo do perfil', 'config.instagram_extra') + fieldText('Nome do perfil', 'config.instagram_extra_nome') +
      '</div>';
  };

  builders.pilares = function () {
    var html = panelHead('Nossos Pilares', 'Os pilares do movimento (ícone, título e descrição).');
    html += '<div class="card">' + fieldText('Título da seção', 'pilares.titulo') + '</div><div class="card">';
    (data.pilares.itens || []).forEach(function (item, i) {
      html += '<div class="repeat-item"><div class="repeat-item__head">' +
        '<span class="repeat-item__label">Pilar ' + (i + 1) + '</span>' +
        '<button type="button" class="btn-remove" data-action="remove" data-arr="pilares.itens" data-index="' + i + '">Remover</button>' +
        '</div>' +
        fieldIcon('Ícone', 'pilares.itens.' + i + '.icone') +
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

  /**
   * Redesenha a aba atual sem sair do lugar. Enviar uma foto, adicionar ou
   * remover um item reconstroi o painel inteiro; sem guardar a rolagem, a
   * pagina saltava para o topo a cada acao.
   */
  function redesenha() {
    var y = window.scrollY;
    main.innerHTML = (builders[currentTab] || function () { return ''; })();
    window.scrollTo(0, y);
  }

  /* ----------------------------------------------------- add templates - */
  function makeNew(arrPath) {
    switch (arrPath) {
      case 'nav': return { label: 'NOVO', href: '#' };
      case 'hero.paragrafos': return '';
      case 'hero.destaques': return { icone: 'crown', titulo: 'NOVO DESTAQUE', texto: '' };
      case 'hero.pastoral_valores': return { icone: 'crown', titulo: 'NOVO VALOR', texto: '' };
      case 'numeros.itens': return { icone: 'crown', valor: '+0', texto: 'DESCRIÇÃO' };
      case 'encontros.cards': return { foto: '', zoom: 100, selo: '', badge: 'ENCONTRO #', titulo: 'Novo encontro', data: '', local: '', publico: '', botao_texto: 'VER GALERIA COMPLETA', botao_link: '#' };
      case 'encontros.galeria.fotos': return '';
      case 'diretoria.membros': return { nome: 'NOME', cargo: 'CARGO', foto: '', zoom: 100, descricao: '', email: '', linkedin: '', instagram: '' };
      case 'parceiras.lista': return { nome: 'Empresa', logo: '', link: '#', segmento: '', descricao: '', zoom: 108 };
      case 'sobre.itens': return { icone: 'crown', titulo: 'NOVO', texto: '' };
      case 'encontros.albuns': return { mes: String(new Date().getMonth() + 1), ano: String(new Date().getFullYear()), fotos: [] };
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
    if (!el.dataset || !el.dataset.bind) return;
    setByPath(data, el.dataset.bind, el.value);

    // slider: atualiza o valor mostrado ao lado do rótulo
    if (el.type === 'range') {
      var campo = el.closest('.field');
      var saida = campo && campo.querySelector('.range-val');
      if (saida) saida.textContent = el.value + '%';
    }
  });
  main.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.bind) setByPath(data, el.dataset.bind, el.value);

    // upload simples (1 imagem)
    if (el.dataset && el.dataset.upload && el.files && el.files[0]) {
      var path = el.dataset.upload;
      uploadFile(el.files[0]).then(function (j) {
        setByPath(data, path, j.url); redesenha(); toast('Imagem enviada.');
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
          setByPath(data, arrPath, arr); redesenha(); toast('Foto(s) adicionada(s).');
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
      setByPath(data, btn.dataset.path, ''); redesenha();
    } else if (action === 'add') {
      var arrP = btn.dataset.arr;
      var arr = getByPath(data, arrP) || [];
      arr.push(makeNew(arrP));
      setByPath(data, arrP, arr); redesenha();
    } else if (action === 'remove') {
      var ap = btn.dataset.arr;
      var idx = parseInt(btn.dataset.index, 10);
      var a = getByPath(data, ap) || [];
      a.splice(idx, 1);
      setByPath(data, ap, a); redesenha();
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
      data.hero.destaques = data.hero.destaques || [];
      data.hero.imagem_intensidade = data.hero.imagem_intensidade || 'media';
      data.numeros = data.numeros || {}; data.numeros.itens = data.numeros.itens || [];
      data.nav = data.nav || []; data.encontros = data.encontros || {}; data.encontros.cards = data.encontros.cards || [];
      data.encontros.galeria = data.encontros.galeria || {}; data.encontros.galeria.fotos = data.encontros.galeria.fotos || [];
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
