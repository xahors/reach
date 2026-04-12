import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, FileIcon, Download, ExternalLink } from 'lucide-react';
import { decryptFile, type EncryptedFile } from '../../utils/media';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';

interface DecryptedMediaProps {
  file?: EncryptedFile;
  mxcUrl?: string;
  type: 'image' | 'video' | 'sticker' | 'file';
  alt?: string;
  thumbnailUrl?: string;
  filename?: string;
  filesize?: number;
}

export const DecryptedMedia: React.FC<DecryptedMediaProps> = ({ 
  file, 
  mxcUrl, 
  type, 
  alt, 
  thumbnailUrl,
  filename,
  filesize
}) => {
  const client = useMatrixClient();
  const setMediaPreview = useAppStore((state) => state.setMediaPreview);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{ x: number, y: number } | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    const resolveUrl = (url: string | { content_uri: string } | null | undefined): string | null => {
      console.log("resolveUrl input:", url);
      if (typeof url === 'string') return url;
      if (url && typeof url === 'object' && 'content_uri' in url) {
        console.log("resolveUrl returning content_uri:", url.content_uri);
        return url.content_uri;
      }
      return null;
    };

    const loadMedia = async () => {
      if (!client || (!file && !mxcUrl)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (file) {
          // Encrypted file
          const urlStr = resolveUrl(file.url);
          if (!urlStr) {
            console.warn("Invalid file URL in encrypted media:", file.url);
            throw new Error("Invalid media URL");
          }

          const httpUrl = client.mxcUrlToHttp(urlStr);
          if (!httpUrl) {
            console.warn("Could not resolve encrypted media URL:", urlStr);
            throw new Error("Could not resolve media URL");
          }

          const blob = await decryptFile({ ...file, url: httpUrl });
          if (!active) return;

          const objUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objUrl;
          setUrl(objUrl);
        } else if (mxcUrl) {
          // Unencrypted file
          const urlStr = resolveUrl(mxcUrl);
          if (!urlStr) {
            console.warn("Invalid unencrypted media URL:", mxcUrl);
            throw new Error("Invalid media URL");
          }

          let httpUrl = (type === 'image' || type === 'sticker') 
            ? client.mxcUrlToHttp(urlStr, 800, 800, 'scale', true)
            : client.mxcUrlToHttp(urlStr);
          
          // Fallback if mxcUrlToHttp returns null (might be already an HTTP URL)
          if (!httpUrl && (urlStr.startsWith('http://') || urlStr.startsWith('https://') || urlStr.startsWith('blob:'))) {
            httpUrl = urlStr;
          }

          if (httpUrl) {
            setUrl(httpUrl);
          } else {
            console.warn("Could not resolve unencrypted media URL:", urlStr);
            throw new Error("Could not resolve media URL");
          }
        }
      } catch (err) {
        if (active) {
          console.error("Failed to load media:", err);
          setError("Failed to load media");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadMedia();

    return () => {
      active = false;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [file, mxcUrl, client, type]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(null);
      }
    };
    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  const handleDownload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowContextMenu(null);
  };

  const handleOpenInNewTab = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (url) {
      window.open(url, '_blank');
    }
    setShowContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleImageClick = () => {
    if (url && (type === 'image' || type === 'sticker')) {
      setMediaPreview({
        url,
        type: 'image',
        alt,
        file
      });
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  if (loading) {
    return (
      <div className="flex h-20 w-full max-w-sm items-center justify-center rounded-lg bg-bg-nav border border-border-main">
        <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex items-center space-x-2 rounded-lg bg-red-500/10 p-3 text-red-400 border border-red-500/20 max-w-sm">
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs font-medium">{error || "Media unavailable"}</span>
      </div>
    );
  }

  if (type === 'image' || type === 'sticker') {
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-border-main block w-fit max-w-[min(100%,450px)] bg-bg-nav group relative shadow-sm transition-all hover:shadow-md">
        <img 
          src={url} 
          alt={alt} 
          className="max-h-80 w-auto max-w-full block transition-transform hover:scale-[1.01] cursor-pointer" 
          onClick={handleImageClick}
          onContextMenu={handleContextMenu}
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
          <button 
            onClick={handleDownload}
            className="p-1.5 bg-black/60 hover:bg-black/80 rounded-md text-white backdrop-blur-sm transition-colors"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>

        {showContextMenu && (
          <div 
            ref={contextMenuRef}
            className="fixed z-[100] w-48 bg-bg-nav border border-border-main rounded-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: showContextMenu.y, left: showContextMenu.x }}
          >
            <button 
              onClick={handleDownload}
              className="flex items-center space-x-3 w-full px-4 py-2 text-xs text-text-main hover:bg-bg-hover transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Save image</span>
            </button>
            <button 
              onClick={handleOpenInNewTab}
              className="flex items-center space-x-3 w-full px-4 py-2 text-xs text-text-main hover:bg-bg-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in new tab</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-border-main max-w-md bg-bg-nav relative group">
        <video 
          src={url} 
          controls 
          className="max-h-96 w-full object-contain"
          poster={thumbnailUrl ? client?.mxcUrlToHttp(thumbnailUrl) || undefined : undefined}
        />
      </div>
    );
  }

  if (type === 'file') {
    return (
      <div className="mt-2 flex items-center justify-between p-3 rounded-lg border border-border-main bg-bg-nav hover:bg-bg-nav/80 transition-colors max-w-sm group">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="p-2 bg-accent-primary/10 rounded-lg text-accent-primary">
            <FileIcon className="h-6 w-6" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-text-main truncate" title={filename}>
              {filename || 'Unnamed file'}
            </span>
            <span className="text-xs text-text-muted">
              {formatSize(filesize)}
            </span>
          </div>
        </div>
        <button 
          onClick={handleDownload}
          className="ml-4 p-2 text-text-muted hover:text-white hover:bg-white/10 rounded-full transition-all"
          title="Download file"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return null;
};


