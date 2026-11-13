# №34 — HOME PBS Push Sync → CORE PBS и Restore через Tailscale

**Актуальная реализация:** `playbooks/media34-core-pbs.yml`.
Старый `apply` для создания HOME read-only token под CORE Pull выведен из управления.
Исторические Pull-логи в Git сохранены; ни текущий `audit`, ни `prepare`
не создают токен для центрального Pull и не меняют CORE.

## Подтверждённый пилот serzhan-home (13.11.2026)

- HOME PVE `192.168.11.220`, HOME PBS VM2223 `192.168.11.223`.
- Действующий локальный PBS datastore `pbs-serzhan` на
  `/serzhan-pool/pbs-serzhan`.
- HOME PVE: job `dh-local-pbs-serzhan` в 02:00, с исключением media/PBS
  VM2223. Старый backup job `dh-backup-critical-daily` в 03:00
  использует `dh_media_backups` и остаётся без изменений.
- HOME PBS Tailscale `100.88.184.103` → CORE PBS
  `100.97.126.67:8007`, DNS/default route не меняются.
- №34 старой версии Job #120: `success changed=0 failed=0`, datastore
  подтверждён. Это **не** подтверждение наличия snapshots в CORE.
- CORE №50 пока отвечает только за аудит и должен отдельно предоставить
  namespace + credentials. HOME не меняет центральный PBS.

## Разделение действий №34

- **audit (по умолчанию)**: проверяет inventory, местный datastore,
  работающий Tailscale PBS, маршрут `dev tailscale0` до CORE, TLS SHA-256
  сертификата CORE PBS **как наблюдаемое значение**, Remote и Sync Job.
  Никаких Remote/Job/VM/storage записей не меняет.
- **prepare**: требует CORE-issued Push token и проверенный **вне HOME**
  TLS fingerprint в HOME №05, сравнивает с живым TLS по Tailscale. Через
  стандартный localhost PBS API (билет `root@pam` на PBS) создаёт
  Remote `core-<home-id>` и `push-<home-id>` с направлением
  `sync-direction=push`, `remote-store=pbs-core`,
  `remote-ns=<home-id>`, `remove-vanished=0`.
  Расписание НЕ создаёт; идемпотентно проверяет уже созданное.
- **push**: требует существующие Remote и Push Job с правильным
  источником, назначением, namespace и политикой удаления. Только
  запускает `proxmox-backup-manager sync-job run push-<home-id>`.
  Не запускается автоматически после `prepare`.
- **restore-storage**: через pinned SSH на HOME PVE подключает
  `pbs-core-restore` — native PVE PBS storage с CORE read-only Restore
  token и namespace `<home-id>`. Токен передаётся в штатный PVE
  password prompt через stdin, не в аргументах процесса. Отказывает,
  если storage ID занят или какой-либо HOME backup job использует
  `pbs-core-restore`. Ничего не восстанавливает автоматически.

**Не путать:** `restore-storage` проверяет доступ к storage; реальный
тест восстановления VM/CT в отдельный VMID нужен как отдельный этап
приёмки с выбором конкретной копии, и не должен затирать существующий
гость.

## Подготовка на CORE №50 (до HOME prepare)

CORE сам создаёт/проверяет `pbs-core/<home-id>` namespace и выдаёт
**две разные идентичности с одинаковым типом прав для всех домов**:

1. **Push** — право отправлять в свой namespace (например, подроль
   `DatastoreBackup` для CORE PBS), без управления retention, prune,
   verify, соседними namespaces, удалением чужих snapshots.
2. **Restore** — права читать/аудировать свой namespace
   (например, `DatastoreReader` + `DatastoreAudit` при необходимости),
   **без** `Datastore.Backup`: PVE не сможет отправлять новые
   backups в CORE по этому токену.
3. CORE записывает проверенный TLS fingerprint **с собственного
   доверенного CORE PBS**, не подменяя его значением, просто
   наблюдаемым HOME через интернет/tailnet.

В HOME Semaphore №05 оператор сохраняет:

