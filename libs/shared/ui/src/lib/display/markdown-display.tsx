'use client'
import React, { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Typography, Box, Paper } from '@mui/material'
import type { Components } from 'react-markdown'

/**
 * Markdown display component props
 * @interface MarkdownDisplayProps
 */
export interface MarkdownDisplayProps {
  /** Markdown content to render */
  content: string
  /** Optional title for the document */
  title?: string
  /** Whether to wrap content in a Paper component */
  wrapped?: boolean
  /** Custom styling overrides */
  sx?: React.ComponentProps<typeof Box>['sx']
}

/**
 * Interface for code element props from react-markdown
 * @interface CodeProps
 */
interface CodeProps {
  node?: any
  inline?: boolean
  className?: string
  children?: React.ReactNode
}

/**
 * Markdown display component
 *
 * Features:
 * - GitHub-flavored markdown support
 * - Material UI typography integration
 * - Syntax highlighting for code blocks
 * - Responsive tables and images
 * - Accessible heading structure
 * - Customizable styling
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <MarkdownDisplay content="# Hello World\n\nThis is **bold** text." />
 *
 * // With title and custom styling
 * <MarkdownDisplay
 *   title="API Documentation"
 *   content={markdownContent}
 *   sx={{ maxWidth: '800px', mx: 'auto' }}
 * />
 *
 * // Without paper wrapper
 * <MarkdownDisplay
 *   content={content}
 *   wrapped={false}
 * />
 * ```
 */
export const MarkdownDisplay: React.FC<MarkdownDisplayProps> = ({
  content,
  title,
  wrapped = true,
  sx,
}) => {
  // Define components for ReactMarkdown with proper type handling
  const components: Components = {
    h1: ({ children }) => (
      <Typography variant="h2" gutterBottom component="h1">
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography variant="h3" gutterBottom sx={styles.heading} component="h2">
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography variant="h4" gutterBottom sx={styles.heading} component="h3">
        {children}
      </Typography>
    ),
    h4: ({ children }) => (
      <Typography variant="h5" gutterBottom component="h4">
        {children}
      </Typography>
    ),
    h5: ({ children }) => (
      <Typography variant="h6" gutterBottom component="h5">
        {children}
      </Typography>
    ),
    h6: ({ children }) => (
      <Typography
        variant="subtitle1"
        fontWeight="bold"
        gutterBottom
        component="h6"
      >
        {children}
      </Typography>
    ),
    p: ({ children }) => (
      <Typography variant="body1" paragraph>
        {children}
      </Typography>
    ),
    a: ({ href, children }) => (
      <Typography
        component="a"
        href={href}
        sx={{
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        {children}
      </Typography>
    ),
    table: ({ children }) => (
      <Box component="table" sx={styles.table}>
        {children}
      </Box>
    ),
    thead: ({ children }) => (
      <Box component="thead" sx={styles.tableHeader}>
        {children}
      </Box>
    ),
    th: ({ children }) => (
      <Box component="th" sx={styles.tableCell}>
        {children}
      </Box>
    ),
    td: ({ children }) => (
      <Box component="td" sx={styles.tableCell}>
        {children}
      </Box>
    ),
    ul: ({ children }) => (
      <Box component="ul" sx={styles.list}>
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box component="ol" sx={styles.list}>
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Box component="li" sx={styles.listItem}>
        {children}
      </Box>
    ),
    blockquote: ({ children }) => <Box sx={styles.blockquote}>{children}</Box>,
    // Proper type for the code component
    code: (props: CodeProps) => {
      const { inline, children } = props
      return inline ? (
        <Typography
          component="code"
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.06)',
            padding: '2px 4px',
            borderRadius: '3px',
            fontFamily: 'monospace',
            fontSize: '0.875em',
          }}
        >
          {children}
        </Typography>
      ) : (
        <Box component="pre" sx={styles.codeBlock}>
          <Typography
            component="code"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            {children}
          </Typography>
        </Box>
      )
    },
    hr: () => <Box component="hr" sx={styles.divider} />,
  }

  const content_element = (
    <Box sx={{ ...styles.markdownContainer, ...sx }}>
      {title && (
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </Box>
  )

  if (!wrapped) {
    return content_element
  }

  return (
    <Paper elevation={1} sx={{ p: 4, my: 3 }}>
      {content_element}
    </Paper>
  )
}

// MUI sx prop styles
const styles = {
  markdownContainer: {
    '& img': {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: 1,
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
    borderColor: 'primary.main',
    fontStyle: 'italic',
    bgcolor: 'action.hover',
    my: 2,
    borderRadius: 1,
  },
  codeBlock: {
    backgroundColor: 'action.hover',
    p: 2,
    borderRadius: 1,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    border: '1px solid',
    borderColor: 'divider',
  },
  divider: {
    my: 2,
    border: 'none',
    height: '1px',
    backgroundColor: 'divider',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    margin: '16px 0',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: 'action.hover',
  },
  tableCell: {
    padding: '12px 16px',
    border: '1px solid',
    borderColor: 'divider',
    '&:not(:last-child)': {
      borderRight: '1px solid',
      borderRightColor: 'divider',
    },
  },
  list: {
    marginLeft: '24px',
    marginBottom: '16px',
  },
  listItem: {
    margin: '4px 0',
  },
}

export default MarkdownDisplay
