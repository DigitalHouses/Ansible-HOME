# DigitalHouses / Ansible-HOME

Native Ansible + Semaphore for independently managed HOME/office sites.

Scope: 00/05/08 bootstrap, 10 PVE, 30/31/33 media and local PBS, 34 HOME PBS read-only access preparation for CORE, 60 agents.
Task 34 completed after HOME media recreate: datastore and CORE read-only token verified, repeat apply changed=0. One manual CT200 snapshot is readable by the CORE token. CORE Semaphore secret handoff remains pending. See docs/task34-home-pbs-core.md.
Cloudflare task 70 (Semaphore template ID 9) is the sole routine Cloudflare
controller. It reuses the existing site Tunnel and PVE connector and manages
Semaphore and Webmin routes plus the HOME PBS private /32 route, with working
Cloudflare API acceptance. Historical task 15 was migrated in-place; task 32
(ID 7) is archived without cloud changes. Remaining scope: HAOS mTLS and other
missing public routes. End-to-end PBS transport belongs to Ansible-CORE #40.

There are no central dh-core tasks in this repository.

See bootstrap/README.md for fresh-install instructions and
docs/repository-split.md for existing Semaphore migration.

Snapshot source: DigitalHouses/Ansible-3 feat/bootstrap-home-core at b97b840.
Original source repository is retained unchanged for rollback/history.
