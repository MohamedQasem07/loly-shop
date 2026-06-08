# Loly Store Manager

نظام إدارة محل **Loly Store** (إكسسوارات — مصر، EGP). تطبيق ويب/PWA يشتغل **أوفلاين** ويزامن مع Supabase.

## التشغيل
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # تجميع للإنتاج
npm run lint     # فحص TypeScript (tsc --noEmit)
```
بيانات الاتصال في `.env` (موجود — مفتاح publishable آمن للواجهة).

## المعمارية — Local-first
- **مصدر الحقيقة محلياً**: كل القراءة/الكتابة على **Dexie/IndexedDB** (`src/lib/db.ts`) → فوري ويشتغل أوفلاين. الواجهة بتقرأ بـ `useLiveQuery` (تفاعلية).
- **المزامنة** (`src/data/sync.ts`): أي تعديل بيتسجل في جدول `outbox`، وبيترفع لـ Supabase (`pushOutbox`) لما النت يرجع. أول دخول بيسحب كل الجداول (`pullAll`). **متعدد الأجهزة** (محمد بيشتغل موبايل + ويب مع بعض): أرقام الفواتير فيها كود جهاز `INV-<deviceCode>-NNNN` (`src/lib/counters.ts`)، و`pushOutbox` صامد (فشل عملية مايوقفش الباقي) ويعيد ترقيم التصادمات تلقائياً، والسحب بيحصل بس لما الـ outbox يفضى عشان الأجهزة تتقارب. أعمدة `numeric` بترجع نصوص من PostgREST فبنحوّلها أرقام عند السحب.
- **عمليات الأعمال** (`src/data/repo.ts`): `createSale` / `createPurchase` / `addExpense` / `adjustStock` / `voidSale` — كل واحدة بتعدّل المخزون + الخزينة + تسجّل الحركات داخل Dexie transaction واحدة، وتضيف كله للـ outbox.
- **Supabase** = مرآة سحابية + Auth. الجداول والحماية اتعملت بالـ migrations عن طريق الكونكتور.

## الجداول (Supabase / Dexie)
products, categories, suppliers, customers, payment_methods, expense_categories,
sales, sale_items, sale_payments, purchases, purchase_items, returns, return_items,
stock_movements, treasury_movements, cash_sessions, expenses, settings, profiles, audit_logs,
accounts, journal_entries, journal_lines, **orders, order_items, discounts**.
- المخزون الحالي = `products.stock_qty` (cached) + سجل كامل في `stock_movements`.
- التقارير بتتحسب من الحركات والفواتير، مش من أرقام يدوية.
- **`settings`** فيه أعمدة المتجر: `store_open, shipping_fee, store_whatsapp` + أعمدة الهوية `store_cover_url, store_about, store_instagram, store_facebook, store_tiktok, store_hours`.
- **`products`** فيه `online` (boolean) + `online_price` للمتجر الأونلاين.

## المتجر الأونلاين والحماية للزائر (anon)
- صفحة عامة `#/store` ([Store.tsx](src/pages/Store.tsx)) — الزائر مش بيسجّل دخول.
- **Views للزائر** (security_invoker + column-grants، التكلفة/الربح متخفيين): `store_products`, `store_categories`, `store_discounts`, `store_info`.
- **الأوردرات**: anon عنده INSERT-only على `orders`/`order_items` (RLS: status='new', sale_id null, paid=false)، والإدراج بـ `return=minimal` (anon ميقدرش يقرا الأوردرات تاني). تتبّع الطلب عبر دالة `track_order(p_order_no, p_phone)` SECURITY DEFINER (anon-callable، بترجع طلب واحد بس لو الرقم+الموبايل متطابقين).
- **صور المنتجات**: Storage bucket عام `product-images` (رفع للـ authenticated بس، قراءة للكل) — `ImageUpload` ([components/ImageUpload.tsx](src/components/ImageUpload.tsx)) بيرفع ويرجّع الـ public URL في `image_url`.

## الحماية والصلاحيات
- RLS على كل الجداول. الموظف النشط بيكتب، الأدمن (owner/manager) بس يمسح، `audit_logs` append-only. دوال `is_admin`/`is_staff` في schema اسمها `private` (مش ظاهرة في الـ API).
- الأدوار: owner / manager / cashier / stock / viewer. أول حساب يتسجّل = owner (trigger `handle_new_user`).
- مفيش service-role key في الواجهة — publishable key بس.

## قواعد لازم تتحافظ
1. مفيش حذف نهائي لفاتورة مكتملة — بنعمل **void** (مع سبب) لا delete.
2. البيع ينقص المخزون ويزوّد الخزينة تلقائياً؛ المرتجع/الإلغاء بيعكس.
3. مايتباعش أكتر من المتاح إلا لو `settings.allow_negative_stock` مفعّل.
4. أرقام الفواتير تسلسلية (INV-000001) — العداد محلي في Dexie `meta`.
5. تكلفة المنتج = **متوسط مرجّح** عند الاستلام.

## هيكل الكود
```
src/
  lib/      supabase, db (Dexie), types, format, ids, receipt, cn, counters, assets
  data/     sync (محرك المزامنة), repo (عمليات الكتابة), accounting (القيد المزدوج), useSync
  store/    auth (AuthProvider), cart (zustand), ui (toasts)
  components/ Layout, Toaster, ImageUpload, ui (Modal/Field/PageHeader/Empty/Spinner)
  pages/    Login, Dashboard, POS, Products, Purchases, StockMovements, Suppliers,
            Customers, Expenses, Treasury, Reports, Returns, Accounting, Orders,
            Users, Settings, Store (المتجر العام), Placeholder
```
- **التخطيط (ويب أساسي):** `Layout.tsx` بيملا عرض اللاب توب (`max-w-[1760px]`)، والـ Modal بقى أوسع، والصفحات بتستغل العرض. الموبايل شغّال برضه.

