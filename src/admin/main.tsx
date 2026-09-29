import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import { OAUTH_CLIENT_ID } from './config'
import './styles/admin.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider clientId={OAUTH_CLIENT_ID}>
      <App />
    </AuthProvider>
  </StrictMode>,
)
