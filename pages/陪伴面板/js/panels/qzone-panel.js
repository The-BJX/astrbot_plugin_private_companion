window.PrivateCompanionQzonePanel = (() => {
  const state = {
    initialized: false,
    status: null,
    scope: "friends",
    targetUin: "",
    posts: [],
    selectedId: "",
    loading: false,
    loaded: false,
    page: 1,
    pendingLikes: new Set(),
    detailLoadingId: "",
    context: null,
  };

  function text(value) {
    return String(value ?? "");
  }

  function postById(id) {
    return state.posts.find((item) => item.id === id) || null;
  }

  function setNotice(message = "", tone = "info") {
    const notice = document.getElementById("qzoneNotice");
    if (!notice) return;
    notice.hidden = !message;
    notice.textContent = message;
    notice.dataset.tone = tone;
  }

  function renderAccount() {
    const login = state.status?.login || {};
    const summary = state.status?.summary || {};
    const name = document.getElementById("qzoneAccountName");
    const meta = document.getElementById("qzoneAccountMeta");
    if (name) name.textContent = login.nickname || (login.uin ? `QQ ${login.uin}` : "未绑定");
    if (meta) {
      meta.textContent = summary.enabled
        ? `QQ 空间已启用 · ${summary.last_status || "等待操作"}`
        : (summary.available ? "QQ 空间模块已加载，但整合开关未开启" : "QQ 空间模块不可用");
    }
    const summaryBox = document.getElementById("qzoneQuickSummary");
    if (summaryBox) {
      summaryBox.innerHTML = `
        <article><b>${summary.life_publish_enabled ? "开启" : "关闭"}</b><span>生活说说</span></article>
        <article><b>${summary.comment_inbox_enabled ? "开启" : "关闭"}</b><span>评论收件箱</span></article>
        <article><b>${state.posts.length}</b><span>当前动态</span></article>
      `;
    }
  }

  function renderFeed() {
    const feed = document.getElementById("qzoneFeed");
    const meta = document.getElementById("qzoneFeedMeta");
    if (!feed || !meta) return;
    meta.textContent = state.loading
      ? "正在同步动态..."
      : `${state.scope === "profile" ? (state.targetUin || "指定 QQ") : state.scope === "friends" ? "好友动态" : "我的空间"} · ${state.posts.length} 条`;
    if (!state.posts.length) {
      feed.innerHTML = `<div class="qzone-empty"><b>暂无可显示的说说</b><span>可以先刷新，或切换到指定 QQ 试试。</span></div>`;
      renderDetail();
      return;
    }
    const { escapeHtml } = state.context;
    feed.innerHTML = state.posts.map((post) => `
      <article class="qzone-post-card ${state.selectedId === post.id ? "is-active" : ""}" data-qzone-open="${escapeHtml(post.id)}">
        <header>
          <div>
            <b>${escapeHtml(post.author?.nickname || post.author?.uin || "QQ空间用户")}</b>
            <small>${escapeHtml(post.created_at_text || "刚刚")}</small>
          </div>
          <span class="qzone-post-badge">${post.can_delete ? "我的说说" : "动态"}</span>
        </header>
        <p class="qzone-post-text">${escapeHtml(post.content || "无正文")}</p>
        ${Array.isArray(post.images) && post.images.length ? `
          <div class="qzone-post-media">
            ${post.images.slice(0, 4).map((url) => `<img src="${escapeHtml(url)}" alt="说说图片" loading="lazy" />`).join("")}
          </div>
        ` : ""}
        <footer>
          <button type="button" data-qzone-like="${escapeHtml(post.id)}" ${state.pendingLikes.has(post.id) ? "disabled" : ""}>点赞</button>
          <button type="button" data-qzone-open="${escapeHtml(post.id)}">评论 ${escapeHtml(post.stats?.comments ?? 0)}</button>
        </footer>
      </article>
    `).join("");
    renderDetail();
  }

  function renderDetail() {
    const empty = document.getElementById("qzoneDetailEmpty");
    const detail = document.getElementById("qzoneDetailContent");
    if (!empty || !detail) return;
    const post = postById(state.selectedId);
    if (!post) {
      empty.hidden = false;
      detail.hidden = true;
      detail.innerHTML = "";
      return;
    }
    empty.hidden = true;
    detail.hidden = false;
    const { escapeHtml } = state.context;
    detail.innerHTML = `
      <div class="qzone-detail-card">
        <div class="qzone-detail-head">
          <div>
            <b>${escapeHtml(post.author?.nickname || post.author?.uin || "QQ空间用户")}</b>
            <small>${escapeHtml(post.created_at_text || "刚刚")}</small>
          </div>
          <button type="button" data-qzone-like="${escapeHtml(post.id)}" ${state.pendingLikes.has(post.id) ? "disabled" : ""}>点赞这条</button>
        </div>
        <p class="qzone-detail-text">${escapeHtml(post.content || "无正文")}</p>
        ${Array.isArray(post.images) && post.images.length ? `
          <div class="qzone-detail-media">
            ${post.images.map((url) => `<img src="${escapeHtml(url)}" alt="说说图片" loading="lazy" />`).join("")}
          </div>
        ` : ""}
      </div>
      <div class="qzone-comment-block">
        <div class="qzone-comment-head">
          <b>全部评论</b>
          <span>${escapeHtml(post.comments?.length ?? 0)} 条</span>
        </div>
        <div class="qzone-comment-list">
          ${(post.comments || []).length ? post.comments.map((comment) => `
            <article class="qzone-comment-item">
              <b>${escapeHtml(comment.author?.nickname || comment.author?.uin || "QQ空间用户")}</b>
              <p>${escapeHtml(comment.content || "")}</p>
            </article>
          `).join("") : `<div class="qzone-empty compact"><span>还没有评论。</span></div>`}
        </div>
        <form id="qzoneCommentForm" class="qzone-comment-form">
          <textarea id="qzoneCommentInput" rows="3" placeholder="写一条公开评论"></textarea>
          <button type="submit">发送评论</button>
        </form>
      </div>
    `;
    const form = document.getElementById("qzoneCommentForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("qzoneCommentInput");
      const content = input?.value || "";
      await sendComment(content);
      if (input) input.value = "";
    });
  }

  async function loadStatus(force = false) {
    if (state.status && !force) return state.status;
    try {
      state.status = await state.context.fetchJson("/qzone/status");
      renderAccount();
      return state.status;
    } catch (error) {
      state.status = state.status || { login: { bound: false, uin: 0, nickname: "", avatar: "" }, summary: { enabled: false, available: false } };
      setNotice(`状态加载失败：${error.message}`, "error");
      renderAccount();
      throw error;
    }
  }

  async function loadFeed(force = false) {
    if (state.scope === "profile" && !state.targetUin.trim()) {
      state.posts = [];
      state.loaded = false;
      state.loading = false;
      setNotice("输入 QQ 号后查看指定空间。", "warn");
      renderFeed();
      return state.posts;
    }
    if (state.loaded && !force) {
      renderFeed();
      return state.posts;
    }
    state.loading = true;
    setNotice("", "info");
    renderFeed();
    try {
      const params = new URLSearchParams();
      params.set("scope", state.scope);
      params.set("page", String(state.page || 1));
      if (state.scope === "profile" && state.targetUin.trim()) params.set("hostuin", state.targetUin.trim());
      const payload = await state.context.fetchJson(`/qzone/feed?${params.toString()}`);
      state.posts = Array.isArray(payload.items) ? payload.items : [];
      state.loaded = true;
      if (!state.selectedId && state.posts[0]) state.selectedId = state.posts[0].id;
      renderAccount();
      renderFeed();
      return state.posts;
    } catch (error) {
      state.posts = [];
      state.loaded = false;
      state.selectedId = "";
      setNotice(`动态加载失败：${error.message}`, "error");
      renderFeed();
      throw error;
    } finally {
      state.loading = false;
      renderFeed();
    }
  }

  async function openDetail(id) {
    if (!id) return;
    state.selectedId = id;
    state.detailLoadingId = id;
    renderFeed();
    try {
      const payload = await state.context.fetchJson(`/qzone/detail?id=${encodeURIComponent(id)}`);
      const post = payload.post;
      if (post) {
        state.posts = state.posts.map((item) => (item.id === id ? post : item));
      }
    } finally {
      state.detailLoadingId = "";
      renderFeed();
    }
  }

  async function likePost(id) {
    const post = postById(id);
    if (!post) return;
    state.pendingLikes.add(id);
    renderFeed();
    try {
      await state.context.postJson("/qzone/like", { id });
      state.posts = state.posts.map((item) => (
        item.id === id
          ? { ...item, liked: true, stats: { ...(item.stats || {}), likes: Number(item.stats?.likes || 0) + 1 } }
          : item
      ));
      state.context.showToast("已发送点赞请求");
    } catch (error) {
      state.context.showToast(`点赞失败：${error.message}`, "error");
    } finally {
      state.pendingLikes.delete(id);
      renderFeed();
    }
  }

  async function sendComment(content) {
    const post = postById(state.selectedId);
    const clean = text(content).trim();
    if (!post || !clean) return;
    try {
      const payload = await state.context.postJson("/qzone/comment", { id: post.id, content: clean });
      if (payload?.post) {
        state.posts = state.posts.map((item) => (item.id === post.id ? payload.post : item));
      }
      state.context.showToast("评论已发送");
      renderFeed();
    } catch (error) {
      state.context.showToast(`评论失败：${error.message}`, "error");
    }
  }

  async function publish() {
    const input = document.getElementById("qzonePublishContent");
    const content = text(input?.value).trim();
    if (!content) {
      state.context.showToast("说说内容不能为空", "error");
      return;
    }
    try {
      await state.context.postJson("/qzone/publish", { content });
      if (input) input.value = "";
      state.context.showToast("说说已发布");
      await loadFeed(true);
    } catch (error) {
      state.context.showToast(`发布失败：${error.message}`, "error");
    }
  }

  function bindEvents() {
    const panel = document.getElementById("panel-qzone");
    if (!panel || panel.dataset.bound === "1") return;
    panel.dataset.bound = "1";
    panel.addEventListener("click", async (event) => {
      const element = event.target instanceof Element ? event.target : null;
      const open = element?.closest("[data-qzone-open]");
      if (open) {
        await openDetail(open.dataset.qzoneOpen || "");
        return;
      }
      const like = element?.closest("[data-qzone-like]");
      if (like) {
        await likePost(like.dataset.qzoneLike || "");
        return;
      }
      const scopeButton = element?.closest("[data-qzone-scope]");
      if (scopeButton) {
        state.scope = scopeButton.dataset.qzoneScope || "self";
        state.page = 1;
        document.querySelectorAll("[data-qzone-scope]").forEach((item) => item.classList.toggle("active", item === scopeButton));
        state.loaded = false;
        try {
          await loadFeed(true);
        } catch (error) {
          state.context.showToast(`动态加载失败：${error.message}`, "error");
        }
        return;
      }
    });
    document.getElementById("qzoneTargetForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const target = document.getElementById("qzoneTargetUin");
      state.targetUin = text(target?.value).trim();
      state.scope = "profile";
      state.page = 1;
      document.querySelectorAll("[data-qzone-scope]").forEach((item) => item.classList.toggle("active", item.dataset.qzoneScope === "profile"));
      state.loaded = false;
      try {
        await loadFeed(true);
      } catch (error) {
        state.context.showToast(`查询失败：${error.message}`, "error");
      }
    });
    document.getElementById("qzonePublishForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await publish();
    });
    document.getElementById("qzoneRefreshBtn")?.addEventListener("click", async () => {
      try {
        await loadStatus(true);
        await loadFeed(true);
      } catch (error) {
        state.context.showToast(`刷新失败：${error.message}`, "error");
      }
    });
    document.getElementById("qzoneRefreshCookiesBtn")?.addEventListener("click", async () => {
      try {
        const payload = await state.context.postJson("/qzone/refresh_cookies", {});
        state.context.showToast(`Cookies 已刷新：QQ ${payload?.uin || "未知"}`);
        await loadStatus(true);
        await loadFeed(true);
      } catch (error) {
        setNotice(`刷新 Cookies 失败：${error.message}`, "error");
        state.context.showToast(`刷新 Cookies 失败：${error.message}`, "error");
      }
    });
  }

  async function render(context) {
    state.context = context;
    bindEvents();
    renderAccount();
    renderFeed();
    try {
      await loadStatus();
      await loadFeed();
    } catch (error) {
      setNotice(error.message || "QQ 空间面板初始化失败", "error");
    }
  }

  return { render };
})();
