import asyncio
import bcrypt
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")


async def main():
    cl = AsyncIOMotorClient(env["MONGO_URL"])
    db = cl[env["DB_NAME"]]
    h = bcrypt.hashpw(b"teamlead123", bcrypt.gensalt()).decode()
    r = await db.users.update_one({"email": "teamlead@oaksphere.com"}, {"$set": {"password_hash": h}})
    print("restored teamlead password:", r.modified_count)
    # remove QA test artifacts created during UI testing
    for coll, q in [
        (db.users, {"email": "qa_ui_rec@oaksphere.com"}),
        (db.leads, {"name": {"$regex": "^(QA |TEST_)"}}),
        (db.clients, {"name": "QA Client UI"}),
        (db.jobs, {"title": "QA Job UI"}),
    ]:
        d = await coll.delete_many(q)
        print("deleted", d.deleted_count, q)
    s = await db.settings.find_one({"id": "global"})
    if s and "QA Source" in s.get("sources", []):
        await db.settings.update_one({"id": "global"}, {"$set": {"sources": [x for x in s["sources"] if x != "QA Source"]}})
        print("removed QA Source from settings")


asyncio.run(main())
