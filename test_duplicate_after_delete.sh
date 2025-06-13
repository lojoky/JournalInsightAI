#!/bin/bash

echo "🔄 Duplicate Detection After Delete Test"
echo "========================================"
echo "Testing if deleted entries still prevent re-upload of same images"
echo ""

# Base URL
BASE_URL="http://localhost:5000"

# Create test user
echo "📝 Step 1: Creating test user..."
USER_DATA='{"username":"duplicate_test_user","password":"testpass123"}'
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$USER_DATA" > /dev/null

# Login
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$USER_DATA")

USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "✓ Test user created and logged in (ID: $USER_ID)"

# Create a test image with unique content
echo ""
echo "📷 Step 2: Creating unique test image..."
echo "This is a unique test image for duplicate testing $(date)" > test_content.txt
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > test_duplicate.png

# First upload
echo ""
echo "📤 Step 3: First upload attempt..."
FIRST_UPLOAD=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/upload" \
  -F "journal=@test_duplicate.png" \
  -F "title=First Upload Test")

FIRST_ENTRY_ID=$(echo "$FIRST_UPLOAD" | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -n "$FIRST_ENTRY_ID" ]; then
    echo "✅ First upload successful - Entry ID: $FIRST_ENTRY_ID"
else
    echo "❌ First upload failed"
    echo "Response: $FIRST_UPLOAD"
    exit 1
fi

# Wait for processing
echo ""
echo "⏳ Step 4: Waiting for processing..."
sleep 3

# Try duplicate upload (should be rejected)
echo ""
echo "🚫 Step 5: Testing duplicate detection (should be rejected)..."
DUPLICATE_UPLOAD=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/upload" \
  -F "journal=@test_duplicate.png" \
  -F "title=Duplicate Upload Test")

if echo "$DUPLICATE_UPLOAD" | grep -q "duplicate"; then
    echo "✅ Duplicate correctly detected and rejected"
else
    echo "❌ Duplicate detection failed"
    echo "Response: $DUPLICATE_UPLOAD"
fi

# Delete the first entry
echo ""
echo "🗑️ Step 6: Deleting first entry..."
DELETE_RESPONSE=$(curl -s -b cookies.txt -X DELETE "$BASE_URL/api/journal-entries/$FIRST_ENTRY_ID")

if echo "$DELETE_RESPONSE" | grep -q "success"; then
    echo "✅ Entry deleted successfully"
else
    echo "❌ Entry deletion failed"
    echo "Response: $DELETE_RESPONSE"
fi

# Wait a moment
sleep 2

# Verify entry is gone
ENTRIES_AFTER_DELETE=$(curl -s -b cookies.txt "$BASE_URL/api/journal-entries")
ENTRY_COUNT=$(echo "$ENTRIES_AFTER_DELETE" | grep -o '"id":' | wc -l)
echo "📊 Entries remaining after delete: $ENTRY_COUNT"

# Critical test: Try to upload the same image again after deletion
echo ""
echo "🔥 Step 7: CRITICAL TEST - Re-upload after deletion..."
REUPLOAD_RESPONSE=$(curl -s -b cookies.txt -X POST "$BASE_URL/api/upload" \
  -F "journal=@test_duplicate.png" \
  -F "title=Re-upload After Delete Test")

REUPLOAD_ENTRY_ID=$(echo "$REUPLOAD_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

echo ""
echo "🏁 CRITICAL TEST RESULTS:"
echo "========================"

if [ -n "$REUPLOAD_ENTRY_ID" ]; then
    echo "✅ PASS: Re-upload successful after deletion"
    echo "✅ New Entry ID: $REUPLOAD_ENTRY_ID"
    echo "✅ Duplicate detection properly ignores deleted entries"
elif echo "$REUPLOAD_RESPONSE" | grep -q "duplicate"; then
    echo "❌ FAIL: Re-upload blocked by duplicate detection"
    echo "❌ System still thinks deleted entry is a duplicate"
    echo "❌ This confirms the bug - deleted entries prevent re-upload"
    echo ""
    echo "Error response: $REUPLOAD_RESPONSE"
else
    echo "❌ FAIL: Re-upload failed for unknown reason"
    echo "Response: $REUPLOAD_RESPONSE"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up test files..."
rm -f cookies.txt test_duplicate.png test_content.txt
echo "✓ Test completed"