| Поле №05 | Native Semaphore переменная | Тип |
|---|---|---|
| CORE PBS Push Auth ID | `DH_CORE_PBS_PUSH_AUTH_ID` | обычная |
| CORE PBS Push Token Secret | `DH_CORE_PBS_PUSH_TOKEN_SECRET` | Secret |
| CORE PBS TLS fingerprint | `DH_CORE_PBS_FINGERPRINT` | обычная |
| CORE PBS Restore Auth ID | `DH_CORE_PBS_RESTORE_AUTH_ID` | обычная |
| CORE PBS Restore Token Secret | `DH_CORE_PBS_RESTORE_TOKEN_SECRET` | Secret |

Существующий HOME №05 `DH_MEDIA_ROOT_PASSWORD` служит только
для получения короткоживущего **localhost** PBS root@pam ticket.
Не выводить ticket/CSRF/token в Git, CLI, Semaphore logs или чат.
CORE credentials не выдаются в HOME и HOME не настраивает CORE.

## Приёмка end-to-end

1. HOME №34 `audit`: source, route, TLS/remote status.
2. CORE №50: namespace, Push token, Restore token, доверенный fingerprint.
3. HOME №05: сохранить пять полей, пустые старые значения не сбрасывать.
4. HOME №34 `prepare`, затем вручную `push` по фактическим
   непустым snapshot groups на локальном PBS.
5. CORE №50: подтвердить snapshot в **правильном** namespace,
   ACL/owner, Verify и отсутствие чужих данных; повторный Push не
   переписывает историю, `remove-vanished=false`.
6. HOME №34 `restore-storage`; восстановить в **отдельный** VMID,
   убедиться в запуске тестового гостя и целостности данных.
7. Только после успешного пилота согласовать Schedule Push после
   локального backup (текущее локальное окно начинается 02:00,
   время завершения следует проверить), retention в CORE и
   остальные HOME. Нет автоматической синхронизации, пока E2E
   не выполнен.

B2 вне текущего этапа. Никаких операций с ZFS,
backup jobs `dh-local-pbs-serzhan`, исходным datastore,
Cloudflare или Tailscale здесь нет.

---

## Архив — прежняя HOME №34 CORE Pull, больше не целевая схема

# №34 — исторический пилот CORE Pull (устаревшая архитектура)

**С 13.11.2026 принята модель HOME Push → CORE PBS + прямой Restore. Данный документ сохраняет историю пилота read-only Pull; не использовать его как актуальную инструкцию по подключению новых домов.** См. [архитектуру HOME Push](architecture-home-backup.md). Токен `root@pam!core-pull` пока не удаляем до завершения миграционных испытаний.

Состояние: **HOME PBS datastore и CORE read-only token готовы** (13.11.2026).
Успешный destructive test медиасервера №30 #97: `VM2223`, IP `192.168.11.223`, `recreate + erase` (старая информация о ZFS и Hitachi ниже относится к состоянию **до** этого запуска).
№33 #98: `Success`, создан и смонтирован `serzhan-pool/pbs-serzhan`, зарегистрированы PBS datastore/PVE Storage `pbs-serzhan`, расписание `dh-local-pbs-serzhan`.
№34 #102: `Success` — создан `root@pam!core-pull`, ACL `DatastoreReader` и `DatastoreAudit` **только** на `/datastore/pbs-serzhan`, проверено чтение namespaces/groups через токен, сохранён секрет `0600` на HOME и DEV.
№34 #103: `Success`, `changed=0`, `failed=0` — повторный apply не изменил токен, ACL и секреты.
№34 #107: `Success`, `changed=1`, `failed=0` — вручную создан первый резервный snapshot действующего HOME LXC `uptimekuma`, CT200, через `vzdump` в `pbs-serzhan`. Backup Job, расписания и retention не изменены.
№34 #108: `Success`, `changed=0`, `failed=0` — существующий ограниченный CORE token видит backup group `ct/200`, ровно **1 snapshot** и список его файлов в root namespace. Ротации токена не было.
Одноразовое действие `backup_test` удалено из штатного №34 после приёмки; историю теста сохраняют Git и Semaphore. Штатные режимы №34 остались `audit` и `apply`.
**Передача секрета в CORE Semaphore №05:** пока не выполнена — защищённая операция записи была заблокирована средой. Секрет остаётся только в защищённом файле DEV, CORE credentials не изменены. Планируемое имя secret: `DH_CORE50_HOME_SERZHAN_PBS_API_TOKEN`. Использовать разрешённый механизм управления существующей Variable Group CORE, не публиковать значение в чат или Git.

