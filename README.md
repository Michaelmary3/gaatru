# Ticket Check

Ticket Check is a local release gate for ticketing checkout and cancellation. It exercises both workflows in Chrome with Kane CLI and checks the amounts in the sandbox ledger.

- **Payment retry.** The provider records a payment, but the response never reaches checkout. Retrying the same purchase must leave exactly one captured charge of $75.
- **Show cancellation.** The buyer gets a $75 refund after the original proceeds were sent to the organizer. Under this sandbox's cancellation policy, the organizer's original transfer is reversed and the platform's unrecovered refund cost is $0.

The After Hours Live show, charges, balances, and fault conditions are sample data. The sandbox uses a local ledger with no external payment provider and omits fees.

## Open the sandbox

Use Node.js 22 or newer and Chrome.

```powershell
npm.cmd ci
npm.cmd start
```

Open http://127.0.0.1:4174 and select a scenario. Choose **Repaired build** or **Original build with bugs** to compare the two versions. After completing it, open **Payment activity** to see the ledger. **Start over** creates a fresh order.

## Run the release checks

Sign in to Kane on the machine that runs Chrome.

```powershell
npx.cmd kane-cli login --oauth
npm.cmd run verify -- ticket all --headed
```

You can run either objective independently by replacing `all` with `retry` or `refund`. The process returns a nonzero exit code if either check fails or cannot be verified. It starts a fresh loopback server for each check. Each result includes the objective hash and expected and observed ledger values. The raw browser events and generated failure handoff are under `reports/ticket-*/`. The **Kane CLI runs** panel shows those results and the shareable report snapshots under `evidence/`.

To replay the two intentional regressions, run `npm.cmd run verify -- ticket all before --headed`. That command should exit with failures. The ordinary command exercises the repaired code with the same objectives. To explore the regressions manually in Chrome, start the sandbox with `npm.cmd start -- --fixture`.

The retry check uses Kane's browser assertion and confirms the result against the ledger. For the cancellation check, Kane opens Payment activity and reads all three amounts. The runner verifies that those browser values match the sandbox ledger, then compares them with the refund policy. An authentication failure, incomplete browser run, or contradictory evidence never passes the gate.

The separate Chrome smoke test also exercises refresh between the first payment attempt and the retry.

```powershell
npm.cmd run check:tickets
```

## Why these checks

[WooCommerce documents duplicate-charge risk after an uncertain timeout](https://github.com/woocommerce/woocommerce/blob/trunk/docs/features/payments/payment-gateway-api.md#retries-and-uncertain-outcomes). [Stripe documents how the funding side of a destination-charge refund can stay unreconciled without a transfer reversal](https://docs.stripe.com/connect/destination-charges?platform=web&ui=elements#issue-refunds).

The previous bakery prototype remains available via `npm.cmd run start:bakery` on port 4173. Its separate smoke suite is `npm.cmd run check:browser`.
