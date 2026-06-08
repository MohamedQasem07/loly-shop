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
accounts, journal_entries, journal_lines, orders, order_items, discounts,
**coupons, shipping_zones, reviews**.
- المخزون الحالي = `products.stock_qty` (cached) + سجل كامل في `stock_movements`.
- التقارير بتتحسب من الحركات والفواتير، مش من أرقام يدوية.
- **`settings`** فيه أعمدة المتجر: `store_open, shipping_fee, store_whatsapp` + الهوية `store_cover_url, store_about, store_instagram, store_facebook, store_tiktok, store_hours` + الولاء `loyalty_enabled, loyalty_earn_egp, loyalty_point_value, loyalty_min_redeem` (متوقّف افتراضياً).
- **`products`** فيه `online`+`online_price` (المتجر) و`images text[]` (معرض صور إضافي، الغلاف في `image_url`) و`colors text[]`+`sizes text[]` (خيارات الأونلاين).
- **`customers.points`** (رصيد نقاط الولاء). **`orders`** فيه `coupon_code, coupon_discount, points_used, governorate`. **`order_items.variant`** (اللون/المقاس المختار أونلاين — مش بيتنقل لـ sale_items).
- **`coupons`** (كود/نسبة-أو-مبلغ/حد أدنى/سقف/عدد استخدام). **`shipping_zones`** (محافظة → سعر). **`reviews`** (تقييم بمراجعة `is_approved`).

## المتجر الأونلاين والحماية للزائر (anon)
- صفحة عامة `#/store` ([Store.tsx](src/pages/Store.tsx)) — الزائر مش بيسجّل دخول.
- **Views للزائر** (كلها **security_invoker** + column-grants، التكلفة/الربح متخفيين): `store_products` (فيها كمان created_at/images/colors/sizes), `store_categories`, `store_discounts`, `store_info` (فيها loyalty_enabled/point_value/min_redeem), `store_shipping`, `store_reviews` (المعتمد بس), `store_product_ratings` (متوسط+عدد). ⚠️ **لو ضفت عمود لأي view لازم تـ`grant select (col)` للـ anon على الجدول الأصلي** — نسيانها بيرجّع 401 للزائر (حصل وانصلح في mig 17).
- **دوال anon (SECURITY DEFINER, search_path=public)**: `track_order`, `validate_coupon(code,subtotal)` + `redeem_coupon(order_no)` (idempotent، مربوط بالأوردر), `customer_points(phone)` (phone-gated), `store_bestsellers(limit)` (ترتيب بس).
- **الأوردرات**: anon INSERT-only على `orders`/`order_items` (RLS: status='new', sale_id null, paid=false, coupon_redeemed=false). منح الإدراج عملياً على مستوى الجدول فالأعمدة الجديدة بتنضم تلقائياً (بس لازم grant صريح للـ select/update). الكوبون/النقاط بتتحقّق وقت الـ checkout، والنقاط بتتخصم وقت تحويل الأوردر لفاتورة (`convertOrderToSale`).
- **التقييمات**: anon بيبعت تقييم **pending** (`is_approved=false`، مش بيقدر يعمله true)، المالك بيراجع في صفحة `Reviews`.
- **صور المنتجات**: Storage bucket عام `product-images` (رفع authenticated، قراءة للكل) — `ImageUpload` ([components/ImageUpload.tsx](src/components/ImageUpload.tsx)) بيرفع ويرجّع الـ public URL.

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
            Reviews, Users, Settings, Store (المتجر العام), Placeholder
