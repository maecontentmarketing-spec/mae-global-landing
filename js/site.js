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

// 把板块按照后台设定的顺序排好、该隐藏的隐藏。找不到设定就维持网页原本的顺序。
function applyLayout(layout) {
  const main = document.getElementById("page-sections");
  if (!main) return;
  const order = (layout && layout.order && layout.order.length) ? layout.order : DEFAULT_CONTENT.layout.order;
  const hidden = (layout && layout.hidden) || [];
  order.forEach(key => {
    const el = main.querySelector(`[data-section-key="${key}"]`);
    if (!el) return;
    main.appendChild(el);
    el.hidden = hidden.includes(key);
  });
}

function render(content) {
  const c = content;

  // Hero
  setText("hero-title", c.hero.title);
  setText("hero-lede", c.hero.lede);
  setText("hero-intro", c.hero.intro);
  setText("hero-button", c.hero.button);
  setMedia("hero-media", c.hero.image);

  // Kate 创办人
  setMedia("kate-media", c.kate.image);
  setText("kate-quote", c.kate.quote);
  setText("kate-p1", c.kate.p1);
  setText("kate-p2", c.kate.p2);
  setText("kate-p3", c.kate.p3);
  setText("kate-signature", c.kate.signature);
  setText("kate-p4", c.kate.p4);
  setText("kate-p5", c.kate.p5);
  setText("kate-p6", c.kate.p6);

  // 机会重新框定
  setText("opp-p1", c.opportunity.p1);
  setText("opp-p2", c.opportunity.p2);
  setText("opp-p3", c.opportunity.p3);

  // GROW System
  setText("system-title", c.system.title);
  setText("system-subtitle", c.system.subtitle);
  setText("system-footnote", c.system.footnote);

  // Highlights
  const hg = document.getElementById("highlights-grid");
  hg.innerHTML = c.highlights.map(h => `
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
  setText("brand-p1", c.brand.p1);
  setText("brand-p2", c.brand.p2);
  setText("brand-p3", c.brand.p3);
  setMedia("brand-logo-media", c.brand.logo_image);
  setMedia("brand-product-media", c.brand.product_image);
  setMedia("brand-cert-media", c.brand.cert_image);

  // Milestones
  setText("milestones-title", c.milestones.title);
  setText("milestones-subtitle", c.milestones.subtitle);
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
  setText("event-subtitle", c.event.subtitle);
  setText("event-date", c.event.date);
  setText("event-time", c.event.time);
  setText("event-place", c.event.place);
  setText("event-timezone", c.event.timezone);
  renderCountdown(c.event.sessions);

  // Results / reviews
  setText("results-title", c.results.title);
  setText("results-warning", c.results.warning);
  const rg = document.getElementById("results-grid");
  rg.innerHTML = c.results.items.map(r => {
    const photo = r.image
      ? `<div class="review-photo"><img src="${r.image}" alt=""></div>`
      : `<div class="review-photo">🖼️</div>`;
    const igLink = r.ig_link
      ? `<a class="ig-link" href="${r.ig_link}" target="_blank" rel="noopener">查看 IG 原帖 →</a>`
      : "";
    return `
    <div class="review-card card">
      ${photo}
      <blockquote>"${r.quote}"</blockquote>
      <div class="who">${r.who} <span style="font-weight:400;color:var(--muted);">（照片经本人同意后使用）</span></div>
      ${igLink}
    </div>`;
  }).join("");

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
  setText("register-p1", c.register.p1);
  setText("register-p2", c.register.p2);
  setText("register-button", c.register.button);
  renderRegisterCounter(c.register.show_counter);

  // Closing
  setText("closing-line1", c.closing.line1);
  setText("closing-line2", c.closing.line2);

  // Footer
  setText("footer-desc", c.footer.desc);
  setHref("footer-email", "mailto:", c.footer.email);
  setHref("footer-phone", "tel:", c.footer.phone);
  setText("footer-address", c.footer.address);

  // 板块排版（顺序 + 隐藏），放最后确保这时候所有板块都已经存在
  applyLayout(c.layout);
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
        if (merged[row.id]) {
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
