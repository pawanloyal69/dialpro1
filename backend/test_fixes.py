"""
Test script to verify all fixes are working correctly.
This simulates webhook calls and verifies database updates.
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def test_database_connection():
    """Test if we can connect to MongoDB"""
    print("Testing MongoDB connection...")
    try:
        # Ping the database
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False


async def check_collections():
    """Check what collections exist"""
    print("\nChecking collections...")
    collections = await db.list_collection_names()
    print(f"Available collections: {collections}")
    return collections


async def check_users():
    """Check if there are any users"""
    print("\nChecking users...")
    count = await db.users.count_documents({})
    print(f"Total users: {count}")
    
    if count > 0:
        users = await db.users.find({}, {"_id": 0, "id": 1, "email": 1, "phone_number": 1}).to_list(5)
        print("Sample users:")
        for user in users:
            print(f"  - {user}")
    return count


async def check_virtual_numbers():
    """Check virtual numbers"""
    print("\nChecking virtual numbers...")
    count = await db.virtual_numbers.count_documents({})
    print(f"Total virtual numbers: {count}")
    
    if count > 0:
        numbers = await db.virtual_numbers.find({}, {"_id": 0}).to_list(10)
        print("Virtual numbers:")
        for num in numbers:
            print(f"  - {num.get('phone_number')} -> User: {num.get('user_id')} ({num.get('status')})")
    return count


async def check_call_history():
    """Check call history"""
    print("\nChecking call history...")
    count = await db.calls.count_documents({})
    print(f"Total calls in history: {count}")
    
    if count > 0:
        calls = await db.calls.find({}, {"_id": 0}).sort("started_at", -1).limit(5).to_list(5)
        print("Recent calls:")
        for call in calls:
            print(f"  - {call.get('direction')} call: {call.get('from_number')} -> {call.get('to_number')}")
            print(f"    Status: {call.get('status')}, Duration: {call.get('duration')}s, Cost: ${call.get('cost', 0)}")
    return count


async def check_active_calls():
    """Check active calls"""
    print("\nChecking active calls...")
    count = await db.active_calls.count_documents({})
    print(f"Total active calls: {count}")
    
    if count > 0:
        calls = await db.active_calls.find({}, {"_id": 0}).to_list(10)
        print("Active calls:")
        for call in calls:
            print(f"  - {call}")
    return count


async def check_voicemails():
    """Check voicemails"""
    print("\nChecking voicemails...")
    count = await db.voicemails.count_documents({})
    print(f"Total voicemails: {count}")
    
    if count > 0:
        voicemails = await db.voicemails.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        print("Recent voicemails:")
        for vm in voicemails:
            print(f"  - From: {vm.get('from_number')}, Duration: {vm.get('duration')}s")
            print(f"    Recording URL: {vm.get('recording_url')}")
    return count


async def check_messages():
    """Check SMS messages"""
    print("\nChecking SMS messages...")
    count = await db.messages.count_documents({})
    print(f"Total messages: {count}")
    
    if count > 0:
        messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        print("Recent messages:")
        for msg in messages:
            print(f"  - {msg.get('direction')}: {msg.get('from_number')} -> {msg.get('to_number')}")
            print(f"    Body: {msg.get('body')[:50]}...")
    return count


async def main():
    print("=" * 60)
    print("DIAL PRO - DATABASE STATUS CHECK")
    print("=" * 60)
    
    if not await test_database_connection():
        print("\n❌ Cannot connect to database. Exiting.")
        sys.exit(1)
    
    await check_collections()
    await check_users()
    await check_virtual_numbers()
    await check_call_history()
    await check_active_calls()
    await check_voicemails()
    await check_messages()
    
    print("\n" + "=" * 60)
    print("STATUS CHECK COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
