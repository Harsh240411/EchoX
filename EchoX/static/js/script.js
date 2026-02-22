/* EchoX — Main JavaScript */

// ── Utilities ──────────────────────────────────────────────────
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, type = 'info', duration = 3500) {
  let container = qs('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || '💬'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, duration);
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeAvatar(user, size = '') {
  const letter = (user.username || user.name || '?')[0].toUpperCase();
  if (user.avatar) {
    return `<div class="avatar ${size}"><img src="${user.avatar}" alt="${letter}" onerror="this.parentElement.textContent='${letter}'"></div>`;
  }
  return `<div class="avatar ${size}">${letter}</div>`;
}

function openModal(id) {
  const m = qs('#' + id);
  if (m) { m.classList.add('open'); }
}

function closeModal(id) {
  const m = qs('#' + id);
  if (m) { m.classList.remove('open'); }
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ── Auth Forms ─────────────────────────────────────────────────
(function initAuth() {
  const loginForm = qs('#loginForm');
  const signupForm = qs('#signupForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = loginForm.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Signing in…';
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginForm.email.value,
          password: loginForm.password.value
        })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirect;
      } else {
        const err = loginForm.querySelector('.error-msg') || (() => { const d = document.createElement('div'); d.className = 'error-msg'; loginForm.prepend(d); return d; })();
        err.textContent = data.error;
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const pw = signupForm.password.value;
      const cpw = signupForm.confirm_password?.value;
      if (cpw && pw !== cpw) { toast('Passwords do not match', 'error'); return; }
      const btn = signupForm.querySelector('[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating account…';
      const res = await fetch('/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupForm.username.value,
          email: signupForm.email.value,
          password: pw
        })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.redirect;
      } else {
        const err = signupForm.querySelector('.error-msg') || (() => { const d = document.createElement('div'); d.className = 'error-msg'; signupForm.prepend(d); return d; })();
        err.textContent = data.error;
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    });
  }
})();

// ── Dashboard ─────────────────────────────────────────────────
(function initDashboard() {
  if (!qs('.dashboard-layout')) return;

  // Navigation
  const navItems = qsa('.dash-nav-item[data-section]');
  const sections = qsa('.dash-section');

  function showSection(id) {
    sections.forEach(s => s.classList.toggle('active', s.id === id));
    navItems.forEach(n => n.classList.toggle('active', n.dataset.section === id));
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });

  // Load stats
  fetch('/api/dashboard/stats').then(r => r.json()).then(data => {
    const el = id => qs('#' + id);
    if (el('statChats')) el('statChats').textContent = data.total_chats;
    if (el('statGroups')) el('statGroups').textContent = data.total_groups;
    if (el('statPulses')) el('statPulses').textContent = data.total_pulses;
  });

  // Load conversations
  fetch('/api/chat/conversations').then(r => r.json()).then(convs => {
    const list = qs('#myChatsGrid');
    if (!list) return;
    if (!convs.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><h3>No chats yet</h3><p>Search for users to start chatting</p></div>'; return; }
    list.innerHTML = convs.map(c => `
      <div class="card" onclick="window.location='/chat?user=${c.user.id}'">
        <div class="card-header">
          ${makeAvatar(c.user)}
          <div>
            <div class="card-name">${c.user.username}</div>
            <div class="card-sub">${c.user.is_online ? '🟢 Online' : '⚫ Offline'}</div>
          </div>
          ${c.unread ? `<span class="badge" style="margin-left:auto">${c.unread}</span>` : ''}
        </div>
        <div class="card-preview">${c.last_message ? c.last_message.content || (c.last_message.file_name || 'Attachment') : 'No messages yet'}</div>
      </div>`).join('');
  });

  // Load groups
  fetch('/api/groups').then(r => r.json()).then(groups => {
    const list = qs('#myGroupsGrid');
    if (!list) return;
    if (!groups.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><h3>No groups yet</h3><p>Create a group to get started</p></div>'; return; }
    list.innerHTML = groups.map(g => `
      <div class="card" onclick="window.location='/groups?id=${g.id}'">
        <div class="card-header">
          ${g.photo ? `<div class="avatar"><img src="${g.photo}"></div>` : `<div class="avatar">${g.name[0].toUpperCase()}</div>`}
          <div>
            <div class="card-name">${g.name}</div>
            <div class="card-sub">${g.member_count} members</div>
          </div>
        </div>
        <div class="card-preview">${g.last_message ? g.last_message.content || 'Attachment' : 'No messages yet'}</div>
      </div>`).join('');
  });

  // Load pulses
  fetch('/api/pulses/my').then(r => r.json()).then(pulses => {
    const list = qs('#myPulsesGrid');
    if (!list) return;
    if (!pulses.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">⚡</div><h3>No pulses yet</h3><p>Share your first pulse</p></div>'; return; }
    list.innerHTML = pulses.map(p => renderPulseCard(p, true)).join('');
    bindPulseActions();
  });

  // Profile edit form
  const profileForm = qs('#profileEditForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(profileForm);
      const avatarFile = qs('#avatarInput').files[0];
      if (avatarFile) fd.append('avatar', avatarFile);
      const res = await fetch('/api/profile/update', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) { toast('Profile updated!', 'success'); location.reload(); }
      else toast(data.error, 'error');
    });
  }

  // Avatar change
  const avatarInput = qs('#avatarInput');
  const avatarPreview = qs('#avatarPreview');
  if (avatarInput && avatarPreview) {
    qs('.avatar-edit-btn')?.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
      const f = avatarInput.files[0];
      if (f) {
        const reader = new FileReader();
        reader.onload = ev => { avatarPreview.src = ev.target.result; };
        reader.readAsDataURL(f);
      }
    });
  }

  // Change password
  const pwForm = qs('#changePasswordForm');
  if (pwForm) {
    pwForm.addEventListener('submit', async e => {
      e.preventDefault();
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: pwForm.old_password.value, new_password: pwForm.new_password.value })
      });
      const data = await res.json();
      if (data.success) { toast('Password changed!', 'success'); pwForm.reset(); }
      else toast(data.error, 'error');
    });
  }

  showSection('profileSection');
})();

