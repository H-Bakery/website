import UsersClient from './UsersClient'

export const metadata = {
  title: 'Benutzer - Bäckerei Heusser',
}

/** Benutzer und Stationen verwalten (F1) - nur Inhaber, siehe ROLE_ACCESS. */
export default function UsersPage() {
  return <UsersClient />
}
