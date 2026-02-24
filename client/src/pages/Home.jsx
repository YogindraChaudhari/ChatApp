import { useEffect } from 'react'
import Sidebar from '../components/chat/Sidebar'
import ChatArea from '../components/chat/ChatArea'
import GroupInfoPanel from '../components/chat/GroupInfoPanel'
import { useTencent } from '../hooks/useTencent'
import useStore from '../store/useStore'
import ErrorBoundary from '../components/ErrorBoundary'

function Home() {
  const { user, activeRoom, isGroupInfoOpen } = useStore()
  useTencent() // Initialize IM/RTC

  if (!user) return null

  return (
    <ErrorBoundary>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <div className={`${activeRoom ? 'hidden md:flex' : 'flex'} w-full md:w-80 h-full border-r border-border`}>
            <Sidebar />
        </div>
        <div className={`${activeRoom ? 'flex' : 'hidden md:flex'} flex-1 h-full`}>
            <ChatArea />
        </div>
        {activeRoom?.type === 'GROUP' && isGroupInfoOpen && (
            <div className="fixed inset-0 z-50 flex md:relative md:inset-auto md:w-80 h-full">
                <GroupInfoPanel />
            </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default Home
