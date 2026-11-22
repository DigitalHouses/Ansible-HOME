# №70 — Cloudflare HOME

**Состояние на 22.11.2026:** HOME Tunnel на PVE, маршруты Semaphore/Webmin/PBS и защищённый mTLS-доступ к HAOS проверены. Сквозной тест HAOS с клиентским сертификатом — HTTP 200, без сертификата — HTTP 403; вход с iPhone через мобильный интернет подтверждён. Центральный PBS и CORE остаются вне границ этой задачи.

## Архитектура

- Один Cloudflare Tunnel на дом с именем `<site-id>`, без пересоздания и дополнительных Tunnel.
- Коннектор работает на **HOME PVE**. Semaphore Runner не запускает `cloudflared`.
- Все обычные операции Cloudflare выполняет **№70**. №08 занимается API-доступом DEV, а №32 сохранена как исторический шаблон без изменений инфраструктуры.
- Секреты только из штатной №05; без новых сервисов и отдельного контура управления.

Для `serzhan-home`: PVE `192.168.11.220`, Semaphore `CT1221 / 192.168.11.221`, Media `VM2223 / 192.168.11.223`. Tunnel `serzhan-home`, UUID `6a04d9cd-0b17-48f3-8366-9f86ea08cb24`.

## Действия №70

| Действие | Поведение |
| --- | --- |
| **audit** (по умолчанию) | Только читает Tunnel, коннектор, ingress, DNS и Access |
| **migrate** | Перенос существующего коннектора на PVE; при повторе без изменений |
| **publish_semaphore** | Только маршрут `<site-id>-pve-semaphore.digitalhouses.vip` → HTTP Semaphore Runner, порт 80 |
| **publish_webmin** | Только маршрут `<site-id>-pve-mediaserver-admin.digitalhouses.vip` → HTTPS Webmin, порт 10000; IP из приватного media-манифеста |
| **publish_pbs_private** | Private CIDR `<media-ip>/32` → существующий Tunnel на HOME PVE; без публичного PBS hostname, без изменений CORE |
| **update_cloudflared** | Разово обновить только установленный пакет через официальный Cloudflare APT |
| **configure_cloudflared_auto** | Включить штатные автообновления Debian только для `cloudflared` |
| **audit_ha_mtls / publish_ha_mtls** | Проверка / публикация защищённого HAOS через существующий Tunnel |
| **verify_ha_mtls_client** | Проверка локального `.p12`, HAOS и публичного HTTPS с клиентским сертификатом |
| **organize_ha_mtls_client** | Разместить сертификат, пароль импорта и HTTPS-адрес в `DigitalHouses/cert` |
| **repair_pve_ca_pool** | Восстановить публичный CA Proxmox для `cloudflared` и проверить mTLS; идемпотентно |

Публикация выполняется только после проверки origin и действующего ограниченного Access. Существующая CNAME-запись меняет только целевой UUID; другие DNS, маршруты, Access-политики и приложения не изменяются. Если маршрут уже правильно настроен, изменений нет. Любой конфликт чужого DNS или origin — остановка, без пересоздания.

## Автоматические обновления `cloudflared` (HOME PVE)

Один раз запустить №70 с `configure_cloudflared_auto`. Ansible устанавливает
официальный Debian `unattended-upgrades` и один файл
`/etc/apt/apt.conf.d/90-dh-cloudflared-unattended`:

- APT использует существующие `apt-daily.timer` и `apt-daily-upgrade.timer`;
  расписаний Semaphore и дополнительных таймеров на PVE нет.
- Разрешён **только пакет `cloudflared`** из `pkg.cloudflare.com`;
  остальные Debian/Proxmox/ядро не обновляются автоматически.
- Автоматическая перезагрузка PVE и автоматическое удаление зависимостей
  выключены. После замены исполняемого файла штатный APT hook перезапускает
  только устаревшую службу `cloudflared`, если пакет не сделал это сам.
