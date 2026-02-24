import { useState, useEffect } from 'react'
import { WifiOff, X } from 'lucide-react'

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(!window.navigator.onLine)
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        const handleOnline = () => setIsOffline(false)
        const handleOffline = () => {
            setIsOffline(true)
            setIsVisible(true)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    if (!isOffline || !isVisible) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
            <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3 mx-auto">
                    <WifiOff className="h-4 w-4 animate-pulse" />
                    <p className="text-sm font-medium">
                        You are currently offline. Some features may be unavailable.
                    </p>
                </div>
                <button 
                    onClick={() => setIsVisible(false)}
                    className="shrink-0 hover:bg-black/10 p-1 rounded-full transition-colors"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
