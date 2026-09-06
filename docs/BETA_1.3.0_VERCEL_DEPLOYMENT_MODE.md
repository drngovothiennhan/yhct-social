# YHCT Club Hub Beta 1.3.0 Vercel Deployment Mode

Scope locked: only drngovothiennhan/yhct-social.

Deployment strategy:
- Keep Beta 1.2.0 unchanged as rollback.
- Build Beta 1.3.0 as independent Vercel deployment.
- Do not modify unrelated repositories.
- Verify build, auth, RBAC, regression before production alias switch.

Security migration remains separate from UI deployment.
