// ============================================================
// 英文版静态文案覆盖层（Static English overlay）
//
// 这份文件是「简/EN」切换功能用的英文文案，来源是 Amy 确认过的
// Claude Docs 翻译草稿（已对照 9/22 Supabase 线上最新内容重翻、
// 并按 Amy 要求做过白话 QC）。
//
// 重要：这是「静态覆盖」，不是跟着 Supabase 自动同步的翻译。
// 之后如果在後台（admin.js）改了中文文案，这份文件不会自动跟着变——
// 要跟 Claude 说一声，再手动更新这份文件对应的英文。
//
// EN_CONTENT 的 key 对应 content.js 的 DEFAULT_CONTENT 结构，
// 只放「真的需要翻译的文字栏位」；图片、连结、Email/电话/地址、
// layout 顺序这些不分语言、两种语言显示一样，所以不放在这里，
// site.js 会自动保留原本（中文版）的值。
//
// 找不到对应英文的栏位（例如 milestones.subtitle、closing、team_building.subtitle
// 目前都还是空白或还没请 Amy 确认要不要翻），site.js 会自动 fallback 显示中文，
// 不会显示空白或报错。
// ============================================================
const EN_CONTENT = {
  hero: {
    title: "The AI Era | A New Way to Build Your Business",
    lede: "As AI changes the way business gets done, will you keep up — or get left behind?",
    intro: "Starting a business today doesn't have to mean doing everything yourself. From creating content and talking to customers, to learning, running things, and growing a team — AI's becoming a bigger part of how we get it all done, helping us pull off in new ways what used to take a ton of time and experience.<br><br>MAE GLOBAL's been at this for 9 years now, building up our brand, products, markets, and team along the way. <strong>Now we're taking AI even further into how we help partners grow — mixing training, content, community, and AI tools to help you go from \"starting out\" to \"growing\" to \"leading,\" one step at a time.</strong> Because building a business today isn't just about what one person can do — it's about knowing how to use the right tools, systems, and the power of a team.",
    button: "Check Out the MAE Opportunity"
  },
  kate: {
    quote: "A single wish to help more people become better — that's how MAE began.",
    p1: "In 2017, Kate Yong founded MAE GLOBAL.<br><br>At first, she just wanted to build a brand that was truly Malaysian — one that got quality, health, and beauty all right.<br><br>She believes real beauty isn't just about how you look. It's about health, confidence, and finally accepting yourself. That's the belief everything MAE has grown into started from.",
    p2: "From a brand to a platform<br><br>MAE's kept changing over the past 9 years.<br><br>From our first health and beauty products to skincare, anti-aging, wellness, and hair care, we've grown step by step into different categories.<br><br>But for Kate, growing MAE was never just about having more products.<br><br>What she really wanted was for this brand to help people \"become better.\"<br><br>A place where customers can find health and beauty,<br>and a place where partners can learn, grow, and build a business of their own.",
    p3: "And now, MAE's moving into a new stage<br><br>Over these 9 years, the world's changed, customers have changed, and so has the way people build a business.<br><br>So today, MAE isn't just about making great products — it's also about bringing together education, content, online and offline experiences, a business-building system, and AI tools.<br><br>From \"what we sell\" to \"how we help more people.\"<br><br>From a health and beauty brand to a business platform that grows alongside its partners.",
    p4: "Along the way, Kate's dedication to the brand kept getting noticed — from women-in-business awards to the Malaysia Book of Records, the Platinum Business Awards 2022, The Star SOBA 2022, and a Top 10 Outstanding Young Malaysians nomination. Each one marks another step in her journey from founder to brand leader. <strong>But awards are just milestones — what's really carried MAE to where it is today is the same mission that's never changed.</strong>",
    signature: "Kate Yong · Founder of MAE Global · Leading 3,000+ Partners"
    // p5 / p6：目前中文版是空白，暂无英文版
  },
  opportunity: {
    p1: "Many people think AI is still far away. In reality, it's already changing who gets seen, who gets trusted, who gets remembered.",
    p2: "You don't need to understand the technology, and you don't need to teach yourself from scratch. MAE has a complete system — the aMAEzing AI GROW System — that turns everything from ads, content, and personal branding to team growth and leadership into a path you can follow step by step.",
    p3: "This isn't about making a bit of extra cash. It's about whether you're going to give yourself a shot at keeping up with the times."
  },
  system: {
    subtitle: "A complete system that keeps you growing from newcomer to leader — wherever you start, there's always a clear next step.",
    footnote: "This system isn't about learning five things all at once — it's about moving through stages: start, grow, then become someone who can lead others. AI is with you at every step.",
    stages: [
      { title: "Getting Started", body: "Today, the only goal is not getting lost. In your first 30 days, we lay out direction, mindset, and the basics clearly — you'll know exactly what to learn and do each day, instead of figuring it out alone. By the end of this stage, you'll move into the next one with a clear sense of direction." },
      { title: "Ad Growth", body: "Once you have direction, the next step is getting seen. No need to hire anyone or learn complicated software — AI AdsPro walks you through using AI to create ads that actually bring in enquiries and customers, turning online visibility into offline sales, so growth follows naturally." },
      { title: "Content Engine", body: "Once ads bring in traffic, it's the content that actually makes people stay. This stage teaches you to use AI to build your own content style and establish your personal brand — instead of chasing people, the right people are drawn to come find you." },
      { title: "Closing & Recruitment", body: "Not about pressuring people with sales scripts — it's about building trust the right way, so people choose to join naturally. From \"we click\" to \"I'm in,\" turning interest into real results." },
      { title: "Team Leadership", body: "Turning one person's ability into a whole team's ability — learning to replicate the system, develop others, and build a team that can carry on without depending on just you." }
    ]
  },
  highlights: {
    items: [
      { title: "Start With Just a Phone", desc: "No extra equipment, no technical background needed" },
      { title: "Freedom of Time", desc: "Just 2 hours a day, using pockets of spare time" },
      { title: "AI Helps You Move Faster", desc: "From content and copywriting to customer communication, use AI to cut repetitive work and save your time for what really matters." },
      { title: "One Platform, Many Possibilities", desc: "From Malaysia to Singapore, Hong Kong, and Brunei — connecting different markets to give your business more room to grow." }
    ]
  },
  brand: {
    stat1_label: "Brand Founded",
    stat2_label: "Product Lines",
    stat3_label: "Markets",
    p1: "MAE Global was founded in 2017, and we've stuck to our 3E philosophy from day one — Extraordinary, Elegant, Enthusiasm — using great products to help people feel more confident and comfortable in their own skin.",
    p2: "Our product line spans 4 series across health, skincare, eye care, and hair care, and in 2025 we partnered with Universiti Malaya's Nanocat department on functional research into our product ingredients.",
    p3: "Several MAE products are certified by the Malaysia Book of Records, and we've also picked up awards like the Star SOBA Young Entrepreneur Award and the Malaysia G Forty Top 40 Corporate Achievement Award. We've now grown across Malaysia, Singapore, Hong Kong, and Brunei, and we're still growing as a health-and-beauty brand across Southeast Asia."
  },
  milestones: {
    title: "MAE in Your Life",
    // subtitle：翻译草稿目前还没做这一栏，先 fallback 显示中文
    captions: [
      "Since 2022 – Smiles of Beauty, 10+ stops · Visiting 10+ nursing homes to bring time and warmth to every elder",
      "2023 – Above the Clouds at Genting, letting every bit of beauty and confidence shine",
      "2024 – Held the Beauty Festival in Putrajaya · Won the MBR title for Largest Self Love Theme Outdoor Event",
      "2025 – MAE X Universiti Malaya · Launched a clinical research partnership with UM to drive beauty innovation through science and evidence",
      "2025 – Touring the city in the Kombi Van, bringing MAE's beauty and energy to more people",
      "2025 – Beauty Festival KL · Bringing beauty, confidence, and energy together in the heart of the city, making every encounter a memory worth keeping",
      "2025 – Beauty Festival HK · From Malaysia to Hong Kong, connecting people across cities through beauty and confidence",
      "2025 – Shine Bright Pink October 5KM Fun Run · Over 3,000 people running for love together, lighting up the whole event in pink"
    ]
  },
  event: {
    title: "Come Learn About the MAE Opportunity!",
    subtitle: "To keep the quality of the session high, spots are limited — first come, first served!",
    date: "September 28 (Monday)",
    time: "8:00 PM – 10:00 PM",
    place: "Online via Zoom",
    timezone: "Malaysia & Singapore (GMT+8)"
  },
  results: {
    title: "They Grew Through the MAE Opportunity",
    items: [
      { who: "Full-Time Mum", quote: "Life felt stable, but I was afraid of staying stuck in place. After joining MAE, I gained more than income — I learned to grow, push past my limits, and rediscover possibilities I didn't know I had." },
      { who: "From Part-Time to Full-Time MAE", quote: "From physiotherapist to MAE Partner. Having gone through her own struggles with skin issues and low self-esteem, she wanted to turn that experience into a force that helps more women find their confidence again." },
      { who: "E-commerce Beginner", quote: "From someone afraid to speak up or be seen, to someone who dares to express herself and challenge herself today. Along the way, I didn't become someone else — I slowly became a better version of myself. From \"I can't\" to \"I can.\"" },
      { who: "Where She Found a Sense of Belonging", quote: "What started as just a part-time try-out led her into a whole new possibility. From joining a workshop in Singapore to feeling the team's support along the way, she found that MAE gave her more than a business — it gave her an environment where she keeps growing." },
      { who: "40+ Can Still Make a Comeback", quote: "At 40, you can still start over.<br>From who she used to be to who she is now, she proved that age is not a limit — dare to change, and life always holds new possibilities." },
      { who: "Reflections After the AI Course", quote: "I used to think AI was complicated — but after taking the course, I realized what really needed to change wasn't how I work, but how I think.<br>Things that used to take a lot of time can now be done much faster with AI's help; not knowing how to write, where to start, or lacking inspiration is no longer a reason to stop." }
    ]
  },
  incentive_trip: {
    title: "Incentive Trip",
    subtitle: "Hard work deserves to be seen — this is the spotlight moment for MAE partners."
  },
  team_building: {
    title: "Education-Focused · Nurturing Talent"
    // subtitle：目前中文版是空白，两种语言都是空白
  },
  faq: {
    good: [
      "Looking for an income source you can build in your spare time, without affecting your day job",
      "Anyone interested in health and beauty",
      "Anyone who enjoys sharing and connecting with people",
      "Anyone who wants to try online marketing but doesn't know where to start",
      "Anyone curious about AI who wants to actually learn how to use it",
      "Anyone who wants to build a personal brand or influence, but is missing a proven method and system",
      "Full-time mums who want to reclaim a sense of achievement and income that's truly their own"
    ],
    bad: [
      "Anyone looking for a free ride or a get-rich-quick scheme",
      "Anyone completely unwilling to invest time in learning and taking action",
      "Anyone who already has a very clear plan and has no interest in changing it"
    ],
    items: [
      { q: "Is there a fee to attend?", a: "No, this session is completely free." },
      { q: "I know nothing about AI — is that okay?", a: "Yes. The aMAEzing AI GROW System is designed for complete beginners — just follow it step by step, no technical background needed." },
      { q: "Is this just about constantly recruiting people?", a: "No. The products and the system have real value on their own — you share them because you genuinely find them useful. Building a team is entirely your own choice, never a requirement." },
      { q: "I already have a full-time job — what if I don't have enough time?", a: "Many of our partners started with just their spare time — all you need is a phone, and there's no need to quit your job right away. Most people manage with just 2 hours a day." },
      { q: "I'm a bit older / more traditional — can I really learn AI?", a: "Yes, and it's easy to pick up — the system is designed for people who've never touched AI before, so you won't have to figure it out alone; someone will guide you step by step." },
      { q: "Can I bring family or friends along?", a: "Of course — everyone's welcome to come learn together." },
      { q: "Do I need to stock up on inventory?", a: "No. Start as a user first — sharing your genuine experience is the first step." }
    ]
  },
  register: {
    p1: "Want to understand how MAE × AI can help you start your own business?<br>Join our online business sharing session, and we'll walk you through the entire system step by step. (Note: the session is conducted in Mandarin.)",
    p2: "No need to rush a decision — just spend 2 hours understanding it first, then decide if this is the opportunity you've been looking for.",
    button: "Register for the Business Sharing Session"
  }
};