// ── Chat Page ──────────────────────────────────────────────────
(function initChat() {
  if (!qs('.chat-page')) return;

  const socket = io();
  let currentUser = null;
  let activeUserId = null;
  let typingTimer = null;
  let isTyping = false;

  // Load current user
  fetch('/api/me').then(r => r.json()).then(u => {
    currentUser = u;
    loadConversations();
    // Check URL param
    const params = new URLSearchParams(location.search);
    const uid = params.get('user');
    if (uid) openChat(parseInt(uid));
  });

  function loadConversations() {
    fetch('/api/chat/conversations').then(r => r.json()).then(convs => {
      const list = qs('#convList');
      list.innerHTML = '';
      if (!convs.length) {
        list.innerHTML = `<div class="empty-state" style="padding:30px 16px"><div class="empty-icon">💬</div><p>No conversations yet</p></div>`;
        return;
      }
      convs.forEach(c => {
        const item = document.createElement('div');
        item.className = `sidebar-item ${activeUserId === c.user.id ? 'active' : ''}`;
        item.dataset.userId = c.user.id;
        item.innerHTML = `
          <div class="avatar-wrap">
            ${makeAvatar(c.user)}
            ${c.user.is_online ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="sidebar-item-info">
            <div class="sidebar-item-name">${c.user.username}</div>
            <div class="sidebar-item-preview">${c.last_message ? (c.last_message.content || '📎 ' + (c.last_message.file_name || 'Attachment')) : ''}</div>
          </div>
          <div class="sidebar-item-meta">
            ${c.last_message ? `<div class="sidebar-item-time">${timeAgo(c.last_message.created_at)}</div>` : ''}
            ${c.unread ? `<div class="badge">${c.unread}</div>` : ''}
          </div>`;
        item.addEventListener('click', () => openChat(c.user.id));
        list.appendChild(item);
      });
    });
  }

  function openChat(userId) {
    activeUserId = userId;
    // Show main content on mobile
    qs('.sidebar').classList.add('hidden');
    qs('.main-content').classList.remove('sidebar-open');

    // Join socket room
    socket.emit('join_dm', { other_id: userId });

    // Load user info
    fetch(`/api/users/${userId}`).then(r => r.json()).then(user => {
      qs('#chatPartnerName').textContent = user.username;
      qs('#chatPartnerStatus').textContent = user.is_online ? 'Online' : 'Offline';
      qs('#chatPartnerStatus').className = 'chat-header-status' + (user.is_online ? '' : ' offline');
      qs('#chatHeaderAvatar').innerHTML = makeAvatar(user, 'sm');
      qs('#welcomeScreen').style.display = 'none';
      qs('#chatContainer').style.display = 'flex';
    });

    // Load messages
    fetch(`/api/chat/messages/${userId}`).then(r => r.json()).then(msgs => {
      const area = qs('#chatArea');
      area.innerHTML = '';
      msgs.forEach(m => appendMessage(m));
      area.scrollTop = area.scrollHeight;
      socket.emit('message_seen', { sender_id: userId });
    });

    // Update active state in sidebar
    qsa('.sidebar-item').forEach(i => i.classList.toggle('active', parseInt(i.dataset.userId) === userId));
  }

  function appendMessage(msg) {
    const area = qs('#chatArea');
    const isSent = msg.sender_id === currentUser?.id;
    const div = document.createElement('div');
    div.className = `msg-wrap ${isSent ? 'sent' : 'received'}`;
    div.innerHTML = `
      <div class="msg-bubble ${isSent ? 'sent' : 'received'}">
        ${renderMsgContent(msg)}
        <div class="msg-meta">
          <span class="msg-time">${formatTime(msg.created_at)}</span>
          ${isSent ? `<span class="msg-status ${msg.is_seen ? 'seen' : 'delivered'}">
            ${msg.is_seen ? '✓✓' : '✓'}
          </span>` : ''}
        </div>
      </div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  function renderMsgContent(msg) {
    let html = '';
    if (msg.file_url) {
      if (msg.file_type === 'image') {
        html += `<img class="msg-image" src="${msg.file_url}" alt="image" onclick="openLightbox('${msg.file_url}')">`;
      } else if (msg.file_type === 'video') {
        html += `<video class="msg-video" src="${msg.file_url}" controls></video>`;
      } else {
        html += `<a class="msg-file-card" href="${msg.file_url}" download>
          <span class="msg-file-icon">📎</span>
          <div><div class="msg-file-name">${msg.file_name || 'File'}</div></div>
        </a>`;
      }
    }
    if (msg.content) html += `<div>${escapeHtml(msg.content)}</div>`;
    return html;
  }

  // Send message
  const sendBtn = qs('#sendBtn');
  const msgInput = qs('#msgInput');
  const fileInput = qs('#fileInput');
  let pendingFile = null;

  qs('#attachBtn')?.addEventListener('click', () => fileInput.click());

  fileInput?.addEventListener('change', () => {
    pendingFile = fileInput.files[0];
    if (pendingFile) {
      const bar = qs('#filePreviewBar');
      bar.classList.add('show');
      qs('#filePreviewName').textContent = pendingFile.name;
    }
  });

  qs('#fileClearBtn')?.addEventListener('click', () => {
    pendingFile = null;
    fileInput.value = '';
    qs('#filePreviewBar').classList.remove('show');
  });

  async function sendMessage() {
    if (!activeUserId || (!msgInput.value.trim() && !pendingFile)) return;
    const fd = new FormData();
    fd.append('receiver_id', activeUserId);
    if (msgInput.value.trim()) fd.append('content', msgInput.value.trim());
    if (pendingFile) fd.append('file', pendingFile);

    msgInput.value = '';
    autoResize(msgInput);
    pendingFile = null;
    fileInput.value = '';
    qs('#filePreviewBar').classList.remove('show');

    const res = await fetch('/api/chat/send', { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.success) toast('Failed to send message', 'error');
  }

  sendBtn?.addEventListener('click', sendMessage);
  msgInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Typing indicator
  msgInput?.addEventListener('input', () => {
    autoResize(msgInput);
    if (!isTyping && activeUserId) {
      isTyping = true;
      socket.emit('typing', { other_id: activeUserId });
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      if (activeUserId) socket.emit('stop_typing', { other_id: activeUserId });
    }, 1500);
  });

  // Search users
  const searchInput = qs('#userSearch');
  let searchTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      if (!q) { loadConversations(); return; }
      fetch(`/api/users/search?q=${encodeURIComponent(q)}`).then(r => r.json()).then(users => {
        const list = qs('#convList');
        list.innerHTML = '';
        users.forEach(u => {
          const item = document.createElement('div');
          item.className = 'sidebar-item';
          item.innerHTML = `
            <div class="avatar-wrap">${makeAvatar(u)}</div>
            <div class="sidebar-item-info">
              <div class="sidebar-item-name">${u.username}</div>
              <div class="sidebar-item-preview">${u.is_online ? '🟢 Online' : '⚫ Offline'}</div>
            </div>`;
          item.addEventListener('click', () => { searchInput.value = ''; openChat(u.id); });
          list.appendChild(item);
        });
      });
    }, 300);
  });

  // Socket events
  socket.on('new_message', msg => {
    if ((msg.sender_id === activeUserId || msg.receiver_id === activeUserId)) {
      appendMessage(msg);
      if (msg.sender_id === activeUserId) socket.emit('message_seen', { sender_id: activeUserId });
    }
    loadConversations();
  });

  socket.on('user_typing', data => {
    if (data.user_id === activeUserId) {
      qs('#chatPartnerStatus').textContent = 'typing…';
      qs('#chatPartnerStatus').className = 'typing-status';
    }
  });

  socket.on('user_stop_typing', data => {
    if (data.user_id === activeUserId) {
      fetch(`/api/users/${activeUserId}`).then(r => r.json()).then(u => {
        qs('#chatPartnerStatus').textContent = u.is_online ? 'Online' : 'Offline';
        qs('#chatPartnerStatus').className = 'chat-header-status' + (u.is_online ? '' : ' offline');
      });
    }
  });

  socket.on('user_online', data => {
    if (data.user_id === activeUserId) {
      qs('#chatPartnerStatus').textContent = 'Online';
      qs('#chatPartnerStatus').className = 'chat-header-status';
    }
    loadConversations();
  });

  socket.on('user_offline', data => {
    if (data.user_id === activeUserId) {
      qs('#chatPartnerStatus').textContent = 'Offline';
      qs('#chatPartnerStatus').className = 'chat-header-status offline';
    }
    loadConversations();
  });

  socket.on('messages_seen', () => {
    qsa('.msg-status').forEach(el => { el.className = 'msg-status seen'; el.textContent = '✓✓'; });
  });

  // Mobile back button
  qs('#backBtn')?.addEventListener('click', () => {
    qs('.sidebar').classList.remove('hidden');
    activeUserId = null;
    qs('#welcomeScreen').style.display = '';
    qs('#chatContainer').style.display = 'none';
  });

  qs('#menuToggle')?.addEventListener('click', () => {
    qs('.sidebar').classList.toggle('hidden');
  });
})();

// ── Groups Page ────────────────────────────────────────────────
(function initGroups() {
  if (!qs('.groups-page')) return;

  const socket = io();
  let currentUser = null;
  let activeGroupId = null;

  fetch('/api/me').then(r => r.json()).then(u => {
    currentUser = u;
    loadGroups();
    const params = new URLSearchParams(location.search);
    const gid = params.get('id');
    if (gid) openGroup(parseInt(gid));
  });

  function loadGroups() {
    fetch('/api/groups').then(r => r.json()).then(groups => {
      const list = qs('#groupList');
      list.innerHTML = '';
      if (!groups.length) {
        list.innerHTML = `<div class="empty-state" style="padding:30px 16px"><div class="empty-icon">👥</div><p>No groups yet</p></div>`;
        return;
      }
      groups.forEach(g => {
        const item = document.createElement('div');
        item.className = `sidebar-item ${activeGroupId === g.id ? 'active' : ''}`;
        item.dataset.groupId = g.id;
        item.innerHTML = `
          <div class="avatar-wrap">
            ${g.photo ? `<div class="avatar"><img src="${g.photo}"></div>` : `<div class="avatar">${g.name[0].toUpperCase()}</div>`}
          </div>
          <div class="sidebar-item-info">
            <div class="sidebar-item-name">${g.name}</div>
            <div class="sidebar-item-preview">${g.last_message ? (g.last_message.content || '📎 Attachment') : 'No messages yet'}</div>
          </div>
          <div class="sidebar-item-meta">
            ${g.last_message ? `<div class="sidebar-item-time">${timeAgo(g.last_message.created_at)}</div>` : ''}
          </div>`;
        item.addEventListener('click', () => openGroup(g.id));
        list.appendChild(item);
      });
    });
  }

  function openGroup(groupId) {
    activeGroupId = groupId;
    qs('.sidebar').classList.add('hidden');
    socket.emit('join_group', { group_id: groupId });

    fetch(`/api/groups/${groupId}`).then(r => r.json()).then(group => {
      qs('#groupName').textContent = group.name;
      qs('#groupMemberCount').textContent = `${group.member_count || group.members?.length} members`;
      if (group.photo) {
        qs('#groupHeaderAvatar').innerHTML = `<div class="avatar sm"><img src="${group.photo}"></div>`;
      } else {
        qs('#groupHeaderAvatar').innerHTML = `<div class="avatar sm">${group.name[0].toUpperCase()}</div>`;
      }
      qs('#welcomeScreen').style.display = 'none';
      qs('#chatContainer').style.display = 'flex';
      renderGroupMembers(group);
    });

    fetch(`/api/groups/${groupId}/messages`).then(r => r.json()).then(msgs => {
      const area = qs('#chatArea');
      area.innerHTML = '';
      msgs.forEach(m => appendGroupMessage(m));
      area.scrollTop = area.scrollHeight;
    });

    qsa('.sidebar-item').forEach(i => i.classList.toggle('active', parseInt(i.dataset.groupId) === groupId));
  }

  function renderGroupMembers(group) {
    const panel = qs('#membersPanel');
    if (!panel) return;
    panel.innerHTML = `<div style="font-weight:600;font-size:.9rem;margin-bottom:12px">Members (${group.members?.length || 0})</div>`;
    (group.members || []).forEach(m => {
      const div = document.createElement('div');
      div.className = 'member-item';
      div.innerHTML = `
        ${makeAvatar(m, 'sm')}
        <div style="flex:1;min-width:0">
          <div style="font-size:.88rem;font-weight:500">${m.username}</div>
          ${m.id === group.admin_id ? '<div class="member-role">Admin</div>' : ''}
        </div>
        ${(group.is_admin && m.id !== currentUser?.id) ? `<button class="btn btn-danger btn-sm" onclick="removeMember(${group.id}, ${m.id})">✕</button>` : ''}`;
      panel.appendChild(div);
    });
  }

  window.removeMember = function(gid, uid) {
    if (!confirm('Remove this member?')) return;
    fetch(`/api/groups/${gid}/members/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: uid }) })
      .then(r => r.json()).then(d => { if (d.success) { openGroup(gid); toast('Member removed', 'success'); } });
  };

  function appendGroupMessage(msg) {
    const area = qs('#chatArea');
    const isSent = msg.sender_id === currentUser?.id;
    const div = document.createElement('div');
    div.className = `msg-wrap ${isSent ? 'sent' : 'received'}`;
    div.innerHTML = `
      <div class="msg-bubble ${isSent ? 'sent' : 'received'}">
        ${!isSent ? `<div class="msg-sender-name">${msg.sender_username}</div>` : ''}
        ${renderMsgContentGroup(msg)}
        <div class="msg-meta">
          <span class="msg-time">${formatTime(msg.created_at)}</span>
        </div>
      </div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  function renderMsgContentGroup(msg) {
    let html = '';
    if (msg.file_url) {
      if (msg.file_type === 'image') html += `<img class="msg-image" src="${msg.file_url}" onclick="openLightbox('${msg.file_url}')">`;
      else if (msg.file_type === 'video') html += `<video class="msg-video" src="${msg.file_url}" controls></video>`;
      else html += `<a class="msg-file-card" href="${msg.file_url}" download><span class="msg-file-icon">📎</span><div class="msg-file-name">${msg.file_name || 'File'}</div></a>`;
    }
    if (msg.content) html += `<div>${escapeHtml(msg.content)}</div>`;
    return html;
  }

  // Send message
  const sendBtn = qs('#sendBtn');
  const msgInput = qs('#msgInput');
  const fileInput = qs('#fileInput');
  let pendingFile = null;

  qs('#attachBtn')?.addEventListener('click', () => fileInput.click());
  fileInput?.addEventListener('change', () => {
    pendingFile = fileInput.files[0];
    if (pendingFile) { qs('#filePreviewBar').classList.add('show'); qs('#filePreviewName').textContent = pendingFile.name; }
  });
  qs('#fileClearBtn')?.addEventListener('click', () => { pendingFile = null; fileInput.value = ''; qs('#filePreviewBar').classList.remove('show'); });

  async function sendMsg() {
    if (!activeGroupId || (!msgInput.value.trim() && !pendingFile)) return;
    const fd = new FormData();
    fd.append('group_id', activeGroupId);
    if (msgInput.value.trim()) fd.append('content', msgInput.value.trim());
    if (pendingFile) fd.append('file', pendingFile);
    msgInput.value = ''; autoResize(msgInput); pendingFile = null; fileInput.value = ''; qs('#filePreviewBar').classList.remove('show');
    await fetch('/api/chat/send', { method: 'POST', body: fd });
  }

  sendBtn?.addEventListener('click', sendMsg);
  msgInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  msgInput?.addEventListener('input', () => autoResize(msgInput));

  socket.on('new_group_message', msg => {
    if (msg.group_id === activeGroupId) appendGroupMessage(msg);
    loadGroups();
  });

  qs('#backBtn')?.addEventListener('click', () => { qs('.sidebar').classList.remove('hidden'); activeGroupId = null; qs('#welcomeScreen').style.display = ''; qs('#chatContainer').style.display = 'none'; });
  qs('#menuToggle')?.addEventListener('click', () => qs('.sidebar').classList.toggle('hidden'));

  // Create group modal
  const createGroupBtn = qs('#createGroupBtn');
  createGroupBtn?.addEventListener('click', () => {
    loadUsersForGroup();
    openModal('createGroupModal');
  });

  function loadUsersForGroup() {
    fetch('/api/users/search').then(r => r.json()).then(users => {
      const list = qs('#groupUsersList');
      list.innerHTML = users.map(u => `
        <label class="user-list-item">
          <input type="checkbox" value="${u.id}">
          ${makeAvatar(u, 'sm')}
          <span>${u.username}</span>
        </label>`).join('');
    });
  }

  qs('#createGroupForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const checked = qsa('#groupUsersList input:checked').map(i => i.value);
    const fd = new FormData();
    fd.append('name', form.groupName.value);
    fd.append('description', form.groupDesc.value);
    fd.append('member_ids', JSON.stringify(checked));
    if (form.groupPhoto.files[0]) fd.append('photo', form.groupPhoto.files[0]);
    const res = await fetch('/api/groups/create', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) { closeModal('createGroupModal'); loadGroups(); toast('Group created!', 'success'); }
    else toast(data.error, 'error');
  });
})();

// ── Pulse Page ─────────────────────────────────────────────────
(function initPulse() {
  if (!qs('.pulse-page')) return;

  const socket = io();
  let currentUser = null;

  fetch('/api/me').then(r => r.json()).then(u => { currentUser = u; loadPulses(); });

  function loadPulses() {
    fetch('/api/pulses').then(r => r.json()).then(pulses => {
      const grid = qs('#pulseGrid');
      grid.innerHTML = '';
      if (!pulses.length) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><h3>No pulses yet</h3><p>Be the first to share a pulse!</p></div>`;
        return;
      }
      pulses.forEach(p => {
        const div = document.createElement('div');
        div.className = 'pulse-card';
        div.id = `pulse-${p.id}`;
        div.innerHTML = renderPulseCard(p, p.user_id === currentUser?.id);
        grid.appendChild(div);
      });
      bindPulseActions();
    });
  }

  socket.on('new_pulse', pulse => {
    const grid = qs('#pulseGrid');
    const div = document.createElement('div');
    div.className = 'pulse-card';
    div.id = `pulse-${pulse.id}`;
    div.innerHTML = renderPulseCard(pulse, pulse.user_id === currentUser?.id);
    grid.prepend(div);
    bindPulseActions();
  });

  // Create pulse
  qs('#createPulseBtn')?.addEventListener('click', () => openModal('createPulseModal'));

  const mediaInput = qs('#pulseMediaInput');
  const mediaPreview = qs('#pulseMediaPreview');
  qs('#pulseMediaBtn')?.addEventListener('click', () => mediaInput.click());
  mediaInput?.addEventListener('change', () => {
    const f = mediaInput.files[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = ev => {
        mediaPreview.innerHTML = f.type.startsWith('video') ?
          `<video src="${ev.target.result}" style="max-width:100%;border-radius:8px" controls></video>` :
          `<img src="${ev.target.result}" style="max-width:100%;border-radius:8px">`;
      };
      reader.readAsDataURL(f);
    }
  });

  qs('#createPulseForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData();
    fd.append('content', form.pulseText.value);
    if (mediaInput.files[0]) fd.append('media', mediaInput.files[0]);
    const res = await fetch('/api/pulses/create', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) { closeModal('createPulseModal'); form.reset(); mediaPreview.innerHTML = ''; toast('Pulse shared!', 'success'); }
    else toast(data.error, 'error');
  });
})();

