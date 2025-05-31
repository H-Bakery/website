'use client'
import React, { useState, useRef, useCallback } from 'react'
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
  Card,
  CardContent,
  Divider,
  useTheme,
  alpha,
  Stack,
  FormHelperText,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  useMediaQuery,
  CircularProgress,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material'
import ImageIcon from '@mui/icons-material/Image'
import DownloadIcon from '@mui/icons-material/Download'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import WallpaperIcon from '@mui/icons-material/Wallpaper'
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill'
import * as htmlToImage from 'html-to-image'
import {
  Template,
  TemplateType,
  SocialMediaContent,
} from '../../types/socialMedia'
import { socialMediaTemplates } from '../../data/socialMediaTemplates'
import TemplatePreview from './TemplatePreview'
import Wappen from '../icons/brand/Wappen'
import TextFieldsIcon from '@mui/icons-material/PhotoCamera'

const ContentCreator: React.FC = () => {
  const theme = useTheme()
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<TemplateType>('daily-special')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  )
  const [content, setContent] = useState<Partial<SocialMediaContent>>({
    name: '',
    templateId: '',
    textElements: {},
    imageElements: {},
  })
  // Simple state to track content creation flow
  const [contentStep, setContentStep] = useState<
    'select' | 'edit' | 'complete'
  >('select')
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const scale = 0.5

  // Filter templates by selected type
  const filteredTemplates = socialMediaTemplates.filter(
    (template) => template.type === selectedTemplateType
  )

  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const handleTemplateTypeChange = (
    _: React.SyntheticEvent,
    newValue: TemplateType
  ) => {
    setSelectedTemplateType(newValue)
    setSelectedTemplate(null)
    setContent({
      name: '',
      templateId: '',
      textElements: {},
      imageElements: {},
    })
    setContentStep('select')
  }

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setContent({
      ...content,
      name: `${template.name} ${new Date().toLocaleDateString('de-DE')}`,
      templateId: template.id,
      textElements: {},
      imageElements: {},
    })
    setContentStep('edit')
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
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({
        open: true,
        message: 'Bild ist zu groß. Maximale Dateigröße: 5MB',
        severity: 'error',
      })
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      setSnackbar({
        open: true,
        message: 'Nur Bilddateien sind erlaubt',
        severity: 'error',
      })
      return
    }

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

  const handleRemoveImage = (elementId: string) => {
    const newImageElements = { ...content.imageElements }
    if (newImageElements) {
      delete newImageElements[elementId]

      setContent({
        ...content,
        imageElements: newImageElements,
      })
    }
  }

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  const handleBack = () => {
    if (contentStep === 'edit') {
      setSelectedTemplate(null)
      setContentStep('select')
    }
  }

  // Check if required images are missing
  const isDownloadButtonDisabled = useCallback((): boolean => {
    if (loading) return true
    if (!selectedTemplate) return true

    // Check for missing required images
    for (const el of selectedTemplate.imageElements) {
      if (el.required) {
        const imageExists =
          content.imageElements && content.imageElements[el.id]
        if (!imageExists) {
          return true
        }
      }
    }

    return false
  }, [loading, selectedTemplate, content.imageElements])

  // Check if any required images are missing for error message display
  const hasMissingRequiredImages = useCallback((): boolean => {
    if (!selectedTemplate) return false

    for (const el of selectedTemplate.imageElements) {
      if (el.required) {
        const imageExists =
          content.imageElements && content.imageElements[el.id]
        if (!imageExists) {
          return true
        }
      }
    }

    return false
  }, [selectedTemplate, content.imageElements])

  const handleDownload = useCallback(async () => {
    if (!previewRef.current || !selectedTemplate) return

    setLoading(true)
    try {
      // Ensure the component is fully rendered with scale 1
      if (previewRef.current) {
        // Store original transform
        const originalTransform = previewRef.current.style.transform

        // Set transform to scale(1) for high-quality capture
        previewRef.current.style.transform = 'scale(1)'

        // Wait for the transform to take effect
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Generate high-quality PNG
        const dataUrl = await htmlToImage.toPng(previewRef.current, {
          width: selectedTemplate.width,
          height: selectedTemplate.height,
          quality: 1,
          pixelRatio: 3,
          style: {
            transform: 'scale(1)',
          },
        })

        // Reset the transform
        previewRef.current.style.transform = originalTransform

        // Create download link
        const filename = `${
          content.name?.replace(/\s+/g, '-').toLowerCase() || 'bäckerei-heusser'
        }.png`
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        link.click()

        setSnackbar({
          open: true,
          message: 'Bild erfolgreich heruntergeladen!',
          severity: 'success',
        })
        setContentStep('complete')
      }
    } catch (error) {
      console.error('Error generating image:', error)
      setSnackbar({
        open: true,
        message:
          'Fehler beim Erstellen des Bildes. Bitte versuchen Sie es erneut.',
        severity: 'error',
      })
    } finally {
      setLoading(false)
    }
  }, [content.name, selectedTemplate])

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Simple header without stepper */}

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <Typography variant="h4" fontWeight={600}>
          Social Media Content Creator
        </Typography>

        <Box sx={{ display: 'flex', gap: 2 }}>
          {contentStep === 'edit' && (
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
            >
              Zurück
            </Button>
          )}
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 2,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={selectedTemplateType}
          onChange={handleTemplateTypeChange}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{
            sx: {
              backgroundColor: 'primary.main',
              height: 3,
            },
          }}
        >
          <Tab label="Tagesangebot" value="daily-special" />
          <Tab label="Angebote" value="offer" />
          <Tab label="Brot des Tages" value="bread-of-day" />
          <Tab label="Bäckerei News" value="bakery-news" />
        </Tabs>
      </Paper>

      {/* Template selection */}
      {contentStep === 'select' && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Wählen Sie eine Vorlage
          </Typography>
          <Grid container spacing={3}>
            {filteredTemplates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    borderRadius: 2,
                    overflow: 'hidden',
                    height: '100%',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: 3,
                    },
                  }}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <Box
                    sx={{
                      height: 220,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        opacity: 0.9,
                        transform: 'scale(0.15)',
                        transformOrigin: 'top left',
                      }}
                    >
                      <Wappen />
                    </Box>
                    <ImageIcon
                      sx={{
                        fontSize: 80,
                        color: theme.palette.primary.main,
                        opacity: 0.7,
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 60,
                        bgcolor: alpha(theme.palette.primary.main, 0.8),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.8,
                      }}
                    >
                      <Typography
                        variant="body1"
                        sx={{ color: '#fff', fontWeight: 500 }}
                      >
                        Vorschau
                      </Typography>
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      {template.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {template.description}
                    </Typography>
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      sx={{ borderRadius: 6, mt: 1 }}
                    >
                      Auswählen
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Content editor and preview */}
      {(contentStep === 'edit' || contentStep === 'complete') &&
        selectedTemplate && (
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                }}
              >
                <Typography
                  variant="h6"
                  fontWeight={600}
                  gutterBottom
                  color="primary.main"
                >
                  {selectedTemplate.name} bearbeiten
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mb: 2, color: 'text.secondary' }}
                >
                  Erstellen Sie Text-fokussierte Inhalte - Bilder sind optional
                  und verschönern den Inhalt.
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <TextField
                  fullWidth
                  label="Name des Inhalts"
                  value={content.name || ''}
                  onChange={(e) =>
                    setContent({ ...content, name: e.target.value })
                  }
                  margin="normal"
                  variant="outlined"
                  sx={{ mb: 2 }}
                  InputProps={{
                    sx: { borderRadius: 2 },
                  }}
                />

                {selectedTemplate.textElements.map((element) => (
                  <TextField
                    key={element.id}
                    fullWidth
                    label={element.placeholder}
                    value={content.textElements?.[element.id] || ''}
                    onChange={(e) =>
                      handleTextChange(element.id, e.target.value)
                    }
                    margin="normal"
                    multiline={
                      element.maxLength ? element.maxLength > 50 : false
                    }
                    rows={element.maxLength && element.maxLength > 50 ? 3 : 1}
                    inputProps={{ maxLength: element.maxLength }}
                    required={element.required}
                    variant="outlined"
                    InputProps={{
                      sx: {
                        borderRadius: 2,
                        ...(element.highlight
                          ? {
                              '& input': {
                                color:
                                  theme.palette.mode === 'dark'
                                    ? '#FFD700'
                                    : theme.palette.primary.main,
                                fontWeight: 'bold',
                              },
                            }
                          : {}),
                      },
                    }}
                    helperText={
                      <Box
                        component="span"
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          {element.highlight && '✨ '}
                          {element.required ? 'Erforderlich' : 'Optional'}
                          {element.highlight && ' (Hervorgehoben)'}
                        </span>
                        <span>
                          {content.textElements?.[element.id]?.length || 0}/
                          {element.maxLength} Zeichen
                        </span>
                      </Box>
                    }
                  />
                ))}

                {/* Text style selector removed from here - moved to the top section */}

                <Typography
                  variant="h6"
                  sx={{
                    mt: 4,
                    mb: 3,
                    fontWeight: 600,
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pb: 1,
                  }}
                >
                  <TextFieldsIcon sx={{ mr: 1 }} />
                  Textgestaltung & Inhalt
                </Typography>

                <Stack spacing={3}>
                  {/* Text style controls at the top */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      mb: 3,
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 2,
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <TextFieldsIcon sx={{ mr: 1, color: 'primary.main' }} />
                        Textstil
                      </Typography>
                    </Box>

                    <Stack spacing={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Textbereich-Stil</InputLabel>
                        <Select
                          value="primary"
                          label="Textbereich-Stil"
                          onChange={() => {}}
                        >
                          <MenuItem value="primary">
                            Corporate Pink (Standard)
                          </MenuItem>
                          <MenuItem value="dark">Dunkel (Schwarz)</MenuItem>
                          <MenuItem value="light">
                            Hell (Weiß mit dunklem Text)
                          </MenuItem>
                          <MenuItem value="accent">Akzent (Grün)</MenuItem>
                        </Select>
                      </FormControl>

                      <FormHelperText>
                        Der Textstil bestimmt das Aussehen des Haupttextbereichs
                        und passt automatisch die Textfarbe an
                      </FormHelperText>
                    </Stack>
                  </Paper>

                  {/* Content images - now second */}
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mt: 2,
                      mb: 2,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <PhotoCameraIcon sx={{ mr: 1, color: 'primary.main' }} />
                    Inhaltsbilder (optional)
                  </Typography>

                  {selectedTemplate.imageElements
                    .filter((el) => !el.isBackground)
                    .map((element) => (
                      <Paper
                        key={element.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          borderColor:
                            element.required &&
                            !content.imageElements?.[element.id]
                              ? 'warning.light'
                              : 'divider',
                          mb: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 2,
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="subtitle2">
                            Bild{' '}
                            {element.required ? '(erforderlich)' : '(optional)'}
                          </Typography>
                          {element.aspectRatio && (
                            <Tooltip title="Empfohlenes Seitenverhältnis für optimale Darstellung">
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Format: {element.aspectRatio}
                              </Typography>
                            </Tooltip>
                          )}
                        </Box>

                        {content.imageElements &&
                        content.imageElements[element.id] ? (
                          <Box sx={{ position: 'relative', mb: 1 }}>
                            <Box
                              component="img"
                              src={content.imageElements[element.id]}
                              alt="Ausgewähltes Bild"
                              sx={{
                                width: '100%',
                                maxHeight: 240,
                                objectFit: 'contain',
                                borderRadius: 1,
                                mb: 2,
                              }}
                            />
                            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                              <Button
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={() =>
                                  handleTriggerFileInput(element.id)
                                }
                                size="small"
                              >
                                Ändern
                              </Button>
                              <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleRemoveImage(element.id)}
                                size="small"
                              >
                                Entfernen
                              </Button>
                            </Stack>
                          </Box>
                        ) : (
                          <>
                            <Button
                              variant="outlined"
                              startIcon={<AddPhotoAlternateIcon />}
                              onClick={() => handleTriggerFileInput(element.id)}
                              fullWidth
                              sx={{
                                height: 120,
                                border: '2px dashed rgba(0,0,0,0.12)',
                                borderRadius: 2,
                                '&:hover': {
                                  borderColor: 'primary.main',
                                  bgcolor: alpha(
                                    theme.palette.primary.main,
                                    0.04
                                  ),
                                },
                              }}
                            >
                              Bild auswählen
                            </Button>
                            <FormHelperText>
                              Bilder sind optional. Ihr Inhalt wird auch ohne
                              Bilder schön dargestellt.
                            </FormHelperText>
                          </>
                        )}
                      </Paper>
                    ))}

                  {/* Background image selection moved to the bottom */}
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mt: 4,
                      mb: 2,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'text.secondary',
                    }}
                  >
                    <WallpaperIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    Hintergrund (optional)
                  </Typography>

                  {selectedTemplate.imageElements
                    .filter((el) => el.isBackground)
                    .map((element) => (
                      <Paper
                        key={element.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          mb: 3,
                          borderColor: 'divider',
                          bgcolor: alpha(theme.palette.background.default, 0.6),
                        }}
                      >
                        <Stack spacing={2}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Hintergrund-Stil</InputLabel>
                            <Select
                              value={
                                content.imageElements?.[element.id]
                                  ? 'custom'
                                  : 'plain'
                              }
                              label="Hintergrund-Stil"
                              onChange={(e) => {
                                if (e.target.value === 'plain') {
                                  handleRemoveImage(element.id)
                                }
                              }}
                            >
                              <MenuItem value="plain">
                                Einfarbig (Standard)
                              </MenuItem>
                              <MenuItem value="custom">
                                Benutzerdefiniertes Bild
                              </MenuItem>
                            </Select>
                          </FormControl>

                          {content.imageElements &&
                          content.imageElements[element.id] ? (
                            <Box sx={{ position: 'relative', mb: 1 }}>
                              <Box
                                component="img"
                                src={content.imageElements[element.id]}
                                alt="Hintergrundbild"
                                sx={{
                                  width: '100%',
                                  height: 120,
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                  mb: 2,
                                }}
                              />
                              <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                                <Button
                                  variant="outlined"
                                  startIcon={<EditIcon />}
                                  onClick={() =>
                                    handleTriggerFileInput(element.id)
                                  }
                                  size="small"
                                >
                                  Ändern
                                </Button>
                                <Button
                                  variant="outlined"
                                  color="error"
                                  startIcon={<DeleteIcon />}
                                  onClick={() => handleRemoveImage(element.id)}
                                  size="small"
                                >
                                  Entfernen
                                </Button>
                              </Stack>
                            </Box>
                          ) : (
                            <>
                              <Button
                                variant="outlined"
                                startIcon={<WallpaperIcon />}
                                onClick={() =>
                                  handleTriggerFileInput(element.id)
                                }
                                fullWidth
                                sx={{
                                  height: 80,
                                  border: '2px dashed rgba(0,0,0,0.08)',
                                  borderRadius: 2,
                                  '&:hover': {
                                    borderColor: 'primary.main',
                                    bgcolor: alpha(
                                      theme.palette.primary.main,
                                      0.04
                                    ),
                                  },
                                }}
                              >
                                Hintergrundbild auswählen
                              </Button>
                              <FormHelperText>
                                Die einfarbige Variante ist empfohlen für
                                bessere Lesbarkeit
                              </FormHelperText>
                            </>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                </Stack>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleFileInputChange}
                />

                <Box sx={{ mt: 4 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    endIcon={
                      loading ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <DownloadIcon />
                      )
                    }
                    onClick={handleDownload}
                    fullWidth
                    disabled={loading || isDownloadButtonDisabled()}
                    sx={{
                      py: 2,
                      borderRadius: 2,
                      boxShadow: 2,
                      fontSize: '1.1rem',
                      fontFamily: "'Averia Serif Libre', serif",
                    }}
                  >
                    {loading
                      ? 'Wird erstellt...'
                      : 'Social Media Bild herunterladen'}
                  </Button>
                  {hasMissingRequiredImages() && (
                    <FormHelperText error sx={{ textAlign: 'center', mt: 1 }}>
                      Bitte fügen Sie alle erforderlichen Bilder hinzu
                    </FormHelperText>
                  )}
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper
                sx={{
                  p: 4,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                }}
              >
                <Typography
                  variant="h6"
                  fontWeight={600}
                  gutterBottom
                  color="primary.main"
                >
                  Vorschau
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mb: 3, color: 'text.secondary' }}
                >
                  So wird Ihr Inhalt in sozialen Medien aussehen
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: 400,
                  }}
                >
                  <Box
                    sx={{
                      boxShadow: theme.shadows[8],
                      borderRadius: 4,
                      overflow: 'hidden',
                      mb: 3,
                      transformOrigin: 'top center',
                      border: `1px solid ${alpha(
                        theme.palette.primary.main,
                        0.3
                      )}`,
                    }}
                  >
                    <TemplatePreview
                      template={selectedTemplate}
                      content={content}
                      ref={previewRef}
                      scale={scale}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      textAlign: 'center',
                      mb: 3,
                      color: 'text.secondary',
                    }}
                  >
                    Mit Wappen-Logo in der rechten unteren Ecke
                  </Typography>

                  {/* Success message when download is complete */}
                  {contentStep === 'complete' && (
                    <Box sx={{ mt: 4, width: '100%', textAlign: 'center' }}>
                      <Typography variant="h6" color="primary" gutterBottom>
                        Erfolgreich erstellt!
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        paragraph
                      >
                        Ihr Bild wurde erfolgreich heruntergeladen. Sie können
                        es jetzt in sozialen Medien teilen.
                      </Typography>

                      <Button
                        variant="outlined"
                        onClick={() => {
                          setSelectedTemplate(null)
                          setContentStep('select')
                          setContent({
                            name: '',
                            templateId: '',
                            textElements: {},
                            imageElements: {},
                          })
                        }}
                        sx={{ mt: 2, borderRadius: 6 }}
                      >
                        Neue Vorlage erstellen
                      </Button>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default ContentCreator
