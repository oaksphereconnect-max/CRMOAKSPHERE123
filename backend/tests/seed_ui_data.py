"""Seed / cleanup UI test data (TEST_UI_* leads with today & overdue follow-ups)."""
import sys
from datetime import datetime, timedelta, timezone

import requests
from dotenv import dotenv_values

B = dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


tok = requests.post(B + "/auth/login", json={"email": "oaksphereconnect@gmail.com",
                                             "password": "OakAdmin@2026"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
now = datetime.now(timezone.utc)

if sys.argv[1:] and sys.argv[1] == "clean":
    leads = requests.get(B + "/leads", headers=H).json()
    leads = leads.get("items") if isinstance(leads, dict) else leads
    n = 0
    for l in leads:
        if (l.get("name") or "").startswith(("TEST_", "QA_")):
            requests.delete(f"{B}/leads/{l['id']}", headers=H)
            n += 1
    for t in requests.get(B + "/tags", headers=H).json():
        if t["name"].startswith("TEST_"):
            requests.delete(f"{B}/tags/{t['id']}", headers=H)
    for t in requests.get(B + "/wa-templates", headers=H).json():
        if t["name"].startswith("TEST_"):
            requests.delete(f"{B}/wa-templates/{t['id']}", headers=H)
    for u in requests.get(B + "/users", headers=H).json():
        if u["name"].startswith("TEST_"):
            requests.delete(f"{B}/users/{u['id']}", headers=H, params={"transfer_to": None})
    for c in requests.get(B + "/clients", headers=H).json():
        if c["name"].startswith("TEST_"):
            requests.delete(f"{B}/clients/{c['id']}", headers=H)
    for j in requests.get(B + "/jobs", headers=H).json():
        if (j.get("title") or "").startswith("TEST_"):
            requests.delete(f"{B}/jobs/{j['id']}", headers=H)
    print(f"cleaned {n} test leads + test tags/templates/users/clients/jobs")
    sys.exit(0)

recs = requests.get(B + "/recruiters", headers=H).json()
harsh = [r for r in recs if r["email"] == "harshika@oaksphere.com"][0]["id"]

plan = [
    ("TEST_UI_Today", iso(now + timedelta(hours=2))),
    ("TEST_UI_Overdue", iso(now - timedelta(hours=20))),
    ("TEST_UI_Tomorrow", iso(now + timedelta(days=1, hours=1))),
]
for name, due in plan:
    stamp = datetime.now().strftime("%H%M%S%f")[:10]
    r = requests.post(B + "/leads", headers=H, json={
        "name": name, "phone": "8" + stamp[:9], "source": "Referral", "city": "Pune",
        "assigned_recruiter_id": harsh, "next_followup_date": due,
        "next_followup_reason": "UI test follow-up"})
    print(name, r.status_code, r.json().get("id"), r.json().get("next_followup_date"))
print("counts", requests.get(B + "/followups/counts", headers=H).json())
