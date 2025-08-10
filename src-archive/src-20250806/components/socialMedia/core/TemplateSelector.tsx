import React, { useState } from 'react'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Button,
  ButtonGroup,
  Typography,
  useTheme,
} from '@mui/material'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import CampaignIcon from '@mui/icons-material/Campaign'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import WebIcon from '@mui/icons-material/Web'
import CropFreeIcon from '@mui/icons-material/CropFree'
import { TemplateType } from '../../../types/socialMedia'

interface TemplateSelectorProps {
  value: TemplateType
  onChange: (type: TemplateType) => void
}

type PlatformCategory = 'classic' | 'social' | 'website'

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  value,
  onChange,
}) => {
  const theme = useTheme()

  // Determine current platform based on selected template
  const getCurrentPlatform = (templateType: TemplateType): PlatformCategory => {
    if (
      [
        'facebook-post',
        'instagram-square',
        'instagram-story',
        'simple-square',
      ].includes(templateType)
    ) {
      return 'social'
    }
    if (['website-banner', 'website-card'].includes(templateType)) {
      return 'website'
    }
    return 'classic'
  }

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformCategory>(
    getCurrentPlatform(value)
  )

  const handleChange = (_: React.SyntheticEvent, newValue: TemplateType) => {
    onChange(newValue)
  }

  const handlePlatformChange = (platform: PlatformCategory) => {
    setSelectedPlatform(platform)
    // Auto-select first template of the platform
    if (platform === 'classic') {
      onChange('daily-special')
    } else if (platform === 'social') {
      onChange('facebook-post')
    } else if (platform === 'website') {
      onChange('website-banner')
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        mb: 4,
        borderRadius: 2,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {/* Platform Category Selector */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="subtitle1"
          sx={{ mb: 2, color: 'text.secondary', fontWeight: 500 }}
        >
          Template-Kategorie
        </Typography>
        <ButtonGroup variant="outlined" size="large" sx={{ mb: 2 }}>
          <Button
            variant={selectedPlatform === 'classic' ? 'contained' : 'outlined'}
            onClick={() => handlePlatformChange('classic')}
            startIcon={<RestaurantIcon />}
            sx={{ px: 3 }}
          >
            Klassisch
          </Button>
          <Button
            variant={selectedPlatform === 'social' ? 'contained' : 'outlined'}
            onClick={() => handlePlatformChange('social')}
            startIcon={<FacebookIcon />}
            sx={{ px: 3 }}
          >
            Social Media
          </Button>
          <Button
            variant={selectedPlatform === 'website' ? 'contained' : 'outlined'}
            onClick={() => handlePlatformChange('website')}
            startIcon={<WebIcon />}
            sx={{ px: 3 }}
          >
            Website
          </Button>
        </ButtonGroup>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {selectedPlatform === 'classic' &&
            'Traditionelle Bäckerei-Templates für allgemeine Verwendung'}
          {selectedPlatform === 'social' &&
            'Optimiert für Facebook und Instagram'}
          {selectedPlatform === 'website' &&
            'Banner und Karten für Ihre Website'}
        </Typography>
      </Box>

      {/* Template Tabs for Selected Platform */}
      <Tabs
        value={value}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="content template types"
        TabIndicatorProps={{
          sx: {
            backgroundColor: 'primary.main',
            height: 3,
          },
        }}
      >
        {selectedPlatform === 'classic' && [
          <Tab
            key="daily-special"
            icon={<RestaurantIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Tagesangebot"
            value="daily-special"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="bread-of-day"
            icon={<BakeryDiningIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Brot des Tages"
            value="bread-of-day"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="offer"
            icon={<NewReleasesIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Angebote"
            value="offer"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="bakery-news"
            icon={<CampaignIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Bäckerei News"
            value="bakery-news"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="message"
            icon={<TextFieldsIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Einfache Nachricht"
            value="message"
            sx={{ minHeight: '60px' }}
          />,
        ]}

        {selectedPlatform === 'social' && [
          <Tab
            key="facebook-post"
            icon={<FacebookIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Facebook Post"
            value="facebook-post"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="instagram-square"
            icon={<InstagramIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Instagram Post"
            value="instagram-square"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="instagram-story"
            icon={<InstagramIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Instagram Story"
            value="instagram-story"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="simple-square"
            icon={<CropFreeIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Simple Square"
            value="simple-square"
            sx={{ minHeight: '60px' }}
          />,
        ]}

        {selectedPlatform === 'website' && [
          <Tab
            key="website-banner"
            icon={<WebIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Hero Banner"
            value="website-banner"
            sx={{ minHeight: '60px' }}
          />,
          <Tab
            key="website-card"
            icon={<WebIcon sx={{ mr: 1 }} />}
            iconPosition="start"
            label="Produkt Karte"
            value="website-card"
            sx={{ minHeight: '60px' }}
          />,
        ]}
      </Tabs>
    </Paper>
  )
}

export default TemplateSelector
