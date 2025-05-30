'use client'
import React, { useState, useRef } from 'react'
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Tabs,
  Tab,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  CardMedia,
  Divider,
  useTheme,
  alpha,
} from '@mui/material'
import ImageIcon from '@mui/icons-material/Image'
import DownloadIcon from '@mui/icons-material/Download'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import * as htmlToImage from 'html-to-image'
import { Template, TemplateType, SocialMediaContent } from '../../types/socialMedia'
import { socialMediaTemplates } from '../../data/socialMediaTemplates'
import TemplatePreview from './TemplatePreview'

const ContentCreator: React.FC = () => {
  const theme = useTheme()
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType>('daily-special')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [content, setContent] = useState<Partial<SocialMediaContent>>({
    name: '',
    templateId: '',
    textElements: {},
    imageElements: {},
  })
  const [previewMode, setPreviewMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const scale = 0.5

  // Filter templates by selected type
  const filteredTemplates = socialMediaTemplates.filter(
    (template) => template.type === selectedTemplateType
  )

  const handleTemplateTypeChange = (_: React.SyntheticEvent, newValue: TemplateType) => {
    setSelectedTemplateType(newValue)
    setSelectedTemplate(null)
    setContent({
      name: '',
      templateId: '',
      textElements: {},
      imageElements: {},
    })
  }

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setContent({
      ...content,
      name: `${template.name} ${new Date().toLocaleDateString()}`,
      templateId: template.id,
      textElements: {},
      imageElements: {},
    })
  }

  const handleTextChange = (elementId: string, value: string) => {
    setContent({
      ...content,
      textElements: {
        ...content.textElements,
        [elementId]: value,
      },
    })
  }

  const handleImageSelect = async (elementId: string, file: File) => {
    // Convert file to base64 for preview
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        setContent({
          ...content,
          imageElements: {
            ...content.imageElements,
            [elementId]: e.target.result as string,
          },
        })
      }
    }
    reader.readAsDataURL(file)
  }

  const handleTriggerFileInput = (elementId: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.dataset.elementId = elementId
      fileInputRef.current.click()
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    const elementId = e.target.dataset.elementId
    
    if (files && files[0] && elementId) {
      handleImageSelect(elementId, files[0])
    }
  }

  const handleDownload = async () => {
    if (!previewRef.current || !selectedTemplate) return

    try {
      // Set a timeout to ensure the component is fully rendered
      setTimeout(async () => {
        if (previewRef.current) {
          previewRef.current.style.transform = 'scale(1)'

          const dataUrl = await htmlToImage.toPng(previewRef.current, {
            width: selectedTemplate?.width,
            height: selectedTemplate?.height,
            quality: 1,
            pixelRatio: 2
          })

          // Reset the transform
          previewRef.current.style.transform = `scale(${scale})`

          // Create download link
          const link = document.createElement('a')
          link.download = `${content.name || 'social-media-content'}.png`
          link.href = dataUrl
          link.click()
        }
      }, 100)
    } catch (error) {
      console.error('Error generating image:', error)
      alert('Fehler beim Erstellen des Bildes. Bitte versuchen Sie es erneut.')
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        Social Media Content Creator
      </Typography>
      
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Tabs
          value={selectedTemplateType}
          onChange={handleTemplateTypeChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Tagesangebot" value="daily-special" />
          <Tab label="Angebote" value="offer" />
          <Tab label="Brot des Tages" value="bread-of-day" />
          <Tab label="Bäckerei News" value="bakery-news" />
        </Tabs>
      </Paper>
      
      <Grid container spacing={4}>
        {/* Template selection */}
        {!selectedTemplate && (
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Wähle eine Vorlage
            </Typography>
            <Grid container spacing={3}>
              {filteredTemplates.map((template) => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: theme.shadows[4],
                      },
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 60, color: theme.palette.primary.main }} />
                    </Box>
                    <CardContent>
                      <Typography variant="h6">{template.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {template.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        )}
        
        {/* Content editor and preview */}
        {selectedTemplate && (
          <>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedTemplate.name} bearbeiten
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <TextField
                  fullWidth
                  label="Name des Inhalts"
                  value={content.name || ''}
                  onChange={(e) => setContent({ ...content, name: e.target.value })}
                  margin="normal"
                />
                
                {selectedTemplate.textElements.map((element) => (
                  <TextField
                    key={element.id}
                    fullWidth
                    label={element.placeholder}
                    value={(content.textElements?.[element.id] || '')}
                    onChange={(e) => handleTextChange(element.id, e.target.value)}
                    margin="normal"
                    multiline={element.maxLength && element.maxLength > 50}
                    rows={element.maxLength && element.maxLength > 50 ? 3 : 1}
                    inputProps={{ maxLength: element.maxLength }}
                    required={element.required}
                    helperText={`Max ${element.maxLength} Zeichen`}
                  />
                ))}
                
                {selectedTemplate.imageElements.map((element) => (
                  <Box key={element.id} sx={{ my: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Bild {element.required ? '(erforderlich)' : '(optional)'}
                    </Typography>
                    
                    {content.imageElements?.[element.id] ? (
                      <Box sx={{ position: 'relative', mb: 2 }}>
                        <img
                          src={content.imageElements[element.id]}
                          alt="Selected"
                          style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }}
                        />
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleTriggerFileInput(element.id)}
                          sx={{ position: 'absolute', bottom: 8, right: 8 }}
                        >
                          Ändern
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<AddPhotoAlternateIcon />}
                        onClick={() => handleTriggerFileInput(element.id)}
                        fullWidth
                        sx={{ height: 100 }}
                      >
                        Bild auswählen
                      </Button>
                    )}
                  </Box>
                ))}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleFileInputChange}
                />
                
                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setSelectedTemplate(null)
                      setContent({
                        name: '',
                        templateId: '',
                        textElements: {},
                        imageElements: {},
                      })
                    }}
                  >
                    Zurück
                  </Button>
                  
                  <Button
                    variant="contained"
                    color="primary"
                    endIcon={<DownloadIcon />}
                    onClick={handleDownload}
                  >
                    Herunterladen
                  </Button>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Vorschau
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 400,
                  }}
                >
                  <TemplatePreview
                    template={selectedTemplate}
                    content={content}
                    ref={previewRef}
                    scale={scale}
                  />
                </Box>
              </Paper>
            </Grid>
          </>
        )}
      </Grid>
    </Container>
  )
}

export default ContentCreator
