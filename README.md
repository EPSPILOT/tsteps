# EPS PILOT V37.5

نسخة إصلاح وتطوير لفضاء المنسق.

- محاسبة مهنية: اعتماد مرصود + سجل المداخيل والمصاريف + سبب المصروف + المستفيد + المرجع + الطباعة.
- جمع المعدات والمرافق في خانة واحدة مع جرد وتقارير الضياع والتلف والأعطاب وطباعة التقرير.
- إصلاح صلاحيات والتحقق الخلفي لاستعمال الزمن مع التحقق من الأستاذ والقسم والتعارضات الزمنية.
- إظهار الإشعارات الجديدة في الصفحة الرئيسية للمنسق مع عداد وروابط مباشرة.


V37.19 FULL QA: تم فحص syntax للـserver/app، مسارات المصادقة وإدارة الحسابات، إنشاء/حذف المؤسسة والحسابات التابعة، الصلاحيات الأساسية، الأصول والميزانية، التجربة المجانية، وروابط ملفات الواجهة. تم تصحيح نص تأكيد الحذف في إدارة الحسابات ليعكس الحذف النهائي بدقة.

## V38 — EPS Intelligence & Mode Terrain
- Teacher-only **EPS Intelligence** workspace with local, explainable analytics for class performance, attendance and session delivery.
- Smart session suggestion generator based on APS, level and targeted need; no external AI key is required.
- Teacher-only **Mode Terrain**: phone-first shortcuts for daily notebook, session access, lesson sheets and student files.
- Terrain class selection is carried into the daily notebook view.
- Existing no-refresh navigation and mobile drawer remain preserved.

## V39 — EPS Intelligence & Smart Tracking
- Student progress analysis and early-warning indicators for teachers.
- Smart teacher report generation and anomaly detection.
- Smart coordinator institution dashboard.
- Smart inspector aggregate dashboard with no individual student data.
- Owner anonymized national aggregate view by region.
- Full protected student health-file editing for teachers, with extensible medical fields.
- Protected health-document storage API (up to 8 MB per document).
- Offline application shell and queued daily actions when connectivity is temporarily lost.
- No EPS PILOT Score and no gamification: students do not log into the platform.


## V40 Smart Platform Layer
- EPS Copilot: local explainable lesson/session suggestions.
- Smart annual planning suggestions.
- Sport-safety alerts based on recorded health restrictions (indicative, not diagnosis).
- Class comparison and smart report builder.
- Teacher transfer request + owner approval workflow.
- Owner audit summary and authenticated database backup.
- No EPS PILOT Score and no gamification.
- Generic Node.js hosting; no Render-specific configuration.

## V40.1 Security hardening
- Protected student health documents are no longer publicly accessible; access is authenticated and scoped to the assigned teacher or owner.
- SQLite database files, WAL/journal files and backup files are never served as static assets.
- Health-document API listings now return authenticated `file_url` values.

## V41.3 — Annual Planning Reliable Assignment Fix
- Annual planning save is now atomic: the annual plan, teacher assignment, and all selected units are stored in one server transaction.
- The coordinator planning form uses one save request instead of a sequence of requests, preventing the live no-refresh renderer from interrupting the form.
- Teacher planning reads plans strictly by teacher account and receives the assignment notification.
- Unit/class/institution validation is performed server-side before commit.
- Failed saves roll back completely, so a half-created annual plan cannot remain.


## V41.5 planning reliability
- Final authoritative teacher annual-planning renderer added after historical overrides.
- Browser cache version bumped to 41.4 with cache-busting asset URLs so old service-worker shells cannot keep stale planning UI.
- Teacher planning reads assigned plans strictly by teacher_id and assigned units by plan_id.
