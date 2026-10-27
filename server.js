/**
 * EDR - Empreendedores do Reino (Toledo/PR)
 * Servidor do site institucional + painel administrativo.
 *
 * - Site publico renderizado com EJS a partir de data/content.json
 * - Painel /admin protegido por senha para editar todo o conteudo
 * - Upload de imagens em /public/uploads
 */

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const png = require('./lib/png');
const cloud = require('./lib/cloud');

const app = express();
const PORT = process.env.PORT || 3001;

// Em producao (Render/Railway) estas duas variaveis apontam para o disco
// persistente; sem elas o comportamento e o mesmo de sempre, gravando dentro
// da propria pasta do projeto.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');

// copias que vem no repositorio, usadas para popular o disco no primeiro deploy
const SEMENTE_DATA = path.join(__dirname, 'data');
const SEMENTE_UPLOADS = path.join(__dirname, 'public', 'uploads');

// ----------------------------------------------------------------------------
// Utilidades de armazenamento (JSON em arquivo)
// ----------------------------------------------------------------------------
function ensureDirs() {
  // na Vercel o disco da implantacao e somente leitura (EROFS): nao derruba o site
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.warn('  aviso: sem permissao de escrita em disco (' + e.code + ')');
  }
}

/**
 * No primeiro deploy o disco persistente esta vazio. Copia o conteudo e as
 * imagens versionados no repositorio para dentro dele, sem sobrescrever nada
 * que ja exista (o que o painel gravou sempre vence).
 */
function semearDisco() {
  const semente = path.join(SEMENTE_DATA, 'content.json');
  if (semente !== CONTENT_FILE && fs.existsSync(semente) && !fs.existsSync(CONTENT_FILE)) {
    fs.copyFileSync(semente, CONTENT_FILE);
    console.log('  conteudo inicial copiado para ' + CONTENT_FILE);
  }

  if (SEMENTE_UPLOADS !== UPLOAD_DIR && fs.existsSync(SEMENTE_UPLOADS)) {
    let n = 0;
    for (const arquivo of fs.readdirSync(SEMENTE_UPLOADS)) {
      if (arquivo === '.gitkeep') continue;
      const destino = path.join(UPLOAD_DIR, arquivo);
      if (fs.existsSync(destino)) continue;
      fs.copyFileSync(path.join(SEMENTE_UPLOADS, arquivo), destino);
      n++;
    }
    if (n) console.log('  ' + n + ' imagem(ns) copiada(s) para ' + UPLOAD_DIR);
  }
}

// Blocos adicionados depois do primeiro deploy: o content.json do disco
// persistente nao os tem, entao o site e o painel recebem valores vazios.
function comPadroes(c) {
  c.config = Object.assign({ whatsapp_grupo: '', logo_extra: '', logo_extra_nome: '', instagram_extra: '', instagram_extra_nome: '' }, c.config);
  c.sobre = Object.assign({ titulo: 'SOBRE NÓS', intro: '', itens: [], insta_titulo: '', insta_texto: '', insta_botao: '' }, c.sobre);
  if (c.encontros && !Array.isArray(c.encontros.albuns)) c.encontros.albuns = [];
  return c;
}

async function readContent() {
  try {
    if (cloud.ativo) {
      let c = await cloud.redis.get(cloud.CHAVES.conteudo);
      if (!c) {
        // primeira vez na nuvem: parte do conteudo versionado no repositorio
        c = JSON.parse(fs.readFileSync(path.join(SEMENTE_DATA, 'content.json'), 'utf8'));
        await cloud.redis.set(cloud.CHAVES.conteudo, c);
      }
      return comPadroes(typeof c === 'string' ? JSON.parse(c) : c);
    }
    return comPadroes(JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')));
  } catch (e) {
    console.error('Erro ao ler o conteudo:', e.message);
    return comPadroes({});
  }
}

async function writeContent(data) {
  if (cloud.ativo) return cloud.redis.set(cloud.CHAVES.conteudo, data);
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ----------------------------------------------------------------------------
// Senha do administrador (hash scrypt em data/admin.json)
// ----------------------------------------------------------------------------
// Em producao defina ADMIN_PASSWORD no painel do host. Sem ela o painel sobe
// com a senha padrao, que e publica — ver o aviso em avisarSenhaPadrao().
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'edr2024';

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

// credencial gerada quando nao da para gravar em disco (sistema somente leitura)
let adminEmMemoria = null;

async function readAdmin() {
  if (cloud.ativo) {
    let admin = await cloud.redis.get(cloud.CHAVES.admin);
    if (!admin) {
      // primeiro acesso: a senha vem de ADMIN_PASSWORD e passa a viver no Redis
      const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
      admin = { salt, hash };
      await cloud.redis.set(cloud.CHAVES.admin, admin);
    }
    return typeof admin === 'string' ? JSON.parse(admin) : admin;
  }
  if (adminEmMemoria) return adminEmMemoria;
  if (!fs.existsSync(ADMIN_FILE)) {
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    const admin = { salt, hash };
    try {
      fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2), 'utf8');
    } catch (e) {
      // EROFS: usa a senha de ADMIN_PASSWORD so em memoria
      adminEmMemoria = admin;
      return admin;
    }
    console.log('\n  >> Senha padrao do painel criada: "' + DEFAULT_PASSWORD + '"');
    console.log('  >> Acesse /admin e troque a senha o quanto antes.\n');
    return admin;
  }
  return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
}

