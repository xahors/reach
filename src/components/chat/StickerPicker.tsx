import React from 'react';
import { useStickerPacks, type Sticker } from '../../hooks/useStickerPacks';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { Loader2, Search } from 'lucide-react';

interface StickerPickerProps {
  onSelect: (sticker: Sticker) => void;
}

const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect }) => {
  const { packs, loading } = useStickerPacks();
  const client = useMatrixClient();
  const [searchTerm, setSearchBase] = React.useState('');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-discord-sidebar rounded-lg shadow-xl border border-discord-hover">
        <Loader2 className="h-8 w-8 animate-spin text-discord-accent" />
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center bg-discord-sidebar p-4 text-center rounded-lg shadow-xl border border-discord-hover">
        <p className="text-discord-text font-bold mb-2">No Stickers Found</p>
        <p className="text-discord-text-muted text-xs">Join rooms with sticker packs or add them to your account to see them here.</p>
      </div>
    );
  }

  const filteredStickers = packs.flatMap(p => p.stickers).filter(s => 
    s.body.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-80 w-72 flex-col bg-discord-sidebar rounded-lg shadow-xl border border-discord-hover overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="p-3 border-b border-discord-border">
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Search stickers..." 
            value={searchTerm}
            onChange={(e) => setSearchBase(e.target.value)}
            className="h-8 w-full rounded bg-discord-black px-2 py-1 pl-8 text-xs text-discord-text outline-none focus:ring-1 focus:ring-discord-accent transition-all"
            autoFocus
          />
          <Search className="absolute left-2 h-4 w-4 text-discord-text-muted" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
        {packs.map(pack => (
          <div key={pack.id} className="mb-4">
            <h3 className="px-2 mb-2 text-[10px] font-bold uppercase text-discord-text-muted tracking-wider">
              {pack.name}
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {pack.stickers.filter(s => s.body.toLowerCase().includes(searchTerm.toLowerCase())).map((sticker, idx) => {
                const httpUrl = client?.mxcUrlToHttp(sticker.url, 64, 64, 'scale', false, true);
                return (
                  <button
                    key={`${pack.id}-${idx}`}
                    onClick={() => onSelect(sticker)}
                    className="flex aspect-square items-center justify-center rounded p-1 transition hover:bg-discord-hover group"
                    title={sticker.body}
                  >
                    {httpUrl && (
                      <img 
                        src={httpUrl} 
                        alt={sticker.body} 
                        className="h-full w-full object-contain transition group-hover:scale-110" 
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        
        {searchTerm && filteredStickers.length === 0 && (
          <div className="flex h-full items-center justify-center text-discord-text-muted text-xs italic">
            No stickers matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPicker;
