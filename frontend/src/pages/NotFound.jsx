import { Link } from 'react-router-dom';
import { CircleDot } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-6">
      <CircleDot className="w-20 h-20 text-gray-400 mb-6" />
      <h1 className="text-6xl font-black text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-bold text-gray-600 mb-2">Página no encontrada</h2>
      <p className="text-gray-500 mb-8">
        Parece que esta página se fue al vestuario... ¡No existe!
      </p>
      <Link
        to="/"
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition"
      >
        ← Volver al inicio
      </Link>
    </div>
  );
}
