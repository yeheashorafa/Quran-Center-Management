import type { ParentReportData } from "@/lib/reports/parent-report-types";

export function generateParentReportHtml(data: ParentReportData): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير ولي الأمر - ${data.student.displayName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #fff;
      color: #0f172a;
      direction: rtl;
      margin: 0;
      padding: 0;
    }
    .container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #064e3b;
      border-radius: 16px;
      padding: 24px;
      box-sizing: border-box;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .logo {
      height: 65px;
      width: auto;
      object-fit: contain;
      margin-bottom: 8px;
    }
    .center-name {
      font-size: 14px;
      font-weight: bold;
      color: #064e3b;
    }
    .title {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      margin: 6px 0;
    }
    .subtitle {
      font-size: 12px;
      color: #64748b;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
      font-size: 13px;
    }
    .eval-badge {
      text-align: center;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #064e3b;
      font-size: 18px;
      font-weight: 900;
      padding: 14px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .stats-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .stats-table th, .stats-table td {
      border: 1px solid #cbd5e1;
      padding: 10px;
      text-align: center;
      font-size: 13px;
    }
    .stats-table th {
      background: #064e3b;
      color: #fff;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="/brand/logo.png" alt="شعار المركز" class="logo" />
      <div class="center-name">${data.centerName}</div>
      <div class="title">📜 تقرير متابعة الطالب الشهري</div>
      <div class="subtitle">تاريخ الاستخراج: ${data.generatedAt}</div>
    </div>

    <div class="eval-badge">
      التقييم العام للطالب: ${data.evaluation.label}
    </div>

    <div class="grid">
      <div class="info-card">
        <strong>اسم الطالب:</strong> ${data.student.displayName}<br>
        <strong>المرحلة:</strong> ${data.halaqa.stageName}<br>
        <strong>الحلقة:</strong> ${data.halaqa.nameAr}
      </div>
      <div class="info-card">
        <strong>الشيخ المحفظ:</strong> ${data.halaqa.teacherName || "غير محدد"}<br>
        <strong>رقم ولي الأمر:</strong> ${data.student.parentPhone || "غير مسجل"}<br>
        <strong>الشهر:</strong> ${data.monthLabel}
      </div>
    </div>

    <table class="stats-table">
      <thead>
        <tr>
          <th>أيام الحضور</th>
          <th>أيام الغياب</th>
          <th>الأعذار</th>
          <th>حضر ولم يسمّع</th>
          <th>نسبة الحضور</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${data.attendance.present} يوم</td>
          <td>${data.attendance.absent} يوم</td>
          <td>${data.attendance.excused} يوم</td>
          <td>${data.attendance.notHeard} يوم</td>
          <td><strong>${data.attendance.attendanceRate}%</strong></td>
        </tr>
      </tbody>
    </table>

    <table class="stats-table">
      <thead>
        <tr>
          <th>صفحات الحفظ الجديد</th>
          <th>صفحات المراجعة</th>
          <th>صفحات السرد</th>
          <th>إجمالي الإنجاز</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${data.achievement.memorizationPages} صفحة</td>
          <td>${data.achievement.reviewPages} صفحة</td>
          <td>${data.achievement.recitationPages} صفحة</td>
          <td><strong>${data.achievement.totalPages} صفحة</strong></td>
        </tr>
      </tbody>
    </table>

    ${
      data.latestExam
        ? `
      <div class="info-card" style="margin-bottom: 20px;">
        <strong>آخر اختبار رسمي:</strong> ${data.latestExam.examType} — 
        النتيجة: <strong>${data.latestExam.score ?? "مكتمل"} (${data.latestExam.resultLabel})</strong>
        تاريخ: ${data.latestExam.examDate}
      </div>
    `
        : ""
    }

    <div class="footer">
      مع تحيات إدارة ${data.centerName} — نسأل الله أن يبارك في أبنائنا الكرام
    </div>
  </div>
</body>
</html>`;
}
