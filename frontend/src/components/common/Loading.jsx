export default function Loading({ message = 'Cargando...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>

      </div>
      <p className="text-gray-500 font-medium">{message}</p>
    </div>
  );
}
