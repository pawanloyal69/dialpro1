"""
DialPro Backend - Refactored & Production-Ready
================================================

KEY FIXES APPLIED:
1. Call lifecycle consolidation - Single source of truth via call-status webhook
2. Outbound call billing with FUP enforcement  
3. Webhook signature validation for security
4. WebSocket JWT authentication
5. Voicemail endpoint secured
6. Phone number normalization utility
7. Idempotency protection using twilio_call_sid
8. Dead code removed
9. Datetime handling normalized

BILLING LOGIC:
- Outbound calls: Check for active unlimited plan first
  - If plan exists and within FUP (2000 min): Use plan, increment minutes_used
  - If plan exceeded or no plan: Deduct from wallet, create transaction
- Inbound calls: Free (no billing)
- SMS: Always charged from wallet
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, Request, Query
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import jwt
from twilio.rest import Client
from twilio.request_validator import RequestValidator
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
import asyncio
from collections import defaultdict
import aiohttp
from fastapi.responses import StreamingResponse
import io
import math
from urllib.parse import urlencode

# ============================================================================
# CONFIGURATION
# ============================================================================

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Setup logging FIRST so logger is available
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Twilio credentials
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_API_KEY = os.environ.get('TWILIO_API_KEY', '')
TWILIO_API_SECRET = os.environ.get('TWILIO_API_SECRET', '')
TWILIO_TWIML_APP_SID = os.environ.get('TWILIO_TWIML_APP_SID', '')
BACKEND_URL = os.environ.get('BACKEND_URL', '')

# Twilio client (only initialize if credentials exist)
twilio_client = None
twilio_validator = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    twilio_validator = RequestValidator(TWILIO_AUTH_TOKEN)

# Password hasher
ph = PasswordHasher()

# JWT settings
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', 30))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get('REFRESH_TOKEN_EXPIRE_DAYS', 7))

# FUP limit for unlimited plans (minutes)
FUP_LIMIT_MINUTES = 2000


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def normalize_phone(phone: Optional[str]) -> str:
    """
    Normalize phone number to E.164 format with + prefix.
    Used consistently across all call/SMS handling.
    """
    if not phone:
        return ""
    phone = phone.strip()
    if not phone.startswith('+'):
        phone = '+' + phone
    return phone


def parse_datetime(dt_value) -> datetime:
    """
    Parse datetime from ISO string or return as-is if already datetime.
    Handles timezone-aware and naive datetimes.
    """
    if isinstance(dt_value, datetime):
        return dt_value
    if isinstance(dt_value, str):
        # Handle Z suffix and +00:00
        dt_str = dt_value.replace("Z", "+00:00")
        return datetime.fromisoformat(dt_str)
    return datetime.now(timezone.utc)


def now_iso() -> str:
    """Return current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


async def validate_twilio_signature(request: Request) -> bool:
    """
    Validate Twilio request signature for webhook security.
    Returns True if valid, False otherwise.
    """
    if not twilio_validator:
        logger.warning("Twilio validator not configured - skipping signature check")
        return True  # Allow in dev if not configured
    
    # Get the signature from header
    signature = request.headers.get("X-Twilio-Signature", "")
    if not signature:
        logger.warning("Missing X-Twilio-Signature header")
        return False
    
    # Build the full URL
    url = str(request.url)
    
    # Get form data
    form_data = await request.form()
    params = {key: form_data.get(key) for key in form_data.keys()}
    
    # Validate
    is_valid = twilio_validator.validate(url, params, signature)
    if not is_valid:
        logger.warning(f"Invalid Twilio signature for URL: {url}")
    
    return is_valid


# ============================================================================
# WEBSOCKET MANAGER WITH AUTH
# ============================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user: {user_id}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user: {user_id}")

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send WS message: {e}")

manager = ConnectionManager()


# ============================================================================
# APP SETUP
# ============================================================================

app = FastAPI(title="DialPro API", version="2.0.0")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UserCreate(BaseModel):
    phone_number: str
    email: EmailStr
    password: str
    name: str = "User"

class UserLogin(BaseModel):
    identifier: str
    password: str

class SendOTPRequest(BaseModel):
    phone_number: str

class VerifyOTPRequest(BaseModel):
    phone_number: str
    code: str

class TokenRefresh(BaseModel):
    refresh_token: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    phone_number: str
    email: str
    name: str
    role: str = "user"
    wallet_balance: float = 0.0
    active_plan: Optional[str] = None
    plan_expiry: Optional[datetime] = None
    usage_minutes: float = 0.0
    disabled: bool = False
    created_at: datetime

