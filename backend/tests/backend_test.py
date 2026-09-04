"""OAKsphere Connect — backend API regression tests."""
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


def creds():
    p = Path("/app/memory/test_credentials.md")
    content = p.read_text()
    email = re.search(r'(?im)^-\s*Email:\s*(\S+)', content).group(1)
    pw = re.search(r'(?im)^-\s*Password:\s*(\S+)', content).group(1)
    return email, pw


@pytest.fixture(scope="session")
def admin_token():
    email, pw = creds()
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def recruiter():
    r = requests.post(f"{API}/auth/login", json={"email": "harshika@oaksphere.com", "password": "recruiter123"}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Recruiter login failed {r.status_code}: {r.text[:300]}")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"})
    s.user = r.json()["user"]
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_bad_password(self):
        email, _ = creds()
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert "password_hash" not in d
        assert "_id" not in d

    def test_no_token_401(self):
        r = requests.get(f"{API}/leads", timeout=30)
        assert r.status_code == 401

    def test_bcrypt_hash_format(self):
        # verify hash stored in DB is bcrypt $2b$
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        env = dv("/app/backend/.env")

        async def check():
            cl = AsyncIOMotorClient(env["MONGO_URL"])
            u = await cl[env["DB_NAME"]].users.find_one({"email": creds()[0]})
            return u["password_hash"]
        h = asyncio.get_event_loop().run_until_complete(check()) if False else asyncio.run(check())
        assert h.startswith("$2b$") or h.startswith("$2a$"), h[:10]


# ---------------- Leads ----------------
class TestLeads:
    def test_list_leads(self, admin):
        r = admin.get(f"{API}/leads")
        assert r.status_code == 200
        leads = r.json()
        assert len(leads) >= 10
        l = leads[0]
        for k in ("id", "lead_code", "name", "phone", "priority", "lead_status", "recruiter_name", "aging"):
            assert k in l
        assert "_id" not in l

    def test_invalid_phone_flag(self, admin):
        leads = admin.get(f"{API}/leads").json()
        assert any(l.get("phone_valid") is False for l in leads), "no seeded invalid-phone lead"

    @pytest.mark.parametrize("view", ["new_leads", "not_called", "overdue_followups", "hot_leads", "selected", "joined", "lost"])
    def test_saved_views(self, admin, view):
        r = admin.get(f"{API}/leads", params={"view": view})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_priority(self, admin):
        r = admin.get(f"{API}/leads", params={"priority": "Hot"})
        assert r.status_code == 200
        assert all(l["priority"] == "Hot" for l in r.json())

    def test_global_search(self, admin):
        leads = admin.get(f"{API}/leads").json()
        name = leads[0]["name"].split()[0]
        r = admin.get(f"{API}/leads/search", params={"q": name})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_check_duplicate(self, admin):
        phone = admin.get(f"{API}/leads").json()[0]["phone"]
        r = admin.get(f"{API}/leads/check-duplicate", params={"phone": phone})
        assert r.status_code == 200
        assert r.json()["duplicate"] is True

    def test_create_lead_and_persist(self, admin):
        payload = {"name": "TEST_QA Candidate", "phone": "9998887771", "city": "Mumbai",
                   "source": "Manual", "priority": "Hot", "email": "test_qa@example.com"}
        r = admin.post(f"{API}/leads", json=payload)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        lid = d["id"]
        assert d["name"] == payload["name"]
        assert d["phone_valid"] is True
        assert d["lead_status"] == "New"
        g = admin.get(f"{API}/leads/{lid}")
        assert g.status_code == 200
        assert g.json()["priority"] == "Hot"
        # duplicate detection on second create
        r2 = admin.post(f"{API}/leads", json=payload)
        assert r2.json()["duplicate_flag"] is True
        admin.delete(f"{API}/leads/{lid}")
        admin.delete(f"{API}/leads/{r2.json()['id']}")

    def test_create_lead_invalid_phone_flag(self, admin):
        r = admin.post(f"{API}/leads", json={"name": "TEST_Bad Phone", "phone": "12345"})
        assert r.status_code == 200
        assert r.json()["phone_valid"] is False
        admin.delete(f"{API}/leads/{r.json()['id']}")

    def test_update_lead_persists(self, admin):
        r = admin.post(f"{API}/leads", json={"name": "TEST_Update", "phone": "9998887772"})
        lid = r.json()["id"]
        u = admin.patch(f"{API}/leads/{lid}", json={"priority": "Cold", "city": "Delhi"})
        assert u.status_code == 200
        assert u.json()["priority"] == "Cold"
        g = admin.get(f"{API}/leads/{lid}").json()
        assert g["priority"] == "Cold" and g["city"] == "Delhi"
        d = admin.delete(f"{API}/leads/{lid}")
        assert d.status_code == 200
        assert admin.get(f"{API}/leads/{lid}").status_code == 404

    def test_export_csv(self, admin):
        r = admin.get(f"{API}/leads/export/csv")
        assert r.status_code == 200, f"CSV export failed: {r.status_code} {r.text[:200]}"
        assert "lead_code" in r.text.split("\n")[0]

    def test_export_csv_with_filter(self, admin):
        r = admin.get(f"{API}/leads/export/csv", params={"priority": "Hot"})
        assert r.status_code == 200, r.text[:200]


