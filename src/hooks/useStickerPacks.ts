import { useState, useEffect } from 'react';
import { ClientEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export interface Sticker {
  url: string;
  body: string;
  info?: {
    w?: number;
    h?: number;
    mimetype?: string;
    size?: number;
  };
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}

export const useStickerPacks = () => {
  const client = useMatrixClient();
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;

    const fetchPacks = () => {
      const allPacks: StickerPack[] = [];

      // 1. Check Global Account Data (MSC2545 / im.ponies.user_emojis)
      // @ts-expect-error: im.ponies.user_emojis is not in stable EventType
      const globalEmojiPack = client.getAccountData('im.ponies.user_emojis');
      if (globalEmojiPack) {
        const content = globalEmojiPack.getContent();
        if (content.images) {
          const stickers: Sticker[] = Object.entries(content.images as Record<string, Sticker>).map(([shortcode, data]) => ({
            url: data.url,
            body: data.body || shortcode,
            info: data.info
          }));
          
          if (stickers.length > 0) {
            allPacks.push({
              id: 'global_emoji',
              name: content.pack?.name || 'Global Stickers',
              stickers
            });
          }
        }
      }

      // 2. Check for m.image_pack in account data
      // @ts-expect-error: m.image_pack is not in stable EventType
      const mImagePack = client.getAccountData('m.image_pack');
      if (mImagePack) {
        const content = mImagePack.getContent();
        if (content.images) {
          const stickers: Sticker[] = Object.entries(content.images as Record<string, Sticker>).map(([shortcode, data]) => ({
            url: data.url,
            body: data.body || shortcode,
            info: data.info
          }));
          
          if (stickers.length > 0) {
            allPacks.push({
              id: 'm_image_pack',
              name: content.pack?.name || 'Image Pack',
              stickers
            });
          }
        }
      }

      // 3. Check for room-specific packs (MSC2545)
      client.getRooms().forEach(room => {
        const roomPack = room.getAccountData('im.ponies.user_emojis');
        if (roomPack) {
          const content = roomPack.getContent();
          if (content.images) {
            const stickers: Sticker[] = Object.entries(content.images as Record<string, Sticker>).map(([shortcode, data]) => ({
              url: data.url,
              body: data.body || shortcode,
              info: data.info
            }));
            
            if (stickers.length > 0) {
              allPacks.push({
                id: `room_${room.roomId}`,
                name: content.pack?.name || `Pack from ${room.name}`,
                stickers
              });
            }
          }
        }
      });

      setPacks(allPacks);
      setLoading(false);
    };

    fetchPacks();
    client.on(ClientEvent.AccountData, fetchPacks);

    return () => {
      client.removeListener(ClientEvent.AccountData, fetchPacks);
    };
  }, [client]);

  return { packs, loading };
};
