# ذكاء — تطبيق محادثة ذكية بالعربية

تطبيق محادثة (Chat) بالذكاء الاصطناعي باللغة العربية، مدعوم بنماذج **Claude** من Anthropic، وجاهز للنشر على **Netlify**.

## المميزات
- واجهة عربية كاملة (RTL) بتصميم عصري، تعمل على الجوال والكمبيوتر
- ردود مباشرة (Streaming) تظهر أثناء الكتابة، مع زر إيقاف
- اختيار النموذج: Claude Opus 5.5 (الأذكى) / Sonnet 5.5 (متوازن) / Haiku 4.5 (الأسرع)
- حفظ المحادثات في المتصفح، قائمة جانبية للمحادثات السابقة، حذف محادثة أو الكل
- دعم Markdown: عناوين، قوائم، جداول، كتل كود مع زر نسخ
- الوضع الليلي/النهاري
- مفتاح الـ API محفوظ على الخادم فقط (Netlify Function) ولا يصل للمتصفح

## الهيكل
```
public/chat.html            الواجهة (صفحة /chat)
netlify/functions/chat.mjs  الخادم: POST /api/chat → Claude API (streaming)
netlify.toml                إعدادات Netlify والتوجيه
```

## النشر على Netlify
1. احصل على مفتاح API من https://console.anthropic.com
2. في Netlify: **Add new site → Import from Git** واختر هذا المستودع (الإعدادات تُقرأ تلقائيًا من `netlify.toml`).
3. من **Site configuration → Environment variables** أضف:
   `ANTHROPIC_API_KEY = sk-ant-...`
4. أعد النشر (Deploy) وافتح `https://<موقعك>.netlify.app/chat`

## التشغيل محليًا
```bash
npm install
npm install -g netlify-cli
export ANTHROPIC_API_KEY=sk-ant-...
netlify dev        # ثم افتح http://localhost:8888/chat
```

## التخصيص
- **شخصية المساعد واسمه:** عدّل `SYSTEM_PROMPT` في `netlify/functions/chat.mjs`
- **النماذج المتاحة:** القائمة `MODELS` في نفس الملف + عناصر `<select id="model">` في `chat.html`
- **الاقتراحات في الصفحة الأولى:** المصفوفة `SUGGESTIONS` في `chat.html`
- **الألوان:** متغيرات CSS في أعلى `chat.html` (`--accent` ...)

> ملاحظة: التطبيق لا يحتوي على تسجيل دخول أو حد للاستخدام؛ أي زائر يستطيع استخدامه على حسابك. أضف حماية (مثل Netlify Identity أو حد للطلبات) قبل النشر العام.
