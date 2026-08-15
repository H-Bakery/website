import { redirect } from 'next/navigation'

/**
 * Legacy route: the planned "Archivierung verwalten" settings page never got
 * an implementation. Redirect to the notification archive so old links keep
 * working.
 */
export default function NotificationsArchivalRedirect() {
  redirect('/admin/notifications/archive')
}
