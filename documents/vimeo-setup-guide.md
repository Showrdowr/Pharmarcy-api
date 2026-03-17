# 🎬 คู่มือเตรียม Vimeo API สำหรับ Pharmacy Academy

## ภาพรวม

ระบบนี้ใช้ **Vimeo** สำหรับจัดเก็บและสตรีมวิดีโอบทเรียน โดยใช้วิธี **TUS Resumable Upload**:
- Admin อัปโหลดวิดีโอผ่าน Backoffice → ไฟล์ถูกส่งตรงไป Vimeo
- Backend ทำหน้าที่ขอ Upload URL จาก Vimeo (ป้องกัน API Key หลุด)
- หลังอัปโหลดสำเร็จ บันทึก Vimeo Video ID ลง Database

---

## ขั้นตอนที่ 1: สมัคร Vimeo Account

### 1.1 เลือกแผน
ไปที่ [https://vimeo.com/upgrade](https://vimeo.com/upgrade)

| แผน | ราคา/เดือน | พื้นที่ | เหมาะกับ |
|-----|-----------|--------|---------|
| **Starter** | $9 | 250 GB | เริ่มต้น / ทดสอบ |
| **Standard** | $25 | 500 GB | Production ขนาดเล็ก |
| **Advanced** | $65 | 5 TB | Production เต็มรูปแบบ |
| **Enterprise** | ติดต่อ | Unlimited | องค์กรใหญ่ |

> ⚠️ **สำคัญ**: แผน **Free** ไม่รองรับ API Upload จำเป็นต้องใช้แผน **Starter ขึ้นไป**

---

## ขั้นตอนที่ 2: สร้าง Vimeo Developer App

### 2.1 เข้าไปที่ Vimeo Developer Portal
ไปที่ [https://developer.vimeo.com/apps](https://developer.vimeo.com/apps)

### 2.2 สร้าง App ใหม่
1. คลิก **"Create a new app"**
2. กรอกข้อมูล:
   - **App Name**: `Pharmacy Academy`
   - **App Description**: `Backend system for Pharmacy Academy LMS`
   - **App URL**: `http://localhost:3001` (สำหรับ dev) หรือ URL จริงของ backend
   - **App Callback URLs**: ไม่จำเป็นสำหรับ server-side upload

3. คลิก **"Create App"**

### 2.3 เก็บ Client Credentials
หลังสร้าง App แล้วจะได้:
```
Client ID:     xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 📋 **เก็บไว้ใน Password Manager** อย่า commit ลง Git

---

## ขั้นตอนที่ 3: สร้าง Personal Access Token

> Personal Access Token ใช้สำหรับ server-to-server (ไม่ต้องให้ user login)

### 3.1 สร้าง Token
ไปที่หน้า App ของคุณ → แท็บ **"Authentication"** → Section **"Personal access tokens"**

คลิก **"Generate token"**

### 3.2 เลือก Scopes (สิทธิ์ที่จำเป็น)

เลือก **ทุก scope ต่อไปนี้**:

| Scope | จำเป็น | เหตุผล |
|-------|--------|--------|
| ✅ `upload` | **บังคับ** | อัปโหลดวิดีโอใหม่ |
| ✅ `video_files` | **บังคับ** | ดู/จัดการไฟล์วิดีโอ |
| ✅ `delete` | **บังคับ** | ลบวิดีโอออกจาก Vimeo |
| ✅ `edit` | **แนะนำ** | แก้ไขชื่อ/คำอธิบายวิดีโอ |
| ✅ `public` | **แนะนำ** | ตั้งค่า privacy ของวิดีโอ |
| ✅ `private` | **แนะนำ** | วิดีโอที่ต้องการ privacy |

### 3.3 เก็บ Access Token
หลัง Generate จะได้ token ในรูปแบบ:
```
Access Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠️ **Token จะแสดงครั้งเดียวเท่านั้น** — เก็บทันที ถ้าหายต้อง generate ใหม่

---

## ขั้นตอนที่ 4: ตั้งค่า Privacy ของ App (สำคัญมาก)

### 4.1 ตั้งค่า Domain Whitelist
ไปที่ App Settings → **"Video Defaults"** หรือ **"Whitelisted Domains"**

เพิ่ม domain ที่อนุญาตให้ embed วิดีโอ:
```
localhost:3000          (frontend dev)
localhost:3001          (backend dev)
your-domain.com         (production)
www.your-domain.com     (production)
```

### 4.2 ตั้งค่า Default Privacy ของวิดีโอ
ไปที่ [https://vimeo.com/settings/videos](https://vimeo.com/settings/videos)

แนะนำให้ตั้ง:
- **Who can watch**: `Only people with the private link` หรือ `Embed only`
- **Where can it be embedded**: เฉพาะ domain ของระบบ

---

## ขั้นตอนที่ 5: เพิ่มค่าใน `.env` ของ Backend

เปิดไฟล์ `Pharmarcy-api/.env` แล้วเพิ่ม:

```env
# Vimeo Configuration
VIMEO_ACCESS_TOKEN=your_personal_access_token_here
VIMEO_CLIENT_ID=your_client_id_here
VIMEO_CLIENT_SECRET=your_client_secret_here
```

ดู template ที่ `Pharmarcy-api/.env.example`:
```env
VIMEO_ACCESS_TOKEN=
VIMEO_CLIENT_ID=
VIMEO_CLIENT_SECRET=
```

---

## ขั้นตอนที่ 6: ทดสอบ Credentials

### 6.1 ทดสอบด้วย curl
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://api.vimeo.com/me
```

ผลลัพธ์ที่ถูกต้อง:
```json
{
  "uri": "/users/12345678",
  "name": "Pharmacy Academy",
  "account": "plus",
  ...
}
```

### 6.2 ตรวจสอบ Upload Quota
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://api.vimeo.com/me?fields=upload_quota
```

ผลลัพธ์:
```json
{
  "upload_quota": {
    "space": {
      "free": 26843545600,
      "used": 0,
      "max": 26843545600,
      "showing": "periodic"
    }
  }
}
```

---

## ขั้นตอนที่ 7: ติดตั้ง Dependencies ใน Frontend

```bash
cd backoffice
npm install tus-js-client
npm install --save-dev @types/tus-js-client
```

---

## สรุป Checklist ก่อนเริ่ม Dev

- [ ] สมัคร Vimeo Account (แผน Starter ขึ้นไป)
- [ ] สร้าง App ที่ developer.vimeo.com
- [ ] เก็บ `Client ID` และ `Client Secret`
- [ ] สร้าง Personal Access Token พร้อม scopes: `upload`, `video_files`, `delete`, `edit`, `public`, `private`
- [ ] เก็บ `Access Token`
- [ ] เพิ่ม Domain Whitelist ใน Vimeo App settings
- [ ] ตั้งค่า Default Video Privacy
- [ ] เพิ่มค่าทั้งหมดใน `Pharmarcy-api/.env`
- [ ] ทดสอบ credentials ด้วย curl
- [ ] ตรวจสอบ Upload Quota เหลือพอ
- [ ] `npm install tus-js-client` ใน backoffice

---

## ข้อมูลอ้างอิง

| ลิงก์ | รายละเอียด |
|-------|-----------|
| [developer.vimeo.com](https://developer.vimeo.com) | Vimeo Developer Portal |
| [developer.vimeo.com/apps](https://developer.vimeo.com/apps) | จัดการ Apps |
| [developer.vimeo.com/api/reference](https://developer.vimeo.com/api/reference) | API Reference |
| [developer.vimeo.com/api/upload/videos](https://developer.vimeo.com/api/upload/videos) | Upload Guide |
| [github.com/tus/tus-js-client](https://github.com/tus/tus-js-client) | TUS JS Client Library |
| [vimeo.com/settings/videos](https://vimeo.com/settings/videos) | ตั้งค่า Privacy |

---

## ⚠️ ข้อควรระวัง

1. **ห้าม commit** `VIMEO_ACCESS_TOKEN`, `VIMEO_CLIENT_SECRET` ลง Git เด็ดขาด
2. **Token มี scope** — ถ้าต้องการสิทธิ์เพิ่มต้อง generate ใหม่ (แก้ scope ไม่ได้)
3. **Upload Quota** — ตรวจสอบพื้นที่ที่เหลือก่อน production
4. **Rate Limit** — Vimeo API มี rate limit, ถ้า upload พร้อมกันหลายไฟล์ต้องทำ queue
5. **Privacy** — วิดีโอที่ upload ใหม่ default อาจเป็น public ต้องตั้งค่า App default ให้ถูก
