import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePlatformAccessBlocked } from './hooks/usePlatformAccessBlocked'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { ResetPassword } from './components/ResetPassword'
import { AccessBlockedScreen } from './components/AccessBlockedScreen'
import type { NavKey } from './components/PrimaryNav'
import './App.css'

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
  } = useAuth()
  const { blocked, checked } = usePlatformAccessBlocked(profile)

  // Estado de view da navegação primária (Etapa 7). View state local —
  // sem router, sem dependência nova. Só o Dashboard o consome.
  const [activeNav, setActiveNav] = useState<NavKey>('inicio')

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
      ) : session && blocked ? (
        <AccessBlockedScreen onSignOut={signOut} />
      ) : session ? (
        <Dashboard
          profile={profile}
          onSignOut={signOut}
          onUpdateProfile={updateProfile}
          onUploadAvatar={uploadAvatar}
          activeNav={activeNav}
          onNavigate={setActiveNav}
        />
      ) : (
        <Login />
      )}
    </section>
  )
}

export default App
