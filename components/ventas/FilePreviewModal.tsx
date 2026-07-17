'use client';

import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

type Props = {
  fileUrl: string;
  fileName?: string | null;
  onClose: () => void;
};

export default function FilePreviewModal({ fileUrl, fileName, onClose }: Props) {
  const target = fileName || fileUrl;
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(target);
  const isPDF = /\.pdf$/i.test(target);
  // Los archivos de storage suelen no tener extensión en la URL; el iframe cubre PDFs sin extensión
  const fallbackToIframe = !isImage && !isPDF && fileUrl.startsWith('http');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'archivo';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-4">
            {fileName || 'Vista previa'}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 text-rose-800 hover:bg-rose-50 rounded-lg transition"
              title="Descargar"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
              title="Cerrar"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={fileName || 'Vista previa'}
              className="max-w-full max-h-full object-contain rounded shadow-lg"
            />
          ) : isPDF || fallbackToIframe ? (
            <iframe
              src={fileUrl}
              className="w-full h-full border-0 rounded shadow-lg"
              title={fileName || 'Vista previa'}
            />
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                No se puede mostrar vista previa de este tipo de archivo.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center px-4 py-2 bg-rose-800 text-white rounded-lg hover:bg-rose-700 transition"
              >
                <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                Descargar archivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
