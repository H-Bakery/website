# CI/CD Documentation

## Overview

The bakery monorepo uses GitHub Actions for continuous integration and deployment, with Nx Cloud for distributed caching and task execution.

## CI Pipeline

The CI pipeline runs on every push and pull request to ensure code quality and functionality.

### Workflow Files

1. **`.github/workflows/ci.yml`** - Main CI pipeline
2. **`.github/workflows/pr.yml`** - Pull request checks
3. **`.github/workflows/deploy.yml`** - Deployment pipeline

### CI Jobs

#### 1. Change Detection

- Uses `dorny/paths-filter` to detect which projects are affected
- Optimizes CI time by only running relevant jobs

#### 2. Quality Checks

- **Formatting**: Ensures consistent code style with Prettier
- **Linting**: Runs ESLint on affected projects
- **Type Checking**: Validates TypeScript types
- **Console Log Detection**: Prevents console statements in production code

#### 3. Unit Tests

- Runs in parallel across 3 shards for faster execution
- Coverage reports uploaded to Codecov
- Uses Nx affected commands to test only changed code

#### 4. E2E Tests

- Runs Playwright tests for affected applications
- Tests run against production builds
- Artifacts saved for debugging failures

#### 5. Build Verification

- Builds all affected projects in production mode
- Validates bundle sizes
- Uploads artifacts for deployment

#### 6. Security Checks

- Runs `npm audit` for dependency vulnerabilities
- Trivy scan for container security
- Results uploaded to GitHub Security tab

## Pull Request Workflow

### Automated PR Checks

1. **Conventional Commits**: PR titles must follow conventional commit format
2. **Auto-labeling**: Labels added based on changed files
3. **Preview Deployments**: Automatic Vercel preview for UI changes
4. **Bundle Size Analysis**: Comments with size changes
5. **Test Coverage**: Comments with coverage reports

### PR Comment Bot

The PR bot automatically comments with:

- Preview deployment links
- Test results summary
- Bundle size changes
- Coverage reports

## Deployment Pipeline

### Deployment Targets

| Application | Platform         | Environment Variables                           |
| ----------- | ---------------- | ----------------------------------------------- |
| Shop        | Vercel           | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_KEY` |
| Management  | Vercel           | `NEXT_PUBLIC_API_URL`                           |
| Landing     | GitHub Pages     | None                                            |
| API         | Google Cloud Run | `DATABASE_URL`, `JWT_SECRET`                    |

### Deployment Process

1. **Automatic Deployments**: Push to `main` triggers production deployment
2. **Manual Deployments**: Use workflow dispatch for staging/production
3. **Rollback**: Each platform maintains deployment history

### Post-Deployment

- Smoke tests run against deployed URLs
- Slack notifications sent with deployment status
- Monitoring alerts configured for production

## Test Scripts

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests for specific app
npm run test:unit:shop
npm run test:unit:management
npm run test:unit:landing

# Run tests for libraries
npm run test:unit:libs

# Watch mode
npm run test:unit:watch

# With coverage
npm run test:unit:coverage

# CI mode (optimized for CI)
npm run test:unit:ci
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E for specific app
npm run test:e2e:shop
npm run test:e2e:management
npm run test:e2e:landing

# CI mode (headless)
npm run test:e2e:ci

# Debug mode (headed browser)
npm run test:e2e:headed
npm run test:e2e:debug
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration
```

### Validation Scripts

```bash
# Run all validations (lint, type-check, tests)
npm run validate

# CI validation (includes E2E)
npm run validate:ci

# Validate only affected projects
npm run affected:validate
```

## Nx Cloud Integration

### Setup

1. Create Nx Cloud account at https://nx.app
2. Connect workspace: `npx nx connect-to-nx-cloud`
3. Add `NX_CLOUD_ACCESS_TOKEN` to GitHub secrets

### Benefits

- **Distributed Caching**: Share build artifacts across CI runs
- **Distributed Task Execution**: Run tasks on multiple agents
- **Performance Analytics**: Track build times and bottlenecks
- **Cost Reduction**: Reduce CI minutes by 30-70%

### Configuration

See `.github/nx-cloud.yml` for:

- Cacheable operations
- Agent configuration
- Performance optimizations

## GitHub Secrets Required

### Repository Secrets

- `NX_CLOUD_ACCESS_TOKEN` - Nx Cloud access token
- `CODECOV_TOKEN` - Codecov integration
- `SLACK_WEBHOOK` - Slack notifications

### Vercel Deployment

- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_SHOP_PROJECT_ID` - Shop project ID
- `VERCEL_MANAGEMENT_PROJECT_ID` - Management project ID
- `VERCEL_PREVIEW_PROJECT_ID` - Preview project ID

### Google Cloud Deployment

- `GCP_SA_KEY` - Service account JSON key
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GCP_REGION` - Deployment region
- `GCP_SERVICE_ACCOUNT` - Service account email

### Application Secrets

- `DATABASE_URL` - Production database connection
- `JWT_SECRET` - JWT signing secret
- `STRIPE_PUBLIC_KEY` - Stripe publishable key

## Environment Variables

### Build-time Variables

```bash
# API URLs
NEXT_PUBLIC_API_URL=https://api.bakery.com

# Feature flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_PWA=true
```

### Runtime Variables

```bash
# Server-only
DATABASE_URL=postgresql://...
JWT_SECRET=...
REDIS_URL=redis://...

# Monitoring
SENTRY_DSN=...
LOG_LEVEL=info
```

## Monitoring & Alerts

### Build Monitoring

- Nx Cloud dashboard for build analytics
- GitHub Actions insights for workflow performance
- Slack notifications for failures

### Deployment Monitoring

- Vercel Analytics for frontend performance
- Google Cloud Monitoring for API metrics
- Error tracking with Sentry

## Troubleshooting

### Common Issues

1. **Cache Misses**

   - Check Nx Cloud connection
   - Verify `NX_CLOUD_ACCESS_TOKEN`
   - Clear cache: `nx reset`

2. **E2E Test Failures**

   - Download artifacts from GitHub
   - Check Playwright traces
   - Verify test URLs match deployment

3. **Deployment Failures**
   - Check GitHub secrets configuration
   - Verify environment variables
   - Review deployment logs

### Debug Commands

```bash
# Clear all caches
npm run clean

# Reset Nx cache only
npm run clean:cache

# Check Nx configuration
npm run deps:check

# Analyze bundle sizes
npm run report:bundle
```

## Best Practices

1. **Use Affected Commands**: Let Nx determine what to test/build
2. **Parallel Execution**: Configure appropriate parallelism
3. **Cache Everything**: Leverage Nx Cloud caching
4. **Monitor Performance**: Track CI times and optimize
5. **Fail Fast**: Run quick checks before expensive operations

## Migration Notes

When adding new projects:

1. Update `.github/labeler.yml` with new paths
2. Add project to build matrix in CI
3. Configure deployment target if needed
4. Update documentation
