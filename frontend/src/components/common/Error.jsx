import { XCircle } from 'lucide-react';

export default function Error({ message = 'Ha ocurrido un error', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4 text-center p-6">
      <XCircle className="w-14 h-14 text-red-500" />
      <p className="text-gray-700 font-medium text-lg">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
