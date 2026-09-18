// ============================================================
// 前台页面逻辑：
// 1. 先用 content.js 里的预设文案画面
// 2. 去 Supabase 的 page_content 表拿 admin 后台存的内容，盖上去
// 3. 处理报名表单，写进 Supabase 的 registrations 表
// 4. 记录网址上带的代理专属代码（?ref=会员编号），一起存进报名资料，
//    方便之后招商 Dashboard 那边统计每个代理带来了几个人（COT Connector 排行榜用）
// ============================================================

// 抓网址上的参数（?ref=会员编号、?utm_source=、?utm_medium=）。
// ref 统一转大写；三个都会去空白、限制长度，避免奇怪的输入。抓不到就是 null。
function getUrlParam(name, { upper = false, maxLen = 60 } = {}) {
  try {
    let raw = (new URLSearchParams(window.location.search).get(name) || "").trim().slice(0, maxLen);
    if (upper) raw = raw.toUpperCase();
    return raw || null;
  } catch (e) {
    return null;
  }
}

const AGENT_CODE = getUrlParam("ref", { upper: true, maxLen: 40 });
const UTM_SOURCE = getUrlParam("utm_source");
const UTM_MEDIUM = getUrlParam("utm_medium");

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

// 跟 setText 一样，但用 innerHTML 塞进去（后台「加粗/底线/斜体/字号/颜色」这些格式
// 存进来的内容会带 <b>/<u>/<i>/<span style="..."> 这类标签，用 textContent 会把标签原样当文字显示出来，
// 所以要用 innerHTML 才会正确显示格式）。
// 这里可以放心用 innerHTML：后台 admin.js 的 sanitizeRichText() 已经把内容清过，
// 只会剩下 b/strong/u/i/em/br/span（而且 span 只允许我们自己定义的字号/颜色），没有 script 之类的东西。
function setRichText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.innerHTML = value;
}

function setHref(id, hrefPrefix, value) {
  const el = document.getElementById(id);
  if (el && value) {
    el.textContent = value;
    el.setAttribute("href", hrefPrefix + value);
  }
}

// 把某个占位框换成真正的照片（如果 admin 后台已经上传了图片网址）；
// 没有上传过的话，就还原成原本的占位提示文字。
function setMedia(id, url) {
  const el = document.getElementById(id);
  if (!el) return;
  if (url) {
    el.innerHTML = `<img src="${url}" alt="">`;
  } else {
    const placeholder = el.getAttribute("data-placeholder") || "";
    el.textContent = placeholder;
  }
}

// MAE 品牌背书的照片：优先用新版的 images 清单；如果还是旧资料（清单是空的，
// 但旧的 3 个固定栏位有值），就从旧栏位自动组一份出来，照片不会因为改版而不见。
function migrateBrandImages(brand) {
  if (Array.isArray(brand.images) && brand.images.length) return brand.images;
  return [brand.logo_image, brand.product_image, brand.cert_image].filter(Boolean);
}

