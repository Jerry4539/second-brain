import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { CreatePage } from './pages/CreatePage'
import { CanvasPage } from './pages/CanvasPage'
import { VoicePage } from './pages/VoicePage'
import { ModelsPage } from './pages/ModelsPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="canvas" element={<CanvasPage />} />
        <Route path="voice" element={<VoicePage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
