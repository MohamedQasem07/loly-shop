# Loly Store Manager 🌸

نظام إدارة محل **Loly Store** (إكسسوارات — مصر). تطبيق ويب / PWA **local-first** يشتغل أوفلاين ويزامن مع Supabase.

A local-first PWA for managing a small accessories shop: POS, inventory, purchases, suppliers, customers, expenses, treasury, and reports.

## المميزات
- 🛒 نقطة بيع سريعة (سلة، دفع مقسّم، طباعة إيصال)
- 📦 منتجات ومخزون + استلام بضاعة (متوسط تكلفة مرجّح)
- 🏢 موردين و 👥 عملاء
- 🧾 مصاريف و 💰 خزينة (أرصدة + جلسة كاشير)
- 📊 تقارير (مبيعات / أرباح / مخزون / طرق دفع)
- 🔄 حركات مخزون ومرتجعات
- 👤 مستخدمين وصلاحيات (Owner / Manager / Cashier / Stock / Viewer)
- 📱 يشتغل أوفلاين ويتثبّت كتطبيق (PWA)

## التشغيل محلياً
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # تجميع للإنتاج
```
انسخ `.env.example` إلى `.env` وحط بيانات Supabase.

## التقنيات
React · Vite · TypeScript · Tailwind CSS · Dexie (IndexedDB) · Supabase · Recharts

---
Built with [Claude Code](https://claude.com/claude-code).
