import { create } from 'zustand'

const useStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  
  users: [], // Other users (connections)
  setUsers: (users) => set({ users }),
  
  requests: [], // Pending requests
  setRequests: (requests) => set({ requests }),
  
  activeRoom: null,
  setActiveRoom: (room) => set({ activeRoom: room }),
  isGroupInfoOpen: false,
  setGroupInfoOpen: (open) => set({ isGroupInfoOpen: open }),
  
  // connection status with Tencent IM/RTC
  isConnected: false,
  setIsConnected: (status) => set({ isConnected: status }),
  
  initError: null,
  setInitError: (error) => set({ initError: error }),

  typingUsers: {}, // { [userID]: boolean }
  lastSeenUsers: {}, // { [userID]: timestamp }
  
  setTypingUser: (userID, isTyping) => set((state) => ({ 
      typingUsers: { ...state.typingUsers, [userID]: isTyping } 
  })),
  
  updateLastSeen: (userID) => set((state) => ({
      lastSeenUsers: { ...state.lastSeenUsers, [userID]: Date.now() }
  })),
  
  tim: null,
  setTim: (tim) => set({ tim }),
  
  trtc: null,
  setTrtc: (trtc) => set({ trtc }),

  // Map: conversationID -> [messages]
  conversations: {},
  conversationList: [], // Metadata like unreadCount
  
  updateConversationList: (list) => set({ conversationList: list }),
  
  markMessageAsRead: (conversationID) => set((state) => {
      // Mark messages as read locally to trigger UI update
      const msgs = state.conversations[conversationID]
      if (!msgs) return {}
      
      return {
          conversations: {
              ...state.conversations,
              [conversationID]: msgs.map(m => ({ ...m, isPeerRead: true }))
          }
      }
  }),

  addMessage: (conversationID, message) => set((state) => {
    const currentMessages = state.conversations[conversationID] || []
    
    // Strict duplicate check using both ID variations and client sequence if available
    const exists = currentMessages.some(m => 
        (m.ID && m.ID === message.ID) || 
        (m.id && m.id === message.id) ||
        (m.sequence && m.sequence === message.sequence)
    )

    if (exists) {
        return state
    }
    
    return {
        conversations: {
            ...state.conversations,
            [conversationID]: [...currentMessages, message]
        }
    }
  }),

  setMessages: (conversationID, messages) => set((state) => ({
    conversations: {
        ...state.conversations,
        [conversationID]: messages
    }
  })),

  clearMessages: (conversationID) => set((state) => ({
    conversations: {
        ...state.conversations,
        [conversationID]: []
    }
  })),

  deleteMessage: (conversationID, messageId) => set((state) => ({
    conversations: {
        ...state.conversations,
        [conversationID]: state.conversations[conversationID].filter(m => m.ID !== messageId && m.id !== messageId)
    }
  })),
}))

export default useStore
