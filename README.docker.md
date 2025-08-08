# Docker Setup for Bakery Website

This Docker setup provides a complete local development environment for the bakery website project.

## Services

- **PostgreSQL**: Database server (replaces SQLite for better Docker support)
- **Redis**: Caching and session management
- **bakery-api**: Node.js/Express backend API
- **bakery-landing**: Next.js landing page
- **bakery-shop**: Next.js e-commerce shop
- **bakery-management**: Next.js admin dashboard
- **Nginx**: Reverse proxy for routing
- **Mailhog**: Email testing (development only)
- **pgAdmin**: Database management UI (optional)
- **Adminer**: Lightweight database UI (development)

## Quick Start

1. **Copy environment file**:

   ```bash
   cp .env.docker .env
   ```

2. **Start all services**:

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

3. **Access the applications**:
   - Landing Page: http://localhost or http://bakery.localhost
   - Shop: http://shop.localhost
   - Management: http://manage.localhost or http://admin.localhost
   - API: http://api.localhost
   - Mailhog: http://localhost:8025
   - Adminer: http://localhost:8080
   - pgAdmin: http://localhost:5050 (if using `--profile tools`)

## Development Commands

### Start services with hot reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Start with optional tools (pgAdmin, Redis Commander):

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up
```

### Run in background:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### View logs:

```bash
docker-compose logs -f [service-name]
```

### Stop all services:

```bash
docker-compose down
```

### Stop and remove volumes (clean slate):

```bash
docker-compose down -v
```

## Database Management

### Access PostgreSQL:

```bash
docker-compose exec postgres psql -U bakery_user -d bakery_db
```

### Run migrations:

```bash
docker-compose exec bakery-api npm run db:migrate
```

### Seed database:

```bash
docker-compose exec bakery-api npm run db:seed:all
```

## Troubleshooting

### Port conflicts:

If you get port already in use errors, either:

1. Stop the conflicting service
2. Or modify the port mappings in `docker-compose.yml`

### Database connection issues:

1. Ensure PostgreSQL is healthy: `docker-compose ps`
2. Check logs: `docker-compose logs postgres`
3. Verify credentials in `.env` match `docker-compose.yml`

### Hot reload not working:

1. Ensure volumes are mounted correctly
2. Check that `node_modules` is not being overwritten
3. Restart the specific service: `docker-compose restart [service-name]`

### Permission issues:

```bash
# Fix ownership issues
docker-compose exec [service-name] chown -R node:node /app
```

## Production Build

To test production builds locally:

```bash
# Use production docker-compose without dev overrides
docker-compose up --build
```

## Hosts File Configuration (Optional)

For cleaner URLs, add to `/etc/hosts`:

```
127.0.0.1 bakery.localhost
127.0.0.1 shop.localhost
127.0.0.1 manage.localhost
127.0.0.1 admin.localhost
127.0.0.1 api.localhost
```

## Architecture Notes

- All Next.js apps run on different ports but are accessible through Nginx
- PostgreSQL replaces SQLite for better container support
- Redis is used for session storage and caching
- Mailhog captures all emails in development
- The API runs on port 5000 internally but is accessible via Nginx

## Environment Variables

Key environment variables (see `.env.docker` for full list):

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `NEXT_PUBLIC_API_URL`: API URL for frontend apps
- `JWT_SECRET`: Secret for JWT tokens
- `CORS_ORIGIN`: Allowed CORS origins

## Monitoring

The setup includes an optional monitoring stack (in `docker-compose.monitoring.yml`):

- Prometheus
- Grafana
- Loki
- Jaeger

To use monitoring:

```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up
```
