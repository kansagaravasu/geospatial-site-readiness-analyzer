import os
import sys

# Ensure project root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from backend.auth_db import AuthDB

def test_auth_system():
    print("Testing AuthDB initialization...")
    AuthDB.init_db()
    
    # 1. Test Demo User Login
    print("1. Testing Demo User Login...")
    demo_res = AuthDB.login_email("analyst@geosite.ai", "Admin@123")
    assert demo_res["token"] is not None
    assert demo_res["user"]["name"] == "Dr. Anya Sharma"
    assert demo_res["user"]["auth_provider"] == "email"
    print("✓ Demo user login passed!")

    # 2. Test Invalid Password
    print("2. Testing Invalid Password Rejection...")
    try:
        AuthDB.login_email("analyst@geosite.ai", "WrongPass999")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        print("✓ Invalid password correctly rejected:", str(e))

    # 3. Test New User Registration
    print("3. Testing New Email Registration...")
    reg_email = "test.planner@metrogeosite.io"
    reg_res = AuthDB.register_user(
        name="Alex Mercer",
        email=reg_email,
        password="SecurePassword@2026",
        phone="+91 91234 56789",
        company="Smart Mobility Corp",
        role="Lead Infrastructure Planner"
    )
    assert reg_res["token"] is not None
    assert reg_res["user"]["email"] == reg_email
    assert reg_res["user"]["name"] == "Alex Mercer"
    print("✓ User registration passed!")

    # 4. Test Phone OTP Dispatch and Verification
    print("4. Testing Phone OTP Flow...")
    phone_num = "+91 99887 76655"
    otp_data = AuthDB.send_phone_otp(phone_num)
    assert otp_data["success"] is True
    demo_otp = otp_data["demo_otp"]
    assert len(demo_otp) == 6
    print(f"✓ Phone OTP dispatched: {demo_otp}")

    phone_auth = AuthDB.verify_phone_otp(phone_num, demo_otp, name="Rohan Varma")
    assert phone_auth["token"] is not None
    assert phone_auth["user"]["phone"] == phone_num
    assert phone_auth["user"]["auth_provider"] == "phone"
    print("✓ Phone OTP verification and login passed!")

    # 5. Test Google Single Sign-On
    print("5. Testing Google Sign-In...")
    google_res = AuthDB.google_auth(
        email="elena.rostova@googlemail.com",
        name="Elena Rostova",
        avatar_url="https://lh3.googleusercontent.com/a/default-user"
    )
    assert google_res["token"] is not None
    assert google_res["user"]["email"] == "elena.rostova@googlemail.com"
    assert google_res["user"]["auth_provider"] == "google"
    print("✓ Google authentication passed!")

    # 6. Test Profile Update
    print("6. Testing Profile Update...")
    updated_user = AuthDB.update_profile(
        user_id=reg_res["user"]["id"],
        company="Apex Logistics Global",
        bio="Urban analytics and fleet electrification director"
    )
    assert updated_user["company"] == "Apex Logistics Global"
    assert updated_user["bio"] == "Urban analytics and fleet electrification director"
    print("✓ Profile update passed!")

    # 7. Test Session Validation and Revocation
    print("7. Testing Session Revocation...")
    session_user = AuthDB.get_session_user(reg_res["token"])
    assert session_user is not None
    AuthDB.revoke_session(reg_res["token"])
    revoked = AuthDB.get_session_user(reg_res["token"])
    assert revoked is None
    print("✓ Session revocation on logout passed!")

    # 8. Test Audit History
    print("8. Testing Login History Logs...")
    history = AuthDB.get_login_history(demo_res["user"]["id"])
    assert len(history) > 0
    print(f"✓ Audit history logs verified ({len(history)} entries found).")

    print("\n🎉 ALL AUTHENTICATION BACKEND & DATABASE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_auth_system()
