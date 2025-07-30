import React from 'react'
import {
  Box,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  FormControl,
  FormHelperText,
  Chip,
  Stack,
  alpha,
  useTheme,
} from '@mui/material'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import EuroIcon from '@mui/icons-material/Euro'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { TemplateType } from '../../../types/socialMedia'
import { getTemplateConfig } from '../config/templateConfig'

interface SimpleContentFormProps {
  templateType: TemplateType
  values: {
    title: string
    description: string
    price?: string
    additionalInfo?: string
  }
  onChange: (fieldName: string, value: string) => void
}

const SimpleContentForm: React.FC<SimpleContentFormProps> = ({
  templateType,
  values,
  onChange,
}) => {
  const theme = useTheme()
  
  // Get template configuration
  const templateConfig = getTemplateConfig(templateType)
  
  // Legacy content configuration - will be replaced by templateConfig
  const contentConfig: Record<TemplateType, any> = {
    'daily-special': {
      titleLabel: 'Titel des Angebots',
      titlePlaceholder: 'z.B. Mittagstisch am Freitag',
      titleMaxLength: 30,
      descriptionLabel: 'Beschreibung',
      descriptionPlaceholder: 'z.B. Schnitzel mit Pommes und Salat',
      descriptionMaxLength: 160,
      showPrice: true,
      additionalInfoLabel: 'Verfügbarkeit',
      additionalInfoPlaceholder: 'z.B. Verfügbar von 11:30 - 14:00 Uhr',
      hideDescription: false
    },
    'bread-of-day': {
      titleLabel: 'Brotname',
      titlePlaceholder: 'z.B. Dinkel-Vollkornbrot',
      titleMaxLength: 30,
      descriptionLabel: 'Beschreibung',
      descriptionPlaceholder: 'z.B. Frisch gebacken mit regionalen Zutaten...',
      descriptionMaxLength: 180,
      showPrice: true,
      additionalInfoLabel: 'Zutaten',
      additionalInfoPlaceholder: 'z.B. Dinkelmehl, Wasser, Sauerteig, Salz',
      hideDescription: false
    },
    'offer': {
      titleLabel: 'Titel des Angebots',
      titlePlaceholder: 'z.B. Saisonale Spezialitäten',
      titleMaxLength: 30,
      descriptionLabel: 'Beschreibung',
      descriptionPlaceholder: 'z.B. Unsere herbstlichen Leckereien...',
      descriptionMaxLength: 200,
      showPrice: true,
      additionalInfoLabel: 'Gültigkeitszeitraum',
      additionalInfoPlaceholder: 'z.B. Nur für kurze Zeit erhältlich',
      hideDescription: false
    },
    'bakery-news': {
      titleLabel: 'Titel der Nachricht',
      titlePlaceholder: 'z.B. Neue Öffnungszeiten',
      titleMaxLength: 50,
      descriptionLabel: 'Nachrichteninhalt',
      descriptionPlaceholder: 'z.B. Ab nächster Woche haben wir auch sonntags für Sie geöffnet...',
      descriptionMaxLength: 250,
      showPrice: false,
      additionalInfoLabel: 'Gültigkeitsdatum',
      additionalInfoPlaceholder: 'z.B. Gültig ab 01.06.2024',
      hideDescription: false
    },
    'message': {
      titleLabel: 'Nachrichtentext',
      titlePlaceholder: 'z.B. Wir machen Urlaub!',
      titleMaxLength: 150,
      descriptionLabel: '',
      descriptionPlaceholder: '',
      descriptionMaxLength: 0,
      showPrice: false,
      additionalInfoLabel: 'Stil',
      additionalInfoPlaceholder: 'Lassen Sie leer für roten Hintergrund oder "white" für weißen Hintergrund',
      hideDescription: true
    },
    'facebook-post': {
      titleLabel: 'Post-Titel',
      titlePlaceholder: 'Heute im Angebot 🥖',
      titleMaxLength: 60,
      descriptionLabel: 'Post-Beschreibung',
      descriptionPlaceholder: 'Frisch gebackene Laugenbrezeln mit hausgemachter Butter...',
      descriptionMaxLength: 200,
      showPrice: true,
      additionalInfoLabel: 'Hashtags',
      additionalInfoPlaceholder: '#BäckereiHeusser #Laugenbrezeln #Regional',
      hideDescription: false
    },
    'instagram-square': {
      titleLabel: 'Post-Titel',
      titlePlaceholder: 'Fresh Daily Special ✨',
      titleMaxLength: 40,
      descriptionLabel: 'Kurze Beschreibung',
      descriptionPlaceholder: 'Handcrafted with love 💕',
      descriptionMaxLength: 80,
      showPrice: true,
      additionalInfoLabel: 'Hashtags',
      additionalInfoPlaceholder: '#freshbaked #dailyspecial #handcrafted',
      hideDescription: false
    },
    'instagram-story': {
      titleLabel: 'Story-Titel',
      titlePlaceholder: 'Behind the Scenes',
      titleMaxLength: 30,
      descriptionLabel: 'Story-Text',
      descriptionPlaceholder: 'Early morning magic in our bakery ✨',
      descriptionMaxLength: 60,
      showPrice: false,
      additionalInfoLabel: 'Hashtags',
      additionalInfoPlaceholder: '#behindthescenes #bakinglife',
      hideDescription: false
    },
    'website-banner': {
      titleLabel: 'Banner-Titel',
      titlePlaceholder: 'Willkommen bei Bäckerei Heusser',
      titleMaxLength: 50,
      descriptionLabel: 'Untertitel',
      descriptionPlaceholder: 'Tradition trifft Innovation',
      descriptionMaxLength: 120,
      showPrice: false,
      additionalInfoLabel: 'Call-to-Action',
      additionalInfoPlaceholder: 'Jetzt entdecken',
      hideDescription: false
    },
    'website-card': {
      titleLabel: 'Karten-Titel',
      titlePlaceholder: 'Unser Sortiment',
      titleMaxLength: 35,
      descriptionLabel: 'Beschreibung',
      descriptionPlaceholder: 'Von traditionellen Broten bis zu modernen Kreationen',
      descriptionMaxLength: 80,
      showPrice: false,
      additionalInfoLabel: 'Button-Text',
      additionalInfoPlaceholder: 'Mehr erfahren',
      hideDescription: false
    },
    'simple-square': {
      titleLabel: 'Nachrichtentext',
      titlePlaceholder: 'Ihre Nachricht hier...',
      titleMaxLength: 300,
      descriptionLabel: '',
      descriptionPlaceholder: '',
      descriptionMaxLength: 0,
      showPrice: false,
      additionalInfoLabel: '',
      additionalInfoPlaceholder: '',
      hideDescription: true
    }
  }
  
  const config = contentConfig[templateType] || {
    titleLabel: 'Titel',
    titlePlaceholder: templateConfig.placeholders.title,
    titleMaxLength: 50,
    descriptionLabel: 'Beschreibung',
    descriptionPlaceholder: templateConfig.placeholders.description,
    descriptionMaxLength: 200,
    showPrice: templateConfig.layout.showPrice,
    additionalInfoLabel: templateConfig.layout.formatHashtags ? 'Hashtags' : 'Zusätzliche Informationen',
    additionalInfoPlaceholder: templateConfig.layout.formatHashtags ? '#hashtag1 #hashtag2' : 'Zusätzliche Informationen...',
    hideDescription: !templateConfig.layout.showDescription
  }
  
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: theme.shadows[1],
        mb: 3,
      }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography
            variant="h6" 
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 2,
              color: 'primary.main',
            }}
          >
            <TextFieldsIcon sx={{ mr: 1 }} />
            Inhalt bearbeiten
          </Typography>
          
          <FormHelperText sx={{ mb: 2 }}>
            Einfach ausfüllen und ein professionelles Social Media Bild erhalten
          </FormHelperText>
        </Box>
      
        <TextField
          fullWidth
          label={config.titleLabel}
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder={config.titlePlaceholder}
          variant="outlined"
          required
          multiline={templateType === 'message' || templateType === 'simple-square'}
          rows={(templateType === 'message' || templateType === 'simple-square') ? 5 : 1}
          inputProps={{ 
            maxLength: config.titleMaxLength 
          }}
          helperText={`${values.title.length}/${config.titleMaxLength} Zeichen`}
          FormHelperTextProps={{
            sx: { display: 'flex', justifyContent: 'flex-end' }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
        
        {!config.hideDescription && (
          <TextField
            fullWidth
            label={config.descriptionLabel}
            value={values.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder={config.descriptionPlaceholder}
            variant="outlined"
            required
            multiline
            rows={4}
            inputProps={{ 
              maxLength: config.descriptionMaxLength 
            }}
            helperText={`${values.description.length}/${config.descriptionMaxLength} Zeichen`}
            FormHelperTextProps={{
              sx: { display: 'flex', justifyContent: 'flex-end' }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        )}
        
        {config.showPrice && (
          <TextField
            label="Preis"
            value={values.price || ''}
            onChange={(e) => onChange('price', e.target.value)}
            placeholder="z.B. 4,90"
            variant="outlined"
            required
            InputProps={{
              startAdornment: <InputAdornment position="start"><EuroIcon /></InputAdornment>,
            }}
            sx={{
              width: '100%',
              maxWidth: '200px',
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
        )}
        
        <TextField
          fullWidth
          label={config.additionalInfoLabel}
          value={values.additionalInfo || ''}
          onChange={(e) => onChange('additionalInfo', e.target.value)}
          placeholder={config.additionalInfoPlaceholder}
          variant="outlined"
          InputProps={{
            startAdornment: templateType === 'daily-special' ? (
              <InputAdornment position="start"><AccessTimeIcon /></InputAdornment>
            ) : null,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
      </Stack>
    </Paper>
  )
}

export default SimpleContentForm