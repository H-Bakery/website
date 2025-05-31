import React from 'react'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Chip,
  useTheme,
} from '@mui/material'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import BakeryDiningIcon from '@mui/icons-material/BakeryDining'
import NewReleasesIcon from '@mui/icons-material/NewReleases'
import CampaignIcon from '@mui/icons-material/Campaign'
import { TemplateType } from '../../../types/socialMedia'

interface TemplateSelectorProps {
  value: TemplateType
  onChange: (type: TemplateType) => void
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ value, onChange }) => {
  const theme = useTheme()

  const handleChange = (_: React.SyntheticEvent, newValue: TemplateType) => {
    onChange(newValue)
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
        <Tab
          icon={<RestaurantIcon sx={{ mr: 1 }} />}
          iconPosition="start"
          label="Tagesangebot"
          value="daily-special"
          sx={{ minHeight: '60px' }}
        />
        <Tab
          icon={<BakeryDiningIcon sx={{ mr: 1 }} />}
          iconPosition="start"
          label="Brot des Tages"
          value="bread-of-day"
          sx={{ minHeight: '60px' }}
        />
        <Tab
          icon={<NewReleasesIcon sx={{ mr: 1 }} />}
          iconPosition="start"
          label="Angebote"
          value="offer"
          sx={{ minHeight: '60px' }}
        />
        <Tab
          icon={<CampaignIcon sx={{ mr: 1 }} />}
          iconPosition="start"
          label="Bäckerei News"
          value="bakery-news"
          sx={{ minHeight: '60px' }}
        />
      </Tabs>
    </Paper>
  )
}

export default TemplateSelector