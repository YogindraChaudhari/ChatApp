import { useEffect } from 'react'
import Sidebar from '../components/chat/Sidebar'
import ChatArea from '../components/chat/ChatArea'
import GroupInfoPanel from '../components/chat/GroupInfoPanel'
import { useTencent } from '../hooks/useTencent'
import useStore from '../store/useStore'
import ErrorBoundary from '../components/ErrorBoundary'

function Home() {
  const { user } = useStore()
  useTencent() // Initialize IM/RTC

  if (!user) return null

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar />
        <ChatArea />
        <GroupInfoPanel />
      </div>
    </ErrorBoundary>
  )
}

export default Home
