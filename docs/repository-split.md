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
- **serzhan-home: live Semaphore cutover ACCEPTED on 2026-11-12.**
  Project ID 1; original task templates ID 1–10, Runner inventory ID 1,
  original Git record ID 1 retained. New `Ansible-HOME/main` Git record ID 2.
  Task 00 #42 success (repo migration); #43 success (Survey update);
  #47 success from the dedicated DEV API token, `changed=0`.
- **Task 08 accepted:** #45 direct SSH probe succeeded (Runner → DEV
  `192.168.11.254`, identity `dev`); #46 succeeded, rotated dedicated
  token and verified project-scoped API access from DEV. Temporary migration
  admin token explicitly revoked; readback 401. No API credentials committed.
- This is only the `serzhan-home` cutover. Other HOME sites require their
  own checks and cutover; do not assume they have been migrated.
- No HOME PVE, Media/PBS or Cloudflare service configuration was changed.
