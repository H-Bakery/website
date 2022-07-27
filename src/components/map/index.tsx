import { Box } from '@mui/material'
import React from 'react'
import GoogleMapReact from 'google-map-react';

const AnyReactComponent = ({ text }: any) => <h1>{text}</h1>;


const Map: React.FC = () => {
  const defaultProps = {
    // 49.30107377123533, 7.369370264295438
    center: {
      lat: 49.30107377123533,
      lng: 7.369370264295438
    },
    zoom: 18
  };

  return (
    // Important! Always set the container height explicitly
    <div style={{ height: '100vh', width: '100%' }}>
      <GoogleMapReact
        bootstrapURLKeys={{ key: "AIzaSyAqcU5e900koplaN_FRB_b8v2Iw44KoK4s" }}
        defaultCenter={defaultProps.center}
        defaultZoom={defaultProps.zoom}
      >
        <AnyReactComponent
        // 49.301429495245586, 7.369493502873482
          lat={49.301429495245586}
          lng={7.369493502873482}
          text="Bäckerei Heusser"
        />
      </GoogleMapReact>
    </div>
  );
}

const styles = {
  map: {},
  info: {}
}

export default Map