import { Box, Container, Typography } from '@mui/material'
import React from 'react'
// @ts-ignore
import ReactWeather, { useVisualCrossing } from 'react-open-weather'

const Weather: React.FC = () => {
  const { data, isLoading, errorMessage } = useVisualCrossing({
    key: 'GKURCMTJ2FMZRGF7DHG7JFWEA',
    lat: '49.30107377123533',
    lon: '7.369370264295438',
    lang: 'de',
    unit: 'metric', // values are (metric,us,uk)
  })

  return (
    <Box
      sx={{
        '& .rw-container': {
          fontFamily: 'Ubuntu',
        },
        '& .rw-container-header': {
          fontWeight: 'bold !important',
          mb: '0px !important',
        },
        '& .rw-today-date': {
          fontWeight: 'bold !important',
        },
      }}
    >
      <ReactWeather
        isLoading={isLoading}
        errorMessage={errorMessage}
        data={data}
        lang="de"
        locationLabel="Kirrberg"
        unitsLabels={{ temperature: 'C', windSpeed: 'Km/h' }}
        showForecast
      />
    </Box>
  )
}

export default Weather
