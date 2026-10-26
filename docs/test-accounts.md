# TEST USERS

User A

Creation
curl -X POST 'https://lmzbaxlojgsdwgcxkmzx.supabase.co/auth/v1/admin/generate_link' \
 -H "apikey: TU_SERVICE_ROLE_KEY" \
 -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
 -H "Content-Type: application/json" \
 -d '{
"type": "magiclink",
"email": "test-a+silverchat@example.com",
"options": { "redirect_to": "http://localhost:8888/api/auth/callback" }
}'

UUID: d7bf7650-433d-4e63-95ab-8930b8c3e68d
Email: test-a+silverchat@example.com
Creation Date: Oct 25th 2026

User B

Creation
curl -X POST 'https://lmzbaxlojgsdwgcxkmzx.supabase.co/auth/v1/admin/generate_link' \
 -H "apikey: TU_SERVICE_ROLE_KEY" \
 -H "Authorization: Bearer TU_SERVICE_ROLE_KEY" \
 -H "Content-Type: application/json" \
 -d '{
"type": "magiclink",
"email": "test-b+silverchat@example.com",
"options": { "redirect_to": "http://localhost:8888/api/auth/callback" }
}'

UUID: ee131809-4a43-4388-b73f-b0447877a912
Email: test-b+silverchat@example.com
Creation Date: Oct 25th 2026
