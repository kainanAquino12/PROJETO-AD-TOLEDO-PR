/**
 * Tratamento de PNG com transparencia, aplicado no momento do upload.
 *
 * Recortes de pessoas/logos costumam ser exportados sobre fundo branco. Nesse
 * caso os pixels semitransparentes da borda guardam a cor ja misturada com
 * branco (C = a*F + (1-a)*255). Sobre fundo escuro isso vira um halo claro em
 * volta da silhueta, e ao reduzir a imagem o navegador espalha esse branco
 * para dentro da borda -- e por isso que "afastar o zoom" piora o efeito.
 *
 * Aqui a gente:
 *   1. detecta a contaminacao (brilho sobe conforme o alfa cai);
 *   2. desfaz a mistura, recuperando a cor real da borda;
 *   3. "sangra" essa cor para dentro da area transparente, para a reducao do
 *      navegador nunca ter branco para misturar.
 *
 * Nao mexe em PNG sem alfa nem em PNG ja limpo. Formatos que este decodificador
 * nao cobre (entrelacado, 16 bits, paleta) sao devolvidos intactos.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_PIXELS = 40e6;        // trava de memoria
const RAIO_SANGRIA = 12;        // cobre a vizinhanca usada pelo navegador ao reduzir
const LIMIAR_MATTE = 40;        // diferenca de brilho que caracteriza matte branco

// larguras geradas para o srcset. Cobrem a coluna de 310px do card (1x e 2x) e
// o layout empilhado do celular, onde a foto ocupa a largura toda.
const LARGURAS_VARIANTE = [400, 640, 900, 1280];

/* --------------------------------------------------------------- CRC32 --- */
const TABELA = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* ----------------------------------------------------------- decodificar - */
function decodificar(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8, ihdr = null;
  const idat = [];
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const tipo = buf.toString('ascii', p + 4, p + 8);
    const dados = buf.subarray(p + 8, p + 8 + len);
    if (tipo === 'IHDR') {
      ihdr = { w: dados.readUInt32BE(0), h: dados.readUInt32BE(4), bits: dados[8], cor: dados[9], entrelace: dados[12] };
    } else if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'IEND') break;
    p += 12 + len;
  }
  if (!ihdr || ihdr.cor !== 6 || ihdr.bits !== 8 || ihdr.entrelace !== 0) return null;
  if (ihdr.w * ihdr.h > MAX_PIXELS) return null;

  const bruto = zlib.inflateSync(Buffer.concat(idat));
  const lw = ihdr.w * 4;
  if (bruto.length < ihdr.h * (lw + 1)) return null;

  const px = Buffer.alloc(ihdr.h * lw);
  let o = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const filtro = bruto[o++];
    const lin = bruto.subarray(o, o + lw); o += lw;
    const dst = y * lw, ant = (y - 1) * lw;
    for (let x = 0; x < lw; x++) {
      const a = x >= 4 ? px[dst + x - 4] : 0;
      const b = y > 0 ? px[ant + x] : 0;
      const c = (x >= 4 && y > 0) ? px[ant + x - 4] : 0;
      let v = lin[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      px[dst + x] = v & 0xff;
    }
  }
  return { w: ihdr.w, h: ihdr.h, px };
}

/* ------------------------------------------------------------ codificar -- */
function codificar(img) {
  const lw = img.w * 4;
  const cru = Buffer.alloc(img.h * (lw + 1));
  for (let y = 0; y < img.h; y++) {
    cru[y * (lw + 1)] = 0;                       // filtro 0 (none)
    img.px.copy(cru, y * (lw + 1) + 1, y * lw, y * lw + lw);
  }
  const chunk = (tipo, dados) => {
    const c = Buffer.alloc(8 + dados.length + 4);
    c.writeUInt32BE(dados.length, 0);
    c.write(tipo, 4, 'ascii');
    dados.copy(c, 8);
    c.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, 'ascii'), dados])), 8 + dados.length);
    return c;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6;                      // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(cru, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ------------------------------------------------- detectar matte branco - */
function detectarMatteBranco(img) {
  let somaClara = 0, nClara = 0, somaOpaca = 0, nOpaca = 0;
  for (let i = 0; i < img.px.length; i += 4) {
    const a = img.px[i + 3];
    if (a === 0 || a === 255) continue;
    const brilho = (img.px[i] + img.px[i + 1] + img.px[i + 2]) / 3;
    if (a <= 64) { somaClara += brilho; nClara++; }
    else if (a >= 192) { somaOpaca += brilho; nOpaca++; }
  }
  if (nClara < 200 || nOpaca < 200) return 0;    // borda curta demais para julgar
  return (somaClara / nClara) - (somaOpaca / nOpaca);
}

