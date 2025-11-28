import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';

import { useCurrentUser } from "./useCurrentUser";
import { useBlossomServers } from "./useBlossomServers";

/** Map of file extensions to MIME types for common audio/video formats */
const MIME_TYPE_MAP: Record<string, string> = {
  // Audio
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  // Video
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  // Documents
  '.json': 'application/json',
  '.srt': 'text/srt',
  '.vtt': 'text/vtt',
};

/**
 * Ensure file has correct MIME type.
 * Some browsers don't detect MIME types correctly, especially for audio files.
 * This creates a new File with the correct type if needed.
 */
function ensureCorrectMimeType(file: File): File {
  // If file already has a valid type, return as-is
  if (file.type && file.type !== 'application/octet-stream') {
    return file;
  }

  // Get extension from filename
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext) {
    return file;
  }

  const correctType = MIME_TYPE_MAP[ext];
  if (!correctType) {
    return file;
  }

  console.log(`Correcting MIME type for ${file.name}: "${file.type}" -> "${correctType}"`);

  // Create new File with correct type
  return new File([file], file.name, { type: correctType });
}

export function useUploadFile() {
  const { user } = useCurrentUser();
  const { allServers } = useBlossomServers();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('Must be logged in to upload files');
      }

      // Ensure file has correct MIME type
      const correctedFile = ensureCorrectMimeType(file);

      console.log('Starting file upload:', correctedFile.name, correctedFile.size, correctedFile.type);

      console.log('Using Blossom servers:', allServers);

      const uploader = new BlossomUploader({
        servers: allServers,
        signer: user.signer,
      });

      try {
        const tags = await uploader.upload(correctedFile);
        console.log('Upload successful, tags:', tags);
        return tags;
      } catch (error) {
        console.error('Upload failed:', error);
        throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
  });
}