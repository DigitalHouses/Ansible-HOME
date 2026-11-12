# HOME: migration of an existing Semaphore

1. Preserve the current project, Runner, inventory, templates, history,
   variable groups, and the old Ansible-3 repository record.
2. Add Ansible-HOME main as a new Git repository record in that project.
3. Verify that all currently used HOME playbooks and required files exist.
4. Repoint ONLY owned HOME templates to the new repository, retaining IDs
   and surveys; verify task 00 and task 15/32 before running anything.
5. Task 00 can CREATE templates and CHANGE surveys: it is not read-only.
6. Task 15 -> 70 and emergency CF PVE -> task 10 are separate approved
   follow-up changes, not part of the initial no-service-change cutover.
7. Rollback is a repository-record repoint to the untouched Ansible-3 source.

Original source: b97b840 feat/bootstrap-home-core.
