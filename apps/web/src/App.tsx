import { useState } from 'react';

export function App() {
  const [sidebarOpen] = useState(true);

  return (
    <div className="app-layout">
      <header className="app-toolbar">
        <h1 className="app-title">Mudbrick v2</h1>
      </header>
      <div className="app-body">
        {sidebarOpen && (
          <aside className="app-sidebar">
            <p>Sidebar placeholder</p>
          </aside>
        )}
        <main className="app-main">
          <p>Welcome to Mudbrick v2. Drop a PDF to get started.</p>
        </main>
      </div>
    </div>
  );
}
