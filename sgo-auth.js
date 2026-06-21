/* SGO-ETP · verificação de acesso via banco (senha não fica no código) */
(function(){
  var URL_="https://wcyftjpsbifyvuqzxmbs.supabase.co";
  var KEY_="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjeWZ0anBzYmlmeXZ1cXp4bWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODUyNzksImV4cCI6MjA5NTY2MTI3OX0.Dcwuq7_Y85PIrbciAj-8-YRbfmMg9QxBkR9esljqMbM";
  // Verifica o código no banco (bcrypt). Retorna true/false. Offline retorna false.
  window.sgoAcesso = async function(perfil, codigo){
    try{
      var r = await fetch(URL_+'/rest/v1/rpc/verificar_acesso', {
        method:'POST',
        headers:{ apikey:KEY_, Authorization:'Bearer '+KEY_, 'Content-Type':'application/json' },
        body: JSON.stringify({ p_perfil:perfil, p_codigo:String(codigo||'') })
      });
      if(!r.ok) return false;
      var d = await r.json();
      return d===true;
    }catch(e){ return false; }
  };
})();
