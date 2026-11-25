// Stockage privé Supabase Storage via son API REST (sans SDK). Module pur : la config et fetch sont injectés (testable).
// Pourquoi : sur Vercel une requête vers une fonction est limitée à 4,5 Mo. Les fichiers partent donc directement du navigateur
// vers Supabase (URL signée de dépôt) ; l'API ne reçoit que de petites requêtes JSON puis vérifie le fichier déposé.
export function supabaseStorage({ url, key, bucket, fetchImpl = fetch }) {
  const base = url.replace(/\/$/, '') + '/storage/v1';
  const auth = (extra = {}) => ({ Authorization: `Bearer ${key}`, apikey: key, ...extra });
  const rel = (u) => (u.startsWith('/') ? u : '/' + u).replace(/^\/storage\/v1/, '');
  return {
    /** URL signée pour déposer UN fichier à ce chemin (PUT), sans exposer la clé de service. */
    async uploadTarget(path) {
      const r = await fetchImpl(`${base}/object/upload/sign/${bucket}/${path}`, { method: 'POST', headers: auth({ 'content-type': 'application/json' }), body: '{}' });
      if (!r.ok) throw new Error('storage: signature de dépôt refusée (' + r.status + ')');
      return base + rel((await r.json()).url);
    },
    /** Premiers octets + taille totale du fichier déposé (sans le télécharger en entier). null si absent. */
    async inspect(path, n = 32) {
      const r = await fetchImpl(`${base}/object/${bucket}/${path}`, { headers: auth({ Range: `bytes=0-${n - 1}` }) });
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok && r.status !== 206) throw new Error('storage: lecture impossible (' + r.status + ')');
      const reader = r.body.getReader(), chunks = []; let got = 0;
      while (got < n) { const { done, value } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); got += value.length; }
      try { await reader.cancel(); } catch { /* flux déjà fermé */ }
      const cr = r.headers.get('content-range'), cl = r.headers.get('content-length');
      return { head: Buffer.concat(chunks).subarray(0, n), size: cr ? Number(cr.split('/')[1]) : Number(cl || got) };
    },
    async remove(path) { await fetchImpl(`${base}/object/${bucket}/${path}`, { method: 'DELETE', headers: auth() }); },
    /** URL de lecture signée à durée limitée (le fichier ne transite pas par l'API). */
    async downloadUrl(path, ttl = 600, downloadName) {
      const r = await fetchImpl(`${base}/object/sign/${bucket}/${path}`, { method: 'POST', headers: auth({ 'content-type': 'application/json' }), body: JSON.stringify({ expiresIn: ttl }) });
      if (!r.ok) throw new Error('storage: signature de lecture refusée (' + r.status + ')');
      const u = base + rel((await r.json()).signedURL);
      return downloadName ? u + (u.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(downloadName) : u;
    },
  };
}