// 倒数计时：从 event.sessions 这个日期时间清单里，挑「还没开始、离现在最近」的一场，
// 每 30 秒更新一次「还剩 X 天 X 小时 X 分钟」。全部当作马来西亚/新加坡（GMT+8）时间处理。
let countdownTimer = null;
function renderCountdown(sessions) {
  const el = document.getElementById("event-countdown");
  if (!el) return;

  const upcoming = (sessions || [])
    .filter(Boolean)
    .map(s => new Date(s.length === 16 ? s + ":00+08:00" : s))
    .filter(d => !isNaN(d.getTime()) && d.getTime() > Date.now())
    .sort((a, b) => a - b);

  clearInterval(countdownTimer);

  if (!upcoming.length) {
    el.hidden = true;
    return;
  }

  const target = upcoming[0];
  el.hidden = false;

  function tick() {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = "⏰ 分享会即将开始！";
      clearInterval(countdownTimer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    el.textContent = `⏰ 距离最近一场分享会还有 ${d} 天 ${h} 小时 ${m} 分钟`;
  }
  tick();
  countdownTimer = setInterval(tick, 30000);
}

// 「已有 XX 人报名」计数器：只有 register.show_counter 打开才会显示。
async function renderRegisterCounter(show) {
  const el = document.getElementById("register-counter");
  if (!el) return;
  if (!show) {
    el.hidden = true;
    return;
  }
  try {
    const { data, error } = await supabaseClient.from("registration_total_count").select("total").single();
    if (error) throw error;
    el.hidden = false;
    el.textContent = `🔥 已有 ${data.total} 人报名`;
  } catch (err) {
    el.hidden = true;
  }
}

// 后台「网站排版」存的顺序清单，可能是在某个新板块（例如 incentive_trip）上线「之前」存的，
// 清单里当然不会有这个新 key。这个函数把「预设清单里有、但这份（可能是旧的）清单里没有」
// 的 key 补进去——补在它在预设清单里最近的、「前一个也在这份清单里」的 key 后面，
// 而不是漏掉不处理（漏掉的话，下面 applyLayout 逐个 appendChild 重新排列时，
// 没被点名的板块会被晾在最前面，跑到 Hero 前面去，不是它该在的位置）。
function mergeLayoutOrder(savedOrder) {
  const defaultOrder = DEFAULT_CONTENT.layout.order;
  const order = (savedOrder && savedOrder.length) ? savedOrder.slice() : defaultOrder.slice();
  const missing = defaultOrder.filter(k => order.indexOf(k) === -1);
  missing.forEach(key => {
    const defaultIdx = defaultOrder.indexOf(key);
    let insertAfter = -1;
    for (let i = defaultIdx - 1; i >= 0; i--) {
      const idx = order.indexOf(defaultOrder[i]);
      if (idx !== -1) { insertAfter = idx; break; }
    }
    order.splice(insertAfter + 1, 0, key);
  });
  return order;
}

// 把板块按照后台设定的顺序排好、该隐藏的隐藏。找不到设定就维持网页原本的顺序。
function applyLayout(layout) {
  const main = document.getElementById("page-sections");
  if (!main) return;
  const order = mergeLayoutOrder(layout && layout.order);
  const hidden = (layout && layout.hidden) || [];
  order.forEach(key => {
    const el = main.querySelector(`[data-section-key="${key}"]`);
    if (!el) return;
    main.appendChild(el);
    el.hidden = hidden.includes(key);
  });
  // 代理邀请卡片不属于后台可拖拽的板块，固定紧跟在 Hero 后面显示，
  // 不管 Hero 有没有被拖到别的位置，都重新贴到它后面。
  const heroEl = main.querySelector('[data-section-key="hero"]');
  const inviteEl = document.getElementById("agent-invite-card");
  if (heroEl && inviteEl) heroEl.insertAdjacentElement("afterend", inviteEl);
}

// 「XXX 邀请你认识 MAE」动态邀请卡片：
// 只有透过代理专属连接（网址带 ?ref=）打开、而且这个代理已经在
// agent-profile.html 填过自我介绍时才会显示；没有 ?ref=，或者这个
// 代码还没填过资料，卡片保持隐藏，不会出现空卡片。
async function renderAgentInviteCard() {
  const el = document.getElementById("agent-invite-card");
  if (!el || !AGENT_CODE) return;

  try {
    const { data, error } = await supabaseClient
      .from("agent_profiles")
      .select("name, intro, photo_url")
      .eq("code", AGENT_CODE)
      .maybeSingle();
    if (error) throw error;
    if (!data || (!data.name && !data.intro && !data.photo_url)) return;

    const name = (data.name || "").trim();
    setText("agent-invite-title", name ? `${name} 邀请你认识 MAE` : "邀请你认识 MAE");
    setText("agent-invite-intro", data.intro || "");

    const photoEl = document.getElementById("agent-invite-photo");
    if (data.photo_url) {
      photoEl.innerHTML = `<img src="${data.photo_url}" alt="">`;
    } else {
      photoEl.textContent = name ? name.charAt(0).toUpperCase() : "M";
    }

    el.hidden = false;
  } catch (err) {
    console.warn("读取代理自我介绍失败，卡片保持隐藏：", err.message);
  }
}

// ============================================================
// GROW System 手风琴：5 个阶段一次展开一张。
// 预设「自动轮播」，电脑版滑鼠移过去哪张、手机版点哪张，就手动展开那张、
// 同时永久停止自动轮播（用户已经自己在操作了，不用再帮他跳来跳去）。
// 阶段四、五（content.js 的 locked:true）会变灰阶、加锁头 + Coming Soon 标签。
// ============================================================
const GROW_STAGE_META = [
  { cls: "p1", tagText: "阶段一", icon: "rocket" },
  { cls: "p2", tagText: "阶段二", icon: "megaphone" },
  { cls: "p3", tagText: "阶段三", icon: "pencil" },
  { cls: "p4", tagText: "阶段四", icon: "target" },
  { cls: "p5", tagText: "阶段五", icon: "crown" }
];
let growStages = null;
let growExpandedIndex = 0;
let growAutoTimer = null;
let growAutoStopped = false;

function renderGrowAccordion(stages) {
  const wrap = document.getElementById("grow-accordion");
  if (!wrap || !Array.isArray(stages) || !stages.length) return;
  growStages = stages;

  wrap.innerHTML = stages.map((s, i) => {
    const meta = GROW_STAGE_META[i] || GROW_STAGE_META[GROW_STAGE_META.length - 1];
    const expanded = i === growExpandedIndex;
    const lockBadge = s.locked ? `<div class="lock-badge">🔒</div>` : "";
    let inner;
    if (expanded) {
      const soon = s.locked ? `<div class="coming-soon">Coming Soon</div>` : "";
      inner = `
        <img class="panel-icon" src="icons/${meta.icon}.png" alt="">
        <div class="panel-content">
          <div class="module">${s.module || ""}</div>
          <h3>${s.title || ""}</h3>
          <div class="benefit-body">${s.body || ""}</div>
          ${soon}
        </div>`;
    } else {
      inner = `<span class="collapsed-label">${s.module || ""}</span>`;
    }
    return `<div class="panel ${meta.cls}${expanded ? " expanded" : ""}" data-idx="${i}">
      <span class="stage-tag">${meta.tagText}</span>
      ${lockBadge}
      ${inner}
    </div>`;
  }).join("");

  wrap.querySelectorAll(".panel").forEach(panel => {
    panel.addEventListener("click", () => setGrowExpanded(Number(panel.getAttribute("data-idx"))));
  });
  if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    wrap.querySelectorAll(".panel").forEach(panel => {
      panel.addEventListener("mouseenter", () => setGrowExpanded(Number(panel.getAttribute("data-idx"))));
    });
  }

  startGrowAutoRotate();
}