async function checkPassword(password) {
  const admin = await readAdmin();
  const { hash } = hashPassword(password, admin.salt);
  // comparacao em tempo constante
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(admin.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function setPassword(password) {
  const { salt, hash } = hashPassword(password);
  if (cloud.ativo) return cloud.redis.set(cloud.CHAVES.admin, { salt, hash });
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ salt, hash }, null, 2), 'utf8');
}

// ----------------------------------------------------------------------------
// Upload de imagens
// ----------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cloud.ativo ? os.tmpdir() : UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safe = 'img_' + Date.now() + '_' + Math.round(Math.random() * 1e6) + ext;
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  // funcoes da Vercel aceitam no maximo ~4,5MB por requisicao
  limits: { fileSize: (cloud.ativo ? 4 : 8) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas imagens sao permitidas.'));
  }
});

// ----------------------------------------------------------------------------
// Versoes reduzidas das imagens (srcset)
// ----------------------------------------------------------------------------
// Uma foto de 1555px encolhida pelo navegador para uma coluna de 310px perde
// quase todo o detalhe, porque a reducao do navegador amostra poucos pixels.
// Entregando o arquivo ja no tamanho de exibicao, a imagem fica igual em
// qualquer tela -- e o navegador ainda sobe de variante sozinho quando o
// usuario da zoom.
const cacheSrcset = new Map();

// na nuvem as variantes ficam no Blob; o mapa url -> srcset vem do Redis
let variantesNuvem = {};
async function carregarVariantes() {
  if (!cloud.ativo) return;
  try { variantesNuvem = (await cloud.redis.hgetall(cloud.CHAVES.variantes)) || {}; } catch (e) { /* sem srcset */ }
}

function srcsetDe(url) {
  if (cloud.ativo && variantesNuvem[url]) return variantesNuvem[url];
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return '';
  if (cacheSrcset.has(url)) return cacheSrcset.get(url);

  const nome = path.basename(url);
  const original = path.join(UPLOAD_DIR, nome);
  const itens = [];

  for (const largura of png.LARGURAS_VARIANTE) {
    const variante = png.nomeVariante(nome, largura);
    if (fs.existsSync(path.join(UPLOAD_DIR, variante))) {
      itens.push('/uploads/' + variante + ' ' + largura + 'w');
    }
  }

  // sem variantes (JPG, ou PNG que o decodificador nao cobre) o <img> continua
  // usando so o src normal
  let saida = '';
  if (itens.length) {
    const dim = png.dimensoesArquivo(original);
    if (dim) itens.push(url + ' ' + dim.w + 'w');
    saida = itens.join(', ');
  }

  cacheSrcset.set(url, saida);
  return saida;
}

// ----------------------------------------------------------------------------
// Texto longo do painel -> blocos prontos para o EJS
// ----------------------------------------------------------------------------
// A carta pastoral e digitada num textarea, entao chega aqui como texto corrido
// com quebras de linha. Cada linha vira um bloco: linha comecando com marcador
// (• - *) entra numa lista, linha aberta com aspas vira versiculo e o resto vira
// paragrafo. Linhas em branco so separam -- nao geram bloco vazio.
const RE_MARCADOR = /^(?:[•·◦]\s*|[*\-–—]\s+)/;
const RE_VERSICULO = /^["“„«]/;

function blocosDeTexto(texto) {
  if (!texto || typeof texto !== 'string') return [];

  const blocos = [];
  let lista = null;

  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const linha = bruta.replace(/^[\s ]+|[\s ]+$/g, '');
    if (!linha) { lista = null; continue; }

    if (RE_MARCADOR.test(linha)) {
      const item = linha.replace(RE_MARCADOR, '').trim();
      if (!item) continue;
      if (!lista) { lista = { tipo: 'lista', itens: [] }; blocos.push(lista); }
      lista.itens.push(item);
      continue;
    }

    lista = null;
    blocos.push({
      tipo: RE_VERSICULO.test(linha) ? 'versiculo' : 'paragrafo',
      texto: linha
    });
  }

  return blocos;
}

