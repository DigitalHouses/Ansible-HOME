# HOME: migration of an existing Semaphore

1. Preserve the current project, Runner, inventory, templates, history,
   variable groups, and the old Ansible-3 repository record.
2. **One-time in the existing Semaphore UI:** add the public Git repository
   `https://github.com/DigitalHouses/Ansible-HOME.git` on branch `main`;
   use the existing suitable SSH Key Store entry for a public Git checkout.
3. **One-time in the existing Semaphore UI:** change ONLY template
   `00-Обновить список задач` (same template ID) to the new repository.
   Keep its playbook, inventory, environment, and other fields unchanged.
4. Run this existing task 00 via Semaphore. Its Ansible code verifies the new
   repository, updates the current catalog, and repoints only owned HOME
   templates and the same Runner inventory in-place. It preserves every
   template ID and history entry; it does not delete the Ansible-3 record.
5. After a successful task 00, run existing task 08 with
   `DH_DEV_API_TOKEN_ACTION=rotate`. The new token is delivered to DEV
   and verified there before the old token is revoked.
6. Verify `/home/dev/.config/ansible-home/serzhan-home.curl` against the
   Semaphore `/api/user/` endpoint. Do not use the old `ansible-3` curl file.
7. Task 15 -> 70 and emergency CF PVE -> task 10 remain separate approved
   follow-ups; a repository cutover must not apply Cloudflare changes.
8. Rollback is a repository-record repoint to the untouched Ansible-3 source.

Task 00 is NOT read-only: it can create missing templates, reconcile surveys,
and perform the above in-place HOME migration when its own repository has
explicitly been switched to canonical Ansible-HOME/main.

Original source: b97b840 feat/bootstrap-home-core.

## Repository status — 2026-11-12

- Canonical GitHub name: `DigitalHouses/Ansible-HOME` (renamed on
  2026-11-12 from `DigitalHouses/Ansible-HOMES`); default branch `main`.
- The source repository `DigitalHouses/Ansible-3` is archived read-only but
  remains cloneable for existing Semaphore tasks and historical checkout.
- **Existing HOME Semaphore cutover has NOT been verified or executed here.**
  Each HOME site must independently move its Semaphore repository and
  inventory references to Ansible-HOME and smoke-test task 00. Keep the
  original task/template IDs, credentials and history.
- No HOME PVE, Media/PBS or Cloudflare changes were made here.
