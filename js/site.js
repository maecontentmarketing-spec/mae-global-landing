// ============================================================
// 前台页面逻辑：
// 1. 先用 content.js 里的预设文案画面
// 2. 去 Supabase 的 page_content 表拿 admin 后台存的内容，盖上去
// 3. 处理报名表单，写进 Supabase 的 registrations 表
// ============================================================

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

  // Results / reviews
  setText("results-title", c.results.title);
  setText("results-warning", c.results.warning);
  const rg = document.getElementById("results-grid");
  rg.innerHTML = c.results.items.map(r => {
    const photo = r.image
      ? `<div class="review-photo"><img src="${r.image}" alt=""></div>`
      : `<div class="review-photo">🖼️</div>`;
    return `
    <div class="review-card card">
      ${photo}
      <blockquote>"${r.quote}"</blockquote>
      <div class="who">${r.who} <span style="font-weight:400;color:var(--muted);">（照片经本人同意后使用）</span></div>
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

  // Closing
  setText("closing-line1", c.closing.line1);
  setText("closing-line2", c.closing.line2);

  // Footer
  setText("footer-desc", c.footer.desc);
  setHref("footer-email", "mailto:", c.footer.email);
  setHref("footer-phone", "tel:", c.footer.phone);
  setText("footer-address", c.footer.address);
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
  const errMsg = document.getElementById("form-msg-err");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    okMsg.classList.remove("show");
    errMsg.classList.remove("show");

    const btn = form.querySelector("button[type=submit]");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "提交中...";

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      city: form.city.value.trim(),
      message: form.message.value.trim()
    };

    try {
      const { error } = await supabaseClient.from("registrations").insert([payload]);
      if (error) throw error;
      okMsg.classList.add("show");
      form.reset();
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
