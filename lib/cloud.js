/**
 * Armazenamento em nuvem para a Vercel (o disco da implantacao e somente leitura).
 *
 *  - Upstash Redis : conteudo do site, senha do painel, sessoes e o mapa de variantes
 *  - Vercel Blob   : fotos enviadas pelo painel
 *
 * Fica ativo so quando as quatro variaveis abaixo existem (a Vercel as cria ao
 * conectar o Blob e o Redis ao projeto). Sem elas o site grava em disco, como
 * sempre fez.
 */
const session = require('express-session');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const ativo = !!(REDIS_URL && REDIS_TOKEN && BLOB_TOKEN);

let redis = null;
let blob = null;
if (ativo) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  blob = require('@vercel/blob');
}

const CHAVES = {
  conteudo: 'edr:content',
  admin: 'edr:admin',
  variantes: 'edr:variantes',
  sessao: 'edr:sess:'
};

/** Sessao do painel guardada no Redis: cada requisicao pode cair numa instancia diferente. */
function criarStoreDeSessao(maxAgeMs) {
  class RedisStore extends session.Store {
    get(sid, cb) { redis.get(CHAVES.sessao + sid).then((s) => cb(null, s || null), cb); }
    set(sid, sess, cb) {
      redis.set(CHAVES.sessao + sid, sess, { ex: Math.ceil(maxAgeMs / 1000) }).then(() => cb && cb(), (e) => cb && cb(e));
    }
    destroy(sid, cb) { redis.del(CHAVES.sessao + sid).then(() => cb && cb(), (e) => cb && cb(e)); }
  }
  return new RedisStore();
}

/** Envia um buffer ao Blob com o nome exato (sem sufixo aleatorio) e devolve a URL publica. */
async function enviarImagem(nome, buffer, contentType) {
  const r = await blob.put('uploads/' + nome, buffer, {
    access: 'public',
    token: BLOB_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType
  });
  return r.url;
}

module.exports = { ativo, redis, CHAVES, criarStoreDeSessao, enviarImagem };
