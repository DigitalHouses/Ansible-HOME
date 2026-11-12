# №15 — Cloudflare HOME (архив)

**Историческая задача**, заменена на **№70-Cloudflare** 12.11.2026 с сохранением шаблона Semaphore **ID 9** и его истории.

Действующая реализация: [№70 — Cloudflare HOME](task70-cloudflare.md).

Новый код обслуживает один существующий Tunnel дома `<site-id>` на PVE, без штатного пересоздания Tunnel и без дополнительного cloudflared на Semaphore Runner. Старый код №15, включая операции recreate, остался только в истории Git `Ansible-3` и ранних коммитах `Ansible-HOME`.
