# Admin Area

This directory contains the administrative section of the bakery management application. The admin area is accessible only to users with management permissions and provides tools for managing staff, system settings, and other administrative functions.

## Structure Overview

- `layout.tsx`: Admin area layout with navigation and dark mode support
- `page.tsx`: Admin dashboard homepage
- `staff/`: Staff management section
  - `page.tsx`: Staff listing and management interface
- `settings/`: System settings section
  - `page.tsx`: Settings interface including theme preferences

## Features

### Dark Mode Support

The admin area includes comprehensive dark mode support:
- Theme toggle in the navigation bar
- Persistent theme preferences stored in localStorage
- Theme-aware components that adapt to the current mode
- Theme settings in the settings page

### Staff Management

The staff management section allows administrators to:
- View all staff members
- See staff status (active, on leave, etc.)
- Manage staff roles and permissions
- Add new staff members

### Settings

The settings section provides configuration options for:
- Theme preferences (light/dark mode)
- Notification settings
- Language and localization preferences
- Security settings

## Integration

The admin area integrates with:
- Theme context for dark mode functionality
- User authentication and authorization system
- Backend API for staff and settings management