# ---------------- Role scoping ----------------
class TestRoleScoping:
    def test_recruiter_sees_only_own(self, recruiter):
        r = recruiter.get(f"{API}/leads")
        assert r.status_code == 200
        rid = recruiter.user["id"]
        assert all(l.get("assigned_recruiter_id") == rid for l in r.json())

    def test_recruiter_cannot_list_users(self, recruiter):
        assert recruiter.get(f"{API}/users").status_code == 403

    def test_recruiter_cannot_assign(self, recruiter):
        r = recruiter.post(f"{API}/leads/assign", json={"lead_ids": [], "recruiter_id": "x"})
        assert r.status_code == 403

    def test_recruiter_calling_list_scoped(self, recruiter):
        r = recruiter.get(f"{API}/calling-list")
        assert r.status_code == 200
        rid = recruiter.user["id"]
        assert all(l.get("assigned_recruiter_id") == rid for l in r.json())


# ---------------- Assignment ----------------
class TestAssignment:
    def test_manual_assign(self, admin):
        lead = admin.post(f"{API}/leads", json={"name": "TEST_Assign", "phone": "9998887773"}).json()
        recs = [u for u in admin.get(f"{API}/users").json() if u["role"] == "recruiter"]
        rid = recs[0]["id"]
        r = admin.post(f"{API}/leads/assign", json={"lead_ids": [lead["id"]], "recruiter_id": rid})
        assert r.status_code == 200
        assert r.json()["assigned"] == 1
        g = admin.get(f"{API}/leads/{lead['id']}").json()
        assert g["assigned_recruiter_id"] == rid
        assert g["recruiter_name"] == recs[0]["name"]
        admin.delete(f"{API}/leads/{lead['id']}")

    def test_auto_distribute(self, admin):
        ids = []
        for i in range(3):
            ids.append(admin.post(f"{API}/leads", json={"name": f"TEST_Auto{i}", "phone": f"999888778{i}"}).json()["id"])
        r = admin.post(f"{API}/leads/auto-distribute", json={"lead_ids": ids})
        assert r.status_code == 200
        assert r.json()["assigned"] == 3
        for lid in ids:
            assert admin.get(f"{API}/leads/{lid}").json()["assigned_recruiter_id"]
            admin.delete(f"{API}/leads/{lid}")


