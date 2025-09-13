'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Global error boundaries in Next.js App Router must include html and body tags
  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <h1
            style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: '#dc2626',
            }}
          >
            Ein Fehler ist aufgetreten
          </h1>
          <p
            style={{
              marginBottom: '2rem',
              color: '#6b7280',
              maxWidth: '400px',
            }}
          >
            Entschuldigen Sie die Unannehmlichkeiten. Ein unerwarteter Fehler
            ist aufgetreten.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  )
}
