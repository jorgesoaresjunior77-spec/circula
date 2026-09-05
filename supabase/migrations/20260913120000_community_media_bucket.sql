-- =====================================================================
-- FASE 12.5A — Storage privado: infraestrutura do bucket community-media
-- =====================================================================
-- Contexto: a auditoria da 12.5 confirmou que TODO upload de imagem do
-- app (avatar, capa de comunidade/desafio/círculo/conteúdo/evento/
-- receita/momento de alegria, e imagem de post) usa o mesmo bucket
-- `avatars`, que é público (`public=true`) e tem uma policy de SELECT
-- sem nenhuma condição além do bucket. Testado de forma real e
-- read-only: um pedido HTTP anônimo (sem sessão) consegue baixar
-- qualquer arquivo E listar todas as pastas/arquivos de qualquer
-- usuária — inclusive imagens de posts e capas de comunidades pagas ou
-- não-discoverable, que a RLS das tabelas (12.1-12.4c) já protege, mas
-- cujo Storage nunca foi auditado até agora.
--
-- Esta migration cria SÓ a infraestrutura do bucket novo — nenhum
-- arquivo existente é tocado, nenhuma coluna de tabela é alterada,
-- nenhum código de frontend muda ainda. `avatars` continua exatamente
-- como está (público, sem policy nova, sem arquivo movido).
--
-- COMO O STORAGE IDENTIFICA O OBJETO — `storage.objects` tem
-- `(bucket_id, name)` como chave; `name` é o caminho completo dentro do
-- bucket (não há coluna separada de "pasta"). RLS em `storage.objects`
-- não tem acesso direto a nenhuma FK de negócio — só ao próprio
-- `name`/`bucket_id`/`owner`. `storage.foldername(name)` quebra o
-- caminho em array de segmentos (tudo exceto o nome do arquivo final).
--
-- QUAL TABELA TEM A RELAÇÃO ARQUIVO <-> COMUNIDADE — nenhuma. Hoje
-- `posts.image_url` e `communities.cover_image_url` (e os
-- `cover_image_url` de challenges/circles/content/events/recipes)
-- guardam a URL PÚBLICA completa já resolvida (`getPublicUrl`), uma
-- string opaca — não guardam bucket/path separado, e não há coluna
-- alguma ligando um objeto do Storage a um `community_id`. Por isso
-- decidi NÃO tentar extrair `community_id` fazendo parsing da URL
-- pública antiga (frágil, e essas linhas nem serão tocadas nesta
-- etapa) — em vez disso, a estrutura de PATH do bucket NOVO já nasce
-- com o `community_id` como primeiro segmento, de forma que a policy
-- do Storage lê o `community_id` diretamente do próprio nome do
-- objeto, sem depender de nenhuma tabela de mapeamento nem de parsing
-- de URL.
--
-- ESTRUTURA DE PATH PROPOSTA (só usada quando o frontend passar a
-- fazer upload aqui, na 12.5B — nenhum upload muda nesta migration):
--   <community_id>/posts/<uploader_uid>/<timestamp>.<ext>
--   <community_id>/covers/<uploader_uid>/<timestamp>.<ext>
--
--   - segmento 1 = community_id (uuid) -> é o que a policy usa para
--     decidir se quem pede tem relação com aquela comunidade
--     (owns_community/is_community_member — as MESMAS funções já
--     testadas e usadas em toda a RLS de tabela da 12.1-12.4c, sem
--     inventar uma regra de autorização paralela);
--   - segmento 2 = 'posts' ou 'covers' -> só organização/depuração, a
--     policy não depende disso para autorizar;
--   - segmento 3 = uploader_uid -> usado só para a policy de
--     INSERT/UPDATE/DELETE saber "isto foi enviado por quem está
--     pedindo", igual ao padrão já usado no bucket avatars
--     (foldername[1] = auth.uid()), só que um nível mais fundo porque
--     aqui o primeiro nível é a comunidade, não a usuária.
--
-- Um helper (`community_media_community_id`) extrai e valida esse
-- primeiro segmento com segurança (regex de formato UUID antes do
-- cast) — um path malformado nunca dá erro de policy, só nega acesso
-- (retorna NULL, e owns_community(null)/is_community_member(null) já
-- são `false` por semântica de SQL, sem precisar de tratamento extra).
--
-- AUTORIZAÇÃO — a policy usa DIRETAMENTE owns_community()/
-- is_community_member() (1 argumento, sem checagem de billing embutida
-- na própria função — o paywall já está garantido pela sincronização
-- da 12.2, que só mexe em community_members.status; usar a mesma
-- convenção das outras 100+ policies do projeto, não uma regra nova).
-- Nenhum ramo is_master() foi adicionado — consistente com a decisão
-- das Fases 12.4/12.4b/12.4c de que Master não deve ter acesso
-- individual a conteúdo de comunidade.
--
-- NÃO FEITO NESTA MIGRATION (fica para 12.5B/12.5C):
--   • Nenhum arquivo existente é copiado/movido/apagado.
--   • Nenhuma coluna (`posts.image_url`, `*.cover_image_url`) é
--     alterada.
--   • Nenhum código de frontend muda — `uploadImage.ts`,
--     `useAuth.uploadAvatar`, `usePosts.uploadPostImage` continuam
--     escrevendo em `avatars` exatamente como hoje.
--   • Nenhuma signed URL é gerada em lugar nenhum ainda.
--
-- Aditivo (cria 1 bucket + 1 função + 1 policy de storage.buckets + 4
-- policies de storage.objects; não altera nenhum objeto existente do
-- bucket `avatars`). Reversível (rodapé). Transacional.
-- =====================================================================

