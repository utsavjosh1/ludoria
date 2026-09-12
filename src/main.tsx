import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element.')

// StrictMode intentionally double-mounts in dev: it proves GameHost
// init/dispose is remount-safe (one loop, no leaked listeners).
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
