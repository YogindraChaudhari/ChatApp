import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Send, Phone, Video, Trash2, MoreVertical, Eraser, Smile, Paperclip, FileText, Image as ImageIcon, File, Loader2, Download, UserMinus, Check, CheckCheck, X, ChevronLeft, ChevronRight, UserPlus, Users, Info } from 'lucide-react'
import useStore from '../../store/useStore'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import TIM from 'tim-js-sdk'
import EmojiPicker from 'emoji-picker-react'
import { supabase } from '../../services/supabaseClient'
import InviteMemberModal from './InviteMemberModal'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"

const FILE_ICONS = {
    'pdf': FileText,
    'doc': FileText,
    'docx': FileText,
    'xls': FileText,
    'xlsx': FileText,
    'ppt': FileText,
    'pptx': FileText,
    'image': ImageIcon,
    'default': File
}

export default function ChatArea() {
  const { activeRoom, user, tim, conversations, addMessage, setMessages, clearMessages, deleteMessage, isConnected, initError, typingUsers, lastSeenUsers, users, setUsers, setActiveRoom, setGroupInfoOpen, isGroupInfoOpen } = useStore()
  const [inputValue, setInputValue] = useState('')
  const [isRemoveConnectionOpen, setIsRemoveConnectionOpen] = useState(false)
  const [deletingMessage, setDeletingMessage] = useState(null)
  const [isClearChatOpen, setIsClearChatOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  
  const resolveUser = (userID) => {
      if (userID === user?.id) return { name: 'You', avatar: user?.user_metadata?.avatar_url }
      const found = users.find(u => u.id === userID)
      if (found) return { name: found.username, avatar: found.avatar_url }
      return { name: userID, avatar: null }
  }

  const renderGroupTip = (msg) => {
      const opType = msg.payload.operationType
      const userList = msg.payload.userIDList ? msg.payload.userIDList.map(uid => resolveUser(uid).name).join(', ') : ''
      const operator = msg.payload.operatorID ? resolveUser(msg.payload.operatorID).name : ''
      
      switch (opType) {
          case TIM.TYPES.GRP_TIP_MBR_JOIN:
              return `${userList} joined the group`
          case TIM.TYPES.GRP_TIP_MBR_QUIT:
              return `${userList} left the group`
          case TIM.TYPES.GRP_TIP_MBR_KICKED_OUT:
              return `${userList} kicked out by ${operator}`
          case TIM.TYPES.GRP_TIP_MBR_SET_ADMIN:
               return `${userList} is now Admin`
          case TIM.TYPES.GRP_TIP_GRP_PROFILE_UPDATED:
               return `Group profile updated`
          default:
               return `Group Notification`
      }
  }

  const [isGroupAdmin, setIsGroupAdmin] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastTypingSentRef = useRef(0)

  const conversationID = activeRoom ? (activeRoom.type === 'GROUP' ? `GROUP${activeRoom.id}` : `C2C${activeRoom.id}`) : null
  const messages = conversationID ? (conversations[conversationID] || []) : []
  const isTyping = activeRoom ? typingUsers[activeRoom.id] : false

  useEffect(() => {
    if (conversationID && tim) {
        // Fetch message history
        const fetchHistory = async () => {
            try {
                const imResponse = await tim.getMessageList({ conversationID: conversationID })
                setMessages(conversationID, imResponse.data.messageList)
                // Mark as read when entering or loading history
                tim.setMessageRead({ conversationID }).catch(console.warn)
            } catch (error) {
                console.error("Failed to fetch history:", error)
            }
        }
        fetchHistory()
        
        // Mark read on new messages if window is focused/active
        // For simplicity, we just mark read if the activeRoom matches
        const markRead = async () => {
             tim.setMessageRead({ conversationID }).catch(() => {})
        }
        markRead()
    }
  }, [conversationID, tim, setMessages]) // Removed messages to prevent loop

  const [userStatus, setUserStatus] = useState('Offline')

  useEffect(() => {
    if (!activeRoom || !tim) return

    const userID = String(activeRoom.id)
    
    const checkStatus = async () => {
        try {
            // Subscribe safely (Tencent SDK handles duplicate subscription gracefully usually, but let's be safe)
            // Note: In some SDK versions, subscribeUserStatus is persistent.
            tim.subscribeUserStatus([userID]).catch((e) => console.warn("Sub failed", e))

            // Send Ping to force status update via "Last Seen" mechanism
            try {
                const pingMsg = tim.createCustomMessage({
                    to: userID,
                    conversationType: TIM.TYPES.CONV_C2C,
                    payload: {
                        data: JSON.stringify({ action: 'ping' }),
                        description: 'ping',
                        extension: ''
                    },
                    excludedFromUnreadCount: true,
                    excludedFromLastMessage: true
                })

            } catch (e) {
                console.error("Ping send fail", e)
            }

            const { data } = await tim.getUserStatus({ userIDList: [userID] })
            
            if (data && data.successUserList && data.successUserList.length > 0) {
                 const statusItem = data.successUserList[0]
                 const isOnline = statusItem.statusType === 1 || statusItem.statusType === 'Online' || statusItem.statusType === 'online'
                 if (isOnline) {
                      setUserStatus('Online')
                 } 
                 else {
                      // Fallback: Check last seen (Access store directly for freshness)
                      const freshLastSeenUsers = useStore.getState().lastSeenUsers
                      const lastSeen = freshLastSeenUsers[userID]
                      const twoMinutes = 2 * 60 * 1000
                      if (lastSeen && (Date.now() - lastSeen < twoMinutes)) {
                          setUserStatus('Online')
                      } else {
                          setUserStatus('Offline')
                      }
                 }
            } else {
                  // Fallback
                  const freshLastSeenUsers = useStore.getState().lastSeenUsers
                  const lastSeen = freshLastSeenUsers[userID]
                  const twoMinutes = 2 * 60 * 1000
                  if (lastSeen && (Date.now() - lastSeen < twoMinutes)) {
                      setUserStatus('Online')
                  } else {
                      setUserStatus('Offline')
                  }
            }
        } catch (error) {
            console.error("Status check failed", error)
            const freshLastSeenUsers = useStore.getState().lastSeenUsers
            const lastSeen = freshLastSeenUsers[userID]
            const twoMinutes = 2 * 60 * 1000
            if (lastSeen && (Date.now() - lastSeen < twoMinutes)) {
                setUserStatus('Online')
            } else {
                setUserStatus('Offline')
            }
        }
    }

    // Check Group Admin Status
    const checkGroupAdmin = async () => {
        if (activeRoom?.type === 'GROUP' && tim && user) {
            try {
                // Get member profile to check role
                const res = await tim.getGroupMemberProfile({
                    groupID: activeRoom.id,
                    userIDList: [user.id]
                })
                const member = res.data.memberList[0]
                if (member && (member.role === TIM.TYPES.GRP_MBR_ROLE_OWNER || member.role === TIM.TYPES.GRP_MBR_ROLE_ADMIN)) {
                    setIsGroupAdmin(true)
                } else {
                    setIsGroupAdmin(false)
                }
            } catch (err) {
                console.error("Failed to check admin status", err)
                setIsGroupAdmin(false)
            }
        } else {
            setIsGroupAdmin(false)
        }
    }

    // Initial check
    checkStatus()
    checkGroupAdmin()

    // Poll every 10 seconds as a fallback
    const intervalId = setInterval(() => {
        checkStatus()
    }, 10000)

    const onUserStatusUpdated = (event) => {
        const statusList = event.data
        statusList.forEach((item) => {
            if (String(item.userID) === userID) {
                 // Check diverse values for Online
                 const isOnline = item.statusType === 1 || item.statusType === 'Online' || item.statusType === 'online' || item.status === 'Online' || item.status === 'online'
                 
                 if (isOnline) {
                     setUserStatus('Online')
                 } else {
                     // Check last seen fallback
                      const lastSeen = useStore.getState().lastSeenUsers[userID]
                      const twoMinutes = 2 * 60 * 1000
                      if (lastSeen && (Date.now() - lastSeen < twoMinutes)) {
                          setUserStatus('Online')
                      } else {
                          setUserStatus('Offline')
                      }
                 }
            }
        })
    }

    tim.on(TIM.EVENT.USER_STATUS_UPDATED, onUserStatusUpdated)

    return () => {
        clearInterval(intervalId)
        tim.off(TIM.EVENT.USER_STATUS_UPDATED, onUserStatusUpdated)
    }
  }, [activeRoom, tim])
  
  // Send typing indicator
  const handleInputChange = (e) => {
      setInputValue(e.target.value)
      
      if (!activeRoom || !tim || !isConnected) return

      const now = Date.now()
      // Send typing signal every 2 seconds max
      if (now - lastTypingSentRef.current > 2000) {
          lastTypingSentRef.current = now
          const message = tim.createCustomMessage({
              to: activeRoom.id,
              conversationType: activeRoom.type === 'GROUP' ? TIM.TYPES.CONV_GROUP : TIM.TYPES.CONV_C2C,
              payload: {
                  data: JSON.stringify({ action: 'typing' }),
                  description: 'typing',
                  extension: ''
              },
              excludedFromUnreadCount: true,
              excludedFromLastMessage: true
          })
          // Send quietly (don't add to UI, catch error silently)
          console.log("Sending typing...")

      }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = async (e) => {
    e && e.preventDefault()
    if ((!inputValue.trim() && pendingFiles.length === 0) || !activeRoom || !tim) return

    setIsUploading(true)

    // 1. Process Pending Files First (Sequential Upload & Send)
    for (const fileObj of pendingFiles) {
        try {
            const { file } = fileObj
            
            // Upload to Supabase
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('chat-attachments')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('chat-attachments')
                .getPublicUrl(filePath)

            // Create Custom Message Payload
            const isImage = file.type.startsWith('image/')
            const customData = {
                type: isImage ? 'image' : 'file',
                url: publicUrl,
                name: file.name,
                size: file.size,
                mimeType: file.type
            }

            const conversationType = activeRoom.type === 'GROUP' ? TIM.TYPES.CONV_GROUP : TIM.TYPES.CONV_C2C
            
            const message = tim.createCustomMessage({
                to: activeRoom.id,
                conversationType: conversationType,
                payload: {
                    data: JSON.stringify(customData),
                    description: isImage ? '[Image]' : '[File]',
                    extension: ''
                },
                needReadReceipt: true
            })

            const imResponse = await tim.sendMessage(message)
            addMessage(conversationID, imResponse.data.message)

        } catch (error) {
            console.error('File processing failed:', error)
        }
    }

    // Clear files after attempting to send
    setPendingFiles([])
    setIsUploading(false)

    // 2. Send Text Message
    if (inputValue.trim()) {
        const textToSend = inputValue // capture current value
        setInputValue('') // Clear input early for UX
        
        // Optimistic Text Message
        const tempId = `TEMP-${Date.now()}`
        const optimisiticMessage = {
            ID: tempId,
            id: tempId,
            flow: 'out',
            payload: { text: textToSend },
            type: TIM.TYPES.MSG_TEXT,
            sender: user.id,
            conversationID: conversationID,
            time: Math.floor(Date.now() / 1000),
            status: 'sending' 
        }
        addMessage(conversationID, optimisiticMessage)

        try {
            const conversationType = activeRoom.type === 'GROUP' ? TIM.TYPES.CONV_GROUP : TIM.TYPES.CONV_C2C

            const message = tim.createTextMessage({
                to: activeRoom.id,
                conversationType: conversationType,
                payload: { text: textToSend },
                needReadReceipt: true
            })
            
            const imResponse = await tim.sendMessage(message)
            addMessage(conversationID, imResponse.data.message)
            deleteMessage(conversationID, tempId)

        } catch (error) {
            console.error("Message send failed", error)
            deleteMessage(conversationID, tempId)
            alert("Failed to send message")
        }
    }
  }

  const handleFileSelect = (event) => {
      const files = Array.from(event.target.files)
      if (files.length === 0) return

      setPendingFiles(prev => {
          // 1. Filter duplicates
          const existingKeys = new Set(prev.map(f => `${f.file.name}-${f.file.size}`))
          const uniqueFiles = files.filter(f => !existingKeys.has(`${f.name}-${f.size}`))

          if (uniqueFiles.length === 0) return prev

          // 2. Enforce limit (Max 3)
          const remainingSlots = 3 - prev.length
          if (remainingSlots <= 0) {
              toast.error("You can only add up to 3 files.")
              return prev
          }

          const filesToAdd = uniqueFiles.slice(0, remainingSlots)
          
          if (uniqueFiles.length > remainingSlots || uniqueFiles.length < files.length) {

               if (uniqueFiles.length < files.length) {
                   console.warn("Duplicate files ignored")
               }
               if (uniqueFiles.length > remainingSlots) {
                   toast.error(`Limit reached. Only ${remainingSlots} file(s) added.`)
               }
          }

          const newFileObjs = filesToAdd.map(file => ({
              file,
              id: Math.random().toString(36).substr(2, 9),
              previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
          }))
          
          return [...prev, ...newFileObjs]
      })
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (id) => {
      setPendingFiles(prev => prev.filter(f => f.id !== id))
  }

  const moveFile = (index, direction) => {
      setPendingFiles(prev => {
          const newArr = [...prev]
          if (direction === 'left' && index > 0) {
              [newArr[index], newArr[index - 1]] = [newArr[index - 1], newArr[index]]
          } else if (direction === 'right' && index < newArr.length - 1) {
              [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]]
          }
          return newArr
      })
  }

  const confirmDeleteMessage = async () => {
      if (!deletingMessage || !tim) return

      try {
          // If it's a temp/optimistic message, just delete locally
          if (String(deletingMessage.ID).startsWith('TEMP-')) {
               deleteMessage(conversationID, deletingMessage.ID)
          } else {
               await tim.deleteMessage([deletingMessage])
               deleteMessage(conversationID, deletingMessage.ID || deletingMessage.id)
          }
      } catch (error) {
          console.error("Failed to delete message:", error)
          toast.error("Failed to delete message")
      } finally {
          setDeletingMessage(null)
      }
  }

  const confirmClearChat = async () => {
      if (!conversationID || !tim || messages.length === 0) {
          setIsClearChatOpen(false)
          return
      }

      try {
           const nonTempMessages = messages.filter(m => !String(m.ID).startsWith('TEMP-'))
           if (nonTempMessages.length > 0) {
               await tim.deleteMessage(nonTempMessages)
           }
           clearMessages(conversationID)
      } catch (error) {
           console.error("Failed to clear chat:", error)
           toast.error("Failed to clear chat")
      } finally {
          setIsClearChatOpen(false)
      }
  }

  const handleRemoveConnection = async () => {
      if (!activeRoom || !activeRoom.connectionId) {
          console.error("No connection ID found for active room")
          return
      }

      try {
          // 0. Send Signal to other user to remove connection locally
          // This ensures they update even if Realtime event is missed
          if (tim && activeRoom.id) {
              const signalMsg = tim.createCustomMessage({
                  to: activeRoom.id,
                  conversationType: TIM.TYPES.CONV_C2C,
                  payload: {
                      data: JSON.stringify({ action: 'connection_removed' }),
                      description: 'connection_removed',
                      extension: ''
                  },
                  excludedFromUnreadCount: true,
                  excludedFromLastMessage: true
              })
              await tim.sendMessage(signalMsg).catch(e => console.warn("Signal failed", e))
          }

          // 1. Delete connection from Supabase
          const { error } = await supabase.from('connections').delete().eq('id', activeRoom.connectionId)
          if (error) throw error

          // 2. Clear messages locally and from TIM
          if (tim && conversationID) {
              try {
                  await tim.deleteConversation(conversationID)
                  clearMessages(conversationID)
              } catch (e) {
                  console.warn("Failed to delete conversation from TIM", e)
              }
          }
          
          // 3. Update local store
          const currentUsers = users
          const newUsers = currentUsers.filter(u => u.id !== activeRoom.id)
          setUsers(newUsers)
          setActiveRoom(null)

      } catch (error) {
          console.error("Error removing connection:", error)
          toast.error("Failed to remove connection")
      } finally {
          setIsRemoveConnectionOpen(false)
      }
  }

  const handleVideoCall = () => {
    console.log('Starting video call with', activeRoom.id)
  }

  const renderMessageContent = (msg) => {
      const isMyMessage = msg.flow === 'out'
      if (msg.type === TIM.TYPES.MSG_TEXT) {
          return <p>{msg.payload.text}</p>
      } else if (msg.type === TIM.TYPES.MSG_CUSTOM) {
          try {
              const data = JSON.parse(msg.payload.data)
              if (data.type === 'image') {
                  return (
                      <div className="space-y-1">
                          <img 
                              src={data.url} 
                              alt="attachment" 
                              className="max-w-[200px] rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(data.url, '_blank')}
                          />
                      </div>
                  )
              } else if (data.type === 'GROUP_INVITE') {
                  return (
                      <div className="p-4 bg-card border border-border rounded-lg max-w-[300px] shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                                  <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                  <p className="font-semibold text-sm text-card-foreground">Group Invitation</p>
                                  <p className="text-xs text-muted-foreground truncate" title={data.inviterName}>from {data.inviterName}</p>
                              </div>
                          </div>
                          <p className="text-sm mb-4 text-card-foreground">
                              You have been invited to join <strong>{data.groupName}</strong>.
                          </p>
                          <Button 
                              size="sm" 
                              variant={isMyMessage ? "secondary" : "outline"}
                              className={`w-full font-medium ${!isMyMessage ? 'border-primary text-primary hover:bg-primary/10' : 'text-white'}`}
                              onClick={async () => {
                                  try {
                                      await tim.joinGroup({ 
                                          groupID: data.groupID, 
                                          type: TIM.TYPES.GRP_PUBLIC 
                                      })
                                      toast.success(`Joined group ${data.groupName} successfully!`)
                                  } catch (err) {
                                      console.error("Failed to join group", err)
                                      if (err.code === 10013) {
                                          alert("You are already a member of this group.")
                                      } else {
                                          toast.error("Failed to join group: " + err.message)
                                      }
                                  }
                              }}
                          >
                              Join Group
                          </Button>
                      </div>
                  )
              } else {
                 const FileIcon = FILE_ICONS[data.name.split('.').pop().toLowerCase()] || FILE_ICONS['default']
                 return (
                     <div className="flex items-center gap-3 p-2 bg-background/50 rounded-lg border border-border/50 min-w-[200px]">
                         <div className="p-2 bg-background rounded-md shadow-sm">
                             <FileIcon className="h-5 w-5 text-primary" />
                         </div>
                         <div className="flex-1 overflow-hidden">
                             <p className="text-sm font-medium truncate">{data.name}</p>
                             <p className="text-xs opacity-70">{(data.size / 1024).toFixed(1)} KB</p>
                         </div>
                         <a href={data.url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-background rounded-full transition-colors">
                             <Download className="h-4 w-4 opacity-70" />
                         </a>
                     </div>
                 )
              }
          } catch (e) {
              return <p>[Custom Message]</p>
          }
      }
      return <p>[Unsupported Message Type]</p>
  }

  if (!activeRoom) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground p-8 text-center">
        <div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to NexusChat</h2>
            <p>Select a conversation or add a new connection to start chatting.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
            <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden shrink-0" 
                onClick={() => setActiveRoom(null)}
            >
                <ChevronLeft className="h-6 w-6" />
            </Button>
            <img
                src={activeRoom.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRoom.username}`}
                alt={activeRoom.username}
                className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-secondary shrink-0"
            />
            <div className="min-w-0">
                <h2 className="font-semibold truncate text-sm md:text-base">{activeRoom.username}</h2>
                {isTyping ? (
                    <span className="text-[10px] md:text-xs text-primary animate-pulse font-bold flex items-center gap-1">
                        Typing...
                    </span>
                ) : (
                    activeRoom.type === 'GROUP' ? (
                        <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">Group Chat</span>
                    ) : (
                        <span className={`text-[10px] md:text-xs flex items-center gap-1 ${userStatus === 'Online' ? 'text-green-500' : 'text-muted-foreground'} whitespace-nowrap`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${userStatus === 'Online' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            {userStatus}
                        </span>
                    )
                )}
            </div>
        </div>
        <div className="flex gap-2">
            {activeRoom.type === 'GROUP' && (
                <>
                    {isGroupAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => setIsInviteModalOpen(true)} title="Invite Members">
                            <UserPlus className="h-5 w-5 text-muted-foreground hover:text-primary" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setGroupInfoOpen(!isGroupInfoOpen)} title="Group Info">
                        <Info className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    </Button>
                </>
            )}
            <Button variant="ghost" size="icon" onClick={() => console.log('Voice')}>
                <Phone className="h-5 w-5 text-muted-foreground hover:text-primary" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleVideoCall}>
                <Video className="h-5 w-5 text-muted-foreground hover:text-primary" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsRemoveConnectionOpen(true)} className="text-destructive">
                    <UserMinus className="mr-2 h-4 w-4" />
                    Remove Connection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsClearChatOpen(true)} className="text-destructive">
                    <Eraser className="mr-2 h-4 w-4" />
                    Clear Chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg) => {
            // 1. Handle Group Tips
            if (msg.type === TIM.TYPES.MSG_GRP_TIP) {
                 return (
                     <div key={msg.ID || msg.id} className="flex justify-center my-2">
                         <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
                             {renderGroupTip(msg)}
                         </span>
                     </div>
                 )
            }

            const isMyMessage = msg.flow === 'out'
            const isGroup = activeRoom?.type === 'GROUP'
            
            const senderInfo = resolveUser(msg.from)
            const senderName = isMyMessage ? 'You' : (msg.nick || senderInfo.name !== msg.from ? senderInfo.name : (msg.nick || msg.from))
            // Logic: prefer msg.nick if set, else store name if distinct from ID, else nick/ID.
            // Simplified:
            const displayName = isMyMessage ? 'You' : (senderInfo.name !== msg.from ? senderInfo.name : (msg.nick || msg.from))
            
            const displayAvatar = isMyMessage 
                ? (user?.user_metadata?.avatar_url) 
                : (msg.avatar || senderInfo.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.from}`)

            return (
                <div
                    key={msg.ID || msg.id}
                    className={`group flex items-end gap-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                >
                     {/* Avatar for Group Chat (Incoming only) */}
                    {isGroup && !isMyMessage && (
                        <div className="shrink-0 mb-1">
                             <img 
                                src={displayAvatar} 
                                alt={msg.from}
                                className="h-8 w-8 rounded-full bg-secondary border border-border object-cover"
                             />
                        </div>
                    )}

                    {/* Delete button (hidden by default, shown on hover) */}
                    {isMyMessage && (
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mb-2"
                            onClick={() => setDeletingMessage(msg)}
                        >
                            <Trash2 className="h-3 w-3" />
                         </Button>
                    )}

                    <div className={`flex flex-col max-w-[70%] ${isMyMessage ? 'items-end' : 'items-start'}`}>
                         {/* Name for Group Chat (Incoming only) */}
                        {isGroup && !isMyMessage && (
                            <span className="text-[10px] text-muted-foreground ml-1 mb-1 truncate max-w-full">
                                {displayName}
                            </span>
                        )}

                        <div
                            className={`rounded-lg px-4 py-2 w-full break-words ${
                                isMyMessage
                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                    : 'bg-secondary text-secondary-foreground rounded-bl-none'
                            }`}
                        >
                            {renderMessageContent(msg)}
                            <span className="text-[10px] opacity-70 mt-1 block text-right flex items-center justify-end gap-1">
                                {new Date(msg.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isMyMessage && (
                                    msg.isPeerRead ? (
                                        <CheckCheck className="h-3 w-3 text-blue-500" />
                                    ) : (
                                        <Check className="h-3 w-3" />
                                    )
                                )}
                            </span>
                        </div>
                    </div>

                    {!isMyMessage && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mb-2"
                            onClick={() => setDeletingMessage(msg)}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Init Error */}
      {initError && (
          <div className="bg-destructive/10 text-destructive text-sm p-2 text-center border-b border-destructive/20">
              Connection Error: {initError}. Please check your server configuration.
          </div>
      )}

      {/* File Preview Dialog */}
      <Dialog open={pendingFiles.length > 0} onOpenChange={(open) => !open && setPendingFiles([])}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selected Files ({pendingFiles.length})</DialogTitle>
            <DialogDescription>
                Review and reorder your files before sending.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {pendingFiles.map((fileObj, index) => (
                <div key={fileObj.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-secondary shadow-sm">
                    {fileObj.previewUrl ? (
                        <img src={fileObj.previewUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-muted/50">
                            <File className="text-muted-foreground w-12 h-12 mb-2" />
                            <span className="text-xs text-center truncate w-full px-2">{fileObj.file.name}</span>
                        </div>
                    )}
                    
                    {/* Always visible on mobile, hover on desktop */}
                    <div className="absolute inset-0 bg-black/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3">
                        <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-10 w-10 rounded-full shadow-lg hover:scale-110 transition-transform"
                            onClick={() => removePendingFile(fileObj.id)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                        <div className="flex gap-4">
                            <Button 
                                size="icon"
                                className="h-10 w-10 rounded-full shadow-lg bg-white/90 hover:bg-white text-black"
                                disabled={index === 0}
                                onClick={() => moveFile(index, 'left')}
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button 
                                size="icon"
                                className="h-10 w-10 rounded-full shadow-lg bg-white/90 hover:bg-white text-black"
                                disabled={index === pendingFiles.length - 1}
                                onClick={() => moveFile(index, 'right')}
                            >
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
             
            {/* Add More Button */}
            {pendingFiles.length < 3 && (
                <div 
                    className="relative group aspect-square rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary/50 bg-secondary/50 hover:bg-secondary transition-all cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <Paperclip className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium">Add more</span>
                </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 flex gap-2 w-full">
                <Input 
                    value={inputValue}
                    onChange={handleInputChange}
                    placeholder="Add a caption..."
                    className="flex-1"
                    disabled={isUploading}
                />
                <Button onClick={handleSend} disabled={isUploading} className="shrink-0">
                    {isUploading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send className="mr-2 h-4 w-4" />
                            Send {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
                        </>
                    )}
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Input Area (Standard) */}
      <div className="p-4 border-t border-border flex gap-2 items-center">
        {/* Hidden File Input */}
        <input 
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
            multiple 
        />

        {/* Attachment Button */}
        <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0" 
            disabled={!isConnected || isUploading}
            onClick={() => fileInputRef.current?.click()}
        >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
        </Button>

        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0" disabled={!isConnected}>
                    <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto p-0 border-none bg-transparent shadow-none">
                <EmojiPicker 
                    onEmojiClick={(emojiData) => setInputValue(prev => prev + emojiData.emoji)}
                    previewConfig={{ showPreview: false }}
                />
            </PopoverContent>
        </Popover>

        <form onSubmit={handleSend} className="flex gap-2 flex-1">
            <Input 
                value={inputValue}
                onChange={handleInputChange}
                placeholder={isConnected ? "Type a message..." : "Connecting..."}
                className="flex-1"
                disabled={!isConnected}
            />
            <Button type="submit" size="icon" disabled={!inputValue.trim() || !isConnected}>
                <Send className="h-4 w-4" />
            </Button>
        </form>
      </div>

      {/* Delete Message Confirmation Modal */}
      <AlertDialog open={!!deletingMessage} onOpenChange={(open) => !open && setDeletingMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMessage}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Chat Confirmation Modal */}
      <AlertDialog open={isClearChatOpen} onOpenChange={setIsClearChatOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all messages in this conversation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearChat}>
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isRemoveConnectionOpen} onOpenChange={setIsRemoveConnectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from your connections? This will also delete the chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveConnection}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <InviteMemberModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />
    </div>
  )
}
