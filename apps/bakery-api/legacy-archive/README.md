# Legacy Archive

This directory contains the legacy CommonJS code that was migrated to TypeScript and the Nx monorepo architecture.

## Why This Archive Exists

As requested, the legacy structure has been preserved here instead of being deleted. This allows us to:

- Reference the old implementation if needed
- Verify that all functionality has been migrated
- Maintain a historical record of the migration

## Migration Status

All files in this archive have been successfully migrated to the new architecture:

- **Controllers** → Migrated to domain libraries in `libs/api/*/src/lib/controllers/`
- **Routes** → Migrated to domain libraries and local route files in `src/routes/`
- **Services** → Migrated to domain libraries in `libs/api/*/src/lib/services/`
- **Models** → Migrated to domain libraries in `libs/api/*/src/lib/models/`
- **Utils** → Migrated to `libs/api/utils/`
- **Validators** → Migrated to domain libraries in `libs/api/*/src/lib/validators/`

## New Architecture

The new architecture follows Domain-Driven Design principles:

```
libs/api/
├── auth/          # Authentication domain
├── baking-list/   # Baking list domain
├── cash/          # Cash management domain
├── chat/          # Chat domain
├── dashboard/     # Dashboard domain
├── delivery/      # Delivery domain
├── email/         # Email service domain
├── inventory/     # Inventory domain
├── notifications/ # Notifications domain
├── orders/        # Orders domain
├── preferences/   # User preferences domain
├── production/    # Production domain
├── products/      # Products domain
├── recipes/       # Recipes domain
├── staff/         # Staff management domain
├── templates/     # Notification templates domain
├── unsold-products/ # Unsold products tracking domain
├── utils/         # Shared utilities
├── websocket/     # WebSocket service domain
└── workflows/     # Workflow management domain
```

## Removal

This archive can be safely removed once the team has verified that:

1. All functionality has been successfully migrated
2. The new system is running smoothly in production
3. No references to the old code are needed

Date of migration: August 2025
