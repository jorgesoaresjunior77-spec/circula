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
  const { session, profile, initializing, recoveryMode, signOut, updateProfile, uploadAvatar } =
    useAuth()
  const { blocked, checked } = usePlatformAccessBlocked(profile)

  // Estado de view da navegação primária (Etapa 7). View state local —
  // sem router, sem dependência nova. Só o Dashboard o consome.
  const [activeNav, setActiveNav] = useState<NavKey>('inicio')

  if (initializing || (session && !recoveryMode && !checked)) {
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
