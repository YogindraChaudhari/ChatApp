import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabaseClient'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import useStore from '../../store/useStore'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Check, Loader2 } from 'lucide-react'

// Preset avatars from DiceBear (Avataaars style as requested)
const AVATAR_PRESETS = Array.from({ length: 100 }, (_, i) => 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=Avatar${i + 1}`
)

// Simple Label component if not exists
const SimpleLabel = ({ children, htmlFor, className }) => (
    <label htmlFor={htmlFor} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>
        {children}
    </label>
)


export default function SettingsModal({ isOpen, onClose }) {
    const { user, setUser, tim } = useStore()
    const [username, setUsername] = useState('')
    const [selectedAvatar, setSelectedAvatar] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen && user) {
            setUsername(user.user_metadata?.username || '')
            setSelectedAvatar(user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.user_metadata?.username || 'User'}`)
        }
    }, [isOpen, user])

    const handleSave = async () => {
        if (!user) return
        setLoading(true)

        try {
            // 1. Update Supabase Auth Metadata (Quick local update)
            const { data: authData, error: authError } = await supabase.auth.updateUser({
                data: { username: username, avatar_url: selectedAvatar }
            })

            if (authError) throw authError

            // 2. Update Supabase Public Users Table
            const { error: dbError } = await supabase
                .from('users')
                .update({ username: username, avatar_url: selectedAvatar })
                .eq('id', user.id)

            if (dbError) throw dbError

            // 3. Update Tencent IM Profile
            if (tim) {
                // updateProfile(options: { profile: { nick: string, avatar: string, ... } })
                await tim.updateMyProfile({
                    nick: username,
                    avatar: selectedAvatar,
                })
            }

            // Update local store
            setUser(authData.user)
            

            onClose()
        } catch (error) {
            console.error('Error updating profile:', error)
            alert('Failed to update profile: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Make changes to your profile here. Click save when you're done.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 overflow-y-auto pr-1">
                    <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-2 sm:gap-4">
                        <SimpleLabel htmlFor="username" className="sm:text-right">
                            Username
                        </SimpleLabel>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="sm:col-span-3"
                        />
                    </div>
                    
                    <div className="space-y-3">
                        <SimpleLabel className="text-left block">
                            Profile Picture
                        </SimpleLabel>
                        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 gap-3 sm:gap-4 max-h-[250px] sm:max-h-[300px] overflow-y-auto p-3 border rounded-xl bg-secondary/5">
                            {AVATAR_PRESETS.map((avatar, index) => {
                                const isSelected = selectedAvatar === avatar
                                return (
                                    <div 
                                        key={index}
                                        className={`relative cursor-pointer rounded-full transition-all duration-200 aspect-square flex items-center justify-center border-2
                                            ${isSelected 
                                                ? 'border-primary ring-2 ring-primary/20 scale-105 bg-primary/5' 
                                                : 'border-transparent hover:border-border hover:bg-muted/30 opacity-80 hover:opacity-100'
                                            }`}
                                        onClick={() => setSelectedAvatar(avatar)}
                                    >
                                        <img 
                                            src={avatar} 
                                            alt={`Avatar ${index}`} 
                                            className="h-full w-full rounded-full bg-muted/20 object-cover"
                                            loading="lazy"
                                        />
                                        {isSelected && (
                                            <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background shadow-md">
                                                <Check className="h-2.5 w-2.5" />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" variant="secondary" onClick={handleSave} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
