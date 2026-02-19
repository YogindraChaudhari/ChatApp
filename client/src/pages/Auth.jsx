import { useState, useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Loader2, Eye, EyeOff, MessageSquare } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('') // For Sign Up
  const [showPassword, setShowPassword] = useState(false)
  
  const location = useLocation()
  const navigate = useNavigate()
  
  // Determine mode based on URL path
  const isSignUp = location.pathname === '/sign-up'

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
            },
          },
        })
        if (error) throw error
        
        // Check if email confirmation is required
        if (data?.session) {
            toast.success('Account created successfully! You are now logged in.')
            navigate('/') // Auto login if no confirmation needed
        } else if (data?.user && !data.session) {
            toast.success('Sign up successful! Please check your email for the confirmation link.', {
                duration: 6000,
            })
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success('Welcome back!')
        navigate('/')
      }
    } catch (error) {
      console.error('Auth error:', error)
      toast.error(error.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    navigate(isSignUp ? '/sign-in' : '/sign-up')
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      
      {/* Left Side - Illustration (Hidden on mobile) */}
      <div className="hidden lg:flex flex-1 relative bg-black items-center justify-center overflow-hidden">
        {/* Background Image/Illustration */}
        <div className="absolute inset-0 z-0">

        </div>
        
        {/* Content Overlay */}
        <div className="relative z-10 p-12 max-w-lg text-center">
            <div className="mb-8 flex justify-center">
                <div className="h-20 w-20 rounded-2xl bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/30 shadow-[0_0_30px_-5px_var(--color-primary)]">
                    <MessageSquare className="h-10 w-10 text-primary" />
                </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-4 text-white">
                Connect with the Future
            </h1>
            <p className="text-lg text-muted-foreground">
                Experience real-time communication with a modern, secure, and beautiful interface designed for you.
            </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-20 overflow-hidden">
        {/* Background Image behind Form */}
        <div className="absolute inset-0 z-0">
            <img 
               src="https://plus.unsplash.com/premium_vector-1713205535423-42ed7dd0ba50?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGFic3RyYWN0JTIwYmFja2dyb3VuZCUyMGJsYWNrfGVufDB8fDB8fHww" 
               alt="Background" 
               className="h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-background/80" />
        </div>

        <div className="w-full max-w-md space-y-8 bg-card/80 backdrop-blur-md p-8 rounded-2xl border border-border shadow-2xl relative z-10 transition-all duration-300 hover:shadow-primary/10">
            <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {isSignUp ? 'Create an account' : 'Welcome back'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    {isSignUp 
                        ? 'Enter your details below to create your account' 
                        : 'Enter your email below to login to your account'}
                </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-4">
                    {isSignUp && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="username">
                                Username
                            </label>
                            <Input
                                id="username"
                                placeholder="Enter your username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
                            Email
                        </label>
                        <Input
                            id="email"
                            placeholder="m@example.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                            Password
                        </label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                required
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <Button className="w-full font-semibold" type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSignUp ? 'Sign Up' : 'Sign In'}
                </Button>
            </form>

            <div className="text-center text-sm">
                <span className="text-muted-foreground">
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                </span>
                <button 
                    onClick={toggleMode} 
                    className="font-semibold text-primary hover:underline underline-offset-4 focus:outline-none"
                >
                    {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
            </div>
        </div>
      </div>

    </div>
  )
}
