# Form Survival verification

When modifying the form, read the applicable objective under checks/. Use the built-in fixtures or an explicitly authorized test instance with sample data.

Run the relevant Kane objective before changing code when reproducing a problem. Read its reports/<run>/result.json, events.ndjson, or codex-handoff.md directly. Confirm the failed step reflects a product error before changing the app. Login errors, incomplete tests, and an unverified verdict do not establish a product failure.

Make the smallest application change warranted by the evidence. Keep the objective and expected values intact. Run the same objective on the corrected app and inspect the new report. For example, use npm run verify -- fixed stale for the default form or use the custom command twice with one unchanged objective and suitable authorized fixtures. If Kane cannot run, report the blocker. npm run check:browser can verify the separate browser smoke cases.

Use recorded Kane output in the submission. Label intentional fixture bugs as such. Do not attach private data or credentials to the public repo.
