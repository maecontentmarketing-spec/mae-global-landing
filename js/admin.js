// ============================================================
// Admin 后台逻辑：登入（Supabase Auth）+ 逐板块编辑 + 报名名单
// ============================================================

const TEXT_FIELDS = {
  hero: [["title", "标题", "text"], ["lede", "副标题", "textarea"], ["intro", "正文", "textarea"], ["button", "按钮文字", "text"]],
  kate: [["quote", "引言", "text"], ["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["p3", "段落 3", "textarea"], ["signature", "署名", "text"], ["p4", "段落 4", "textarea"], ["p5", "段落 5", "textarea"], ["p6", "段落 6", "textarea"]],
  opportunity: [["p1", "段落 1", "textarea"], ["p2", "段落 2（保留「aMAEzing AI GROW System」字样）", "textarea"], ["p3", "段落 3", "textarea"]],
  system: [["title", "标题", "text"], ["subtitle", "副标题", "textarea"], ["footnote", "结尾文字", "textarea"]],
  brand: [["stat1_value", "数值 1", "text"], ["stat1_label", "说明 1", "text"], ["stat2_value", "数值 2", "text"], ["stat2_label", "说明 2", "text"], ["stat3_value", "数值 3", "text"], ["stat3_label", "说明 3", "text"], ["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["p3", "段落 3", "textarea"]],
  milestones: [["title", "标题", "text"], ["subtitle", "副标题", "textarea"]],
  event: [["title", "标题", "text"], ["subtitle", "提示语", "textarea"], ["date", "日期", "text"], ["time", "时间", "text"], ["place", "地点", "text"], ["timezone", "时区", "text"]],
  results: [["title", "标题", "text"], ["warning", "警示文字", "textarea"]],
  register: [["p1", "段落 1", "textarea"], ["p2", "段落 2", "textarea"], ["button", "按钮文字", "text"]],
  closing: [["line1", "第一行", "text"], ["line2", "第二行", "text"]],
  footer: [["desc", "品牌简介", "textarea"], ["email", "联系邮箱", "text"], ["phone", "联系电话", "text"], ["address", "地址", "text"]]
};

const SECTION_LABELS = {
  hero: "① Hero 首屏", kate: "② Kate 创办人", opportunity: "③ 重新框定机会",
  system: "④ aMAEzing AI GROW System", highlights: "⑤ 四大亮点", brand: "⑥ MAE 品牌背书",
  milestones: "MAE Milestone 画廊", event: "⑦ 时间地点", results: "⑧ 真实成果",
  faq: "⑨ 谁适合参与 + FAQ", register: "⑩ 报名区块文案", closing: "⑪ 结尾", footer: "页脚"
};

let currentContent = null; // 合并 Supabase 覆盖后的完整内容（跟 site.js 逻辑一致）

function textInput(id, label, type, value) {
  const safe = (value || "").toString();
  return `<div class="admin-field"><label>${label}</label>${
    type === "textarea"
      ? `<textarea data-field="${id}">${safe}</textarea>`
      : `<input type="text" data-field="${id}" value="${safe.replace(/"/g, "&quot;")}">`
  }</div>`;
}

// 图片上传栏位：预览框 + 选档案按钮 + 一个藏起来的 input 存网址
// （藏起来的 input 用跟文字栏位一样的 data-field，保存的时候会一起被读到）
function imageField(fieldPath, label, url) {
  const safeUrl = (url || "").toString();
  const previewHtml = safeUrl ? `<img src="${safeUrl}" alt="">` : `<span>尚未上传</span>`;
  return `
    <div class="admin-field img-field">
      <label>${label}</label>
      <div class="img-upload-row">
        <div class="img-preview">${previewHtml}</div>
        <div class="img-upload-controls">
          <input type="file" accept="image/*" class="img-file-input">
          <div class="img-upload-status"></div>
        </div>
      </div>
      <input type="hidden" data-field="${fieldPath}" value="${safeUrl.replace(/"/g, "&quot;")}">
    </div>`;
}

async function handleImageUpload(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const wrapper = inputEl.closest(".img-field");
  const statusEl = wrapper.querySelector(".img-upload-status");
  const previewEl = wrapper.querySelector(".img-preview");
  const hiddenInput = wrapper.querySelector('input[type="hidden"]');

  statusEl.textContent = "上传中...";

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage.from("site-images").upload(path, file, { upsert: true });
  if (uploadError) {
    statusEl.textContent = "上传失败：" + uploadError.message + "（常见原因：Supabase 里还没建立 site-images 这个 Storage bucket）";
    return;
  }

  const { data } = supabaseClient.storage.from("site-images").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  hiddenInput.value = publicUrl;
  previewEl.innerHTML = `<img src="${publicUrl}" alt="">`;
  statusEl.textContent = "上传成功！记得点下面的「保存」按钮，网站才会真的更新。";
}

function renderSection(key, data) {
  let inner = "";

  if (key === "hero") {
    inner += imageField("image", "Hero 背景图", data.hero.image);
  }
  if (key === "kate") {
    inner += imageField("image", "Kate 创办人照片", data.kate.image);
  }
  if (key === "brand") {
    inner += imageField("logo_image", "MAE Logo", data.brand.logo_image);
    inner += imageField("product_image", "产品图", data.brand.product_image);
    inner += imageField("cert_image", "纪录认证证书照片", data.brand.cert_image);
  }

  if (TEXT_FIELDS[key]) {
    inner += TEXT_FIELDS[key].map(([f, label, type]) => textInput(f, label, type, data[key][f])).join("");
  }

  if (key === "highlights") {
    inner += data.highlights.map((h, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        <label>Emoji</label><input type="text" data-field="_arr.${i}.emoji" value="${h.emoji}">
        <label style="margin-top:10px;">标题</label><input type="text" data-field="_arr.${i}.title" value="${h.title.replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">描述</label><textarea data-field="_arr.${i}.desc">${h.desc}</textarea>
      </div>`).join("");
  }

  if (key === "milestones") {
    const images = data.milestones.images || [];
    inner += data.milestones.captions.map((cap, i) => imageField(`_milestone_img.${i}`, `照片 ${i + 1}`, images[i])).join("");
    inner += `<div class="admin-field"><label>照片说明（每行一条，共 8 条，顺序对应上面的照片）</label>
      <textarea data-field="_captions" rows="8">${data.milestones.captions.join("\n")}</textarea></div>`;
  }

  if (key === "results") {
    inner += data.results.items.map((r, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        ${imageField(`_items.${i}.image`, "照片", r.image)}
        <label>姓名/身份</label><input type="text" data-field="_items.${i}.who" value="${r.who.replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">见证内容</label><textarea data-field="_items.${i}.quote">${r.quote}</textarea>
      </div>`).join("");
  }

  if (key === "faq") {
    inner += `<div class="admin-field"><label>适合参与（每行一条）</label>
      <textarea data-field="_good" rows="7">${data.faq.good.join("\n")}</textarea></div>`;
    inner += `<div class="admin-field"><label>可能不适合（每行一条）</label>
      <textarea data-field="_bad" rows="3">${data.faq.bad.join("\n")}</textarea></div>`;
    inner += data.faq.items.map((f, i) => `
      <div class="admin-field" style="border-top:1px solid var(--card-border);padding-top:12px;">
        <label>问题</label><input type="text" data-field="_items.${i}.q" value="${f.q.replace(/"/g, "&quot;")}">
        <label style="margin-top:10px;">回答</label><textarea data-field="_items.${i}.a">${f.a}</textarea>
      </div>`).join("");
  }

  return `
    <div class="admin-section card" data-section="${key}">
      <h3>${SECTION_LABELS[key]} <button class="btn save-btn" data-save="${key}">保存</button></h3>
      ${inner}
      <div class="form-msg ok" data-savemsg="${key}" style="margin-top:10px;">已保存，网站会立即更新。</div>
    </div>`;
}

function renderAllSections() {
  const order = ["hero", "kate", "opportunity", "system", "highlights", "brand", "milestones", "event", "results", "faq", "register", "closing", "footer"];
  document.getElementById("sections").innerHTML = order.map(k => renderSection(k, currentContent)).join("");

  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", () => saveSection(btn.getAttribute("data-save")));
  });

  document.querySelectorAll(".img-file-input").forEach(input => {
    input.addEventListener("change", () => handleImageUpload(input));
  });
}

async function loadMergedContent() {
  const merged = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  const { data, error } = await supabaseClient.from("page_content").select("id, content");
  if (!error && data) {
    data.forEach(row => {
      if (merged[row.id] !== undefined) {
        if (Array.isArray(merged[row.id])) {
          Object.assign(merged[row.id], row.content);
        } else {
          merged[row.id] = Object.assign({}, merged[row.id], row.content);
        }
      }
    });
  }
  currentContent = merged;
  renderAllSections();
}

async function saveSection(key) {
  const card = document.querySelector(`[data-section="${key}"]`);
  const msg = card.querySelector(`[data-savemsg="${key}"]`);
  const updated = JSON.parse(JSON.stringify(currentContent[key]));

  card.querySelectorAll("[data-field]").forEach(el => {
    const path = el.getAttribute("data-field");
    const val = el.value;

    if (path.startsWith("_arr.")) {
      const [, idx, field] = path.split(".");
      updated[idx][field] = val;
    } else if (path === "_captions") {
      updated.captions = val.split("\n");
    } else if (path.startsWith("_milestone_img.")) {
      const idx = path.split(".")[1];
      if (!updated.images) updated.images = [];
      updated.images[idx] = val;
    } else if (path.startsWith("_items.")) {
      const [, idx, field] = path.split(".");
      updated.items[idx][field] = val;
    } else if (path === "_good") {
      updated.good = val.split("\n");
    } else if (path === "_bad") {
      updated.bad = val.split("\n");
    } else {
      updated[path] = val;
    }
  });

  currentContent[key] = updated;

  const { error } = await supabaseClient.from("page_content").upsert({ id: key, content: updated, updated_at: new Date().toISOString() });
  if (error) {
    alert("保存失败：" + error.message + "\n\n（常见原因：还没在 Supabase 的 admins 表里加入你的帐号，参考 supabase/schema.sql 最下面的说明）");
    return;
  }
  msg.classList.add("show");
  setTimeout(() => msg.classList.remove("show"), 2500);
}

async function loadLeads() {
  const tbody = document.getElementById("leads-body");
  const { data, error } = await supabaseClient
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6">读取失败：${error.message}</td></tr>`;
    return;
  }
  tbody.innerHTML = (data || []).map(r => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString("zh-CN")}</td>
      <td>${r.name || ""}</td>
      <td>${r.email || ""}</td>
      <td>${r.phone || ""}</td>
      <td>${r.city || ""}</td>
      <td>${r.message || ""}</td>
    </tr>`).join("") || `<tr><td colspan="6">暂时没有报名资料</td></tr>`;
}

function showEditor(email) {
  document.getElementById("login-view").style.display = "none";
  document.getElementById("editor-view").style.display = "block";
  document.getElementById("who-email").textContent = email;
  loadMergedContent();
  loadLeads();
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showEditor(session.user.email);
  }

  document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errBox = document.getElementById("login-err");
    errBox.style.display = "none";

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errBox.style.display = "block";
      errBox.textContent = "登入失败：" + error.message;
      return;
    }
    showEditor(data.user.email);
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    location.reload();
  });

  document.getElementById("refresh-leads").addEventListener("click", loadLeads);
}

init();
