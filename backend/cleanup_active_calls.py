"""
Cleanup script to remove stuck active calls
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def cleanup_stuck_active_calls():
    """Remove all stuck active calls"""
    print("Cleaning up stuck active calls...")
    
    # Count before
    count_before = await db.active_calls.count_documents({})
    print(f"Active calls before cleanup: {count_before}")
    
    # Delete all active calls (they're all stuck from previous runs)
    result = await db.active_calls.delete_many({})
    print(f"Deleted {result.deleted_count} stuck active calls")
    
    # Count after
    count_after = await db.active_calls.count_documents({})
    print(f"Active calls after cleanup: {count_after}")
    
    return result.deleted_count


async def main():
    print("=" * 60)
    print("CLEANUP STUCK ACTIVE CALLS")
    print("=" * 60)
    
    deleted = await cleanup_stuck_active_calls()
    
    print("\n✅ Cleanup complete!")
    print(f"Total cleaned: {deleted} active calls")


if __name__ == "__main__":
    asyncio.run(main())
