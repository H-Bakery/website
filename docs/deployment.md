# Deployment Guide

## Deployment Strategy Overview

Each application in the monorepo has its own deployment target optimized for its specific needs:

| Application | Platform | Type | URL |
|------------|----------|------|-----|
| bakery-landing | GitHub Pages | Static | https://yourdomain.com |
| bakery-shop | Vercel | SSR | https://shop.yourdomain.com |
| bakery-management | Vercel | SSR | https://manage.yourdomain.com |
| bakery-api | Google Cloud Run | Container | https://api.yourdomain.com |

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Pipeline

on:
  push:
    branches: [main]

env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      landing: ${{ steps.changes.outputs.landing }}
      shop: ${{ steps.changes.outputs.shop }}
      management: ${{ steps.changes.outputs.management }}
      api: ${{ steps.changes.outputs.api }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: nrwl/nx-set-shas@v4
      - id: changes
        run: |
          echo "landing=$([[ $(npx nx show projects --affected | grep bakery-landing) ]] && echo "true" || echo "false")" >> $GITHUB_OUTPUT
          echo "shop=$([[ $(npx nx show projects --affected | grep bakery-shop) ]] && echo "true" || echo "false")" >> $GITHUB_OUTPUT
          echo "management=$([[ $(npx nx show projects --affected | grep bakery-management) ]] && echo "true" || echo "false")" >> $GITHUB_OUTPUT
          echo "api=$([[ $(npx nx show projects --affected | grep bakery-api) ]] && echo "true" || echo "false")" >> $GITHUB_OUTPUT

  deploy-landing:
    needs: detect-changes
    if: needs.detect-changes.outputs.landing == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npx nx build bakery-landing --configuration=production
      - run: npx nx export bakery-landing
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/apps/bakery-landing/exported

  deploy-shop:
    needs: detect-changes
    if: needs.detect-changes.outputs.shop == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx nx build bakery-shop --configuration=production
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_SHOP_PROJECT_ID }}
          working-directory: ./dist/apps/bakery-shop

  deploy-api:
    needs: detect-changes
    if: needs.detect-changes.outputs.api == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: npm ci
      - run: npx nx build bakery-api --configuration=production
      - run: |
          docker build -f apps/bakery-api/Dockerfile -t gcr.io/${{ secrets.GCP_PROJECT }}/bakery-api:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT }}/bakery-api:${{ github.sha }}
      - run: |
          gcloud run deploy bakery-api \
            --image gcr.io/${{ secrets.GCP_PROJECT }}/bakery-api:${{ github.sha }} \
            --platform managed \
            --region us-central1 \
            --allow-unauthenticated
```

## Application-Specific Deployment

### Landing Page (GitHub Pages)

Configuration in `apps/bakery-landing/next.config.js`:
```javascript
module.exports = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  images: {
    unoptimized: true,
  },
};
```

Deployment script in `package.json`:
```json
{
  "scripts": {
    "deploy:landing": "nx build bakery-landing --prod && nx export bakery-landing && gh-pages -d dist/apps/bakery-landing/exported"
  }
}
```

### Shop & Management (Vercel)

Vercel configuration `apps/bakery-shop/vercel.json`:
```json
{
  "buildCommand": "cd ../.. && npx nx build bakery-shop --prod",
  "outputDirectory": "../../dist/apps/bakery-shop/.next",
  "installCommand": "cd ../.. && npm ci",
  "framework": "nextjs"
}
```

Environment variables:
```bash
# Set in Vercel dashboard
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_STRIPE_KEY=pk_live_xxx
```

### API (Google Cloud Run)

Dockerfile for production:
```dockerfile
# apps/bakery-api/Dockerfile
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY dist/apps/bakery-api/package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV production
ENV PORT 8080
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dist/apps/bakery-api ./
RUN chown -R node:node .
USER node
EXPOSE 8080
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "main.js"]
```

Cloud Run deployment configuration:
```yaml
# cloud-run.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: bakery-api
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      serviceAccountName: bakery-api@project.iam.gserviceaccount.com
      containers:
        - image: gcr.io/project/bakery-api
          ports:
            - containerPort: 8080
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: db-url
                  key: latest
          resources:
            limits:
              cpu: "2"
              memory: "2Gi"
```

## Environment Configuration

### Development
```bash
# .env.development
NX_API_URL=http://localhost:3333
NX_PUBLIC_URL=http://localhost:4200
DATABASE_URL=postgresql://user:pass@localhost:5432/bakery_dev
```

### Staging
```bash
# .env.staging
NX_API_URL=https://api-staging.yourdomain.com
NX_PUBLIC_URL=https://staging.yourdomain.com
DATABASE_URL=postgresql://user:pass@db-staging/bakery_staging
```

### Production
```bash
# .env.production
NX_API_URL=https://api.yourdomain.com
NX_PUBLIC_URL=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@db-prod/bakery_prod
```

## Database Migrations

### Migration Strategy

1. **Development**: Auto-sync with Prisma
2. **Staging**: Migration preview
3. **Production**: Manual migration approval

### Migration Workflow

```bash
# Generate migration
npx prisma migrate dev --name add_delivery_table

# Deploy to staging
npx prisma migrate deploy --preview-feature

# Deploy to production (after approval)
npx prisma migrate deploy
```

## Monitoring and Rollback

### Health Checks

Each application exposes health endpoints:
- Landing: Static site monitoring via GitHub Pages
- Shop/Management: Vercel monitoring
- API: `/health` and `/ready` endpoints

### Rollback Procedures

#### Vercel Applications
```bash
# List deployments
vercel ls bakery-shop

# Rollback to previous
vercel rollback [deployment-url]
```

#### Cloud Run API
```bash
# List revisions
gcloud run revisions list --service=bakery-api

# Rollback
gcloud run services update-traffic bakery-api \
  --to-revisions=bakery-api-00001-abc=100
```

#### Database Rollback
```bash
# Revert last migration
npx prisma migrate revert

# Restore from backup
pg_restore -d bakery_prod backup_file.dump
```

## Security Considerations

### Secrets Management

1. **GitHub Secrets**: For CI/CD pipeline
2. **Vercel Environment Variables**: For frontend apps
3. **Google Secret Manager**: For API secrets

### SSL/TLS Configuration

- GitHub Pages: Automatic with custom domain
- Vercel: Automatic SSL provisioning
- Cloud Run: Managed TLS termination

### API Security

```typescript
// apps/bakery-api/src/main.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests
}));
```

## Cost Optimization

### Estimated Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| GitHub Pages | Static hosting | Free |
| Vercel (2 apps) | <100GB bandwidth | Free |
| Cloud Run | <2M requests | ~$50 |
| PostgreSQL | db-f1-micro | ~$15 |
| **Total** | | **~$65/month** |

### Optimization Tips

1. **Use Nx Cloud** for distributed caching
2. **Enable CDN** for static assets
3. **Implement API caching** with Redis
4. **Use Cloud Run minimum instances** = 0
5. **Schedule non-critical jobs** during off-peak