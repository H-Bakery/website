import React from 'react'
import { EventInput } from '@fullcalendar/react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import { Box } from '@mui/material'

const Calendar: React.FC = () => {
  const events: EventInput[] = [
    {
      title: 'event 2',
      start: '2022-08-29',
      end: '2022-09-03',
      allDay: true,
      HostName: 'William',
    },
    {
      title: 'Öffnungszeiten sind ganz anders und ich will testen wie lang',
      start: '2022-09-01',
      end: '2022-09-01',
      allDay: true,
      HostName: 'William',
      color: '#2e2e2e',
    },
    {
      title: 'event 2',
      start: '2022-09-03',
      end: '2022-09-03',
      allDay: true,
      HostName: 'William',
    },
  ]

  return (
    <Box
      sx={{
        '& .fc-view-harness': {
          bgcolor: 'background.paper',
          borderRadius: '12px',
          boxShadow: 1,
          overflow: 'hidden',
        },
        '& table.fc-scrollgrid': {
          border: 'none',
        },
        '& tbody td': {
          borderBottom: 'none',
        },
        '& thead .fc-scrollgrid-sync-inner': {
          height: 50,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontSize: 20,
        },
      }}
    >
      <FullCalendar
        // initialView="dayGridMonth"
        // eventClick={(event) => {}}
        // select={this.handleSelectedDates}
        // eventLimit={3}
        initialView="dayGridWeek"
        displayEventTime={true}
        headerToolbar={false}
        selectable={true}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialEvents={events}
        contentHeight="455px"
        locale={'de'}
        firstDay={1}
      />
    </Box>
  )
}

export default Calendar
