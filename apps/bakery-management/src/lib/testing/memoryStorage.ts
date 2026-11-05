/**
 * Für Specs: macht aus den jest.fn()-Attrappen von `localStorage`
 * (test-setup.ts) einen echten Speicher im Arbeitsspeicher.
 */
export function useMemoryStorage(): Map<string, string> {
  const data = new Map<string, string>()
  const store = window.localStorage as unknown as {
    getItem: jest.Mock
    setItem: jest.Mock
    removeItem: jest.Mock
    clear: jest.Mock
  }
  store.getItem.mockImplementation((key: string) =>
    data.has(key) ? data.get(key) : null
  )
  store.setItem.mockImplementation((key: string, value: string) => {
    data.set(key, String(value))
  })
  store.removeItem.mockImplementation((key: string) => {
    data.delete(key)
  })
  store.clear.mockImplementation(() => data.clear())
  return data
}
