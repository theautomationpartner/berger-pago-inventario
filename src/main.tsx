import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'

import '@/styles/base.css'
import '@/styles/layout.css'
import '@/styles/components.css'
import '@/styles/pago.css'

const container = document.getElementById('root')
if (!container) throw new Error('No se encontró el nodo #root')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
