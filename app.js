// ==========================================================
//  ระบบจัดการการสอบ โรงเรียนศรีสุตาวิทยา — Frontend Logic
// ==========================================================

const CONFIG = {
  // วาง Web App URL จาก Google Apps Script ที่นี่ (Deploy > Web app)
  API_URL: 'https://script.google.com/macros/s/AKfycbwxonhgR_HYClaqjMl4nVwYE4VsKnZB6i02AN5SEVSzoESYjRKRzrAwim9nDpeRsWC4/exec'
};

const CLASS_COLORS = {
  'ม.1': '#0F3D3E',
  'ม.2': '#16544f',
  'ม.3': '#C9A455',
  'ม.4': '#B45309',
  'ม.5': '#7C2D12',
  'ม.6': '#991B1B'
};

// ---------- State ----------
let state = {
  view: 'home',       // home | student | staff
  session: null,       // ข้อมูลผู้ใช้ปัจจุบัน
  pendingDeleteId: null
};

const appEl = document.getElementById('app');

// ---------- Helpers: API ----------
async function callApi(action, payload = {}) {
  try {
    const params = new URLSearchParams(Object.assign({ action }, payload));
    const url = CONFIG.API_URL + '?' + params.toString();
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('เครือข่ายขัดข้อง');
    return await res.json();
  } catch (err) {
    return { success: false, message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง' };
  }
}

// ---------- Helpers: Toast ----------
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `animate-toast rounded-xl px-4 py-3 shadow-lg text-sm font-medium flex items-center gap-2 ${type === 'success' ? 'toast-success' : 'toast-error'}`;
  toast.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      ${type === 'success'
        ? '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>'}
    </svg>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setLoading(btn, loading, labelWhenIdle) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<div class="spinner"></div>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = labelWhenIdle || btn.dataset.originalHtml || btn.innerHTML;
  }
}

// ---------- ป้องกันการปิดหน้าต่างโดยไม่ตั้งใจ ----------
window.addEventListener('beforeunload', function (e) {
  if (state.session) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ==========================================================
//  RENDER: หน้าแรก
// ==========================================================
function renderHome() {
  appEl.innerHTML = '';
  const tpl = document.getElementById('tpl-home').content.cloneNode(true);
  appEl.appendChild(tpl);

  const input = document.getElementById('classCodeInput');
  const errorEl = document.getElementById('classCodeError');
  const btn = document.getElementById('btnStudentLogin');

  async function doStudentLogin() {
    const code = input.value.trim();
    errorEl.classList.add('hidden');
    input.classList.remove('is-invalid');

    if (!code) {
      errorEl.textContent = 'กรุณากรอกรหัสชั้นเรียน';
      errorEl.classList.remove('hidden');
      input.classList.add('is-invalid');
      return;
    }

    setLoading(btn, true);
    const result = await callApi('studentLogin', { classCode: code });
    setLoading(btn, false, '<span>เข้าสู่ระบบ</span>');

    if (!result.success) {
      errorEl.textContent = result.message || 'รหัสชั้นเรียนไม่ถูกต้อง';
      errorEl.classList.remove('hidden');
      input.classList.add('is-invalid');
      return;
    }

    state.session = { role: 'student', classCode: result.classCode, classLevel: result.classLevel };
    state.view = 'student';
    renderStudent();
  }

  btn.addEventListener('click', doStudentLogin);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doStudentLogin(); });

  document.getElementById('btnShowStaffLogin').addEventListener('click', renderStaffLoginModal);
}