- После применения задача выполняет `unattended-upgrade --dry-run --debug`
  и проверяет эффективную политику APT; дальнейшие запуски идемпотентны.

Сам Tunnel, токен, Cloudflare Access, маршруты и CORE не меняются.
Краткое переподключение Tunnel при обновлении возможно.

## Приёмка на serzhan-home

| Запуск Semaphore | Итог |
| --- | --- |
| №00 #48 | Переименование исторической №15 в №70 без смены ID 9 |
| №70 #60 | Коннектор перенесён на PVE, старая служба Runner отключена |
| №70 #61, #62 | Повторная проверка, `changed=0` |
| №70 #68 | Semaphore: маршрут и существующий CNAME исправлены, `changed=2` |
| №70 #69 | Webmin: маршрут и существующий CNAME исправлены, `changed=2` |
| №70 #70 | Четыре ingress-маршрута и четыре DNS подтверждены |
| №70 #71, #72 | Повторная публикация каждого сервиса: `changed=0`, `failed=0` |
| №00 #81 | Новое действие `publish_pbs_private` добавлено в существующий шаблон №70 (ID 9) |
| №70 #82 | Первый запуск остановлен на проверке исходного HTTP-кода с PVE, до изменений Cloudflare |
| №70 #83 | **PBS private CIDR `192.168.11.223/32` создан**, `changed=1`, `failed=0`; origin PVE→PBS HTTP 200 |
| №70 #84 | Повторный запуск **`changed=0`, `failed=0`**: повторный GET Cloudflare API подтвердил ту же запись и UUID |

Четыре публичных адреса (PVE, File Browser, Semaphore, Webmin) дают анонимному пользователю редирект **HTTP 302 на Cloudflare Access**. Общая wildcard Access-политика содержит email-allow и не содержит Everyone/bypass.

**Шаблоны Semaphore:** №70 — ID 9. Старый №32 — ID 7, остаётся архивным без действующей Cloudflare-операции. История обоих сохраняется. Исходный Ansible-3 и ранние Git-коммиты содержат историческую реализацию №15/№32.

## HOME → CORE: исторический аудит WARP (до перехода на Tailscale)

**Новый стандарт 13.11.2026:** для PBS Push/Restore используем Tailscale
(см. [HOME №71](task71-tailscale.md) и [архитектуру HOME](architecture-home-backup.md)).
Cloudflare WARP не требуется. Ниже — сохранённая история read-only
проверок и ранее предложенного WARP-пути, **не инструкция к его внедрению**.
HOME №70 продолжает обслуживать Cloudflare Tunnel/Access для веб-доступа.
Private route `192.168.11.223/32` пока оставляем как legacy без применения к PBS Push.

**Новая целевая модель:** HOME PBS сам отправляет копии в CORE PBS по штатному PBS Push Sync, а HOME PVE использует этот же защищённый **сетевой маршрут** для прямого Restore. Бывшая схема CORE Pull и её `root@pam!core-pull` токен устарели; токен пока сохраняем до отдельной очистки после испытаний. Один маршрут не означает одного WARP-клиента или одного TCP-сеанса.

**Фактические проверки HOME №70:**

- Semaphore Job **#110**: `Success`, `changed=0 failed=0`; существующий Tunnel `serzhan-home`, UUID `6a04d9cd-0b17-48f3-8366-9f86ea08cb24`, `healthy`, **один** PVE `cloudflared` connector; Runner connector inactive; маршруты без изменений.
- Job **#111**: `Success`; диагностически добавлены только временные Ansible inventory hosts. PVE и Media VM прочитаны по доверенному SSH; внешняя конфигурация не изменена.
- Job **#112**: `Success`, **`changed=0 failed=0`**; повторно подтверждены:
  - HOME PVE `192.168.11.220`: Cloudflare One Client (`warp-cli`, `warp-svc`) **отсутствует**, `cloudflared.service=active`. Маршрут к `192.168.11.243` идёт **локально** через `vmbr0`, `src=192.168.11.220`; диагностический HTTPS `401` (достигнут локальный сервис, не подтверждён Cloudflare).
  - HOME Media VM `192.168.11.223`: WARP **отсутствует**, `cloudflared=inactive`. Маршрут к `192.168.11.243` идёт **локально** через `eth0`, `src=192.168.11.223`; диагностический HTTPS завершился `curl exit 28` (timeout).
