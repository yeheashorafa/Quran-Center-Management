# تطبيق إدارة مركز تحفيظ قرآن

النسخة الجديدة مبنية باستخدام:

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- جميع كود التطبيق داخل `src/`
- PostgreSQL 17
- Prisma ORM 7
- Argon2id لكلمات المرور
- Database Sessions داخل HttpOnly Cookies
- واجهة عربية RTL وMobile First

## المتطلبات

- Node.js 20.19 أو أحدث
- Docker Desktop لتشغيل PostgreSQL محلياً

## التشغيل لأول مرة

### 1. إعداد متغيرات البيئة

على Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

على macOS أو Linux:

```bash
cp .env.example .env
```

### 2. تثبيت الحزم

```bash
npm install
```

### 3. تشغيل PostgreSQL

```bash
npm run db:up
```

### 4. توليد Prisma وتطبيق قاعدة البيانات

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run db:check
```

### 5. إنشاء أول حساب مدير

ضع مؤقتاً داخل `.env`:

```env
INITIAL_ADMIN_USERNAME="admin"
INITIAL_ADMIN_DISPLAY_NAME="مدير المركز"
INITIAL_ADMIN_PASSWORD="ضع-كلمة-قوية-هنا"
```

ثم:

```bash
npm run auth:create-admin
```

بعد نجاح الإنشاء، احذف قيمة `INITIAL_ADMIN_PASSWORD` من `.env`.

### 6. تشغيل التطبيق

```bash
npm run dev
```

ثم افتح:

```text
http://localhost:3000
```

## أوامر المشروع

```bash
npm run dev                 # تشغيل Next.js للتطوير
npm run build               # بناء نسخة الإنتاج
npm run lint                # فحص ESLint
npm run typecheck           # فحص TypeScript
npm run db:up               # تشغيل PostgreSQL
npm run db:down             # إيقاف PostgreSQL
npm run db:generate         # توليد Prisma Client
npm run db:validate         # فحص schema.prisma
npm run db:migrate          # إنشاء Migration في التطوير
npm run db:migrate:deploy   # تطبيق Migrations الموجودة
npm run db:seed             # إضافة المراحل والأدوار والصلاحيات
npm run db:check            # اختبار اتصال PostgreSQL
npm run db:studio           # فتح Prisma Studio
npm run auth:create-admin   # إنشاء أو تحديث أول مدير
```

## البنية الحالية

```text
prisma/
├── migrations/
├── schema.prisma
└── seed.ts

src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/teacher/
│   ├── (dashboard)/manager/
│   ├── (dashboard)/examiner/
│   ├── api/auth/
│   ├── api/manager/
│   └── unauthorized/
├── components/
├── config/
├── generated/prisma/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── halaqat/
│   ├── http/
│   └── manager/
├── scripts/
└── proxy.ts
```

## المصادقة المنفذة

- قائمة دخول حسب الدور والمرحلة.
- التحقق من تعيين الشيخ على حلقة نشطة في المرحلة المختارة.
- تشفير كلمات المرور باستخدام Argon2id.
- جلسات عشوائية مخزنة في PostgreSQL بصيغة hash.
- Cookie آمنة: `HttpOnly`, `SameSite=Lax`, و`Secure` في الإنتاج.
- جلسة عادية لمدة 12 ساعة أو 30 يوماً عند تذكر الجهاز.
- إيقاف محاولات الدخول لمدة 15 دقيقة بعد خمس محاولات خاطئة.
- حماية صفحات الشيخ والمدير والمختبر حسب الدور.
- تسجيل نجاح وفشل الدخول في `audit_logs` دون حفظ كلمات المرور.

تفاصيل إضافية:

```text
docs/authentication.md
docs/database-schema.md
docs/manager-halaqat-users.md
```

## إدارة المستخدمين والحلقات

تم تنفيذ أول جزء فعلي من لوحة المدير:

- إنشاء مستخدم بدور الشيخ أو المدير أو المختبر.
- تشفير كلمة الدخول قبل الحفظ.
- إيقاف المستخدم وإلغاء جلساته دون حذف حسابه.
- إنشاء حلقة وربطها بمرحلة وشيخ وأيام دوام.
- إيقاف الحلقة دون حذف بياناتها التاريخية.
- إعادة تفعيل المستخدم أو الحلقة.
- تسجيل العمليات المهمة داخل `audit_logs`.

التفاصيل:

```text
docs/manager-halaqat-users.md
```

## ملاحظات

- لا تحفظ `.env` داخل Git.
- لا تترك كلمة المدير داخل `.env` بعد إنشاء الحساب.
- Proxy يقدم فحصاً أولياً فقط؛ التحقق النهائي من الجلسة والصلاحية يتم من PostgreSQL داخل الخادم.
- لا يوجد اتصال مباشر بين المتصفح وقاعدة البيانات.

## إدارة الطلاب

تتضمن لوحة المدير الآن تبويباً لإدارة الطلاب:

- إنشاء ملف طالب وتسجيله في حلقة.
- البحث والتصفية.
- فتح ملف الطالب وتعديل بياناته.
- عرض التسجيل الحالي والتاريخ الكامل للتسجيلات.
- إيقاف وإعادة تفعيل الملف بدون حذف السجلات.
- إعادة تسجيل الطالب غير المسجل في حلقة نشطة.

راجع `docs/manager-students.md` للتفاصيل.

## جلسات التسميع اليومية

أضيفت شاشة الشيخ لتسجيل التسميع اليومي مع استخراج اليوم تلقائياً والتحقق من جدول الحلقة على الخادم. يمكن حفظ طالب واحد، حفظ التعديلات كمسودة، اعتماد الجلسة بعد تسجيل جميع الطلاب، وفتح الجلسات السابقة للتعديل أو الاستكمال. التفاصيل في `docs/teacher-memorization-sessions.md`.

## متابعة المدير اليومية

أضيفت متابعة الحلقات حسب تاريخ محدد من لوحة المدير، وتشمل الحلقات المجدولة، حالة التسجيل، الحضور، وعدد صفحات الحفظ والمراجعة والسرد. راجع `docs/manager-daily-monitoring.md`.
