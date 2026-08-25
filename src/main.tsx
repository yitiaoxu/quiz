import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { builtinQuestions } from './bank/builtin'
import './index.css'
import { fileStorage } from './storage'
import { installQuizZoom } from './zoom'

installQuizZoom()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App questions={builtinQuestions} storage={fileStorage()} />
  </StrictMode>,
)
