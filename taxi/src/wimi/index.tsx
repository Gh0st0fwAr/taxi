import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import Config from '../config'
import store from '../state'
import { userActionCreators } from '../state/user'
import WimiApp from './WimiApp'
import './wimi.css'

// WIMI KIDS belongs to the children tenant; do not inherit Taxi's default tenant.
Config.setConfig('children', false)
// Rehydrate the existing user session. The quote endpoint still requires a real user token.
store.dispatch(userActionCreators.initUser())

const root = document.getElementById('root')
if (!root) throw new Error('WIMI root element was not found')

createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <WimiApp />
    </BrowserRouter>
  </React.StrictMode>,
)
