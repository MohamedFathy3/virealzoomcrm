# Viral Zoom ERP

نظام ERP داخلي عربي RTL لوكالة Viral Zoom لإدارة العملاء والخدمات والاشتراكات والمالية ومحافظ الإعلانات والأقسام والموظفين والمهام والتقارير.

## التشغيل

المشروع يعمل عبر Next.js على المنفذ 3000. استخدم `pnpm install` ثم `pnpm dev`. اتصال MySQL المُدار يمر عبر `scripts/with-tls.mjs` لإضافة TLS المطلوب لـ TiDB Cloud دون تخزين الأسرار في الملفات.

## قاعدة البيانات

- `pnpm exec prisma validate` للتحقق من النموذج.
- `pnpm db:push` لتطبيق schema في بيئة التطوير.
- `pnpm db:generate` لتوليد Prisma Client بعد تحديث schema.
- `pnpm db:seed` لإضافة بيانات تطوير واقعية قابلة لإعادة التشغيل.
- `pnpm db:migrate` ثم `pnpm db:generate` لتطبيق migrations وتوليد العميل في النشر.

البيانات المالية تستخدم Decimal. محافظ الإعلانات منفصلة عن إيراد الشركة، ويتم منع الإنفاق الأكبر من الرصيد داخل transaction. عند تسجيل تحصيل مبيعات، تُسجل مبالغ الخدمات كإيراد للشركة، بينما تُضاف ميزانية الإعلان إلى محفظة العميل وسجل الحملة باسمها، ولا تُحتسب كإيراد للشركة. ملف `prisma/migrations/0001_init/migration.sql` هو migration البداية، و`prisma/seed.ts` يزرع سيناريو 10,000 جنيه مستلم و7,500 جنيه منفق و2,500 جنيه متاح.

تسليمات المهام تحفظ PDF والصور محليًا في `storage/uploads/tasks` افتراضيًا، ويمكن تغيير المسار عبر `UPLOADS_DIR`. الملفات لا تُنشر كملفات عامة؛ تنزيلها يتم بعد التحقق من صلاحية صاحب المهمة أو مدير القسم. استخدم قرصًا دائمًا وخذ نسخًا احتياطية من مجلد الرفع في بيئة النشر.

صلاحيات الفريق تعتمد على القسم: موظف المبيعات يرى العملاء الذين سجّلهم فقط، ومدير القسم يرى مهام وأعضاء قسمه، والإدارة وحدها ترى السجلات والمبالغ المالية. عند تسجيل العميل يمكن اختيار عدة خدمات وإدخال السعر المتفق عليه لكل خدمة على حدة؛ يُحسب إجمالي العرض والاشتراكات تلقائيًا من هذه الأسعار، ولا يفرض كتالوج الخدمات سعرًا ثابتًا. لا ينشأ تحصيل تلقائيًا. عرض PDF للطباعة يعرض نطاق الخدمات والإجمالي النهائي فقط. تفاصيل المهمة والتسليمات وملاحظات المراجعة تظهر في صفحة المهمة، مع بقاء الوصول محكومًا بالإسناد أو إدارة القسم أو ملكية عميل المبيعات. بعد إضافة migration جديد، طبّق قاعدة البيانات عبر `pnpm db:migrate`.

## المصادقة

المصادقة داخلية بالكامل عبر البريد الإلكتروني وكلمة المرور، وتُنشأ الجلسة كـ JWT موقع ضمن cookie اسمه `viralzoom_session`. عرّف `APP_SESSION_SECRET` بسلسلة عشوائية لا تقل عن 32 حرفًا، و`AUTH_ADMIN_EMAIL` و`AUTH_ADMIN_PASSWORD` لحساب المدير عند تنفيذ seed. كلمات المرور تُخزن كـ scrypt وليست نصًا واضحًا.

## مسارات مهمة

الصفحات الرئيسية: `/`, `/clients`, `/services`, `/subscriptions`, `/finance`, `/advertising`, `/team`, `/tasks`, `/reports`, `/notifications`, `/settings`.

## وحدة السوشيال ميديا وربط Meta
توجد لوحة الإدارة على `/social-media`، ويمكن لموظف قسم «سوشيال ميديا» والإدارة إدارة الحسابات والمنشورات. يحدد المستخدم المالك إما عميلًا أو شركة Viral Zoom، ويسجل الحسابات اليدوية أو يربط Facebook Pages عبر Meta. صفحة ملف العميل تعرض الحسابات والمنشورات للمصرح لهم، ولا تمنح موظف السوشيال صلاحية للبيانات المالية.

