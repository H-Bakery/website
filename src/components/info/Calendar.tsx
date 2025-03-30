'use client'
import React from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { EventInput } from '@fullcalendar/core' // Make sure to import this

export default function Calendar() {
  // Properly type the events array as EventInput[]
  const events: EventInput[] = [
    {
      title: 'event 2',
      start: '2022-08-29',
      end: '2022-09-03',
      allDay: true,
      extendedProps: {
        HostName: 'Some host name',
      },
    },
    // Add more events as needed
  ]

  return (
    <FullCalendar
      plugins={[dayGridPlugin]}
      initialView="dayGridMonth"
      events={events}
      height="auto"
    />
  )
}
