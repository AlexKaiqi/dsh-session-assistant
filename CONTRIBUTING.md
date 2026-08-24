# Contributing

Use Node.js 22.19 or newer and pnpm 11.22.0. Install only from the official npm registry, then run the complete release gate before opening a pull request:

```sh
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org/
pnpm check
```

Keep Session Assistant scoped to product context, drafting, explicit Agent submission, optional knowledge delegation, and localized UI. Provider credentials and media transport belong in `dsh-realtime-voice`; direct workspace execution belongs to the primary Agent.

Do not run `pnpm test:e2e:live` unless you have configured a real Realtime Provider and explicitly accept billable calls. When behavior or boundaries change, update `evals/suite.json` and add a new dated run rather than editing historical evidence.
