function normalizeBlobPart(content: string | ArrayBuffer | Uint8Array<ArrayBufferLike>): string | ArrayBuffer {
  if (typeof content === 'string' || content instanceof ArrayBuffer) {
    return content;
  }

  const copy = new Uint8Array(content.byteLength);
  copy.set(content);

  return copy.buffer;
}

export function downloadFile(
  content: string | ArrayBuffer | Uint8Array<ArrayBufferLike>,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([normalizeBlobPart(content)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
