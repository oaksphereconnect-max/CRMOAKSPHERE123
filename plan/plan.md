# OAKsphere Connect — Recruitment Lead CRM

A functional, database-backed CRM so no lead is ever lost because a recruiter forgot to
call or follow up. Core loop: **Lead → Call → Follow-up → Interview → Attendance → Joining →
Recruiter Performance.**

Every button, form, filter, and dashboard number works against real data — not a mockup.

---

## What you'll be able to do (first version)

### Sign in & roles
- Email/password login with three roles:
  - **Admin/Owner** — full access: leads, assign/reassign, users, clients, jobs, settings, all reports.
  - **Team Leader** — manage their team's leads, follow-ups, interviews, joinings, reports.
  - **Recruiter** — only their assigned leads: call, log disposition, add notes, schedule follow-ups, update interview/joining status. Cannot delete company data.
- Admin creates recruiter/team-leader accounts and can activate/deactivate them.
- Password reset (in-app: admin resets, or self-serve reset flow).

### Leads
- Full lead record: name, phone + alt phone, email, city, age, gender, qualification, experience, current/expected salary, notice period, source, assigned recruiter, client, job, priority, lead/interview/joining status, call attempts, last-call details, next follow-up, notes, audit of last update.
- **Phone integrity:** digits are never auto-changed; duplicate phone numbers are flagged (not auto-merged — admin merges manually); unparseable numbers are marked **INVALID / VERIFY** rather than guessed.
- **Priority tiers** — Hot, High, Medium, Low, Cold — with colored badges, filterable and sortable.
- Per-candidate **activity timeline** logging every call attempt (date, time, recruiter, status, notes) and status change.

### Calling Workspace — "My Calling List"
- Daily auto-prioritized queue per recruiter, ordered: overdue follow-ups → hot candidates → interviews tomorrow → today's follow-ups → new high-priority → new leads → reattempts → old leads.
- Row actions: **Call**, **WhatsApp** (opens `wa.me/<number>`), **Update Status**.
- **Call opens a disposition popup** with all outcomes (Connected–Interested / Not Interested / Callback / Interview Scheduled / Already Working / Salary Issue / Location Issue / Job Mismatch / No Answer / Busy / Switched Off / Unreachable / Invalid Number / WhatsApp Only / Call Back Later).
- **Enforced validation (blocks save):**
  - Callback/follow-up outcomes require follow-up date + time + reason.
  - "Interview Scheduled" requires date/time/client/job.
  - "Selected" requires expected joining date.
  - "Lost" requires a lost reason.

### Follow-up Engine
- Four views: **Today's, Overdue, Upcoming, Completed** — overdue rows show "OVERDUE BY Xh/Xd" badges.
- Escalation: recruiter is warned, and after a configurable delay the team leader is notified and it surfaces on the Admin dashboard.
- **Missed Follow-up Report** (recruiter, candidate, phone, original time, delay, priority, status).

### Interviews
- Stages: Pending, Scheduled, Tomorrow, Today, Attended, Not Attended, Rescheduled, Selected, Rejected, Dropped.
- Fields: client, job, date/time, location, recruiter, type (Walk-in/Telephonic/Virtual/F2F), contact person, notes.
- "Tomorrow's Interviews" with confirmation status (Pending/Confirmed/Not Confirmed/Reschedule Requested).

### Joining
- Statuses: Selected, Documents Pending, Offer Pending/Released, Joining Confirmed, Joined, Delayed, No Show, Dropped, Client Rejected.
- Fields: selection date, joining date, client, job, salary, recruiter, confirmation, actual joining date, remarks.

### Assignment
- Manual, bulk, and **auto-distribution** balanced across active recruiters by workload and priority mix (won't dump all hot leads on one person). Admin can override.
- Always retains current owner, original owner, assignment date/by, and full reassignment history.

### Dashboards & analytics
- **Main Dashboard** — Today + Monthly KPIs (leads added/assigned, calls, connected, interested, follow-ups due/overdue, interviews scheduled/attended, selected, joined) plus a recruiter-comparison table.
- **Recruiter Targets** (admin-configurable) — Target vs Actual vs Remaining vs Status (Excellent/On Track/Attention Required/Critical).
- **Recruiter Scorecard** — individual today/monthly stats vs targets.
- **Leaderboard** — ranked by full-funnel performance, not just call volume.
- **Funnel view** — Leads → Called → Connected → Interested → Interview → Attended → Selected → Joined, filterable by date/recruiter/client/job/source.
- **"Action Required" page** — overdue follow-ups, never-called leads, recruiters below target, unconfirmed tomorrow-interviews, selected-but-no-joining-date, unconfirmed joinings, unassigned leads, stale leads.
- **My Day** (recruiter home) — a 6-step stepper with per-step completion progress.

### Supporting modules
- **Clients** — name, company, contact, location, active jobs, payment/replacement terms, and client-wise submitted/interviewed/selected/joined stats.
- **Jobs** — client, position, location, salary, experience, openings, requirements, status (Active/On Hold/Closed).
- **Global search** — by name/phone/email/recruiter/client/job; phone search instantly flags existing candidates.
- **Filters & Saved Views** — New Leads, Not Called, Today's/Overdue Follow-ups, Hot Leads, Interviews Today/Tomorrow, Attendance Pending, Selected, Joining This Week, Joined, Lost.
- **Export** — CSV of the current filtered list.
- **Audit Log** — user/date/time/old→new value for key state changes.
- **In-app Notifications** — new lead assigned, follow-up due/overdue, interview tomorrow/today, joining tomorrow, recruiter under call target (bell + notifications page).
- **Lead Aging** — New / 1 day / 3 days / 7 days / 15+ days; "Untouched Leads" report.
- **Settings** (admin-configurable, not hardcoded) — recruiters, lead sources, call/interview/joining statuses, priority levels, daily call/connected/lineup targets, monthly joining target, follow-up escalation timing.

### Sample data
- Recruiters seeded: **Harshika, Kajal, Farheen, Prathemesh** (plus an Admin account).
- ~15–20 demo candidates spread across all statuses and sources, clearly marked as demo data with fake phone numbers.

---

## Decisions I've made (challenge any of these)

1. **Scope of first version:** the full core loop end-to-end plus every module above is built and functional — including in-app Notifications, Audit Log, and CSV **Export**.
2. **CSV/XLSX Import** (field mapping, duplicate/invalid detection, preview-before-commit) is **deferred to the next round.** It's the most complex single module; deferring it gets a working, seeded CRM in front of you faster. Everything else is built now.
3. **Auth:** email/password with JWT and role-based access (admin creates accounts). No Google login.
4. **Reminders & escalation are in-app only** (dashboard alerts, notification bell, Action Required page) — no email/SMS sending in v1.
5. **Look & feel:** clean modern SaaS style (HubSpot/Zoho/Freshsales-inspired, simpler), desktop-first with a mobile-friendly recruiter view for the call/WhatsApp/status/follow-up actions. Status colors: green=completed/joined/connected, yellow=pending/follow-up, red=overdue/critical, blue=new/scheduled, grey=closed/not interested. Exact palette/typography chosen during design.

## Out of scope (v1, as specified)
Resume parsing, AI ranking, payroll, HRMS, attendance systems, offer-letter generation, onboarding workflows. Architecture kept ready for a future dialer integration (Exotel/Knowlarity/MyOperator) but not built now.
