# HOME bootstrap

Fresh Proxmox PVE installation ONLY. HOME PVE address ends .220 and the
new Semaphore runner normally uses CT1221 at .221. Existing guest IDs
block creation; this bootstrap never deletes existing guests or disks.

Run as PVE root:

    bash <(curl -fsSL https://raw.githubusercontent.com/DigitalHouses/Ansible-HOME/main/bootstrap/install.sh)

Enter Site ID (e.g. serzhan-home, kraft-office) and confirm.
Repository: DigitalHouses/Ansible-HOME, branch main.
Catalog: catalog/tasks.yml. Runner checkout: /opt/ansible-home.

DO NOT rerun bootstrap on an existing Semaphore installation.
Follow docs/repository-split.md for the manual, validated Git cutover.
