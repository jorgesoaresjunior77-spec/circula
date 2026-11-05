-- Perfil: banner (imagem larga atras da foto). Coluna aditiva em profiles,
-- sob as mesmas policies/trigger de sempre. Bucket `avatars` ja cobre
-- qualquer caminho <uid>/... Reversivel:
--   alter table public.profiles drop column if exists banner_url;
alter table public.profiles add column if not exists banner_url text;
