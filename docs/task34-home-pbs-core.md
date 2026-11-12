# №34 — HOME PBS для центрального CORE Pull Sync

Состояние: **аудит завершён; создание токена заблокировано отсутствием источника** (13.11.2026).
Проект `DigitalHouses/Ansible-HOME`, Semaphore `serzhan-home` project ID 1, шаблон **ID 11**.
Режимы: `audit` (по умолчанию, без изменений), `apply` (только после появления исходного datastore).

## Подтверждённые результаты

- Read-only аудит №34 **#90 Success**, `changed=0`, `failed=0`.
- HOME PBS: `mediaserver-serzhan`, VM2223, `192.168.11.223:8007`. PBS **4.2.10**, `proxmox-backup-proxy.service=active`.
- `proxmox-backup-manager datastore list --output-format json`: **`[]`**.
- Ожидаемый `pbs-serzhan` **не зарегистрирован**; ZFS dataset `serzhan-pool/pbs-serzhan` **не найден**. Следовательно, нет доступных для pull namespaces, backup groups и snapshots.
- Пользователи PBS: только `root@pam`. PBS API Tokens: **нет**; ACL: **нет**.
- PBS TLS SHA-256 со стороны HOME подтверждён нативным OpenSSL и независимо с DEV:
  `69:B6:A4:47:18:B2:B9:87:F3:40:2B:16:96:04:73:E9:8B:E0:5E:53:5F:DA:F2:11:EA:56:D2:ED:08:CB:54:DB`.
- На HOME PVE `192.168.11.220` read-only аудит обнаружил Backup Job с целью `dh_media_backups`, тогда как список зарегистрированных PVE Storage — только `local` и `local-lvm`. Расхождение нуждается в разборе в локальной задаче №33; задача №34 его **не исправляет**.

## Что подготовлено, но не применено

Новый playbook `playbooks/media34-core-pbs.yml` и задачи `tasks/media34-core-pull-token.yml` реализуют:

1. Preflight через существующий доверенный SSH `Semaphore Runner → Media VM`; сверка site inventory, PBS service, datastore и TLS SHA-256.
2. Создание **одного** токена `root@pam!core-pull` только при `apply`, после проверки реального `pbs-serzhan`.
3. Только роли `DatastoreReader` и `DatastoreAudit` на `/datastore/pbs-serzhan`. Без прав записи, удаления, Prune или управления заданиями.
4. Однократный защищённый secret: `/etc/digitalhouses/pbs-core-pull.token` на HOME Media VM, `root:root 0600`, без вывода в Ansible/Semaphore logs, Git или чат. Прежние пользователи/токены/ACL не меняются.
5. Read-only проверка полного списка backup groups, snapshots и namespaces через новый токен и повторного ACL. После проверки тот же секрет передаётся существующим SSH-каналом Runner → DEV в файл `/home/dev/.config/ansible-home/serzhan-home-pbs-core-pull.secret`, `dev:dev 0600`. Он предназначен для ручного ввода в защищённый секретный параметр **CORE Semaphore №05**. **CORE не меняется автоматически**.
6. Повторный `apply` использует существующие токен и файл, не перевыпуская их.

**Важно:** шаги 2–6 пока НЕ выполнялись, секрет ещё не существует. `apply` останавливается на проверке отсутствующего datastore **до** создания токена.

## Что необходимо до CORE №50

1. В профильной задаче Ansible-HOME №33 отдельно довести до готовности источник `pbs-serzhan` (ZFS dataset + PBS datastore). Провести проверку локальных PVE Storage/Backup Job, без автоматического удаления и без несанкционированного изменения retention.
2. Получить реальные резервные копии на HOME PBS и подтвердить группы/namespace.
3. Повторить №34 `audit`, затем явно №34 `apply`; проверить ACL, read-only API и идемпотентность.
4. Только после этого передать CORE параметры Remote: `192.168.11.223:8007`, source datastore `pbs-serzhan`, namespace из реального аудита, token ID `root@pam!core-pull`, fingerprint выше, secret из защищённого DEV файла в CORE №05.

CORE №40 (Cloudflare WARP) принят. Никакие CORE/VPN/Cloudflare, существующие backup jobs, retention, storage или пользователи не изменялись этим аудитом.
