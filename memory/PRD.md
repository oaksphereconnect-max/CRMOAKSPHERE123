# OAKsphere Connect — Recruitment Lead CRM

## Original Problem
A functional, production-ready recruitment lead-management CRM so no lead is lost because a recruiter forgot to call or follow up. Core loop: Lead → Call → Follow-up → Interview → Attendance → Joining → Recruiter Performance. Bulk hiring agency (BPO/Sales/Banking/NBFC/Real Estate).

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (motor), JWT Bearer auth (bcrypt), all routes `/api`-prefixed. UUID string ids.
- **Frontend**: React + react-router + Tailwind + shadcn/ui. Auth token in localStorage (`oak_token`). Axios instance in `src/lib/api.js`.
- **Roles**: admin, team_leader (scoped to their team), recruiter (only own assigned leads). Enforced on backend (require_role + scope_recruiter_ids) and frontend routes.

## User Personas
- **Admin/Owner** — full control: users, clients, jobs, settings, assignment, all reports.
- **Team Leader** — manages their team's leads/pipeline/reports.
- **Recruiter** — daily calling queue, dispositions, follow-ups, interview/joining updates.

## Implemented (2026-06)
- Auth: login, /me, change/forgot/reset password, admin creates users, activate/deactivate.
- Leads: full model, filters, 11 saved views, global search, priority tiers, phone integrity (normalized duplicate flag, INVALID/VERIFY), activity timeline, CSV export.
- Assignment: manual, bulk, balanced auto-distribute; retains original/current owner + history.
- Calling List: auto-prioritized 8-tier queue; disposition popup with all outcomes + enforced validation (callback/interview/selected/lost).
- Follow-up Engine: Today/Overdue/Upcoming/Completed + OVERDUE BY badges + Missed Follow-up report.
- Interviews: stages + confirmation, Tomorrow's view. Joinings: statuses + confirmation.
- Dashboards: Main KPIs + recruiter comparison, Targets (vs actual/status), Leaderboard (full-funnel score), Funnel, Action Required (8 sections), My Day 6-step stepper.
- Clients, Jobs (with stats), Recruiters roster, Notifications (bell + page), Settings (configurable sources/statuses/priorities/targets/escalation), Audit log.
- Seed: admin (oaksphereconnect@gmail.com) + team leader + 4 recruiters + ~20 demo leads across all statuses.

## Testing
- Backend: 66/66 pytest pass (serial). All disposition validation rules enforced. `/app/backend/tests/backend_test.py`.
- Frontend: role-based flows verified by testing agent; role-guard + error-handling gaps fixed.

## Backlog / Next (P1/P2)
- P1: CSV/XLSX **Import** (field mapping, duplicate/invalid detection, preview-before-commit) — deferred module.
- P1: Manual duplicate **merge** tool for admins.
- P2: Email/SMS reminders + escalation (currently in-app only).
- P2: Dialer integration (Exotel/Knowlarity/MyOperator) — architecture kept ready.
- P2: Split server.py into routers; Pydantic models on all write endpoints; batch enrich queries.
