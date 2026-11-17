# HOME PostgreSQL and Uptime Kuma

## Task 35: PostgreSQL

- Dedicated Debian 13 LXC **CT1224**, IP **HOME .224**, 2 vCPU, 512 MiB RAM,
  512 MiB swap, 100 GiB on `local-lvm`; existing CT never recreated.
- HOME task **05** stores `DH_POSTGRES_PASSWORD` as a Semaphore secret.
  Empty Survey input retains the existing secret. Do not store it in Git.
- PostgreSQL service and database `homeassistant` with **UTF8** encoding
  and `postgres` owner; existing DB is preserved and wrong encoding blocks
  the run rather than recreating it.
- PostgreSQL TCP authentication with SCRAM is limited to HOME HAOS (.222)
  and HOME Uptime (.237) for this database. HAOS Recorder configuration
  belongs to its own project and is **not** changed by HOME task 35.
- The existing daily local PVE Backup Job (task 33) covers this CT.
  LXC backup alone does not replace a quiescent SQL dump if point-in-time
  database consistency becomes a requirement.

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
They do not modify CORE, Cloudflare, media VM, existing backup jobs,
or unrelated VM/LXC. Destructive recreation is not supported.
