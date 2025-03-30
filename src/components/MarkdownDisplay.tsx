'use client'
import React, { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Typography, Box, Paper } from '@mui/material'
import type { Components } from 'react-markdown'

interface MarkdownDisplayProps {
  content: string
  title?: string
}

// Interface for code element props from react-markdown
interface CodeProps {
  node?: any
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({
  content,
  title,
}) => {
  // Define components for ReactMarkdown with proper type handling
  const components: Components = {
    h1: ({ children }) => (
      <Typography variant="h2" gutterBottom>
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography variant="h3" gutterBottom sx={styles.heading}>
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography variant="h4" gutterBottom sx={styles.heading}>
        {children}
      </Typography>
    ),
    h4: ({ children }) => (
      <Typography variant="h5" gutterBottom>
        {children}
      </Typography>
    ),
    h5: ({ children }) => (
      <Typography variant="h6" gutterBottom>
        {children}
      </Typography>
    ),
    h6: ({ children }) => (
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {children}
      </Typography>
    ),
    p: ({ children }) => (
      <Typography variant="body1" paragraph>
        {children}
      </Typography>
    ),
    a: ({ href, children }) => (
      <a href={href} style={inlineStyles.link}>
        {children}
      </a>
    ),
    table: ({ children }) => (
      <table style={inlineStyles.table}>{children}</table>
    ),
    thead: ({ children }) => (
      <thead style={inlineStyles.tableHeader}>{children}</thead>
    ),
    th: ({ children }) => <th style={inlineStyles.tableCell}>{children}</th>,
    td: ({ children }) => <td style={inlineStyles.tableCell}>{children}</td>,
    ul: ({ children }) => <ul style={inlineStyles.list}>{children}</ul>,
    ol: ({ children }) => <ol style={inlineStyles.list}>{children}</ol>,
    li: ({ children }) => <li style={inlineStyles.listItem}>{children}</li>,
    blockquote: ({ children }) => <Box sx={styles.blockquote}>{children}</Box>,
    // Use a proper type for the code component
    code: (props: CodeProps) => {
      const { inline, children } = props
      return inline ? (
        <code style={inlineStyles.inlineCode}>{children}</code>
      ) : (
        <Box component="pre" sx={styles.codeBlock}>
          {children}
        </Box>
      )
    },
    hr: () => <Box component="hr" sx={styles.divider} />,
  }

  return (
    <Paper elevation={1} sx={{ p: 4, my: 3 }}>
      {title && (
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
      )}
      <Box sx={styles.markdownContainer}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </Box>
    </Paper>
  )
}

// MUI sx prop styles
const styles = {
  markdownContainer: {
    '& img': {
      maxWidth: '100%',
      height: 'auto',
    },
  },
  heading: {
    mt: 3,
    mb: 2,
    borderBottom: '1px solid',
    borderColor: 'divider',
    pb: 1,
  },
  blockquote: {
    pl: 2,
    py: 0.5,
    borderLeft: '4px solid',
    borderColor: 'divider',
    fontStyle: 'italic',
    bgcolor: 'rgba(0, 0, 0, 0.03)',
    my: 2,
  },
  codeBlock: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    p: 2,
    borderRadius: '4px',
    overflowX: 'auto',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
  divider: {
    my: 2,
    border: 'none',
    height: '1px',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
}

// Inline styles with proper React CSSProperties type
const inlineStyles: Record<string, CSSProperties> = {
  link: {
    color: '#1976d2',
    textDecoration: 'none',
  },
  table: {
    borderCollapse: 'collapse' as const,
    width: '100%',
    margin: '16px 0',
    border: '1px solid #ddd',
  },
  tableHeader: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  tableCell: {
    padding: '8px',
    border: '1px solid #ddd',
  },
  list: {
    marginLeft: '24px',
    marginBottom: '16px',
  },
  listItem: {
    margin: '4px 0',
  },
  inlineCode: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    padding: '2px 4px',
    borderRadius: '3px',
    fontFamily: 'monospace',
  },
}

export default MarkdownDisplay
