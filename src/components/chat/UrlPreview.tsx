import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { Loader2, ExternalLink, ShieldCheck } from 'lucide-react';

interface UrlPreviewProps {
  url: string;
  children: React.ReactNode;
}

interface MatrixUrlPreview {
  'og:title'?: string;
  'og:description'?: string;
  'og:image'?: string;
  'title'?: string;
  'description'?: string;
}

const WHITELISTED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'twitter.com',
  'x.com',
  'reddit.com',
  'steampowered.com',
  'steamcommunity.com',
  'matrix.org'
];

export const UrlPreview: React.FC<UrlPreviewProps> = ({ url, children }) => {
  const client = useMatrixClient();
  const { showUrlPreviews } = useAppStore();
  const [preview, setPreview] = useState<MatrixUrlPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [error, setError] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  const isWhitelisted = WHITELISTED_DOMAINS.some(domain => url.includes(domain));

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const fetchPreview = async () => {
    if (!client || !isWhitelisted || preview || error) return;

    setLoading(true);
    try {
      const ytId = getYouTubeId(url);
      let finalPreview: MatrixUrlPreview = {};

      // 1. If it's YouTube, try noembed FIRST as it's more reliable for titles than generic homeserver scrapers
      if (ytId) {
        try {
          const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
          const json = await res.json();
          if (json.title) {
            finalPreview = {
              'og:title': json.title,
              'og:description': json.author_name ? `YouTube Video by ${json.author_name}` : 'YouTube Video',
              'og:image': json.thumbnail_url || `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`
            };
          }
        } catch (e) {
          console.warn("Noembed fallback failed:", e);
        }
      }

      // 2. Try Matrix built-in preview for remaining metadata or non-youtube links
      if (!finalPreview['og:title']) {
        const data = await client.getUrlPreview(url, Date.now());
        if (data) {
          finalPreview = { ...finalPreview, ...data };
        }
      }

      // 3. Final sanitization/formatting
      if (ytId) {
        // Ensure we don't have a generic title if we have an ID
        if (!finalPreview['og:title'] || finalPreview['og:title'] === 'YouTube') {
          finalPreview['og:title'] = `YouTube Video (${ytId})`;
        }
        if (!finalPreview['og:image']) {
          finalPreview['og:image'] = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
        }
      }

      if (finalPreview && (finalPreview['og:title'] || finalPreview['og:description'] || finalPreview['og:image'])) {
        setPreview(finalPreview);
      } else {
        setError(true);
      }
    } catch (e) {
      console.warn("Failed to fetch URL preview:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnter = () => {
    if (!showUrlPreviews || !isWhitelisted) return;
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left
      });
    }

    timerRef.current = window.setTimeout(() => {
      setShowPopup(true);
      fetchPreview();
    }, 500) as unknown as number;
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowPopup(false);
  };

  const popupContent = (
    <div 
      className="fixed z-[9999] w-80 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 pointer-events-none font-mono"
      style={{ 
        top: `${coords.top - 10}px`, 
        left: `${coords.left}px`,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="overflow-hidden rounded-xl border border-border-main bg-[#111214] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="bg-bg-nav/80 p-2 border-b border-border-main flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="h-3 w-3 text-green-500" />
            <span className="text-[9px] font-black uppercase text-text-muted tracking-widest">Secure Preview</span>
          </div>
          <ExternalLink className="h-3 w-3 text-text-muted" />
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center py-4 space-y-2">
              <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Fetching Metadata...</span>
            </div>
          ) : preview ? (
            <div className="space-y-3">
              {preview['og:image'] && (
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-border-main bg-black">
                  <img 
                    src={client?.mxcUrlToHttp(preview['og:image'], 320, 180, 'scale', true) || preview['og:image']} 
                    alt="" 
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight uppercase tracking-tighter">
                  {preview['og:title'] || preview['title']}
                </h4>
                <p className="text-[10px] text-text-muted line-clamp-3 leading-normal font-medium italic">
                  {preview['og:description'] || preview['description']}
                </p>
              </div>
              <div className="text-[8px] font-mono text-accent-primary truncate opacity-60">
                {url}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center">
              <span className="text-[10px] text-text-muted italic">No preview metadata available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <span 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showPopup && isWhitelisted && createPortal(popupContent, document.body)}
    </span>
  );
};
