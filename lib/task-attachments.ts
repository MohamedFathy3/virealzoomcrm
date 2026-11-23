export type TaskAttachment = { id: string; name: string; mimeType: string; url: string };

export function getTaskAttachments(value: unknown, taskId: string): TaskAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const file = item as Record<string, unknown>;
    if (typeof file.id !== 'string' || typeof file.name !== 'string' || typeof file.mimeType !== 'string') return [];
    if (file.mimeType !== 'text/uri-list') {
      return [{ id: file.id, name: file.name, mimeType: file.mimeType, url: `/api/tasks/${taskId}/files/${file.id}` }];
    }
    if (typeof file.url !== 'string') return [];
    try {
      const url = new URL(file.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return [];
      return [{ id: file.id, name: file.name, mimeType: file.mimeType, url: url.toString() }];
    } catch {
      return [];
    }
  });
}