/* true quando o PNG e grande o bastante para valer variantes e ainda nao tem */
function precisaVariantes(nome) {
  if (!/\.png$/i.test(nome) || /-\d+w\.png$/i.test(nome)) return false;  // pula as proprias variantes
  const dim = png.dimensoesArquivo(path.join(UPLOAD_DIR, nome));
  if (!dim) return false;
  const alvos = png.LARGURAS_VARIANTE.filter((l) => l < dim.w);
  if (!alvos.length) return false;                                       // ja e pequena
  return !fs.existsSync(path.join(UPLOAD_DIR, png.nomeVariante(nome, alvos[0])));
}

/**
 * Cria as variantes das imagens que ja estavam na pasta antes desta mudanca
 * (e das que vierem junto com o disco persistente no deploy). Roda espacado,
 * fora do caminho critico: o site ja responde enquanto isso acontece.
 */
function backfillVariantes() {
  let pendentes;
  try {
    pendentes = fs.readdirSync(UPLOAD_DIR).filter(precisaVariantes);
  } catch (e) {
    return;
  }
  if (!pendentes.length) return;

  console.log('  gerando versoes reduzidas de ' + pendentes.length + ' imagem(ns) ja existentes...');
  let i = 0;
  (function proxima() {
    if (i >= pendentes.length) return;
    const nome = pendentes[i++];
    const feitas = png.gerarVariantes(path.join(UPLOAD_DIR, nome));
    if (feitas.length) {
      cacheSrcset.delete('/uploads/' + nome);
      console.log('    ' + nome + ' -> ' + feitas.join('w, ') + 'w');
    }
    setTimeout(proxima, 50);
  })();
}

// ----------------------------------------------------------------------------
// App config
// ----------------------------------------------------------------------------
if (!cloud.ativo) {
  ensureDirs();
  semearDisco(); // popula o disco persistente no primeiro deploy
  readAdmin().catch(() => {});   // garante criacao do admin.json na primeira execucao
  backfillVariantes(); // versoes reduzidas das imagens antigas, em segundo plano
}

// atras do proxy da Vercel; sem isso o cookie "secure" nao e enviado
app.set('trust proxy', 1);
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.srcset = srcsetDe;
app.locals.blocos = blocosDeTexto;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// quando UPLOAD_DIR aponta para fora de /public (disco persistente), as
// imagens precisam desta rota para continuarem acessiveis em /uploads
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(session({
  store: cloud.ativo ? cloud.criarStoreDeSessao(1000 * 60 * 60 * 8) : undefined,
  secret: process.env.SESSION_SECRET || 'edr-toledo-secret-' + crypto.randomBytes(8).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8, secure: cloud.ativo ? 'auto' : false, sameSite: 'lax' } // 8 horas
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.auth) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Nao autorizado' });
  return res.redirect('/admin');
}

// ----------------------------------------------------------------------------
// Rotas publicas
// ----------------------------------------------------------------------------
app.get('/', ah(async (req, res) => {
  const [c] = await Promise.all([readContent(), carregarVariantes()]);
  res.render('index', { c });
}));

app.get('/parceiras', ah(async (req, res) => {
  const [c] = await Promise.all([readContent(), carregarVariantes()]);
  res.render('parceiras', { c });
}));

// ----------------------------------------------------------------------------
// Painel administrativo
// ----------------------------------------------------------------------------
app.get('/admin', ah(async (req, res) => {
  if (req.session && req.session.auth) {
    return res.render('admin', { c: await readContent() });
  }
  res.render('login', { erro: null });
}));

app.post('/admin/login', ah(async (req, res) => {
  const { senha } = req.body;
  if (senha && await checkPassword(senha)) {
    req.session.auth = true;
    return res.redirect('/admin');
  }
  res.render('login', { erro: 'Senha incorreta. Tente novamente.' });
}));

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

// ----------------------------------------------------------------------------
// API (protegida)
// ----------------------------------------------------------------------------
app.get('/api/content', requireAuth, ah(async (req, res) => {
  res.json(await readContent());
}));