// ── Pulse Helpers (shared) ────────────────────────────────────
function renderPulseCard(p, isOwn) {
  let mediaHtml = '';
  if (p.media_url) {
    if (p.media_type === 'image') mediaHtml = `<img class="pulse-media" src="${p.media_url}" onclick="openLightbox('${p.media_url}')">`;
    else if (p.media_type === 'video') mediaHtml = `<video class="pulse-media" src="${p.media_url}" controls></video>`;
  }
  const hasText = p.content && p.content.trim();
  const textHtml = hasText ? (p.media_url ? `<div class="pulse-text">${escapeHtml(p.content)}</div>` : `<div class="pulse-text-only">${escapeHtml(p.content)}</div>`) : '';

  return `${mediaHtml}
    <div class="pulse-body">
      <div class="pulse-user">
        <div class="avatar sm">${(p.username || '?')[0].toUpperCase()}</div>
        <span class="pulse-username">${p.username}</span>
        <span class="pulse-time">${timeAgo(p.created_at)}</span>
      </div>
      ${textHtml}
    </div>
    ${isOwn ? `<div class="pulse-actions"><button class="btn btn-danger btn-sm" data-pulse-id="${p.id}">Delete</button></div>` : ''}`;
}

function bindPulseActions() {
  qsa('[data-pulse-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.pulseId;
      if (!confirm('Delete this pulse?')) return;
      const res = await fetch(`/api/pulses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { qs(`#pulse-${id}`)?.remove(); toast('Pulse deleted', 'success'); }
    });
  });
}

// ── Delete Account Page ───────────────────────────────────────
(function initDeleteAccount() {
  const form = qs('#deleteAccountForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const confirm2 = qs('#confirmDelete');
    if (!confirm2.checked) { toast('Please confirm you understand', 'warning'); return; }
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    const data = await res.json();
    if (data.success) { toast('Account deleted', 'success'); setTimeout(() => window.location = '/', 1500); }
    else toast(data.error, 'error');
  });
})();

// ── Lightbox ──────────────────────────────────────────────────
window.openLightbox = function(src) {
  let lb = qs('#lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.innerHTML = '<img id="lightboxImg">';
    lb.addEventListener('click', () => lb.classList.remove('open'));
    document.body.appendChild(lb);
  }
  qs('#lightboxImg').src = src;
  lb.classList.add('open');
};

// ── Helpers ───────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}
