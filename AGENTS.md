# Ansible-HOME developer rules

Only DigitalHouses/Ansible-HOME scope: HOME/office sites, never central
dh-core operations. Follow ANSIBLE_STANDARDS.md; native Ansible only,
no custom Python in roles/tasks without user approval.
Never commit private site manifests or credentials. Do not change running
Cloudflare, PBS or guests merely for a repository cutover.
Verify Git -> Semaphore template/repository/inventory mapping before task runs.
Current CF task 15 and 32 continue until the agreed task 70 is implemented.
For all new HAOS tasks follow mandatory S23.1: one normal run checks,
converges only necessary changes and verifies the actual result. No redundant
audit/apply modes, surveys or confirmations; no unnecessary restarts.
