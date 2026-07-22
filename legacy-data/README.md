# ملفات النظام القديم

ضع صادرات CSV القديمة هنا قبل تشغيل التحليل. الملفات المطلوبة:

- `teachers_rows.csv`
- `students_rows.csv`
- `session_records_rows.csv`

الملفات الاختيارية:

- `camp_teachers_rows.csv`
- `sessions_rows.csv` — احتياط فقط؛ `session_records_rows.csv` هو المصدر الأساسي.
- `exams_rows.csv`
- `official_exams_rows.csv`
- `student_transfer_log_rows.csv`

لا ترفع هذا المجلد إلى Git لأنه يحتوي بيانات شخصية وكلمات مرور قديمة بنص صريح. سكربت الترحيل يتجاهل أعمدة كلمات المرور ولا يضعها في الخطة أو التقارير.
