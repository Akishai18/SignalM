import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function PreviewEntryPage() {
  const { enterDemoMode } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    enterDemoMode().then(() => navigate('/', { replace: true }))
  }, [])

  return null
}
