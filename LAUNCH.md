# Zdrowa Polska — Gmail signature launch runbook

## Current safe state

- Apps Script should remain in `test` mode until launch.
- Only `dhyk@zdrowapolskagroup.pl` is modified in test mode.
- Production users are controlled by the Workspace custom field `SignatureProfile.EmailSignature`.
- `EmailSignature = true` means the centrally managed signature should be installed and kept in sync.
- `EmailSignature = false` does not touch an unmanaged personal signature. If the user was previously managed by this system, the centrally managed signature is cleared.

## Before launch

Run `prepareSystem()` once after installing the current `apps-script/Combined.gs` in Apps Script.

`prepareSystem()`:
- ensures the custom schema exists,
- forces safe test mode,
- removes any production hourly trigger,
- validates GitHub and service-account configuration,
- stages profile-photo assets for users currently marked `EmailSignature = true`,
- refreshes only the test user's Gmail signature.

Review the web preview and make sure the intended users show `EmailSignature = true`.

## Moment X — production launch

Run exactly one Apps Script function:

`goLive()`

It will:
1. run a readiness check,
2. switch the system to production mode,
3. install/update signatures for active users with `EmailSignature = true`,
4. leave unmanaged `EmailSignature = false` users untouched,
5. clear the centrally managed signature for users who were managed earlier but were later switched to `false`,
6. create one hourly `syncSignatures` trigger.

If `goLive()` encounters an error, it returns the system to test mode and removes the hourly trigger. Users already updated before the error may retain their new signature and should be reviewed.

## Emergency stop

Run:

`backToTest()`

This immediately switches back to test mode and removes the hourly production trigger. Existing signatures are not deleted.

## Status check

Run:

`systemStatus()`

The execution log shows:
- current mode,
- number of hourly sync triggers,
- active users,
- users with `EmailSignature = true`,
- users with `EmailSignature = false`.

## Normal operation

The hourly `syncSignatures()` job checks Workspace profile data and Gmail's stored signature. It updates Gmail only when needed and re-applies the centrally managed signature if the saved Gmail signature was changed manually.

Profile photos are published to the public GitHub Pages asset path only for users whose signatures are being staged or managed. If a Workspace profile photo is removed, the corresponding managed photo asset is removed on a later sync.

## Important

Do not commit or share the service-account private key or `GITHUB_TOKEN`. They belong only in Apps Script Script Properties.
