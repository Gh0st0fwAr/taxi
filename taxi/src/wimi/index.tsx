import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import WimiApp from './WimiApp'
import './wimi.css'

const root = document.getElementById('root')
if (!root) throw new Error('WIMI root element was not found')

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <WimiApp />
    </BrowserRouter>
  </React.StrictMode>,
)
