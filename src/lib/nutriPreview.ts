// A área Nutri da paciente está em teste: só as contas abaixo (Elisa, conta de
// teste) veem o conteúdo. As demais pacientes vinculadas veem "Em breve".
// Para liberar para todas, esvazie a lista e troque canSeePatientNutri por `true`.
export const NUTRI_PREVIEW_PROFILE_IDS: readonly string[] = ['51008487-ee5e-4a15-86c9-d10a05596b08']

export function canSeePatientNutri(profileId: string | null | undefined): boolean {
  return !!profileId && NUTRI_PREVIEW_PROFILE_IDS.includes(profileId)
}
