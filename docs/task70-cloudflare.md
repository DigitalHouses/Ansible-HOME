# №70 — Cloudflare HOME: scope and migration contract

Status: **requirements / audit only** (2026-11-12). **Not deployed.**
The production template is still `15-Cloudflare`, ID **9**, in the existing Semaphore project `serzhan-home`, ID **1**. Do not create a second template for №70.

## Boundaries

- One existing Cloudflare Tunnel per HOME, named `<site-id>`; preserve its UUID, healthy replicas, routes, DNS and Access policies.
- The site connector is on the **HOME PVE host**. The current №15 playbook assumes a connector on **Semaphore Runner**; reconcile this before implementing any apply operation.
- All routine HOME Cloudflare management belongs to №70: tunnel/connector audit and non-destructive repair, published routes for PVE / File Browser Quantum / Semaphore / media administration (Webmin), HAOS mobile mTLS, and the PBS private-network route from CORE toward the HOME PBS endpoint.
- **Emergency access to PVE stays outside №70**, with the PVE/bootstrap emergency path. №08 continues to maintain DEV/Semaphore API access but delegates its Cloudflare publication to №70. №32's Webmin publication moves into №70 without removing its historical Semaphore task record.
- Do not create a second tunnel/connector for PBS, Webmin, Semaphore or HAOS. Do not add VPN, SSH relay, publicly exposed PBS, or extra credential infrastructure.

## Operational defaults

- Default action is read-only **Audit**. All mutations require a specific selected action. A service not selected must be left untouched.
- No `Recreate Tunnel` action in the routine interface. A healthy site Tunnel is immutable, including its UUID.
- Publish or repair an individual route only after confirming the current tunnel and existing route ownership. Preserve unrelated ingress, DNS and Access settings.
- Keep all credentials in the existing HOME credentials workflow (task №05); never display tokens, passwords or private keys in logs.

## Features to consolidate

| Source | №70 responsibility | What remains outside №70 |
| --- | --- | --- |
| №15 | Existing tunnel/connector audit, package update when explicitly selected, PVE and File Browser routes | No destructive tunnel re-creation |
| №08 | Existing site-tunnel route and Access for Semaphore | DEV user, API token and permission management |
| №32 | Existing site-tunnel route and Access for media Webmin | Installation/configuration of Webmin itself |
| Older PVE Cloudflare code | Non-emergency public route management | Emergency PVE recovery |
| HAOS mTLS work | HAOS hostname, client certificate lifecycle, WAF/Access verification and mobile delivery | HAOS service configuration |
| CORE connectivity | Private Network route to the HOME PBS VM, through the existing PVE connector | Central PBS service and sync jobs (Ansible-CORE) |

### HAOS mobile mTLS

One client certificate per HOME. Reuse the approved Cloudflare client certificate / WAF model; deny clients without a valid certificate. Deliver any `.p12` through a non-public channel with its password separately; remove temporary delivery material. Do not change existing working HAOS access until the new route and WAF are verified.

### PBS Private Network

The direction is **CORE client → Cloudflare → existing HOME PVE connector → HOME PBS VM:8007** using the native PBS TLS endpoint. Publish a **private network route only**, with a single-host `/32` destination read from the site's actual inventory. Do not hardcode a provisional VM IP; confirm the canonical HOME PBS destination before applying. Do not publish PBS via a public application hostname or create an additional Cloudflare Tunnel.

## Semaphore cutover order (history-preserving)

1. Restore working authorized DEV API access. Existing protected curl configuration currently returns HTTP 401; do not modify Semaphore until this is resolved.
2. Keep the existing Semaphore project, inventories, credentials, environments, history and template IDs. Add `DigitalHouses/Ansible-HOMES` on `main` as a **new** repository record; leave the original `Ansible-3` record intact.
3. Repoint owned HOME templates in-place and smoke-test №00 without creating or deleting historical templates.
4. Migrate template **ID 9** from №15 to №70 **in-place**. Update the catalog synchronizer to recognize the legacy entry before publishing the new catalog; do not run a naïve catalog import which creates a duplicate №70.
5. Only after the repository cutover is verified, implement and test the unified №70 functionality. Preserve a reversible reference to the original repository record.

## Acceptance

- Semaphore project ID 1 and all existing template IDs and historical tasks remain available; no duplicate №70 template.
- Cloudflare site Tunnel UUID and all existing working PVE / File Browser routes remain unchanged.
- Default Audit makes no Cloudflare, host, DNS, Access, certificate or network changes.
- Routine operations target the PVE connector, not the legacy Runner connector.
- HAOS mTLS and PBS private-network routing are tested separately, without changing the existing healthy public routes.
- CORE-specific PBS provisioning/synchronization is absent from Ansible-HOMES.
