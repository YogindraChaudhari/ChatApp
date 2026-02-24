import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Loader2, Trash2, LogOut, X, Shield, ShieldAlert } from 'lucide-react'
import { 
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../ui/alert-dialog"
import useStore from '../../store/useStore'
import TIM from 'tim-js-sdk'

export default function GroupInfoPanel() {
    const { tim, user, activeRoom, setActiveRoom, users, isGroupInfoOpen, setGroupInfoOpen } = useStore()
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(false)
    const [myRole, setMyRole] = useState(null)
    
    // Confirmation Dialog States
    const [memberToRemove, setMemberToRemove] = useState(null)
    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false)
    const [isDismissConfirmOpen, setIsDismissConfirmOpen] = useState(false)

    useEffect(() => {
        if (isGroupInfoOpen && activeRoom?.type === 'GROUP' && tim) {
            fetchMembers()
        }
    }, [isGroupInfoOpen, activeRoom, tim])

    const fetchMembers = async () => {
        try {
            const res = await tim.getGroupMemberList({ groupID: activeRoom.id })
            setMembers(res.data.memberList)
            const me = res.data.memberList.find(m => m.userID === user.id)
            if (me) setMyRole(me.role)
        } catch (err) {
            console.error("Failed to fetch group members", err)
        }
    }

    const getDisplayName = (member) => {
        if (member.userID === user.id) return user.user_metadata?.username || user.username || "You"
        const connection = users.find(u => u.id === member.userID)
        if (connection?.username) return connection.username
        if (member.nick && member.nick !== member.userID) return member.nick
        return member.userID
    }

    const confirmRemoveMember = async () => {
        if (!memberToRemove) return
        setLoading(true)
        try {
            await tim.deleteGroupMember({
                groupID: activeRoom.id,
                userIDList: [memberToRemove.userID]
            })
            setMembers(prev => prev.filter(m => m.userID !== memberToRemove.userID))
        } catch (err) {
            console.error("Failed to remove member", err)
            alert("Failed to remove member: " + err.message)
        } finally {
            setLoading(false)
            setMemberToRemove(null)
        }
    }

    const confirmLeaveGroup = async () => {
        setLoading(true)
        try {
            await tim.quitGroup(activeRoom.id)
            setActiveRoom(null)
            setGroupInfoOpen(false)
        } catch (err) {
            console.error("Failed to leave group", err)
            alert("Failed to leave group: " + err.message)
        } finally {
            setLoading(false)
            setIsLeaveConfirmOpen(false)
        }
    }

    const confirmDismissGroup = async () => {
        setLoading(true)
        try {
            await tim.dismissGroup(activeRoom.id)
            setActiveRoom(null)
            setGroupInfoOpen(false)
        } catch (err) {
            console.error("Failed to dismiss group", err)
            alert("Failed to dismiss group: " + err.message)
        } finally {
            setLoading(false)
            setIsDismissConfirmOpen(false)
        }
    }

    if (!isGroupInfoOpen || !activeRoom || activeRoom.type !== 'GROUP') return null

    const isOwner = myRole === TIM.TYPES.GRP_MBR_ROLE_OWNER
    const isAdmin = myRole === TIM.TYPES.GRP_MBR_ROLE_ADMIN || isOwner

    return (
        <div className="w-full md:w-80 h-full border-l border-border bg-card flex flex-col shadow-xl md:shadow-none animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
                <h2 className="font-semibold text-lg">{activeRoom.username}</h2>
                <Button variant="ghost" size="icon" onClick={() => setGroupInfoOpen(false)}>
                    <X className="h-5 w-5" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Members</h3>
                    <div className="space-y-2">
                        {members.map(member => (
                            <div key={member.userID} className="flex items-center justify-between p-3 rounded-2xl bg-secondary hover:bg-secondary/80 transition-colors group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                     <div className="relative shrink-0 h-10 w-10 rounded-full overflow-hidden bg-background border border-border">
                                          <img 
                                             src={member.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(member)}`} 
                                             alt={member.userID}
                                             className="h-full w-full object-cover"
                                          />

                                     </div>
                                     <div className="min-w-0 flex flex-col">
                                         <span className="truncate font-medium text-sm text-foreground" title={member.userID}>
                                             {getDisplayName(member)}
                                             {member.userID === user.id && " (You)"}
                                         </span>
                                         <div className="flex items-center gap-1">
                                             {member.role === TIM.TYPES.GRP_MBR_ROLE_OWNER && (
                                                <span className="text-[10px] text-primary">Owner</span>
                                             )}
                                             {member.role === TIM.TYPES.GRP_MBR_ROLE_ADMIN && (
                                                <span className="text-[10px] text-blue-400">Admin</span>
                                             )}
                                         </div>
                                     </div>
                                </div>
                                
                                {member.userID !== user.id && isAdmin && member.role !== TIM.TYPES.GRP_MBR_ROLE_OWNER && (
                                      <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => setMemberToRemove(member)}
                                          title="Remove Member"
                                      >
                                          <X className="h-4 w-4" />
                                      </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-border">
                     {!isOwner && (
                         <Button variant="destructive" className="w-full rounded-full" onClick={() => setIsLeaveConfirmOpen(true)} disabled={loading}>
                             {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             <LogOut className="mr-2 h-4 w-4" />
                             Leave Group
                         </Button>
                     )}
                     {isOwner && (
                         <Button variant="destructive" className="w-full rounded-full" onClick={() => setIsDismissConfirmOpen(true)} disabled={loading}>
                             {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             <Trash2 className="mr-2 h-4 w-4" />
                             Delete Group
                         </Button>
                     )}
                </div>
            </div>

            {/* Remove Member Dialog */}
            <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove <strong>{memberToRemove ? getDisplayName(memberToRemove) : ''}</strong> from the group?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Leave Group Dialog */}
            <AlertDialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave Group?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to leave this group?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmLeaveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Dismiss Group Dialog */}
            <AlertDialog open={isDismissConfirmOpen} onOpenChange={setIsDismissConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this group? This action cannot be undone and will remove the group for all members.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDismissGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Group
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
