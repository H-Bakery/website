import React from 'react';
import { Box, Typography, Container } from '@mui/material';

interface HeroProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const Hero: React.FC<HeroProps> = ({ title, subtitle, children }) => {
  return (
    <Box sx={{ py: 8, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        {title && (
          <Typography variant="h2" component="h1" gutterBottom>
            {title}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="h5" color="text.secondary" paragraph>
            {subtitle}
          </Typography>
        )}
        {children}
      </Container>
    </Box>
  );
};

export default Hero;