import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const MediaLightbox: React.FC = () => {
  const { mediaPreview, setMediaPreview } = useAppStore();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMediaPreview(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setMediaPreview]);

  if (!mediaPreview) return null;

  const handleClose = () => {
    setMediaPreview(null);
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = mediaPreview.url;
    a.download = mediaPreview.alt || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(mediaPreview.url, '_blank');
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleClose}
    >
      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none">
        <div className="flex items-center space-x-4 pointer-events-auto">
          <span className="text-sm font-medium text-white/80 truncate max-w-xs">
            {mediaPreview.alt || 'Image Preview'}
          </span>
        </div>

        <div className="flex items-center space-x-2 pointer-events-auto">
          <button 
            onClick={handleZoomOut}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button 
            onClick={handleZoomIn}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Zoom In"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button 
            onClick={handleRotate}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Rotate"
          >
            <RotateCw className="h-5 w-5" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button 
            onClick={handleOpenInNewTab}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Open in new tab"
          >
            <ExternalLink className="h-5 w-5" />
          </button>
          <button 
            onClick={handleDownload}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
          <button 
            onClick={handleClose}
            className="ml-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Media Content */}
      <div 
        className="relative max-w-full max-h-full p-4 transition-transform duration-200 flex items-center justify-center overflow-hidden"
        style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {mediaPreview.type === 'image' ? (
          <img 
            src={mediaPreview.url} 
            alt={mediaPreview.alt} 
            className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-sm select-none"
          />
        ) : (
          <video 
            src={mediaPreview.url} 
            controls 
            autoPlay
            className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-sm"
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white/50 uppercase tracking-widest">
        {zoom * 100}% Zoom • {rotation}° Rotation
      </div>
    </div>
  );
};

export default MediaLightbox;