// 用户自己点/hover 切换过一次之后，就不再自动跳，让他好好看内容。
function setGrowExpanded(idx) {
  if (idx === growExpandedIndex || !growStages) return;
  growExpandedIndex = idx;
  growAutoStopped = true;
  if (growAutoTimer) { clearInterval(growAutoTimer); growAutoTimer = null; }
  renderGrowAccordion(growStages);
}

function startGrowAutoRotate() {
  if (growAutoTimer || growAutoStopped || !growStages || growStages.length < 2) return;
  growAutoTimer = setInterval(() => {
    growExpandedIndex = (growExpandedIndex + 1) % growStages.length;
    renderGrowAccordion(growStages);
  }, 3800);
}

function render(content) {
  const c = content;

  // Hero
  setText("hero-title", c.hero.title);
  setRichText("hero-lede", c.hero.lede);
  setRichText("hero-intro", c.hero.intro);
  setText("hero-button", c.hero.button);
  setMedia("hero-media", c.hero.image);
  // Hero 照片改成满版背景 + 文字覆盖：有上传照片才加 has-photo（白字 + 深色遮罩），
  // 没上传维持原本淡紫色底 + 深色字，避免占位提示文字被深色遮罩盖到看不见。
  document.querySelector(".hero")?.classList.toggle("has-photo", !!c.hero.image);

  // Kate 创办人
  setMedia("kate-media", c.kate.image);
  setText("kate-quote", c.kate.quote);
  setRichText("kate-p1", c.kate.p1);
  setRichText("kate-p2", c.kate.p2);
  setRichText("kate-p3", c.kate.p3);
  setText("kate-signature", c.kate.signature);
  setRichText("kate-p4", c.kate.p4);
  setRichText("kate-p5", c.kate.p5);
  setRichText("kate-p6", c.kate.p6);

  // 机会重新框定
  setRichText("opp-p1", c.opportunity.p1);
  setRichText("opp-p2", c.opportunity.p2);
  setRichText("opp-p3", c.opportunity.p3);

  // GROW System
  setText("system-title", c.system.title);
  setRichText("system-subtitle", c.system.subtitle);
  setRichText("system-footnote", c.system.footnote);
  renderGrowAccordion(c.system.stages);

  // Highlights
  const hg = document.getElementById("highlights-grid");
  hg.innerHTML = (Array.isArray(c.highlights) ? c.highlights : DEFAULT_CONTENT.highlights).map(h => `
    <div class="highlight-card">
      <div class="emoji-badge">${h.emoji}</div>
      <h4>${h.title}</h4>
      <p>${h.desc}</p>
    </div>`).join("");

  // Brand credibility
  setText("brand-stat1-value", c.brand.stat1_value);
  setText("brand-stat1-label", c.brand.stat1_label);
  setText("brand-stat2-value", c.brand.stat2_value);
  setText("brand-stat2-label", c.brand.stat2_label);
  setText("brand-stat3-value", c.brand.stat3_value);
  setText("brand-stat3-label", c.brand.stat3_label);
  setRichText("brand-p1", c.brand.p1);
  setRichText("brand-p2", c.brand.p2);
  setRichText("brand-p3", c.brand.p3);
  const brandImages = migrateBrandImages(c.brand);
  const brandGrid = document.getElementById("brand-images-grid");
  if (brandGrid) {
    brandGrid.innerHTML = brandImages.length
      ? brandImages.map(url => `<div class="media-slot"><img src="${url}" alt=""></div>`).join("")
      : `<div class="media-slot">[ 尚未上传照片 ]</div>`;
  }

  // Milestones
  setText("milestones-title", c.milestones.title);
  setRichText("milestones-subtitle", c.milestones.subtitle);
  const mg = document.getElementById("milestones-grid");
  const milestoneImages = c.milestones.images || [];
  mg.innerHTML = c.milestones.captions.map((cap, i) => {
    const img = milestoneImages[i];
    const media = img
      ? `<div class="media-slot wide"><img src="${img}" alt=""></div>`
      : `<div class="media-slot wide">[ Milestone 照片 ${i + 1} ]</div>`;
    return `
    <figure class="gallery-item">
      ${media}
      <figcaption>${cap}</figcaption>
    </figure>`;
  }).join("");

  // Event
  setText("event-title", c.event.title);
  setRichText("event-subtitle", c.event.subtitle);
  setText("event-date", c.event.date);
  setText("event-time", c.event.time);
  setText("event-place", c.event.place);
  setText("event-timezone", c.event.timezone);
  renderCountdown(c.event.sessions);

  // Results / reviews：每一条见证现在直接用 Instagram 官方嵌入组件画出真实的影片/贴文，
  // 不再是照片 + 另外一个「查看 IG 原帖」连结。
  setText("results-title", c.results.title);
  const resultsWarningEl = document.getElementById("results-warning");
  if (resultsWarningEl) {
    setRichText("results-warning", c.results.warning);
    resultsWarningEl.hidden = !c.results.warning;
  }
  const rg = document.getElementById("results-grid");
  rg.innerHTML = c.results.items.map(r => {
    const embed = r.ig_link
      ? `<div class="review-embed"><blockquote class="instagram-media" data-instgrm-permalink="${r.ig_link}" data-instgrm-version="14"></blockquote></div>`
      : `<div class="review-embed">🖼️</div>`;
    return `
    <div class="review-card card">
      ${embed}
      <blockquote>"${r.quote}"</blockquote>
      <div class="who">${r.who} <span style="font-weight:400;color:var(--muted);">（照片/影片经本人同意后使用）</span></div>
    </div>`;
  }).join("");
  // Instagram 的 embed.js 只会自动处理「脚本跑的时候」页面上已经有的 blockquote，
  // 这些见证卡片是内容从 Supabase 读回来之后才动态画上去的，所以每次画完都要手动
  // 叫它重新处理一次，不然新画出来的卡片只会是没有样式的空白 blockquote。
  // embed.js 本身也是 async 载入的，画面出来的时候它可能都还没载入完，所以载入完成前先轮询等它。
  if (window.instgrm && window.instgrm.Embeds) {
    window.instgrm.Embeds.process();
  } else {
    let igEmbedTries = 0;
    const igEmbedWait = setInterval(() => {
      igEmbedTries++;
      if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
        clearInterval(igEmbedWait);
      } else if (igEmbedTries > 20) {
        clearInterval(igEmbedWait);
      }
    }, 250);
  }

  // Incentive Trip 照片墙：内容照画（有没有照片都先把标题/网格准备好），
  // 是否显示整个板块的判断放在 applyLayout 之后（见下面），才不会被「网站排版」的隐藏设定盖掉判断。
  const tripImages = (c.incentive_trip && Array.isArray(c.incentive_trip.images))
    ? c.incentive_trip.images.filter(Boolean)
    : [];
  setText("incentive-trip-title", c.incentive_trip.title);
  setRichText("incentive-trip-subtitle", c.incentive_trip.subtitle);
  const tg = document.getElementById("incentive-trip-grid");
  if (tg) tg.innerHTML = tripImages.map(url => `<img src="${url}" alt="">`).join("");

  // Audience fit + FAQ
  const good = document.getElementById("faq-good");
  good.innerHTML = c.faq.good.map(x => `<li>${x}</li>`).join("");
  const bad = document.getElementById("faq-bad");
  bad.innerHTML = c.faq.bad.map(x => `<li>${x}</li>`).join("");
  const faqList = document.getElementById("faq-list");
  faqList.innerHTML = c.faq.items.map((f, i, arr) => `
    <div class="faq-item" style="${i === arr.length - 1 ? 'border-bottom:none;' : ''}">
      <h4>${f.q}</h4>
      <p>${f.a}</p>
    </div>`).join("");

  // Register
  setRichText("register-p1", c.register.p1);
  setRichText("register-p2", c.register.p2);
  setText("register-button", c.register.button);
  renderRegisterCounter(c.register.show_counter);

  // Closing
  setText("closing-line1", c.closing.line1);
  setText("closing-line2", c.closing.line2);

  // Footer
  setRichText("footer-desc", c.footer.desc);
  setHref("footer-email", "mailto:", c.footer.email);
  setHref("footer-phone", "tel:", c.footer.phone);
  setText("footer-address", c.footer.address);

  // 板块排版（顺序 + 隐藏），放最后确保这时候所有板块都已经存在
  applyLayout(c.layout);

  // Incentive Trip 没有照片时强制隐藏整个板块——放在 applyLayout 之后判断，
  // 这样不管后台「网站排版」有没有勾选隐藏 incentive_trip，只要还没上传照片就一定不显示。
  // 这里两种情况都要「明确」设定 hidden（不能只处理没照片这一种情况）：
  // 如果后台的「网站排版」是在这个功能上线前保存的，它存的 order 清单里根本没有
  // incentive_trip 这个 key，上面的 applyLayout() 会直接跳过它、完全不会去动它的
  // hidden 状态，那它就会一直卡在第一次用预设内容（没有照片）渲染时设的「隐藏」，
  // 即使后台已经上传了照片，板块也永远不会自己出现。
  const tripSection = document.querySelector('[data-section-key="incentive_trip"]');
  if (tripSection) {
    if (!tripImages.length) {
      tripSection.hidden = true;
    } else {
      const hiddenByLayout = !!(c.layout && Array.isArray(c.layout.hidden) && c.layout.hidden.includes("incentive_trip"));
      tripSection.hidden = hiddenByLayout;
    }
  }
}

