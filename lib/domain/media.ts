export interface FileLike {
  name: string;
  type: string;
  size: number;
}

const ALLOWED_POST_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_POST_IMAGES = 6;
const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;

export function validatePostImages(files: readonly FileLike[]): void {
  if (files.length > MAX_POST_IMAGES) {
    throw new Error('Mỗi bài đăng chỉ được đính kèm tối đa 6 ảnh.');
  }

  for (const file of files) {
    if (!ALLOWED_POST_IMAGE_TYPES.has(file.type)) {
      throw new Error('Ảnh đính kèm phải là JPEG, PNG hoặc WebP.');
    }

    if (file.size <= 0 || file.size > MAX_POST_IMAGE_BYTES) {
      throw new Error('Mỗi ảnh phải lớn hơn 0 byte và không vượt quá 10 MB.');
    }
  }
}

export function safeStorageFileName(fileName: string): string {
  const normalized = fileName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized.slice(0, 120) || 'image';
}