// ============================================================
// 网站上「不是从 Supabase 内容画出来的」固定文字（按钮、栏位标签、
// 表单讯息、倒数计时文字等），英文版对照表。
// key 会对应 index.html 里 data-i18n="key" 的元素，或者 site.js
// 里直接用 UI_STRINGS_EN.xxx 读取。
// ============================================================
const UI_STRINGS_EN = {
  doc_title: "MAE GLOBAL — AI Business Sharing Session Registration",
  nav_register: "Register Now",
  brand_section_title: "MAE Brand Credentials",
  faq_audience_title: "Who's This For",
  faq_audience_sub: "This session is especially great for:",
  faq_good_heading: "✅ Great Fit",
  faq_bad_heading: "❌ Probably Not",
  faq_section_title: "FAQ",
  footer_contact_heading: "Contact Us",
  footer_follow_heading: "Follow Us",
  event_label_date: "Date",
  event_label_time: "Time",
  event_label_place: "Location",
  event_label_timezone: "Timezone",
  form_label_name: "Name",
  form_label_email: "Email",
  form_label_phone: "Phone / WhatsApp",
  form_label_city: "City / Region",
  form_label_intent: "What are you most curious about?",
  form_option_placeholder: "Please select",
  form_option_1: "Seriously considering starting a business / joining",
  form_option_2: "Looking to grow a side income",
  form_option_3: "Just here to learn more, haven't decided yet",
  form_msg_ok: "Thanks for registering! We've got your details and will be in touch before the event.",
  form_msg_dup: "Looks like this email's already registered — we've got your info and will reach out soon!",
  form_msg_err: "Something went wrong — please try again shortly, or reach us directly on WhatsApp.",
  form_submit_loading: "Submitting...",
  hero_lang_note: "This session will be conducted in Mandarin.",
  hero_bg_placeholder: "[ Hero background photo: landscape recommended, 1600×1000px+, keep the subject away from the edges ]",
  kate_photo_placeholder: "[ Kate — Founder photo ]",
  highlights_photo_placeholder: "[ Photo: portrait orientation recommended, e.g. Kate or team photo ]",
  brand_no_photos: "[ No photos uploaded yet ]",
  milestone_photo_prefix: "Milestone Photo",
  countdown_label: "⏰ Next session starts in",
  countdown_days: "DAYS",
  countdown_hours: "HRS",
  countdown_mins: "MIN",
  countdown_secs: "SEC",
  countdown_started: "⏰ Starting soon!",
  register_counter_prefix: "🔥",
  register_counter_suffix: "people have registered",
  ig_fallback_link: "📎 View this Instagram post →",
  results_who_note: "(Photo/video used with permission)",
  agent_invite_fallback: "Meet MAE",
  agent_invite_named_suffix: "invites you to meet MAE",
  grow_stage_prefix: "Stage"
};
