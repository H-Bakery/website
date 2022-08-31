import { Box, Container, Typography } from "@mui/material";
import React from "react";
import { EventInput } from '@fullcalendar/react'

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";

// import "../../../node_modules/@fullcalendar/common/main.css";

// import "@fullcalendar/core/main.css";
// import "@fullcalendar/daygrid/main.css";

// import "@fullcalendar/core/main.css";
// import "@fullcalendar/daygrid/main.css";

const Calendar: React.FC = () => {
  const events: EventInput[] = [
    {
      title: "event 2",
      start: "2022-08-27",
      end: "2022-08-27",
      allDay: true,
      HostName: "William",
    },
    {
      title: "event 2",
      start: "2022-08-28",
      end: "2022-08-28",
      allDay: true,
      HostName: "William",
    },
    {
      title: "event 2",
      start: "2022-27-08",
      end: "2022-27-08",
      allDay: true,
      HostName: "William",
    },
  ];

  return (
    <div>
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
        contentHeight={"450px"}
        locale={"de"}
        firstDay={1}

      />
    </div>
  );
};

export default Calendar;
