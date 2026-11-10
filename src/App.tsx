import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePlatformAccessBlocked } from './hooks/usePlatformAccessBlocked'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { ResetPassword } from './components/ResetPassword'
import { AccessBlockedScreen } from './components/AccessBlockedScreen'
import { MemberSignup } from './components/MemberSignup'
import { captureInviteTokenFromUrl } from './lib/inviteToken'
import { useJoinInvite } from './hooks/useJoinInvite'
import type { NavKey } from './components/PrimaryNav'
import './App.css'
import './invite-install.css'
import './home-calendar.css'
import './wellness.css'
import './magazine-reader.css'
import './polish.css'
import './recipes.css'
import './panel.css'

function App() {
  const {
    session,
    profile,
    initializing,
    recoveryMode,
    mustSetPassword,
    inviteError,
    clearInviteState,
    signOut,
    updateProfile,
    uploadAvatar,
    uploadBanner,
    uploadGalleryPhoto,
  } = useAuth()
  const { blocked, checked } = usePlatformAccessBlocked(profile)

  // Estado de view da navegação primária (Etapa 7). View state local —
  // sem router, sem dependência nova. Só o Dashboard o consome.
  const [activeNav, setActiveNav] = useState<NavKey>('inicio')

  // Convite da comunidade por link (WhatsApp): `?convite=<token>`. Sem
  // sessão mostra o cadastro de participante; com sessão entra na
  // comunidade antes de abrir o Dashboard.
  const [inviteToken, setInviteToken] = useState<string | null>(() => captureInviteTokenFromUrl())
  const [wantsLogin, setWantsLogin] = useState(false)
  const joinInvite = useJoinInvite(session?.user.id ?? null, inviteToken, () => setInviteToken(null))

  // Fase 14.2 — no primeiro acesso via convite não esperamos o check de
  // billing da plataforma: a nova Member vai direto para "Defina sua senha".
  if (initializing || (session && !recoveryMode && !mustSetPassword && !checked)) {
    return (
      <section id="center">
        <p>Carregando...</p>
      </section>
    )
  }

  return (
    <section id="center">
      {recoveryMode ? (
        <ResetPassword />
      ) : inviteError ? (
        <ResetPassword mode="invite" invalid onDone={clearInviteState} />
      ) : mustSetPassword && session ? (
        <ResetPassword mode="invite" onDone={clearInviteState} />
      ) : session && inviteToken && joinInvite.state.status === 'error' ? (
        <section className="auth-card">
          <p className="auth-error" role="alert">
            {joinInvite.state.message}
          </p>
          <button type="button" onClick={joinInvite.retry}>
            Tentar de novo
          </button>
          <button type="button" className="auth-link" onClick={joinInvite.dismiss}>
            Continuar sem entrar
          </button>
        </section>
      ) : session && inviteToken ? (
        <p>Entrando na comunidade...</p>
      ) : session && blocked ? (
        <AccessBlockedScreen onSignOut={signOut} />
      ) : session ? (
        <Dashboard
          profile={profile}
          onSignOut={signOut}
          onUpdateProfile={updateProfile}
          onUploadAvatar={uploadAvatar}
          onUploadBanner={uploadBanner}
          onUploadGalleryPhoto={uploadGalleryPhoto}
          activeNav={activeNav}
          onNavigate={setActiveNav}
        />
      ) : inviteToken && !wantsLogin ? (
        <MemberSignup token={inviteToken} onHaveAccount={() => setWantsLogin(true)} />
      ) : (
        <Login />
      )}
    </section>
  )
}

export default App