// ==========================================================
//  RENDER: Modal Login ครู/Admin
// ==========================================================
function renderStaffLoginModal() {
  const tpl = document.getElementById('tpl-staff-modal').content.cloneNode(true);
  document.body.appendChild(tpl);

  const backdrop = document.getElementById('staffModalBackdrop');
  const userInput = document.getElementById('staffUsername');
  const passInput = document.getElementById('staffPassword');
  const errorEl = document.getElementById('staffLoginError');
  const btn = document.getElementById('btnStaffLogin');

  function close() { backdrop.remove(); }

  document.getElementById('btnCloseStaffModal').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  async function doLogin() {
    const username = userInput.value.trim();
    const password = passInput.value.trim();
    errorEl.classList.add('hidden');
    userInput.classList.remove('is-invalid');
    passInput.classList.remove('is-invalid');

    if (!username || !password) {
      errorEl.textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน';
      errorEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    const result = await callApi('teacherLogin', { username, password });
    setLoading(btn, false, '<span>เข้าสู่ระบบ</span>');

    if (!result.success) {
      errorEl.textContent = result.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      errorEl.classList.remove('hidden');
      userInput.classList.add('is-invalid');
      passInput.classList.add('is-invalid');
      return;
    }

    state.session = { role: result.role, username: result.username, fullName: result.fullName };
    state.view = 'staff';
    close();
    renderStaffDashboard();
  }

  btn.addEventListener('click', doLogin);
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ==========================================================
//  RENDER: หน้านักเรียน
// ==========================================================
async function renderStudent() {
  appEl.innerHTML = '';
  const tpl = document.getElementById('tpl-student').content.cloneNode(true);
  appEl.appendChild(tpl);

  document.getElementById('studentClassLevel').textContent = state.session.classLevel;
  document.getElementById('btnLogoutStudent').addEventListener('click', logout);

  const listEl = document.getElementById('studentSubjectList');
  listEl.innerHTML = `<div class="text-center text-sm text-gray-400 py-6">กำลังโหลดข้อมูล...</div>`;

  const result = await callApi('getSubjectsForStudent', { classCode: state.session.classCode });

  if (!result.success) {
    listEl.innerHTML = `<div class="text-center text-sm text-red-500 py-6">${escapeHtml(result.message || 'เกิดข้อผิดพลาด')}</div>`;
    return;
  }

  const subjects = result.subjects || [];
  document.getElementById('studentSubjectCount').textContent = subjects.length;

  if (subjects.length === 0) {
    listEl.innerHTML = `<div class="text-center text-sm text-gray-400 py-10">ยังไม่มีวิชาที่เปิดให้สอบในขณะนี้</div>`;
    return;
  }

  listEl.innerHTML = subjects.map(s => `
    <div class="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4 hover:shadow-md transition" style="background:#fff;">
      <div class="min-w-0">
        <p class="font-semibold text-sm truncate">${escapeHtml(s.subjectName)} (${escapeHtml(s.classLevel)})</p>
        <p class="text-xs text-gray-500 mt-0.5 truncate">ครูประจำวิชา: ${escapeHtml(s.teacherFullName || '-')}</p>
      </div>
      <a href="${escapeHtml(s.examLink)}" target="_blank" rel="noopener"
        class="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex-shrink-0 text-center">
        เข้าสอบ
      </a>
    </div>
  `).join('');
}

// ==========================================================
//  RENDER: หน้าครู / Admin (Dashboard)
// ==========================================================
async function renderStaffDashboard() {
  appEl.innerHTML = '';
  const tpl = document.getElementById('tpl-staff-dashboard').content.cloneNode(true);
  appEl.appendChild(tpl);

  const isAdmin = state.session.role === 'admin';

  document.getElementById('staffFullName').textContent = state.session.fullName;
  document.getElementById('staffRoleLabel').textContent = isAdmin ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน';
  document.getElementById('btnLogoutStaff').addEventListener('click', logout);
  document.getElementById('btnAddSubject').addEventListener('click', () => openSubjectModal(null));

  // หน้าครู (ไม่ใช่ admin) ไม่ต้องแสดงคอลัมน์ครูประจำวิชา และไม่ต้องมี filter
  if (!isAdmin) {
    document.getElementById('thTeacherCol').remove();
    document.getElementById('classFilterWrap').classList.add('hidden');
  } else {
    document.getElementById('classFilter').addEventListener('change', () => loadStaffSubjects());
  }

  await loadStaffSubjects();
}

async function loadStaffSubjects() {
  const tbody = document.getElementById('staffSubjectTableBody');
  const emptyState = document.getElementById('staffEmptyState');
  tbody.innerHTML = `<tr><td colspan="4" class="text-center text-sm text-gray-400 py-8">กำลังโหลดข้อมูล...</td></tr>`;

  const isAdmin = state.session.role === 'admin';
  let result;
  if (isAdmin) {
    const filterVal = document.getElementById('classFilter')?.value || 'all';
    result = await callApi('getSubjectsForAdmin', { classLevel: filterVal });
  } else {
    result = await callApi('getSubjectsForTeacher', { username: state.session.username });
  }

  if (!result.success) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-sm text-red-500 py-8">${escapeHtml(result.message || 'เกิดข้อผิดพลาด')}</td></tr>`;
    return;
  }

  const subjects = result.subjects || [];
  document.getElementById('staffSubjectCount').textContent = subjects.length;

  if (subjects.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  tbody.innerHTML = subjects.map(s => {
    const color = CLASS_COLORS[s.classLevel] || '#0F3D3E';
    const canEdit = isAdmin || s.teacherUsername === state.session.username;
    return `
      <tr class="border-b border-gray-100">
        <td class="py-3 pr-3">
          <span class="inline-flex items-center gap-1.5 text-sm font-medium" style="color:${color};">
            <span class="class-dot" style="background:${color};"></span>${escapeHtml(s.classLevel)}
          </span>
        </td>
        <td class="py-3 pr-3 text-sm">${escapeHtml(s.subjectName)}</td>
        ${isAdmin ? `<td class="py-3 pr-3 text-sm text-gray-600">${escapeHtml(s.teacherFullName || '-')}</td>` : ''}
        <td class="py-3 pr-3 text-right whitespace-nowrap">
          <button class="text-xs font-medium text-gray-500 hover:text-emerald-600 mr-3 transition" onclick="checkExamLink('${escapeAttr(s.examLink)}')">ตรวจสอบ</button>
          ${canEdit ? `
            <button class="text-xs font-medium text-gray-500 hover:text-amber-600 mr-3 transition" onclick="openSubjectModal('${s.id}')">แก้ไข</button>
            <button class="text-xs font-medium text-gray-500 hover:text-red-600 transition" onclick="confirmDeleteSubject('${s.id}')">ลบ</button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// ---------- Modal: เพิ่ม/แก้ไขวิชา ----------
let subjectModalEditingId = null;
let cachedSubjectsForEdit = [];

async function openSubjectModal(subjectId) {
  subjectModalEditingId = subjectId;
  const tpl = document.getElementById('tpl-subject-modal').content.cloneNode(true);
  document.body.appendChild(tpl);

  const backdrop = document.getElementById('subjectModalBackdrop');
  const title = document.getElementById('subjectModalTitle');
  const classLevelEl = document.getElementById('subjectClassLevel');
  const nameEl = document.getElementById('subjectName');
  const linkEl = document.getElementById('subjectExamLink');
  const saveBtn = document.getElementById('btnSaveSubject');

  function close() { backdrop.remove(); }
  document.getElementById('btnCloseSubjectModal').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

  if (subjectId) {
    title.textContent = 'แก้ไขข้อมูลวิชา';
    // ดึงข้อมูลปัจจุบันจากตารางที่แสดงอยู่ (โหลดมาแล้วก่อนหน้า)
    const isAdmin = state.session.role === 'admin';
    const result = isAdmin
      ? await callApi('getSubjectsForAdmin', { classLevel: 'all' })
      : await callApi('getSubjectsForTeacher', { username: state.session.username });
    const found = (result.subjects || []).find(s => s.id === subjectId);
    if (found) {
      classLevelEl.value = found.classLevel;
      nameEl.value = found.subjectName;
      linkEl.value = found.examLink;
    }
  }

  function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.classList.add('hidden'));
    [classLevelEl, nameEl, linkEl].forEach(el => el.classList.remove('is-invalid'));
  }

  function showFieldError(el) {
    el.classList.add('is-invalid');
    const err = document.querySelector(`.field-error[data-for="${el.id}"]`);
    if (err) err.classList.remove('hidden');
  }

  async function handleSave() {
    clearFieldErrors();
    let hasError = false;
    if (!classLevelEl.value) { showFieldError(classLevelEl); hasError = true; }
    if (!nameEl.value.trim()) { showFieldError(nameEl); hasError = true; }
    if (!linkEl.value.trim()) { showFieldError(linkEl); hasError = true; }
    if (hasError) return;

    setLoading(saveBtn, true);

    let result;
    if (subjectModalEditingId) {
      result = await callApi('updateSubject', {
        id: subjectModalEditingId,
        classLevel: classLevelEl.value,
        subjectName: nameEl.value.trim(),
        examLink: linkEl.value.trim(),
        username: state.session.username,
        role: state.session.role
      });
    } else {
      result = await callApi('addSubject', {
        classLevel: classLevelEl.value,
        subjectName: nameEl.value.trim(),
        examLink: linkEl.value.trim(),
        teacherUsername: state.session.username,
        teacherFullName: state.session.fullName
      });
    }

    setLoading(saveBtn, false, '<span>บันทึกข้อมูล</span>');

    if (!result.success) {
      showToast(result.message || 'เกิดข้อผิดพลาด ไม่สามารถบันทึกได้', 'error');
      return;
    }

    showToast(result.message || 'บันทึกข้อมูลสำเร็จ', 'success');
    close();
    loadStaffSubjects();
  }

  saveBtn.addEventListener('click', handleSave);
}

// ---------- ตรวจสอบลิงก์ข้อสอบ ----------
function checkExamLink(examLink) {
  if (!examLink) {
    showToast('ไม่พบลิงก์ข้อสอบสำหรับวิชานี้', 'error');
    return;
  }
  window.open(examLink, '_blank', 'noopener');
}

// ---------- ลบวิชา ----------
async function confirmDeleteSubject(subjectId) {
  if (!window.confirm('ยืนยันการลบวิชานี้? การลบไม่สามารถย้อนกลับได้')) return;

  const result = await callApi('deleteSubject', {
    id: subjectId,
    username: state.session.username,
    role: state.session.role
  });

  if (!result.success) {
    showToast(result.message || 'ไม่สามารถลบข้อมูลได้', 'error');
    return;
  }
  showToast(result.message || 'ลบข้อมูลสำเร็จ', 'success');
  loadStaffSubjects();
}

// ---------- Logout ----------
function logout() {
  if (!window.confirm('ยืนยันการออกจากระบบ?')) return;
  state.session = null;
  state.view = 'home';
  renderHome();
}

// ---------- เริ่มต้นแอป ----------
renderHome();
