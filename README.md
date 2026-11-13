# DigitalHouses / Ansible-HOME

## Current transport and backup target (13 November 2026)

- **Tailscale** is the private PVE/PBS path. CORE PBS: `100.97.126.67:8007`, CORE PVE: `100.64.243.13`. HOME №71 installs, audits, configures and updates the HOME PVE/PBS clients; HOME Assistant is out of scope.
- **HOME №34** now implements Tailscale transport audit, native PBS Remote/Push job preparation, explicit manual Push and restore-only PVE storage. CORE `pbs-core/<home-id>`, `remove-vanished=false`. CORE №50 still must issue per-HOME credentials and namespace before any transfer.
- **Cloudflare Tunnel + Access** remain for web access. HOME №70 continues to own those components. Cloudflare WARP is no longer required; older private PBS Cloudflare routes and CORE→HOME WARP tests are historical.
- No B2 work until separately decided. Neither PBS Push nor Restore is accepted until actual snapshots and a test restore are verified.

See `docs/task71-tailscale.md` and `docs/architecture-home-backup.md` for pilot and disaster-recovery requirements.

Native Ansible + Semaphore for independently managed HOME/office sites.

Scope: 00/05/08 bootstrap, 10 PVE, 30/31/33 media and local PBS, 34 HOME Push/Restore (legacy CORE Pull code retired), 60 agents and 70 Cloudflare.
Central backup direction changed to **HOME Push → CORE PBS**, with direct Restore back to HOME PVE. See docs/architecture-home-backup.md and read-only HOME→CORE transport audit in docs/task70-cloudflare.md. The former Task 34 CORE Pull token and CT200 pilot are historical; see docs/task34-home-pbs-core.md for new task actions.
Cloudflare task 70 (Semaphore template ID 9) is the sole routine Cloudflare
controller. It reuses the existing site Tunnel and PVE connector and manages
Semaphore and Webmin routes plus the HOME PBS private /32 route, with working
Cloudflare API acceptance. Historical task 15 was migrated in-place; task 32
(ID 7) is archived without cloud changes. Remaining scope: HAOS mTLS and other
missing public routes. The private HOME→CORE PBS transport is owned by HOME #71 Tailscale; legacy Cloudflare private routing is not used for PBS Push.

There are no central dh-core tasks in this repository.

See bootstrap/README.md for fresh-install instructions and
docs/repository-split.md for existing Semaphore migration.

Snapshot source: DigitalHouses/Ansible-3 feat/bootstrap-home-core at b97b840.
Original source repository is retained unchanged for rollback/history.
