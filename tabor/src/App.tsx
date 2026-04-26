import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { Reader } from './pages/Reader';
import { Flashcards } from './pages/Flashcards';
import { FocusMode } from './pages/FocusMode';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reader/:id" element={<Reader />} />
        <Route path="*" element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/focus" element={<FocusMode />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