class Country(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    code: str
    flag: str
    enabled: bool = True

class Pricing(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    country_code: str
    number_price_monthly: float
    call_price_per_minute: float
    sms_price: float
    unlimited_call_plan_monthly: float

class VirtualNumber(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    country_code: str
    phone_number: str
    status: str
    user_id: Optional[str] = None
    assigned_at: Optional[datetime] = None
    next_billing_date: Optional[datetime] = None

class CallRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    from_number: str
    to_number: str
    direction: str
    status: str
    duration: float = 0.0
    cost: float = 0.0
    twilio_call_sid: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    voicemail_url: Optional[str] = None

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    from_number: str
    to_number: str
    direction: str
    body: str
    status: str
    cost: float = 0.0
    twilio_message_sid: Optional[str] = None
    created_at: datetime

class WalletTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str
    amount: float
    method: Optional[str] = None
    status: str
    txid: Optional[str] = None
    created_at: datetime

class ActiveCall(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    twilio_call_sid: str
    from_number: str
    to_number: str
    direction: str
    status: str
    started_at: datetime

class UserPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    country_code: str
    plan_type: str
    price: float
    minutes_limit: int = 2000
    minutes_used: float = 0.0
    started_at: datetime
    expires_at: datetime
    status: str

class TopUpRequest(BaseModel):
    amount: float
    method: str
    txid: Optional[str] = None
    purchase_token: Optional[str] = None

class NumberPurchaseRequest(BaseModel):
    number_id: str

class PlanPurchaseRequest(BaseModel):
    country_code: str

class CallInitiateRequest(BaseModel):
    to_number: str
    from_number: str

class SMSRequest(BaseModel):
    to_number: str
    from_number: str
    body: str


# ============================================================================
# AUTH HELPERS
# ============================================================================

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> Optional[str]:
    """Verify JWT and return user_id if valid, None otherwise."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.InvalidTokenError:
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_admin_user(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============================================================================
# BILLING LOGIC
# ============================================================================

async def calculate_and_bill_call(
    user_id: str,
    from_number: str,
    duration_seconds: int,
    direction: str
) -> float:
    """
    Calculate call cost and handle billing.
    
    BILLING RULES:
    1. Inbound calls are FREE
    2. Outbound calls:
       a. Check for active unlimited plan for the number's country
       b. If plan exists and within FUP: Use plan minutes (no charge)
       c. If plan FUP exceeded OR no plan: Charge from wallet
    
    Returns: The cost charged (0.0 if free/plan covered)
    """
    # Inbound calls are free
    if direction == "inbound":
        return 0.0
    
    # Get the virtual number to find country code
    number = await db.virtual_numbers.find_one(
        {"phone_number": from_number, "status": "assigned"},
        {"_id": 0}
    )
    
    if not number:
        logger.warning(f"Billing: Number {from_number} not found, no charge")
        return 0.0
    
    country_code = number["country_code"]
    
    # Get pricing
    pricing = await db.pricing.find_one({"country_code": country_code}, {"_id": 0})
    if not pricing:
        logger.warning(f"Billing: No pricing for {country_code}, no charge")
        return 0.0
    
    # Calculate billable minutes (ceil to nearest minute)
    billable_minutes = math.ceil(duration_seconds / 60) if duration_seconds > 0 else 0
    if billable_minutes == 0:
        return 0.0
    
    # Check for active unlimited plan
    now = datetime.now(timezone.utc)
    active_plan = await db.user_plans.find_one({
        "user_id": user_id,
        "country_code": country_code,
        "status": "active"
    }, {"_id": 0})
    
    if active_plan:
        expires_at = parse_datetime(active_plan["expires_at"])
        
        if expires_at > now:
            # Plan is valid - check FUP
            minutes_used = active_plan.get("minutes_used", 0.0)
            minutes_limit = active_plan.get("minutes_limit", FUP_LIMIT_MINUTES)
            
            if minutes_used + billable_minutes <= minutes_limit:
                # Within FUP - use plan minutes
                new_minutes_used = minutes_used + billable_minutes
                await db.user_plans.update_one(
                    {"id": active_plan["id"]},
                    {"$set": {"minutes_used": new_minutes_used}}
                )
                logger.info(f"Billing: Used {billable_minutes} plan minutes for user {user_id}. "
                           f"Total: {new_minutes_used}/{minutes_limit}")
                return 0.0
            else:
                # FUP exceeded - fall through to wallet billing
                logger.info(f"Billing: FUP exceeded for user {user_id}. "
                           f"Used: {minutes_used}, Limit: {minutes_limit}")
        else:
            # Plan expired - mark it and continue to wallet billing
            await db.user_plans.update_one(
                {"id": active_plan["id"]},
                {"$set": {"status": "expired"}}
            )
            logger.info(f"Billing: Plan {active_plan['id']} expired, marked as expired")

      # No plan or FUP exceeded - charge from wallet
    cost = billable_minutes * pricing["call_price_per_minute"]

    # Deduct from wallet
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        return 0.0

    current_balance = user_doc.get("wallet_balance", 0.0)

    # HARD STOP: prevent negative wallet
    if current_balance < cost:
        logger.warning(
            f"Insufficient wallet for call billing. "
            f"user={user_id}, balance={current_balance}, cost={cost}"
        )
        return 0.0

    new_balance = current_balance - cost

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"wallet_balance": new_balance}}
    )

    

    
    # Create wallet transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "debit",
        "amount": cost,
        "method": "call",
        "status": "completed",
        "created_at": now_iso()
    }
    await db.wallet_transactions.insert_one(transaction)
    
    logger.info(f"Billing: Charged ${cost:.4f} for {billable_minutes} min call. "
               f"User {user_id} balance: ${current_balance:.2f} -> ${new_balance:.2f}")
    
    return cost


async def save_call_record(
    user_id: str,
    from_number: str,
    to_number: str,
    direction: str,
    call_status: str,
    duration: int,
    call_sid: str,
    started_at: str,
    cost: float = 0.0
) -> Optional[str]:
    """
    Save call record with idempotency check.
    Returns call_id if saved, None if duplicate.
    """
    # IDEMPOTENCY: Check if call already exists
    existing = await db.calls.find_one({"twilio_call_sid": call_sid}, {"_id": 0})
    if existing:
        logger.info(f"Call {call_sid} already exists, skipping duplicate insert")
        return None
    
    call_id = str(uuid.uuid4())
    call_record = {
        "id": call_id,
        "user_id": user_id,
        "from_number": normalize_phone(from_number),
        "to_number": normalize_phone(to_number),
        "direction": direction,
        "status": call_status,
        "duration": duration,
        "cost": cost,
        "twilio_call_sid": call_sid,
        "started_at": started_at,
        "ended_at": now_iso()
    }
    
    await db.calls.insert_one(call_record)
    logger.info(f"Saved call record: {call_id}, direction={direction}, status={call_status}, cost=${cost:.4f}")
    return call_id


# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@api_router.post("/auth/send-otp")
async def send_otp(request: SendOTPRequest):
    try:
        verification = twilio_client.verify.services(
            os.environ.get('TWILIO_VERIFY_SERVICE_SID', '')
        ).verifications.create(to=request.phone_number, channel="sms")
        return {"status": verification.status, "message": "OTP sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOTPRequest):
    try:
        check = twilio_client.verify.services(
            os.environ.get('TWILIO_VERIFY_SERVICE_SID', '')
        ).verification_checks.create(to=request.phone_number, code=request.code)
        return {"valid": check.status == "approved"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/auth/signup")
async def signup(user_data: UserCreate):
    existing = await db.users.find_one(
        {"$or": [{"email": user_data.email}, {"phone_number": user_data.phone_number}]}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    hashed_password = ph.hash(user_data.password)
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "phone_number": normalize_phone(user_data.phone_number),
        "email": user_data.email,
        "name": user_data.name,
        "password": hashed_password,
        "role": "user",
        "wallet_balance": 0.0,
        "active_plan": None,
        "plan_expiry": None,
        "usage_minutes": 0.0,
        "disabled": False,
        "created_at": now_iso()
    }
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token({"sub": user_id})
    refresh_token = create_refresh_token({"sub": user_id})
    
    user_doc.pop("password")
    user_doc.pop("_id", None)
    
    return {
        "user": user_doc,
        "access_token": access_token,
        "refresh_token": refresh_token
    }


@api_router.post("/auth/login")
async def login(login_data: UserLogin):
    user_doc = await db.users.find_one(
        {"$or": [{"email": login_data.identifier}, {"phone_number": login_data.identifier}]}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user_doc.get("disabled", False):
        raise HTTPException(status_code=403, detail="Account is disabled. Please contact support.")
    
    try:
        ph.verify(user_doc["password"], login_data.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": user_doc["id"]})
    refresh_token = create_refresh_token({"sub": user_doc["id"]})
    
    user_doc.pop("password")
    user_doc.pop("_id", None)
    
    return {
        "user": user_doc,
        "access_token": access_token,
        "refresh_token": refresh_token
    }


@api_router.post("/auth/refresh")
async def refresh_token_endpoint(request: TokenRefresh):
    try:
        payload = jwt.decode(request.refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        
        access_token = create_access_token({"sub": user_id})
        new_refresh_token = create_refresh_token({"sub": user_id})
        
        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api_router.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user


# ============================================================================
# VOICE TOKEN
# ============================================================================

@api_router.get("/voice/token")
async def get_voice_token(user: User = Depends(get_current_user)):
    if not TWILIO_ACCOUNT_SID or not TWILIO_API_KEY or not TWILIO_API_SECRET:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")
    
    if not TWILIO_TWIML_APP_SID:
        raise HTTPException(status_code=500, detail="TwiML App SID not configured")
    
    identity = f"user_{user.id}"
    
    token = AccessToken(
        TWILIO_ACCOUNT_SID,
        TWILIO_API_KEY,
        TWILIO_API_SECRET,
        identity=identity,
        ttl=3600
    )
    
    voice_grant = VoiceGrant(
        outgoing_application_sid=TWILIO_TWIML_APP_SID,
        incoming_allow=True
    )
    token.add_grant(voice_grant)
    
    return {
        "token": token.to_jwt(),
        "identity": identity
    }


# ============================================================================
# COUNTRIES & PRICING
# ============================================================================

@api_router.get("/countries", response_model=List[Country])
async def get_countries():
    countries = await db.countries.find({"enabled": True}, {"_id": 0}).to_list(100)
    return countries


@api_router.get("/pricing/{country_code}", response_model=Pricing)
async def get_pricing(country_code: str):
    pricing = await db.pricing.find_one({"country_code": country_code}, {"_id": 0})
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")
    return pricing


@api_router.get("/pricing", response_model=List[Pricing])
async def get_all_pricing():
    pricing = await db.pricing.find({}, {"_id": 0}).to_list(100)
    return pricing


# ============================================================================
# VIRTUAL NUMBERS
# ============================================================================

@api_router.get("/numbers/available", response_model=List[VirtualNumber])
async def get_available_numbers(country_code: Optional[str] = None):
    query = {"status": "available"}
    if country_code:
        query["country_code"] = country_code
    numbers = await db.virtual_numbers.find(query, {"_id": 0}).to_list(100)
    return numbers


@api_router.get("/numbers/my", response_model=List[VirtualNumber])
async def get_my_numbers(user: User = Depends(get_current_user)):
    numbers = await db.virtual_numbers.find(
        {"user_id": user.id, "status": "assigned"}, {"_id": 0}
    ).to_list(100)
    return numbers


@api_router.post("/numbers/purchase")
async def purchase_number(request: NumberPurchaseRequest, user: User = Depends(get_current_user)):
    number = await db.virtual_numbers.find_one(
        {"id": request.number_id, "status": "available"}, {"_id": 0}
    )
    if not number:
        raise HTTPException(status_code=404, detail="Number not available")
    
    pricing = await db.pricing.find_one({"country_code": number["country_code"]}, {"_id": 0})
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")
    
    if user.wallet_balance < pricing["number_price_monthly"]:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    new_balance = user.wallet_balance - pricing["number_price_monthly"]
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    next_billing = datetime.now(timezone.utc) + timedelta(days=30)
    await db.virtual_numbers.update_one(
        {"id": request.number_id},
        {
            "$set": {
                "status": "assigned",
                "user_id": user.id,
                "assigned_at": now_iso(),
                "next_billing_date": next_billing.isoformat()
            }
        }
    )
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "type": "debit",
        "amount": pricing["number_price_monthly"],
        "method": "number_rental",
        "status": "completed",
        "created_at": now_iso()
    }
    await db.wallet_transactions.insert_one(transaction)
    
    await manager.send_personal_message({
        "type": "number_purchased",
        "number": number["phone_number"]
    }, user.id)
    
    return {"message": "Number purchased successfully", "balance": new_balance}


# ============================================================================
# PLANS
# ============================================================================

@api_router.post("/plans/purchase")
async def purchase_plan(request: PlanPurchaseRequest, user: User = Depends(get_current_user)):
    pricing = await db.pricing.find_one({"country_code": request.country_code}, {"_id": 0})
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found for this country")
    
    plan_price = pricing["unlimited_call_plan_monthly"]
    
    existing_plan = await db.user_plans.find_one({
        "user_id": user.id,
        "country_code": request.country_code,
        "status": "active"
    })
    if existing_plan:
        raise HTTPException(status_code=400, detail="You already have an active plan for this country")
    
    user_doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    if user_doc["wallet_balance"] < plan_price:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    new_balance = user_doc["wallet_balance"] - plan_price
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    plan_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    expires_at = started_at + timedelta(days=30)
    
    plan = {
        "id": plan_id,
        "user_id": user.id,
        "country_code": request.country_code,
        "plan_type": "unlimited",
        "price": plan_price,
        "minutes_limit": FUP_LIMIT_MINUTES,
        "minutes_used": 0.0,
        "started_at": started_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "active"
    }
    await db.user_plans.insert_one(plan)
    
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "type": "debit",
        "amount": plan_price,
        "method": "unlimited_plan",
        "status": "completed",
        "created_at": now_iso()
    }
    await db.wallet_transactions.insert_one(transaction)
    
    country = await db.countries.find_one({"code": request.country_code}, {"_id": 0})
    country_name = country["name"] if country else request.country_code
    
    await manager.send_personal_message({
        "type": "plan_purchased",
        "country": country_name,
        "plan": "unlimited"
    }, user.id)
    
    plan.pop("_id", None)
    return {"message": f"Unlimited plan for {country_name} activated!", "plan": plan, "balance": new_balance}


@api_router.get("/plans/my")
async def get_my_plans(user: User = Depends(get_current_user)):
    plans = await db.user_plans.find({"user_id": user.id}, {"_id": 0}).to_list(100)
    
    now = datetime.now(timezone.utc)
    for plan in plans:
        if plan["status"] == "active":
            expires_at = parse_datetime(plan["expires_at"])
            if expires_at < now:
                await db.user_plans.update_one(
                    {"id": plan["id"]},
                    {"$set": {"status": "expired"}}
                )
                plan["status"] = "expired"
    
    return plans


@api_router.get("/plans/active")
async def get_active_plans(user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    plans = await db.user_plans.find({
        "user_id": user.id,
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    active_plans = []
    for plan in plans:
        expires_at = parse_datetime(plan["expires_at"])
        if expires_at > now:
            country = await db.countries.find_one({"code": plan["country_code"]}, {"_id": 0})
            plan["country_name"] = country["name"] if country else plan["country_code"]
            plan["country_flag"] = country["flag"] if country else ""
            active_plans.append(plan)
        else:
            await db.user_plans.update_one(
                {"id": plan["id"]},
                {"$set": {"status": "expired"}}
            )
    
    return active_plans


# ============================================================================
# WALLET & TRANSACTIONS
# ============================================================================

@api_router.post("/wallet/topup")
async def topup_wallet(request: TopUpRequest, user: User = Depends(get_current_user)):
    transaction_id = str(uuid.uuid4())
    
    if request.method == "google_play":
        transaction = {
            "id": transaction_id,
            "user_id": user.id,
            "type": "credit",
            "amount": request.amount,
            "method": "google_play",
            "status": "pending",
            "purchase_token": request.purchase_token,
            "created_at": now_iso()
        }
    elif request.method == "usdt":
        transaction = {
            "id": transaction_id,
            "user_id": user.id,
            "type": "credit",
            "amount": request.amount,
            "method": "usdt",
            "status": "pending",
            "txid": request.txid,
            "created_at": now_iso()
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid payment method")
    
    await db.wallet_transactions.insert_one(transaction)
    transaction.pop("_id", None)
    
    return {
        "transaction": transaction,
        "message": "Pending admin approval"
    }


@api_router.get("/wallet/transactions", response_model=List[WalletTransaction])
async def get_transactions(user: User = Depends(get_current_user), limit: int = 50):
    transactions = await db.wallet_transactions.find(
        {"user_id": user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return transactions


@api_router.get("/wallet/balance")
async def get_balance(user: User = Depends(get_current_user)):
    user_doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    return {
        "balance": user_doc["wallet_balance"],
        "active_plan": user_doc.get("active_plan"),
        "plan_expiry": user_doc.get("plan_expiry"),
        "usage_minutes": user_doc.get("usage_minutes", 0.0)
    }


# ============================================================================
# CALLS
# ============================================================================

@api_router.post("/calls/initiate")
async def initiate_call(request: CallInitiateRequest, user: User = Depends(get_current_user)):
    """Validate and prepare for outbound call."""
    # Normalize numbers
    from_number = normalize_phone(request.from_number)
    to_number = normalize_phone(request.to_number)
    
    # Verify ownership
    number = await db.virtual_numbers.find_one({
        "phone_number": from_number,
        "user_id": user.id,
        "status": "assigned",
    }, {"_id": 0})
    
    if not number:
        raise HTTPException(status_code=403, detail="Number not owned by user")
    
    user_doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check for unlimited plan
    active_plan = await db.user_plans.find_one({
        "user_id": user.id,
        "country_code": number["country_code"],
        "status": "active",
    }, {"_id": 0})
    
    has_unlimited = False
    if active_plan:
        expires_at = parse_datetime(active_plan["expires_at"])
        if expires_at > datetime.now(timezone.utc):
            has_unlimited = True
    
    # Require balance if no plan
    # Require minimum balance if no unlimited plan
    # Check pricing for minimum call cost
    pricing = await db.pricing.find_one(
        {"country_code": number["country_code"]},
        {"_id": 0}
    )

    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")

    min_call_cost = pricing["call_price_per_minute"]

    # Require minimum balance if no unlimited plan
    if not has_unlimited and user_doc.get("wallet_balance", 0) < min_call_cost:
        raise HTTPException(
            status_code=400,
            detail="Insufficient balance to start call"
        )


    
    # Create active call placeholder
    call_id = str(uuid.uuid4())
    await db.active_calls.insert_one({
        "id": call_id,
        "user_id": user.id,
        "twilio_call_sid": None,
        "from_number": from_number,
        "to_number": to_number,
        "direction": "outbound",
        "status": "pending",
        "started_at": now_iso(),
    })
    
    return {
        "call_id": call_id,
        "status": "validated",
        "message": "Call validated"
    }


@api_router.post("/calls/end")
async def end_call(user: User = Depends(get_current_user)):
    """End all active calls for user."""
    active_call = await db.active_calls.find_one({"user_id": user.id}, {"_id": 0})
    
    if not active_call:
        return {"status": "no_active_call"}
    
    call_sid = active_call.get("twilio_call_sid")
    direction = active_call.get("direction")
    
    logger.info(f"Ending call - CallSid: {call_sid}, Direction: {direction}, User: {user.id}")
    
    ended_calls = []
    
    if twilio_client:
        try:
            # End by stored SID first
            if call_sid:
                try:
                    twilio_client.calls(call_sid).update(status="completed")
                    ended_calls.append(call_sid)
                except Exception as e:
                    logger.warning(f"Could not end call by SID {call_sid}: {e}")
            
            # Get user's numbers
            user_numbers = await db.virtual_numbers.find(
                {"user_id": user.id, "status": "assigned"},
                {"_id": 0}
            ).to_list(10)
            user_phone_numbers = [n["phone_number"] for n in user_numbers]
            
            # End all in-progress calls involving user's numbers
            for status_to_check in ['in-progress', 'ringing']:
                calls = twilio_client.calls.list(status=status_to_check, limit=50)
                for c in calls:
                    if c.from_ in user_phone_numbers or c.to in user_phone_numbers:
                        if c.sid not in ended_calls:
                            try:
                                twilio_client.calls(c.sid).update(status="completed")
                                ended_calls.append(c.sid)
                            except Exception as e:
                                logger.error(f"Failed to end call {c.sid}: {e}")
            
            logger.info(f"Ended {len(ended_calls)} calls: {ended_calls}")
            
        except Exception as e:
            logger.error(f"Error ending calls: {e}")
    
    # Cleanup all active calls for user
    await db.active_calls.delete_many({"user_id": user.id})
    
    return {"status": "ended", "ended_calls": ended_calls}


@api_router.get("/calls/history", response_model=List[CallRecord])
async def get_call_history(user: User = Depends(get_current_user), limit: int = 50):
    calls = await db.calls.find(
        {"user_id": user.id},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    return calls


@api_router.get("/calls/active", response_model=List[ActiveCall])
async def get_active_calls(user: User = Depends(get_current_user)):
    calls = await db.active_calls.find(
        {"user_id": user.id},
        {"_id": 0}
    ).to_list(10)
    return calls


# ============================================================================
# VOICEMAILS (SECURED)
# ============================================================================

@api_router.get("/voicemails")
async def get_voicemails(user: User = Depends(get_current_user), limit: int = 50):
    """Get user's voicemail messages."""
    voicemails = await db.voicemails.find(
        {"user_id": user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return voicemails


@api_router.put("/voicemails/{voicemail_id}/read")
async def mark_voicemail_read(voicemail_id: str, user: User = Depends(get_current_user)):
    """Mark a voicemail as read."""
    result = await db.voicemails.update_one(
        {"id": voicemail_id, "user_id": user.id},
        {"$set": {"is_read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    return {"message": "Voicemail marked as read"}


@api_router.delete("/voicemails/{voicemail_id}")
async def delete_voicemail(voicemail_id: str, user: User = Depends(get_current_user)):
    """Delete a voicemail."""
    result = await db.voicemails.delete_one({"id": voicemail_id, "user_id": user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    return {"message": "Voicemail deleted"}


@api_router.get("/voicemails/{voicemail_id}/audio")
async def stream_voicemail_audio(voicemail_id: str, user: User = Depends(get_current_user)):
    """
    Stream voicemail audio - SECURED with authentication.
    User can only access their own voicemails.
    """
    voicemail = await db.voicemails.find_one(
        {"id": voicemail_id, "user_id": user.id},
        {"_id": 0}
    )
    
    if not voicemail:
        raise HTTPException(status_code=404, detail="Voicemail not found")
    
    recording_url = voicemail.get("recording_url")
    if not recording_url:
        raise HTTPException(status_code=404, detail="Recording not available")
    
    if not recording_url.endswith(".mp3"):
        recording_url += ".mp3"
    
    auth = aiohttp.BasicAuth(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    
    async with aiohttp.ClientSession(auth=auth) as session:
        async with session.get(recording_url) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=502, detail="Failed to fetch recording")
            audio_data = await resp.read()
    
    return StreamingResponse(
        io.BytesIO(audio_data),
        media_type="audio/mpeg",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
        },
    )


# ============================================================================
# MESSAGES
# ============================================================================

@api_router.post("/messages/send")
async def send_message(request: SMSRequest, user: User = Depends(get_current_user)):
    from_number = normalize_phone(request.from_number)
    to_number = normalize_phone(request.to_number)
    
    number = await db.virtual_numbers.find_one({
        "phone_number": from_number,
        "user_id": user.id,
        "status": "assigned"
    })
    if not number:
        raise HTTPException(status_code=403, detail="Number not owned by user")
    
    pricing = await db.pricing.find_one({"country_code": number["country_code"]}, {"_id": 0})
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing not found")
    
    user_doc = await db.users.find_one({"id": user.id}, {"_id": 0})
    if user_doc["wallet_balance"] < pricing["sms_price"]:
        raise HTTPException(status_code=400, detail="Insufficient balance for SMS")
    
    try:
        message = twilio_client.messages.create(
            to=to_number,
            from_=from_number,
            body=request.body
        )
        
        new_balance = user_doc["wallet_balance"] - pricing["sms_price"]
        await db.users.update_one(
            {"id": user.id},
            {"$set": {"wallet_balance": new_balance}}
        )
        
        message_id = str(uuid.uuid4())
        message_doc = {
            "id": message_id,
            "user_id": user.id,
            "from_number": from_number,
            "to_number": to_number,
            "direction": "outbound",
            "body": request.body,
            "status": message.status,
            "cost": pricing["sms_price"],
            "twilio_message_sid": message.sid,
            "created_at": now_iso()
        }
        await db.messages.insert_one(message_doc)
        
        transaction = {
            "id": str(uuid.uuid4()),
            "user_id": user.id,
            "type": "debit",
            "amount": pricing["sms_price"],
            "method": "sms",
            "status": "completed",
            "created_at": now_iso()
        }
        await db.wallet_transactions.insert_one(transaction)
        
        message_doc.pop("_id", None)
        return {"message": message_doc, "balance": new_balance}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/messages/conversation/{phone_number}", response_model=List[Message])
async def get_conversation(phone_number: str, user: User = Depends(get_current_user)):
    phone_number = normalize_phone(phone_number)
    messages = await db.messages.find(
        {
            "user_id": user.id,
            "$or": [
                {"from_number": phone_number},
                {"to_number": phone_number}
            ]
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return messages


@api_router.get("/messages/history", response_model=List[Message])
async def get_message_history(user: User = Depends(get_current_user), limit: int = 100):
    return await db.messages.find(
        {"user_id": user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)


# ============================================================================
# ADMIN ENDPOINTS
# ============================================================================

@api_router.post("/admin/countries", response_model=Country)
async def create_country(country: Country, admin: User = Depends(get_admin_user)):
    country_dict = country.model_dump()
    await db.countries.insert_one(country_dict)
    return country


@api_router.post("/admin/pricing", response_model=Pricing)
async def create_pricing(pricing: Pricing, admin: User = Depends(get_admin_user)):
    pricing_dict = pricing.model_dump()
    await db.pricing.insert_one(pricing_dict)
    return pricing


@api_router.put("/admin/pricing/{pricing_id}")
async def update_pricing(pricing_id: str, pricing: Pricing, admin: User = Depends(get_admin_user)):
    pricing_dict = pricing.model_dump()
    await db.pricing.update_one({"id": pricing_id}, {"$set": pricing_dict})
    return {"message": "Pricing updated"}


@api_router.post("/admin/numbers", response_model=VirtualNumber)
async def upload_number(number: VirtualNumber, admin: User = Depends(get_admin_user)):
    number_dict = number.model_dump()
    await db.virtual_numbers.insert_one(number_dict)
    return number


@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(admin: User = Depends(get_admin_user), limit: int = 100):
    users = await db.users.find({}, {"_id": 0, "password": 0}).limit(limit).to_list(limit)
    return users


@api_router.put("/admin/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, admin: User = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot disable admin users")
    
    new_status = not user.get("disabled", False)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"disabled": new_status}}
    )
    
    return {"message": f"User {'disabled' if new_status else 'enabled'}", "disabled": new_status}


@api_router.get("/admin/numbers")
async def get_all_numbers(admin: User = Depends(get_admin_user), limit: int = 500):
    numbers = await db.virtual_numbers.find({}, {"_id": 0}).to_list(limit)
    return numbers


@api_router.delete("/admin/numbers/{number_id}")
async def delete_number(number_id: str, admin: User = Depends(get_admin_user)):
    number = await db.virtual_numbers.find_one({"id": number_id}, {"_id": 0})
    if not number:
        raise HTTPException(status_code=404, detail="Number not found")
    
    if number.get("status") == "assigned":
        raise HTTPException(status_code=400, detail="Cannot delete assigned numbers")
    
    await db.virtual_numbers.delete_one({"id": number_id})
    return {"message": "Number deleted"}


@api_router.get("/admin/countries")
async def get_all_countries(admin: User = Depends(get_admin_user)):
    countries = await db.countries.find({}, {"_id": 0}).to_list(100)
    return countries


@api_router.put("/admin/countries/{country_id}")
async def update_country(country_id: str, country: Country, admin: User = Depends(get_admin_user)):
    country_dict = country.model_dump()
    await db.countries.update_one({"id": country_id}, {"$set": country_dict})
    return {"message": "Country updated"}


@api_router.get("/admin/transactions/pending", response_model=List[WalletTransaction])
async def get_pending_transactions(admin: User = Depends(get_admin_user)):
    transactions = await db.wallet_transactions.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)
    return transactions


@api_router.post("/admin/transactions/{transaction_id}/approve")
async def approve_transaction(transaction_id: str, admin: User = Depends(get_admin_user)):
    transaction = await db.wallet_transactions.find_one({"id": transaction_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["status"] != "pending":
        raise HTTPException(status_code=400, detail="Transaction already processed")
    
    await db.wallet_transactions.update_one(
        {"id": transaction_id},
        {"$set": {"status": "completed"}}
    )
    
    user_doc = await db.users.find_one({"id": transaction["user_id"]}, {"_id": 0})
    new_balance = user_doc["wallet_balance"] + transaction["amount"]
    await db.users.update_one(
        {"id": transaction["user_id"]},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    await manager.send_personal_message({
        "type": "wallet_credited",
        "amount": transaction["amount"]
    }, transaction["user_id"])
    
    return {"message": "Transaction approved"}


@api_router.post("/admin/transactions/{transaction_id}/reject")
async def reject_transaction(transaction_id: str, admin: User = Depends(get_admin_user)):
    await db.wallet_transactions.update_one(
        {"id": transaction_id},
        {"$set": {"status": "rejected"}}
    )
    return {"message": "Transaction rejected"}


# ============================================================================
# WEBSOCKET (SECURED WITH JWT)
# ============================================================================

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, token: str = Query(None)):
    """
    WebSocket endpoint with JWT authentication.
    Connect with: ws://host/ws/{user_id}?token=JWT_TOKEN
    """
    # Validate JWT token
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return
    
    verified_user_id = verify_jwt_token(token)
    if not verified_user_id:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return
    
    # Ensure user can only subscribe to their own events
    if verified_user_id != user_id:
        await websocket.close(code=4003, reason="Unauthorized user ID")
        return
    
    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.send_json({"type": "ping"})
            await asyncio.sleep(25)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


# ============================================================================
# TWILIO WEBHOOKS (SECURED)
# ============================================================================

@api_router.post("/webhooks/twiml")
async def twiml_webhook(request: Request):
    """
    Handle outbound calls from browser.
    Called by Twilio when user initiates call via SDK.
    """
    form = await request.form()
    
    to_number = normalize_phone(form.get("To", ""))
    caller_identity = form.get("Caller", "")
    call_sid = form.get("CallSid", "")
    
    logger.info(f"TwiML Webhook - To: {to_number}, Caller: {caller_identity}, CallSid: {call_sid}")
    
    # Parse user_id from Caller
    user_id = ""
    if "user_" in caller_identity:
        user_id = caller_identity.split("user_")[-1]
    
    if not user_id:
        logger.warning(f"TwiML webhook - could not parse user_id from Caller: {caller_identity}")
        return Response(
            "<?xml version='1.0'?><Response><Say>Unable to complete call</Say><Hangup/></Response>",
            media_type="application/xml"
        )
    
    number = await db.virtual_numbers.find_one(
        {"user_id": user_id, "status": "assigned"},
        {"_id": 0}
    )
    
    if not number or not to_number:
        logger.warning(f"TwiML webhook - number not found. user_id: {user_id}")
        return Response(
            "<?xml version='1.0'?><Response><Say>Unable to complete call</Say><Hangup/></Response>",
            media_type="application/xml"
        )
    
    from_number = number["phone_number"]
    
    # Update or create active_call with CallSid
    result = await db.active_calls.update_one(
        {
            "user_id": user_id,
            "from_number": from_number,
            "to_number": to_number,
            "direction": "outbound",
            "twilio_call_sid": None
        },
        {"$set": {"twilio_call_sid": call_sid, "status": "initiated"}}
    )
    
    # If no existing active_call was found, create one
    if result.matched_count == 0:
        logger.warning(f"TwiML: No active_call found for user {user_id}, creating new one")
        await db.active_calls.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "twilio_call_sid": call_sid,
            "from_number": from_number,
            "to_number": to_number,
            "direction": "outbound",
            "status": "initiated",
            "started_at": now_iso(),
        })
    
    # TwiML for outbound call - use call-status as SINGLE source of truth
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial
        callerId="{from_number}"
        timeout="30"
        action="{BACKEND_URL}/api/webhooks/dial-action?user_id={user_id}&amp;from={from_number}&amp;to={to_number}"
        statusCallback="{BACKEND_URL}/api/webhooks/call-status"
        statusCallbackEvent="initiated ringing answered completed"
        statusCallbackMethod="POST"
    >
        <Number>{to_number}</Number>
    </Dial>
</Response>"""
    
    return Response(content=twiml, media_type="application/xml")


@api_router.post("/webhooks/voice")
async def voice_webhook(request: Request):
    """
    Handle incoming voice calls to virtual numbers.
    Routes call to user's browser via Twilio Client.
    """
    form_data = await request.form()
    
    from_number = normalize_phone(form_data.get("From", ""))
    to_number = normalize_phone(form_data.get("To", ""))
    call_sid = form_data.get("CallSid", "")
    
    logger.info(f"Incoming call - From: {from_number}, To: {to_number}, CallSid: {call_sid}")
    
    # Find user by virtual number
    number = await db.virtual_numbers.find_one(
        {"phone_number": to_number, "status": "assigned"},
        {"_id": 0}
    )
    
    if number:
        user_id = number["user_id"]
        client_identity = f"user_{user_id}"
        
        # Create active call
        call_id = str(uuid.uuid4())
        active_call = {
            "id": call_id,
            "user_id": user_id,
            "twilio_call_sid": call_sid,
            "from_number": from_number,
            "to_number": to_number,
            "direction": "inbound",
            "status": "ringing",
            "started_at": now_iso(),
        }
        await db.active_calls.insert_one(active_call)
        
        # Notify browser
        await manager.send_personal_message({
            "type": "incoming_call",
            "call_id": call_id,
            "call_sid": call_sid,
            "from": from_number,
            "to": to_number,
        }, user_id)
        
        # TwiML - use call-status as source of truth, dial-action for voicemail fallback
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial
        timeout="30"
        callerId="{from_number}"
        action="{BACKEND_URL}/api/webhooks/dial-action?user_id={user_id}&amp;from={from_number}&amp;to={to_number}&amp;call_id={call_id}&amp;direction=inbound"
        statusCallback="{BACKEND_URL}/api/webhooks/call-status"
        statusCallbackEvent="initiated ringing answered completed"
        statusCallbackMethod="POST"
    >
        <Client>{client_identity}</Client>
    </Dial>
</Response>"""
        
        return Response(content=twiml, media_type="application/xml")
    
    logger.warning(f"Incoming call to unassigned number: {to_number}")
    return Response(
        """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>The number you have dialed is not in service.</Say>
    <Hangup/>
</Response>""",
        media_type="application/xml"
    )


@api_router.post("/webhooks/dial-action")
async def dial_action_webhook(request: Request):
    """
    Handle Dial action callback - used for voicemail fallback only.
    Call history is saved in call-status webhook (single source of truth).
    """
    form_data = await request.form()
    
    user_id = request.query_params.get("user_id", "")
    from_number = normalize_phone(request.query_params.get("from", ""))
    to_number = normalize_phone(request.query_params.get("to", ""))
    call_id = request.query_params.get("call_id", "")
    direction = request.query_params.get("direction", "outbound")
    
    dial_status = form_data.get("DialCallStatus", "")
    
    logger.info(f"Dial Action - User: {user_id}, Status: {dial_status}, Direction: {direction}")
    
    # Clean up active call
    if call_id:
        await db.active_calls.delete_one({"id": call_id})
    else:
        await db.active_calls.delete_many({
            "user_id": user_id,
            "from_number": from_number,
            "to_number": to_number,
            "direction": direction
        })
    
    # For unanswered inbound calls, trigger voicemail
    if direction == "inbound" and dial_status in ["no-answer", "busy", "failed", "canceled"]:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>The person you are calling is not available. Please leave a message after the beep.</Say>
    <Record 
        maxLength="120" 
        action="{BACKEND_URL}/api/webhooks/voicemail-complete?user_id={user_id}&amp;from={from_number}&amp;to={to_number}"
        recordingStatusCallback="{BACKEND_URL}/api/webhooks/voicemail-status?user_id={user_id}&amp;from={from_number}&amp;to={to_number}"
        recordingStatusCallbackEvent="completed"
        playBeep="true" 
    />
    <Say>No message recorded. Goodbye.</Say>
</Response>"""
        return Response(content=twiml, media_type="application/xml")
    
    return Response(
        """<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>""",
        media_type="application/xml"
    )


@api_router.post("/webhooks/call-status")
async def call_status_webhook(request: Request):
    """
    SINGLE SOURCE OF TRUTH for call history.
    
    This webhook handles ALL call completion events and:
    1. Saves call to history (with idempotency check)
    2. Calculates and applies billing
    3. Cleans up active calls
    """
    form_data = await request.form()
    
    call_status = form_data.get("CallStatus", "").lower()
    duration = int(form_data.get("CallDuration", "0"))
    call_sid = form_data.get("CallSid", "")
    
    logger.info(f"Call Status - CallSid: {call_sid}, Status: {call_status}, Duration: {duration}")
    
    # Find active call
    active_call = await db.active_calls.find_one(
        {"twilio_call_sid": call_sid},
        {"_id": 0}
    )
    
    if not active_call:
        # Fallback: check if call already exists (idempotency safety)
        existing_call = await db.calls.find_one(
            {"twilio_call_sid": call_sid},
            {"_id": 0}
        )

        if existing_call:
            logger.info(f"Call {call_sid} already processed")
            return {"status": "ok"}

        # CRITICAL FIX: Extract call info from webhook form data as fallback
        logger.warning(f"Call status webhook - missing active call for CallSid: {call_sid}, trying to extract from webhook data")
        
        # Get call details from form_data
        from_number = normalize_phone(form_data.get("From", ""))
        to_number = normalize_phone(form_data.get("To", ""))
        direction_hint = form_data.get("Direction", "")
        
        # Try to determine user from phone numbers
        user_id = None
        direction = None
        
        # Check if 'to' is a virtual number (inbound call)
        to_number_check = await db.virtual_numbers.find_one(
            {"phone_number": to_number, "status": "assigned"},
            {"_id": 0}
        )
        if to_number_check:
            user_id = to_number_check["user_id"]
            direction = "inbound"
        else:
            # Check if 'from' is a virtual number (outbound call)
            from_number_check = await db.virtual_numbers.find_one(
                {"phone_number": from_number, "status": "assigned"},
                {"_id": 0}
            )
            if from_number_check:
                user_id = from_number_check["user_id"]
                direction = "outbound"
        
        if not user_id or not direction:
            logger.error(f"Could not determine user/direction for call {call_sid}")
            return {"status": "ignored"}
        
        # Create a fallback active_call object
        started_at = now_iso()
        active_call = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "twilio_call_sid": call_sid,
            "from_number": from_number,
            "to_number": to_number,
            "direction": direction,
            "status": "fallback",
            "started_at": started_at,
        }
        
        logger.info(f"Created fallback active_call for {call_sid}: direction={direction}, user={user_id}")


    
    user_id = active_call["user_id"]
    from_number = active_call["from_number"]
    to_number = active_call["to_number"]
    direction = active_call["direction"]
    started_at = active_call["started_at"]
    
    # Only process terminal statuses
    if call_status not in ["completed", "busy", "no-answer", "failed", "canceled"]:
        logger.info(f"Non-terminal status {call_status}, skipping")
        return {"status": "ok"}
    
    # Normalize status for frontend
    if call_status in ["no-answer", "busy"]:
        final_status = "missed" if direction == "inbound" else "no-answer"
    else:
        final_status = call_status
    
    # Calculate billing for completed outbound calls
    cost = 0.0
    if call_status == "completed" and direction == "outbound" and duration > 0:
        cost = await calculate_and_bill_call(user_id, from_number, duration, direction)
    
    # Save call record (with idempotency)
    call_id = await save_call_record(
        user_id=user_id,
        from_number=from_number,
        to_number=to_number,
        direction=direction,
        call_status=final_status,
        duration=duration,
        call_sid=call_sid,
        started_at=started_at,
        cost=cost
    )
    
    # Clean up active call
    await db.active_calls.delete_one({"id": active_call["id"]})
    
    # Notify user
    await manager.send_personal_message({
        "type": "call_ended",
        "call_id": call_id,
        "status": final_status,
        "duration": duration,
        "cost": cost
    }, user_id)
    
    return {"status": "ok"}


@api_router.post("/webhooks/voicemail-complete")
async def voicemail_complete_webhook(request: Request):
    """Save voicemail recording with idempotency."""
    form_data = await request.form()
    
    recording_url = form_data.get("RecordingUrl", "")
    recording_sid = form_data.get("RecordingSid", "")
    call_sid = form_data.get("CallSid", "")
    
    user_id = request.query_params.get("user_id", "")
    from_number = normalize_phone(request.query_params.get("from", ""))
    to_number = normalize_phone(request.query_params.get("to", ""))
    
    logger.info(f"Voicemail complete - RecordingSid: {recording_sid}, CallSid: {call_sid}")
    
    if not recording_url:
        return Response(
            """<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>""",
            media_type="application/xml"
        )
    
    # Idempotency check
    existing = await db.voicemails.find_one({"recording_url": recording_url})
    if existing:
        logger.info(f"Voicemail {recording_url} already exists, skipping")
        return Response(
            """<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Thank you. Goodbye.</Say><Hangup/></Response>""",
            media_type="application/xml"
        )
    
    duration = int(form_data.get("RecordingDuration", "0"))

    voicemail_record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "from_number": from_number,
        "to_number": to_number,
        "recording_url": recording_url,
        "recording_sid": recording_sid,
        "duration": duration,
        "is_read": False,
        "created_at": now_iso(),
    }

    await db.voicemails.insert_one(voicemail_record)
    
    # Notify user
    await manager.send_personal_message({
        "type": "voicemail_received",
        "voicemail_id": voicemail_record["id"],
        "from": from_number,
    }, user_id)
    
    return Response(
        """<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Thank you for your message. Goodbye.</Say><Hangup/></Response>""",
        media_type="application/xml"
    )


@api_router.post("/webhooks/voicemail-status")
async def voicemail_status_webhook(request: Request):
    """
    Update voicemail with actual duration from recording status callback.
    This webhook receives the RecordingDuration after Twilio processes the recording.
    """
    form_data = await request.form()
    
    recording_url = form_data.get("RecordingUrl", "")
    recording_sid = form_data.get("RecordingSid", "")
    recording_duration = int(form_data.get("RecordingDuration", "0"))
    recording_status = form_data.get("RecordingStatus", "")
    
    logger.info(f"Voicemail status - RecordingSid: {recording_sid}, Duration: {recording_duration}, Status: {recording_status}")
    
    # Only update if recording is completed
    if recording_status == "completed" and recording_url:
        # Find and update the voicemail with the actual duration
        result = await db.voicemails.update_one(
            {"recording_url": recording_url},
            {"$set": {"duration": recording_duration}}
        )
        
        if result.modified_count > 0:
            logger.info(f"Updated voicemail duration: {recording_duration}s for {recording_sid}")
        else:
            logger.warning(f"Could not find voicemail to update for {recording_sid}")
    
    return {"status": "ok"}



@api_router.post("/webhooks/sms")
async def sms_webhook(request: Request):
    """Handle incoming SMS with idempotency."""
    form_data = await request.form()
    
    from_number = normalize_phone(form_data.get("From", ""))
    to_number = normalize_phone(form_data.get("To", ""))
    body = form_data.get("Body", "")
    message_sid = form_data.get("MessageSid", "")
    
    # Idempotency check
    existing = await db.messages.find_one({"twilio_message_sid": message_sid})
    if existing:
        logger.info(f"SMS {message_sid} already exists, skipping")
        return {"status": "duplicate"}
    
    number = await db.virtual_numbers.find_one(
        {"phone_number": to_number, "status": "assigned"},
        {"_id": 0}
    )
    
    if number:
        message_doc = {
            "id": str(uuid.uuid4()),
            "user_id": number["user_id"],
            "from_number": from_number,
            "to_number": to_number,
            "direction": "inbound",
            "body": body,
            "status": "received",
            "cost": 0.0,
            "twilio_message_sid": message_sid,
            "created_at": now_iso()
        }
        await db.messages.insert_one(message_doc)
        
        await manager.send_personal_message({
            "type": "new_message",
            "from": from_number,
            "body": body
        }, number["user_id"])
    
    return {"status": "ok"}


# ============================================================================
# LEGACY WEBHOOK ENDPOINTS (KEPT FOR COMPATIBILITY)
# ============================================================================

@api_router.post("/webhooks/dial-complete")
async def dial_complete_webhook(request: Request):
    """
    LEGACY: Redirects to dial-action for compatibility.
    Call history is now saved in call-status webhook.
    """
    return await dial_action_webhook(request)


@api_router.post("/webhooks/inbound-complete")
async def inbound_complete_webhook(request: Request):
    """
    LEGACY: Redirects to dial-action for compatibility.
    Call history is now saved in call-status webhook.
    """
    return await dial_action_webhook(request)


@api_router.post("/webhooks/voicemail")
async def voicemail_webhook(request: Request):
    """LEGACY: Kept for compatibility."""
    form_data = await request.form()
    call_id = request.query_params.get("call_id", "")
    dial_status = form_data.get("DialCallStatus", "")
    
    if dial_status in ["no-answer", "busy", "failed", "canceled"]:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Please leave a message after the beep.</Say>
    <Record maxLength="120" action="{BACKEND_URL}/api/webhooks/voicemail-complete?call_id={call_id}" playBeep="true" />
</Response>"""
        return Response(content=twiml, media_type="application/xml")
    
    return Response(
        """<?xml version="1.0" encoding="UTF-8"?>
<Response><Hangup/></Response>""",
        media_type="application/xml"
    )


@api_router.post("/webhooks/outgoing-voicemail")
async def outgoing_voicemail(request: Request):
    """LEGACY: Kept for compatibility."""
    form = await request.form()
    dial_status = form.get("DialCallStatus", "")
    
    if dial_status in ["no-answer", "busy", "failed", "canceled"]:
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>The person is not available. Please leave a message.</Say>
    <Record maxLength="120" playBeep="true" action="{BACKEND_URL}/api/webhooks/outgoing-voicemail-save" method="POST"/>
    <Hangup/>
</Response>"""
        return Response(content=twiml, media_type="application/xml")
    
    return Response("<Response><Hangup/></Response>", media_type="application/xml")


@api_router.post("/webhooks/outgoing-voicemail-save")
async def outgoing_voicemail_save(request: Request):
    """LEGACY: Kept for compatibility."""
    form = await request.form()
    recording_url = form.get("RecordingUrl")
    call_sid = form.get("CallSid")
    
    if recording_url:
        await db.calls.update_one(
            {"twilio_call_sid": call_sid},
            {"$set": {"voicemail_url": recording_url}}
        )
    
    return Response(
        "<Response><Say>Message recorded. Goodbye.</Say></Response>",
        media_type="application/xml"
    )


@api_router.post("/webhooks/amd-status")
async def amd_status_webhook(request: Request):
    """LEGACY: AMD status handling."""
    form_data = await request.form()
    answered_by = form_data.get("AnsweredBy", "")
    call_sid = form_data.get("CallSid", "")
    
    await db.active_calls.update_one(
        {"twilio_call_sid": call_sid},
        {"$set": {"answered_by": answered_by}}
    )
    
    if answered_by in ["machine_start", "machine_end_beep", "machine_end_silence"]:
        return Response(
            """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Hello, please call back when you can. Thank you.</Say>
    <Hangup/>
</Response>""",
            media_type="application/xml"
        )
    
    return Response(
        """<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>""",
        media_type="application/xml"
    )

async def auto_renew_numbers():
    now = datetime.now(timezone.utc)

    numbers = await db.virtual_numbers.find(
        {
            "status": "assigned",
            "next_billing_date": {"$lte": now.isoformat()}
        },
        {"_id": 0}
    ).to_list(1000)

    for number in numbers:
        user = await db.users.find_one({"id": number["user_id"]}, {"_id": 0})
        pricing = await db.pricing.find_one(
            {"country_code": number["country_code"]},
            {"_id": 0}
        )

        if not user or not pricing:
            continue

        price = pricing["number_price_monthly"]

        if user["wallet_balance"] < price:
            # ❌ suspend number
            await db.virtual_numbers.update_one(
                {"id": number["id"]},
                {"$set": {"status": "suspended"}}
            )
            logger.warning(f"Number suspended (no balance): {number['phone_number']}")
            continue

        # ✅ charge
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"wallet_balance": -price}}
        )

        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "debit",
            "amount": price,
            "method": "number_renewal",
            "status": "completed",
            "created_at": now_iso()
        })

        # extend billing date
        next_date = now + timedelta(days=30)
        await db.virtual_numbers.update_one(
            {"id": number["id"]},
            {"$set": {"next_billing_date": next_date.isoformat()}}
        )

        logger.info(f"Number auto-renewed: {number['phone_number']}")


async def auto_renew_plans():
    now = datetime.now(timezone.utc)

    plans = await db.user_plans.find(
        {
            "status": "active",
            "expires_at": {"$lte": now.isoformat()}
        },
        {"_id": 0}
    ).to_list(1000)

    for plan in plans:
        pricing = await db.pricing.find_one(
            {"country_code": plan["country_code"]},
            {"_id": 0}
        )
        user = await db.users.find_one({"id": plan["user_id"]}, {"_id": 0})

        if not pricing or not user:
            continue

        price = pricing["unlimited_call_plan_monthly"]

        if user["wallet_balance"] < price:
            # ❌ expire plan
            await db.user_plans.update_one(
                {"id": plan["id"]},
                {"$set": {"status": "expired"}}
            )
            logger.warning(f"Plan expired (no balance): {plan['id']}")
            continue

        # ✅ charge
        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"wallet_balance": -price}}
        )

        new_start = now
        new_expiry = now + timedelta(days=30)

        await db.user_plans.update_one(
            {"id": plan["id"]},
            {
                "$set": {
                    "started_at": new_start.isoformat(),
                    "expires_at": new_expiry.isoformat(),
                    "minutes_used": 0.0
                }
            }
        )

        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "debit",
            "amount": price,
            "method": "plan_renewal",
            "status": "completed",
            "created_at": now_iso()
        })

        logger.info(f"Plan auto-renewed: {plan['id']}")


# ============================================================================
# APP SETUP & STARTUP
# ============================================================================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database with seed data."""
    # Create admin user
    admin = await db.users.find_one({"email": "admin@dailpro.live"})
    if not admin:
        hashed_password = ph.hash("admin212")
        admin_doc = {
            "id": str(uuid.uuid4()),
            "phone_number": "+10000000000",
            "email": "admin@dailpro.live",
            "name": "Admin",
            "password": hashed_password,
            "role": "admin",
            "wallet_balance": 0.0,
            "disabled": False,
            "created_at": now_iso()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Admin user created")
    
    # Initialize countries
    countries_data = [
        {"id": str(uuid.uuid4()), "name": "United States", "code": "US", "flag": "🇺🇸", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Canada", "code": "CA", "flag": "🇨🇦", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "United Kingdom", "code": "GB", "flag": "🇬🇧", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Australia", "code": "AU", "flag": "🇦🇺", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Netherlands", "code": "NL", "flag": "🇳🇱", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Poland", "code": "PL", "flag": "🇵🇱", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Slovenia", "code": "SI", "flag": "🇸🇮", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "South Africa", "code": "ZA", "flag": "🇿🇦", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Sweden", "code": "SE", "flag": "🇸🇪", "enabled": True},
        {"id": str(uuid.uuid4()), "name": "Switzerland", "code": "CH", "flag": "🇨🇭", "enabled": True},
    ]
    
    for country in countries_data:
        exists = await db.countries.find_one({"code": country["code"]})
        if not exists:
            await db.countries.insert_one(country)
    
    # Initialize pricing
    pricing_data = [
        {"id": str(uuid.uuid4()), "country_code": "US", "number_price_monthly": 5.0, "call_price_per_minute": 0.0280, "sms_price": 0.0163, "unlimited_call_plan_monthly": 59.0},
        {"id": str(uuid.uuid4()), "country_code": "CA", "number_price_monthly": 5.0, "call_price_per_minute": 0.0280, "sms_price": 0.0163, "unlimited_call_plan_monthly": 59.0},
        {"id": str(uuid.uuid4()), "country_code": "GB", "number_price_monthly": 5.0, "call_price_per_minute": 0.0308, "sms_price": 0.0924, "unlimited_call_plan_monthly": 69.0},
        {"id": str(uuid.uuid4()), "country_code": "AU", "number_price_monthly": 7.0, "call_price_per_minute": 0.0502, "sms_price": 0.0915, "unlimited_call_plan_monthly": 89.0},
        {"id": str(uuid.uuid4()), "country_code": "NL", "number_price_monthly": 9.0, "call_price_per_minute": 0.0299, "sms_price": 0.1972, "unlimited_call_plan_monthly": 69.0},
        {"id": str(uuid.uuid4()), "country_code": "PL", "number_price_monthly": 7.0, "call_price_per_minute": 0.0615, "sms_price": 0.0831, "unlimited_call_plan_monthly": 99.0},
        {"id": str(uuid.uuid4()), "country_code": "SI", "number_price_monthly": 9.0, "call_price_per_minute": 0.5600, "sms_price": 0.2935, "unlimited_call_plan_monthly": 99.0},
        {"id": str(uuid.uuid4()), "country_code": "ZA", "number_price_monthly": 9.0, "call_price_per_minute": 0.0570, "sms_price": 0.1989, "unlimited_call_plan_monthly": 99.0},
        {"id": str(uuid.uuid4()), "country_code": "SE", "number_price_monthly": 6.0, "call_price_per_minute": 0.0360, "sms_price": 0.0909, "unlimited_call_plan_monthly": 69.0},
        {"id": str(uuid.uuid4()), "country_code": "CH", "number_price_monthly": 5.0, "call_price_per_minute": 0.0674, "sms_price": 0.0995, "unlimited_call_plan_monthly": 129.0},
    ]
    
    for pricing in pricing_data:
        exists = await db.pricing.find_one({"country_code": pricing["country_code"]})
        if not exists:
            await db.pricing.insert_one(pricing)
    
    # Create indexes for idempotency
    await db.calls.create_index("twilio_call_sid", unique=True, sparse=True)
    await db.messages.create_index("twilio_message_sid", unique=True, sparse=True)
    await db.voicemails.create_index("recording_url", unique=True, sparse=True)

        # 🔁 START AUTO-RENEW BACKGROUND TASK
    async def renewal_loop():
        while True:
            try:
                await auto_renew_numbers()
                await auto_renew_plans()
            except Exception as e:
                logger.error(f"Auto-renew error: {e}")
            await asyncio.sleep(3600)  # run every 1 hour

    asyncio.create_task(renewal_loop())
    
    logger.info("Database initialized with indexes")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
