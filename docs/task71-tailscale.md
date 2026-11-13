# HOME №71 — Tailscale для PVE и локального PBS

Дата решения: 13.11.2026. Область: `DigitalHouses/Ansible-HOME` и Semaphore каждого HOME; CORE в этом репозитории не изменяем.

## Цель

В каждом HOME обслуживать два Linux-узла в общем DigitalHouses tailnet:

- HOME PVE: существующий Tailscale сохраняет регистрацию и резервный административный доступ.
- HOME PBS: самостоятельный Tailscale-клиент на реально обнаруженном PBS-хосте. В пилоте `serzhan-home` это Media VM2223 (`192.168.11.223`); адрес/VMID берётся из приватного HOME `media_vm.yml`, а не жёстко записывается в задаче.
- Home Assistant: имеющийся клиент не трогаем. Это другой способ установки и будущая отдельная задача.

CORE уже принят: `dh-core-pve` = `100.64.243.13`, `dh-core-pbs` = `100.97.126.67:8007`. На CORE PBS пакет WARP удалён; Cloudflare Tunnel/Access по-прежнему обслуживают веб-интерфейсы.

## Semaphore

Шаблон `71-Tailscale`, playbook `playbooks/home-tailscale.yml`:

- `DH_HOME71_ACTION`: `audit` (default), `install`, `configure`, `join`, `update`.
- `DH_HOME71_TARGET`: `pve`, `pbs`, `both` (default). При `both` — последовательно PVE, затем PBS (`serial: 1`).
- Штатная №05 имеет дополнительное секретное поле `DH_INPUT_TAILSCALE_AUTH_KEY`. Оно сохраняется как native Semaphore Secret `DH_TAILSCALE_AUTH_KEY` в существующей Variable Group. Пустой ввод оставляет прежний ключ.
- Ключ используется только при `join` неприсоединённого устройства; передаётся через временный файл `/run/dh-home71-tailscale-auth-key` с правами `0600`, затем удаляется. Ни Git, ни журнал, ни аргументы CLI не содержат значение ключа.

## Безопасные действия

| Action | Эффект |
|---|---|
| `audit` | Только чтение состояния клиента, версии, DNS/default route и проверка доступности CORE PBS по Tailscale IP. Не устанавливает ПО |
| `install` | Официальный stable APT Debian и только пакет `tailscale`, без регистрации узла |
| `configure` | Только для клиента в состоянии Running; при необходимости `tailscale set` безопасных параметров |
| `join` | Не разлогинивает существующий Running-клиент; новый клиент входит в тот же tailnet через секрет №05 |
| `update` | Только установленный пакет Tailscale до актуальной stable версии, без `apt upgrade`, ядра и reboot |

Общий профиль: `accept-dns=false`, `accept-routes=false`, пустой exit node и advertised routes, `advertise-exit-node=false`, `auto-update=false`. Не используем subnet router, exit node, Tailscale SSH без отдельного решения. Уникальные Tailscale IP `100.64.0.0/10` разрешены; не удаляем локальный доступ в tailnet.

Перед и после любого действия проверяем `ip -4 route get 1.1.1.1`, `/etc/resolv.conf` и DNS на default интерфейсе через `resolvectl`, если доступен. На PVE и PBS используется уже закреплённый SSH Semaphore: для PBS — `media80_known_hosts`. При изменении LAN DNS/default route — явный failed, массовое применение останавливается. Реальные локальные Backup Jobs/PBS, Cloudflare Tunnel и HA не изменяются.

## Приёмка на serzhan-home

1. HOME №00 обновляет каталог, создаёт №71 и добавляет поле №05, не выполняя задач №71.
2. `71 / audit / both`: определить фактический статус/версию/IP PVE и PBS без изменений.
3. Если PBS не установлен: `71 / install / pbs`; затем в HOME №05 внести Tailscale auth key (native Secret), `71 / join / pbs`.
4. На существующем PVE при необходимости выполнить `71 / configure / pve`. Регистрировать его повторно нельзя, пока состояние Running.
5. Подтвердить реальный сетевой доступ HOME PBS и PVE к CORE PBS `100.97.126.67:8007`; наличие TCP порта само по себе не означает успешный TLS/PBS Push/Restore.
6. HOME №34: отдельно настроить native PBS Remote, Push Sync в `pbs-core/<home-id>` с `remove-vanished=false`, проверить ручную отправку и повтор.
7. HOME PVE: прямое Restore тестовой VM/LXC из CORE PBS в отдельный VMID. Только затем принимать E2E.

CORE №50 готовит namespace и разные по назначению PBS Push/Restore credentials; HOME №71 ими не управляет.

## Плановые обновления

После проверки расписаний локальных Backup Jobs — создать Semaphore Schedule `71/update/both`. Кандидат: воскресенье ночью по местному времени дома; не пересекать CORE №71, большие PBS sync и HOME №70 `cloudflared`. Точное UTC cron установить по часовому поясу действующего Semaphore. Сохранить возможность ручного `update` и историю ошибок. Сначала ручной `update`/идемпотентность, затем активировать Schedule.

Cloudflare №70 остаётся единственным контроллером Tunnel/Access, включая отдельное будущее обновление `cloudflared`. HOME WARP не нужен; уже действующий private PBS Cloudflare route сохраняется лишь как legacy до отдельной безопасной очистки после E2E.

Backblaze B2, MQTT и обновление Tailscale внутри HA сейчас не входят в задачу.