- **HOME → CORE защищённый маршрут НЕ подтверждён и НЕ создан.** Существующий подтверждённый CORE → HOME маршрутизатор/коннектор сохранён.

**Рекомендованная минимальная штатная схема для пилота:** отдельный **headless Cloudflare One Client** на HOME PVE (Restore) и HOME Media VM/PBS (Push), оба на одном HOME → CORE private route `192.168.11.243/32` через соответствующий CORE connector; Traffic only, строго ограниченный Split Tunnel и проверка фактической маршрутизации. Cloudflare описывает One Client как endpoint, а вариант использования его в качестве gateway отсылает к Mesh; поэтому автоматически не строить WARP-gateway на гипервизоре. **Отдельные публичные endpoints, Mesh, relay и дополнительные сервисы не создавать.**

**Зависимости до исполнения:** отдельный проект CORE должен подтвердить свой существующий либо подготовленный connector и маршрутизацию CORE PBS /32, а также выдать HOME enrollment credentials через HOME №05. HOME №70 после согласования проверит, что `ip route`/policy, `warp-cli status` и фактический трафик из **обоих** HOME узлов проходят Cloudflare; HTTP 200/401 без доказанного пути не считается E2E.

**Не менялось:** Cloudflare Tunnel, маршруты, DNS, Access, PVE network, VM network, службы и credentials. Только Ansible-HOME read-only audit-код и документация.

## Границы и последующие работы

- HAOS mobile mTLS: отдельная операция №70, без изменения действующих маршрутов до проверки сертификатов/Access.
- **Private PBS — выполнено в №70:** `CORE → Cloudflare → существующий HOME PVE connector → HOME PBS VM:8007`. Для `serzhan-home`: `192.168.11.223/32`, **Cloudflare route ID `eebd7ec3-e1dd-46eb-95e7-9f6a85f16905`**, Tunnel UUID `6a04d9cd-0b17-48f3-8366-9f86ea08cb24`. IP получен из приватного media-манифеста; PBS с PVE отвечает HTTP 200. Действие `publish_pbs_private` проверяет статус существующего коннектора, origin и конфликты маршрутов и создаёт только отсутствующий CIDR через `POST /teamnet/routes`. `GET` Cloudflare API подтвердил route ID, CIDR и Tunnel UUID; повторный запуск `changed=0`. **Проверку реального транспорта через Cloudflare One Client/WARP выполняет Ansible-CORE №40**, HOME не претендует на сквозной сетевой тест. Новых DNS, Access-приложений, Tunnel и сервисов не создавалось; CORE не изменялся.
- Если потребуются новые маршруты PVE/File Browser для других домов, их добавление должно быть отдельным выбором в №70, без использования исторической №15.
- Центральный PBS, Sync Jobs и хранение резервных копий — **Ansible-CORE**, не HOME.

## HAOS mTLS на HOME `.222` (18–22.11.2026)

Действия №70: `audit_ha_mtls` (только чтение), `publish_ha_mtls` (идемпотентная публикация), `verify_ha_mtls_client` (сквозная проверка).
Существующий hostname `serzhan-home-pve-ha-mtls.digitalhouses.vip` используется повторно.
Сохраняются действующие Cloudflare Managed CA сертификат (CN строго равен hostname),
WAF `block` при отсутствующем/отозванном сертификате или неверном CN,
Access Exact Host `bypass`, единственный Tunnel `serzhan-home`, старые PVE маршруты.
Публикация добавляет только ingress `http://192.168.11.222:80` до 404
и переводит только старый CNAME этого hostname на UUID текущего Tunnel.
Нового Tunnel и служб нет, CORE не изменялся. Клиентский сертификат Cloudflare Managed CA был выпущен отдельно и помещён в DH.

