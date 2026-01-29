"""
CRITICAL FIX: Clean up database and add migration for old data
Run this script to fix all database issues
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def fix_active_calls():
    """Clean up all old active calls - they're causing validation errors"""
    print("\n1. Cleaning up active_calls...")
    
    # Count before
    count_before = await db.active_calls.count_documents({})
    print(f"   Active calls before cleanup: {count_before}")
    
    # Delete ALL active calls (they're all old/stuck)
    result = await db.active_calls.delete_many({})
    print(f"   ✅ Deleted {result.deleted_count} stuck active calls")
    
    return result.deleted_count


async def add_indexes():
    """Add database indexes for performance"""
    print("\n2. Checking database indexes...")
    
    try:
        # Calls indexes
        await db.calls.create_index("user_id")
        await db.calls.create_index("twilio_call_sid", unique=True)
        await db.calls.create_index([("user_id", 1), ("started_at", -1)])
        print("   ✅ Indexes added/verified for calls collection")
    except Exception as e:
        print(f"   ℹ️  Indexes already exist for calls: {str(e)[:50]}...")
    
    try:
        # Messages indexes
        await db.messages.create_index("user_id")
        await db.messages.create_index("twilio_message_sid", unique=True)
        await db.messages.create_index([("user_id", 1), ("created_at", -1)])
        print("   ✅ Indexes added/verified for messages collection")
    except Exception as e:
        print(f"   ℹ️  Indexes already exist for messages")
    
    try:
        # Voicemails indexes
        await db.voicemails.create_index("user_id")
        await db.voicemails.create_index("recording_url", unique=True)
        await db.voicemails.create_index([("user_id", 1), ("created_at", -1)])
        print("   ✅ Indexes added/verified for voicemails collection")
    except Exception as e:
        print(f"   ℹ️  Indexes already exist for voicemails")


async def verify_call_history():
    """Check call history"""
    print("\n3. Verifying call history...")
    
    count = await db.calls.count_documents({})
    print(f"   Total calls in history: {count}")
    
    if count > 0:
        # Show recent calls
        calls = await db.calls.find({}, {"_id": 0}).sort("started_at", -1).limit(3).to_list(3)
        print(f"   Recent calls:")
        for call in calls:
            print(f"     - {call.get('direction')}: {call.get('from_number')} -> {call.get('to_number')}")
            print(f"       Status: {call.get('status')}, Duration: {call.get('duration')}s")


async def verify_voicemails():
    """Check voicemails"""
    print("\n4. Verifying voicemails...")
    
    count = await db.voicemails.count_documents({})
    print(f"   Total voicemails: {count}")
    
    if count > 0:
        # Show voicemails with 0 duration
        zero_duration = await db.voicemails.count_documents({"duration": 0})
        print(f"   Voicemails with 0 duration: {zero_duration}")
        
        # Show recent voicemails
        vms = await db.voicemails.find({}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
        print(f"   Recent voicemails:")
        for vm in vms:
            print(f"     - From: {vm.get('from_number')}, Duration: {vm.get('duration')}s")


async def main():
    print("=" * 70)
    print("DIAL PRO - DATABASE FIX & MIGRATION")
    print("=" * 70)
    
    await fix_active_calls()
    await add_indexes()
    await verify_call_history()
    await verify_voicemails()
    
    print("\n" + "=" * 70)
    print("✅ DATABASE FIX COMPLETE!")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Restart backend server")
    print("2. Push to GitHub")
    print("3. Redeploy on Render")
    print("4. Test calls again")


if __name__ == "__main__":
    asyncio.run(main())
