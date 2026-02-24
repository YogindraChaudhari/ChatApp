import { useEffect, useState, useCallback } from 'react'
import TIM from 'tim-js-sdk'
import { supabase } from '../../services/supabaseClient'
import useStore from '../../store/useStore'
import { Button } from '../ui/button'
import { Plus, UserPlus, LogOut, Check, X, Settings, Users } from 'lucide-react'
import RequestModal from './RequestModal'
import SettingsModal from './SettingsModal'
import CreateGroupModal from './CreateGroupModal'
import { cn } from '../../lib/utils'

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

export default function Sidebar() {
  const { user, setUser, users, setUsers, activeRoom, setActiveRoom, requests, setRequests, conversationList } = useStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  
  // Helper to get unread count
  const getUnreadCount = (friendId) => {
      const conv = conversationList && conversationList.find(c => c.conversationID === `C2C${friendId}`)
      return conv ? conv.unreadCount : 0
  }
  
  const fetchConnections = useCallback(async () => {
    if (!user) return

    // Fetch Connections (Friends) and Requests
    const fetchConnectionsList = async () => {
      // Fetch accepted connections
      const { data: acceptedData, error: acceptedError } = await supabase
        .from('connections')
        .select(`
          *,
          sender:users!connections_sender_id_fkey(*),
          receiver:users!connections_receiver_id_fkey(*)
        `)
        .eq('status', 'accepted')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)

      if (!acceptedError && acceptedData) {
        // Transform to friend object (the other user)
        const friends = acceptedData.map(conn => {
            const friend = conn.sender_id === user.id ? conn.receiver : conn.sender
            return { ...friend, connectionId: conn.id }
        })
        
        // Remove duplicates based on user ID
        const uniqueFriends = friends.filter((friend, index, self) => 
            index === self.findIndex((t) => (
                t.id === friend.id
            ))
        )
        
        setUsers(uniqueFriends)

        // Auto-close chat if active connection was removed
        // We need to access the latest activeRoom. 
        // Since this function is inside useCallback, relying on closure 'activeRoom' might be stale.
        // We can use a ref or access via store if possible, 
        // but Sidebar consumes useStore.
        
        const currentActiveRoom = useStore.getState().activeRoom
        if (currentActiveRoom) {
             const stillConnected = friends.find(f => f.id === currentActiveRoom.id)
             if (!stillConnected) {
                 setActiveRoom(null)
             }
        }
      }

      // Fetch pending requests (received only)
      const { data: requestData, error: requestError } = await supabase
        .from('connections')
        .select(`
          *,
          sender:users!connections_sender_id_fkey(*)
        `)
        .eq('status', 'pending')
        .eq('receiver_id', user.id)
      
      if (!requestError && requestData) {
          setRequests(requestData)
      }
    }
    
    fetchConnectionsList()
  }, [user, setUsers, setRequests])

  useEffect(() => {
    if (!user) return

    fetchConnections()

    // Realtime subscription for connections
    // Use unique channel per user to prevent conflicts
    const channel = supabase
      .channel(`user_connections_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, (payload) => {
        console.log("Connection update:", payload)
        fetchConnections() // Refresh on change
      })
      .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
  }, [user, fetchConnections])

  const handleLogoutClick = () => {
      setIsLogoutDialogOpen(true)
  }

  const confirmLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsLogoutDialogOpen(false)
  }

  const acceptRequest = async (id) => {
      // Optimistic update
      const requestDetails = requests.find(r => r.id === id)
      
      try {
          // Update in DB
          const { error } = await supabase.from('connections').update({ status: 'accepted' }).eq('id', id)
          if (error) throw error

          // Update local state
          if (requestDetails) {
              const newFriend = { ...requestDetails.sender, connectionId: id }
              setUsers([...users, newFriend])
              setRequests(requests.filter(r => r.id !== id))
          }
      } catch (error) {
          console.error("Failed to accept request:", error)
          // Revert or fetch if needed, but for now simple alert
          alert("Failed to accept request")
      }
  }

  const rejectRequest = async (id) => {
      try {
           const { error } = await supabase.from('connections').delete().eq('id', id)
           if (error) throw error
           
           setRequests(requests.filter(r => r.id !== id))
      } catch (error) {
           console.error("Failed to reject request:", error)
           alert("Failed to reject request")
      }
  }

  return (
    <div className="flex h-full w-full flex-col bg-card">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <h1 className="text-xl font-bold text-primary">NexusChat</h1>
        <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsCreateGroupOpen(true)} title="Create Group">
                <Users className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)} title="Add Friend">
                <UserPlus className="h-5 w-5" />
            </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Groups List */}
        {conversationList && conversationList.filter(c => c.type === 'GROUP').length > 0 && (
            <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Groups</h3>
                <div className="space-y-1">
                    {conversationList.filter(c => c.type === 'GROUP').map(conv => {
                        const group = conv.groupProfile
                        if (!group) return null // Should not happen for type GROUP
                        
                        return (
                            <button
                                key={group.groupID}
                                onClick={() => setActiveRoom({
                                    id: group.groupID,
                                    username: group.name,
                                    avatar_url: group.faceURL || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`,
                                    type: 'GROUP',
                                    isGroup: true
                                })}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
                                    activeRoom?.id === group.groupID && "bg-accent"
                                )}
                            >
                                <div className="relative">
                                    <img
                                        src={group.faceURL || `https://api.dicebear.com/7.x/initials/svg?seed=${group.name}`}
                                        alt={group.name}
                                        className="h-10 w-10 rounded-full bg-background object-cover border border-border"
                                    />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                     <div className="flex justify-between items-center">
                                         <p className="truncate font-medium">{group.name}</p>
                                         {conv.unreadCount > 0 && (
                                             <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                                                 {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                             </span>
                                         )}
                                     </div>
                                     <p className="truncate text-xs text-muted-foreground">
                                         {(() => {
                                             const msg = conv.lastMessage
                                             if (!msg) return 'No messages yet'
                                             if (msg.isRevoked) return 'Message recalled'
                                             if (msg.type === TIM.TYPES.MSG_GRP_TIP) return '[Group Notification]'
                                             if (msg.type === TIM.TYPES.MSG_CUSTOM && msg.payload?.data) {
                                                 try {
                                                     const data = JSON.parse(msg.payload.data)
                                                     if (data.type === 'image') return '[Image]'
                                                     if (data.type === 'GROUP_INVITE') return '[Group Invitation]'
                                                     return msg.payload.description || '[Custom Message]'
                                                 } catch {
                                                     return msg.payload.description || '[Custom Message]'
                                                 }
                                             }
                                             return msg.messageForShow || msg.payload?.text || '[Message]'
                                         })()}
                                     </p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        )}

        {/* Requests Section */}
        {requests.length > 0 && (
            <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Requests</h3>
                <div className="space-y-2">
                    {requests.map(req => (
                        <div key={req.id} className="flex items-center justify-between rounded-md border border-border p-2 bg-secondary/10">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{req.sender?.username || 'Unknown'}</span>
                            </div>
                            <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-500 hover:text-green-600" onClick={() => acceptRequest(req.id)}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-red-600" onClick={() => rejectRequest(req.id)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Connections List */}
        <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Connections</h3>
            <div className="space-y-1">
                {users.map(friend => {
                    const unreadCount = getUnreadCount(friend.id)
                    return (
                        <button
                            key={friend.id}
                            onClick={() => setActiveRoom(friend)}
                            className={cn(
                                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
                                activeRoom?.id === friend.id && "bg-accent"
                            )}
                        >
                            <div className="relative">
                                <img
                                    src={friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`}
                                    alt={friend.username}
                                    className="h-10 w-10 rounded-full bg-background"
                                />
                                {/* Online indicator could go here */}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center">
                                    <p className="truncate font-medium">{friend.username}</p>
                                    {unreadCount > 0 && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{friend.display_id}</p>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden">
                    {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                        user?.user_metadata?.username?.charAt(0)?.toUpperCase()
                    )}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-medium">{user?.user_metadata?.username || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.user_metadata?.display_id || '#ID'}</p>
                </div>
            </div>
            <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
                    <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogoutClick}>
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
        </div>
      </div>

      <RequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchConnections} />
      <CreateGroupModal isOpen={isCreateGroupOpen} onClose={() => setIsCreateGroupOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the login screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
