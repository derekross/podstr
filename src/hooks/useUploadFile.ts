import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';

import { useCurrentUser } from "./useCurrentUser";
import { useBlossomServers } from "./useBlossomServers";

/** Maximum file size: 2GB for audio/video, enforced before upload */
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

/** Allowed file extensions for upload (SVG intentionally excluded - can contain embedded scripts) */
const ALLOWED_EXTENSIONS = new Set([
  // Audio
  '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.wav', '.flac', '.opus', '.webm',
  // Video
  '.mp4', '.m4v', '.mov', '.avi', '.mkv',
  // Images (no SVG - XSS risk)
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  // Documents
  '.json', '.srt', '.vtt',
]);

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
  // Images (SVG intentionally excluded - can contain embedded JavaScript)
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
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

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024 * 1024))}GB.`);
      }

      // Validate file type
      const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
      if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
        throw new Error(`File type "${ext}" is not allowed. SVG files are blocked for security reasons.`);
      }

      // Ensure file has correct MIME type
      const correctedFile = ensureCorrectMimeType(file);

      console.log('Starting file upload:', correctedFile.name, correctedFile.size, correctedFile.type);

      console.log('Using Blossom servers:', allServers);

      const uploader = new BlossomUploader({
        servers: allServers,
        signer: user.signer,
        // Default expiresIn is 60s which is too short for large audio/video files.
        // SHA-256 hashing + upload can easily exceed 60s for podcast episodes.
        // Increased to 30 minutes to support large podcast episodes and slow connections.
        expiresIn: 1_800_000, // 30 minutes
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