import os
import sqlite3
import hashlib
import secrets
import time
import datetime
from typing import Optional, Dict, Any, List

# Ensure data directory exists
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "accounts.db")


def get_db_connection():
    """Returns a SQLite connection with row factory configured."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str, salt: Optional[str] = None) -> (str, str):
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return key.hex(), salt


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    """Verifies a candidate password against the stored salt and hash."""
    calc_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(calc_hash, password_hash)


class AuthDB:
    @classmethod
    def init_db(cls):
        """Initializes all database tables and indexes, and seeds default demo user."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uuid TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE,
                    phone TEXT UNIQUE,
                    password_hash TEXT,
                    salt TEXT,
                    auth_provider TEXT NOT NULL DEFAULT 'email',
                    avatar_url TEXT,
                    role TEXT NOT NULL DEFAULT 'GIS Senior Analyst',
                    company TEXT DEFAULT 'GeoSite Enterprise',
                    bio TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # User sessions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_sessions (
                    session_token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Login history audit table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS login_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    identifier TEXT NOT NULL,
                    method TEXT NOT NULL,
                    status TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    details TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                )
            """)

            # Phone & Email OTP verification table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS otp_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    identifier TEXT NOT NULL,
                    otp_code TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    verified INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # User custom account data (saved sites, search history, custom weights)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_account_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER UNIQUE NOT NULL,
                    saved_sites_count INTEGER DEFAULT 12,
                    evaluations_count INTEGER DEFAULT 47,
                    exports_count INTEGER DEFAULT 8,
                    custom_settings TEXT DEFAULT '{}',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Favourites (pinned places) table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS favourites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    place_name TEXT NOT NULL,
                    latitude REAL,
                    longitude REAL,
                    address TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    preset_key TEXT DEFAULT 'ev_charging',
                    score REAL DEFAULT 0,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)

            # Indexes for performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_codes(identifier)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_favs_user ON favourites(user_id)")

            conn.commit()

        # Seed default Demo Analyst user if not exists
        cls.seed_demo_user()

    @classmethod
    def seed_demo_user(cls):
        """Seeds default GIS Analyst account for immediate testing."""
        demo_email = "analyst@geosite.ai"
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (demo_email,))
            row = cursor.fetchone()
            if not row:
                pw_hash, salt = hash_password("Admin@123")
                user_uuid = secrets.token_hex(16)
                cursor.execute("""
                    INSERT INTO users (uuid, name, email, phone, password_hash, salt, auth_provider, avatar_url, role, company, bio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_uuid,
                    "Dr. Anya Sharma",
                    demo_email,
                    "+91 98765 43210",
                    pw_hash,
                    salt,
                    "email",
                    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
                    "Principal Geospatial Architect",
                    "GeoSite Intelligence Labs",
                    "Specialist in multi-criteria site suitability models and EV infrastructure."
                ))
                user_id = cursor.lastrowid
                cursor.execute("""
                    INSERT OR IGNORE INTO user_account_data (user_id, saved_sites_count, evaluations_count, exports_count, custom_settings)
                    VALUES (?, 18, 92, 15, '{"theme": "dark", "default_city": "bengaluru", "default_preset": "ev_charging"}')
                """, (user_id,))
                conn.commit()

    @classmethod
    def log_attempt(cls, identifier: str, method: str, status: str, user_id: Optional[int] = None, ip: str = "127.0.0.1", ua: str = "", details: str = ""):
        """Records a login attempt in the audit table."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO login_history (user_id, identifier, method, status, ip_address, user_agent, details)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (user_id, identifier, method, status, ip, ua, details))
                conn.commit()
        except Exception as e:
            print(f"[AuthDB] Failed to log login attempt: {e}")

    @classmethod
    def create_session(cls, user_id: int, ip: str = "127.0.0.1", ua: str = "", duration_days: int = 7) -> str:
        """Creates a session token for a user."""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=duration_days)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_sessions (session_token, user_id, expires_at, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?)
            """, (token, user_id, expires_at.isoformat(), ip, ua))
            # Update user's last_login_at
            cursor.execute("""
                UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?
            """, (user_id,))
            conn.commit()
        return token

    @classmethod
    def get_session_user(cls, session_token: str) -> Optional[Dict[str, Any]]:
        """Validates a session token and returns the corresponding user info and account data."""
        if not session_token:
            return None
        now_str = datetime.datetime.utcnow().isoformat()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.uuid, u.name, u.email, u.phone, u.auth_provider, u.avatar_url,
                       u.role, u.company, u.bio, u.created_at, u.last_login_at,
                       (u.password_hash IS NOT NULL AND u.password_hash != '') AS has_password,
                       s.expires_at, s.session_token,
                       ad.saved_sites_count, ad.evaluations_count, ad.exports_count, ad.custom_settings
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                LEFT JOIN user_account_data ad ON u.id = ad.user_id
                WHERE s.session_token = ? AND s.expires_at > ?
            """, (session_token, now_str))
            row = cursor.fetchone()
            if row:
                return dict(row)
        return None

    @classmethod
    def revoke_session(cls, session_token: str):
        """Revokes an active session."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sessions WHERE session_token = ?", (session_token,))
            conn.commit()

    @classmethod
    def register_user(cls, name: str, email: str, password: str, phone: Optional[str] = None, company: Optional[str] = None, role: Optional[str] = None, ip: str = "127.0.0.1", ua: str = "") -> Dict[str, Any]:
        """Registers a new user with email and password."""
        email = email.strip().lower()
        if not email or not password or not name:
            raise ValueError("Name, email, and password are required.")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cursor.fetchone():
                cls.log_attempt(email, "email_register", "FAILED", ip=ip, ua=ua, details="Email already registered")
                raise ValueError("An account with this email address already exists.")

            if phone:
                phone = phone.strip()
                cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
                if cursor.fetchone():
                    raise ValueError("An account with this phone number already exists.")

            pw_hash, salt = hash_password(password)
            user_uuid = secrets.token_hex(16)
            avatar_url = f"https://api.dicebear.com/7.x/bottts/svg?seed={secrets.token_hex(4)}"
            
            cursor.execute("""
                INSERT INTO users (uuid, name, email, phone, password_hash, salt, auth_provider, avatar_url, role, company, bio)
                VALUES (?, ?, ?, ?, ?, ?, 'email', ?, ?, ?, ?)
            """, (
                user_uuid,
                name.strip(),
                email,
                phone or None,
                pw_hash,
                salt,
                avatar_url,
                role or "GIS Analyst",
                company or "GeoSite Enterprise",
                "Spatial intelligence practitioner"
            ))
            user_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO user_account_data (user_id, saved_sites_count, evaluations_count, exports_count, custom_settings)
                VALUES (?, 0, 0, 0, '{}')
            """, (user_id,))
            conn.commit()

        cls.log_attempt(email, "email_register", "SUCCESS", user_id=user_id, ip=ip, ua=ua, details="Account registered")
        token = cls.create_session(user_id, ip=ip, ua=ua)
        user_info = cls.get_session_user(token)
        return {"token": token, "user": user_info}

    @classmethod
    def login_email(cls, email: str, password: str, ip: str = "127.0.0.1", ua: str = "") -> Dict[str, Any]:
        """Authenticates user with email and password."""
        email = email.strip().lower()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

        if not user or not user["password_hash"] or not user["salt"]:
            cls.log_attempt(email, "email", "FAILED", ip=ip, ua=ua, details="User not found or password not set")
            raise ValueError("Invalid email or password.")

        if not verify_password(password, user["salt"], user["password_hash"]):
            cls.log_attempt(email, "email", "FAILED", user_id=user["id"], ip=ip, ua=ua, details="Password mismatch")
            raise ValueError("Invalid email or password.")

        token = cls.create_session(user["id"], ip=ip, ua=ua)
        cls.log_attempt(email, "email", "SUCCESS", user_id=user["id"], ip=ip, ua=ua, details="Successful password login")
        user_info = cls.get_session_user(token)
        return {"token": token, "user": user_info}

    @classmethod
    def send_phone_otp(cls, phone: str, ip: str = "127.0.0.1") -> Dict[str, Any]:
        """Generates a 6-digit OTP code valid for 10 minutes for phone authentication."""
        phone = phone.strip()
        if len(phone) < 8:
            raise ValueError("Invalid phone number format.")

        # Generate 6-digit numeric OTP
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Invalidate any previous OTPs for this phone
            cursor.execute("UPDATE otp_codes SET verified = 2 WHERE identifier = ? AND verified = 0", (phone,))
            cursor.execute("""
                INSERT INTO otp_codes (identifier, otp_code, expires_at)
                VALUES (?, ?, ?)
            """, (phone, otp_code, expires_at.isoformat()))
            conn.commit()

        import sys
        _out = getattr(sys.stdout, 'buffer', None)
        msg = f"[AuthDB SMS Simulation] OTP for {phone}: {otp_code}\n"
        if _out:
            _out.write(msg.encode('utf-8', errors='replace'))
        else:
            print(msg, end="")
        return {
            "success": True,
            "message": f"OTP successfully sent to {phone}",
            "phone": phone,
            "expires_in_seconds": 600,
            # Return demo_code so testing/evaluating works instantly without third party SMS gateway
            "demo_otp": otp_code
        }

    @classmethod
    def verify_phone_otp(cls, phone: str, otp_code: str, name: Optional[str] = None, ip: str = "127.0.0.1", ua: str = "") -> Dict[str, Any]:
        """Verifies phone OTP and logs user in (or auto-provisions account)."""
        phone = phone.strip()
        otp_code = otp_code.strip()
        now_str = datetime.datetime.utcnow().isoformat()

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id FROM otp_codes
                WHERE identifier = ? AND otp_code = ? AND expires_at > ? AND verified = 0
                ORDER BY id DESC LIMIT 1
            """, (phone, otp_code, now_str))
            otp_row = cursor.fetchone()

            if not otp_row:
                cls.log_attempt(phone, "phone_otp", "FAILED", ip=ip, ua=ua, details="Invalid or expired OTP")
                raise ValueError("Invalid or expired OTP verification code.")

            # Mark OTP as verified
            cursor.execute("UPDATE otp_codes SET verified = 1 WHERE id = ?", (otp_row["id"],))

            # Look for existing user with this phone
            cursor.execute("SELECT id FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()

            if user_row:
                user_id = user_row["id"]
                if name and name.strip():
                    cursor.execute("UPDATE users SET name = ? WHERE id = ?", (name.strip(), user_id))
            else:
                # Provision new phone-based account
                user_uuid = secrets.token_hex(16)
                display_name = name.strip() if name and name.strip() else f"Mobile User ({phone[-4:]})"
                avatar_url = f"https://api.dicebear.com/7.x/identicon/svg?seed={phone}"
                cursor.execute("""
                    INSERT INTO users (uuid, name, email, phone, auth_provider, avatar_url, role, company)
                    VALUES (?, ?, NULL, ?, 'phone', ?, 'Spatial Analyst', 'Field Operations')
                """, (user_uuid, display_name, phone, avatar_url))
                user_id = cursor.lastrowid

                cursor.execute("""
                    INSERT INTO user_account_data (user_id, saved_sites_count, evaluations_count, exports_count)
                    VALUES (?, 5, 14, 2)
                """, (user_id,))

            conn.commit()

        cls.log_attempt(phone, "phone_otp", "SUCCESS", user_id=user_id, ip=ip, ua=ua, details="Phone verified and logged in")
        token = cls.create_session(user_id, ip=ip, ua=ua)
        user_info = cls.get_session_user(token)
        return {"token": token, "user": user_info}

    @classmethod
    def google_auth(cls, email: str, name: str, google_id: Optional[str] = None, avatar_url: Optional[str] = None, ip: str = "127.0.0.1", ua: str = "") -> Dict[str, Any]:
        """Authenticates or provisions an account via Google Sign-In."""
        email = email.strip().lower()
        if not email:
            raise ValueError("Valid Google account email is required.")

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, auth_provider, avatar_url FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()

            if user:
                user_id = user["id"]
                # Update avatar if provided and user lacks one
                if avatar_url and not user["avatar_url"]:
                    cursor.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user_id))
            else:
                user_uuid = secrets.token_hex(16)
                avatar = avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}"
                cursor.execute("""
                    INSERT INTO users (uuid, name, email, auth_provider, avatar_url, role, company, bio)
                    VALUES (?, ?, ?, 'google', ?, 'GIS Research Analyst', 'GeoSpatial Solutions', 'Google Authenticated User')
                """, (user_uuid, name.strip(), email, avatar))
                user_id = cursor.lastrowid

                cursor.execute("""
                    INSERT INTO user_account_data (user_id, saved_sites_count, evaluations_count, exports_count)
                    VALUES (?, 8, 35, 6)
                """, (user_id,))
            conn.commit()

        cls.log_attempt(email, "google", "SUCCESS", user_id=user_id, ip=ip, ua=ua, details="Google Single Sign-On successful")
        token = cls.create_session(user_id, ip=ip, ua=ua)
        user_info = cls.get_session_user(token)
        return {"token": token, "user": user_info}

    @classmethod
    def update_profile(cls, user_id: int, name: Optional[str] = None, phone: Optional[str] = None, company: Optional[str] = None, role: Optional[str] = None, bio: Optional[str] = None) -> Dict[str, Any]:
        """Updates user account details."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            updates = []
            params = []
            if name is not None:
                updates.append("name = ?")
                params.append(name.strip())
            if phone is not None:
                updates.append("phone = ?")
                params.append(phone.strip() or None)
            if company is not None:
                updates.append("company = ?")
                params.append(company.strip())
            if role is not None:
                updates.append("role = ?")
                params.append(role.strip())
            if bio is not None:
                updates.append("bio = ?")
                params.append(bio.strip())

            if updates:
                params.append(user_id)
                cursor.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
                conn.commit()

            cursor.execute("SELECT id, uuid, name, email, phone, auth_provider, avatar_url, role, company, bio FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())

    @classmethod
    def get_login_history(cls, user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetches recent login audit logs for a user."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, method, status, ip_address, timestamp, details
                FROM login_history
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (user_id, limit))
            return [dict(r) for r in cursor.fetchall()]

    @classmethod
    def record_activity(cls, user_id: int, action_type: str = "evaluation"):
        """Increments account data metrics for the active user."""
        column = {
            "evaluation": "evaluations_count",
            "save_site": "saved_sites_count",
            "export": "exports_count"
        }.get(action_type, "evaluations_count")

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE user_account_data
                SET {column} = {column} + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (user_id,))
            conn.commit()

    @classmethod
    def change_password(cls, user_id: int, current_password: str, new_password: str) -> bool:
        """Verifies current password (if set) then updates to new hashed password. Returns True on success."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT password_hash, salt, auth_provider FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError("User account not found.")

            # If user already has a password, verify it
            if row["password_hash"] and row["salt"]:
                if not current_password or not verify_password(current_password, row["salt"], row["password_hash"]):
                    raise ValueError("Current password is incorrect. Please try again.")

            if len(new_password) < 8:
                raise ValueError("New password must be at least 8 characters long.")

            new_hash, new_salt = hash_password(new_password)
            cursor.execute(
                "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
                (new_hash, new_salt, user_id)
            )
            conn.commit()
        return True

    @classmethod
    def init_favourites_table(cls):
        """Creates the favourites table if it doesn't exist."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS favourites (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    place_name TEXT NOT NULL,
                    latitude REAL,
                    longitude REAL,
                    address TEXT DEFAULT '',
                    notes TEXT DEFAULT '',
                    preset_key TEXT DEFAULT 'ev_charging',
                    score REAL DEFAULT 0,
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_favs_user ON favourites(user_id)")
            conn.commit()

    @classmethod
    def get_favourites(cls, user_id: int) -> List[Dict[str, Any]]:
        """Returns all favourite places for a user."""
        cls.init_favourites_table()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, place_name, latitude, longitude, address, notes, preset_key, score, added_at
                FROM favourites WHERE user_id = ? ORDER BY added_at DESC
            """, (user_id,))
            return [dict(r) for r in cursor.fetchall()]

    @classmethod
    def add_favourite(cls, user_id: int, place_name: str, latitude: float = None,
                      longitude: float = None, address: str = "", notes: str = "",
                      preset_key: str = "ev_charging", score: float = 0) -> Dict[str, Any]:
        """Pins a place to the user's Favourites list."""
        cls.init_favourites_table()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO favourites (user_id, place_name, latitude, longitude, address, notes, preset_key, score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, place_name.strip(), latitude, longitude, address, notes, preset_key, score))
            fav_id = cursor.lastrowid
            # Update saved_sites_count
            cursor.execute("""
                UPDATE user_account_data SET saved_sites_count = saved_sites_count + 1 WHERE user_id = ?
            """, (user_id,))
            conn.commit()
            cursor.execute("SELECT * FROM favourites WHERE id = ?", (fav_id,))
            return dict(cursor.fetchone())

    @classmethod
    def remove_favourite(cls, user_id: int, fav_id: int) -> bool:
        """Removes a pinned place from Favourites."""
        cls.init_favourites_table()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM favourites WHERE id = ? AND user_id = ?", (fav_id, user_id))
            removed = cursor.rowcount > 0
            if removed:
                cursor.execute("""
                    UPDATE user_account_data
                    SET saved_sites_count = MAX(0, saved_sites_count - 1) WHERE user_id = ?
                """, (user_id,))
            conn.commit()
        return removed