```
- **التخطيط (ويب أساسي):** `Layout.tsx` بيملا عرض اللاب توب (`max-w-[1760px]`)، والـ Modal أوسع، والصفحات بتستغل العرض. الموبايل شغّال برضه.
- **Code-splitting:** كل الصفحات `lazy()` في `App.tsx` (كل صفحة chunk لوحدها) + vendor chunks في `vite.config` (react/supabase/dexie/icons). المتجر للزائر بقى ~140kB gzip بدل 313kB. الـ Suspense fallback جوه `Layout` حوالين `<Outlet/>`.
- **إدارة المتجر في `Settings.tsx`:** DiscountsManager + CouponsManager + LoyaltyManager + ShippingZonesManager (كلها بتزامن محلي). والمنتج فيه غلاف + معرض + ألوان/مقاسات.

## الحالة
- **كل الموديولات مكتملة و`npm run build` بيعدّي**: الباك-إند، الدخول، Dashboard، المنتجات، POS (بيع/دفع مقسّم/طباعة إيصال)، استلام البضاعة (متوسط تكلفة مرجّح)، الموردين، العملاء، المصاريف، الخزينة (أرصدة + جلسة كاشير)، التقارير (مبيعات/أرباح/مخزون/طرق دفع/أفضل المنتجات + فلتر فترة)، حركات المخزون، المرتجعات، المستخدمين والصلاحيات، الإعدادات (+ تغيير كلمة المرور).
- **المحاسبة (قيد مزدوج) مكتملة ومتأكد منها**: شجرة حسابات (35 حساب)، ترحيل قيد متوازن تلقائي لكل عملية (`src/data/accounting.ts`)، جرد مستمر + متوسط مرجّح في الـ GL، وصفحة `Accounting` فيها ميزان المراجعة/قائمة الدخل/الميزانية/دفتر الأستاذ/شجرة الحسابات + عمليات (رأس مال/مسحوبات/تحويل/سداد مورد/تحصيل عميل). مفيش ضريبة (0%).
- **منشور أونلاين**: https://mohamedqasem07.github.io/loly-shop/ (GitHub Pages عبر Actions؛ `git push` على main = نشر تلقائي). التطبيق بيستخدم **HashRouter** و`base` من `VITE_BASE` للنشر.
- **POS كاشير حقيقي مكتمل**: باركود/Enter للإضافة، بحث فوري، كمية قابلة للكتابة، آخر الفواتير (طباعة/مرتجع/إلغاء).
- **التجارة الإلكترونية مكتملة بالكامل**: متجر احترافي (صفحة منتج + معرض صور + متعلقة + سلة + checkout)، رفع صور، هوية المتجر، الطلب/التتبّع واتساب، شغل الأوردرات (مراحل + تبليغ + تحويل لفاتورة)، CRM، عروض/خصومات.
- **كل الـ ٨ سبرنتات الجديدة خلصت ونزلت لايف ومتأكد منها (2026-06-08)**:
  ٦ **كوبونات** خصم عند الشراء (`validate/redeem_coupon`) · ٧ **نقاط ولاء** قابلة للتهيئة (كسب على البيع + استبدال في POS والمتجر، متوقّفة افتراضياً) · ٨ **شحن بالمحافظة** (`shipping_zones` + dropdown) · ٩ **ألوان/مقاسات** (أونلاين، متسجّلة في الأوردر) · ١٠ **معرض صور** (`images[]`) · ١١ **تقييمات** بمراجعة (صفحة Reviews + نجوم في المتجر) · ١٢ **أقسام «وصل حديثاً/الأكثر مبيعاً»** (تظهر لو ≥٦ منتجات) · ١٣ **تقسيم الـ bundle** (lazy routes + vendor chunks).
- **اتأكد فعلياً على Supabase**: مسار الـ anon الحقيقي بالـ REST (publishable key) لكل دالة/إدراج، استبدال نقاط في POS (خصم صح)، حلقة التقييم كاملة (إرسال→مراجعة→ظهور)، اختيار variant→سلة، شحن بالمحافظة بيغيّر الإجمالي، وكل الـ migrations نضيفة.
- **مفيش سبرنتات باقية — الـ backlog خلص.** تحسينات اختيارية لو حبّ: كوبون verified-purchase، POS variants، شحن بالمنطقة جوه المحافظة، track_order يطلّع الـ variant.

## ملاحظة Auth (مهمة)
التسجيل العادي **بيفشل** لأن "Confirm email" مفعّل (`mailer_autoconfirm:false`) وإرسال إيميل التأكيد بيفشل، فـ GoTrue بيرجّع رسالة مضلّلة `400: Email address ... is invalid` وبيلغي التسجيل. الكونكتور **مش** بيقدر يغيّر إعداد الـ Auth.
- **الحل اللي محمد لازم يعمله مرة واحدة:** Dashboard → Authentication → Sign In/Providers → Email → يطفّي **"Confirm email"**.
- **في البرنامج:** صفحة المستخدمين فيها فورم **«إضافة موظف»** ([Users.tsx](src/pages/Users.tsx)) بيعمل الحساب بـ `signUp` على عميل Supabase معزول (مايطلّعش الأدمن من حسابه) ويظبط الدور — **بيشتغل بمجرد ما يتطفّى "Confirm email"**.
- الكلاسيفاير بتاع Claude Code بيمنع: قراءة `auth.users` ونشر Edge Functions (من غير إذن صريح). دالة `admin-create-user` (admin API) اتكتبت بس اتمنع نشرها واتشالت.

## ملاحظات تطوير
- النشر: `git push` على `main` = نشر تلقائي (GitHub Actions). الموقع: https://mohamedqasem07.github.io/loly-shop/
- ⚠️ **الـ DB المباشر شغّال مع جهاز محمد التاني (device D62) في نفس الوقت** — أي أوردر/داتا تجريبية بتعملها بتتزامن لجهازه وممكن يحوّلها لفواتير حقيقية على حسابه. **متعملش أوردرات/مبيعات تجريبية على الـ DB المباشر.** للتأكيد: استخدم REST بالـ anon key واحذف فورًا، أو فحص read-only، أو set+revert لعمود منتج بسرعة. (حصل تلوث واتنظّف بالكامل + الميزان رجع صفر).
- **معاينة (preview tools):** `preview_click` (synthetic) **مابيوصلش لـ React onClick** — استخدم `el.click()` (native) جوه `preview_eval`. للـ inputs المتحكَّم فيها React: استخدم native value-setter + `dispatchEvent(new Event('input',{bubbles:true}))` (وللـ select: event 'change'). HMR بيصفّر state المكوّنات وأنت بتعدّل. السكرين شوت بيعلّق أحياناً — اتأكد بـ DOM queries.
- **تأكيد مسار anon الحقيقي:** preview بيشتغل بسيشن المالك (authenticated) مش anon — فاختبر RLS/grants للزائر بـ `curl` بالـ publishable key (curl على ويندوز بيخرّب UTF-8 العربي في `-d`، استخدم ASCII).
- حساب المالك: `mohamedqasem436@gmail.com` (الباسوورد في الذاكرة الخاصة).
