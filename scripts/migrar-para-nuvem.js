/**
 * Migra o conteudo e as fotos locais para a nuvem (Vercel Blob + Upstash Redis).
 *
 * Rode UMA vez, no seu computador, com as variaveis do projeto na Vercel:
 *
 *   npx vercel link
 *   npx vercel env pull .env.local
 *   node scripts/migrar-para-nuvem.js
 *
 * - envia cada arquivo de public/uploads para o Blob (nada e apagado localmente)
 * - troca os caminhos /uploads/... do content.json pelos enderecos do Blob
 * - grava o conteudo no Redis e registra as versoes reduzidas (srcset)
 * - se o Redis ja tiver conteudo (alguem editou no painel), NAO sobrescreve;
 *   use --forcar para substituir de proposito
 */
const fs = require('fs');
const path = require('path');

// carrega .env.local sem depender de pacote extra
const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
  for (const linha of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const cloud = require('../lib/cloud');
const png = require('../lib/png');

const TIPOS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

async function main() {
  if (!cloud.ativo) {
    console.error('Faltam variaveis: BLOB_READ_WRITE_TOKEN e KV_REST_API_URL / KV_REST_API_TOKEN.\nRode "npx vercel env pull .env.local" antes.');
    process.exit(1);
  }
  const forcar = process.argv.includes('--forcar');

  const existente = await cloud.redis.get(cloud.CHAVES.conteudo);
  if (existente && !forcar) {
    console.error('O Redis ja tem conteudo (editado no painel?). Nada foi alterado.\nUse --forcar se quiser substituir.');
    process.exit(1);
  }

  const dir = path.join(__dirname, '..', 'public', 'uploads');
  const arquivos = fs.readdirSync(dir).filter((f) => TIPOS[path.extname(f).toLowerCase()]);
  const urls = {};
  let i = 0;
  for (const nome of arquivos) {
    const ext = path.extname(nome).toLowerCase();
    urls[nome] = await cloud.enviarImagem(nome, fs.readFileSync(path.join(dir, nome)), TIPOS[ext]);
    console.log('  [' + (++i) + '/' + arquivos.length + '] ' + nome);
  }

  // content.json com os enderecos novos
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'content.json'), 'utf8'));
  const novo = JSON.parse(JSON.stringify(base, (k, v) => {
    if (typeof v === 'string' && v.startsWith('/uploads/')) return urls[path.basename(v)] || v;
    return v;
  }));
  await cloud.redis.set(cloud.CHAVES.conteudo, novo);

  // srcset das imagens que tem versoes reduzidas
  const mapa = {};
  for (const nome of arquivos) {
    if (/-\d+w\.png$/i.test(nome)) continue;
    const itens = png.LARGURAS_VARIANTE
      .filter((w) => urls[png.nomeVariante(nome, w)])
      .map((w) => urls[png.nomeVariante(nome, w)] + ' ' + w + 'w');
    const dim = itens.length ? png.dimensoesArquivo(path.join(dir, nome)) : null;
    if (dim) mapa[urls[nome]] = itens.concat(urls[nome] + ' ' + dim.w + 'w').join(', ');
  }
  if (Object.keys(mapa).length) await cloud.redis.hset(cloud.CHAVES.variantes, mapa);

  console.log('\nPronto: ' + arquivos.length + ' arquivo(s) no Blob, conteudo no Redis.');
}

main().catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
