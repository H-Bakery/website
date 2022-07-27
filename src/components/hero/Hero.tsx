import { Box } from '@mui/material';
import React from 'react'
import Baeckerei from '../icons/Baeckerei';
import Wappen from '../icons/Wappen';

const Hero: React.FC = () => (
  <Box sx={styles.hero}>
    <Box sx={styles.logo}>
      <Wappen />
      <Baeckerei />
    </Box>
    <Box sx={styles.overlay} />
    <video
      className='video'
      id="background-video"
      autoPlay
      muted
      loop
    >
      <source src="/assets/images/stock/bg_video.mp4" type="video/mp4" />
      <source src="/assets/images/stock/bg_video.mp4" type="video/ogg" />
      Your browser does not support the video tag.
    </video>
  </Box>
);

export { Hero };

const styles = {
  hero: {
    height: '100vh',
    widht: '100%',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',

    '& .video': {
      position: 'absolute',
      width: '100%',
      height: '100vh',
      objectFit: 'cover',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: -1,
    }
  },
  logo: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: 'white'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100vh',
    bgcolor: 'rgba(0,0,0,0.5)'
  }
}