**Актуальный TLS SHA-256 после пересоздания VM:** `4D:B5:B7:23:8A:73:91:68:49:9C:86:62:05:08:2B:16:9A:D9:47:21:DD:94:5C:EE:51:6D:90:8C:08:CA:FA:BD`. Старый SHA-256 ниже **недействителен**.

**Параметры для CORE №50:** Remote `192.168.11.223:8007`, source datastore `pbs-serzhan`, namespace root `/` (в API `ns: ""`), Token ID `root@pam!core-pull`. Секрет только в `/home/dev/.config/ansible-home/serzhan-home-pbs-core-pull.secret`, mode `0600`; в CORE Semaphore №05 ввести через защищённый secret-параметр, **не копировать в чат или Git**. Подтверждены `ct/200` и **один snapshot**, видимый CORE read-only token. Secret ещё не записан в CORE Semaphore. CORE не менялся.

### Исторический аудит до destructive test

Следующие данные описывают исходное состояние до №30 #97 и сохраняются только для диагностики.
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

## Причина отсутствия datastore — подтверждена дополнительными аудитами

- №34 **#92, #94, #95**: read-only `Success`, `changed=0`. PBS не содержит зарегистрированных datastore, потому что **№33 ни разу не запускалась** (0 запусков в истории HOME Semaphore, template ID 8), и ZFS dataset `serzhan-pool/pbs-serzhan` отсутствует.
- Действующий `serzhan-pool` **ONLINE**, объём **928 GiB**, занято **140 GiB**, свободно около **788 GiB**. На нём находятся `serzhan-pool/media` (~121 GiB) и `serzhan-pool/backups` (~19,1 GiB). Существующие данные не трогали.
- В VM2223 реально передан **Samsung SSD 850 EVO 1TB**, /dev/sdb (serial `S2PWNX0H603177N`), pool GUID `16678039401487878364`, backing `/dev/disk/by-id/wwn-0x5002538d41046527-part1`.
- GitHub site media manifest всё ещё описывает **Hitachi HDD 4 TB**, serial `PK1331PAGH7VHS`, pool GUID `40733622006301358`, не совпадающий с рабочим пулом. Сам HOME PVE видит системный NVMe **Samsung 990 EVO 1TB**; его SATA-контроллер `0000:00:17.0` передан VM2223, в которой виден Samsung SSD 850 EVO 1TB, **Hitachi в гостевой VM не обнаружен**.
- Успешный деплой №30 **#38 (2026-11-11)** использовал `DH_MEDIA_VM_ACTION=recreate` и `DH_MEDIA_DISK_ACTION=import`, т.е. импортировал уже существующий ZFS-пул Samsung, не создавая новый 4 TB пул.
- На PVE остался старый enabled backup job `dh-backup-critical-daily`, расписание `03:00`, storage `dh_media_backups`; этот storage **отсутствует** в PVE (`local` и `local-lvm` только). В job указаны старые VMID, а не текущая архитектура HOME. Это не штатная локальная PBS backup job.
- **Решение до создания datastore:** привести канонический media manifest в соответствие с фактическим диском **либо** вернуть ожидаемый 4 TB диск. После фиксации целевого физического диска — адресно создать `serzhan-pool/pbs-serzhan` и зарегистрировать PBS datastore. Только потом подключать PVE Storage и настраивать реальные резервные копии через профильную №33. Запускать полную №33 с устаревшим manifest или менять существующий backup job без отдельной проверки недопустимо.

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
