// Adresse der Bäckerei-API, beim Build eingebacken (`NEXT_PUBLIC_API_URL`).
// Eigene Datei, damit `session.ts` und `delivery-api.ts` sie teilen, ohne sich
// gegenseitig zu importieren.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:5000'
