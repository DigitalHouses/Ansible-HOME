# HOME backup: Push to CORE and direct Restore

**Решение принято 13.11.2026.** Проект DigitalHouses/Ansible-HOME.
Прежняя модель CORE Pull устарела; реальный Push/Restore ещё не реализован.

## Потоки и ответственность

- HOME PVE создаёт локальные backup VM/LXC в HOME PBS (№33); локальный PBS автономен.
- HOME PBS самостоятельно инициирует **PBS Push Sync** к CORE PBS на Tailscale `100.97.126.67:8007`, datastore `pbs-core`, destination namespace `<site-id>`. Для центральной истории `remove-vanished=false`.
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
| №70 Cloudflare | Веб-доступ через Tunnel + Access, без WARP |
| №71 Tailscale | Приватная связность HOME PVE и PBS с CORE PBS; контролируемые обновления |

## Защищённый транспорт — Tailscale (решение 13.11.2026)

- CORE PVE `100.64.243.13`, CORE PBS `100.97.126.67:8007` уже подключены к общему tailnet. CORE WARP удалён; HOME не изменяет CORE.
- HOME PVE уже имеет Tailscale как резервный административный путь. HOME PBS подключается самостоятельным клиентом через HOME №71 (`audit/install/configure/join/update`). Home Assistant этой задачей не изменяется.
- HOME PVE и HOME PBS независимо обращаются к **одному Tailscale адресу CORE PBS** для Restore и Push соответственно. Это не означает общего TCP-сеанса; не требуется сетевой шлюз или маршрутизация LAN через PVE.
- Действующие LAN DNS и default route не менять: `accept-dns=false`, `accept-routes=false`, без exit node/subnet routing. Совпадающие подсети `192.168.11.0/24` не мешают, потому что используются конкретные Tailscale IP.
- Cloudflare Tunnel + Access остаются для веб-интерфейсов. Ранее опробованный Cloudflare private route CORE → HOME `192.168.11.223/32` и план WARP HOME → CORE — **история, не целевая схема**. Не удалять legacy route до отдельной проверки необходимости, но новый PBS Push через него не строить.
- Транспорт проверять из обоих HOME источников, с подтверждением доступа `100.97.126.67:8007`, затем native PBS Push/Restore E2E. Простое HTTP 200/401 не подтверждает корректное резервирование.

## Принятый порядок аварийного восстановления

1. Установить PVE на новом/восстановленном сервере и выполнить HOME bootstrap.
2. В №30 развернуть Media VM; `create + import` если прежний физический диск и ZFS сохранились. На полностью утраченном диске `import` невозможен — только отдельное явное создание нового пула.
3. Если локальный PBS и его snapshots сохранились — восстановить из него.
4. Иначе восстановить HOME → CORE маршрут и credentials из **внешней защищённой копии**, подключить CORE PBS на HOME PVE и восстановить VM/LXC в безопасный тестовый VMID, затем штатные VMID.
5. Для зашифрованных PBS копий обеспечить независимое хранение ключей; Push сам по себе не доказывает восстановимость.

Backblaze B2, MQTT и расписание Push Sync до E2E пилота не внедрять.

## Исторический read-only аудит №70 (до решения Tailscale)

- #110: Success, changed=0 — действующий Tunnel `serzhan-home` healthy, PVE `cloudflared` active, один connector.
- #111: Success — проверены PVE и Media VM; внешний конфиг не менялся.
- #112: **Success, changed=0 failed=0** — PVE `192.168.11.220` имеет локальный маршрут к CORE PBS через `vmbr0`; диагностический HTTPS `401`. Media VM `192.168.11.223` имеет локальный маршрут через `eth0`; HTTPS timeout (curl 28). На обоих WARP отсутствует. Защищённого HOME → CORE ещё нет.
- Код read-only проверки `tasks/cf70-home-to-core-audit.yml` запускается только в пилотном `serzhan-home` и только при №70 `audit`. Ни HOME, ни CORE networking не менялись.