begin;

-- ---- 1) bucket novo, privado --------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  5242880, -- 5 MB, mesmo limite já aplicado no cliente para uploads de capa/post
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- `storage.buckets` também tem RLS própria (achado da validação
-- transacional: a policy existente só deixa ver o bucket 'avatars' —
-- sem uma policy equivalente para o bucket novo, ninguém enxergaria
-- nem os METADADOS dele, embora os arquivos dentro já estivessem
-- corretamente protegidos pela policy de storage.objects). Mesma
-- forma da policy já existente para 'avatars' — só visibilidade do
-- registro do bucket (nome/flag public/limites), não do conteúdo.
drop policy if exists "community-media bucket is visible to authenticated" on storage.buckets;
create policy "community-media bucket is visible to authenticated"
  on storage.buckets for select to public
  using (id = 'community-media');

-- ---- 2) helper: extrai o community_id do path com segurança --------
create or replace function public.community_media_community_id(object_name text)
returns uuid
language sql
immutable
as $function$
  select case
    when (storage.foldername(object_name))[1]
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
    else null
  end;
$function$;

comment on function public.community_media_community_id(text) is
  'Fase 12.5A: extrai o community_id (1o segmento do path) de um objeto do bucket community-media. Retorna NULL com segurança se o path não tiver formato de UUID válido — nunca lança erro.';

-- ---- 3) policies em storage.objects, restritas a bucket_id='community-media'
-- (as 4 policies do bucket "avatars" continuam intocadas)

drop policy if exists "community media is readable by community members" on storage.objects;
create policy "community media is readable by community members"
  on storage.objects for select to public
  using (
    bucket_id = 'community-media'
    and (
      public.owns_community(public.community_media_community_id(name))
      or public.is_community_member(public.community_media_community_id(name))
    )
  );

drop policy if exists "community members can upload community media" on storage.objects;
create policy "community members can upload community media"
  on storage.objects for insert to public
  with check (
    bucket_id = 'community-media'
    and (storage.foldername(name))[2] in ('posts', 'covers')
    and (storage.foldername(name))[3] = (auth.uid())::text
    and (
      public.owns_community(public.community_media_community_id(name))
      or public.is_community_member(public.community_media_community_id(name))
    )
  );

-- UPDATE/DELETE: a dona sempre pode; o próprio uploader só pode
-- enquanto CONTINUAR sendo membro ativo da comunidade (revisão pedida
-- depois da primeira validação) — se a membership virar pending/
-- blocked, ou for removida (rejeição da 12.3 deleta a linha), o
-- uploader perde esse poder mesmo sobre o próprio arquivo. A dona
-- nunca depende de is_community_member (owns_community já é a
-- condição completa e correta para ela).
drop policy if exists "uploader or owner can update community media" on storage.objects;
create policy "uploader or owner can update community media"
  on storage.objects for update to public
  using (
    bucket_id = 'community-media'
    and (
      public.owns_community(public.community_media_community_id(name))
      or (
        (storage.foldername(name))[3] = (auth.uid())::text
        and public.is_community_member(public.community_media_community_id(name))
      )
    )
  );

drop policy if exists "uploader or owner can delete community media" on storage.objects;
create policy "uploader or owner can delete community media"
  on storage.objects for delete to public
  using (
    bucket_id = 'community-media'
    and (
      public.owns_community(public.community_media_community_id(name))
      or (
        (storage.foldername(name))[3] = (auth.uid())::text
        and public.is_community_member(public.community_media_community_id(name))
      )
    )
  );

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop policy if exists "uploader or owner can delete community media" on storage.objects;
-- drop policy if exists "uploader or owner can update community media" on storage.objects;
-- drop policy if exists "community members can upload community media" on storage.objects;
-- drop policy if exists "community media is readable by community members" on storage.objects;
-- drop policy if exists "community-media bucket is visible to authenticated" on storage.buckets;
-- drop function if exists public.community_media_community_id(text);
-- delete from storage.buckets where id = 'community-media';
-- commit;
--
-- (o DELETE do bucket só funciona enquanto nenhum objeto real tiver
--  sido enviado para ele — Storage não deixa apagar bucket não-vazio.)
-- =====================================================================
