import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import QuickPanelWindow from './components/quickpanel/QuickPanelWindow'
import { isQuickPanelWindow } from './lib/desktop'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isQuickPanelWindow ? <QuickPanelWindow /> : <App />}
  </StrictMode>,
)
