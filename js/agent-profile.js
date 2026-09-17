// ============================================================
// 「我的自我介绍」自助填写页 (agent-profile.html)
//
// 代理用自己平时分享的专属连接打开这个页面（把网址里的 index.html
// 换成 agent-profile.html，?ref=专属代码 保持不变），代码会自动带入，
// 不需要登入任何帐号，也不会公开显示代码本身。
// 填好的照片/名字/一句话介绍，会存进 agent_profiles 这张表，
// 前台网站会用来显示「XXX 邀请你认识 MAE」邀请卡片。
// ============================================================

function getUrlParam(name) {
  return (new URLSearchParams(window.location.search).get(name) || "").trim();
}

const AGENT_CODE = getUrlParam("ref").toUpperCase().slice(0, 40);

async function loadExistingProfile() {
  if (!AGENT_CODE) return;
  try {
    const { data } = await supabaseClient
      .from("agent_profiles")
      .select("name, intro, photo_url")
      .eq("code", AGENT_CODE)
      .maybeSingle();
    if (data) {
      document.getElementById("agent-name-input").value = data.name || "";
      document.getElementById("agent-intro-input").value = data.intro || "";
      if (data.photo_url) {
        document.getElementById("agent-photo-url").value = data.photo_url;
        document.getElementById("agent-photo-preview").innerHTML = `<img src="${data.photo_url}" alt="">`;
      }
    }
  } catch (err) {
    console.warn("读取现有自我介绍失败：", err.message);
  }
}

async function handlePhotoUpload(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const statusEl = document.getElementById("agent-photo-status");
  const previewEl = document.getElementById("agent-photo-preview");
  const hiddenInput = document.getElementById("agent-photo-url");

  statusEl.textContent = "上传中...";

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `agent-profiles/${AGENT_CODE}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage.from("site-images").upload(path, file, { upsert: true });
  if (uploadError) {
    statusEl.textContent = "上传失败：" + uploadError.message;
    return;
  }

  const { data } = supabaseClient.storage.from("site-images").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  hiddenInput.value = publicUrl;
  previewEl.innerHTML = `<img src="${publicUrl}" alt="">`;
  statusEl.textContent = "上传成功！记得点下面的「保存」按钮。";
}

async function saveProfile() {
  const btn = document.getElementById("agent-profile-save-btn");
  const okMsg = document.getElementById("agent-profile-msg-ok");
  const errMsg = document.getElementById("agent-profile-msg-err");
  okMsg.classList.remove("show");
  errMsg.classList.remove("show");

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "保存中...";

  try {
    const { error } = await supabaseClient.rpc("save_my_agent_profile", {
      p_code: AGENT_CODE,
      p_name: document.getElementById("agent-name-input").value.trim(),
      p_intro: document.getElementById("agent-intro-input").value.trim(),
      p_photo_url: document.getElementById("agent-photo-url").value.trim()
    });
    if (error) throw error;
    okMsg.classList.add("show");
  } catch (err) {
    console.error(err);
    errMsg.classList.add("show");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function init() {
  if (!AGENT_CODE) {
    document.getElementById("agent-profile-blocked").style.display = "block";
    document.getElementById("agent-profile-form-wrap").style.display = "none";
    return;
  }

  document.getElementById("agent-profile-code").textContent = AGENT_CODE;
  document.getElementById("agent-photo-input").addEventListener("change", (e) => handlePhotoUpload(e.target));
  document.getElementById("agent-profile-save-btn").addEventListener("click", saveProfile);
  loadExistingProfile();
}

init();
