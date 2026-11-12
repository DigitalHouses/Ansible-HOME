# DigitalHouses / Ansible-HOME

Native Ansible + Semaphore for independently managed HOME/office sites.

Scope: 00/05/08 bootstrap, 10 PVE, 30/31/33 media and local PBS, 60 agents.
Cloudflare task 70 is the in-place successor of historical task 15
(Semaphore template ID 9). The existing site connector now runs on HOME
PVE; the legacy Semaphore Runner connector is disabled. Audit and migration
are verified. Additional routes, HAOS mTLS and PBS private routing remain
separate work. Legacy task 32 retains its history until migration.

There are no central dh-core tasks in this repository.

See bootstrap/README.md for fresh-install instructions and
docs/repository-split.md for existing Semaphore migration.

Snapshot source: DigitalHouses/Ansible-3 feat/bootstrap-home-core at b97b840.
Original source repository is retained unchanged for rollback/history.
