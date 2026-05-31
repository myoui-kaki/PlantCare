"""
PlantCare FastAPI Backend — Upgraded
Covers ITST 303: Python backend, DB integration, ML integration, data analytics
Covers ITEL 305: System integration, API gateway, IA (encryption, JWT), reliability

Run:
  cp .env.example .env   # then edit secrets
  uvicorn main:app --reload --port 8000
"""

import os, uuid, pickle, logging, sqlite3, base64, json
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

import bcrypt
import jwt
import numpy as np
import pandas as pd
from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# ── Load .env ──────────────────────────────────────────────────────────────────
load_dotenv()

SECRET_KEY    = os.environ.get("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
FERNET_KEY    = os.environ.get("FERNET_KEY", Fernet.generate_key().decode())
DB_PATH       = os.environ.get("DB_PATH", "plantcare.db")
ML_MODEL_PATH = os.environ.get("ML_MODEL_PATH", "plant_ml_models.pkl")
JWT_ALGO      = "HS256"
JWT_EXPIRY    = 60 * 24  # minutes

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.FileHandler("plantcare.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("plantcare")

# ── Encryption helper (AES-256 via Fernet for data at rest) ───────────────────
fernet = Fernet(FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY)

def encrypt(text: str) -> str:
    """Encrypt sensitive text for storage (ITEL 305 — data at rest)."""
    if not text:
        return text
    return fernet.encrypt(text.encode()).decode()

def decrypt(token: str) -> str:
    """Decrypt encrypted text from storage."""
    if not token:
        return token
    try:
        return fernet.decrypt(token.encode()).decode()
    except Exception:
        return token  # already plaintext (backward compat)

# ── ML Model ───────────────────────────────────────────────────────────────────
_ml_bundle = None

def load_ml():
    global _ml_bundle
    if os.path.exists(ML_MODEL_PATH):
        with open(ML_MODEL_PATH, "rb") as f:
            _ml_bundle = pickle.load(f)
        logger.info("ML models loaded successfully")
    else:
        logger.warning(f"ML model not found at {ML_MODEL_PATH} — run train_model.py first")

# ── App lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_ml()
    init_db()
    logger.info("PlantCare API started")
    yield
    logger.info("PlantCare API shutting down")

app = FastAPI(title="PlantCare API", version="2.0.0", lifespan=lifespan)

# CORS — reads ALLOWED_ORIGINS env var for production; defaults to * for local dev
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database ───────────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id               TEXT PRIMARY KEY,
            name             TEXT NOT NULL,
            email_enc        TEXT UNIQUE NOT NULL,
            email_hash       TEXT UNIQUE NOT NULL,
            password_hash    TEXT NOT NULL,
            streak           INTEGER DEFAULT 0,
            tasks_done       INTEGER DEFAULT 0,
            last_active_day  TEXT,
            xp               INTEGER DEFAULT 0,
            level            INTEGER DEFAULT 1,
            badges           TEXT DEFAULT '[]',
            created_at       TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS plants (
            id                 TEXT PRIMARY KEY,
            user_id            TEXT NOT NULL,
            name               TEXT NOT NULL,
            species            TEXT,
            location           TEXT,
            water_freq_days    INTEGER DEFAULT 3,
            fert_freq_days     INTEGER DEFAULT 14,
            last_watered       TEXT,
            last_fertilized    TEXT,
            missed_water_count INTEGER DEFAULT 0,
            smart_water_delay  INTEGER DEFAULT 0,
            notes              TEXT,
            created_at         TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS prefs (
            user_id               TEXT PRIMARY KEY,
            notifications_enabled INTEGER DEFAULT 0,
            reminder_time         TEXT DEFAULT '08:00',
            water_alerts          INTEGER DEFAULT 1,
            fert_alerts           INTEGER DEFAULT 1,
            theme                 TEXT DEFAULT 'light',
            snooze_duration       INTEGER DEFAULT 30,
            reminder_sound        TEXT DEFAULT 'chime',
            smart_scheduling      INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS alert_log (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            type       TEXT,
            message    TEXT,
            plant_name TEXT,
            time       TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS ml_predictions (
            id           TEXT PRIMARY KEY,
            user_id      TEXT NOT NULL,
            plant_id     TEXT,
            plant_name   TEXT,
            health_label TEXT,
            health_score REAL,
            rec_water_days INTEGER,
            input_data   TEXT,
            created_at   TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS care_history (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            plant_id   TEXT NOT NULL,
            action     TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id           TEXT PRIMARY KEY,
            user_id      TEXT NOT NULL,
            subscription TEXT NOT NULL,
            created_at   TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()
    logger.info("Database initialized")

# ── JWT helpers ────────────────────────────────────────────────────────────────
def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EXPIRY)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGO)

def verify_token(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Pydantic models ────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class PlantCreate(BaseModel):
    name: str
    species: Optional[str] = None
    location: Optional[str] = None
    water_freq_days: Optional[int] = 3
    fert_freq_days: Optional[int] = 14
    notes: Optional[str] = None

class PlantUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    location: Optional[str] = None
    water_freq_days: Optional[int] = None
    fert_freq_days: Optional[int] = None
    notes: Optional[str] = None

class PrefsUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None
    water_alerts: Optional[bool] = None
    fert_alerts: Optional[bool] = None
    theme: Optional[str] = None
    snooze_duration: Optional[int] = None
    reminder_sound: Optional[str] = None
    smart_scheduling: Optional[bool] = None

class AlertLogEntry(BaseModel):
    type: str
    message: str
    plant_name: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str

class MLPredictRequest(BaseModel):
    """Input for ML health prediction (ITST 303 — ML integration)."""
    plant_id: Optional[str] = None
    plant_name: str
    species: str
    location: str
    season: str            # 'Dry Season' | 'Rainy Season'
    temperature_c: float
    humidity_pct: float
    soil_moisture_pct: float
    days_since_watered: float
    missed_waterings: int
    light_hours_daily: float
    pot_has_drainage: bool

# ── Auth routes ────────────────────────────────────────────────────────────────
@app.post("/api/register")
def register(body: RegisterRequest):
    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    pw_hash   = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user_id   = "u_" + uuid.uuid4().hex[:12]
    now       = datetime.utcnow().isoformat()
    # Encrypt email at rest (ITEL 305 — data at rest encryption)
    email_enc  = encrypt(body.email)
    email_hash = bcrypt.hashpw(body.email.lower().encode(), bcrypt.gensalt()).decode()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (id, name, email_enc, email_hash, password_hash, created_at) VALUES (?,?,?,?,?,?)",
            (user_id, body.name, email_enc, email_hash, pw_hash, now)
        )
        conn.execute("INSERT INTO prefs (user_id) VALUES (?)", (user_id,))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Email already registered")
    finally:
        conn.close()
    logger.info(f"New user registered: {user_id}")
    token = create_token(user_id, body.email)
    return {"token": token, "user": {"id": user_id, "name": body.name, "email": body.email}}

@app.post("/api/login")
def login(body: LoginRequest):
    conn = get_db()
    rows = conn.execute("SELECT * FROM users").fetchall()
    conn.close()
    matched = None
    for row in rows:
        try:
            if decrypt(row["email_enc"]).lower() == body.email.lower():
                matched = row
                break
        except Exception:
            pass
    if not matched:
        raise HTTPException(401, "No account found with that email")
    if not bcrypt.checkpw(body.password.encode(), matched["password_hash"].encode()):
        raise HTTPException(401, "Incorrect password")
    logger.info(f"User logged in: {matched['id']}")
    token = create_token(matched["id"], body.email)
    return {
        "token": token,
        "user": {
            "id": matched["id"], "name": matched["name"], "email": body.email,
            "streak": matched["streak"], "tasks_done": matched["tasks_done"],
            "xp": matched["xp"], "level": matched["level"]
        }
    }

@app.get("/api/me")
def get_me(claims: dict = Depends(verify_token)):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (claims["sub"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "User not found")
    return {
        "id": row["id"], "name": row["name"], "email": decrypt(row["email_enc"]),
        "streak": row["streak"], "tasks_done": row["tasks_done"],
        "xp": row["xp"], "level": row["level"], "badges": row["badges"]
    }

# ── Plants routes ──────────────────────────────────────────────────────────────
@app.get("/api/plants")
def get_plants(claims: dict = Depends(verify_token)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM plants WHERE user_id = ? ORDER BY created_at DESC",
        (claims["sub"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/plants")
def add_plant(body: PlantCreate, claims: dict = Depends(verify_token)):
    plant_id = "p_" + uuid.uuid4().hex[:12]
    now      = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        """INSERT INTO plants (id, user_id, name, species, location,
           water_freq_days, fert_freq_days, notes, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (plant_id, claims["sub"], body.name, body.species, body.location,
         body.water_freq_days, body.fert_freq_days, body.notes, now)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
    conn.close()
    logger.info(f"Plant added: {plant_id} by user {claims['sub']}")
    return dict(row)

@app.put("/api/plants/{plant_id}")
def update_plant(plant_id: str, body: PlantUpdate, claims: dict = Depends(verify_token)):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM plants WHERE id = ? AND user_id = ?",
        (plant_id, claims["sub"])
    ).fetchone()
    if not row:
        raise HTTPException(404, "Plant not found")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE plants SET {set_clause} WHERE id = ?",
            (*updates.values(), plant_id)
        )
        conn.commit()
    row = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
    conn.close()
    return dict(row)

@app.delete("/api/plants/{plant_id}")
def delete_plant(plant_id: str, claims: dict = Depends(verify_token)):
    conn = get_db()
    conn.execute("DELETE FROM plants WHERE id = ? AND user_id = ?", (plant_id, claims["sub"]))
    conn.commit()
    conn.close()
    return {"deleted": True}

@app.post("/api/plants/{plant_id}/water")
def water_plant(plant_id: str, claims: dict = Depends(verify_token)):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "UPDATE plants SET last_watered = ?, missed_water_count = 0, smart_water_delay = 0 WHERE id = ? AND user_id = ?",
        (now, plant_id, claims["sub"])
    )
    conn.execute(
        "UPDATE users SET tasks_done = tasks_done + 1, xp = xp + 10 WHERE id = ?",
        (claims["sub"],)
    )
    conn.execute(
        "INSERT INTO care_history (id, user_id, plant_id, action, created_at) VALUES (?,?,?,?,?)",
        ("ch_" + uuid.uuid4().hex[:10], claims["sub"], plant_id, "water", now)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
    conn.close()
    return dict(row)

@app.post("/api/plants/{plant_id}/fertilize")
def fertilize_plant(plant_id: str, claims: dict = Depends(verify_token)):
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "UPDATE plants SET last_fertilized = ? WHERE id = ? AND user_id = ?",
        (now, plant_id, claims["sub"])
    )
    conn.execute(
        "UPDATE users SET tasks_done = tasks_done + 1, xp = xp + 15 WHERE id = ?",
        (claims["sub"],)
    )
    conn.execute(
        "INSERT INTO care_history (id, user_id, plant_id, action, created_at) VALUES (?,?,?,?,?)",
        ("ch_" + uuid.uuid4().hex[:10], claims["sub"], plant_id, "fertilize", now)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
    conn.close()
    return dict(row)

# ── Prefs routes ───────────────────────────────────────────────────────────────
@app.get("/api/prefs")
def get_prefs(claims: dict = Depends(verify_token)):
    conn = get_db()
    row = conn.execute("SELECT * FROM prefs WHERE user_id = ?", (claims["sub"],)).fetchone()
    conn.close()
    return dict(row) if row else {}

@app.put("/api/prefs")
def save_prefs(body: PrefsUpdate, claims: dict = Depends(verify_token)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        conn = get_db()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE prefs SET {set_clause} WHERE user_id = ?",
            (*updates.values(), claims["sub"])
        )
        conn.commit()
        row = conn.execute("SELECT * FROM prefs WHERE user_id = ?", (claims["sub"],)).fetchone()
        conn.close()
        return dict(row)
    return {}

# ── Alert log routes ───────────────────────────────────────────────────────────
@app.get("/api/alerts")
def get_alerts(claims: dict = Depends(verify_token)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM alert_log WHERE user_id = ? ORDER BY time DESC LIMIT 50",
        (claims["sub"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/alerts")
def add_alert(body: AlertLogEntry, claims: dict = Depends(verify_token)):
    alert_id = "a_" + uuid.uuid4().hex[:12]
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO alert_log (id, user_id, type, message, plant_name, time) VALUES (?,?,?,?,?,?)",
        (alert_id, claims["sub"], body.type, body.message, body.plant_name, now)
    )
    conn.commit()
    conn.close()
    return {"id": alert_id}

@app.delete("/api/alerts")
def clear_alerts(claims: dict = Depends(verify_token)):
    conn = get_db()
    conn.execute("DELETE FROM alert_log WHERE user_id = ?", (claims["sub"],))
    conn.commit()
    conn.close()
    return {"cleared": True}

# ── Password Reset ─────────────────────────────────────────────────────────────
@app.post("/api/reset-password")
def reset_password(body: ResetPasswordRequest):
    if len(body.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    conn = get_db()
    rows = conn.execute("SELECT * FROM users").fetchall()
    matched = None
    for row in rows:
        try:
            if decrypt(row["email_enc"]).lower() == body.email.lower():
                matched = row
                break
        except Exception:
            pass
    if not matched:
        raise HTTPException(404, "Account not found")
    pw_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, matched["id"]))
    conn.commit()
    conn.close()
    return {"success": True}

# ──────────────────────────────────────────────────────────────────────────────
# ITST 303 — MACHINE LEARNING ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

VALID_SPECIES  = ['Pothos','Snake Plant','Peace Lily','Spider Plant','Monstera',
                  'Fiddle Leaf Fig','ZZ Plant','Aloe Vera','Rubber Plant','Cactus',
                  'Boston Fern','Orchid','Bamboo Palm','Dracaena','Philodendron']
VALID_LOCS     = ['Indoor - Low Light','Indoor - Medium Light','Indoor - Bright Light',
                  'Outdoor - Shade','Outdoor - Full Sun']
VALID_SEASONS  = ['Dry Season','Rainy Season']

@app.post("/api/ml/predict")
def ml_predict(body: MLPredictRequest, claims: dict = Depends(verify_token)):
    """
    ITST 303 — ML Integration
    Predicts plant health label and recommended watering interval.
    Uses trained RandomForest models.
    """
    if _ml_bundle is None:
        raise HTTPException(503, "ML model not loaded — run train_model.py first")

    clf        = _ml_bundle["clf"]
    reg        = _ml_bundle["reg"]
    le_species = _ml_bundle["le_species"]
    le_loc     = _ml_bundle["le_location"]
    le_season  = _ml_bundle["le_season"]
    le_health  = _ml_bundle["le_health"]
    features   = _ml_bundle["features"]

    # Map unknown species/location to closest known
    sp  = body.species  if body.species  in le_species.classes_  else VALID_SPECIES[0]
    loc = body.location if body.location in le_loc.classes_      else VALID_LOCS[1]
    ssn = body.season   if body.season   in le_season.classes_   else VALID_SEASONS[0]

    X = pd.DataFrame([{
        "species_enc":       le_species.transform([sp])[0],
        "location_enc":      le_loc.transform([loc])[0],
        "season_enc":        le_season.transform([ssn])[0],
        "temperature_c":     body.temperature_c,
        "humidity_pct":      body.humidity_pct,
        "soil_moisture_pct": body.soil_moisture_pct,
        "days_since_watered":body.days_since_watered,
        "missed_waterings":  body.missed_waterings,
        "light_hours_daily": body.light_hours_daily,
        "pot_has_drainage":  int(body.pot_has_drainage),
    }])[features]

    health_code  = clf.predict(X)[0]
    health_proba = clf.predict_proba(X)[0]
    health_label = le_health.inverse_transform([health_code])[0]
    health_score = round(float(max(health_proba)) * 100, 1)
    rec_days     = max(1, round(float(reg.predict(X)[0])))

    # Confidence per class
    confidence = {
        le_health.classes_[i]: round(float(p) * 100, 1)
        for i, p in enumerate(health_proba)
    }

    # Save prediction to DB
    pred_id = "ml_" + uuid.uuid4().hex[:10]
    conn = get_db()
    conn.execute(
        "INSERT INTO ml_predictions (id,user_id,plant_id,plant_name,health_label,health_score,rec_water_days,input_data,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        (pred_id, claims["sub"], body.plant_id, body.plant_name,
         health_label, health_score, rec_days,
         json.dumps(body.dict()), datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    logger.info(f"ML prediction: {health_label} ({health_score}%) for plant '{body.plant_name}'")

    return {
        "plant_name":          body.plant_name,
        "health_label":        health_label,
        "health_score":        health_score,
        "confidence":          confidence,
        "recommended_water_days": rec_days,
        "advice": _get_advice(health_label, rec_days, body)
    }

def _get_advice(label: str, rec_days: int, body: MLPredictRequest) -> list:
    tips = []
    if label == "At Risk":
        tips.append("⚠️ Your plant needs immediate attention.")
        if body.soil_moisture_pct > 70:
            tips.append("💧 Soil is too wet — hold off watering and ensure drainage.")
        if body.soil_moisture_pct < 20:
            tips.append("🏜️ Soil is very dry — water thoroughly today.")
        if body.missed_waterings > 3:
            tips.append("📅 Several waterings were missed — resume a regular schedule.")
    elif label == "Needs Attention":
        tips.append("🌿 Your plant is struggling — a few adjustments will help.")
    else:
        tips.append("✅ Your plant is healthy — keep up the good work!")
    tips.append(f"📆 Recommended watering every {rec_days} day(s) based on current conditions.")
    if body.temperature_c > 33:
        tips.append("🌡️ High temperature detected — consider moving to a cooler spot.")
    return tips

@app.get("/api/ml/history")
def ml_history(claims: dict = Depends(verify_token)):
    """Return past ML predictions for this user."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM ml_predictions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
        (claims["sub"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/ml/species-info")
def ml_species_info():
    """Return valid species/location/season options for the ML form."""
    return {
        "species":   VALID_SPECIES,
        "locations": VALID_LOCS,
        "seasons":   VALID_SEASONS
    }

# ──────────────────────────────────────────────────────────────────────────────
# ITST 303 — DATA ANALYTICS / VISUALIZATION ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/analytics/summary")
def analytics_summary(claims: dict = Depends(verify_token)):
    """
    ITST 303 — Data Analytics Dashboard
    Returns aggregated stats for Chart.js visualizations on the frontend.
    """
    uid = claims["sub"]
    conn = get_db()

    # Care actions over last 30 days
    cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
    history = conn.execute(
        "SELECT action, created_at FROM care_history WHERE user_id = ? AND created_at >= ?",
        (uid, cutoff)
    ).fetchall()

    # Plants by location
    plants = conn.execute(
        "SELECT location, COUNT(*) as cnt FROM plants WHERE user_id = ? GROUP BY location",
        (uid,)
    ).fetchall()

    # ML predictions summary
    ml_rows = conn.execute(
        "SELECT health_label, COUNT(*) as cnt FROM ml_predictions WHERE user_id = ? GROUP BY health_label",
        (uid,)
    ).fetchall()

    # Weekly care activity (last 4 weeks)
    weekly = {}
    for row in history:
        week = row["created_at"][:10]
        weekly[week] = weekly.get(week, 0) + 1

    # Missed waterings per plant
    at_risk = conn.execute(
        "SELECT name, missed_water_count FROM plants WHERE user_id = ? ORDER BY missed_water_count DESC LIMIT 5",
        (uid,)
    ).fetchall()

    conn.close()

    return {
        "care_activity_weekly": [
            {"date": k, "count": v}
            for k, v in sorted(weekly.items())[-14:]
        ],
        "plants_by_location": [
            {"location": r["location"] or "Unknown", "count": r["cnt"]}
            for r in plants
        ],
        "ml_health_distribution": [
            {"label": r["health_label"], "count": r["cnt"]}
            for r in ml_rows
        ],
        "top_missed_waterings": [
            {"name": r["name"], "missed": r["missed_water_count"]}
            for r in at_risk
        ]
    }

# ──────────────────────────────────────────────────────────────────────────────
# ITEL 305 — MOBILE API ENDPOINTS (same backend serves web + mobile)
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/api/mobile/dashboard")
def mobile_dashboard(claims: dict = Depends(verify_token)):
    """
    ITEL 305 — Mobile-optimized dashboard payload.
    Compact response for React Native / Flutter clients.
    Same Python core service — dual consumer pattern.
    """
    uid = claims["sub"]
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    plants = conn.execute(
        "SELECT * FROM plants WHERE user_id = ? ORDER BY created_at DESC",
        (uid,)
    ).fetchall()
    alerts = conn.execute(
        "SELECT * FROM alert_log WHERE user_id = ? ORDER BY time DESC LIMIT 5",
        (uid,)
    ).fetchall()
    conn.close()

    now = datetime.utcnow()
    tasks_today = []
    for p in plants:
        if p["last_watered"]:
            last = datetime.fromisoformat(p["last_watered"])
            if (now - last).days >= p["water_freq_days"]:
                tasks_today.append({"plant_id": p["id"], "plant_name": p["name"], "task": "water"})
        else:
            tasks_today.append({"plant_id": p["id"], "plant_name": p["name"], "task": "water"})

    return {
        "user": {
            "name": user["name"],
            "xp":   user["xp"],
            "level":user["level"],
            "streak": user["streak"]
        },
        "stats": {
            "total_plants":   len(plants),
            "tasks_today":    len(tasks_today),
            "tasks_pending":  tasks_today[:5]
        },
        "recent_alerts": [dict(a) for a in alerts],
        "ml_available":  _ml_bundle is not None
    }

@app.get("/api/mobile/plants")
def mobile_plants(claims: dict = Depends(verify_token)):
    """Paginated plant list for mobile."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, species, location, water_freq_days, last_watered, missed_water_count FROM plants WHERE user_id = ? ORDER BY name",
        (claims["sub"],)
    ).fetchall()
    conn.close()
    return {"plants": [dict(r) for r in rows], "count": len(rows)}

# ──────────────────────────────────────────────────────────────────────────────
# PUSH NOTIFICATION SUBSCRIPTION ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    subscription: str  # JSON string of the PushSubscription object

@app.post("/api/push/subscribe")
def push_subscribe(body: PushSubscribeRequest, claims: dict = Depends(verify_token)):
    """Save or update the user's push notification subscription."""
    uid  = claims["sub"]
    conn = get_db()
    # Remove old subscription for this user, then insert new
    conn.execute("DELETE FROM push_subscriptions WHERE user_id = ?", (uid,))
    conn.execute(
        "INSERT INTO push_subscriptions (id, user_id, subscription, created_at) VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), uid, body.subscription, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()
    logger.info(f"Push subscription saved for user {uid}")
    return {"status": "subscribed"}

@app.delete("/api/push/subscribe")
def push_unsubscribe(claims: dict = Depends(verify_token)):
    """Remove the user's push notification subscription."""
    uid  = claims["sub"]
    conn = get_db()
    conn.execute("DELETE FROM push_subscriptions WHERE user_id = ?", (uid,))
    conn.commit()
    conn.close()
    return {"status": "unsubscribed"}

@app.get("/api/push/vapid-public-key")
def get_vapid_public_key():
    """Return the VAPID public key for the frontend to use when subscribing."""
    key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"public_key": key}

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": "PlantCare",
        "version": "2.0.0",
        "ml_loaded": _ml_bundle is not None,
        "push_enabled": bool(os.environ.get("VAPID_PUBLIC_KEY")),
        "timestamp": datetime.utcnow().isoformat()
    }
