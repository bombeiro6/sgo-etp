/* ============================================================
 * SGO-ETP · log.js — observabilidade do frontend
 * ------------------------------------------------------------
 * Regras cobertas:
 *   #1  Correlation ID por sessão (rastreabilidade)
 *   #2  Stack trace completo nos erros
 *   #3  Log estruturado em JSON (não texto livre)
 *   #5  Query logging com tempo (duracao_ms)
 *
 * Como usar (1 linha em cada página, ANTES dos seus scripts):
 *   <script>
 *     window.SGO_CONFIG = {
 *       SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
 *       SUPABASE_ANON_KEY: 'SUA-ANON-KEY'
 *     };
 *   </script>
 *   <script src="log.js"></script>
 *
 * Depois, no seu código:
 *   SGOLog.info('inspecao_salva', { extintor: 'EXT-014', turno: 'ALFA' });
 *   SGOLog.warn('hidrante_sem_pressao', { tag: 'HD-NI-07' });
 *
 *   // Para medir e logar o tempo de uma operação de banco (#5):
 *   const dados = await SGOLog.query('listar_extintores', () =>
 *     fetch(url, opts).then(r => r.json())
 *   );
 *
 * Erros não tratados são capturados e logados sozinhos (#2).
 * O logging é "fire-and-forget": NUNCA quebra o app se a rede falhar.
 * ============================================================ */
(function () {
  'use strict';

  var cfg = window.SGO_CONFIG || {};
  var URL = (cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY = cfg.SUPABASE_ANON_KEY || '';
  var TABELA = '/rest/v1/logs';

  // ---- Correlation ID por sessão (#1) ----------------------
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var correlationId;
  try {
    correlationId = sessionStorage.getItem('sgo_correlation_id');
    if (!correlationId) {
      correlationId = uuid();
      sessionStorage.setItem('sgo_correlation_id', correlationId);
    }
  } catch (e) {
    correlationId = uuid();
  }

  // ---- Envio para o Supabase (nunca lança erro) ------------
  function enviar(payload) {
    if (!URL || !KEY) {
      // Sem config: loga só no console, em JSON, e segue a vida.
      try { console.log('[SGOLog]', JSON.stringify(payload)); } catch (e) {}
      return;
    }
    try {
      fetch(URL + TABELA, {
        method: 'POST',
        headers: {
          'apikey': KEY,
          'Authorization': 'Bearer ' + KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload),
        keepalive: true // garante o envio mesmo se a página estiver fechando
      }).catch(function () { /* silencioso de propósito */ });
    } catch (e) { /* silencioso de propósito */ }
  }

  // ---- Monta o registro estruturado (#3) -------------------
  function registrar(nivel, evento, dados, extra) {
    var payload = {
      nivel: nivel,
      evento: evento || null,
      correlation_id: correlationId,
      pagina: (location.pathname + location.search) || null,
      dados: dados || null,
      user_agent: navigator.userAgent
    };
    if (extra && typeof extra.duracao_ms === 'number') payload.duracao_ms = extra.duracao_ms;
    if (extra && extra.stack) payload.stack = extra.stack;

    // Espelho no console, sempre em JSON estruturado (nunca texto solto).
    try {
      var fn = nivel === 'error' ? console.error : (nivel === 'warn' ? console.warn : console.log);
      fn('[SGOLog]', JSON.stringify(payload));
    } catch (e) {}

    enviar(payload);
    return payload;
  }

  // ---- API pública -----------------------------------------
  var SGOLog = {
    correlationId: correlationId,

    info: function (evento, dados) { return registrar('info', evento, dados); },
    warn: function (evento, dados) { return registrar('warn', evento, dados); },
    error: function (evento, dados) { return registrar('error', evento, dados); },

    // Captura um erro com stack trace completo (#2)
    capturarErro: function (err, evento, dados) {
      var stack = (err && err.stack) ? String(err.stack)
                : (err && err.message) ? String(err.message)
                : String(err);
      return registrar('error', evento || 'erro_capturado', dados || { mensagem: (err && err.message) || String(err) }, { stack: stack });
    },

    // Mede e loga o tempo de uma operação assíncrona (#5).
    // Uso: await SGOLog.query('nome', () => fetch(...).then(r => r.json()))
    query: function (label, fn, dados) {
      var inicio = (window.performance && performance.now) ? performance.now() : Date.now();
      var done = function () {
        var fim = (window.performance && performance.now) ? performance.now() : Date.now();
        return Math.round(fim - inicio);
      };
      var p;
      try { p = Promise.resolve(fn()); }
      catch (e) {
        SGOLog.capturarErro(e, 'query_falhou', { query: label, duracao_ms: done() });
        return Promise.reject(e);
      }
      return p.then(function (res) {
        registrar('info', 'query', Object.assign({ query: label }, dados || {}), { duracao_ms: done() });
        return res;
      }, function (err) {
        var d = done();
        SGOLog.capturarErro(err, 'query_falhou', Object.assign({ query: label, duracao_ms: d }, dados || {}));
        throw err;
      });
    }
  };

  // ---- Handlers globais de erro (#2) -----------------------
  window.addEventListener('error', function (ev) {
    var err = ev.error || { message: ev.message, stack: (ev.filename || '') + ':' + (ev.lineno || '') + ':' + (ev.colno || '') };
    SGOLog.capturarErro(err, 'erro_nao_tratado', { source: ev.filename, linha: ev.lineno });
  });

  window.addEventListener('unhandledrejection', function (ev) {
    SGOLog.capturarErro(ev.reason || { message: 'promise rejeitada sem motivo' }, 'promise_rejeitada');
  });

  window.SGOLog = SGOLog;
  // Marca o carregamento da página (útil pra ver navegação no log)
  registrar('info', 'pagina_carregada', { ref: document.referrer || null });
})();
