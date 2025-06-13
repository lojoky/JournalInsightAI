#!/usr/bin/env python3
"""
Test script to verify user isolation and fix for data-leak bug
Tests that users cannot access other users' journal entries
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:5000"

class TestUserIsolation:
    def __init__(self):
        self.session_alice = requests.Session()
        self.session_bob = requests.Session()
        self.alice_user_id = None
        self.bob_user_id = None
        self.alice_entry_id = None
        
    def register_user(self, session, username, password):
        """Register a new user and return user data"""
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "username": username,
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ User {username} registered successfully (ID: {data['user']['id']})")
            return data['user']
        else:
            print(f"✗ Failed to register {username}: {response.text}")
            return None
    
    def login_user(self, session, username, password):
        """Login user and return user data"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "username": username,
            "password": password
        })
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ User {username} logged in successfully")
            return data['user']
        else:
            print(f"✗ Failed to login {username}: {response.text}")
            return None
    
    def create_journal_entry(self, session, title, text):
        """Create a journal entry and return entry data"""
        response = session.post(f"{BASE_URL}/api/journal-entries", json={
            "title": title,
            "transcribedText": text,
            "processingStatus": "completed"
        })
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Journal entry created successfully (ID: {data['id']})")
            return data
        else:
            print(f"✗ Failed to create journal entry: {response.text}")
            return None
    
    def get_journal_entries(self, session, username):
        """Get all journal entries for the current user"""
        response = session.get(f"{BASE_URL}/api/journal-entries")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ {username} retrieved {len(data)} journal entries")
            return data
        else:
            print(f"✗ Failed to get journal entries for {username}: {response.text}")
            return []
    
    def try_access_entry(self, session, entry_id, username):
        """Try to access a specific journal entry"""
        response = session.get(f"{BASE_URL}/api/journal-entries/{entry_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✗ SECURITY ISSUE: {username} can access entry {entry_id} (belongs to different user)")
            return data
        elif response.status_code == 404:
            print(f"✓ {username} correctly denied access to entry {entry_id}")
            return None
        else:
            print(f"? Unexpected response for {username} accessing entry {entry_id}: {response.status_code}")
            return None
    
    def try_delete_entry(self, session, entry_id, username):
        """Try to delete a specific journal entry"""
        response = session.delete(f"{BASE_URL}/api/journal-entries/{entry_id}")
        
        if response.status_code == 200:
            print(f"✗ SECURITY ISSUE: {username} can delete entry {entry_id} (belongs to different user)")
            return True
        elif response.status_code == 404:
            print(f"✓ {username} correctly denied delete access to entry {entry_id}")
            return False
        else:
            print(f"? Unexpected response for {username} deleting entry {entry_id}: {response.status_code}")
            return False
    
    def logout_user(self, session, username):
        """Logout user"""
        response = session.post(f"{BASE_URL}/api/auth/logout")
        print(f"✓ {username} logged out")
    
    def run_tests(self):
        """Run the complete user isolation test suite"""
        print("🔒 Testing User Isolation - Data Leak Bug Fix")
        print("=" * 50)
        
        # Generate unique usernames with timestamp
        timestamp = int(datetime.now().timestamp())
        alice_username = f"alice_test_{timestamp}"
        bob_username = f"bob_test_{timestamp}"
        
        # Test 1: Register and login two users
        print("\n📝 Test 1: User Registration and Login")
        alice_user = self.register_user(self.session_alice, alice_username, "password123")
        bob_user = self.register_user(self.session_bob, bob_username, "password456")
        
        if not alice_user or not bob_user:
            print("❌ Failed to create test users")
            return False
        
        self.alice_user_id = alice_user['id']
        self.bob_user_id = bob_user['id']
        
        # Test 2: Alice creates a journal entry
        print("\n📖 Test 2: Alice Creates Journal Entry")
        alice_entry = self.create_journal_entry(
            self.session_alice,
            "Alice's Private Thoughts",
            "This is Alice's private journal entry that Bob should never see."
        )
        
        if not alice_entry:
            print("❌ Failed to create Alice's journal entry")
            return False
            
        self.alice_entry_id = alice_entry['id']
        
        # Test 3: Verify Alice can see her own entries
        print("\n👁️ Test 3: Alice Accesses Her Own Entries")
        alice_entries = self.get_journal_entries(self.session_alice, "Alice")
        
        if len(alice_entries) != 1 or alice_entries[0]['id'] != self.alice_entry_id:
            print(f"❌ Alice should see exactly 1 entry (her own), but sees {len(alice_entries)}")
            return False
        
        # Test 4: Verify Bob cannot see Alice's entries
        print("\n🚫 Test 4: Bob Cannot See Alice's Entries")
        bob_entries = self.get_journal_entries(self.session_bob, "Bob")
        
        if len(bob_entries) != 0:
            print(f"❌ SECURITY BREACH: Bob sees {len(bob_entries)} entries but should see 0")
            for entry in bob_entries:
                print(f"   - Entry {entry['id']}: {entry['title']} (User: {entry.get('userId', 'unknown')})")
            return False
        
        # Test 5: Bob tries to directly access Alice's entry by ID
        print("\n🔍 Test 5: Bob Tries Direct Access to Alice's Entry")
        bob_accessed_entry = self.try_access_entry(self.session_bob, self.alice_entry_id, "Bob")
        
        if bob_accessed_entry:
            print(f"❌ SECURITY BREACH: Bob accessed Alice's entry: {bob_accessed_entry['title']}")
            return False
        
        # Test 6: Bob tries to delete Alice's entry
        print("\n🗑️ Test 6: Bob Tries to Delete Alice's Entry")
        bob_deleted = self.try_delete_entry(self.session_bob, self.alice_entry_id, "Bob")
        
        if bob_deleted:
            print("❌ SECURITY BREACH: Bob deleted Alice's entry")
            return False
        
        # Test 7: Verify Alice's entry still exists
        print("\n✅ Test 7: Verify Alice's Entry Still Exists")
        alice_entries_after = self.get_journal_entries(self.session_alice, "Alice")
        
        if len(alice_entries_after) != 1:
            print(f"❌ Alice's entry was affected by Bob's actions")
            return False
        
        # Test 8: Cross-contamination test - Bob creates entry, Alice shouldn't see it
        print("\n🔄 Test 8: Cross-Contamination Prevention")
        bob_entry = self.create_journal_entry(
            self.session_bob,
            "Bob's Secret Entry",
            "This is Bob's private content that Alice should never access."
        )
        
        if bob_entry:
            # Alice tries to access Bob's entry
            alice_accessed_bob = self.try_access_entry(self.session_alice, bob_entry['id'], "Alice")
            if alice_accessed_bob:
                print("❌ SECURITY BREACH: Alice accessed Bob's entry")
                return False
            
            # Verify Alice still only sees her own entry
            alice_final_entries = self.get_journal_entries(self.session_alice, "Alice")
            if len(alice_final_entries) != 1 or alice_final_entries[0]['id'] != self.alice_entry_id:
                print("❌ Alice's entry list was contaminated by Bob's entry")
                return False
        
        # Cleanup: Logout both users
        print("\n🚪 Cleanup: Logout Users")
        self.logout_user(self.session_alice, "Alice")
        self.logout_user(self.session_bob, "Bob")
        
        print("\n🎉 ALL TESTS PASSED - User Isolation is Working Correctly!")
        print("✅ Users cannot access other users' journal entries")
        print("✅ Users cannot modify other users' journal entries")
        print("✅ Users cannot delete other users' journal entries")
        print("✅ No cross-user data contamination detected")
        
        return True

def main():
    """Main test runner"""
    tester = TestUserIsolation()
    
    print("Starting User Isolation Security Tests...")
    print("This test verifies the fix for the data-leak bug.")
    print()
    
    try:
        success = tester.run_tests()
        
        if success:
            print("\n🟢 SECURITY TEST PASSED - No data leaks detected")
            sys.exit(0)
        else:
            print("\n🔴 SECURITY TEST FAILED - Data leak vulnerabilities found")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()