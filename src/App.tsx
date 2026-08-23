import { useAuth } from './hooks/useAuth'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { ResetPassword } from './components/ResetPassword'
import './App.css'

function App() {
  const { session, profile, initializing, recoveryMode, signOut, updateProfile, uploadAvatar } =
    useAuth()

  if (initializing) {
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
