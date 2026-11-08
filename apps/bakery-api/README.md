# Bakery API

Express + TypeScript backend of the bakery pilot (SQLite, esbuild bundle). Everything an engineer
needs - build, startup, mounted routes, roles, contracts, tests - is in
[`docs/api/`](../../docs/api/overview.md); the rules that always apply are in
[`CLAUDE.md`](./CLAUDE.md); operation on the box is in [`docs/runbook.md`](../../docs/runbook.md).

```bash
npm run serve:api      # from website/: bundle, migrate, listen on PORT (default 5000)
npm run build:api      # bundle only → dist/apps/bakery-api/bundle/{main,cli}.js
npx nx test bakery-api # jest, projects js, ts and contract-later
```
