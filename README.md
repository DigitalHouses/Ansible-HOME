# DigitalHouses / Ansible-HOME

## Current transport and backup target (13 November 2026)

- **Tailscale** is the private PVE/PBS path. CORE PBS: `100.97.126.67:8007`, CORE PVE: `100.64.243.13`. HOME №71 installs, audits, configures and updates the HOME PVE/PBS clients; HOME Assistant is out of scope.
- **HOME PBS Push Sync → CORE PBS** `pbs-core/<home-id>`, with `remove-vanished=false`; direct HOME PVE Restore via Tailscale. HOME №34 currently contains **historical Pull logic only**, not the new Push/Restore implementation. Do not use №34 `apply` to implement the new architecture.
- **Cloudflare Tunnel + Access** remain for web access. HOME №70 continues to own those components. Cloudflare WARP is no longer required; older private PBS Cloudflare routes and CORE→HOME WARP tests are historical.
- No B2 work until separately decided. Neither PBS Push nor Restore is accepted until actual snapshots and a test restore are verified.

See `docs/task71-tailscale.md` and `docs/architecture-home-backup.md` for pilot and disaster-recovery requirements.

Native Ansible + Semaphore for independently managed HOME/office sites.

Scope: 00/05/08 bootstrap, 10 PVE, 30/31/33 media and local PBS, 34 legacy CORE Pull (to be replaced by HOME Push/Restore), 60 agents and 70 Cloudflare.
Central backup direction changed to **HOME Push → CORE PBS**, with direct Restore back to HOME PVE. See docs/architecture-home-backup.md and read-only HOME→CORE transport audit in docs/task70-cloudflare.md. The former Task 34 CORE Pull token and CT200 pilot remain historical, not the target architecture; see docs/task34-home-pbs-core.md.
Cloudflare task 70 (Semaphore template ID 9) is the sole routine Cloudflare
controller. It reuses the existing site Tunnel and PVE connector and manages
Semaphore and Webmin routes plus the HOME PBS private /32 route, with working
Cloudflare API acceptance. Historical task 15 was migrated in-place; task 32
(ID 7) is archived without cloud changes. Remaining scope: HAOS mTLS and other
missing public routes. The new HOME→CORE route is owned by HOME #70, while CORE independently owns its receiving endpoint; the previous CORE→HOME transport remains unchanged.

There are no central dh-core tasks in this repository.

See bootstrap/README.md for fresh-install instructions and
docs/repository-split.md for existing Semaphore migration.

Snapshot source: DigitalHouses/Ansible-3 feat/bootstrap-home-core at b97b840.
Original source repository is retained unchanged for rollback/history.
