// Type RÉEL d'un fichier d'après ses premiers octets : on ne fait jamais confiance au nom ni au Content-Type.
const starts = (b, sig, off = 0) => sig.every((v, i) => b[off + i] === v);
export function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: 'png', group: 'image' };
  if (starts(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg', group: 'image' };
  if (starts(buf, [0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', ext: 'gif', group: 'image' };
  if (starts(buf, [0x52, 0x49, 0x46, 0x46]) && starts(buf, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: 'image/webp', ext: 'webp', group: 'image' };
  if (starts(buf, [0x25, 0x50, 0x44, 0x46])) return { mime: 'application/pdf', ext: 'pdf', group: 'document' };
  if (starts(buf, [0x66, 0x74, 0x79, 0x70], 4)) return { mime: 'video/mp4', ext: 'mp4', group: 'video' };
  if (starts(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', ext: 'webm', group: 'video' };
  if (starts(buf, [0x50, 0x4b, 0x03, 0x04])) return { mime: 'application/zip', ext: 'docx', group: 'document' };
  if (starts(buf, [0xd0, 0xcf, 0x11, 0xe0])) return { mime: 'application/msword', ext: 'doc', group: 'document' };
  return null;
}
export const LIMITS_MB = { IMAGE: 5, VIDEO: 30, DOCUMENT: 10 };
export const GROUP_OF_KIND = { IMAGE: 'image', VIDEO: 'video', DOCUMENT: 'document' };
export function checkFile(kind, buf, size = buf.length) {
  const s = sniff(buf);
  if (!s || s.group !== GROUP_OF_KIND[kind]) return { error: 'Le contenu du fichier ne correspond pas au type de livrable choisi.' };
  if (size > LIMITS_MB[kind] * 1048576) return { error: `Fichier trop lourd (maximum ${LIMITS_MB[kind]} Mo).` };
  return { type: s };
}
// Types acceptés pour un dépôt direct (le type réel est ensuite revérifié d'après les octets du fichier déposé).
export const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'docx', 'application/vnd.ms-powerpoint': 'doc' };
export const kindOfMime = (m) => (/^image\//.test(m) ? 'IMAGE' : /^video\//.test(m) ? 'VIDEO' : MIME_EXT[m] ? 'DOCUMENT' : null);
