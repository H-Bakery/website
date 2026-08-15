import { redirect } from 'next/navigation'

/**
 * The management app has no public landing page – everything lives under
 * `/admin`, which provides the sidebar layout. Send visitors straight there.
 */
export default function RootPage() {
  redirect('/admin')
}
