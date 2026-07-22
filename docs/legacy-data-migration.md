# ترحيل وتنظيف بيانات النظام القديم

## المبادئ

- `session_records_rows.csv` هو مصدر جلسات التسميع الأساسي.
- `sessions_rows.csv` يُستخدم فقط للجلسات غير الموجودة في المصدر الأساسي.
- التاريخ هو مصدر حقيقة اليوم؛ أي `session_day` مخالف يُسجل في تقرير المراجعة ولا يُعتمد.
- الطالب يحتفظ بمعرّف واحد في النظام الجديد، وتُربط به كل معرّفات النظام القديم عبر `legacy_id_maps`.
- سجلات البرنامج الأساسي والمخيم لنفس الاسم تُدمج فقط عندما تكون الهوية غير ملتبسة.
- المخيم يُرحّل إلى برنامج موسمي مؤرشف ولا يظهر كوحدة تشغيل حالية.
- كلمات المرور/PIN القديمة لا تُستورد مطلقاً. الحسابات المنشأة من الترحيل تكون `DISABLED` وبكلمة عشوائية غير معروفة.
- لا توجد كتابة إلى PostgreSQL أثناء مرحلة التحليل.

## 1. تجهيز الملفات

انسخ ملفات CSV إلى `legacy-data/` كما هو موضح في `legacy-data/README.md`.

## 2. التحليل والتنظيف

```powershell
npm run legacy:analyze
```

أو بمسارات مخصصة:

```powershell
npm run legacy:analyze -- --input "E:\old-export" --output "E:\migration-review"
```

النواتج المهمة:

- `migration-output/migration-plan.json`
- `migration-output/review-required.csv`
- `migration-output/student-identity-review.csv`
- `migration-output/day-date-mismatches.csv`
- `migration-output/legacy-id-map.csv`
- `migration-output/migrated-users-review.csv`

كل خطة تحمل SHA-256 fingerprint للملفات، لذلك لا يمكن اعتبار ملفين مختلفين نفس عملية الترحيل.

## 3. تطبيق Migration قاعدة البيانات

```powershell
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

Migration الجديدة تضيف فقط جدولي تتبع:

- `legacy_migration_runs`
- `legacy_id_maps`

## 4. الاستيراد

الاستيراد محظور دون `--apply`:

```powershell
npm run legacy:import -- --apply
```

عند وجود أخطاء مراجعة، يتوقف الاستيراد. بعد مراجعتها وقبول استبعاد السجلات غير القابلة للربط:

```powershell
npm run legacy:import -- --apply --allow-errors
```

تتم الكتابة داخل Serializable Transaction واحدة. أي فشل يؤدي إلى rollback للطلاب والحلقات والجلسات والاختبارات.

إعادة تشغيل الخطة نفسها آمنة: بصمة المصدر تمنع استيرادها مرتين.

## 5. التحقق

```powershell
npm run legacy:verify
```

ينشئ `migration-output/verification-result.json` ويتحقق من:

- أعداد الطلاب والجلسات والسجلات والأنشطة والاختبارات.
- خرائط المعرّفات القديمة.
- عدم وجود سجلات يتيمة.

## 6. تفعيل الحسابات القديمة

لا تُستخدم الـPIN القديمة. لتعيين كلمة جديدة وتفعيل حساب واحد، ضع مؤقتاً في `.env`:

```env
MIGRATED_USER_DISPLAY_NAME="أبو خليل الظاظا"
MIGRATED_USER_NEW_PASSWORD="كلمة-قوية-جديدة"
```

ثم:

```powershell
npm run auth:activate-migrated-user
```

احذف كلمة المرور من `.env` بعد نجاح الأمر.

## الاختبارات القديمة

يدعم المستورد `exams_rows.csv` و`official_exams_rows.csv`. إذا لم تكن هذه الملفات ضمن التصدير، سيظهر عدد الاختبارات المخطط لها صفراً ولن يتم اختلاق نتائج غير موجودة.
