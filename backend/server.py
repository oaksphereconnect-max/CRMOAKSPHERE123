from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import logging
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
import io
import csv
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("oaksphere")


# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def parse_dt(s):
    if not s:
        return None
    if isinstance(s, datetime):
        return s if s.tzinfo else s.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found or inactive")
    user = clean(user)
    user.pop("password_hash", None)
    return user


def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker


async def scope_recruiter_ids(user: dict):
    """Return list of recruiter ids the user can see, or None for all (admin)."""
    if user["role"] == "admin":
        return None
    if user["role"] == "team_leader":
        team = await db.users.find({"team_leader_id": user["id"]}).to_list(1000)
        return [user["id"]] + [u["id"] for u in team]
    return [user["id"]]


async def log_audit(entity, entity_id, field, old, new, actor):
    await db.audit_logs.insert_one({
        "id": new_id(), "entity": entity, "entity_id": entity_id,
        "field": field, "old": str(old), "new": str(new),
        "actor_id": actor["id"], "actor_name": actor["name"],
        "created_at": iso(now_utc()),
    })


async def notify(user_id, ntype, message):
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user_id, "type": ntype,
        "message": message, "read": False, "created_at": iso(now_utc()),
    })


async def log_activity(lead_id, atype, description, actor):
    await db.lead_activities.insert_one({
        "id": new_id(), "lead_id": lead_id, "type": atype,
        "description": description, "actor_id": actor["id"],
        "actor_name": actor["name"], "created_at": iso(now_utc()),
    })


# ---------------- Constants ----------------
CONNECTED_DISPOSITIONS = {
    "Connected–Interested", "Not Interested", "Callback Requested",
    "Interview Scheduled", "Already Working", "Salary Issue",
    "Location Issue", "Job Mismatch",
}
NOT_CONNECTED_DISPOSITIONS = {
    "No Answer", "Busy", "Switched Off", "Unreachable",
    "Invalid Number", "WhatsApp Only", "Call Back Later",
}
DEFAULT_SETTINGS = {
    "id": "global",
    "agency_name": "OAKsphere Connect",
    "sources": ["Meta Ads", "WorkIndia", "Facebook", "Instagram", "Website",
                "WhatsApp", "Referral", "Manual", "Other"],
    "priorities": ["Hot", "High", "Medium", "Low", "Cold"],
    "lead_statuses": ["New", "Contacted", "Interested", "Follow-up", "Interview",
                      "Selected", "Joined", "Lost"],
    "interview_statuses": ["Pending", "Scheduled", "Tomorrow", "Today", "Attended",
                           "Not Attended", "Rescheduled", "Selected", "Rejected", "Dropped"],
    "joining_statuses": ["Selected", "Documents Pending", "Offer Pending", "Offer Released",
                         "Joining Confirmed", "Joined", "Delayed", "No Show", "Dropped", "Client Rejected"],
    "target_calls": 100,
    "target_connected": 45,
    "target_lineups": 12,
    "target_joinings_month": 30,
    "escalation_hours": 4,
}


# ---------------- Auth Models ----------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class ChangePwIn(BaseModel):
    old_password: str
    new_password: str


# ---------------- Auth Routes ----------------
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account is deactivated. Contact your admin.")
    token = create_token(user["id"], user["email"], user["role"])
    u = clean(dict(user))
    u.pop("password_hash", None)
    return {"token": token, "user": u}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


@api.post("/auth/change-password")
async def change_password(body: ChangePwIn, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.old_password, full["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "id": new_id(), "token": token, "user_id": user["id"],
            "expires_at": iso(now_utc() + timedelta(hours=1)), "used": False,
        })
        logger.info(f"Password reset link: /reset-password?token={token}")
    return {"ok": True, "message": "If the email exists, a reset link was generated (see server logs)."}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec or parse_dt(rec["expires_at"]) < now_utc():
        raise HTTPException(400, "Invalid or expired reset token")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"id": rec["id"]}, {"$set": {"used": True}})
    return {"ok": True}


# ---------------- Users ----------------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "recruiter"
    phone: Optional[str] = None
    team_leader_id: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    team_leader_id: Optional[str] = None


@api.get("/users")
async def list_users(user: dict = Depends(require_role("admin", "team_leader"))):
    users = await db.users.find().to_list(1000)
    out = []
    for u in users:
        u = clean(u)
        u.pop("password_hash", None)
        out.append(u)
    return out


@api.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_role("admin"))):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    doc = {
        "id": new_id(), "name": body.name, "email": body.email.lower(),
        "password_hash": hash_password(body.password), "role": body.role,
        "phone": body.phone, "team_leader_id": body.team_leader_id,
        "active": True, "avatar": None, "is_demo": False,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    doc = clean(doc)
    doc.pop("password_hash", None)
    return doc


@api.patch("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, user: dict = Depends(require_role("admin"))):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.users.update_one({"id": uid}, {"$set": upd})
    u = clean(await db.users.find_one({"id": uid}))
    u.pop("password_hash", None)
    return u


@api.post("/users/{uid}/reset-password")
async def admin_reset_pw(uid: str, body: dict, user: dict = Depends(require_role("admin"))):
    pw = body.get("password") or "recruiter123"
    await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(pw)}})
    return {"ok": True}


# ---------------- Recruiters (with stats) ----------------
@api.get("/recruiters")
async def list_recruiters(user: dict = Depends(get_current_user)):
    if user["role"] == "recruiter":
        users = await db.users.find({"id": user["id"]}).to_list(1)
    elif user["role"] == "team_leader":
        users = await db.users.find({"$or": [{"id": user["id"]}, {"team_leader_id": user["id"]}]}).to_list(1000)
    else:
        users = await db.users.find({"role": {"$in": ["recruiter", "team_leader"]}}).to_list(1000)
    settings = await get_settings_doc()
    today = now_utc().date()
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    out = []
    for u in users:
        u = clean(u)
        u.pop("password_hash", None)
        rid = u["id"]
        leads = await db.leads.count_documents({"assigned_recruiter_id": rid})
        calls_today = await db.call_logs.count_documents({
            "recruiter_id": rid, "created_at": {"$gte": iso(datetime.combine(today, datetime.min.time(), timezone.utc))}})
        connected_today = await db.call_logs.count_documents({
            "recruiter_id": rid, "connected": True,
            "created_at": {"$gte": iso(datetime.combine(today, datetime.min.time(), timezone.utc))}})
        joined_month = await db.leads.count_documents({
            "assigned_recruiter_id": rid, "lead_status": "Joined",
            "updated_at": {"$gte": iso(month_start)}})
        u["stats"] = {"leads": leads, "calls_today": calls_today,
                      "connected_today": connected_today, "joined_month": joined_month}
        out.append(u)
    return out


# ---------------- Settings ----------------
async def get_settings_doc():
    s = await db.settings.find_one({"id": "global"})
    if not s:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
        return dict(DEFAULT_SETTINGS)
    return clean(s)


@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await get_settings_doc()


@api.patch("/settings")
async def update_settings(body: dict, user: dict = Depends(require_role("admin"))):
    body.pop("id", None)
    await db.settings.update_one({"id": "global"}, {"$set": body}, upsert=True)
    return await get_settings_doc()


# ---------------- Clients ----------------
@api.get("/clients")
async def list_clients(user: dict = Depends(get_current_user)):
    clients = await db.clients.find().to_list(1000)
    out = []
    for c in clients:
        c = clean(c)
        cid = c["id"]
        c["stats"] = {
            "submitted": await db.leads.count_documents({"client_id": cid}),
            "interviewed": await db.interviews.count_documents({"client_id": cid}),
            "selected": await db.leads.count_documents({"client_id": cid, "lead_status": "Selected"}),
            "joined": await db.leads.count_documents({"client_id": cid, "lead_status": "Joined"}),
            "active_jobs": await db.jobs.count_documents({"client_id": cid, "status": "Active"}),
        }
        out.append(c)
    return out


@api.post("/clients")
async def create_client(body: dict, user: dict = Depends(require_role("admin", "team_leader"))):
    doc = {"id": new_id(), "created_at": iso(now_utc()), "active": True, **body}
    await db.clients.insert_one(doc)
    return clean(doc)


