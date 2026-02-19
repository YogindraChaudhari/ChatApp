
import { useEffect, useState, useRef } from 'react'
import TIM from 'tim-js-sdk'
import TRTC from 'trtc-sdk-v5'
import useStore from '../store/useStore'

// Initialize SDKs

export const useTencent = () => {
    const { user, isConnected, setIsConnected, setTim, setTrtc, tim, trtc } = useStore()


    const initializingRef = useRef(false)

    useEffect(() => {
        if (!user || isConnected || initializingRef.current) return

        const init = async () => {
            initializingRef.current = true
            useStore.getState().setInitError(null)

            try {
                // Fetch UserSig
                const response = await fetch('/api/generate-user-sig', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id })
                })
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    const errorMessage = errorData.error || 'Failed to fetch UserSig'
                    throw new Error(errorMessage)
                }
                
                const { userSig, sdkAppId } = await response.json()

                // Check if instance already exists in store to reuse (though isConnected check usually handles this)
                let timInstance = useStore.getState().tim
                if (!timInstance) {
                     timInstance = TIM.create({ SDKAppID: sdkAppId })
                     timInstance.setLogLevel(0) // VERBOSE LOGGING
                     setTim(timInstance)
                }

                // Add event listeners BEFORE login
                // Remove any existing listeners first to be safe (if SDK supports off, otherwise just add)
                timInstance.off(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived)
                timInstance.on(TIM.EVENT.MESSAGE_RECEIVED, onMessageReceived)
                
                timInstance.off(TIM.EVENT.CONVERSATION_LIST_UPDATED, onConversationListUpdated)
                timInstance.on(TIM.EVENT.CONVERSATION_LIST_UPDATED, onConversationListUpdated)

                timInstance.off(TIM.EVENT.MESSAGE_READ_BY_PEER, onMessageReadByPeer)
                timInstance.on(TIM.EVENT.MESSAGE_READ_BY_PEER, onMessageReadByPeer)
                
                timInstance.off(TIM.EVENT.ERROR, onError)
                timInstance.on(TIM.EVENT.ERROR, onError)

                // Initialize TRTC
                const trtcInstance = TRTC.create()
                setTrtc(trtcInstance)

                // Login TIM
                await timInstance.login({ userID: user.id, userSig })
                
                setIsConnected(true)
            } catch (error) {
                console.error('Tencent Init Error:', error)
                // If error is "Repeated login" (6014), we can treat it as success or ignore
                if (error && (error.code === 6014 || error.message?.includes('Repeated login'))) {
                     setIsConnected(true)
                } else {
                     useStore.getState().setInitError(error.message || 'Initialization failed')
                }
            } finally {
                initializingRef.current = false
            }
        }

        init()


    }, [user, isConnected])

    const onError = (event) => {
        console.error("Tencent SDK Error:", event.data)
    }

    const onMessageReceived = (event) => {
        const messageList = event.data
        messageList.forEach((message) => {
            // Check for Typing Indicator (Custom Message)
            if (message.type === TIM.TYPES.MSG_CUSTOM) {
                try {
                    const data = JSON.parse(message.payload.data)
                    
                    // Handle Typing
                    if (data.action === 'typing') {
                        useStore.getState().setTypingUser(message.from, true)
                        setTimeout(() => {
                            useStore.getState().setTypingUser(message.from, false)
                        }, 3000)
                        return 
                    }
                    
                    // Handle Ping (Heartbeat)
                    if (data.action === 'ping') {
                         console.log("Received Ping from", message.from)
                         useStore.getState().updateLastSeen(message.from)
                         
                         // Send Pong
                         const tim = useStore.getState().tim
                         if (tim) {
                             const pongMsg = tim.createCustomMessage({
                                 to: message.from,
                                 conversationType: TIM.TYPES.CONV_C2C,
                                 payload: {
                                     data: JSON.stringify({ action: 'pong' }),
                                     description: 'pong',
                                     extension: ''
                                 },
                                 excludedFromUnreadCount: true,
                                 excludedFromLastMessage: true
                             })

                         }
                         return
                    }

                    // Handle Pong
                    if (data.action === 'pong') {
                        console.log("Received Pong from", message.from)
                        useStore.getState().updateLastSeen(message.from)
                        return
                    }

                    // Handle Connection Removed
                    if (data.action === 'connection_removed') {
                        console.log("Connection removed by remote user:", message.from)
                        const store = useStore.getState()
                        
                        // 1. Remove from users list
                        const currentUsers = store.users
                        const newUsers = currentUsers.filter(u => u.id !== message.from)
                        store.setUsers(newUsers)
                        
                        // 2. Close active chat if open
                        if (store.activeRoom && store.activeRoom.id === message.from) {
                            store.setActiveRoom(null)
                        }

                        // 3. Delete conversation history (Client side)
                        // Need conversationID. Message has it.
                        if (message.conversationID) {
                            try {
                               // Delete from TIM if possible (optional, maybe just clear local view)
                               const tim = store.tim
                               if (tim) tim.deleteConversation(message.conversationID).catch(() => {})
                            } catch (e) {}
                            
                            store.clearMessages(message.conversationID)
                        }
                        
                        return
                    }

                } catch (e) {
                    // Not a control message, proceed
                }
            }

            console.log('New message received:', message)
            const conversationID = message.conversationID
            useStore.getState().addMessage(conversationID, message)
            
            // Update Last Seen for any message
            useStore.getState().updateLastSeen(message.from)

            // Auto-read if chat is open
            const activeRoom = useStore.getState().activeRoom
            if (activeRoom && activeRoom.id === message.from) {
                const tim = useStore.getState().tim
                if (tim) {
                    tim.setMessageRead({ conversationID: message.conversationID }).catch(() => {})
                }
            }
        })
    }

    const onConversationListUpdated = (event) => {
        // event.data is an array of Conversation objects
        useStore.getState().updateConversationList(event.data)
    }

    const onMessageReadByPeer = (event) => {
        // Handle peer read receipt
        const list = event.data || []
        list.forEach((item) => {
             if (item.conversationID) {
                 useStore.getState().markMessageAsRead(item.conversationID)
             }
        })
    }

    return { tim, trtc, isConnected }
}
