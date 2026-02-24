import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button' 
import useStore from '../../store/useStore'
import { Loader2 } from 'lucide-react'
import TIM from 'tim-js-sdk'

export default function InviteMemberModal({ isOpen, onClose }) {
    const { users, tim, user, activeRoom, addMessage } = useStore()
    const [selectedUserIds, setSelectedUserIds] = useState([])
    const [loading, setLoading] = useState(false)
    const [existingMemberIds, setExistingMemberIds] = useState([])

    // Fetch existing group members to filter them out
    useEffect(() => {
        if (isOpen && activeRoom?.type === 'GROUP' && tim) {
            const fetchMembers = async () => {
                try {
                    const res = await tim.getGroupMemberList({ groupID: activeRoom.id })
                    const memberIds = res.data.memberList.map(m => m.userID)
                    setExistingMemberIds(memberIds)
                } catch (err) {
                    console.error("Failed to fetch group members", err)
                }
            }
            fetchMembers()
        }
    }, [isOpen, activeRoom, tim])

    const handleUserToggle = (userId) => {
        setSelectedUserIds(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const handleInvite = async () => {
        if (selectedUserIds.length === 0 || !tim) return
        setLoading(true)

        try {
            // Send Invitation Messages
            const invitePromises = selectedUserIds.map(async (userId) => {
                const customData = {
                    type: 'GROUP_INVITE',
                    groupID: activeRoom.id,
                    groupName: activeRoom.username || activeRoom.name, // ChatArea uses username for group name
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
                addMessage(`C2C${userId}`, res.data.message)
            })

            await Promise.all(invitePromises)

            onClose()
            setSelectedUserIds([])
            alert(`Invites sent to ${selectedUserIds.length} user(s).`)

        } catch (error) {
            console.error("Failed to send invites:", error)
            alert("Failed to send invites: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Filter connections: show only those NOT in the group
    const availableUsers = users.filter(u => !existingMemberIds.includes(u.id))

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle>Invite Members</DialogTitle>
                    <DialogDescription>
                        Invite connections to join {activeRoom?.username}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4 overflow-y-auto pr-1">
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider ml-1">Select Connections</label>
                        <div className="border border-border rounded-xl max-h-[300px] overflow-y-auto p-2 space-y-1 bg-secondary/10">
                            {availableUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-4 text-center">
                                    {users.length === 0 ? "No connections available." : "All your connections are already in this group."}
                                </p>
                            ) : (
                                availableUsers.map(u => {
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
                                                {isSelected && <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
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
                    <Button onClick={handleInvite} disabled={loading || selectedUserIds.length === 0} className="w-full sm:w-auto font-semibold">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invites
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