## الحالة
- **كل الموديولات مكتملة و`npm run build` بيعدّي**: الباك-إند، الدخول، Dashboard، المنتجات، POS (بيع/دفع مقسّم/طباعة إيصال)، استلام البضاعة (متوسط تكلفة مرجّح)، الموردين، العملاء، المصاريف، الخزينة (أرصدة + جلسة كاشير)، التقارير (مبيعات/أرباح/مخزون/طرق دفع/أفضل المنتجات + فلتر فترة)، حركات المخزون، المرتجعات، المستخدمين والصلاحيات، الإعدادات (+ تغيير كلمة المرور).
- **المحاسبة (قيد مزدوج) مكتملة ومتأكد منها**: شجرة حسابات (35 حساب)، ترحيل قيد متوازن تلقائي لكل عملية (`src/data/accounting.ts`)، جرد مستمر + متوسط مرجّح في الـ GL، وصفحة `Accounting` فيها ميزان المراجعة/قائمة الدخل/الميزانية/دفتر الأستاذ/شجرة الحسابات + عمليات (رأس مال/مسحوبات/تحويل/سداد مورد/تحصيل عميل). مفيش ضريبة (0%).
- **منشور أونلاين**: https://mohamedqasem07.github.io/loly-shop/ (GitHub Pages عبر Actions؛ `git push` على main = نشر تلقائي). التطبيق بيستخدم **HashRouter** و`base` من `VITE_BASE` للنشر.
- **POS كاشير حقيقي مكتمل**: باركود/Enter للإضافة، بحث فوري، كمية قابلة للكتابة، آخر الفواتير (طباعة/مرتجع/إلغاء).
- **التجارة الإلكترونية مكتملة ومتأكد منها (سبرنتات 2026-06-08)**: متجر عام احترافي (صفحة منتج كاملة + منتجات متعلقة + سلة + checkout بعمودين)، **رفع صور المنتجات** (Storage)، **هوية المتجر** (غلاف/نبذة/سوشيال/مواعيد + فوتر)، **الطلب عبر واتساب** + **تتبّع الطلب** (RPC آمن)، **شغل الأوردرات** (مراحل + تبليغ واتساب للعميل لكل مرحلة + تحويل لفاتورة)، **CRM للعميل** (تاريخ شراء + LTV + VIP + واتساب)، **إدارة العروض/الخصومات** + شيپ «🔥 عروض».
- **اتأكد فعلياً**: إنشاء منتج، بيع POS (نقص مخزون + خزينة + حركات + **قيد محاسبي متوازن**)، مصروف، رفع صورة لـ Storage، تتبّع طلب، وإنشاء خصم يظهر للزائر — كلهم صح على Supabase.
- **الباقي (سبرنتات جاية — مرتّبة):** (1) أكواد كوبون عند الشراء (محتاج جدول coupons + دالة validate للـ anon). (2) نقاط ولاء/مكافآت للعملاء. (3) شحن حسب المحافظة (قيمة لكل منطقة). (4) ألوان/مقاسات للمنتج (variants). (5) أكتر من صورة للمنتج (عمود `images` + تعديل المعرض). (6) تقييمات المنتجات. (7) أقسام «وصل حديثاً/الأكثر مبيعاً» في المتجر (الأحدث محتاج `created_at` في `store_products`). (8) تقسيم الـ bundle (تحذير 1.1MB) لتسريع التحميل.

## ملاحظة Auth (مهمة)
التسجيل العادي **بيفشل** لأن "Confirm email" مفعّل (`mailer_autoconfirm:false`) وإرسال إيميل التأكيد بيفشل، فـ GoTrue بيرجّع رسالة مضلّلة `400: Email address ... is invalid` وبيلغي التسجيل. الكونكتور **مش** بيقدر يغيّر إعداد الـ Auth.
- **الحل اللي محمد لازم يعمله مرة واحدة:** Dashboard → Authentication → Sign In/Providers → Email → يطفّي **"Confirm email"**.
- **في البرنامج:** صفحة المستخدمين فيها فورم **«إضافة موظف»** ([Users.tsx](src/pages/Users.tsx)) بيعمل الحساب بـ `signUp` على عميل Supabase معزول (مايطلّعش الأدمن من حسابه) ويظبط الدور — **بيشتغل بمجرد ما يتطفّى "Confirm email"**.
- الكلاسيفاير بتاع Claude Code بيمنع: قراءة `auth.users` ونشر Edge Functions (من غير إذن صريح). دالة `admin-create-user` (admin API) اتكتبت بس اتمنع نشرها واتشالت.

## ملاحظات تطوير
- النشر: `git push` على `main` = نشر تلقائي (GitHub Actions). الموقع: https://mohamedqasem07.github.io/loly-shop/
- معاينة (preview tools): `preview_click` ما بيشغّلش `onSubmit` بتاع React — استخدم `form.requestSubmit()`. والسكرين شوت بيعلّق لو فيه Modal مفتوح (backdrop-blur) — اتأكد بـ DOM queries.
- حساب المالك: `mohamedqasem436@gmail.com` (الباسوورد في الذاكرة الخاصة).
