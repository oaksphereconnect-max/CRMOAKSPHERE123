# Auth Testing — OAKsphere Connect

Auth: JWT Bearer tokens (Authorization: Bearer <token>), returned in login response body, stored in localStorage as `oak_token`.

## Accounts
- Admin: oaksphereconnect@gmail.com / OakAdmin@2026
- Team Leader: teamlead@oaksphere.com / teamlead123
- Recruiter: harshika@oaksphere.com / recruiter123 (also kajal/farheen/prathemesh @oaksphere.com)

## API
- POST /api/auth/login {email,password} -> {token, user}
- GET /api/auth/me (Bearer)
- POST /api/auth/change-password / forgot-password / reset-password

## Quick check
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"oaksphereconnect@gmail.com","password":"OakAdmin@2026"}'
Then GET /api/auth/me with Authorization: Bearer <token>.

Password hash: bcrypt ($2b$). users.email is a unique index.
