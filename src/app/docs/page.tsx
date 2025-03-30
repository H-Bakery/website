'use client'
import React, { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
} from '@mui/material'
import Base from '../../layouts/Base'
import Hero from '../../components/Hero'
import MarkdownDisplay from '../../components/MarkdownDisplay'

// List of markdown files to display
const documentFiles = [
  { name: 'KPI Analysis', path: '/docs/planning/kpi.md' },
  // Add more markdown files here as needed
]

export default function DocsPage() {
  const [selectedTab, setSelectedTab] = useState(0)
  const [markdownContent, setMarkdownContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue)
  }

  useEffect(() => {
    const fetchMarkdown = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(documentFiles[selectedTab].path)
        if (!response.ok) {
          throw new Error(`Failed to load document: ${response.statusText}`)
        }
        const text = await response.text()
        setMarkdownContent(text)
      } catch (err) {
        console.error('Error loading markdown file:', err)
        setError(
          'Fehler beim Laden des Dokuments. Bitte versuchen Sie es später erneut.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchMarkdown()
  }, [selectedTab])

  return (
    <Base>
      <Hero title="Dokumentation" />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={selectedTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            {documentFiles.map((doc) => (
              <Tab key={doc.name} label={doc.name} />
            ))}
          </Tabs>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ my: 2 }}>
            {error}
          </Alert>
        ) : (
          <MarkdownDisplay
            content={markdownContent}
            title={documentFiles[selectedTab].name}
          />
        )}
      </Container>
    </Base>
  )
}
