# №08 — DEV API access: recovery and token rotation

Owner: Ansible-HOME. This task reuses the existing Semaphore project, `dev-automation` account, Runner and DEV CT1254; it does not recreate Semaphore or any templates.

## Survey: `DH_DEV_API_TOKEN_ACTION`

- `keep` (default): use the existing managed token; if missing, create a new one. An invalid managed token is an error, not an invitation to silently replace it.
- `probe`: check Runner → DEV SSH with the existing Runner key without touching tokens; expose only the Runner's **public** SSH key for one-time enrollment on DEV.
- `rotate`: deliberately mint a fresh token for `dev-automation`, verify its identity/permissions, update Runner's root-only file and curl configuration through Ansible's normal file management, deliver to the existing central DEV via native Ansible SSH as the unprivileged `dev` user, and test the identity and project membership **from DEV**. Only then expire the previous token, if it is present in the dedicated user's token list. If delivery fails, the former token is not revoked.

Central DEV is `dh-core / DEV — CT1254, 192.168.11.254` on the CORE PVE (`192.168.11.240`), **not** on `serzhan-home / PVE` (`192.168.11.220`). Task 08 never uses `pct exec` against a HOME PVE to manage central DEV. The current site Runner reaches DEV directly via existing LAN SSH; remote-site transport will require an appropriate future Cloudflare private route before this can be used there.

Current destination on DEV: `/home/dev/.config/ansible-home/<site-id>.curl` (mode 0600). The older `/home/dev/.config/ansible-3/` configuration is legacy and is not the new source of truth.

Use task №08 in the **existing Semaphore project**. The catalogue synchronizer №00 updates its existing template/survey only after the repository cutover; it must not create a replacement template.

## First recovery when the DEV token has already expired

A 401 means DEV cannot launch its own recovery task via the expired token. Do not loop on the same failed credential. Use an **authorized Runner-local maintenance context** or an already logged-in Semaphore administrator once to launch task №08 with `rotate`; alternatively, generate an API token for `dev-automation` with the official Semaphore CLI and install it securely in the managed Runner/DEV configuration. Never print token values in chat or shell logs. No network or service reinstallation is needed.

## Certificates

Current Semaphore API access uses native HTTP + Bearer token; task №08 does **not** use client certificates or a CA bundle. A legacy `serzhan-home.crt` file in DEV is not part of this path and must not be modified as part of API-token rotation. Certificates for Cloudflare Access/mTLS belong to the relevant Cloudflare task №70. Do not manufacture an extra certificate in №08.

## Acceptance

1. Default `keep` is backward compatible with fresh bootstrap and non-expired tokens.
2. `rotate` creates a new credential, verifies it from DEV and expires the old credential after successful delivery, not before.
3. Same Semaphore project ID, existing user, inventory, Runner, history and task-template IDs remain intact.
4. No token values printed, no browser automation, no new tunnel, no Semaphore restart.
