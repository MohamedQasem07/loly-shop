import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Self-hosted fonts (offline-first PWA — no Google CDN). Each weight bundles
// the Arabic + Latin subsets with unicode-range, so the browser fetches only
// what it renders. Cairo = body/sans, Tajawal = display headings/prices.
import '@fontsource/cairo/400.css'
import '@fontsource/cairo/500.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import '@fontsource/cairo/800.css'
import '@fontsource/cairo/900.css'
import '@fontsource/tajawal/500.css'
import '@fontsource/tajawal/700.css'
import '@fontsource/tajawal/800.css'
import '@fontsource/tajawal/900.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
