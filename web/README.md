# web

The Angular client of Data Controls: the controls list, the control editor, the run results and the
suggestions dialog, in Hebrew, right to left. Design: [docs/design.md](../docs/design.md); payloads:
[contracts/api.md](../contracts/api.md).

```
npm ci
npx ng serve          # http://localhost:4200, /api proxied to http://localhost:5000
npx ng lint
npx ng test --watch=false
npx ng build          # dist/web/browser
```

This file is completed with the e2e folders and the gate command when the task reaches its gate.
