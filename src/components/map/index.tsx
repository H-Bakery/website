import { Box, Typography, Divider, Button  } from '@mui/material'
import React from 'react'
import GoogleMapReact from 'google-map-react';
import Info from './Info';

const AnyReactComponent = ({ text }: any) => <h1>{text}</h1>;

const ZEITEN = [
  {
    label: 'Mo, Di, Do, Fr',
    value: '05:00 - 12:00 Uhr, 14:00 - 17:00 Uhr',
  },
  {
    label: 'Sa',
    value: '05:00 - 12:00 Uhr, 14:00 - 17:00 Uhr',
  },
  {
    label: 'Mi, So',
    value: 'Ruhetag (geschlossen)',
  },
]

const Map: React.FC = () => {
  const defaultProps = {
    center: {
      lat: 49.30107377123533,
      lng: 7.369370264295438
    },
    zoom: 18
  };

  return (
    <Box sx={styles.section}>
      <Box sx={styles.map}>
        <GoogleMapReact
          bootstrapURLKeys={{ key: "AIzaSyAqcU5e900koplaN_FRB_b8v2Iw44KoK4s" }}
          defaultCenter={defaultProps.center}
          defaultZoom={defaultProps.zoom}
        >
          <AnyReactComponent
            lat={49.301429495245586}
            lng={7.369493502873482}
            text="Bäckerei Heusser"
          />
        </GoogleMapReact>
      </Box>
      <Box sx={styles.info}>
        <Typography variant='h6' gutterBottom>
          Öffnungszeiten
        </Typography>
        {ZEITEN.map((item) => (
          <Info key={item.label} {...item} />
        ))}
        <Divider sx={{ my: 2 }} />
        <Typography variant='h6' gutterBottom>
          Adresse
        </Typography>
        <Typography fontWeight='bold'>
          Eckstraße 3
        </Typography>
        <Typography>
          66424 Homburg
        </Typography>
        <Typography>
          Deutschland
        </Typography>
        <Button sx={{ mt: 2 }} fullWidth variant='contained'>
          Karte anzeigen
        </Button>
        <Divider sx={{ my: 2 }} />
        <Typography variant='h6' gutterBottom>
          Kontakt
        </Typography>
        <Typography>
          06841 2229
        </Typography>
        <Typography>
          01522 6621236
        </Typography>
        <Button sx={{ mt: 2 }} fullWidth variant='contained'>
          Anrufen
        </Button>
        <Button sx={{ mt: 2 }} fullWidth variant='contained'>
          Bestellen
        </Button>
      </Box>
    </Box>
  );
}

const styles = {
  section: {
    height: '100vh',
    width: '100%',
    position: 'relative'
  },
  map: {
    position: 'absolute',
    zIndex: 1,
    height: '100vh',
    width: '100%',
  },
  info: {
    position: 'absolute',
    zIndex: 2,
    top: 120,
    left: 40,
    bgcolor: 'background.paper',
    boxShadow: 1,
    borderRadius: '8px',
    p: 3,
  }
}

export default Map