# ---------------- Calling list + disposition validation ----------------
class TestCallDisposition:
    def test_calling_list_prioritized(self, admin):
        r = admin.get(f"{API}/calling-list")
        assert r.status_code == 200
        items = r.json()
        assert len(items) > 0
        assert "queue_reason" in items[0]
        # queue order depends on live data (overdue follow-ups may not exist)
        assert isinstance(items[0]["queue_reason"], str) and items[0]["queue_reason"]

    @pytest.fixture
    def temp_lead(self, admin):
        lead = admin.post(f"{API}/leads", json={"name": "TEST_Call", "phone": "9998887799", "priority": "Hot"}).json()
        yield lead
        admin.delete(f"{API}/leads/{lead['id']}")

    def test_callback_requires_followup(self, admin, temp_lead):
        r = admin.post(f"{API}/leads/{temp_lead['id']}/call", json={"disposition": "Callback Requested", "notes": "x"})
        assert r.status_code == 400
        assert "follow-up" in r.json()["detail"].lower()

    def test_call_back_later_requires_followup(self, admin, temp_lead):
        r = admin.post(f"{API}/leads/{temp_lead['id']}/call", json={"disposition": "Call Back Later"})
        assert r.status_code == 400

    def test_interview_scheduled_requires_fields(self, admin, temp_lead):
        r = admin.post(f"{API}/leads/{temp_lead['id']}/call", json={"disposition": "Interview Scheduled"})
        assert r.status_code == 400
        assert "client" in r.json()["detail"].lower()

    def test_selected_requires_joining_date(self, admin, temp_lead):
        r = admin.post(f"{API}/leads/{temp_lead['id']}/call",
                       json={"disposition": "Connected–Interested", "lead_status": "Selected"})
        assert r.status_code == 400
        assert "joining" in r.json()["detail"].lower()

    def test_lost_requires_reason(self, admin, temp_lead):
        r = admin.post(f"{API}/leads/{temp_lead['id']}/call",
                       json={"disposition": "Not Interested", "lead_status": "Lost"})
        assert r.status_code == 400
        assert "reason" in r.json()["detail"].lower()

    def test_valid_disposition_saves(self, admin, temp_lead):
        lid = temp_lead["id"]
        r = admin.post(f"{API}/leads/{lid}/call",
                       json={"disposition": "Connected–Interested", "notes": "TEST valid call",
                             "followup_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat().replace("+00:00", "Z"),
                             "followup_reason": "TEST next step"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["call_attempts"] == 1
        assert d["last_call_status"] == "Connected–Interested"
        assert d["lead_status"] == "Interested"
        acts = admin.get(f"{API}/leads/{lid}/activities").json()
        assert any(a["type"] == "call" for a in acts["activities"])
        assert len(acts["calls"]) == 1

    def test_callback_with_followup_creates_followup(self, admin, temp_lead):
        lid = temp_lead["id"]
        from datetime import datetime, timezone, timedelta
        due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        r = admin.post(f"{API}/leads/{lid}/call", json={
            "disposition": "Callback Requested", "followup_date": due, "followup_reason": "TEST callback"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["next_followup_date"] == due
        ups = admin.get(f"{API}/followups", params={"view": "upcoming"}).json()
        assert any(f["lead_id"] == lid for f in ups)

    def test_interview_scheduled_creates_interview(self, admin, temp_lead):
        lid = temp_lead["id"]
        from datetime import datetime, timezone, timedelta
        clients = admin.get(f"{API}/clients").json()
        jobs = admin.get(f"{API}/jobs").json()
        dt = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        r = admin.post(f"{API}/leads/{lid}/call", json={
            "disposition": "Interview Scheduled", "interview_date": dt,
            "client_id": clients[0]["id"], "job_id": jobs[0]["id"]})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["lead_status"] == "Interview"
        assert d["interview_status"] == "Scheduled"
        ivs = admin.get(f"{API}/interviews").json()
        assert any(iv["lead_id"] == lid for iv in ivs)


# ---------------- Follow-ups ----------------
class TestFollowups:
    @pytest.mark.parametrize("view", ["today", "overdue", "upcoming", "completed"])
    def test_views(self, admin, view):
        r = admin.get(f"{API}/followups", params={"view": view})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    @pytest.fixture
    def overdue_followup(self, admin):
        """Provision an overdue follow-up (seed data no longer guarantees one)."""
        past = (datetime.now(timezone.utc) - timedelta(hours=20)).isoformat().replace("+00:00", "Z")
        lead = admin.post(f"{API}/leads", json={"name": "TEST_OverdueFu", "phone": "9998887788",
                                                "next_followup_date": past}).json()
        fus = admin.get(f"{API}/leads/{lead['id']}/activities").json()["followups"]
        yield [f for f in fus if f["status"] == "pending"][0]
        admin.delete(f"{API}/leads/{lead['id']}")

    def test_overdue_has_badge_field(self, admin, overdue_followup):
        items = admin.get(f"{API}/followups", params={"view": "overdue"}).json()
        mine = [f for f in items if f["id"] == overdue_followup["id"]]
        assert mine, "provisioned overdue follow-up not returned by view=overdue"
        assert "overdue_by" in mine[0]
        assert mine[0]["lead_name"] == "TEST_OverdueFu"

    def test_complete_followup_moves_to_completed(self, admin, overdue_followup):
        fid = overdue_followup["id"]
        nxt = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat().replace("+00:00", "Z")
        r = admin.post(f"{API}/followups/{fid}/complete", json={"next_date": nxt})
        assert r.status_code == 200, r.text[:300]
        completed = admin.get(f"{API}/followups", params={"view": "completed"}).json()
        assert any(f["id"] == fid for f in completed)
        assert not any(f["id"] == fid for f in admin.get(f"{API}/followups", params={"view": "overdue"}).json())

    def test_missed_followups_report(self, admin):
        r = admin.get(f"{API}/reports/missed-followups")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Interviews / Joinings ----------------
class TestInterviewsJoinings:
    @pytest.fixture
    def temp_interview(self, admin):
        """Interviews are created from call logs; provision one instead of relying on seed data."""
        fut = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat().replace("+00:00", "Z")
        lead = admin.post(f"{API}/leads", json={"name": "TEST_IvLead", "phone": "9998887777"}).json()
        client = admin.get(f"{API}/clients").json()[0]["id"]
        job = admin.get(f"{API}/jobs").json()[0]["id"]
        r = admin.post(f"{API}/leads/{lead['id']}/call", json={"disposition": "Interview Scheduled",
                                                               "interview_date": fut, "client_id": client, "job_id": job})
        assert r.status_code == 200, r.text[:300]
        iv = [x for x in admin.get(f"{API}/interviews").json() if x["lead_id"] == lead["id"]][0]
        yield iv
        admin.delete(f"{API}/leads/{lead['id']}")

    def test_list_interviews(self, admin, temp_interview):
        r = admin.get(f"{API}/interviews")
        assert r.status_code == 200
        assert len(r.json()) >= 1
        assert "lead_name" in r.json()[0]

    def test_interviews_tomorrow_view(self, admin):
        r = admin.get(f"{API}/interviews", params={"view": "tomorrow"})
        assert r.status_code == 200

    def test_patch_interview_stage_and_confirmation(self, admin, temp_interview):
        iv = temp_interview
        r = admin.patch(f"{API}/interviews/{iv['id']}", json={"stage": "Attended", "confirmation": "Confirmed"})
        assert r.status_code == 200
        assert r.json()["stage"] == "Attended"
        again = [x for x in admin.get(f"{API}/interviews").json() if x["id"] == iv["id"]][0]
        assert again["stage"] == "Attended" and again["confirmation"] == "Confirmed"

    def test_list_joinings(self, admin):
        r = admin.get(f"{API}/joinings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_patch_joining(self, admin):
        js = admin.get(f"{API}/joinings").json()
        if not js:
            pytest.skip("no joinings seeded")
        j = js[0]
        r = admin.patch(f"{API}/joinings/{j['id']}", json={"status": "Offer Released", "confirmation": "Confirmed"})
        assert r.status_code == 200
        assert r.json()["status"] == "Offer Released"
        again = [x for x in admin.get(f"{API}/joinings").json() if x["id"] == j["id"]][0]
        assert again["status"] == "Offer Released" and again["confirmation"] == "Confirmed"
        admin.patch(f"{API}/joinings/{j['id']}", json={"status": j.get("status"), "confirmation": j.get("confirmation")})


# ---------------- Dashboards ----------------
class TestDashboards:
    def test_main(self, admin):
        r = admin.get(f"{API}/dashboard/main")
        assert r.status_code == 200
        d = r.json()
        assert set(["today", "monthly", "comparison"]).issubset(d.keys())
        assert len(d["comparison"]) >= 4
        assert "calls_made" in d["today"]

    def test_funnel(self, admin):
        r = admin.get(f"{API}/dashboard/funnel")
        assert r.status_code == 200
        stages = [s["stage"] for s in r.json()]
        assert stages[0] == "Leads" and "Joined" in stages

    def test_targets(self, admin):
        r = admin.get(f"{API}/dashboard/targets")
        assert r.status_code == 200
        d = r.json()
        assert len(d) == 4
        assert len(d[0]["metrics"]) == 4
        assert d[0]["metrics"][0]["status"] in ("Excellent", "On Track", "Attention Required", "Critical")

    def test_leaderboard(self, admin):
        r = admin.get(f"{API}/dashboard/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert d[0]["rank"] == 1
        assert all(d[i]["score"] >= d[i + 1]["score"] for i in range(len(d) - 1))

    def test_action_required(self, admin):
        r = admin.get(f"{API}/dashboard/action-required")
        assert r.status_code == 200
        d = r.json()
        for k in ("overdue_followups", "never_called", "unassigned", "stale_leads",
                  "selected_no_joining_date", "unconfirmed_tomorrow_interviews",
                  "unconfirmed_joinings", "recruiters_below_target"):
            assert k in d, k

    def test_my_day_recruiter(self, recruiter):
        r = recruiter.get(f"{API}/dashboard/my-day")
        assert r.status_code == 200
        d = r.json()
        assert d["total_steps"] == 6
        assert len(d["steps"]) == 6
        assert 0 <= d["progress"] <= 100

    def test_scorecard(self, admin):
        rid = admin.get(f"{API}/dashboard/leaderboard").json()[0]["recruiter_id"]
        r = admin.get(f"{API}/dashboard/scorecard/{rid}")
        assert r.status_code == 200
        assert "targets" in r.json()


# ---------------- Clients / Jobs / Recruiters ----------------
class TestClientsJobsUsers:
    def test_clients_with_stats(self, admin):
        r = admin.get(f"{API}/clients")
        assert r.status_code == 200
        assert "stats" in r.json()[0]

    def test_jobs_with_client_name(self, admin):
        r = admin.get(f"{API}/jobs")
        assert r.status_code == 200
        j = r.json()[0]
        assert j["client_name"] and "filled" in j

    def test_create_client_and_job(self, admin):
        c = admin.post(f"{API}/clients", json={"name": "TEST_Client", "company": "TEST Co", "location": "Pune"})
        assert c.status_code == 200
        cid = c.json()["id"]
        j = admin.post(f"{API}/jobs", json={"title": "TEST_Job", "client_id": cid, "openings": 2})
        assert j.status_code == 200
        jid = j.json()["id"]
        jobs = admin.get(f"{API}/jobs").json()
        assert any(x["id"] == jid and x["client_name"] == "TEST_Client" for x in jobs)
        admin.delete(f"{API}/jobs/{jid}")
        admin.delete(f"{API}/clients/{cid}")

    def test_recruiters_with_stats(self, admin):
        r = admin.get(f"{API}/recruiters")
        assert r.status_code == 200
        d = r.json()
        assert len(d) >= 5
        assert "stats" in d[0] and "password_hash" not in d[0]

    def test_create_user_toggle_and_reset(self, admin):
        r = admin.post(f"{API}/users", json={"name": "TEST_Recruiter", "email": "test_qa_rec@oaksphere.com",
                                             "password": "temp12345", "role": "recruiter"})
        assert r.status_code == 200, r.text[:300]
        uid = r.json()["id"]
        assert "password_hash" not in r.json()
        # duplicate email
        dup = admin.post(f"{API}/users", json={"name": "TEST_Dup", "email": "test_qa_rec@oaksphere.com",
                                               "password": "temp12345"})
        assert dup.status_code == 400
        # deactivate
        p = admin.patch(f"{API}/users/{uid}", json={"active": False})
        assert p.status_code == 200
        assert p.json()["active"] is False
        login = requests.post(f"{API}/auth/login", json={"email": "test_qa_rec@oaksphere.com", "password": "temp12345"}, timeout=30)
        assert login.status_code == 403
        # reactivate — KNOWN RISK: patch drops False/None values
        p2 = admin.patch(f"{API}/users/{uid}", json={"active": True})
        assert p2.json()["active"] is True
        # reset password
        rp = admin.post(f"{API}/users/{uid}/reset-password", json={"password": "newpass123"})
        assert rp.status_code == 200
        l2 = requests.post(f"{API}/auth/login", json={"email": "test_qa_rec@oaksphere.com", "password": "newpass123"}, timeout=30)
        assert l2.status_code == 200
        # cleanup
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        env = dv("/app/backend/.env")

        async def rm():
            cl = AsyncIOMotorClient(env["MONGO_URL"])
            await cl[env["DB_NAME"]].users.delete_one({"id": uid})
        asyncio.run(rm())


# ---------------- Settings / Notifications ----------------
class TestSettingsNotifications:
    def test_get_settings(self, admin):
        r = admin.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["priorities"] == ["Hot", "High", "Medium", "Low", "Cold"]

    def test_update_settings_persists(self, admin):
        orig = admin.get(f"{API}/settings").json()
        r = admin.patch(f"{API}/settings", json={"target_calls": 111, "sources": orig["sources"] + ["TEST_Src"]})
        assert r.status_code == 200
        assert r.json()["target_calls"] == 111
        assert "TEST_Src" in admin.get(f"{API}/settings").json()["sources"]
        admin.patch(f"{API}/settings", json={"target_calls": orig["target_calls"], "sources": orig["sources"]})

    def test_recruiter_cannot_update_settings(self, recruiter):
        assert recruiter.patch(f"{API}/settings", json={"target_calls": 5}).status_code == 403

    def test_notifications_and_read_all(self, recruiter):
        r = recruiter.get(f"{API}/notifications")
        assert r.status_code == 200
        assert recruiter.get(f"{API}/notifications/unread-count").status_code == 200
        assert recruiter.post(f"{API}/notifications/read-all").status_code == 200
        assert recruiter.get(f"{API}/notifications/unread-count").json()["count"] == 0

    def test_audit_logs(self, admin):
        r = admin.get(f"{API}/audit-logs")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
