# Setup Native Push Notifications (FCM)

## Prerequisites

✅ `google-services.json` sudah ada di `android/app/`
✅ Google Services plugin sudah dikonfigurasi di `build.gradle`
✅ Capacitor Push Notifications plugin sudah terinstall

## Step-by-Step Setup

### 1. Get FCM Server Key

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project: **cms-absensi**
3. Go to: **Project Settings** → **Cloud Messaging**
4. Copy **Server Key** (Legacy)
   - Jika tidak ada, enable **Cloud Messaging API (Legacy)** terlebih dahulu

### 2. Deploy Edge Function

```bash
# Login to Supabase CLI
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
npx supabase functions deploy send-push-notification
```

### 3. Set Environment Variables

Di Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Add secrets:
   ```
   FCM_SERVER_KEY=YOUR_FCM_SERVER_KEY_HERE
   ```

### 4. Run Database Migration

```bash
# Apply migration to enable push notification trigger
npx supabase db push
```

Atau manual di Supabase SQL Editor:
- Run file: `supabase/migrations/20260109210000_fcm_push_trigger.sql`

### 5. Configure Supabase Settings (Important!)

Di Supabase SQL Editor, run:

```sql
-- Set Supabase URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

-- Set Service Role Key
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = 'YOUR_SERVICE_ROLE_KEY';
```

**Cara mendapatkan Service Role Key:**
1. Supabase Dashboard → Project Settings → API
2. Copy **service_role** key (secret)

### 6. Test Push Notification

#### Test dari Supabase SQL Editor:

```sql
-- Insert test notification
INSERT INTO notifications (user_id, title, message, type, link)
VALUES (
  'USER_ID_HERE',
  'Test Push Notification',
  'Ini adalah test push notification dari Supabase!',
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
    "body": "Hello from FCM!",
    "data": {}
  }'
```

### 7. Build & Test Android App

```bash
# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Build and run on device
```

## Troubleshooting

### Push tidak muncul di HP:

1. **Cek FCM Token tersimpan:**
   ```sql
   SELECT * FROM fcm_tokens WHERE user_id = 'YOUR_USER_ID';
   ```

2. **Cek log Edge Function:**
   - Supabase Dashboard → Edge Functions → Logs

3. **Cek permission di HP:**
   - Settings → Apps → [App Name] → Notifications → Enable

4. **Test manual FCM:**
   ```bash
   curl -X POST https://fcm.googleapis.com/fcm/send \
     -H "Authorization: key=YOUR_FCM_SERVER_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "DEVICE_FCM_TOKEN",
       "notification": {
         "title": "Test",
         "body": "Manual FCM test"
       }
     }'
   ```

### Error "FCM_SERVER_KEY not configured":

- Pastikan secret sudah di-set di Supabase Edge Functions settings
- Redeploy function setelah set secret

### Error "No FCM tokens found":

- User belum login di app atau permission ditolak
- Cek `usePushNotifications` hook dipanggil di `DashboardLayout`

## How It Works

1. **User opens app** → `usePushNotifications` hook registers device
2. **FCM token saved** to `fcm_tokens` table
3. **New notification inserted** → Trigger fires
4. **Trigger calls Edge Function** with user_id
5. **Edge Function fetches** FCM tokens for user
6. **Edge Function sends** push via FCM API
7. **User receives** native push notification on device

## Files Created

- ✅ `supabase/functions/send-push-notification/index.ts` - Edge Function
- ✅ `supabase/migrations/20260109210000_fcm_push_trigger.sql` - Database Trigger
- ✅ `android/app/google-services.json` - Firebase config (already exists)

## Next Steps

1. Get FCM Server Key from Firebase Console
2. Deploy Edge Function
3. Set FCM_SERVER_KEY secret
4. Run migration
5. Configure database settings
6. Build & test!

---

**Status:** Ready to deploy! Follow steps above to activate native push notifications.