@api.patch("/clients/{cid}")
async def update_client(cid: str, body: dict, user: dict = Depends(require_role("admin", "team_leader"))):
    body.pop("id", None); body.pop("stats", None)
    await db.clients.update_one({"id": cid}, {"$set": body})
    return clean(await db.clients.find_one({"id": cid}))


@api.delete("/clients/{cid}")
async def delete_client(cid: str, user: dict = Depends(require_role("admin"))):
    await db.clients.delete_one({"id": cid})
    return {"ok": True}


# ---------------- Jobs ----------------
@api.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user)):
    jobs = await db.jobs.find().to_list(1000)
    clients = {c["id"]: c["name"] for c in await db.clients.find().to_list(1000)}
    out = []
    for j in jobs:
        j = clean(j)
        j["client_name"] = clients.get(j.get("client_id"), "—")
        j["filled"] = await db.leads.count_documents({"job_id": j["id"], "lead_status": "Joined"})
        out.append(j)
    return out


@api.post("/jobs")
async def create_job(body: dict, user: dict = Depends(require_role("admin", "team_leader"))):
    doc = {"id": new_id(), "created_at": iso(now_utc()), "status": "Active", **body}
    await db.jobs.insert_one(doc)
    return clean(doc)


@api.patch("/jobs/{jid}")
async def update_job(jid: str, body: dict, user: dict = Depends(require_role("admin", "team_leader"))):
    body.pop("id", None); body.pop("client_name", None); body.pop("filled", None)
    await db.jobs.update_one({"id": jid}, {"$set": body})
    return clean(await db.jobs.find_one({"id": jid}))


@api.delete("/jobs/{jid}")
async def delete_job(jid: str, user: dict = Depends(require_role("admin"))):
    await db.jobs.delete_one({"id": jid})
    return {"ok": True}


# ---------------- Leads ----------------
async def enrich_lead(lead, name_maps=None):
    lead = clean(lead)
    if name_maps:
        recs, clients, jobs = name_maps
    else:
        recs = {u["id"]: u["name"] for u in await db.users.find().to_list(1000)}
        clients = {c["id"]: c["name"] for c in await db.clients.find().to_list(1000)}
        jobs = {j["id"]: j.get("title") for j in await db.jobs.find().to_list(1000)}
    lead["recruiter_name"] = recs.get(lead.get("assigned_recruiter_id"), "Unassigned")
    lead["client_name"] = clients.get(lead.get("client_id"), None)
    lead["job_title"] = jobs.get(lead.get("job_id"), None)
    # aging bucket
    created = parse_dt(lead.get("created_at"))
    days = (now_utc() - created).days if created else 0
    lead["age_days"] = days
    if days == 0:
        lead["aging"] = "New"
    elif days == 1:
        lead["aging"] = "1 day"
    elif days <= 3:
        lead["aging"] = "3 days"
    elif days <= 7:
        lead["aging"] = "7 days"
    else:
        lead["aging"] = "15+ days"
    return lead


def apply_saved_view(view, leads):
    now = now_utc()
    today = now.date()
    week_end = now + timedelta(days=7)
    def fu(l): return parse_dt(l.get("next_followup_date"))
    filt = {
        "new_leads": lambda l: l.get("lead_status") == "New",
        "not_called": lambda l: (l.get("call_attempts", 0) == 0),
        "todays_followups": lambda l: fu(l) and fu(l).date() == today,
        "overdue_followups": lambda l: fu(l) and fu(l) < now and l.get("lead_status") not in ("Joined", "Lost"),
        "hot_leads": lambda l: l.get("priority") == "Hot",
        "selected": lambda l: l.get("lead_status") == "Selected",
        "joined": lambda l: l.get("lead_status") == "Joined",
        "lost": lambda l: l.get("lead_status") == "Lost",
        "attendance_pending": lambda l: l.get("interview_status") in ("Scheduled", "Today", "Tomorrow"),
        "joining_this_week": lambda l: parse_dt(l.get("expected_joining_date")) and now <= parse_dt(l.get("expected_joining_date")) <= week_end,
    }
    f = filt.get(view)
    return [l for l in leads if f(l)] if f else leads


@api.get("/leads")
async def list_leads(
    user: dict = Depends(get_current_user),
    search: Optional[str] = None, priority: Optional[str] = None,
    source: Optional[str] = None, lead_status: Optional[str] = None,
    recruiter_id: Optional[str] = None, client_id: Optional[str] = None,
    job_id: Optional[str] = None, view: Optional[str] = None,
    aging: Optional[str] = None, mine: Optional[bool] = False,
):
    q: Dict[str, Any] = {}
    scope = await scope_recruiter_ids(user)
    if mine:
        q["assigned_recruiter_id"] = user["id"]
    elif scope is not None:
        q["assigned_recruiter_id"] = {"$in": scope}
    if recruiter_id:
        q["assigned_recruiter_id"] = recruiter_id
    if priority: q["priority"] = priority
    if source: q["source"] = source
    if lead_status: q["lead_status"] = lead_status
    if client_id: q["client_id"] = client_id
    if job_id: q["job_id"] = job_id
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"name": rx}, {"phone": rx}, {"alt_phone": rx}, {"email": rx}, {"lead_code": rx}]
    leads = await db.leads.find(q).sort("created_at", -1).to_list(2000)
    name_maps = (
        {u["id"]: u["name"] for u in await db.users.find().to_list(1000)},
        {c["id"]: c["name"] for c in await db.clients.find().to_list(1000)},
        {j["id"]: j.get("title") for j in await db.jobs.find().to_list(1000)},
    )
    out = [await enrich_lead(l, name_maps) for l in leads]
    if view:
        out = apply_saved_view(view, out)
    if aging:
        out = [l for l in out if l.get("aging") == aging]
    return out


@api.get("/leads/search")
async def global_search(q: str, user: dict = Depends(get_current_user)):
    rx = {"$regex": q, "$options": "i"}
    query = {"$or": [{"name": rx}, {"phone": rx}, {"alt_phone": rx}, {"email": rx}, {"lead_code": rx}]}
    leads = await db.leads.find(query).limit(25).to_list(25)
    return [await enrich_lead(l) for l in leads]


