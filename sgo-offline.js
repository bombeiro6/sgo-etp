/* SGO-ETP · fila de sincronização offline (nativo, sem dependências) */
(function(){
  var KEY='sgo_fila_insp', FAIL='sgo_fila_falhas';
  var _sb=null;

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch(e){ return []; } }
  function save(a){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch(e){} }
  function loadFail(){ try{ return JSON.parse(localStorage.getItem(FAIL)||'[]'); }catch(e){ return []; } }
  function pushFail(item){ var f=loadFail(); f.push(item); try{ localStorage.setItem(FAIL, JSON.stringify(f)); }catch(e){} }

  function isNetErr(e){
    if(!navigator.onLine) return true;
    var m=((e&&(e.message||e.error||e))+'').toLowerCase();
    return /failed to fetch|networkerror|network error|fetch|timeout|load failed/.test(m);
  }

  function badge(){
    var b=document.getElementById('sgoFila');
    if(!b){
      b=document.createElement('div'); b.id='sgoFila';
      b.style.cssText='position:fixed;right:14px;bottom:16px;z-index:9999;background:#0A2240;color:#fff;border-radius:22px;padding:9px 14px;font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 14px rgba(10,34,64,.35);display:none;align-items:center;gap:8px;cursor:pointer';
      b.onclick=flush;
      document.body.appendChild(b);
    }
    var n=load().length;
    if(n>0){ b.style.display='flex'; b.innerHTML='⏳ '+n+' inspeç'+(n>1?'ões':'ão')+' p/ sincronizar'; }
    else { b.style.display='none'; }
  }
  function toast(txt,cor){
    var t=document.createElement('div');
    t.style.cssText='position:fixed;left:50%;bottom:70px;transform:translateX(-50%);z-index:10000;background:'+(cor||'#0A2240')+';color:#fff;border-radius:10px;padding:10px 16px;font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:90%;text-align:center';
    t.textContent=txt; document.body.appendChild(t);
    setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(function(){t.remove();},400); }, 2600);
  }

  // Enfileira direto (sem tentar inserir) — usado quando já se sabe que está offline
  function enqueue(payload){
    var a=load(); a.push({payload:payload, ts:Date.now(), id:Date.now()+'-'+Math.random().toString(36).slice(2,7)});
    save(a); badge();
    return {ok:true, queued:true};
  }

  // Tenta inserir; se cair a rede, guarda na fila. Retorna {ok, online, queued, error}
  async function saveInspecao(payload){
    if(!_sb) return {ok:false, error:'offline não iniciado'};
    try{
      var r=await _sb.from('inspecoes').insert(payload);
      if(r.error) throw r.error;
      return {ok:true, online:true};
    }catch(e){
      if(isNetErr(e)){
        var a=load(); a.push({payload:payload, ts:Date.now(), id:Date.now()+'-'+Math.random().toString(36).slice(2,7)});
        save(a); badge();
        return {ok:true, online:false, queued:true};
      }
      return {ok:false, error:(e&&e.message)||(''+e)};
    }
  }

  var _flushing=false;
  async function flush(){
    if(_flushing || !_sb) return;
    var a=load(); if(!a.length){ badge(); return; }
    if(!navigator.onLine){ toast('Sem conexão — sincroniza quando a rede voltar','#C98A00'); return; }
    _flushing=true;
    var enviados=0, restantes=[];
    for(var i=0;i<a.length;i++){
      try{
        var r=await _sb.from('inspecoes').insert(a[i].payload);
        if(r.error) throw r.error;
        enviados++;
      }catch(e){
        if(isNetErr(e)){ restantes.push(a[i]); }   // rede caiu no meio → tenta depois
        else { pushFail(a[i]); }                    // erro real → tira da fila, guarda em falhas
      }
    }
    save(restantes); _flushing=false; badge();
    if(enviados>0) toast('✓ '+enviados+' inspeç'+(enviados>1?'ões':'ão')+' sincronizada'+(enviados>1?'s':''), '#1F7A44');
    else if(restantes.length) toast('Ainda sem conexão estável — tentaremos de novo','#C98A00');
  }

  function init(sb){
    _sb=sb;
    badge();
    window.addEventListener('online', function(){ setTimeout(flush, 800); });
    if(navigator.onLine) setTimeout(flush, 1500);
  }

  window.SGOOffline = {
    init: init,
    saveInspecao: saveInspecao,
    enqueue: enqueue,
    flush: flush,
    pending: function(){ return load().length; },
    falhas: function(){ return loadFail(); }
  };
})();
