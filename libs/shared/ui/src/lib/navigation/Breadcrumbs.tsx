import React from 'react'
import {
  Breadcrumbs as MuiBreadcrumbs,
  Typography,
  Link,
  Box,
  Paper,
} from '@mui/material'
import {
  NavigateNext as NavigateNextIcon,
  Home as HomeIcon,
} from '@mui/icons-material'
import NextLink from 'next/link'
import { Breadcrumb, generateBreadcrumbs } from '@bakery/shared/utils'

export interface BreadcrumbsProps {
  /**
   * Current pathname
   */
  pathname: string

  /**
   * Current application
   */
  app: 'landing' | 'shop' | 'management'

  /**
   * Custom breadcrumbs (overrides auto-generated)
   */
  customBreadcrumbs?: Breadcrumb[]

  /**
   * Show home icon for first breadcrumb
   */
  showHomeIcon?: boolean

  /**
   * Show in paper container
   */
  showContainer?: boolean

  /**
   * Maximum number of breadcrumbs to show
   */
  maxItems?: number
}

/**
 * Breadcrumb navigation component
 * Automatically generates breadcrumbs based on current path
 */
export function Breadcrumbs({
  pathname,
  app,
  customBreadcrumbs,
  showHomeIcon = true,
  showContainer = false,
  maxItems = 6,
}: BreadcrumbsProps) {
  const breadcrumbs = customBreadcrumbs || generateBreadcrumbs(pathname, app)

  if (breadcrumbs.length <= 1) {
    return null
  }

  const renderBreadcrumb = (breadcrumb: Breadcrumb, index: number) => {
    const isFirst = index === 0
    const isLast = breadcrumb.current || index === breadcrumbs.length - 1

    if (isLast) {
      return (
        <Typography
          key={breadcrumb.href}
          color="text.primary"
          sx={{
            display: 'flex',
            alignItems: 'center',
            fontWeight: 'medium',
          }}
        >
          {isFirst && showHomeIcon && (
            <HomeIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
          )}
          {breadcrumb.label}
        </Typography>
      )
    }

    return (
      <Link
        key={breadcrumb.href}
        component={NextLink}
        href={breadcrumb.href}
        underline="hover"
        color="inherit"
        sx={{
          display: 'flex',
          alignItems: 'center',
          '&:hover': {
            color: 'primary.main',
          },
        }}
      >
        {isFirst && showHomeIcon && (
          <HomeIcon sx={{ mr: 0.5, fontSize: '1rem' }} />
        )}
        {breadcrumb.label}
      </Link>
    )
  }

  const breadcrumbElements = (
    <MuiBreadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      maxItems={maxItems}
      aria-label="breadcrumb"
    >
      {breadcrumbs.map(renderBreadcrumb)}
    </MuiBreadcrumbs>
  )

  if (showContainer) {
    return (
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.50',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      >
        {breadcrumbElements}
      </Paper>
    )
  }

  return <Box sx={{ py: 1 }}>{breadcrumbElements}</Box>
}

export default Breadcrumbs