def norm_phone(p) -> str:
    digits = "".join(ch for ch in (p or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


async def find_phone_matches(phone, exclude_id=None):
    target = norm_phone(phone)
    if not target:
        return []
    all_leads = await db.leads.find().to_list(5000)
    return [l for l in all_leads if l.get("id") != exclude_id and
            (norm_phone(l.get("phone")) == target or norm_phone(l.get("alt_phone")) == target)]


@api.get("/leads/check-duplicate")
async def check_duplicate(phone: str, user: dict = Depends(get_current_user)):
    existing = await find_phone_matches(phone)
    return {"duplicate": len(existing) > 0, "matches": [await enrich_lead(e) for e in existing[:10]]}


def validate_phone(phone: str) -> bool:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return 10 <= len(digits) <= 13


@api.post("/leads")
async def create_lead(body: dict, user: dict = Depends(get_current_user)):
    phone = body.get("phone", "").strip()
    dup = bool(await find_phone_matches(phone)) if phone else False
    count = await db.leads.count_documents({})
    doc = {
        "id": new_id(),
        "lead_code": f"OAK-{9000 + count + 1}",
        "name": body.get("name", ""),
        "phone": phone,
        "alt_phone": body.get("alt_phone", ""),
        "email": body.get("email", ""),
        "city": body.get("city", ""),
        "age": body.get("age"),
        "gender": body.get("gender", ""),
        "qualification": body.get("qualification", ""),
        "experience": body.get("experience", ""),
        "current_salary": body.get("current_salary", ""),
        "expected_salary": body.get("expected_salary", ""),
        "notice_period": body.get("notice_period", ""),
        "source": body.get("source", "Manual"),
        "assigned_recruiter_id": body.get("assigned_recruiter_id") or (user["id"] if user["role"] == "recruiter" else None),
        "original_recruiter_id": body.get("assigned_recruiter_id"),
        "client_id": body.get("client_id"),
        "job_id": body.get("job_id"),
        "priority": body.get("priority", "Medium"),
        "lead_status": "New",
        "interview_status": "Pending",
        "joining_status": None,
        "call_attempts": 0,
        "last_call_date": None, "last_call_status": None, "last_call_by": None,
        "next_followup_date": None, "next_followup_reason": None,
        "expected_joining_date": None,
        "lost_reason": None,
        "notes": body.get("notes", ""),
        "phone_valid": validate_phone(phone),
        "duplicate_flag": bool(dup),
        "assignment_history": [],
        "is_demo": False,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
        "updated_by": user["name"],
        "last_touched_at": None,
    }
    if doc["assigned_recruiter_id"]:
        doc["assignment_history"].append({
            "recruiter_id": doc["assigned_recruiter_id"], "by": user["name"],
            "at": iso(now_utc()), "action": "assigned",
        })
        await notify(doc["assigned_recruiter_id"], "lead_assigned", f"New lead assigned: {doc['name']}")
    await db.leads.insert_one(dict(doc))
    await log_activity(doc["id"], "created", f"Lead created by {user['name']}", user)
    return await enrich_lead(doc)


@api.get("/leads/{lid}")
async def get_lead(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    return await enrich_lead(lead)


@api.get("/leads/{lid}/activities")
async def lead_activities(lid: str, user: dict = Depends(get_current_user)):
    acts = await db.lead_activities.find({"lead_id": lid}).sort("created_at", -1).to_list(500)
    calls = await db.call_logs.find({"lead_id": lid}).sort("created_at", -1).to_list(500)
    return {"activities": [clean(a) for a in acts], "calls": [clean(c) for c in calls]}


@api.patch("/leads/{lid}")
async def update_lead(lid: str, body: dict, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    body.pop("id", None)
    for f in ("recruiter_name", "client_name", "job_title", "aging", "age_days"):
        body.pop(f, None)
    # track key state changes
    for key in ("lead_status", "priority", "interview_status", "joining_status"):
        if key in body and body[key] != lead.get(key):
            await log_audit("lead", lid, key, lead.get(key), body[key], user)
            await log_activity(lid, "status_change", f"{key} changed to {body[key]}", user)
    body["updated_at"] = iso(now_utc())
    body["updated_by"] = user["name"]
    await db.leads.update_one({"id": lid}, {"$set": body})
    return await enrich_lead(await db.leads.find_one({"id": lid}))


@api.delete("/leads/{lid}")
async def delete_lead(lid: str, user: dict = Depends(require_role("admin"))):
    await db.leads.delete_one({"id": lid})
    return {"ok": True}


# ---------------- Assignment ----------------
@api.post("/leads/assign")
async def assign_leads(body: dict, user: dict = Depends(require_role("admin", "team_leader"))):
    lead_ids = body["lead_ids"]
    recruiter_id = body["recruiter_id"]
    rec = await db.users.find_one({"id": recruiter_id})
    for lid in lead_ids:
        lead = await db.leads.find_one({"id": lid})
        if not lead:
            continue
        hist = lead.get("assignment_history", [])
        hist.append({"recruiter_id": recruiter_id, "by": user["name"],
                     "at": iso(now_utc()), "action": "reassigned",
                     "from": lead.get("assigned_recruiter_id")})
        upd = {"assigned_recruiter_id": recruiter_id, "assignment_history": hist,
               "updated_at": iso(now_utc()), "updated_by": user["name"]}
        if not lead.get("original_recruiter_id"):
            upd["original_recruiter_id"] = recruiter_id
        await db.leads.update_one({"id": lid}, {"$set": upd})
        await log_audit("lead", lid, "assigned_recruiter_id", lead.get("assigned_recruiter_id"), recruiter_id, user)
        await notify(recruiter_id, "lead_assigned", f"Lead assigned to you: {lead['name']}")
    return {"ok": True, "assigned": len(lead_ids), "recruiter": rec["name"] if rec else None}


@api.post("/leads/auto-distribute")
async def auto_distribute(body: dict, user: dict = Depends(require_role("admin", "team_leader"))):
    lead_ids = body.get("lead_ids")
    if lead_ids:
        leads = await db.leads.find({"id": {"$in": lead_ids}}).to_list(2000)
    else:
        leads = await db.leads.find({"assigned_recruiter_id": None}).to_list(2000)
    recruiters = await db.users.find({"role": "recruiter", "active": True}).to_list(1000)
    if not recruiters:
        raise HTTPException(400, "No active recruiters")
    # workload map
    workload = {}
    for r in recruiters:
        workload[r["id"]] = await db.leads.count_documents({
            "assigned_recruiter_id": r["id"], "lead_status": {"$nin": ["Joined", "Lost"]}})
    # sort leads by priority so hot ones spread across recruiters
    prio_rank = {"Hot": 0, "High": 1, "Medium": 2, "Low": 3, "Cold": 4}
    leads.sort(key=lambda l: prio_rank.get(l.get("priority"), 5))
    assigned = 0
    for lead in leads:
        target = min(workload, key=lambda k: workload[k])
        hist = lead.get("assignment_history", [])
        hist.append({"recruiter_id": target, "by": user["name"], "at": iso(now_utc()), "action": "auto-assigned"})
        upd = {"assigned_recruiter_id": target, "assignment_history": hist,
               "updated_at": iso(now_utc()), "updated_by": user["name"]}
        if not lead.get("original_recruiter_id"):
            upd["original_recruiter_id"] = target
        await db.leads.update_one({"id": lead["id"]}, {"$set": upd})
        await notify(target, "lead_assigned", f"Auto-assigned lead: {lead['name']}")
        workload[target] += 1
        assigned += 1
    return {"ok": True, "assigned": assigned}


# ---------------- Calling ----------------
@api.get("/calling-list")
async def calling_list(user: dict = Depends(get_current_user)):
    rid = user["id"]
    if user["role"] != "recruiter":
        # allow admin/tl to view a recruiter's list via param handled client-side; default: their scope
        scope = await scope_recruiter_ids(user)
        q = {} if scope is None else {"assigned_recruiter_id": {"$in": scope}}
    else:
        q = {"assigned_recruiter_id": rid}
    q["lead_status"] = {"$nin": ["Joined", "Lost"]}
    leads = [await enrich_lead(l) for l in await db.leads.find(q).to_list(2000)]
    now = now_utc()
    today = now.date()
    tomorrow = today + timedelta(days=1)

    def bucket(l):
        fu = parse_dt(l.get("next_followup_date"))
        iv = l.get("interview_status")
        if fu and fu < now:
            return (1, "Overdue Follow-up")
        if l.get("priority") == "Hot" and l.get("call_attempts", 0) == 0:
            return (2, "Hot Candidate")
        if iv in ("Scheduled", "Tomorrow") and l.get("interview_date") and parse_dt(l.get("interview_date")) and parse_dt(l.get("interview_date")).date() == tomorrow:
            return (3, "Interview Tomorrow")
        if fu and fu.date() == today:
            return (4, "Today's Follow-up")
        if l.get("lead_status") == "New" and l.get("priority") in ("Hot", "High"):
            return (5, "New High-Priority")
        if l.get("lead_status") == "New":
            return (6, "New Lead")
        if l.get("call_attempts", 0) > 0:
            return (7, "Reattempt")
        return (8, "Old Lead")

    for l in leads:
        l["_rank"], l["queue_reason"] = bucket(l)
    leads.sort(key=lambda l: (l["_rank"], -{"Hot": 4, "High": 3, "Medium": 2, "Low": 1, "Cold": 0}.get(l.get("priority"), 0)))
    return leads


@api.post("/leads/{lid}/call")
async def log_call(lid: str, body: dict, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid})
    if not lead:
        raise HTTPException(404, "Lead not found")
    disposition = body.get("disposition")
    notes = body.get("notes", "")
    connected = disposition in CONNECTED_DISPOSITIONS

    # ---- Validation ----
    if disposition in ("Callback Requested", "Call Back Later"):
        if not body.get("followup_date") or not body.get("followup_reason"):
            raise HTTPException(400, "Callback requires a follow-up date/time and reason")
    if disposition == "Interview Scheduled":
        if not (body.get("interview_date") and body.get("client_id") and body.get("job_id")):
            raise HTTPException(400, "Interview Scheduled requires date/time, client and job")
    if body.get("lead_status") == "Selected" and not body.get("expected_joining_date"):
        raise HTTPException(400, "Selected requires an expected joining date")
    if body.get("lead_status") == "Lost" and not body.get("lost_reason"):
        raise HTTPException(400, "Lost requires a lost reason")

    # ---- Call log ----
    await db.call_logs.insert_one({
        "id": new_id(), "lead_id": lid, "recruiter_id": user["id"],
        "recruiter_name": user["name"], "disposition": disposition,
        "connected": connected, "notes": notes, "created_at": iso(now_utc()),
    })
    await log_activity(lid, "call", f"Call: {disposition}. {notes}", user)

    upd = {
        "call_attempts": lead.get("call_attempts", 0) + 1,
        "last_call_date": iso(now_utc()),
        "last_call_status": disposition,
        "last_call_by": user["name"],
        "last_touched_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
        "updated_by": user["name"],
    }

    # derive lead status
    status_map = {
        "Connected–Interested": "Interested",
        "Not Interested": "Contacted",
        "Already Working": "Contacted",
        "Salary Issue": "Follow-up", "Location Issue": "Follow-up", "Job Mismatch": "Follow-up",
        "Callback Requested": "Follow-up", "Call Back Later": "Follow-up",
    }
    if disposition in status_map and lead.get("lead_status") == "New":
        upd["lead_status"] = status_map[disposition]
    elif disposition in status_map:
        upd["lead_status"] = status_map[disposition]

    if body.get("lead_status"):
        upd["lead_status"] = body["lead_status"]
    if body.get("priority"):
        upd["priority"] = body["priority"]
    if disposition == "Invalid Number":
        upd["phone_valid"] = False
        upd["lead_status"] = "Lost"
        upd["lost_reason"] = "Invalid Number"

    # follow-up
    if body.get("followup_date"):
        upd["next_followup_date"] = body["followup_date"]
        upd["next_followup_reason"] = body.get("followup_reason", "")
        upd["lead_status"] = upd.get("lead_status", lead.get("lead_status"))
        await db.followups.insert_one({
            "id": new_id(), "lead_id": lid, "recruiter_id": lead.get("assigned_recruiter_id") or user["id"],
            "due_date": body["followup_date"], "reason": body.get("followup_reason", ""),
            "status": "pending", "created_at": iso(now_utc()), "completed_at": None, "escalated": False,
        })

    # interview
    if disposition == "Interview Scheduled":
        upd["interview_status"] = "Scheduled"
        upd["lead_status"] = "Interview"
        upd["client_id"] = body["client_id"]
        upd["job_id"] = body["job_id"]
        upd["interview_date"] = body["interview_date"]
        await db.interviews.insert_one({
            "id": new_id(), "lead_id": lid, "client_id": body["client_id"], "job_id": body["job_id"],
            "recruiter_id": lead.get("assigned_recruiter_id") or user["id"],
            "datetime": body["interview_date"], "location": body.get("location", ""),
            "type": body.get("interview_type", "Telephonic"), "contact_person": body.get("contact_person", ""),
            "notes": notes, "stage": "Scheduled", "confirmation": "Pending", "created_at": iso(now_utc()),
        })

    # lost
    if body.get("lost_reason"):
        upd["lost_reason"] = body["lost_reason"]
        upd["lead_status"] = "Lost"

    # selected / joining
    if body.get("expected_joining_date"):
        upd["expected_joining_date"] = body["expected_joining_date"]

    await db.leads.update_one({"id": lid}, {"$set": upd})
    if upd.get("lead_status") and upd["lead_status"] != lead.get("lead_status"):
        await log_audit("lead", lid, "lead_status", lead.get("lead_status"), upd["lead_status"], user)
    return await enrich_lead(await db.leads.find_one({"id": lid}))


# ---------------- Follow-ups ----------------
@api.get("/followups")
async def get_followups(view: str = "today", user: dict = Depends(get_current_user)):
    scope = await scope_recruiter_ids(user)
    q = {} if scope is None else {"recruiter_id": {"$in": scope}}
    fus = await db.followups.find(q).sort("due_date", 1).to_list(2000)
    now = now_utc()
    today = now.date()
    recs = {u["id"]: u["name"] for u in await db.users.find().to_list(1000)}
    out = []
    for f in fus:
        f = clean(f)
        lead = await db.leads.find_one({"id": f["lead_id"]})
        if not lead:
            continue
        due = parse_dt(f["due_date"])
        f["recruiter_name"] = recs.get(f["recruiter_id"], "—")
        f["lead_name"] = lead["name"]
        f["phone"] = lead["phone"]
        f["priority"] = lead.get("priority")
        f["lead_id"] = lead["id"]
        completed = f["status"] == "completed"
        overdue = due and due < now and not completed
        if overdue:
            delta = now - due
            hours = int(delta.total_seconds() // 3600)
            f["overdue_by"] = f"{delta.days}d" if delta.days >= 1 else f"{hours}h"
        matched = {
            "today": (due and due.date() == today and not completed),
            "overdue": overdue,
            "upcoming": (due and due.date() > today and not completed),
            "completed": completed,
        }.get(view, False)
        if matched:
            out.append(f)
    return out


@api.post("/followups/{fid}/complete")
async def complete_followup(fid: str, user: dict = Depends(get_current_user)):
    await db.followups.update_one({"id": fid}, {"$set": {"status": "completed", "completed_at": iso(now_utc())}})
    f = await db.followups.find_one({"id": fid})
    if f:
        await db.leads.update_one({"id": f["lead_id"]}, {"$set": {"next_followup_date": None, "next_followup_reason": None}})
    return {"ok": True}


@api.get("/reports/missed-followups")
async def missed_followups(user: dict = Depends(get_current_user)):
    scope = await scope_recruiter_ids(user)
    q = {"status": "pending"} if scope is None else {"status": "pending", "recruiter_id": {"$in": scope}}
    fus = await db.followups.find(q).to_list(2000)
    now = now_utc()
    recs = {u["id"]: u["name"] for u in await db.users.find().to_list(1000)}
    out = []
    for f in fus:
        due = parse_dt(f["due_date"])
        if not due or due >= now:
            continue
        lead = await db.leads.find_one({"id": f["lead_id"]})
        if not lead:
            continue
        delta = now - due
        out.append({
            "recruiter": recs.get(f["recruiter_id"], "—"),
            "candidate": lead["name"], "phone": lead["phone"],
            "original_time": f["due_date"],
            "delay": f"{delta.days}d {int((delta.total_seconds()%86400)//3600)}h",
            "priority": lead.get("priority"), "status": lead.get("lead_status"),
        })
    return out


# ---------------- Interviews ----------------
async def enrich_interview(iv):
    iv = clean(iv)
    lead = await db.leads.find_one({"id": iv["lead_id"]})
    client = await db.clients.find_one({"id": iv.get("client_id")})
    job = await db.jobs.find_one({"id": iv.get("job_id")})
    rec = await db.users.find_one({"id": iv.get("recruiter_id")})
    iv["lead_name"] = lead["name"] if lead else "—"
    iv["phone"] = lead["phone"] if lead else ""
    iv["client_name"] = client["name"] if client else "—"
    iv["job_title"] = job.get("title") if job else "—"
    iv["recruiter_name"] = rec["name"] if rec else "—"
    return iv


@api.get("/interviews")
async def list_interviews(view: Optional[str] = None, user: dict = Depends(get_current_user)):
    scope = await scope_recruiter_ids(user)
    q = {} if scope is None else {"recruiter_id": {"$in": scope}}
    ivs = await db.interviews.find(q).sort("datetime", 1).to_list(2000)
    out = [await enrich_interview(iv) for iv in ivs]
    if view == "tomorrow":
        tomorrow = (now_utc() + timedelta(days=1)).date()
        out = [iv for iv in out if parse_dt(iv.get("datetime")) and parse_dt(iv["datetime"]).date() == tomorrow]
    return out


@api.post("/interviews")
async def create_interview(body: dict, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "stage": "Scheduled", "confirmation": "Pending",
           "created_at": iso(now_utc()), **body}
    await db.interviews.insert_one(doc)
    if body.get("lead_id"):
        await db.leads.update_one({"id": body["lead_id"]}, {"$set": {
            "interview_status": "Scheduled", "lead_status": "Interview",
            "client_id": body.get("client_id"), "job_id": body.get("job_id"),
            "interview_date": body.get("datetime")}})
        await log_activity(body["lead_id"], "interview", "Interview scheduled", user)
    return await enrich_interview(doc)


@api.patch("/interviews/{iid}")
async def update_interview(iid: str, body: dict, user: dict = Depends(get_current_user)):
    iv = await db.interviews.find_one({"id": iid})
    body.pop("id", None)
    for f in ("lead_name", "client_name", "job_title", "recruiter_name", "phone"):
        body.pop(f, None)
    await db.interviews.update_one({"id": iid}, {"$set": body})
    if body.get("stage") and iv:
        await db.leads.update_one({"id": iv["lead_id"]}, {"$set": {"interview_status": body["stage"]}})
        await log_audit("interview", iid, "stage", iv.get("stage"), body["stage"], user)
        if body["stage"] == "Selected":
            await db.leads.update_one({"id": iv["lead_id"]}, {"$set": {"lead_status": "Selected"}})
    return await enrich_interview(await db.interviews.find_one({"id": iid}))


# ---------------- Joinings ----------------
async def enrich_joining(j):
    j = clean(j)
    lead = await db.leads.find_one({"id": j["lead_id"]})
    client = await db.clients.find_one({"id": j.get("client_id")})
    rec = await db.users.find_one({"id": j.get("recruiter_id")})
    j["lead_name"] = lead["name"] if lead else "—"
    j["phone"] = lead["phone"] if lead else ""
    j["client_name"] = client["name"] if client else "—"
    j["recruiter_name"] = rec["name"] if rec else "—"
    return j


@api.get("/joinings")
async def list_joinings(user: dict = Depends(get_current_user)):
    scope = await scope_recruiter_ids(user)
    q = {} if scope is None else {"recruiter_id": {"$in": scope}}
    js = await db.joinings.find(q).sort("joining_date", 1).to_list(2000)
    return [await enrich_joining(j) for j in js]


@api.post("/joinings")
async def create_joining(body: dict, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "status": body.get("status", "Selected"),
           "confirmation": "Pending", "created_at": iso(now_utc()), **body}
    await db.joinings.insert_one(doc)
    if body.get("lead_id"):
        await db.leads.update_one({"id": body["lead_id"]}, {"$set": {"joining_status": doc["status"]}})
    return await enrich_joining(doc)


@api.patch("/joinings/{jid}")
async def update_joining(jid: str, body: dict, user: dict = Depends(get_current_user)):
    j = await db.joinings.find_one({"id": jid})
    body.pop("id", None)
    for f in ("lead_name", "client_name", "recruiter_name", "phone"):
        body.pop(f, None)
    await db.joinings.update_one({"id": jid}, {"$set": body})
    if body.get("status") and j:
        await db.leads.update_one({"id": j["lead_id"]}, {"$set": {"joining_status": body["status"]}})
        if body["status"] == "Joined":
            await db.leads.update_one({"id": j["lead_id"]}, {"$set": {"lead_status": "Joined"}})
        await log_audit("joining", jid, "status", j.get("status"), body["status"], user)
    return await enrich_joining(await db.joinings.find_one({"id": jid}))


# ---------------- Dashboards ----------------
async def scoped_leads(user):
    scope = await scope_recruiter_ids(user)
    q = {} if scope is None else {"assigned_recruiter_id": {"$in": scope}}
    return [await enrich_lead(l) for l in await db.leads.find(q).to_list(5000)], scope


@api.get("/dashboard/main")
async def dashboard_main(user: dict = Depends(get_current_user)):
    leads, scope = await scoped_leads(user)
    now = now_utc()
    today = now.date()
    day_start = iso(datetime.combine(today, datetime.min.time(), timezone.utc))
    month_start = iso(now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))

    call_q = {"created_at": {"$gte": day_start}}
    if scope is not None:
        call_q["recruiter_id"] = {"$in": scope}
    calls_today = await db.call_logs.count_documents(call_q)
    connected_today = await db.call_logs.count_documents({**call_q, "connected": True})

    def added_today(l): return parse_dt(l.get("created_at")) and parse_dt(l["created_at"]).date() == today
    fu = lambda l: parse_dt(l.get("next_followup_date"))

    today_kpis = {
        "leads_added": sum(1 for l in leads if added_today(l)),
        "assigned": sum(1 for l in leads if added_today(l) and l.get("assigned_recruiter_id")),
        "calls_made": calls_today,
        "connected": connected_today,
        "not_connected": calls_today - connected_today,
        "interested": sum(1 for l in leads if l.get("lead_status") == "Interested"),
        "followups_due": sum(1 for l in leads if fu(l) and fu(l).date() == today and l.get("lead_status") not in ("Joined", "Lost")),
        "followups_overdue": sum(1 for l in leads if fu(l) and fu(l) < now and l.get("lead_status") not in ("Joined", "Lost")),
        "interviews_scheduled": sum(1 for l in leads if l.get("interview_status") in ("Scheduled", "Today", "Tomorrow")),
        "interviews_attended": sum(1 for l in leads if l.get("interview_status") == "Attended"),
        "selected": sum(1 for l in leads if l.get("lead_status") == "Selected"),
        "joined": sum(1 for l in leads if l.get("lead_status") == "Joined"),
    }

    def in_month(l): return parse_dt(l.get("created_at")) and iso(parse_dt(l["created_at"])) >= month_start
    monthly_kpis = {
        "leads": sum(1 for l in leads if in_month(l)),
        "selected": sum(1 for l in leads if l.get("lead_status") == "Selected"),
        "joined": sum(1 for l in leads if l.get("lead_status") == "Joined"),
        "lost": sum(1 for l in leads if l.get("lead_status") == "Lost"),
    }

    # recruiter comparison
    recruiters = await db.users.find({"role": {"$in": ["recruiter", "team_leader"]}}).to_list(1000)
    if scope is not None:
        recruiters = [r for r in recruiters if r["id"] in scope]
    comparison = []
    for r in recruiters:
        rleads = [l for l in leads if l.get("assigned_recruiter_id") == r["id"]]
        rcalls = await db.call_logs.count_documents({"recruiter_id": r["id"], "created_at": {"$gte": day_start}})
        rconn = await db.call_logs.count_documents({"recruiter_id": r["id"], "connected": True, "created_at": {"$gte": day_start}})
        comparison.append({
            "recruiter": r["name"], "recruiter_id": r["id"],
            "leads": len(rleads), "calls": rcalls, "connected": rconn,
            "followups": sum(1 for l in rleads if fu(l) and fu(l).date() == today),
            "lineups": sum(1 for l in rleads if l.get("interview_status") in ("Scheduled", "Today", "Tomorrow")),
            "attendance": sum(1 for l in rleads if l.get("interview_status") == "Attended"),
            "selected": sum(1 for l in rleads if l.get("lead_status") == "Selected"),
            "joined": sum(1 for l in rleads if l.get("lead_status") == "Joined"),
        })
    return {"today": today_kpis, "monthly": monthly_kpis, "comparison": comparison}


@api.get("/dashboard/funnel")
async def funnel(recruiter_id: Optional[str] = None, source: Optional[str] = None,
                 client_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    leads, scope = await scoped_leads(user)
    if recruiter_id:
        leads = [l for l in leads if l.get("assigned_recruiter_id") == recruiter_id]
    if source:
        leads = [l for l in leads if l.get("source") == source]
    if client_id:
        leads = [l for l in leads if l.get("client_id") == client_id]
    stages = [
        ("Leads", len(leads)),
        ("Called", sum(1 for l in leads if l.get("call_attempts", 0) > 0)),
        ("Connected", sum(1 for l in leads if l.get("last_call_status") in CONNECTED_DISPOSITIONS)),
        ("Interested", sum(1 for l in leads if l.get("lead_status") in ("Interested", "Interview", "Selected", "Joined"))),
        ("Interview", sum(1 for l in leads if l.get("interview_status") not in ("Pending", None))),
        ("Attended", sum(1 for l in leads if l.get("interview_status") in ("Attended", "Selected"))),
        ("Selected", sum(1 for l in leads if l.get("lead_status") in ("Selected", "Joined"))),
        ("Joined", sum(1 for l in leads if l.get("lead_status") == "Joined")),
    ]
    return [{"stage": s, "count": c} for s, c in stages]


@api.get("/dashboard/targets")
async def targets(user: dict = Depends(get_current_user)):
    settings = await get_settings_doc()
    now = now_utc()
    today = now.date()
    day_start = iso(datetime.combine(today, datetime.min.time(), timezone.utc))
    month_start = iso(now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))
    recruiters = await db.users.find({"role": "recruiter", "active": True}).to_list(1000)
    scope = await scope_recruiter_ids(user)
    if scope is not None:
        recruiters = [r for r in recruiters if r["id"] in scope]
    out = []
    for r in recruiters:
        calls = await db.call_logs.count_documents({"recruiter_id": r["id"], "created_at": {"$gte": day_start}})
        conn = await db.call_logs.count_documents({"recruiter_id": r["id"], "connected": True, "created_at": {"$gte": day_start}})
        lineups = await db.interviews.count_documents({"recruiter_id": r["id"], "created_at": {"$gte": day_start}})
        joined = await db.leads.count_documents({"assigned_recruiter_id": r["id"], "lead_status": "Joined", "updated_at": {"$gte": month_start}})

        def status_for(actual, target):
            pct = (actual / target * 100) if target else 0
            if pct >= 100: return "Excellent"
            if pct >= 70: return "On Track"
            if pct >= 40: return "Attention Required"
            return "Critical"

        out.append({
            "recruiter": r["name"], "recruiter_id": r["id"], "avatar": r.get("avatar"),
            "metrics": [
                {"label": "Calls", "actual": calls, "target": settings["target_calls"],
                 "remaining": max(0, settings["target_calls"] - calls), "status": status_for(calls, settings["target_calls"])},
                {"label": "Connected", "actual": conn, "target": settings["target_connected"],
                 "remaining": max(0, settings["target_connected"] - conn), "status": status_for(conn, settings["target_connected"])},
                {"label": "Lineups", "actual": lineups, "target": settings["target_lineups"],
                 "remaining": max(0, settings["target_lineups"] - lineups), "status": status_for(lineups, settings["target_lineups"])},
                {"label": "Joinings (mo)", "actual": joined, "target": settings["target_joinings_month"],
                 "remaining": max(0, settings["target_joinings_month"] - joined), "status": status_for(joined, settings["target_joinings_month"])},
            ],
        })
    return out


@api.get("/dashboard/leaderboard")
async def leaderboard(user: dict = Depends(get_current_user)):
    now = now_utc()
    month_start = iso(now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))
    recruiters = await db.users.find({"role": {"$in": ["recruiter", "team_leader"]}}).to_list(1000)
    out = []
    for r in recruiters:
        calls = await db.call_logs.count_documents({"recruiter_id": r["id"]})
        conn = await db.call_logs.count_documents({"recruiter_id": r["id"], "connected": True})
        lineups = await db.interviews.count_documents({"recruiter_id": r["id"]})
        attended = await db.interviews.count_documents({"recruiter_id": r["id"], "stage": "Attended"})
        selected = await db.leads.count_documents({"assigned_recruiter_id": r["id"], "lead_status": "Selected"})
        joined = await db.leads.count_documents({"assigned_recruiter_id": r["id"], "lead_status": "Joined"})
        missed = 0
        for f in await db.followups.find({"recruiter_id": r["id"], "status": "pending"}).to_list(2000):
            due = parse_dt(f["due_date"])
            if due and due < now:
                missed += 1
        score = conn * 1 + lineups * 3 + attended * 5 + selected * 8 + joined * 15 - missed * 2
        out.append({
            "recruiter": r["name"], "recruiter_id": r["id"], "avatar": r.get("avatar"),
            "calls": calls, "connected": conn, "lineups": lineups, "attendance": attended,
            "selected": selected, "joined": joined, "missed_followups": missed, "score": score,
        })
    out.sort(key=lambda x: x["score"], reverse=True)
    for i, o in enumerate(out):
        o["rank"] = i + 1
    return out


@api.get("/dashboard/scorecard/{rid}")
async def scorecard(rid: str, user: dict = Depends(get_current_user)):
    settings = await get_settings_doc()
    now = now_utc()
    today = now.date()
    day_start = iso(datetime.combine(today, datetime.min.time(), timezone.utc))
    month_start = iso(now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))
    r = await db.users.find_one({"id": rid})
    if not r:
        raise HTTPException(404, "Recruiter not found")
    r = clean(r); r.pop("password_hash", None)
    today_stats = {
        "calls": await db.call_logs.count_documents({"recruiter_id": rid, "created_at": {"$gte": day_start}}),
        "connected": await db.call_logs.count_documents({"recruiter_id": rid, "connected": True, "created_at": {"$gte": day_start}}),
        "lineups": await db.interviews.count_documents({"recruiter_id": rid, "created_at": {"$gte": day_start}}),
    }
    month_stats = {
        "leads": await db.leads.count_documents({"assigned_recruiter_id": rid, "created_at": {"$gte": month_start}}),
        "selected": await db.leads.count_documents({"assigned_recruiter_id": rid, "lead_status": "Selected"}),
        "joined": await db.leads.count_documents({"assigned_recruiter_id": rid, "lead_status": "Joined", "updated_at": {"$gte": month_start}}),
    }
    return {"recruiter": r, "today": today_stats, "month": month_stats, "targets": {
        "calls": settings["target_calls"], "connected": settings["target_connected"],
        "lineups": settings["target_lineups"], "joinings": settings["target_joinings_month"]}}


@api.get("/dashboard/action-required")
async def action_required(user: dict = Depends(get_current_user)):
    leads, scope = await scoped_leads(user)
    now = now_utc()
    today = now.date()
    tomorrow = today + timedelta(days=1)
    fu = lambda l: parse_dt(l.get("next_followup_date"))

    overdue = [l for l in leads if fu(l) and fu(l) < now and l.get("lead_status") not in ("Joined", "Lost")]
    never_called = [l for l in leads if l.get("call_attempts", 0) == 0 and l.get("lead_status") == "New"]
    unassigned = [l for l in leads if not l.get("assigned_recruiter_id")]
    stale = [l for l in leads if l.get("age_days", 0) >= 15 and l.get("lead_status") not in ("Joined", "Lost")]
    selected_no_join = [l for l in leads if l.get("lead_status") == "Selected" and not l.get("expected_joining_date")]

    scope_q = {} if scope is None else {"recruiter_id": {"$in": scope}}
    # unconfirmed tomorrow interviews
    ivs = await db.interviews.find(scope_q).to_list(2000)
    tom_iv = []
    for iv in ivs:
        dt = parse_dt(iv.get("datetime"))
        if dt and dt.date() == tomorrow and iv.get("confirmation") != "Confirmed":
            tom_iv.append(await enrich_interview(iv))

    # unconfirmed joinings
    joinings = await db.joinings.find({"confirmation": {"$ne": "Confirmed"}, **scope_q}).to_list(2000)
    unconf_join = [await enrich_joining(j) for j in joinings]

    # recruiters below call target
    settings = await get_settings_doc()
    day_start = iso(datetime.combine(today, datetime.min.time(), timezone.utc))
    recruiters = await db.users.find({"role": "recruiter", "active": True}).to_list(1000)
    if scope is not None:
        recruiters = [r for r in recruiters if r["id"] in scope]
    below = []
    for r in recruiters:
        calls = await db.call_logs.count_documents({"recruiter_id": r["id"], "created_at": {"$gte": day_start}})
        if calls < settings["target_calls"] * 0.5:
            below.append({"recruiter": r["name"], "calls": calls, "target": settings["target_calls"]})

    def slim(ls):
        return [{"id": l["id"], "lead_code": l["lead_code"], "name": l["name"], "phone": l["phone"],
                 "priority": l.get("priority"), "recruiter_name": l.get("recruiter_name"),
                 "next_followup_date": l.get("next_followup_date"), "age_days": l.get("age_days")} for l in ls]

    return {
        "overdue_followups": slim(overdue),
        "never_called": slim(never_called),
        "unassigned": slim(unassigned),
        "stale_leads": slim(stale),
        "selected_no_joining_date": slim(selected_no_join),
        "unconfirmed_tomorrow_interviews": tom_iv,
        "unconfirmed_joinings": unconf_join,
        "recruiters_below_target": below,
    }


@api.get("/dashboard/my-day")
async def my_day(user: dict = Depends(get_current_user)):
    rid = user["id"]
    now = now_utc()
    today = now.date()
    tomorrow = today + timedelta(days=1)
    leads = [await enrich_lead(l) for l in await db.leads.find({"assigned_recruiter_id": rid}).to_list(2000)]
    fu = lambda l: parse_dt(l.get("next_followup_date"))
    overdue = [l for l in leads if fu(l) and fu(l) < now and l.get("lead_status") not in ("Joined", "Lost")]
    todays = [l for l in leads if fu(l) and fu(l).date() == today and l.get("lead_status") not in ("Joined", "Lost")]
    new_leads = [l for l in leads if l.get("lead_status") == "New" and l.get("call_attempts", 0) == 0]
    ivs = [await enrich_interview(iv) for iv in await db.interviews.find({"recruiter_id": rid}).to_list(2000)]
    tomorrow_iv = [iv for iv in ivs if parse_dt(iv.get("datetime")) and parse_dt(iv["datetime"]).date() == tomorrow]
    today_iv = [iv for iv in ivs if parse_dt(iv.get("datetime")) and parse_dt(iv["datetime"]).date() == today]
    joinings = [await enrich_joining(j) for j in await db.joinings.find({"recruiter_id": rid, "status": {"$nin": ["Joined", "Dropped"]}}).to_list(2000)]
    steps = [
        {"key": "overdue", "title": "Clear overdue follow-ups", "items": overdue, "done": len(overdue) == 0},
        {"key": "today", "title": "Today's follow-ups", "items": todays, "done": len(todays) == 0},
        {"key": "new", "title": "Call new leads", "items": new_leads, "done": len(new_leads) == 0},
        {"key": "confirm_iv", "title": "Confirm tomorrow's interviews", "items": tomorrow_iv, "done": all(iv.get("confirmation") == "Confirmed" for iv in tomorrow_iv)},
        {"key": "update_iv", "title": "Update today's interviews", "items": today_iv, "done": all(iv.get("stage") in ("Attended", "Not Attended", "Selected", "Rejected") for iv in today_iv)},
        {"key": "joinings", "title": "Update joinings", "items": joinings, "done": len(joinings) == 0},
    ]
    done = sum(1 for s in steps if s["done"])
    return {"steps": steps, "progress": round(done / len(steps) * 100), "completed_steps": done, "total_steps": len(steps)}


# ---------------- Notifications ----------------
@api.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    notes = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(100).to_list(100)
    return [clean(n) for n in notes]


@api.get("/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    return {"count": await db.notifications.count_documents({"user_id": user["id"], "read": False})}


@api.post("/notifications/{nid}/read")
async def read_note(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------- Audit ----------------
@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_role("admin", "team_leader"))):
    logs = await db.audit_logs.find().sort("created_at", -1).limit(300).to_list(300)
    return [clean(l) for l in logs]


# ---------------- Export ----------------
@api.get("/leads/export/csv")
async def export_csv(request: Request, user: dict = Depends(get_current_user)):
    params = dict(request.query_params)
    params.pop("view", None)
    leads = await list_leads(user=user, **{k: v for k, v in params.items() if k in
              ("search", "priority", "source", "lead_status", "recruiter_id", "client_id", "job_id")})
    output = io.StringIO()
    writer = csv.writer(output)
    cols = ["lead_code", "name", "phone", "alt_phone", "email", "city", "source", "priority",
            "lead_status", "interview_status", "joining_status", "recruiter_name", "client_name",
            "job_title", "call_attempts", "next_followup_date", "created_at"]
    writer.writerow(cols)
    for l in leads:
        writer.writerow([l.get(c, "") for c in cols])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=leads_export.csv"})


# ---------------- Seed ----------------
async def seed_admin():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "name": "OAKsphere Admin", "email": admin_email,
            "password_hash": hash_password(admin_password), "role": "admin",
            "active": True, "phone": "+91 90000 00000", "avatar": None,
            "team_leader_id": None, "is_demo": False, "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


async def seed_demo():
    if await db.users.count_documents({"is_demo": True}) > 0:
        return
    avatars = [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc4ODUyMjEwNXww&ixlib=rb-4.1.0&q=85",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc4ODUyMjEwNXww&ixlib=rb-4.1.0&q=85",
        "https://images.unsplash.com/photo-1609436132311-e4b0c9370469?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc4ODUyMjEwNXww&ixlib=rb-4.1.0&q=85",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc4ODUyMjEwNXww&ixlib=rb-4.1.0&q=85",
    ]
    # Team Leader
    tl_id = new_id()
    await db.users.insert_one({
        "id": tl_id, "name": "Rahul Verma (Team Lead)", "email": "teamlead@oaksphere.com",
        "password_hash": hash_password("teamlead123"), "role": "team_leader",
        "active": True, "phone": "+91 90000 11111", "avatar": avatars[1],
        "team_leader_id": None, "is_demo": True, "created_at": iso(now_utc()),
    })
    rec_names = ["Harshika", "Kajal", "Farheen", "Prathemesh"]
    rec_ids = []
    for i, nm in enumerate(rec_names):
        rid = new_id()
        rec_ids.append(rid)
        await db.users.insert_one({
            "id": rid, "name": nm, "email": f"{nm.lower()}@oaksphere.com",
            "password_hash": hash_password("recruiter123"), "role": "recruiter",
            "active": True, "phone": f"+91 98765 4{i}210", "avatar": avatars[i % len(avatars)],
            "team_leader_id": tl_id, "is_demo": True, "created_at": iso(now_utc()),
        })

    # Clients
    client_specs = [
        ("Teleperformance", "Teleperformance India", "Mumbai", "Anita Desai", "Net 30 / 90-day replacement"),
        ("HDFC Bank", "HDFC Bank Ltd", "Pune", "Suresh Nair", "Net 45 / 60-day replacement"),
        ("Concentrix", "Concentrix Daksh", "Bangalore", "Meera Iyer", "Net 30 / 90-day replacement"),
        ("NoBroker", "NoBroker Technologies", "Bangalore", "Karan Singh", "Net 15 / 45-day replacement"),
    ]
    client_ids = []
    for name, company, loc, cp, terms in client_specs:
        cid = new_id()
        client_ids.append(cid)
        await db.clients.insert_one({
            "id": cid, "name": name, "company": company, "location": loc,
            "contact_person": cp, "contact_phone": "+91 22 4000 0000",
            "contact_email": f"hr@{name.lower().replace(' ', '')}.com",
            "payment_terms": terms.split(" / ")[0], "replacement_terms": terms.split(" / ")[1],
            "active": True, "is_demo": True, "created_at": iso(now_utc()),
        })

    # Jobs
    job_specs = [
        (0, "Customer Support Voice (BPO)", "Mumbai", "18000-25000", "0-2 yrs", 50),
        (0, "Non-Voice Chat Support", "Mumbai", "16000-22000", "Fresher", 30),
        (1, "Banking Sales Officer (NBFC)", "Pune", "22000-35000", "1-3 yrs", 25),
        (2, "Telecalling Executive", "Bangalore", "15000-20000", "Fresher", 40),
        (3, "Real Estate Sales Associate", "Bangalore", "25000-40000", "1-4 yrs", 20),
    ]
    job_ids = []
    for ci, title, loc, sal, exp, openings in job_specs:
        jid = new_id()
        job_ids.append((jid, client_ids[ci]))
        await db.jobs.insert_one({
            "id": jid, "client_id": client_ids[ci], "title": title, "location": loc,
            "salary_range": sal, "experience": exp, "openings": openings,
            "requirements": "Good communication, willingness to work in shifts.",
            "status": "Active", "is_demo": True, "created_at": iso(now_utc()),
        })

    # Leads
    now = now_utc()
    sources = DEFAULT_SETTINGS["sources"]
    cities = ["Mumbai", "Pune", "Bangalore", "Delhi", "Hyderabad", "Chennai"]
    quals = ["12th Pass", "Graduate", "B.Com", "BBA", "Diploma", "BE"]
    demo_names = [
        "Amit Kumar", "Sneha Patil", "Rohan Mehta", "Pooja Reddy", "Arjun Nair",
        "Divya Shah", "Karthik Rao", "Neha Gupta", "Vishal Jain", "Ananya Das",
        "Sagar Pawar", "Riya Kapoor", "Manish Yadav", "Kavya Menon", "Deepak Sharma",
        "Isha Verma", "Nikhil Joshi", "Tanvi Bhat", "Rahul Chauhan", "Meghna Roy",
    ]
    priorities = ["Hot", "Hot", "High", "High", "Medium", "Medium", "Medium", "Low", "Low", "Cold"]
    lead_statuses = ["New", "New", "Contacted", "Interested", "Follow-up", "Interview", "Selected", "Joined", "Lost", "Contacted"]

    for i, nm in enumerate(demo_names):
        rid = rec_ids[i % len(rec_ids)]
        created = now - timedelta(days=(i % 18))
        status = lead_statuses[i % len(lead_statuses)]
        prio = priorities[i % len(priorities)]
        jid, cid = job_ids[i % len(job_ids)]
        phone = f"+91 90{i:02d}00 {1000 + i}" if i != 7 else "12345"  # one invalid
        lead = {
            "id": new_id(),
            "lead_code": f"OAK-{9001 + i}",
            "name": nm, "phone": phone, "alt_phone": "",
            "email": f"{nm.split()[0].lower()}{i}@example.com",
            "city": cities[i % len(cities)], "age": 22 + (i % 10), "gender": "Male" if i % 2 == 0 else "Female",
            "qualification": quals[i % len(quals)], "experience": f"{i % 5} yrs",
            "current_salary": f"{15000 + i * 500}", "expected_salary": f"{20000 + i * 800}",
            "notice_period": "Immediate" if i % 3 == 0 else "15 days",
            "source": sources[i % len(sources)],
            "assigned_recruiter_id": rid, "original_recruiter_id": rid,
            "client_id": cid, "job_id": jid,
            "priority": prio, "lead_status": status,
            "interview_status": "Scheduled" if status == "Interview" else ("Selected" if status == "Selected" else "Pending"),
            "joining_status": "Joined" if status == "Joined" else ("Selected" if status == "Selected" else None),
            "call_attempts": 0 if status == "New" else (i % 4) + 1,
            "last_call_date": None if status == "New" else iso(created + timedelta(hours=2)),
            "last_call_status": None if status == "New" else ("Connected–Interested" if status in ("Interested", "Interview", "Selected", "Joined") else "No Answer"),
            "last_call_by": None if status == "New" else demo_names[0],
            "next_followup_date": None,
            "next_followup_reason": None,
            "expected_joining_date": iso(now + timedelta(days=5)) if status == "Selected" else None,
            "interview_date": iso(now + timedelta(days=1)) if status == "Interview" else None,
            "lost_reason": "Not Interested" if status == "Lost" else None,
            "notes": "Demo candidate — fake data.",
            "phone_valid": validate_phone(phone),
            "duplicate_flag": False,
            "assignment_history": [{"recruiter_id": rid, "by": "System", "at": iso(created), "action": "assigned"}],
            "is_demo": True,
            "created_at": iso(created), "updated_at": iso(created),
            "updated_by": "System Seed", "last_touched_at": None,
        }
        # follow-ups: spread overdue / today / upcoming
        if status in ("Follow-up", "Contacted", "Interested"):
            if i % 3 == 0:
                fdt = now - timedelta(hours=6 + i)  # overdue
            elif i % 3 == 1:
                fdt = now + timedelta(hours=3)  # today
            else:
                fdt = now + timedelta(days=2)  # upcoming
            lead["next_followup_date"] = iso(fdt)
            lead["next_followup_reason"] = "Discuss offer & availability"
            await db.followups.insert_one({
                "id": new_id(), "lead_id": lead["id"], "recruiter_id": rid,
                "due_date": iso(fdt), "reason": "Discuss offer & availability",
                "status": "pending", "created_at": iso(created), "completed_at": None, "escalated": False,
            })
        await db.leads.insert_one(lead)

        # interviews
        if status in ("Interview", "Selected", "Joined"):
            iv_dt = now + timedelta(days=1) if status == "Interview" else now - timedelta(days=2)
            await db.interviews.insert_one({
                "id": new_id(), "lead_id": lead["id"], "client_id": cid, "job_id": jid,
                "recruiter_id": rid, "datetime": iso(iv_dt), "location": cities[i % len(cities)],
                "type": ["Walk-in", "Telephonic", "Virtual", "F2F"][i % 4],
                "contact_person": "HR Team", "notes": "Demo interview.",
                "stage": "Scheduled" if status == "Interview" else ("Selected" if status in ("Selected", "Joined") else "Attended"),
                "confirmation": "Pending" if status == "Interview" else "Confirmed",
                "is_demo": True, "created_at": iso(created),
            })
        # joinings
        if status in ("Selected", "Joined"):
            await db.joinings.insert_one({
                "id": new_id(), "lead_id": lead["id"], "client_id": cid, "job_id": jid,
                "recruiter_id": rid, "selection_date": iso(now - timedelta(days=1)),
                "joining_date": iso(now + timedelta(days=5)) if status == "Selected" else iso(now - timedelta(days=1)),
                "salary": "22000", "status": "Joined" if status == "Joined" else "Documents Pending",
                "confirmation": "Confirmed" if status == "Joined" else "Pending",
                "actual_joining_date": iso(now - timedelta(days=1)) if status == "Joined" else None,
                "remarks": "Demo joining record.", "is_demo": True, "created_at": iso(created),
            })
        # call logs
        for c in range(lead["call_attempts"]):
            await db.call_logs.insert_one({
                "id": new_id(), "lead_id": lead["id"], "recruiter_id": rid,
                "recruiter_name": demo_names[0], "disposition": lead["last_call_status"] or "No Answer",
                "connected": lead["last_call_status"] in CONNECTED_DISPOSITIONS if lead["last_call_status"] else False,
                "notes": "Demo call log.", "created_at": iso(created + timedelta(hours=c)),
            })

    # notifications for admin
    await notify((await db.users.find_one({"role": "admin"}))["id"], "system", "Welcome to OAKsphere Connect! Demo data loaded.")
    logger.info("Demo data seeded.")


async def write_test_credentials():
    content = """# Test Credentials — OAKsphere Connect

## Admin / Owner
- Email: oaksphereconnect@gmail.com
- Password: OakAdmin@2026
- Role: admin (full access)

## Team Leader (demo)
- Email: teamlead@oaksphere.com
- Password: teamlead123
- Role: team_leader

## Recruiters (demo) — password: recruiter123
- harshika@oaksphere.com
- kajal@oaksphere.com
- farheen@oaksphere.com
- prathemesh@oaksphere.com

## Auth endpoints
- POST /api/auth/login  {email, password} -> {token, user}
- GET  /api/auth/me  (Bearer token)
- POST /api/auth/change-password
- POST /api/auth/forgot-password / reset-password

Auth uses JWT Bearer tokens (Authorization: Bearer <token>), stored in localStorage on the frontend.
"""
    Path("/app/memory/test_credentials.md").write_text(content)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("phone")
    await db.leads.create_index("assigned_recruiter_id")
    await db.followups.create_index("recruiter_id")
    await db.call_logs.create_index("recruiter_id")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await seed_admin()
    await seed_demo()
    await write_test_credentials()


@api.get("/")
async def root():
    return {"message": "OAKsphere Connect API", "status": "ok"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
