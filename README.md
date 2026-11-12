# DigitalHouses / Ansible-HOME

Native Ansible + Semaphore for independently managed HOME/office sites.

Scope: 00/05/08 bootstrap, 10 PVE, 30/31/33 media and local PBS, 60 agents.
Cloudflare task 70 (Semaphore template ID 9) is the sole routine Cloudflare
controller. It reuses the existing site Tunnel and PVE connector and manages
Semaphore and Webmin routes, with working live acceptance. Historical task 15
was migrated in-place and task 32 (ID 7) is archived without cloud changes.
Remaining scope: HAOS mTLS, PBS private routing, and other missing routes.

There are no central dh-core tasks in this repository.

See bootstrap/README.md for fresh-install instructions and
docs/repository-split.md for existing Semaphore migration.

Snapshot source: DigitalHouses/Ansible-3 feat/bootstrap-home-core at b97b840.
Original source repository is retained unchanged for rollback/history.
