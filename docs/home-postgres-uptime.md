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
- Official **Uptime Kuma 2.5.11** from a fixed upstream release tag;
  native Node.js + systemd. State in `/var/lib/uptime-kuma/data`.
  Repeated task 36 runs do not reset database, passwords or monitors.
- Upstream Uptime Kuma has no supported REST CRUD API for monitors.
  HOME **does not ship a custom Socket.IO/Python orchestrator and does not
  write directly to Kuma's SQLite database**. On the first install, create
  the admin account and these monitors **once in the native web UI**.
  They persist in the LXC and are covered by existing HOME PBS backups.

### Required seven monitors (initial upstream UI setup)

| Name | Type | Target |
| --- | --- | --- |
| HOME PVE | Ping (ICMP) | `<HOME subnet>.220` |
| HOME PBS | Ping (ICMP) | `<HOME subnet>.223` |
| HOME PostgreSQL | PostgreSQL | `<HOME subnet>.224:5432`, database `homeassistant`, user `postgres`, SQL `SELECT 1`; connection string `postgresql://postgres:<URL-encoded-task05-password>@<HOME subnet>.224:5432/homeassistant` |
| HOME MQTT broker | TCP Port | `<HOME subnet>.222:1883` (broker port availability; not authenticated publish/subscribe) |
| HOME Internet | HTTP(s) | `https://www.cloudflare.com/cdn-cgi/trace`, expected HTTP 200 |
| HOME HAOS | Ping (ICMP) | `<HOME subnet>.222` |
| HOME gateway | Ping (ICMP) | Read default gateway of HOME PVE (currently `192.168.11.1`) |

Use 60-second intervals initially. Ping requires the guest `iputils-ping` package, installed by task 36. Do not copy/overwrite Telegram notifiers
or existing monitor IDs. Preserve `kuma.db` and its companion SQLite files
through every redeployment. No exposure of Uptime UI outside LAN is created
by task 36.

## Boundaries

These tasks operate **only on the local HOME PVE**, creating their own LXC.
They do not modify CORE, Cloudflare, media VM, existing backup jobs,
or unrelated VM/LXC. Destructive recreation is not supported.

## Optional Socket.IO pilot (HOME task 36)

Uptime Kuma 2.5.11 internally exposes authenticated Socket.IO methods (`login`, `add`,
`addNotification`, `testNotification`). HOME task **05** optionally saves existing
Uptime administrator login/password and Telegram Bot Token/Chat ID as protected
Semaphore secrets. Never store them in Git or paste them into job logs.

When the two administrator credentials are present, task 36 performs a single
idempotent pilot: create **HOME PVE** ICMP monitor for HOME `.220` at 60 seconds,
only when absent. Telegram is optional: when both Bot Token and Chat ID are
present, verify delivery via `testNotification`, create a named `HOME Telegram`
notification if absent, and attach it to the new monitor. Existing monitor and
notification records are not overwritten or duplicated. The script is supplied
to the guest via stdin and does not persist credentials or change the database
outside the application API. If Telegram is added after the monitor already
exists, the pilot does **not** silently rewrite the monitor's bindings; it reports
`LINKED=false` for separate reconciliation.

This is a **pilot for pinned v2.5.11**, not a claim that Socket.IO is a stable
third-party API. Monitor CRUD via an official REST API is not available in this
release. The remaining six monitors are intentionally out of scope until the
pilot succeeds on the live HOME installation.

### Fully unattended first-run initialization

On a brand-new CT1237, task 36 writes the official Uptime Kuma SQLite
`db-config.json` only when neither it nor `kuma.db` exists; existing state is
untouched. If the task 05 Uptime administrator credentials are present, the
Socket.IO client first calls `needSetup`; only when it returns `true` does it
create the first user with upstream `setup(username, password)` and then log in.
If a user already exists, it attempts login with the saved credentials and
**refuses to overwrite or reset** the account if login fails. Password changes
of an existing admin are intentionally not implicit (the `changePassword`
endpoint requires the old password). This preserves recovered Uptime states.

Once logged in, the existing single-monitor/Telegram pilot runs as before.
For completely unattended fresh deployment, supply Uptime credentials in HOME
Task 05 before Task 36. Never run Task 05 with missing credentials expecting
it to invent an admin password.