/* ------------------------------------------- desfazer a mistura com branco */
function desmatizar(img) {
  const px = img.px;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0 || a === 255) continue;
    const af = a / 255;
    for (let k = 0; k < 3; k++) {
      const f = (px[i + k] - (1 - af) * 255) / af;
      px[i + k] = f < 0 ? 0 : f > 255 ? 255 : Math.round(f);
    }
    n++;
  }
  return n;
}

/* ------------- espalhar a cor da borda para dentro da area transparente --- */
/* Busca em largura a partir dos pixels com alfa > 0. Mexe so no RGB dos
   pixels totalmente transparentes -- o alfa continua 0, entao nada disso
   aparece na tela; serve para o navegador ter cor correta para amostrar
   quando reduz a imagem. */
function sangrar(img, raio) {
  const { w, h, px } = img;
  const total = w * h;
  const temCor = new Uint8Array(total);
  const fila = new Int32Array(total);
  let ini = 0, fim = 0;

  for (let i = 0; i < total; i++) {
    if (px[i * 4 + 3] > 0) { temCor[i] = 1; fila[fim++] = i; }
  }
  if (!fim || fim === total) return 0;

  let pintados = 0, nivel = 0, fimNivel = fim;
  while (ini < fim && nivel < raio) {
    while (ini < fimNivel) {
      const p = fila[ini++];
      const px4 = p * 4;
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || (!dx && !dy)) continue;
          const q = ny * w + nx;
          if (temCor[q]) continue;
          const q4 = q * 4;
          px[q4] = px[px4]; px[q4 + 1] = px[px4 + 1]; px[q4 + 2] = px[px4 + 2];
          temCor[q] = 1; fila[fim++] = q; pintados++;
        }
      }
    }
    fimNivel = fim;
    nivel++;
  }
  return pintados;
}

/* ------------------------------------------------------- redimensionar --- */
/* Reducao por media de area (box filter), separada em duas passadas.
   Duas coisas importam aqui:

   1. O navegador, ao encolher uma imagem muito (a foto pastoral entra numa
      coluna de 310px vinda de 1555px), amostra poucos pixels de origem e joga
      o resto fora -- dai a imagem "melhorar conforme se da zoom", porque o
      zoom diminui a taxa de reducao. A media de area usa todos os pixels de
      origem que caem no pixel de destino, entao nao ha detalhe descartado.

   2. A media e feita com alfa pre-multiplicado. Sem isso, a cor de pixels
      invisiveis entra na conta com o mesmo peso dos visiveis e a borda do
      recorte fica suja -- o mesmo problema que sangrar() evita do lado do
      navegador. */
function redimensionar(img, novaLargura) {
  const { w, h, px } = img;
  if (!(novaLargura > 0) || novaLargura >= w) return null;
  const novaAltura = Math.max(1, Math.round(h * (novaLargura / w)));

  // passada horizontal: w -> novaLargura, ja em pre-multiplicado
  const inter = new Float32Array(novaLargura * h * 4);
  const escX = w / novaLargura;
  for (let y = 0; y < h; y++) {
    const orig = y * w * 4, dest = y * novaLargura * 4;
    for (let nx = 0; nx < novaLargura; nx++) {
      const x0 = nx * escX, x1 = x0 + escX;
      const iIni = Math.floor(x0), iFim = Math.min(w, Math.ceil(x1));
      let r = 0, g = 0, b = 0, a = 0, peso = 0;
      for (let x = iIni; x < iFim; x++) {
        const q = Math.min(x + 1, x1) - Math.max(x, x0);
        if (q <= 0) continue;
        const p = orig + x * 4, af = px[p + 3] / 255;
        r += px[p] * af * q; g += px[p + 1] * af * q; b += px[p + 2] * af * q;
        a += px[p + 3] * q; peso += q;
      }
      const d = dest + nx * 4;
      inter[d] = r / peso; inter[d + 1] = g / peso;
      inter[d + 2] = b / peso; inter[d + 3] = a / peso;
    }
  }

  // passada vertical: h -> novaAltura, desfazendo o pre-multiplicado no fim
  const out = Buffer.alloc(novaLargura * novaAltura * 4);
  const escY = h / novaAltura;
  for (let ny = 0; ny < novaAltura; ny++) {
    const y0 = ny * escY, y1 = y0 + escY;
    const jIni = Math.floor(y0), jFim = Math.min(h, Math.ceil(y1));
    for (let nx = 0; nx < novaLargura; nx++) {
      let r = 0, g = 0, b = 0, a = 0, peso = 0;
      for (let y = jIni; y < jFim; y++) {
        const q = Math.min(y + 1, y1) - Math.max(y, y0);
        if (q <= 0) continue;
        const s = (y * novaLargura + nx) * 4;
        r += inter[s] * q; g += inter[s + 1] * q; b += inter[s + 2] * q;
        a += inter[s + 3] * q; peso += q;
      }
      const d = (ny * novaLargura + nx) * 4;
      const alfa = a / peso, af = alfa / 255;
      out[d + 3] = Math.round(alfa);
      if (af > 0) {
        const v = (soma) => { const c = Math.round(soma / peso / af); return c < 0 ? 0 : c > 255 ? 255 : c; };
        out[d] = v(r); out[d + 1] = v(g); out[d + 2] = v(b);
      }
    }
  }
  return { w: novaLargura, h: novaAltura, px: out };
}

