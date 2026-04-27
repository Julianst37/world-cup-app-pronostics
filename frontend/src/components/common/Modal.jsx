export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ marginTop: 0 }}>
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onClose}
          ></div>

          <div
            className={`relative bg-white rounded-2xl shadow-xl z-10 ${
              size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md'
            }`}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-800">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 text-center">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}