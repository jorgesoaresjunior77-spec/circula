import { useAuth } from './hooks/useAuth'
import { usePlatformAccessBlocked } from './hooks/usePlatformAccessBlocked'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { ResetPassword } from './components/ResetPassword'
import { AccessBlockedScreen } from './components/AccessBlockedScreen'
import './App.css'

function App() {
  const { session, profile, initializing, recoveryMode, signOut, updateProfile, uploadAvatar } =
    useAuth()
  const { blocked, checked } = usePlatformAccessBlocked(profile)

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
        />
      ) : (
        <Login />
      )}
    </section>
  )
}

export default App