/* ---------------------------------------------------- ler so o cabecalho - */
/* Largura/altura sem decodificar os pixels -- serve para montar o srcset. */
function dimensoesArquivo(caminho) {
  let fd;
  try {
    fd = fs.openSync(caminho, 'r');
    const cab = Buffer.alloc(24);
    if (fs.readSync(fd, cab, 0, 24, 0) < 24) return null;
    if (cab.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: cab.readUInt32BE(16), h: cab.readUInt32BE(20) };
  } catch (e) {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (e) { /* ignora */ }
  }
}

/* ------------------------------------------------------------- fachada --- */
/**
 * Limpa o PNG no lugar. Devolve um resumo do que foi feito (ou null se o
 * arquivo nao for um PNG RGBA tratavel).
 */
function limparArquivo(caminho) {
  let img;
  try {
    img = decodificar(fs.readFileSync(caminho));
  } catch (e) {
    return null;
  }
  if (!img) return null;

  const contaminacao = detectarMatteBranco(img);
  const temMatte = contaminacao > LIMIAR_MATTE;
  const bordas = temMatte ? desmatizar(img) : 0;
  const pintados = sangrar(img, RAIO_SANGRIA);
  if (!bordas && !pintados) return null;

  try {
    fs.writeFileSync(caminho, codificar(img));
  } catch (e) {
    return null;
  }
  return { contaminacao: Math.round(contaminacao), bordas, pintados };
}

/**
 * Nome do arquivo de uma variante: foto.png + 640 -> foto-640w.png
 */
function nomeVariante(nomeArquivo, largura) {
  const ext = path.extname(nomeArquivo);
  return path.basename(nomeArquivo, ext) + '-' + largura + 'w' + ext;
}

/**
 * Gera as versoes reduzidas do PNG ao lado do original e devolve as larguras
 * criadas. Sem isso o navegador teria que encolher o arquivo cheio sozinho, que
 * e justamente o que borra a imagem.
 */
function gerarVariantes(caminho, larguras) {
  let img;
  try {
    img = decodificar(fs.readFileSync(caminho));
  } catch (e) {
    return [];
  }
  if (!img) return [];

  const dir = path.dirname(caminho);
  const nome = path.basename(caminho);
  const feitas = [];

  for (const largura of (larguras || LARGURAS_VARIANTE)) {
    if (largura >= img.w) continue;             // nao aumenta imagem pequena
    const menor = redimensionar(img, largura);
    if (!menor) continue;
    // a reducao deixa preto no que e totalmente transparente; sangrar de novo
    // mantem a protecao de borda que limparArquivo() aplicou no original
    sangrar(menor, RAIO_SANGRIA);
    try {
      fs.writeFileSync(path.join(dir, nomeVariante(nome, largura)), codificar(menor));
      feitas.push(largura);
    } catch (e) { /* uma variante a menos nao quebra o upload */ }
  }
  return feitas;
}

module.exports = {
  limparArquivo, decodificar, codificar, detectarMatteBranco, desmatizar, sangrar,
  redimensionar, dimensoesArquivo, gerarVariantes, nomeVariante, LARGURAS_VARIANTE
};
