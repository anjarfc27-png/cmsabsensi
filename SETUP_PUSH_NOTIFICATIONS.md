# Setup Native Push Notifications (FCM v1 API)

## Prerequisites

✅ `google-services.json` sudah ada di `android/app/`
✅ Google Services plugin sudah dikonfigurasi di `build.gradle`
✅ Capacitor Push Notifications plugin sudah terinstall

## Step-by-Step Setup

### 1. Download Firebase Service Account JSON

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project: **cms-absensi**
3. Klik ⚙️ (Settings) → **Project settings**
4. Tab **Service accounts**
5. Klik **Generate new private key**
6. Download file JSON (contoh: `cms-absensi-firebase-adminsdk-xxxxx.json`)
7. **SIMPAN FILE INI DENGAN AMAN** - jangan commit ke Git!

### 2. Enable Firebase Cloud Messaging API (v1)

1. Masih di Firebase Console
2. Klik **Cloud Messaging** tab
3. Jika ada pesan "Cloud Messaging API (Legacy) Disabled":
   - Klik link **Learn more** atau **Manage API in Google Cloud Console**
   - Enable **Firebase Cloud Messaging API** (bukan yang Legacy)
   - Tunggu beberapa menit sampai aktif

### 3. Prepare Service Account for Supabase

Buka file Service Account JSON yang di-download, copy seluruh isinya.

Contoh isi file:
```json
{
  "type": "service_account",
  "project_id": "cms-absensi",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@cms-absensi.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

**Minify JSON** (hapus whitespace dan newline):
```bash
# Di terminal, jalankan:
cat cms-absensi-firebase-adminsdk-xxxxx.json | jq -c
```

Atau manual: copy JSON dan paste ke https://codebeautify.org/jsonminifier lalu minify.

### 4. Deploy Edge Function

```bash
# Install Supabase CLI (jika belum)
npm install -g supabase

# Login
npx supabase login

# Link project
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy function
npx supabase functions deploy send-push-notification
```

**Cara mendapatkan PROJECT_REF:**
- Buka Supabase Dashboard
- URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
- Atau: Project Settings → General → Reference ID

### 5. Set Firebase Service Account di Supabase

1. Buka Supabase Dashboard
2. **Project Settings** → **Edge Functions** → **Secrets**
3. Add new secret:
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: (paste minified JSON dari Step 3)
4. Save

⚠️ **PENTING:** Paste **SELURUH** JSON yang sudah di-minify, termasuk `{` dan `}`.

### 6. Run Database Migration

**Option A: Via Supabase CLI**
```bash
npx supabase db push
```

**Option B: Via SQL Editor (Manual)**
1. Buka Supabase Dashboard → SQL Editor
2. Copy-paste isi file: `supabase/migrations/20260109210000_fcm_push_trigger.sql`
3. Run

### 7. Configure Database Settings

Di Supabase SQL Editor, run:

```sql
-- Ganti YOUR_PROJECT_REF dengan project ref Anda
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

-- Ganti YOUR_SERVICE_ROLE_KEY dengan service role key Anda
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'eyJhbGc...';
```

**Cara mendapatkan Service Role Key:**
1. Supabase Dashboard → **Project Settings** → **API**
2. Copy **service_role** key (yang panjang, bukan anon key)

### 8. Test Push Notification

#### Test dari Supabase SQL Editor:

```sql
-- Ganti USER_ID dengan ID user yang sedang login di app
INSERT INTO notifications (user_id, title, message, type, link)
VALUES (
  'USER_ID_DISINI',
  'Test Push Notification',
  'Halo! Ini test push notification dari FCM v1!',
  'info',
  '/dashboard'
);
```

#### Test dari Edge Function directly:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "USER_ID_HERE",
    "title": "Test Notification",
    "body": "Hello from FCM v1!",
    "data": {}
  }'
```

### 9. Build & Test Android App

```bash
# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Build and run on device
```

## Troubleshooting

### Error "FIREBASE_SERVICE_ACCOUNT not configured":

- Pastikan secret `FIREBASE_SERVICE_ACCOUNT` sudah di-set di Supabase Edge Functions
- Pastikan value-nya adalah **minified JSON** (tidak ada newline)
- Redeploy function: `npx supabase functions deploy send-push-notification`

### Error "Cloud Messaging API (Legacy) Disabled":

- Jangan pakai Legacy API
- Enable **Firebase Cloud Messaging API** (v1) di Google Cloud Console
- Gunakan Service Account JSON, bukan Server Key

### Push tidak muncul di HP:

1. **Cek FCM token tersimpan:**
   ```sql
   SELECT * FROM fcm_tokens WHERE user_id = 'YOUR_USER_ID';
   ```

2. **Cek Edge Function logs:**
   - Supabase Dashboard → Edge Functions → Logs
   - Lihat apakah ada error saat send push

3. **Cek permission di HP:**
   - Settings → Apps → [App Name] → Notifications → ✅ Enable

4. **Cek Firebase Cloud Messaging API enabled:**
   - Google Cloud Console → APIs & Services → Enabled APIs
   - Pastikan "Firebase Cloud Messaging API" ada di list

### Error "No FCM tokens found":

- User belum login di app atau permission ditolak
- Cek `usePushNotifications` hook dipanggil di `DashboardLayout`
- Cek console log saat app dibuka: "Push registration success, token: ..."

## Perbedaan FCM v1 vs Legacy

| Feature | Legacy API (Deprecated) | v1 API (Current) |
|---------|------------------------|------------------|
| Auth | Server Key | OAuth2 Access Token |
| Endpoint | `/fcm/send` | `/v1/projects/{project}/messages:send` |
| Credential | Server Key string | Service Account JSON |
| Status | ❌ Deprecated (6/20/2024) | ✅ Active |

## How It Works

1. **User opens app** → `usePushNotifications` hook registers device
2. **FCM token saved** to `fcm_tokens` table
3. **New notification inserted** → Trigger fires
4. **Trigger calls Edge Function** with user_id
5. **Edge Function:**
   - Gets Service Account from env
   - Generates OAuth2 access token
   - Fetches FCM tokens for user
   - Sends push via FCM v1 API
6. **User receives** native push notification on device

## Files

- ✅ `supabase/functions/send-push-notification/index.ts` - Edge Function (FCM v1)
- ✅ `supabase/migrations/20260109210000_fcm_push_trigger.sql` - Database Trigger
- ✅ `android/app/google-services.json` - Firebase config
- ⚠️ `cms-absensi-firebase-adminsdk-xxxxx.json` - **DO NOT COMMIT!**

## Security Notes

⚠️ **NEVER commit Service Account JSON to Git!**

Add to `.gitignore`:
```
*firebase-adminsdk*.json
*service-account*.json
```

The Service Account JSON should only be stored as a secret in Supabase Edge Functions.

## Next Steps

1. ✅ Download Service Account JSON from Firebase
2. ✅ Enable Firebase Cloud Messaging API (v1)
3. ✅ Minify Service Account JSON
4. ✅ Deploy Edge Function
5. ✅ Set `FIREBASE_SERVICE_ACCOUNT` secret
6. ✅ Run migration
7. ✅ Configure database settings
8. ✅ Test!

---

**Status:** Ready to deploy with FCM HTTP v1 API! 🚀
