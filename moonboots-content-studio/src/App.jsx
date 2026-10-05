import React, { useCallback, useEffect, useState } from 'react';
import { FeedbackProvider } from './components/ui.jsx';
import { BottomNav, MobileTopBar, NAV_ITEMS, Sidebar } from './components/Shell.jsx';
import { StudioProvider, useStudio } from './studio.jsx';
import Home from './pages/Home.jsx';
import Create from './pages/Create.jsx';
import Schedule from './pages/Schedule.jsx';
import Graphics from './pages/Graphics.jsx';
import Insights from './pages/Insights.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';

const PAGES = { home: Home, create: Create, schedule: Schedule, graphics: Graphics, insights: Insights, settings: Settings };

// Pages live in the address hash, e.g. #/schedule/approval, so the back button and refresh work
const readRoute = () => {
  const [page, param] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page: PAGES[page] ? page : 'home', param: param ? decodeURIComponent(param) : null };
};

const useHashRoute = () => {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((page, param) => {
    const hash = `#/${page}${param ? `/${encodeURIComponent(param)}` : ''}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    window.scrollTo({ top: 0 });
  }, []);
  return [route, navigate];
};

// The signed-in app: navigation around the current page
const Studio = ({ onLogout }) => {
  const { page, navigate, workspace, workspaces, switchWorkspace, counts } = useStudio();
  const Page = PAGES[page] || Home;
  const badges = { schedule: counts.approval + counts.problems };

  // Each workspace has its own look (colours and fonts in index.css)
  useEffect(() => {
    if (!workspace) return;
    document.documentElement.dataset.brand = workspace.slug;
    const label = NAV_ITEMS.find(item => item.page === page)?.label;
    document.title = `${label ? `${label} · ` : ''}${workspace.name} Content Studio`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', workspace.slug === 'touchline' ? '#08111F' : '#020617');
  }, [workspace, page]);

  return (
    <div className="min-h-screen bg-bg text-ink font-brand">
      <Sidebar
        page={page}
        navigate={navigate}
        badges={badges}
        workspaces={workspaces}
        current={workspace}
        onSwitch={switchWorkspace}
        onLogout={onLogout}
      />
      <MobileTopBar workspaces={workspaces} current={workspace} onSwitch={switchWorkspace} onLogout={onLogout} />
      <main className="lg:pl-64">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-28 lg:pb-10">
          {workspace ? <Page key={workspace.id} /> : <div className="h-40" />}
        </div>
      </main>
      <BottomNav page={page} navigate={navigate} badges={badges} />
    </div>
  );
};

// Shows the login screen until the admin password has been entered
export default function App() {
  const [auth, setAuth] = useState({ status: 'checking', passwordSet: true, error: null });
  const [route, navigate] = useHashRoute();

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await response.json();
      setAuth({ status: data.authenticated ? 'in' : 'out', passwordSet: data.passwordSet, error: null });
    } catch {
      setAuth({ status: 'out', passwordSet: true, error: 'Could not reach the server' });
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Any API call that finds the login has expired comes back here
  useEffect(() => {
    const onLoggedOut = () => setAuth(prev => ({ ...prev, status: 'out' }));
    window.addEventListener('cs:logged-out', onLoggedOut);
    return () => window.removeEventListener('cs:logged-out', onLoggedOut);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setAuth(prev => ({ ...prev, status: 'out' }));
  };

  if (auth.status === 'checking') return <div className="min-h-screen bg-bg" />;

  return (
    <FeedbackProvider>
      {auth.status === 'out' ? (
        <Login passwordSet={auth.passwordSet} serverError={auth.error} onLoggedIn={() => setAuth(prev => ({ ...prev, status: 'in' }))} />
      ) : (
        <StudioProvider page={route.page} param={route.param} navigate={navigate}>
          <Studio onLogout={logout} />
        </StudioProvider>
      )}
    </FeedbackProvider>
  );
}
