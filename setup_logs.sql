-- ============================================================
-- SGO-ETP · Tabela de Logs (observabilidade)
-- Cole isto no Supabase > SQL Editor > Run
-- Cobre as regras: #2 stack trace, #3 log JSON estruturado,
-- #5 query logging com tempo, #1 correlation id
-- ============================================================

create table if not exists public.logs (
  id             bigint generated always as identity primary key,
  ts             timestamptz  not null default now(),
  nivel          text         not null default 'info',  -- info | warn | error
  evento         text,                                   -- nome curto do evento
  correlation_id text,                                   -- rastreia uma sessão/fluxo
  pagina         text,                                   -- de onde veio (location.pathname)
  duracao_ms     numeric,                                -- tempo da query/operação (#5)
  dados          jsonb,                                  -- payload estruturado (#3)
  stack          text,                                   -- stack trace completo (#2)
  user_agent     text
);

-- Índices para consulta rápida no painel/saude.html
create index if not exists idx_logs_ts    on public.logs (ts desc);
create index if not exists idx_logs_nivel on public.logs (nivel);

-- Permissões para a chave anon (mesma lógica das suas outras tabelas no piloto).
-- OBS: como o RLS está desativado, esta tabela fica gravável por qualquer um
-- que tenha a anon key. Aceitável no piloto; revisar junto com o RLS na próxima fase.
grant insert, select on table public.logs to anon, authenticated;

-- (opcional) limpeza automática: apaga logs com mais de 30 dias.
-- Rode manualmente de vez em quando, ou agende depois com pg_cron.
-- delete from public.logs where ts < now() - interval '30 days';
