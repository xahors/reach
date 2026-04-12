import { useState } from 'react';
import { MsgType, MatrixClient } from 'matrix-js-sdk';
import { encryptFile } from '../utils/media';

export const useFileUpload = (client: MatrixClient | null, roomId: string) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File) => {
    if (!file || !client) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const isEncrypted = client.isRoomEncrypted(roomId);
      const content: Record<string, unknown> = {
        body: file.name,
        info: {
          size: file.size,
          mimetype: file.type,
          filename: file.name,
        }
      };

      // Determine msgtype
      if (file.type.startsWith('image/')) {
        content.msgtype = MsgType.Image;
      } else if (file.type.startsWith('video/')) {
        content.msgtype = MsgType.Video;
      } else if (file.type.startsWith('audio/')) {
        content.msgtype = MsgType.Audio;
      } else {
        content.msgtype = MsgType.File;
      }

      if (isEncrypted) {
        // Encrypt file
        const { buffer, info } = await encryptFile(file);
        const uploadResult = await client.uploadContent(new Blob([buffer]), {
          name: file.name,
          type: 'application/octet-stream',
          progressHandler: (progress) => {
            if (progress.total) {
              setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
            }
          }
        }) as unknown as string | { content_uri: string };
        
        const mxcUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult.content_uri;

        content.file = {
          ...info,
          url: mxcUrl,
        };
      } else {
        // Unencrypted upload
        const uploadResult = await client.uploadContent(file, {
          name: file.name,
          type: file.type,
          progressHandler: (progress) => {
            if (progress.total) {
              setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
            }
          }
        }) as unknown as string | { content_uri: string };

        const mxcUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult.content_uri;
        console.log("Upload success, mxcUrl:", mxcUrl);

        content.url = mxcUrl;
      }

      console.log("Sending message with content:", content);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.sendMessage(roomId, content as any);
    } catch (err) {
      console.error("Failed to upload file:", err);
      throw err;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploadFile,
    isUploading,
    uploadProgress
  };
};
