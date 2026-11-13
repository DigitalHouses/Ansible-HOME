# HOME backup: Push to CORE and direct Restore

**Решение принято 13.11.2026.** Проект DigitalHouses/Ansible-HOME.
Прежняя модель CORE Pull устарела; реальный Push/Restore ещё не реализован.

## Потоки и ответственность

- HOME PVE создаёт локальные backup VM/LXC в HOME PBS (№33); локальный PBS автономен.
- HOME PBS самостоятельно инициирует **PBS Push Sync** к CORE PBS на `192.168.11.243:8007`, datastore `pbs-core`, destination namespace `<site-id>`. Для центральной истории `remove-vanished=false`.
- HOME PVE отдельно подключает CORE PBS только для **Restore**, через то же защищённое направление HOME → CORE, с read credentials своего namespace.
- CORE владеет namespace, Push/Restore credentials и центральной политикой хранения, Verify и Restore-тестами. HOME управляет локальными задачами и своим Push Sync. Режим CORE Pull и HOME `root@pam!core-pull` — исторические, **не удалять до завершения пилотов**.
- Каждый дом уникален по namespace и credentials. CORE №10 HOME Registry пока не реализован.

## Существующие задачи HOME

| Задача | Ответственность |
| --- | --- |
| №05 HOME Credentials | Хранит выданные CORE Push и Restore credentials и TLS fingerprint CORE |
| №30 Media Server | Развертывает VM, PBS и ZFS; `import` существующего диска или явно разрешённый `erase` |
| №33 Local Backup | Рабочие локальные PBS datastore, PVE Backup Jobs и обслуживание |
| №34 Central Backup (план) | HOME PBS Remote, Push Sync, ручной пилот и восстановление; текущая Pull-реализация историческая |
| №70 Cloudflare | Защищённый маршрут HOME → CORE; существующий CORE → HOME сохраняется |

## Защищённый транспорт

- Один **сетевой маршрут** HOME → CORE PBS `192.168.11.243/32` используется двумя исходящими приложениями: Push от HOME PBS и Restore от HOME PVE. Это не требование единственного TCP-сеанса или WARP-инстанса.
- Поддерживаемый минимальный пилот: headless Cloudflare One Client **на каждом из двух endpoint-хостов**, HOME PVE и Media VM. Один CORE private CIDR route. Не создавать новые публичные адреса или Mesh по умолчанию.
- WARP endpoint не рассматриваем как штатный сетевой шлюз для других хостов. Имеющийся `cloudflared` на HOME PVE остаётся самостоятельным входящим коннектором.
- Для HOME c совпадающими подсетями строго ограниченный /32 и подтверждение эффективного пути из каждого источника обязательны.
- **Транспорт не активировать без отдельного согласования**, пока CORE в своём проекте не подтвердит свой connector, CIDR route и enroll credentials. Любой `HTTP 200/401` без подтверждения WARP пути не является доказательством.
- При включении клиента обеспечить проверку переподключения после перезапуска и rollback, не ломая HOME Tunnel.

## Принятый порядок аварийного восстановления

1. Установить PVE на новом/восстановленном сервере и выполнить HOME bootstrap.
2. В №30 развернуть Media VM; `create + import` если прежний физический диск и ZFS сохранились. На полностью утраченном диске `import` невозможен — только отдельное явное создание нового пула.
3. Если локальный PBS и его snapshots сохранились — восстановить из него.
4. Иначе восстановить HOME → CORE маршрут и credentials из **внешней защищённой копии**, подключить CORE PBS на HOME PVE и восстановить VM/LXC в безопасный тестовый VMID, затем штатные VMID.
5. Для зашифрованных PBS копий обеспечить независимое хранение ключей; Push сам по себе не доказывает восстановимость.

Backblaze B2, MQTT и расписание Push Sync до E2E пилота не внедрять.

## Read-only аудит №70

- #110: Success, changed=0 — действующий Tunnel `serzhan-home` healthy, PVE `cloudflared` active, один connector.
- #111: Success — проверены PVE и Media VM; внешний конфиг не менялся.
- #112: **Success, changed=0 failed=0** — PVE `192.168.11.220` имеет локальный маршрут к CORE PBS через `vmbr0`; диагностический HTTPS `401`. Media VM `192.168.11.223` имеет локальный маршрут через `eth0`; HTTPS timeout (curl 28). На обоих WARP отсутствует. Защищённого HOME → CORE ещё нет.
- Код read-only проверки `tasks/cf70-home-to-core-audit.yml` запускается только в пилотном `serzhan-home` и только при №70 `audit`. Ни HOME, ни CORE networking не менялись.
