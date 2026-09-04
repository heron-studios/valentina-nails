import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import AdminPage from '../app/admin-page';
import '../app/globals.css';

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const updateRoute = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  return route.startsWith('#/admin') ? <AdminPage /> : <Home />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
