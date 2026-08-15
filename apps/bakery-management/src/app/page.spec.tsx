import RootPage from './page'

const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

describe('Management RootPage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('redirects to the admin dashboard', () => {
    RootPage()
    expect(mockRedirect).toHaveBeenCalledWith('/admin')
  })
})
