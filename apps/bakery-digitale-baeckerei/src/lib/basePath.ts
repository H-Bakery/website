/**
 * Basis-Pfad des Exports (leer oder z. B. `/digitale-baeckerei`), von
 * next.config.js aus DIGITALE_BAECKEREI_BASE_PATH durchgereicht. Dateien aus
 * public/ lädt die App per fetch - Next hängt den Pfad dort nicht selbst an.
 */
export const BASE_PATH: string =
  process.env.NEXT_PUBLIC_DIGITALE_BAECKEREI_BASE_PATH ?? ''

/** URL einer Datei aus public/model/ (von scripts/sync-model.mjs geladen). */
export function modelUrl(file: string, basePath: string = BASE_PATH): string {
  return `${basePath}/model/${file}`
}