async function loadContent() {
  // 先用预设内容渲染一次，避免网络慢的时候页面空白
  const merged = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  render(merged);

  try {
    const { data, error } = await supabaseClient.from("page_content").select("id, content");
    if (error) throw error;
    if (data && data.length) {
      data.forEach(row => {
        if (merged[row.id] === undefined) return;
        if (Array.isArray(merged[row.id])) {
          // 像「四大亮点」这种整个板块本身就是清单（不是清单包在物件里）的，
          // 要整个清单直接替换，不能用 Object.assign 合并——
          // 合并会把清单拆成 {0:.., 1:..} 这种物件，害后面 .map() 直接报错、
          // 导致后面所有板块（包含图片）都渲染不出来。
          if (Array.isArray(row.content)) merged[row.id] = row.content;
        } else {
          merged[row.id] = Object.assign({}, merged[row.id], row.content);
        }
      });
      render(merged);
    }
  } catch (err) {
    console.warn("读取 Supabase 内容失败，先显示预设文案：", err.message);
  }
}

function initForm() {
  const form = document.getElementById("register-form");
  const okMsg = document.getElementById("form-msg-ok");
  const dupMsg = document.getElementById("form-msg-dup");
  const errMsg = document.getElementById("form-msg-err");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    okMsg.classList.remove("show");
    dupMsg.classList.remove("show");
    errMsg.classList.remove("show");

    const btn = form.querySelector("button[type=submit]");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "提交中...";

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      phone: form.phone.value.trim(),
      city: form.city.value.trim(),
      intent: form.intent ? form.intent.value.trim() : "",
      message: form.message.value.trim(),
      agent_code: AGENT_CODE,
      utm_source: UTM_SOURCE,
      utm_medium: UTM_MEDIUM
    };

    try {
      const { error } = await supabaseClient.from("registrations").insert([payload]);
      if (error) {
        // 23505 = 违反唯一值限制，代表这个邮箱已经报名过了（不是真的出错）
        if (error.code === "23505") {
          dupMsg.classList.add("show");
          form.reset();
        } else {
          throw error;
        }
      } else {
        okMsg.classList.add("show");
        form.reset();
      }
    } catch (err) {
      console.error(err);
      errMsg.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}

loadContent();
initForm();
renderAgentInviteCard();
