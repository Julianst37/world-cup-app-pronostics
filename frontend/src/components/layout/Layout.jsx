import Navbar from './Navbar';
import AdUnit from '../common/AdUnit';

export default function Layout({ children, showSidebar, sidebar }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        {showSidebar && sidebar}
        <main className="flex-1 p-4 md:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {/* Contenido principal: 3 columnas en desktop, 1 en mobile */}
            <div className="lg:col-span-3">
              {children}
            </div>
            
            {/* Sidebar derecho con anuncios: visible solo en desktop */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                <AdUnit format="vertical" />
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
