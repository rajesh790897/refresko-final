# 🔧 Student Login Issues - Troubleshooting Guide

## Problem
Some students see error: **"Unable to verify credentials. Check your connection and retry."**

While other students can login fine.

---

## Root Causes (in order of likelihood)

### 1. Student Record Not in Supabase
**Check:** Does the student exist in Supabase `students` table?

**Fix:**
- Go to Supabase Dashboard → SQL Editor
- Run this query:
```sql
SELECT student_code, name, phone FROM students 
WHERE student_code = 'STUDENT_CODE_HERE';
```

If returns empty → **Student data not in Supabase**
- Add student record manually OR
- Export from previous system and import to Supabase

---

### 2. Supabase Connection Issues
**Symptoms:**
- Students get "Network error. Check your connection and retry."
- Happens intermittently

**Fix:**
- Check Supabase status: https://status.supabase.io
- Verify VITE_SUPABASE keys in `.env`:
```bash
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

Both should output values (second is a long JWT token)

---

### 3. Frontend Not Rebuilt After .env Changes
**Symptoms:**
- Error: "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."

**Fix:**
Rebuild frontend:
```bash
npm run build
```

Deploy new `dist/` folder

---

### 4. Phone Number Format Mismatch
**Symptoms:**
- Student enters correct credentials but gets: "Invalid phone number"

**Fix:**
- Check Supabase: Is phone stored as `9876543210` (digits only)?
- Supabase value must match when student enters it
- Verify format: `(123) 456-7890` → stored as `1234567890`

**Script to check phone formats:**
```sql
SELECT student_code, name, phone, LENGTH(REPLACE(phone, ' ', '')) as phone_digits
FROM students 
WHERE student_code LIKE 'CSE%'
LIMIT 20;
```

---

### 5. Data Corruption or Special Characters
**Symptoms:**
- Specific department students can't login
- Error in console mentions encoding issues

**Fix:**
Check for problematic characters:
```sql
SELECT student_code, HEX(name), HEX(phone) 
FROM students 
WHERE student_code = 'PROBLEMATIC_CODE';
```

Replace with clean data if needed.

---

## How to Check Login Errors

### For Users/Students
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try logging in again
4. Copy the error message and share with admin

### For Admin
1. SSH to server or access cPanel file manager
2. Check backend logs: `cpanel_backend_api/debug_bootstrap.php`
3. Run health check:
```bash
curl https://api-refresko.skf.edu.in/health
```

Should return: `{"success":true,"message":"API running"}`

---

## Quick Diagnostic Query

Run in Supabase SQL Editor to find problematic students:

```sql
-- Find students with missing/invalid data
SELECT 
  student_code, 
  CASE 
    WHEN name IS NULL OR name = '' THEN 'Missing name'
    WHEN email IS NULL OR email = '' THEN 'Missing email'
    WHEN phone IS NULL OR phone = '' THEN 'Missing phone'
    WHEN profile_completed IS NULL THEN 'Missing profile_completed'
    ELSE 'OK'
  END as issue
FROM students 
WHERE student_code LIKE 'CSE%'
  OR student_code LIKE 'ECE%'
ORDER BY issue DESC
LIMIT 50;
```

---

## Step-by-Step Fix for Affected Student

### If student code is: `CSE/2022/0001` and phone is `9876543210`

1. **Verify in Supabase:**
```sql
SELECT * FROM students WHERE student_code = 'CSE/2022/0001';
```

2. **Check if phone matches exactly:**
   - Student enters: `(123) 456-7890`
   - System strips: → `1234567890`
   - Supabase must have: `1234567890`

3. **If phone is wrong, update:**
```sql
UPDATE students 
SET phone = '9876543210'
WHERE student_code = 'CSE/2022/0001';
```

4. **Have student try login again**

---

## Bulk Fix: Export and Re-import

If many students have issues:

### Export from old system
```bash
# If you have MySQL/another source:
SELECT student_code, name, email, phone, department, year 
FROM students_backup
INTO OUTFILE '/tmp/students.csv'
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n';
```

### Import to Supabase
1. Supabase Dashboard → SQL Editor
2. Paste import script:
```sql
INSERT INTO students (student_code, name, email, phone, department, year)
SELECT student_code, name, email, phone, department, year 
FROM imported_csv_table
ON CONFLICT(student_code) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  department = EXCLUDED.department,
  year = EXCLUDED.year;
```

---

## New Error Messages (post-fix)

| Error | Cause | Fix |
|-------|-------|-----|
| "Network error. Check your connection and retry." | Network/internet issue | Try again, check WiFi/mobile data |
| "Request timeout. Please try again." | Supabase slow | Try again in 30 seconds |
| "Student code not found. Please check and try again." | Code doesn't exist in Supabase | Verify code is correct OR add to Supabase |
| "Invalid phone number. Please try again." | Phone format mismatch | Check stored phone format in Supabase |
| "Supabase is not configured..." | .env keys missing OR frontend not rebuilt | `npm run build` and redeploy |

---

## Testing

### Manual Test
1. Open: https://refresko.skf.edu.in/login/student
2. Enter test student:
   - Email: `CSE/2022/0001`
   - Password (phone): `9876543210`
3. Should login or show specific error

### Monitor in Real-Time
Open browser Network tab (F12 → Network) while logging in:
- Should see request to `wbixyqcybkoxsechwvzv.supabase.co/...`
- Response should have student data OR 404 if not found

---

## Contact Support
If issues persist:
1. Get student code from affected student
2. Run diagnostic query above
3. Check browser console error message
4. Check `npm run build` output for errors
5. Confirm Supabase health status
6. Email with all above details

**Status:** ✅ Fixed error messages - now shows specific problem instead of generic error