المنشورات تحفظ بموعدها في تقويم داخلي بتوقيت القاهرة؛ لا ينشر النظام المنشور تلقائيًا عند حلول الموعد. يمكن تأكيد النشر يدويًا بعد تنفيذه، أو استخدام «نشر الآن عبر Meta» صراحةً للحساب المتصل. ملفات الرفع خاصة تحت `UPLOADS_DIR` (افتراضيًا `storage/uploads/social/posts`) وتحتاج تخزينًا دائمًا ونسخًا احتياطيًا في بيئة النشر. لا تُفتح الملفات للعامة؛ يستقبلها Meta للنشر عبر رابط HTTPS مؤقت وموقّع فقط. الحد الحالي 8 ملفات للمنشور، 30MB لكل ملف و60MB إجمالًا. Facebook يدعم النص والصور والفيديو المفرد أو مجموعة صور؛ Instagram في هذا التدفق يتطلب حساب Business/Creator مرتبطًا بصفحة Facebook، ويدعم JPG أو فيديو MP4/MOV، مع Carousel حتى 8 عناصر.

### إعداد Meta App
1. أنشئ/اختر تطبيق Meta وأضف منتج **Facebook Login for Business**. أنشئ Login Configuration بالـpermissions والأصول المطلوبة وخذ **Configuration ID**؛ وجود App ID وApp Secret وحدهما لا يكفي.
2. في إعدادات Login Configuration / Valid OAuth Redirect URIs، أضف عنوان callback العام نفسه حرفيًا. المسار الثابت هو `/api/social-media/meta/callback`، مثل `https://crm.example.com/api/social-media/meta/callback`. يجب أن يطابق `META_REDIRECT_URI` حرفيًا بما في ذلك البروتوكول والمسار وأي slash أخير، وأن يكون HTTPS في الإنتاج.
3. اطلب فقط الصلاحيات التي يستخدمها التدفق: `pages_show_list` و`pages_read_engagement` و`pages_manage_posts` و`instagram_basic` و`instagram_content_publish`. أضف `publish_video` إذا احتاج التطبيق نشر فيديوهات Facebook Page. يجب أن يمنح مستخدم Meta للتطبيق صلاحية صفحة مناسبة مثل `CREATE_CONTENT` أو `MANAGE`.
4. احفظ قيم الإعدادات التالية على الخادم فقط، في بيئة التشغيل أو مدير الأسرار، ثم أعد تشغيل الخدمة:

```dotenv
META_APP_ID=...
META_APP_SECRET=...
META_CONFIG_ID=...
META_REDIRECT_URI=https://crm.example.com/api/social-media/meta/callback
META_APP_URL=https://crm.example.com
META_GRAPH_API_VERSION=v27.0
```

`META_APP_URL` هو أصل التطبيق العام (HTTPS بلا مسار أو query)، ويحتاجه Meta لجلب وسائط Instagram مؤقتًا. لا تضع App Secret في ملف واجهة أو متغير `NEXT_PUBLIC_*` أو GitHub أو رسالة دردشة. يُستخدم `APP_SESSION_SECRET` أيضًا لتشفير كلمات مرور الحسابات وPage tokens وتوقيع روابط الوسائط؛ يجب أن يكون بطول 32 حرفًا على الأقل وأن يبقى ثابتًا بعد حفظ الحسابات، لأن تغييره يمنع فك تشفير البيانات الموجودة. لا تغيّر Graph API version إلا إلى إصدار يدعمه تطبيق Meta لديك.

تدفق Instagram هذا يستخدم Facebook Login: الحساب يجب أن يكون Instagram Professional من نوع Business أو Creator ومربوطًا بصفحة Facebook يستطيع المستخدم الوصول إليها. الحسابات الشخصية غير المدعومة أو حسابات Instagram غير المرتبطة بصفحة تحتاج تدفق Instagram Login منفصلًا غير موجود هنا. Standard Access مناسب للاختبار داخل أدوار/أصول التطبيق؛ أما ربط حسابات عملاء خارج هذا النطاق فيتطلب عادةً Advanced Access ومراجعة التطبيق، وقد يتطلب Business Verification والوفاء بمتطلبات Meta للخصوصية ومعالجة البيانات. راجع حالة الصلاحيات في Meta App Dashboard قبل اعتماد الربط مع عملاء خارجيين.

### Migration
أُنشئت migration فرقية بوصفها ملفًا محليًا في `prisma/migrations/0008_social_media_meta/migration.sql`. لم تُطبّق على قاعدة البيانات المشتركة. بعد مراجعتها وأخذ موافقة مالك البيئة، تُطبق بالطريقة المعتادة عبر `pnpm db:migrate`؛ أما `pnpm db:generate` فيولد Prisma Client فقط ولا يغيّر بيانات قاعدة البيانات.

روابط Meta الرسمية: [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)، [Instagram Platform overview](https://developers.facebook.com/documentation/instagram-platform/overview)، [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing)، [بدء Instagram API مع Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started)، و[Graph API changelog](https://developers.facebook.com/documentation/development/graph-api/changelog). الإصدار الافتراضي `v27.0` هو أحدث إصدار بحسب سجل Meta وقت إعداد هذه الوحدة؛ راجع السجل الرسمي قبل تحديثه مستقبلًا.
