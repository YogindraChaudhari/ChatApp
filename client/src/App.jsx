import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './services/supabaseClient'
import useStore from './store/useStore'
import Auth from './pages/Auth'
import Home from './pages/Home'
import ErrorBoundary from './components/ErrorBoundary'

import { Toaster } from 'react-hot-toast'

function App() {
  const { user, setUser } = useStore()

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Toaster 
            position="top-right"
            toastOptions={{
                className: 'bg-card text-foreground border border-border',
                style: {
                    background: '#16181A',
                    color: '#fff',
                    border: '1px solid #27272a'
                },
                success: {
                    iconTheme: {
                        primary: '#CBF382',
                        secondary: '#0B0C0E',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                    },
                },
            }}
        />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={user ? <Home /> : <Navigate to="/sign-in" />} />
            <Route path="/auth" element={<Navigate to="/sign-in" replace />} />
            <Route path="/sign-in" element={!user ? <Auth /> : <Navigate to="/" />} />
            <Route path="/sign-up" element={!user ? <Auth /> : <Navigate to="/" />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  )
}

export default App
