"""
OAKsphere Connect v2 audit tests — tags, wa-templates, notes, follow-up enforcement,
call-log validation, follow-up views, users edit/delete/transfer, lead delete cascade,
dashboard/settings, interviews/joinings deletes, role permissions.
"""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import dotenv_values

fe = dotenv_values("/app/frontend/.env")
base = os.environ.get("REACT_APP_BACKEND_URL") or fe.get("REACT_APP_BACKEND_URL")
if not base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base.rstrip("/") + "/api"

ADMIN = ("oaksphereconnect@gmail.com", "OakAdmin@2026")
TL = ("teamlead@oaksphere.com", "teamlead123")
REC = ("harshika@oaksphere.com", "recruiter123")

PROTECTED_EMAILS = {"onkarkhillare4995@gmail.com", ADMIN[0], TL[0], REC[0],
                    "farheen@oaksphere.com", "prathemesh@oaksphere.com"}


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def future(hours=48):
    return iso(datetime.now(timezone.utc) + timedelta(hours=hours))


def login(email, pw):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed for {email}: {r.status_code} {r.text[:300]}")
    return r.json()["token"], r.json()["user"]


def sess(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def admin():
    t, u = login(*ADMIN)
    s = sess(t)
    s.me = u
    return s


@pytest.fixture(scope="session")
def tl():
    t, u = login(*TL)
    s = sess(t)
    s.me = u
    return s


@pytest.fixture(scope="session")
def rec():
    t, u = login(*REC)
    s = sess(t)
    s.me = u
    return s


@pytest.fixture(scope="session")
def trash():
    """{'leads': [], 'tags': [], 'templates': [], 'users': [], 'clients': [], 'jobs': []}"""
    return {"leads": [], "tags": [], "templates": [], "users": [], "clients": [], "jobs": []}


@pytest.fixture(scope="session", autouse=True)
def cleanup(admin, trash):
    yield
    for lid in trash["leads"]:
        admin.delete(f"{BASE}/leads/{lid}")
    for tid in trash["tags"]:
        admin.delete(f"{BASE}/tags/{tid}")
    for tid in trash["templates"]:
        admin.delete(f"{BASE}/wa-templates/{tid}")
    for jid in trash["jobs"]:
        admin.delete(f"{BASE}/jobs/{jid}")
    for cid in trash["clients"]:
        admin.delete(f"{BASE}/clients/{cid}")
    for uid in trash["users"]:
        admin.delete(f"{BASE}/users/{uid}")


def make_lead(client, trash, name="TEST_Lead", recruiter_id=None, followup=True):
    body = {"name": name, "phone": f"9{datetime.now().strftime('%H%M%S%f')[:9]}",
            "source": "Referral", "city": "Pune"}
    if recruiter_id:
        body["assigned_recruiter_id"] = recruiter_id
    if followup:
        body["next_followup_date"] = future(24)
    r = client.post(f"{BASE}/leads", json=body)
    assert r.status_code in (200, 201), r.text[:300]
    lead = r.json()
    trash["leads"].append(lead["id"])
    return lead


# ================= Tags =================
class TestTags:
    def test_tags_crud_and_permissions(self, admin, rec, trash):
        r = admin.get(f"{BASE}/tags")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0
        assert "lead_count" in r.json()[0]

        name = f"TEST_Tag_{datetime.now().strftime('%H%M%S%f')}"
        r = admin.post(f"{BASE}/tags", json={"name": name, "color": "#123456"})
        assert r.status_code == 200, r.text[:300]
        tag = r.json()
        trash["tags"].append(tag["id"])
        assert tag["name"] == name and tag["color"] == "#123456"
        assert "_id" not in tag

        # duplicate
        assert admin.post(f"{BASE}/tags", json={"name": name}).status_code == 400
        # empty name
        assert admin.post(f"{BASE}/tags", json={"name": "  "}).status_code == 400

        # patch
        r = admin.patch(f"{BASE}/tags/{tag['id']}", json={"name": name + "_x", "color": "#654321"})
        assert r.status_code == 200 and r.json()["name"] == name + "_x"
        got = [t for t in admin.get(f"{BASE}/tags").json() if t["id"] == tag["id"]][0]
        assert got["color"] == "#654321"

        # recruiter write forbidden
        assert rec.post(f"{BASE}/tags", json={"name": "TEST_rec_tag"}).status_code == 403
        assert rec.patch(f"{BASE}/tags/{tag['id']}", json={"name": "nope"}).status_code == 403
        assert rec.delete(f"{BASE}/tags/{tag['id']}").status_code == 403
        # recruiter read allowed
        assert rec.get(f"{BASE}/tags").status_code == 200

    def test_set_lead_tags_and_filter_and_delete_pull(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_TagLead")
        name = f"TEST_TagB_{datetime.now().strftime('%H%M%S%f')}"
        tag = admin.post(f"{BASE}/tags", json={"name": name}).json()
        trash["tags"].append(tag["id"])

        r = admin.post(f"{BASE}/leads/{lead['id']}/tags", json={"tag_ids": [tag["id"]]})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert tag["id"] in data["tags"]
        assert any(t["id"] == tag["id"] for t in data.get("tag_details", [])), data.get("tag_details")

        acts = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["activities"]
        assert any(a["type"] == "tag" for a in acts)

        # filter
        r = admin.get(f"{BASE}/leads", params={"tag": tag["id"]})
        assert r.status_code == 200
        ids = [l["id"] for l in (r.json().get("items") if isinstance(r.json(), dict) else r.json())]
        assert lead["id"] in ids

        # remove tag activity
        r = admin.post(f"{BASE}/leads/{lead['id']}/tags", json={"tag_ids": []})
        assert r.status_code == 200 and r.json()["tags"] == []

        # re-add then delete tag -> pulled from lead
        admin.post(f"{BASE}/leads/{lead['id']}/tags", json={"tag_ids": [tag["id"]]})
        assert admin.delete(f"{BASE}/tags/{tag['id']}").status_code == 200
        after = admin.get(f"{BASE}/leads/{lead['id']}").json()
        assert tag["id"] not in (after.get("tags") or [])
        trash["tags"].remove(tag["id"])


# ================= WhatsApp templates =================
class TestWaTemplates:
    def test_templates_crud_and_seed(self, admin, rec, trash):
        r = admin.get(f"{BASE}/wa-templates")
        assert r.status_code == 200
        tpls = r.json()
        assert len(tpls) >= 5, f"expected >=5 seeded templates, got {len(tpls)}"
        assert all("_id" not in t for t in tpls)
        assert any("{{Candidate Name}}" in t["body"] or "{Candidate Name}" in t["body"] for t in tpls)

        r = admin.post(f"{BASE}/wa-templates", json={"name": "TEST_Tpl", "body": "Hi {{Candidate Name}}"})
        assert r.status_code == 200, r.text[:300]
        t = r.json()
        trash["templates"].append(t["id"])
        assert admin.post(f"{BASE}/wa-templates", json={"name": "x"}).status_code == 400

        r = admin.patch(f"{BASE}/wa-templates/{t['id']}", json={"body": "Updated {{Candidate Name}}"})
        assert r.status_code == 200 and r.json()["body"].startswith("Updated")

        assert rec.post(f"{BASE}/wa-templates", json={"name": "n", "body": "b"}).status_code == 403
        assert rec.delete(f"{BASE}/wa-templates/{t['id']}").status_code == 403
        assert admin.delete(f"{BASE}/wa-templates/{t['id']}").status_code == 200
        trash["templates"].remove(t["id"])
        assert admin.patch(f"{BASE}/wa-templates/{t['id']}", json={"body": "z"}).status_code == 404

    def test_whatsapp_log(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_WaLead")
        r = admin.post(f"{BASE}/leads/{lead['id']}/whatsapp",
                       json={"template_name": "Initial Job Message", "message": "Hi TEST_WaLead"})
        assert r.status_code == 200, r.text[:300]
        acts = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["activities"]
        wa = [a for a in acts if a["type"] == "whatsapp"]
        assert wa and "WhatsApp sent" in wa[0]["description"]


# ================= Notes =================
class TestNotes:
    def test_notes_crud_and_activities_shape(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_NoteLead")
        assert admin.post(f"{BASE}/leads/{lead['id']}/notes", json={"text": "  "}).status_code == 400
        r = admin.post(f"{BASE}/leads/{lead['id']}/notes", json={"text": "TEST note one"})
        assert r.status_code == 200, r.text[:300]
        note = r.json()
        assert note["text"] == "TEST note one" and "_id" not in note

        act = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()
        for k in ("activities", "calls", "notes", "followups"):
            assert k in act, f"missing {k}"
        assert any(n["id"] == note["id"] for n in act["notes"])

        r = admin.patch(f"{BASE}/leads/{lead['id']}/notes/{note['id']}", json={"text": "TEST note edited"})
        assert r.status_code == 200 and r.json()["text"] == "TEST note edited"
        notes = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["notes"]
        assert [n for n in notes if n["id"] == note["id"]][0]["text"] == "TEST note edited"

        assert admin.delete(f"{BASE}/leads/{lead['id']}/notes/{note['id']}").status_code == 200
        notes = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["notes"]
        assert not [n for n in notes if n["id"] == note["id"]]

    def test_recruiter_cannot_edit_others_note(self, admin, rec, trash):
        lead = make_lead(admin, trash, "TEST_NoteOwn", recruiter_id=rec.me["id"])
        note = admin.post(f"{BASE}/leads/{lead['id']}/notes", json={"text": "admin note"}).json()
        assert rec.patch(f"{BASE}/leads/{lead['id']}/notes/{note['id']}", json={"text": "hack"}).status_code == 403
        assert rec.delete(f"{BASE}/leads/{lead['id']}/notes/{note['id']}").status_code == 403


# ================= Follow-up enforcement on PATCH lead =================
class TestFollowupEnforcement:
    def test_non_final_status_requires_followup(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_FuEnforce", followup=False)
        assert not lead.get("next_followup_date")
        r = admin.patch(f"{BASE}/leads/{lead['id']}", json={"lead_status": "Interested"})
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:200]}"
        assert "follow-up" in r.text.lower()

        due = future(30)
        r = admin.patch(f"{BASE}/leads/{lead['id']}",
                        json={"lead_status": "Interested", "next_followup_date": due,
                              "next_followup_reason": "TEST reason"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["lead_status"] == "Interested"
        assert r.json()["next_followup_date"] == due
        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        pending = [f for f in fus if f["status"] == "pending"]
        assert len(pending) == 1 and pending[0]["due_date"] == due

        # second reschedule supersedes previous pending
        due2 = future(50)
        r = admin.patch(f"{BASE}/leads/{lead['id']}", json={"lead_status": "Follow-up", "next_followup_date": due2})
        assert r.status_code == 200
        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        assert len([f for f in fus if f["status"] == "pending"]) == 1
        assert any(f["status"] == "superseded" for f in fus), [f["status"] for f in fus]

        # with an existing pending followup, status change without date is allowed
        r = admin.patch(f"{BASE}/leads/{lead['id']}", json={"lead_status": "Interested"})
        assert r.status_code == 200, r.text[:300]

    def test_final_status_validations(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_FinalVal")
        assert admin.patch(f"{BASE}/leads/{lead['id']}", json={"lead_status": "Selected"}).status_code == 400
        assert admin.patch(f"{BASE}/leads/{lead['id']}", json={"lead_status": "Rejected"}).status_code == 400
        assert admin.patch(f"{BASE}/leads/{lead['id']}", json={"lead_status": "Not Interested"}).status_code == 400

        r = admin.patch(f"{BASE}/leads/{lead['id']}",
                        json={"lead_status": "Not Interested", "lost_reason": "TEST not interested"})
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["lead_status"] == "Not Interested"
        assert not data.get("next_followup_date")
        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        assert not [f for f in fus if f["status"] == "pending"]

    def test_selected_with_joining_date(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_SelLead")
        r = admin.patch(f"{BASE}/leads/{lead['id']}",
                        json={"lead_status": "Selected", "expected_joining_date": future(240)})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["lead_status"] == "Selected" and not r.json().get("next_followup_date")


# ================= Call log =================
class TestCallLog:
    def test_no_answer_requires_followup(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_CallNA", followup=False)
        r = admin.post(f"{BASE}/leads/{lead['id']}/call", json={"disposition": "No Answer", "notes": "t"})
        assert r.status_code == 400, f"got {r.status_code} {r.text[:200]}"
        due = future(20)
        r = admin.post(f"{BASE}/leads/{lead['id']}/call",
                       json={"disposition": "No Answer", "followup_date": due, "followup_reason": "retry"})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["lead_status"] == "Attempted", d["lead_status"]
        assert d["next_followup_date"] == due

    def test_not_interested_and_invalid_number(self, admin, trash):
        l1 = make_lead(admin, trash, "TEST_CallNI", followup=False)
        r = admin.post(f"{BASE}/leads/{l1['id']}/call", json={"disposition": "Not Interested"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["lead_status"] == "Not Interested"
        assert not r.json().get("next_followup_date")

        l2 = make_lead(admin, trash, "TEST_CallInv", followup=False)
        r = admin.post(f"{BASE}/leads/{l2['id']}/call", json={"disposition": "Invalid Number"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["lead_status"] == "Invalid Lead"
        assert r.json()["phone_valid"] is False

    def test_interview_scheduled(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_CallIv", followup=False)
        clients = admin.get(f"{BASE}/clients").json()
        jobs = admin.get(f"{BASE}/jobs").json()
        assert clients and jobs
        r = admin.post(f"{BASE}/leads/{lead['id']}/call", json={"disposition": "Interview Scheduled"})
        assert r.status_code == 400
        r = admin.post(f"{BASE}/leads/{lead['id']}/call", json={
            "disposition": "Interview Scheduled", "interview_date": future(72),
            "client_id": clients[0]["id"], "job_id": jobs[0]["id"]})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["interview_status"] == "Scheduled"
        ivs = [i for i in admin.get(f"{BASE}/interviews").json() if i["lead_id"] == lead["id"]]
        assert ivs, "interview record not created"


# ================= Follow-up views / CRUD =================
class TestFollowups:
    def test_views_and_counts(self, admin):
        for v in ("today", "overdue", "tomorrow", "upcoming", "missed", "completed", "all"):
            r = admin.get(f"{BASE}/followups", params={"view": v})
            assert r.status_code == 200, f"{v}: {r.status_code} {r.text[:200]}"
            assert isinstance(r.json(), list)
            for f in r.json():
                assert "_id" not in f and "lead_name" in f
        c = admin.get(f"{BASE}/followups/counts")
        assert c.status_code == 200
        for k in ("today", "overdue", "tomorrow", "upcoming", "completed", "missed"):
            assert k in c.json() and isinstance(c.json()[k], int)

    def test_create_reschedule_complete_delete(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_FuFlow", followup=False)
        assert admin.post(f"{BASE}/followups", json={"lead_id": lead["id"]}).status_code == 400
        due = future(26)
        r = admin.post(f"{BASE}/followups", json={"lead_id": lead["id"], "due_date": due, "reason": "TEST fu"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["next_followup_date"] == due

        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        fid = [f for f in fus if f["status"] == "pending"][0]["id"]

        due2 = future(60)
        r = admin.patch(f"{BASE}/followups/{fid}", json={"due_date": due2, "reason": "TEST resched"})
        assert r.status_code == 200, r.text[:300]
        assert admin.get(f"{BASE}/leads/{lead['id']}").json()["next_followup_date"] == due2

        # complete requires next date or final status
        assert admin.post(f"{BASE}/followups/{fid}/complete", json={}).status_code == 400
        nxt = future(90)
        r = admin.post(f"{BASE}/followups/{fid}/complete", json={"next_date": nxt, "next_reason": "TEST next"})
        assert r.status_code == 200, r.text[:300]
        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        assert [f for f in fus if f["id"] == fid][0]["status"] == "completed"
        pending = [f for f in fus if f["status"] == "pending"]
        assert len(pending) == 1 and pending[0]["due_date"] == nxt
        newfid = pending[0]["id"]

        # complete with final status
        r = admin.post(f"{BASE}/followups/{newfid}/complete", json={"lead_status": "Closed"})
        assert r.status_code == 200, r.text[:300]
        lead_after = admin.get(f"{BASE}/leads/{lead['id']}").json()
        assert lead_after["lead_status"] == "Closed"
        assert not lead_after.get("next_followup_date")

        # delete followup: admin ok, recruiter forbidden checked separately
        assert admin.delete(f"{BASE}/followups/{newfid}").status_code == 200
        assert admin.delete(f"{BASE}/followups/{newfid}").status_code == 404

    def test_recruiter_cannot_delete_followup(self, admin, rec, trash):
        lead = make_lead(admin, trash, "TEST_FuPerm", recruiter_id=rec.me["id"])
        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        fid = fus[0]["id"]
        assert rec.delete(f"{BASE}/followups/{fid}").status_code == 403

    def test_followups_search_and_recruiter_filter(self, admin, rec):
        r = admin.get(f"{BASE}/followups", params={"view": "all", "search": "zzzz_no_match_zzz"})
        assert r.status_code == 200 and r.json() == []
        r = admin.get(f"{BASE}/followups", params={"view": "all", "recruiter_id": rec.me["id"]})
        assert r.status_code == 200
        assert all(f["recruiter_id"] == rec.me["id"] for f in r.json())


# ================= Users =================
class TestUsers:
    def test_patch_user_and_duplicate_email(self, admin, trash):
        stamp = datetime.now().strftime("%H%M%S%f")
        r = admin.post(f"{BASE}/users", json={"name": "TEST_U1", "email": f"test_u1_{stamp}@qatest.example.com",
                                              "password": "Qa@123456", "role": "recruiter", "phone": "9000000001"})
        assert r.status_code == 200, r.text[:300]
        u = r.json()
        trash["users"].append(u["id"])
        assert "password_hash" not in u

        r = admin.patch(f"{BASE}/users/{u['id']}", json={"phone": "9000000099", "name": "TEST_U1_edited"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["phone"] == "9000000099" and r.json()["name"] == "TEST_U1_edited"
        listed = [x for x in admin.get(f"{BASE}/users").json() if x["id"] == u["id"]][0]
        assert listed["phone"] == "9000000099"

        # duplicate email
        r = admin.patch(f"{BASE}/users/{u['id']}", json={"email": ADMIN[0]})
        assert r.status_code == 400, r.text[:200]

        # deactivate ok
        r = admin.patch(f"{BASE}/users/{u['id']}", json={"active": False})
        assert r.status_code == 200 and r.json()["active"] is False
        assert admin.patch(f"{BASE}/users/{u['id']}", json={"active": True}).json()["active"] is True

    def test_admin_protected(self, admin):
        admin_user = [u for u in admin.get(f"{BASE}/users").json() if u["role"] == "admin"][0]
        assert admin.patch(f"{BASE}/users/{admin_user['id']}", json={"active": False}).status_code == 400
        assert admin.delete(f"{BASE}/users/{admin_user['id']}").status_code == 400

    def test_delete_user_requires_transfer(self, admin, trash):
        stamp = datetime.now().strftime("%H%M%S%f")
        u = admin.post(f"{BASE}/users", json={"name": "TEST_Del", "email": f"test_del_{stamp}@qatest.example.com",
                                              "password": "Qa@123456", "role": "recruiter"}).json()
        u2 = admin.post(f"{BASE}/users", json={"name": "TEST_Recv", "email": f"test_recv_{stamp}@qatest.example.com",
                                               "password": "Qa@123456", "role": "recruiter"}).json()
        trash["users"] += [u["id"], u2["id"]]
        lead = make_lead(admin, trash, "TEST_TransferLead", recruiter_id=u["id"])
        assert lead["assigned_recruiter_id"] == u["id"]

        r = admin.delete(f"{BASE}/users/{u['id']}")
        assert r.status_code == 400 and "lead" in r.text.lower()

        r = admin.delete(f"{BASE}/users/{u['id']}", params={"transfer_to": u2["id"]})
        assert r.status_code == 200, r.text[:300]
        after = admin.get(f"{BASE}/leads/{lead['id']}").json()
        assert after["assigned_recruiter_id"] == u2["id"]
        assert any(h.get("action") == "transferred" for h in after.get("assignment_history", []))
        acts = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["activities"]
        assert any(a["type"] == "transfer" for a in acts)
        fus = admin.get(f"{BASE}/leads/{lead['id']}/activities").json()["followups"]
        assert all(f["recruiter_id"] == u2["id"] for f in fus if f["status"] == "pending")
        assert not [x for x in admin.get(f"{BASE}/users").json() if x["id"] == u["id"]]
        trash["users"].remove(u["id"])

    def test_delete_user_no_leads(self, admin, trash):
        stamp = datetime.now().strftime("%H%M%S%f")
        u = admin.post(f"{BASE}/users", json={"name": "TEST_Empty", "email": f"test_empty_{stamp}@qatest.example.com",
                                              "password": "Qa@123456", "role": "recruiter"}).json()
        assert admin.delete(f"{BASE}/users/{u['id']}").status_code == 200
        assert not [x for x in admin.get(f"{BASE}/users").json() if x["id"] == u["id"]]

    def test_transfer_leads_endpoint(self, admin, trash):
        stamp = datetime.now().strftime("%H%M%S%f")
        a = admin.post(f"{BASE}/users", json={"name": "TEST_TA", "email": f"test_ta_{stamp}@qatest.example.com",
                                              "password": "Qa@123456", "role": "recruiter"}).json()
        b = admin.post(f"{BASE}/users", json={"name": "TEST_TB", "email": f"test_tb_{stamp}@qatest.example.com",
                                              "password": "Qa@123456", "role": "recruiter"}).json()
        trash["users"] += [a["id"], b["id"]]
        lead = make_lead(admin, trash, "TEST_TransEP", recruiter_id=a["id"])
        assert admin.post(f"{BASE}/users/{a['id']}/transfer-leads",
                          json={"to_recruiter_id": a["id"]}).status_code == 400
        r = admin.post(f"{BASE}/users/{a['id']}/transfer-leads", json={"to_recruiter_id": b["id"]})
        assert r.status_code == 200 and r.json()["transferred"] >= 1
        assert admin.get(f"{BASE}/leads/{lead['id']}").json()["assigned_recruiter_id"] == b["id"]

    def test_recruiter_cannot_manage_users(self, rec):
        assert rec.get(f"{BASE}/users").status_code == 403
        assert rec.post(f"{BASE}/users", json={"name": "x", "email": "x@y.z", "password": "aaaaaaaa",
                                               "role": "recruiter"}).status_code == 403


# ================= Lead delete + permissions =================
class TestLeadPermissions:
    def test_delete_lead_cascade(self, admin, trash):
        lead = make_lead(admin, trash, "TEST_Cascade")
        admin.post(f"{BASE}/leads/{lead['id']}/notes", json={"text": "n"})
        admin.post(f"{BASE}/leads/{lead['id']}/call",
                   json={"disposition": "No Answer", "followup_date": future(20)})
        assert admin.delete(f"{BASE}/leads/{lead['id']}").status_code == 200
        trash["leads"].remove(lead["id"])
        assert admin.get(f"{BASE}/leads/{lead['id']}").status_code == 404
        fus = admin.get(f"{BASE}/followups", params={"view": "all"}).json()
        assert not [f for f in fus if f["lead_id"] == lead["id"]]

    def test_recruiter_scope_and_delete_guards(self, admin, rec, trash):
        other = make_lead(admin, trash, "TEST_NotMine", recruiter_id=admin.me["id"])
        r = rec.patch(f"{BASE}/leads/{other['id']}", json={"priority": "Hot"})
        assert r.status_code == 403, f"got {r.status_code}"
        assert rec.delete(f"{BASE}/leads/{other['id']}").status_code == 403
        clients = admin.get(f"{BASE}/clients").json()
        jobs = admin.get(f"{BASE}/jobs").json()
        assert rec.delete(f"{BASE}/clients/{clients[0]['id']}").status_code == 403
        assert rec.delete(f"{BASE}/jobs/{jobs[0]['id']}").status_code == 403
        assert rec.post(f"{BASE}/clients", json={"name": "TEST_x"}).status_code == 403
        assert rec.post(f"{BASE}/jobs", json={"title": "TEST_x"}).status_code == 403

    def test_recruiter_can_edit_own_lead(self, admin, rec, trash):
        mine = make_lead(admin, trash, "TEST_Mine", recruiter_id=rec.me["id"])
        r = rec.patch(f"{BASE}/leads/{mine['id']}", json={"city": "Mumbai"})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["city"] == "Mumbai"


# ================= Dashboard / settings / views =================
class TestDashboardSettings:
    def test_dashboard_main_keys(self, admin):
        r = admin.get(f"{BASE}/dashboard/main")
        assert r.status_code == 200
        t = r.json()["today"]
        for k in ("fresh_leads", "no_answer", "rejected", "followups_due", "followups_overdue",
                  "interested", "interviews_scheduled", "selected", "joined", "calls_made",
                  "connected", "leads_added"):
            assert k in t, f"missing today.{k}"

    def test_lead_views(self, admin):
        for v in ("no_answer", "interested", "interviews", "rejected", "new_leads"):
            r = admin.get(f"{BASE}/leads", params={"view": v})
            assert r.status_code == 200, f"{v}: {r.status_code} {r.text[:200]}"

    def test_settings_statuses(self, admin):
        r = admin.get(f"{BASE}/settings")
        assert r.status_code == 200
        st = r.json()["lead_statuses"]
        for s in ("Attempted", "Interview Attended", "Joining Pending", "Not Interested", "No Answer",
                  "Wrong Number", "Duplicate", "Rejected", "Invalid Lead", "Closed"):
            assert s in st, f"status {s} missing from settings.lead_statuses"


# ================= Interviews / joinings =================
class TestInterviewsJoinings:
    def _mk_interview(self, admin, trash, name):
        lead = make_lead(admin, trash, name, followup=False)
        clients = admin.get(f"{BASE}/clients").json()
        jobs = admin.get(f"{BASE}/jobs").json()
        r = admin.post(f"{BASE}/leads/{lead['id']}/call", json={
            "disposition": "Interview Scheduled", "interview_date": future(72),
            "client_id": clients[0]["id"], "job_id": jobs[0]["id"]})
        assert r.status_code == 200, r.text[:300]
        iv = [i for i in admin.get(f"{BASE}/interviews").json() if i["lead_id"] == lead["id"]][0]
        return lead, iv

    def test_stage_attended_and_rejected(self, admin, trash):
        lead, iv = self._mk_interview(admin, trash, "TEST_IvAtt")
        r = admin.patch(f"{BASE}/interviews/{iv['id']}", json={"stage": "Attended"})
        assert r.status_code == 200, r.text[:300]
        assert admin.get(f"{BASE}/leads/{lead['id']}").json()["lead_status"] == "Interview Attended"
        r = admin.patch(f"{BASE}/interviews/{iv['id']}", json={"stage": "Rejected"})
        assert r.status_code == 200
        assert admin.get(f"{BASE}/leads/{lead['id']}").json()["lead_status"] == "Rejected"

    def test_interview_reschedule_and_delete(self, admin, rec, trash):
        lead, iv = self._mk_interview(admin, trash, "TEST_IvDel")
        newdt = future(100)
        r = admin.patch(f"{BASE}/interviews/{iv['id']}", json={"datetime": newdt})
        assert r.status_code == 200 and r.json()["datetime"] == newdt
        assert rec.delete(f"{BASE}/interviews/{iv['id']}").status_code == 403
        assert admin.delete(f"{BASE}/interviews/{iv['id']}").status_code == 200
        assert admin.delete(f"{BASE}/interviews/{iv['id']}").status_code == 404

    def test_joining_flow(self, admin, rec, trash):
        lead = make_lead(admin, trash, "TEST_Jn", followup=False)
        clients = admin.get(f"{BASE}/clients").json()
        r = admin.post(f"{BASE}/joinings", json={"lead_id": lead["id"], "client_id": clients[0]["id"],
                                                 "recruiter_id": admin.me["id"], "joining_date": future(200),
                                                 "status": "Selected"})
        assert r.status_code == 200, r.text[:300]
        jn = r.json()
        assert "_id" not in jn
        r = admin.patch(f"{BASE}/joinings/{jn['id']}", json={"status": "Joined"})
        assert r.status_code == 200
        assert admin.get(f"{BASE}/leads/{lead['id']}").json()["lead_status"] == "Joined"
        assert rec.delete(f"{BASE}/joinings/{jn['id']}").status_code == 403
        assert admin.delete(f"{BASE}/joinings/{jn['id']}").status_code == 200
        assert admin.delete(f"{BASE}/joinings/{jn['id']}").status_code == 404


# ================= Clients / Jobs CRUD =================
class TestClientsJobs:
    def test_client_and_job_crud(self, admin, trash):
        r = admin.post(f"{BASE}/clients", json={"name": "TEST_Client", "city": "Pune", "industry": "IT"})
        assert r.status_code == 200, r.text[:300]
        c = r.json()
        trash["clients"].append(c["id"])
        r = admin.patch(f"{BASE}/clients/{c['id']}", json={"city": "Nashik"})
        assert r.status_code == 200
        assert [x for x in admin.get(f"{BASE}/clients").json() if x["id"] == c["id"]][0]["city"] == "Nashik"

        r = admin.post(f"{BASE}/jobs", json={"title": "TEST_Job", "client_id": c["id"], "status": "Active"})
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        trash["jobs"].append(j["id"])
        r = admin.patch(f"{BASE}/jobs/{j['id']}", json={"status": "Closed"})
        assert r.status_code == 200
        assert [x for x in admin.get(f"{BASE}/jobs").json() if x["id"] == j["id"]][0]["status"] == "Closed"

        assert admin.delete(f"{BASE}/jobs/{j['id']}").status_code == 200
        trash["jobs"].remove(j["id"])
        assert admin.delete(f"{BASE}/clients/{c['id']}").status_code == 200
        trash["clients"].remove(c["id"])
