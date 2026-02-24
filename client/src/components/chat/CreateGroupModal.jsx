import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import useStore from '../../store/useStore'
import { Loader2, Users, Check } from 'lucide-react'
import TIM from 'tim-js-sdk'

export default function CreateGroupModal({ isOpen, onClose }) {
    const { users, tim, user, addMessage } = useStore()
    const [groupName, setGroupName] = useState('')
    const [selectedUserIds, setSelectedUserIds] = useState([])
    const [loading, setLoading] = useState(false)

    const handleUserToggle = (userId) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const handleCreate = async () => {
        if (!groupName.trim() || !tim) return
        setLoading(true)

        try {
            // 1. Create Public Group (so invites work easily via Join)
            const createRes = await tim.createGroup({
                type: TIM.TYPES.GRP_PUBLIC,
                name: groupName,
                joinOption: TIM.TYPES.JOIN_OPTIONS_FREE_ACCESS, // We rely on secret ID for privacy
                memberList: []
            })
            
            const groupID = createRes.data.group.groupID
            
            // 2. Send Invitation Messages to Selected Users
            // 2. Send Invitation Messages to Selected Users
            const invitePromises = selectedUserIds.map(async (userId) => {
                const customData = {
                    type: 'GROUP_INVITE',
                    groupID: groupID,
                    groupName: groupName,
                    inviterName: user?.user_metadata?.username || 'Admin'
                }

                const message = tim.createCustomMessage({
                    to: String(userId),
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        data: JSON.stringify(customData),
                        description: 'Group Invitation',
                        extension: ''
                    },
                    needReadReceipt: true
                })
                
                const res = await tim.sendMessage(message)
                // Add to local store so we see the sent invite
                // Add to local store so we see the sent invite
                addMessage(`C2C${userId}`, res.data.message)
            })

            await Promise.all(invitePromises)

            // Close and Reset
            onClose()
            setGroupName('')
            setSelectedUserIds([])
            alert(`Group "${groupName}" created! Invites sent.`)

        } catch (error) {
            console.error("Failed to create group:", error)
            alert("Failed to create group: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle>Create New Group</DialogTitle>
                    <DialogDescription>
                        Create a private group and invite your connections.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-5 py-4 overflow-y-auto pr-1">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Group Name</label>
                        <Input 
                            id="name" 
                            value={groupName} 
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="e.g. Project Alpha"
                            className="bg-secondary/20 border-border"
                        />
                    </div>
                    
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Select Members</label>
                        <div className="border border-border rounded-xl max-h-[250px] sm:max-h-[300px] overflow-y-auto p-2 space-y-1 bg-secondary/10">
                            {users.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-4 text-center">No connections available.</p>
                            ) : (
                                users.map(u => {
                                    const isSelected = selectedUserIds.includes(u.id)
                                    return (
                                        <div 
                                            key={u.id} 
                                            onClick={() => handleUserToggle(u.id)}
                                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border group ${
                                                isSelected 
                                                    ? 'bg-secondary border-primary/50 shadow-sm' 
                                                    : 'hover:bg-muted/50 border-transparent'
                                            }`}
                                        >
                                            <div className={`shrink-0 h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                                                isSelected 
                                                    ? 'bg-primary border-primary text-primary-foreground' 
                                                    : 'border-muted-foreground/30 bg-transparent'
                                            }`}>
                                                {isSelected && <Check className="h-3.5 w-3.5" />}
                                            </div>
                                            
                                            <div className="relative h-10 w-10 rounded-full overflow-hidden bg-muted border border-border">
                                                <img 
                                                    src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`} 
                                                    alt={u.username}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                                    {u.username}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground text-right">
                            {selectedUserIds.length} selected
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={loading} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={handleCreate} disabled={loading || !groupName.trim()} className="w-full sm:w-auto font-semibold">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create & Invite
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
