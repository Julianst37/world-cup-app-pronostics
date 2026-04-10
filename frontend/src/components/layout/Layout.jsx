import Navbar from './Navbar';

export default function Layout({ children, showSidebar, sidebar }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        {showSidebar && sidebar}
        <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