app.post('/api/content', requireAuth, async (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Conteudo invalido' });
    }
    await writeContent(incoming);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', requireAuth, upload.single('imagem'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

  // Recortes em PNG costumam vir com as bordas misturadas com branco, o que
  // vira um halo claro sobre fundo escuro. Corrige aqui, no upload, para nao
  // depender de quem exportou a imagem.
  let variantes = [];
  if (/\.png$/i.test(req.file.filename)) {
    const r = png.limparArquivo(req.file.path);
    if (r) {
      console.log('  imagem tratada: ' + req.file.filename +
        ' (contaminacao ' + r.contaminacao + ', ' + r.bordas + ' bordas, ' + r.pintados + ' px preenchidos' +
        (r.recorte ? ', recortada de ' + r.recorte.antes.w + 'x' + r.recorte.antes.h +
                     ' para ' + r.recorte.depois.w + 'x' + r.recorte.depois.h : '') + ')');
    }

    // versoes reduzidas para o srcset, para o navegador nunca precisar
    // encolher o arquivo cheio na tela -- ver srcsetDe()
    variantes = png.gerarVariantes(req.file.path);
    if (variantes.length) {
      console.log('  variantes geradas: ' + variantes.join('w, ') + 'w');
    }
  }

  if (cloud.ativo) {
    // a pasta temporaria some entre execucoes: sobe tudo para o Blob agora
    const nome = req.file.filename;
    const tipo = req.file.mimetype || 'application/octet-stream';
    const url = await cloud.enviarImagem(nome, fs.readFileSync(req.file.path), tipo);
    const itens = [];
    for (const w of variantes) {
      const v = png.nomeVariante(nome, w);
      const vUrl = await cloud.enviarImagem(v, fs.readFileSync(path.join(os.tmpdir(), v)), 'image/png');
      itens.push(vUrl + ' ' + w + 'w');
      fs.unlink(path.join(os.tmpdir(), v), () => {});
    }
    const dim = png.dimensoesArquivo(req.file.path);
    fs.unlink(req.file.path, () => {});
    if (itens.length && dim) {
      itens.push(url + ' ' + dim.w + 'w');
      await cloud.redis.hset(cloud.CHAVES.variantes, { [url]: itens.join(', ') });
    }
    return res.json({ url });
  }

  cacheSrcset.delete('/uploads/' + req.file.filename);
  res.json({ url: '/uploads/' + req.file.filename });
}));

app.post('/api/password', requireAuth, ah(async (req, res) => {
  const { atual, nova } = req.body;
  if (!nova || nova.length < 4) {
    return res.status(400).json({ error: 'A nova senha deve ter ao menos 4 caracteres.' });
  }
  if (!(await checkPassword(atual))) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  await setPassword(nova);
  res.json({ ok: true });
}));

// tratamento de erro de upload (tamanho/tipo)
app.use((err, req, res, next) => {
  if (err) {
    const msg = err.message || 'Erro no upload';
    const status = err.code && String(err.code).startsWith('LIMIT_') || /imagens/.test(msg) ? 400 : 500;
    console.error('  erro:', msg);
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: msg });
    return res.status(status).send(msg);
  }
  next();
});

// Avisa alto e claro se o painel subir em producao com a senha publica.
async function avisarSenhaPadrao() {
  if (DEFAULT_PASSWORD !== 'edr2024' || !(await checkPassword('edr2024'))) return;
  const linha = '  ' + '!'.repeat(66);
  console.warn('\n' + linha);
  console.warn('  ATENCAO: o painel esta com a senha padrao "edr2024".');
  console.warn('  Ela e publica (esta no codigo). Troque em /admin > Trocar Senha,');
  console.warn('  ou defina a variavel ADMIN_PASSWORD antes do primeiro deploy.');
  console.warn(linha + '\n');
}

if (process.env.VERCEL) {
  // a Vercel chama o app como funcao; nao abre porta
  if (cloud.ativo && !process.env.SESSION_SECRET) console.warn('  ATENCAO: defina SESSION_SECRET na Vercel.');
} else {
  app.listen(PORT, () => {
    console.log('\n  Empreendedores do Reino - servidor no ar');
    console.log('  Site:   http://localhost:' + PORT);
    console.log('  Painel: http://localhost:' + PORT + '/admin');
    console.log('  Dados:  ' + (cloud.ativo ? 'Upstash Redis' : DATA_DIR));
    console.log('  Fotos:  ' + (cloud.ativo ? 'Vercel Blob' : UPLOAD_DIR) + '\n');
    avisarSenhaPadrao().catch(() => {});
  });
}

module.exports = app;
