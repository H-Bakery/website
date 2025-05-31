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
  
  // Determine content type specific settings
  const contentConfig = {
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
    }
  }
  
  const config = contentConfig[templateType]
  
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
          multiline={templateType === 'message'}
          rows={templateType === 'message' ? 5 : 1}
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