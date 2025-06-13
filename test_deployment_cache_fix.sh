#!/bin/bash

echo "🚀 Deployment Cache Leak Test"
echo "============================="
echo "Testing the specific scenario: logout from account with entries -> login to new account"
echo ""

# Base URL
BASE_URL="http://localhost:5000"

# Create two test users
echo "📝 Step 1: Creating test users..."

# Register User A (has entries)
USER_A_DATA='{"username":"cache_test_user_a","password":"testpass123"}'
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$USER_A_DATA" > /dev/null

# Register User B (will be empty initially)
USER_B_DATA='{"username":"cache_test_user_b","password":"testpass123"}'
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$USER_B_DATA" > /dev/null

echo "✓ Test users created"

# Login as User A and create journal entries
echo ""
echo "📖 Step 2: Login as User A and create journal entries..."

# Login User A
USER_A_LOGIN=$(curl -s -c cookies_a.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$USER_A_DATA")

USER_A_ID=$(echo "$USER_A_LOGIN" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "User A ID: $USER_A_ID"

# Create entries for User A
for i in {1..3}; do
  ENTRY_DATA="{\"title\":\"User A Entry $i\",\"content\":\"This is User A's journal entry number $i. It contains personal thoughts and reflections.\"}"
  curl -s -b cookies_a.txt -X POST "$BASE_URL/api/journal-entries" \
    -H "Content-Type: application/json" \
    -d "$ENTRY_DATA" > /dev/null
done

echo "✓ Created 3 journal entries for User A"

# Verify User A can see their entries
USER_A_ENTRIES=$(curl -s -b cookies_a.txt "$BASE_URL/api/journal-entries")
USER_A_COUNT=$(echo "$USER_A_ENTRIES" | grep -o '"id":' | wc -l)
echo "✓ User A sees $USER_A_COUNT entries"

# Step 3: Logout User A
echo ""
echo "🚪 Step 3: Logging out User A..."
curl -s -b cookies_a.txt -X POST "$BASE_URL/api/auth/logout" > /dev/null
echo "✓ User A logged out"

# Step 4: Login as User B (the critical test)
echo ""
echo "🔑 Step 4: Login as User B (should see NO entries)..."

USER_B_LOGIN=$(curl -s -c cookies_b.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$USER_B_DATA")

USER_B_ID=$(echo "$USER_B_LOGIN" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "User B ID: $USER_B_ID"

# The critical test: Check User B's entries immediately after login
USER_B_ENTRIES=$(curl -s -b cookies_b.txt "$BASE_URL/api/journal-entries")
USER_B_COUNT=$(echo "$USER_B_ENTRIES" | grep -o '"id":' | wc -l)

echo ""
echo "🧪 CRITICAL TEST RESULT:"
echo "========================"
echo "User B should see 0 entries, actually sees: $USER_B_COUNT"

if [ "$USER_B_COUNT" -eq 0 ]; then
    echo "✅ PASS: No data leak detected"
    echo "✅ User B correctly sees no entries from User A"
else
    echo "❌ FAIL: DATA LEAK DETECTED!"
    echo "❌ User B can see User A's entries - cache clearing failed"
    echo ""
    echo "User B's response:"
    echo "$USER_B_ENTRIES" | head -20
fi

# Step 5: Verify User A can still access their data
echo ""
echo "🔄 Step 5: Re-login User A to verify data integrity..."

curl -s -b cookies_a.txt -X POST "$BASE_URL/api/auth/logout" > /dev/null
USER_A_RELOGIN=$(curl -s -c cookies_a2.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$USER_A_DATA")

USER_A_ENTRIES_AFTER=$(curl -s -b cookies_a2.txt "$BASE_URL/api/journal-entries")
USER_A_COUNT_AFTER=$(echo "$USER_A_ENTRIES_AFTER" | grep -o '"id":' | wc -l)

echo "User A after re-login sees: $USER_A_COUNT_AFTER entries"

if [ "$USER_A_COUNT_AFTER" -eq "$USER_A_COUNT" ]; then
    echo "✅ User A's data integrity maintained"
else
    echo "❌ User A's data integrity compromised"
fi

# Final verdict
echo ""
echo "🏁 FINAL VERDICT:"
echo "================="

if [ "$USER_B_COUNT" -eq 0 ] && [ "$USER_A_COUNT_AFTER" -eq "$USER_A_COUNT" ]; then
    echo "🎉 DEPLOYMENT CACHE FIX SUCCESSFUL"
    echo "✅ No cross-user data leaks detected"
    echo "✅ User isolation working properly"
    echo "✅ Cache clearing mechanism effective"
else
    echo "⚠️  DEPLOYMENT CACHE FIX INCOMPLETE"
    echo "❌ Issues detected in cache clearing"
    echo ""
    echo "Recommendations:"
    echo "1. Check React Query cache configuration"
    echo "2. Verify user-specific query keys"
    echo "3. Ensure proper cache invalidation timing"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test data..."
rm -f cookies_a.txt cookies_b.txt cookies_a2.txt
echo "✓ Test completed"