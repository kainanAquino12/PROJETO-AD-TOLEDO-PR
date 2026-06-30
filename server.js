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

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// ----------------------------------------------------------------------------
// Utilidades de armazenamento (JSON em arquivo)
// ----------------------------------------------------------------------------
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readContent() {
  try {
    return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  } catch (e) {
    console.error('Erro ao ler content.json:', e.message);
    return {};
  }
}

function writeContent(data) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ----------------------------------------------------------------------------
// Senha do administrador (hash scrypt em data/admin.json)
// ----------------------------------------------------------------------------
const DEFAULT_PASSWORD = 'edr2024';

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function readAdmin() {
  if (!fs.existsSync(ADMIN_FILE)) {
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    const admin = { salt, hash };
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(admin, null, 2), 'utf8');
    console.log('\n  >> Senha padrao do painel criada: "' + DEFAULT_PASSWORD + '"');
    console.log('  >> Acesse /admin e troque a senha o quanto antes.\n');
    return admin;
  }
  return JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
}

function checkPassword(password) {
  const admin = readAdmin();
  const { hash } = hashPassword(password, admin.salt);
  // comparacao em tempo constante
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(admin.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function setPassword(password) {
  const { salt, hash } = hashPassword(password);
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({ salt, hash }, null, 2), 'utf8');
}

// ----------------------------------------------------------------------------
// Upload de imagens
// ----------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safe = 'img_' + Date.now() + '_' + Math.round(Math.random() * 1e6) + ext;
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas imagens sao permitidas.'));
  }
});

// ----------------------------------------------------------------------------
// App config
// ----------------------------------------------------------------------------
ensureDirs();
readAdmin(); // garante criacao do admin.json na primeira execucao

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'edr-toledo-secret-' + crypto.randomBytes(8).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 horas
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.auth) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Nao autorizado' });
  return res.redirect('/admin');
}

// ----------------------------------------------------------------------------
// Rotas publicas
// ----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.render('index', { c: readContent() });
});

// ----------------------------------------------------------------------------
// Painel administrativo
// ----------------------------------------------------------------------------
app.get('/admin', (req, res) => {
  if (req.session && req.session.auth) {
    return res.render('admin', { c: readContent() });
  }
  res.render('login', { erro: null });
});

app.post('/admin/login', (req, res) => {
  const { senha } = req.body;
  if (senha && checkPassword(senha)) {
    req.session.auth = true;
    return res.redirect('/admin');
  }
  res.render('login', { erro: 'Senha incorreta. Tente novamente.' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

// ----------------------------------------------------------------------------
// API (protegida)
// ----------------------------------------------------------------------------
app.get('/api/content', requireAuth, (req, res) => {
  res.json(readContent());
});

app.post('/api/content', requireAuth, (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Conteudo invalido' });
    }
    writeContent(incoming);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', requireAuth, upload.single('imagem'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ url: '/uploads/' + req.file.filename });
});

app.post('/api/password', requireAuth, (req, res) => {
  const { atual, nova } = req.body;
  if (!nova || nova.length < 4) {
    return res.status(400).json({ error: 'A nova senha deve ter ao menos 4 caracteres.' });
  }
  if (!checkPassword(atual)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  setPassword(nova);
  res.json({ ok: true });
});

// tratamento de erro de upload (tamanho/tipo)
app.use((err, req, res, next) => {
  if (err) {
    const msg = err.message || 'Erro no upload';
    if (req.path.startsWith('/api/')) return res.status(400).json({ error: msg });
    return res.status(400).send(msg);
  }
  next();
});

app.listen(PORT, () => {
  console.log('\n  Empreendedores do Reino - servidor no ar');
  console.log('  Site:   http://localhost:' + PORT);
  console.log('  Painel: http://localhost:' + PORT + '/admin\n');
});
