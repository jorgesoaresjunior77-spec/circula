-- Gestão Nutricional: registro do consentimento da paciente (LGPD).
begin;

alter table public.nutri_patients
  add column if not exists consent_at timestamptz,
  add column if not exists consent_note text check (consent_note is null or char_length(consent_note) <= 400);

commit;

-- Para desfazer:
-- alter table public.nutri_patients drop column if exists consent_at, drop column if exists consent_note;
