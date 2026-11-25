# gaatru · Demo notes

gaatru is a release check for two ticketing failures that look successful on screen. A fan can receive a confirmation after being charged twice. A refunded order can leave the ticketing platform covering the refund because the organizer's transfer was never reversed. The sandbox uses a sample $75 ticket and a simulated provider ledger.

## Real-world context for the video

- Stripe reports that businesses on its platform processed more than $40 billion across more than 578 million transactions during Black Friday through Cyber Monday 2025. This is overall payment volume. [Stripe's 2025 payment figures](https://stripe.com/newsroom/news/bfcm2025)
- Checkout.com documented an October 2026 incident where some direct debits looked failed after funds had been collected. Duplicate charges occurred when some merchants retried the payments. [Checkout.com incident notice](https://support.checkout.com/hc/en-us/articles/41050684333458-Why-was-I-charged-twice-for-a-SEPA-Direct-Debit-payment-that-showed-as-failed)
- Stripe documents that the platform can fund a destination-charge refund while the connected account keeps its transfer unless the integration requests a reversal. [Stripe Connect refunds](https://docs.stripe.com/connect/destination-charges?platform=web&ui=elements#issue-refunds)

## Record the demo

1. Start with the two money outcomes. In the failed retry, the buyer has a confirmed ticket and two $75 captures. In the failed cancellation, the buyer has a $75 refund and the platform has a $75 unrecovered cost.
2. Open the first browser run in **Kane CLI runs** and show the action sequence. The failed checkpoint comes after the confirmation screen, when Kane looks at Payment activity.
3. Open the saved failure handoff from the workspace. Show the two fixes in `scripts/ticket-ledger.mjs`: reuse the original capture when retrying, and reverse the organizer transfer when issuing the cancellation refund.
4. Show the passing reruns. The retry ends at one $75 capture. The cancellation ends with $75 refunded, $75 recovered, and $0 unrecovered platform cost.
5. Show the objectives under `checks/` and their matching before/after hashes in the captured results. The original regressions can be replayed using the fixture command in the README.

The **Kane CLI runs** panel reads JSON from the recorded runs. The retry verdict is Kane's own browser assertion. In the cancellation run, Kane reads the three visible amounts and the release check reconciles them against the sandbox ledger and the cancellation policy. Raw event streams and failure handoffs stay under the ignored local `reports/` directory. The snapshots under `evidence/` omit local file paths and TestMu links.

## Recorded results

| Check | Intentional regression | After the repair |
| --- | --- | --- |
| Payment retry | Two captures totaling $150.00. [Before report](evidence/ticket-retry-before-1795629792137/result.json) | One capture totaling $75.00. [After report](evidence/ticket-retry-after-1795630018714/result.json) |
| Show cancellation | $75.00 buyer refund, $0.00 recovered, $75.00 platform cost. [Before report](evidence/ticket-refund-before-1795630318426/result.json) | $75.00 buyer refund, $75.00 recovered, $0.00 platform cost. [After report](evidence/ticket-refund-after-1795630448641/result.json) |

The redesigned interface passed both unchanged objectives in a fresh run. [Payment retry](evidence/ticket-retry-check-1795632125233/result.json) · [Show cancellation](evidence/ticket-refund-check-1795632243716/result.json)

## Shot list for a three-minute recording

| Time | Record on screen | Say |
| --- | --- | --- |
| 0:00–0:18 | Open **Payment retry** on the original build. Use the ledger after retry as the cold open. | “One fan. One ticket. Two charges. That second seventy-five dollars didn’t even get a seat.” |
| 0:18–0:45 | Start over. Click **Pay $75**, wait for the timeout, click **Retry payment**, then **Payment activity**. Show the confirmation and both captures in the same frame. | “The provider got paid before the confirmation timed out. The fan did exactly what the checkout asked.” |
| 0:45–1:14 | Show the original Kane trace or run `npm.cmd run verify -- ticket retry before --headed`. Cut from Kane opening the ledger to the failed assertion and the handoff. | “Kane followed the shopper’s journey in Chrome. Its report came straight into Codex with the failed step and the actual amount.” |
| 1:14–1:43 | Show `pay()` in `scripts/ticket-ledger.mjs`, the repaired app, and `npm.cmd run verify -- ticket retry after --headed` or the saved rerun. | “Codex made the retry reuse the original capture. Kane repeated the same objective and saw one capture for seventy-five dollars.” |
| 1:43–2:18 | On **Show cancellation**, use the original build. Cancel, open **Payment activity**, then show the saved Kane observation and reconciliation result. | “The fan got a refund. The organizer kept the transfer. The platform accidentally sponsored the show.” |
| 2:18–2:49 | Show `refund()`, then the repaired ledger and the saved refund rerun or `npm.cmd run verify -- ticket refund after --headed`. | “Codex added the transfer reversal. Kane read the same three numbers again, and the release check verified zero unrecovered dollars.” |
| 2:49–3:08 | Show the two objective files and the matched hashes in the report pairs. Finish on **Kane CLI runs**. | “Same objectives, same expected numbers, two fixes verified. The next show can go on sale.” |

When using Descript Underlord, paste the following instruction after importing the actual captures and narration.

> Edit this into a roughly three-minute hackathon demo. Open on the real two-charge ledger, keep the dry jokes, and cut waiting time. Keep the Kane failed step, Codex handoff, payment code, and passing rerun in that order. Caption amounts and let viewers read them. Mark app replays as replays and use the original Kane evidence for the verdicts. The refund comparison was made by the release check using Kane's browser observations. Use simple cuts and captions. Preserve the actual screens, code and results.