**HAOS HTTP:** начиная с Home Assistant Core 2026.8 настройки HTTP перенесены
из `configuration.yaml` в штатное хранилище `.storage/http`; после миграции YAML
больше не применяется. Действие `publish_ha_mtls` через QEMU Guest Agent VM2222
добавляет только HOME PVE `192.168.11.220/32` в
`data.stable.trusted_proxies`, сохраняет существующие trusted proxies и
`use_x_forwarded_for: true`. При необходимости Core останавливается,
хранилище резервируется в `.storage/http.before-dh-mtls`, обновляется
атомарно, Core запускается; при ошибке предусмотрен откат. При совпадении
настроек ничего не меняется и Core не перезапускается. Для HAOS до миграции
остаётся старое управление YAML.

**Приёмка 22.11.2026:**
- №70 **#202** (audit): активное хранилище содержало
  `172.30.33.0/24`, `192.168.11.30/32`, `127.0.0.1/32`,
  но не содержало `192.168.11.220/32`; YAML уже игнорировался.
- №70 **#203** (publish): `Success, changed=3, failed=0`;
  запрос с `X-Forwarded-For` от HOME PVE → HAOS отвечает HTTP 200.
- №70 **#204** (repeat): `Success, changed=0, failed=0`;
  HAOS не перезапускался. Без сертификата внешний запрос блокируется WAF
  с HTTP 403.

**Итоговая приёмка 22.11.2026:**
- №70 **#224** восстановил читаемый локальный CA-файл на HOME PVE;
  `HA70_REMOTE_CONFIG_ACCEPTED=True`, отклонённых ingress — `0`.
- №70 **#225** завершился `Success, changed=0, failed=0`; существующий
  клиентский `.p12` из DH дал публичный **HTTP 200**. Запрос без сертификата
  по-прежнему блокируется **HTTP 403**.
- Вход в Home Assistant с iPhone через **мобильный интернет** подтверждён.

**Корневая причина HTTP 503:** Cloudflare Tunnel Live Logs показывал
`originService: http_status:503`, а журнал HOME PVE сообщал
`Failed to update ingress` из-за невозможности прочитать
`/etc/cloudflared/dh-pve-ca.pem`. Без CA-файла `cloudflared` не применял
**всю** удалённую конфигурацию, хотя Tunnel в Cloudflare числился `healthy`.
Штатный CA — публичный `/etc/pve/pve-root-ca.pem`, он проверяет сертификат
PVE HTTPS. Его нужно **копировать как обычный файл** в
`/etc/cloudflared/dh-pve-ca.pem`, не создавать symlink на `/etc/pve`:
ссылка не исправила ошибку загрузки. Ansible №70 обеспечивает эту копию
при `migrate`, `configure_cloudflared_auto`, `update_cloudflared` и
`publish_ha_mtls`. Копия обновляется при изменении CA; `cloudflared`
перезапускается только при фактическом изменении файла.

**Комплект пользователя — стабильные имена без `-01`, `-02`:**
`\\\\192.168.11.223\\DigitalHouses\\cert` содержит
`serzhan-home-ha-mtls.p12`, `serzhan-home-ha-mtls-password.txt` и
`serzhan-home-ha-mtls-url.txt`. В последнем записан
`https://serzhan-home-pve-ha-mtls.digitalhouses.vip`.
Приватные ключи, `.p12` и пароли не сохраняются в GitHub.

При будущем перевыпуске CN, URL и итоговые имена файлов сохраняются:
различие сертификатов — по Cloudflare certificate ID. **Автоматическая
ротация пока не реализована**: существующее действие
`issue_ha_mtls_client` специально отказывает в перезаписи готового `.p12`.
Новый сертификат сначала следует выпустить и проверить, затем атомарно
заменить клиентский комплект; прежний сертификат можно отозвать **только
после** успешного перехода клиентов. Не отзывать текущий сертификат заранее.
