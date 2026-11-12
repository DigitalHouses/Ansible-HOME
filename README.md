# DigitalHouses / Ansible-HOMES

Native Ansible + Semaphore for independently managed HOME/office sites.

Scope: 00/05/08 bootstrap, 10 PVE, 30/31/33 media and local PBS, 60 agents.
Cloudflare tasks 15 and 32 are preserved as-is during repository extraction.
They will become task 70 after a separate validated migration.

There are no central dh-core tasks in this repository.

See bootstrap/README.md for fresh-install instructions and
docs/repository-split.md for existing Semaphore migration.

Snapshot source: DigitalHouses/Ansible-3 feat/bootstrap-home-core at b97b840.
Original source repository is retained unchanged for rollback/history.
