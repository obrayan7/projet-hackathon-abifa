// URL de destination : https uniquement, sans identifiants intégrés, sans hôte local ou privé.
export function safeHttpsUrl(input) {
  try {
    const u = new URL(String(input).trim());
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '[::1]') return null;
    return u.toString();
  } catch { return null; }
}
