import React from 'react'
import { Typography, Box, Paper, Rating, Avatar, Divider } from '@mui/material'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'

interface Props {
  name: string
  stars: number
  text: string
  avatar?: string
  date?: string
}

const TestimonialCard: React.FC<Props> = (props) => {
  const { name, stars, text, avatar, date } = props

  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRadius: 2,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      {/* Decorative quote mark */}
      <FormatQuoteIcon
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          fontSize: 40,
          color: 'primary.light',
          opacity: 0.2,
        }}
        aria-hidden="true"
      />

      {/* Accessible star rating */}
      <Box sx={{ mb: 2 }}>
        <Rating
          value={stars}
          readOnly
          precision={0.5}
          aria-label={`Bewertung: ${stars} von 5 Sternen`}
        />
      </Box>

      {/* Testimonial content - Fixed unescaped quotes */}
      <Typography
        variant="body1"
        color="text.primary"
        paragraph
        sx={{
          mb: 'auto',
          fontStyle: 'italic',
          lineHeight: 1.6,
          position: 'relative',
          zIndex: 1,
        }}
      >
        &ldquo;{text}&rdquo;
      </Typography>

      <Divider sx={{ my: 2 }} />

      {/* Customer information */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Avatar
          src={avatar}
          alt={name}
          sx={{
            width: 48,
            height: 48,
            mr: 2,
            bgcolor: avatar ? 'transparent' : 'primary.main',
          }}
        >
          {!avatar && name.charAt(0)}
        </Avatar>

        <Box>
          <Typography variant="subtitle1" fontWeight="bold" component="p">
            {name}
          </Typography>
          {date && (
            <Typography variant="caption" color="text.secondary" component="p">
              {date}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  )
}

export default TestimonialCard
