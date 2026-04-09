const MAX_EDGE = 2000;
const MIN_DIMENSION = 200;
const OUTPUT_QUALITY = 0.85;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ProcessedImage {
  dataUri: string;
  width: number;
  height: number;
  originalSize: number;
  fileName: string;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Image exceeds 20MB limit.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (img.width < MIN_DIMENSION && img.height < MIN_DIMENSION) {
        reject(new Error(`Image too small (${img.width}x${img.height}). Minimum ${MIN_DIMENSION}px on at least one side.`));
        return;
      }

      let { width, height } = img;
      if (width > MAX_EDGE || height > MAX_EDGE) {
        const scale = MAX_EDGE / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUri = canvas.toDataURL(outputType, OUTPUT_QUALITY);

      resolve({ dataUri, width, height, originalSize: file.size, fileName: file.name });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. The file may be corrupted.'));
    };

    img.src = url;
  });
}

export function getFilesFromDragEvent(e: React.DragEvent): File[] {
  const files: File[] = [];
  if (e.dataTransfer.items) {
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      if (e.dataTransfer.items[i].kind === 'file') {
        const file = e.dataTransfer.items[i].getAsFile();
        if (file) files.push(file);
      }
    }
  } else {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      files.push(e.dataTransfer.files[i]);
    }
  }
  return files;
}
