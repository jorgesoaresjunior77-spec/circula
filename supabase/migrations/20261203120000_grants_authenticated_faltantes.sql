-- =====================================================================
-- Permissões que faltavam para o papel "authenticated".
--
-- Tabelas criadas por migration não recebem GRANT automático. As políticas
-- (RLS) já existiam e já limitam cada pessoa ao que é dela, mas sem o GRANT
-- o banco recusava a operação ("permission denied"):
--   · posts / post_comments: a membro não conseguia apagar nem editar o
--     PRÓPRIO comentário ou post (policies *_delete_own / *_update_own);
--   · nutri_body_entries / nutri_progress_photos: a paciente não conseguia
--     ver, registrar ou apagar as próprias medidas e fotos;
--   · nutri_patient_updates / nutri_exemptions / nutri_link_requests: a
--     paciente não conseguia ler as orientações, a isenção e o pedido de vínculo;
--   · blocked_terms / moderation_log / product_price_overrides: leitura.
-- Só permissões; nenhum dado muda e a RLS continua valendo. Reversível.
-- =====================================================================

begin;

grant update, delete on table public.posts to authenticated;
grant update, delete on table public.post_comments to authenticated;

grant select, insert, delete on table public.nutri_body_entries to authenticated;
grant select, insert, delete on table public.nutri_progress_photos to authenticated;
grant select on table public.nutri_patient_updates to authenticated;
grant select on table public.nutri_exemptions to authenticated;
grant select on table public.nutri_link_requests to authenticated;

grant select on table public.blocked_terms to authenticated;
grant select on table public.moderation_log to authenticated;
grant select on table public.product_price_overrides to authenticated;

commit;

-- ROLLBACK:
--   revoke update, delete on table public.posts from authenticated;
--   revoke update, delete on table public.post_comments from authenticated;
--   revoke select, insert, delete on table public.nutri_body_entries from authenticated;
--   revoke select, insert, delete on table public.nutri_progress_photos from authenticated;
--   revoke select on table public.nutri_patient_updates, public.nutri_exemptions, public.nutri_link_requests,
--     public.blocked_terms, public.moderation_log, public.product_price_overrides from authenticated;
