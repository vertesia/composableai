import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { mount } from '../../multipage/index.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mount("page")}
  </StrictMode>,
)
