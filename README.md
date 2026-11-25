# gaatru

A local release check for duplicate ticket charges and refunds paid from the wrong balance. The sandbox uses simulated payments.

## Run locally

With Node.js 22+ and Chrome:

```sh
npm ci
npm start
```

Open [localhost:4174](http://127.0.0.1:4174). Pick a scenario and use **Build** to switch between the original bug and the repair. Open **Payment activity** to see the ledger.

| Check | Original fixture | Repaired |
| --- | --- | --- |
| Retry a $75 payment after a timeout | [Two charges, $150](evidence/ticket-retry-before-1795629792137/result.json) | [One charge, $75](evidence/ticket-retry-after-1795630018714/result.json) |
| Refund a cancelled show after transferring the proceeds | [$75 platform cost](evidence/ticket-refund-before-1795630318426/result.json) | [$0 platform cost](evidence/ticket-refund-after-1795630448641/result.json) |

## Run Kane

```sh
npx kane-cli login --oauth
npm run verify -- ticket all --headed
```

Add `before` after `all` to replay the failures. Both builds use the same [objectives](checks/). Kane checks the retry in Chrome. For cancellations, gaatru compares Kane’s browser readings with the ledger. Results and Codex handoffs are saved in `reports/`. Run `npm run check:tickets` for the browser smoke tests.
