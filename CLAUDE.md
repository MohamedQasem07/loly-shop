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
- **المزامنة** (`src/data/sync.ts`): أي تعديل بيتسجل في جدول `outbox`، وبيترفع لـ Supabase (`pushOutbox`) لما النت يرجع. أول دخول بيسحب كل الجداول (`pullAll`). جهاز واحد → مفيش تعارض. أعمدة `numeric` بترجع نصوص من PostgREST فبنحوّلها أرقام عند السحب.
- **عمليات الأعمال** (`src/data/repo.ts`): `createSale` / `createPurchase` / `addExpense` / `adjustStock` / `voidSale` — كل واحدة بتعدّل المخزون + الخزينة + تسجّل الحركات داخل Dexie transaction واحدة، وتضيف كله للـ outbox.
- **Supabase** = مرآة سحابية + Auth. الجداول والحماية اتعملت بالـ migrations عن طريق الكونكتور.

## الجداول (Supabase / Dexie)
products, categories, suppliers, customers, payment_methods, expense_categories,
sales, sale_items, sale_payments, purchases, purchase_items, returns, return_items,
stock_movements, treasury_movements, cash_sessions, expenses, settings, profiles, audit_logs.
- المخزون الحالي = `products.stock_qty` (cached) + سجل كامل في `stock_movements`.
- التقارير بتتحسب من الحركات والفواتير، مش من أرقام يدوية.

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
  lib/      supabase, db (Dexie), types, format, ids, receipt, cn
  data/     sync (محرك المزامنة), repo (عمليات الكتابة), useSync
  store/    auth (AuthProvider), cart (zustand), ui (toasts)
  components/ Layout, Toaster, ui (Modal/Field/...)
  pages/    Login, Dashboard, Products, POS, Settings, Placeholder
```

## الحالة
- **كل الموديولات مكتملة و`npm run build` بيعدّي**: الباك-إند، الدخول، Dashboard، المنتجات، POS (بيع/دفع مقسّم/طباعة إيصال)، استلام البضاعة (متوسط تكلفة مرجّح)، الموردين، العملاء، المصاريف، الخزينة (أرصدة + جلسة كاشير)، التقارير (مبيعات/أرباح/مخزون/طرق دفع/أفضل المنتجات + فلتر فترة)، حركات المخزون، المرتجعات، المستخدمين والصلاحيات، الإعدادات (+ تغيير كلمة المرور).
- **اتأكد فعلياً**: إنشاء منتج، بيع POS (نقص مخزون + خزينة + حركات)، ومصروف — كلهم اتزامنوا صح على Supabase.
- **الباقي (صقل فقط)**: رفع صور المنتجات (Supabase Storage)، نشر على استضافة عشان يفتح من الموبايل كـ PWA، تقسيم الـ bundle (اختياري)، وتسهيل إضافة موظفين (تأكيد البريد).

## ملاحظة Auth
تأكيد البريد مفعّل في Supabase ومش بيتقفل من الكونكتور. إضافة مستخدم جديد بتحتاج تأكيد البريد، أو نأكّده بـ SQL، أو إطفاء "Confirm email" من الـ Dashboard مرة واحدة.
