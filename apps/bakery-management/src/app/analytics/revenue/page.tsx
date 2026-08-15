import { redirect } from 'next/navigation'

/** Legacy route – moved under the admin layout. */
export default function LegacyRedirectPage() {
  redirect('/admin/analytics/revenue')
}
