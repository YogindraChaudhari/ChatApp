import { useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { supabase } from '../../services/supabaseClient'
import useStore from '../../store/useStore'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export default function RequestModal({ isOpen, onClose, onSuccess }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { user } = useStore() // Current user

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setFoundUser(null)

    try {
      // Find user by display_id (e.g. #AX12)

      if (!searchTerm.startsWith('#')) {
          setMessage('Please enter a valid Display ID starting with #')
          setLoading(false)
          return
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('display_id', searchTerm)
        .single()

      if (error || !data) {
        setMessage('User not found')
      } else {
          if (data.id === user.id) {
              setMessage("You cannot add yourself")
          } else {
              setFoundUser(data)
          }
      }
    } catch (err) {
      console.error(err)
      setMessage('Error searching user')
    } finally {
      setLoading(false)
    }
  }

  const sendRequest = async () => {
    if (!foundUser) return

    try {
      // Check for existing connection in either direction
      const { data: existingConnection, error: checkError } = await supabase
        .from('connections')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${foundUser.id}),and(sender_id.eq.${foundUser.id},receiver_id.eq.${user.id})`)
        .single() // Expect at most one row if logic is sound, but might find duplicates

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error("Check error", checkError)
          throw checkError
      }

      if (existingConnection) {
          if (existingConnection.status === 'accepted') {
              setMessage('You are already connected!')
          } else if (existingConnection.status === 'pending') {
              if (existingConnection.sender_id === user.id) {
                  setMessage('Request already sent')
              } else {
                  // Incoming request exists!
                  setMessage('This user has already sent you a request!')
              }
          }
          return
      }

      const { error } = await supabase
        .from('connections')
        .insert({
          sender_id: user.id,
          receiver_id: foundUser.id,
          status: 'pending'
        })
      
      if (error) {
          if (error.code === '23505') { // Unique violation
              setMessage('Request already sent or connection exists')
          } else {
              throw error
          }
      } else {
          setMessage('Request sent!')
          onSuccess && onSuccess()
          setFoundUser(null)
          setSearchTerm('')

          setTimeout(onClose, 1000)
      }
    } catch (err) {
      console.error(err)
      setMessage('Failed to send request')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Add Connection</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            placeholder="Enter Display ID (e.g. #AX12)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            Search
          </Button>
        </form>

        {message && <p className="text-sm text-muted-foreground mb-4">{message}</p>}

        {foundUser && (
          <div className="flex items-center justify-between rounded-md border border-border p-3 bg-secondary/20">
            <div className="flex items-center gap-3">
              <img
                src={foundUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${foundUser.username}`}
                alt={foundUser.username}
                className="h-10 w-10 rounded-full bg-background"
              />
              <div>
                <p className="font-medium">{foundUser.username}</p>
                <p className="text-xs text-muted-foreground">{foundUser.display_id}</p>
              </div>
            </div>
            <Button size="sm" onClick={sendRequest}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
