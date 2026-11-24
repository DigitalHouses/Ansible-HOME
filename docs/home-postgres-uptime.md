# HOME PostgreSQL and Uptime Kuma

## Task 35: PostgreSQL

- Dedicated Debian 13 LXC **CT1224**, IP **HOME .224**, 2 vCPU, 512 MiB RAM,
  512 MiB swap, 100 GiB on `local-lvm`; existing CT never recreated.
- Native Proxmox TTY console: Debian 13 unprivileged LXC uses `nesting=1`
  for systemd getty. Task 35 enables it on CT1224 if missing, with one clean
  shutdown/start, and verifies `container-getty@1.service`. Console mode stays
  unchanged. The existing Linux user `dh_recorder` can log in at the prompt.
- HOME task **05** stores `DH_POSTGRES_PASSWORD` as a Semaphore secret.
  It also stores `DH_RECORDER_SSH_PASSWORD` for the dedicated Linux SSH user
  `dh_recorder` (no sudo). Empty Survey input retains existing secrets.
  Do not store them in Git.
- PostgreSQL 17 (native Debian package) service and database `homeassistant` with **UTF8** encoding
  and `postgres` owner; existing DB is preserved and wrong encoding blocks
  the run rather than recreating it.
- PostgreSQL TCP authentication with SCRAM is limited to HOME HAOS (.222)
  and HOME Uptime (.237) for this database. HAOS (.222) can also connect to
  the maintenance database `postgres` using SCRAM. HAOS Recorder configuration
  belongs to its own project and is **not** changed by HOME task 35.
- Task 35 installs OpenSSH and provisions `dh_recorder` with its own password
  for DH Recorder App disk monitoring. SQL monitoring uses `postgres`.
- Task 33 excludes CT1224 from new and existing managed PBS schedules.
  No SQL dump or SQLite migration. After failure, provision an empty CT/DB.
  Existing historical backups are not deleted. A fresh CT has a new SSH host
  key; validate it before updating the Recorder App's stored SSH host key.

## Task 36: Uptime Kuma

- Dedicated Debian 13 LXC **CT1237**, IP **HOME .237**, 1 vCPU,
  1024 MiB RAM, 512 MiB swap, 12 GiB on `local-lvm`.
- Official **Uptime Kuma 2.5.11**, native Node.js + systemd, local SQLite.
  Persistent data: `/var/lib/uptime-kuma/data`.
- HOME task **05** stores Uptime admin username/password and optional Telegram
  Bot Token/Chat ID in Semaphore secrets. Task 36 initializes an empty SQLite
  database and first admin automatically using upstream Socket.IO `setup`.
  Existing passwords, monitors and database remain unchanged on reruns.
- HOME task 36 uses authenticated upstream Socket.IO `add` to create **only
  missing** monitors with a 60-second interval and attaches `HOME Telegram`
  notifications (where configured). Telegram is created only once, after
  a successful upstream `testNotification` call. It never duplicates monitors.

| Monitor | Upstream type | Target |
| --- | --- | --- |
| HOME PVE | Ping | HOME `.220` |
| HOME PBS | Ping | HOME `.223` |
| HOME PostgreSQL | PostgreSQL | HOME `.224:5432`, DB `homeassistant`, user `postgres`, query `SELECT 1` |
| HOME MQTT broker | TCP Port | HOME `.222:1883` |
| HOME Internet | HTTP(s) | `https://www.cloudflare.com/cdn-cgi/trace` (HTTP 200) |
| HOME HAOS | Ping | HOME `.222` |
| HOME gateway | Ping | PVE default gateway (not hard-coded) |

**PostgreSQL monitor requires `DH_POSTGRES_PASSWORD` in task 05.** Without
this secret, task 36 creates the other six monitors and reports
`POSTGRES=WAITING_TASK05`; on the next run after credential entry it creates
the actual `SELECT 1` monitor. Task 35 must create CT1224 and database
`homeassistant` for this monitor to become green. No dummy SQL credentials,
false-positive TCP substitution, or unrelated guests.

ICMP is permitted for ordinary LXC users via persistent
`net.ipv4.ping_group_range = 0 65535`, without running Uptime as root.
The task uses Uptime Kuma's application API and never modifies its SQLite
directly. UI remains accessible only on the HOME LAN.

## Boundaries

These tasks operate **only on the local HOME PVE**, creating their own LXC.
They do not modify CORE, Cloudflare, media VM, backup jobs,
or unrelated VM/LXC (task 33 separately manages the PBS exclusions). Destructive recreation is not supported.

## Task 37: HAOS PostgreSQL Recorder

Existing HOME HAOS VM2222 (.222) is managed through PVE QEMU Guest Agent, no new SSH service or API token. Task 37 connects the native Recorder to CT1224 (.224) using the task 05 PostgreSQL secret. It preserves existing Recorder options, validates HA Core configuration and verifies fresh states in PostgreSQL. Existing SQLite data is untouched; no migration. The audit mode does not make changes. A single existing Recorder package is supported; existing !secret keys are reused. If the DH Recorder App is already installed, task 37 also configures its PostgreSQL and storage SSH settings through the native Supervisor options API, preserving other options including telemetry. It does not install a new app.
