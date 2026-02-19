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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Invite Members</DialogTitle>
                    <DialogDescription>
                        Invite connections to join {activeRoom?.username}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <div className="border rounded-md max-h-[300px] overflow-y-auto p-2 space-y-1">
                            {availableUsers.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-2">
                                    {users.length === 0 ? "No connections." : "All connections are already members."}
                                </p>
                            ) : (
                                availableUsers.map(u => (
                                    <div key={u.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded">
                                        <input 
                                            type="checkbox"
                                            id={`invite-user-${u.id}`}
                                            checked={selectedUserIds.includes(u.id)}
                                            onChange={() => handleUserToggle(u.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <label htmlFor={`invite-user-${u.id}`} className="text-sm cursor-pointer flex-1 select-none">
                                            {u.username}
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground text-right">
                            {selectedUserIds.length} selected
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleInvite} disabled={loading || selectedUserIds.length === 0}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Send Invites
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
