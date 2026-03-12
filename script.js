/**
 * RezyumeBot — Real-time resume builder
 * ES6+ | XSS-safe | html2pdf export
 * Security: Input validation | CSP-compatible | Sandboxed state | URL Param Auto-fill
 */

// ===== JAVASCRIPT SANDBOX (IIFE) =====
(function(window) {
  'use strict';

  // ===== INPUT LENGTH LIMITS =====
  const INPUT_LIMITS = {
    fullName: 50,
    grade: 20,
    school: 100,
    phone: 20,
    email: 100,
    dream: 100,
    bio: 500,
    extraInterests: 200,
    extraHobbies: 200
  };

  // ===== STATE (PROTECTED) =====
  const state = {
    photoDataUrl: null,
    interests: new Set(),
    hobbies: new Set(),
    subjects: new Set(),
  };

  // ===== XSS PROTECTION =====
  /**
   * Escapes HTML special characters to prevent XSS attacks.
   * @param {string} str - Raw user input
   * @returns {string} Safe HTML string
   */
  const sanitize = (str) => {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };

  /**
   * Validates and truncates input to specified max length
   * @param {string} value - Input value
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} Validated and truncated value
   */
  const validateAndTruncate = (value, maxLength) => {
    if (value == null) return '';
    const str = String(value);
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  };

  // ===== DOM HELPERS =====
  const $ = (id) => document.getElementById(id);
  
  /**
   * Get sanitized and validated value from input
   */
  const val = (id) => {
    const el = $(id);
    if (!el) return '';
    const raw = el.value.trim();
    const limit = INPUT_LIMITS[id] || 200;
    return sanitize(validateAndTruncate(raw, limit));
  };

  // ===== URL PARAMETER AUTO-FILL (Bot Integration) =====
  /**
   * Load parameters from URL and auto-fill input fields
   * Called on window.onload
   */
  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const fields = ['fullName', 'grade', 'school', 'phone', 'email', 'dream', 'bio'];
    
    let hasData = false;
    
    fields.forEach(fieldId => {
      const value = params.get(fieldId);
      if (value) {
        const el = $(fieldId);
        if (el) {
          // Sanitize and validate before setting
          const sanitized = validateAndTruncate(sanitize(value), INPUT_LIMITS[fieldId] || 200);
          el.value = sanitized;
          hasData = true;
        }
      }
    });
    
    // Update preview if data was loaded
    if (hasData) {
      updatePreview();
    }
  }

  // ===== REAL-TIME PREVIEW =====

  /** Debounce: avoids updating on every keystroke, waits until user pauses */
  const debounce = (fn, delay = 120) => {
    let timer;
    return (...args) => { 
      clearTimeout(timer); 
      timer = setTimeout(() => fn(...args), delay); 
    };
  };

  const liveUpdate = debounce(() => updatePreview());

  // Attach live listeners to all text inputs & textarea
  ['fullName', 'grade', 'school', 'phone', 'email', 'dream', 'bio',
    'extraInterests', 'extraHobbies'].forEach((id) => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => {
        // Enforce max length on input
        if (el.value.length > (INPUT_LIMITS[id] || 200)) {
          el.value = el.value.substring(0, INPUT_LIMITS[id] || 200);
        }
        liveUpdate();
      });
    }
  });

  // ===== PREVIEW UPDATER =====
  function updatePreview() {
    const name        = val('fullName');
    const grade       = val('grade');
    const school      = val('school');
    const phone       = val('phone');
    const email       = val('email');
    const dream       = val('dream');
    const bio         = val('bio');

    const extraInterests = validateAndTruncate($('extraInterests')?.value.trim() || '', INPUT_LIMITS.extraInterests);
    const extraHobbies   = validateAndTruncate($('extraHobbies')?.value.trim() || '', INPUT_LIMITS.extraHobbies);

    // Parse extra comma-separated values with sanitization
    const splitExtra = (raw) => {
      if (!raw) return [];
      return raw.split(',')
        .map((s) => sanitize(s.trim()))
        .filter(Boolean)
        .slice(0, 10);
    };

    const allInterests = [...state.interests, ...splitExtra(extraInterests)];
    const allHobbies   = [...state.hobbies,   ...splitExtra(extraHobbies)];
    const allSubjects  = [...state.subjects];

    // Determine if there's something meaningful to show
    const hasContent = name || grade || school || dream;

    if (!hasContent) {
      $('previewEmpty').style.display = '';
      $('rvContent').style.display = 'none';
      return;
    }

    $('previewEmpty').style.display = 'none';
    const rvContent = $('rvContent');
    rvContent.style.display = '';

    // Avatar
    if (state.photoDataUrl) {
      $('rvAvatar').outerHTML;
      const avatarEl = $('rvAvatar');
      if (avatarEl.tagName === 'IMG') {
        avatarEl.src = state.photoDataUrl;
      } else {
        const img = document.createElement('img');
        img.id = 'rvAvatar';
        img.className = 'rv-avatar';
        img.src = state.photoDataUrl;
        img.alt = 'Profil rasmi';
        avatarEl.replaceWith(img);
      }
    }

    // Text fields - use textContent for security (NOT innerHTML)
    $('rvName').textContent         = name  || '—';
    $('rvGradeSchool').textContent  = [grade, school].filter(Boolean).join(' • ') || '—';
    $('rvDream').textContent        = dream || '—';

    // Contact
    const contactParts = [phone, email].filter(Boolean);
    $('rvContact').textContent = contactParts.join('  |  ');

    // Bio section
    const bioSection = $('rvBioSection');
    if (bio) {
      $('rvBio').textContent = bio;
      bioSection.style.display = '';
      fadeIn(bioSection);
    } else {
      bioSection.style.display = 'none';
    }

    // Tags - SECURED: use textContent instead of innerHTML
    renderTags('rvInterests', allInterests);
    renderTags('rvHobbies',   allHobbies);
    renderTags('rvSubjects',  allSubjects);

    // Fade-in animation on first show
    fadeIn(rvContent);
  }

  /** 
   * Render tag chips inside a container - SECURE VERSION
   * Uses textContent instead of innerHTML to prevent XSS
   */
  function renderTags(containerId, items) {
    const container = $(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!items.length) {
      const span = document.createElement('span');
      span.style.color = '#94a3b8';
      span.style.fontSize = '0.8rem';
      span.textContent = '—';
      container.appendChild(span);
      return;
    }

    // Limit number of tags to prevent DoS
    const limitedItems = items.slice(0, 20);
    
    limitedItems.forEach((item) => {
      const span = document.createElement('span');
      span.className = 'rv-tag rv-tag-anim';
      span.textContent = item;
      container.appendChild(span);
    });
  }

  // ===== FADE-IN ANIMATION =====
  function fadeIn(el) {
    el.classList.remove('fade-in');
    void el.offsetWidth;
    el.classList.add('fade-in');
  }

  // Inject fade-in keyframe once
  const animStyle = document.createElement('style');
  animStyle.textContent = `
    .fade-in { animation: fadeIn 0.3s ease both; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .rv-tag-anim { animation: tagPop 0.2s ease both; }
    @keyframes tagPop {
      from { opacity: 0; transform: scale(0.8); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes shake {
      0%,100%{transform:translateX(0)}
      20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}
      60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }
  `;
  document.head.appendChild(animStyle);

  // ===== CHIPS =====
  function initChips(gridId, stateKey) {
    const grid = $(gridId);
    if (!grid) return;
    
    grid.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.value;
        if (chip.classList.contains('selected')) {
          chip.classList.remove('selected');
          state[stateKey].delete(value);
        } else {
          chip.classList.add('selected');
          state[stateKey].add(value);
          fadeIn(chip);
        }
        liveUpdate();
      });
    });
  }

  initChips('interestsGrid', 'interests');
  initChips('hobbiesGrid',   'hobbies');
  initChips('subjectsGrid',  'subjects');

  // ===== PHOTO UPLOAD =====
  const photoUploadArea   = $('photoUploadArea');
  const uploadPlaceholder = $('uploadPlaceholder');
  const photoPreview      = $('photoPreview');
  const photoInput        = $('photoInput');

  $('uploadBtn').addEventListener('click', () => photoInput.click());
  photoUploadArea.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Rasm hajmi 5MB dan oshmasin!');
      return;
    }
    
    if (!file.type.startsWith('image/')) {
      showToast('Faqat rasm fayllari qabul qilinadi!');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!ev.target.result || !ev.target.result.startsWith('data:')) {
        showToast('Rasmni yuklashda xatolik!');
        return;
      }
      
      state.photoDataUrl = ev.target.result;

      photoPreview.src = ev.target.result;
      photoPreview.classList.add('show');
      uploadPlaceholder.style.display = 'none';

      const rvAvatar = $('rvAvatar');
      if (rvAvatar.tagName !== 'IMG') {
        const img = document.createElement('img');
        img.id        = 'rvAvatar';
        img.className = 'rv-avatar';
        img.src       = ev.target.result;
        img.alt       = 'Profil rasmi';
        rvAvatar.replaceWith(img);
      } else {
        rvAvatar.src = ev.target.result;
      }

      liveUpdate();
      showToast('Rasm yuklandi! 🎉', 'success');
    };
    
    reader.onerror = () => {
      showToast('Rasmni o\'qishda xatolik!');
    };
    
    reader.readAsDataURL(file);
  });

  // Drag & Drop
  photoUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = '#4f46e5';
  });
  photoUploadArea.addEventListener('dragleave', () => {
    photoUploadArea.style.borderColor = '';
  });
  photoUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    photoUploadArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      photoInput.files = e.dataTransfer.files;
      photoInput.dispatchEvent(new Event('change'));
    }
  });

  // ===== PDF EXPORT =====
  $('printBtn').addEventListener('click', async () => {
    const isEmpty = $('previewEmpty')?.style.display !== 'none' ||
      $('rvContent')?.style.display === 'none';

    if (isEmpty) {
      showToast('Avval ma\'lumotlarni kiriting!');
      return;
    }

    const btn = $('printBtn');
    btn.textContent = '⏳ Yuklanmoqda...';
    btn.disabled = true;

    const element = $('resumeExport');

    const opt = {
      margin:      [8, 8, 8, 8],
      filename:    'rezyume.pdf',
      image:       { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    try {
      await html2pdf().set(opt).from(element).save();
      showToast('PDF muvaffaqiyatli saqlandi! ✅', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('PDF saqlashda xatolik yuz berdi!');
    } finally {
      btn.textContent = '⬇️ PDF saqlash';
      btn.disabled = false;
    }
  });

  // ===== INPUT VALIDATION =====
  function validateRequired() {
    const required = [
      [$('fullName'), 'Ism va Familiyani kiriting'],
      [$('grade'),    'Sinfni kiriting'],
      [$('school'),   'Maktab nomini kiriting'],
      [$('dream'),    'Kasb orzuingizni kiriting'],
    ];
    let ok = true;
    required.forEach(([el, msg]) => {
      el.classList.remove('error');
      if (!el.value.trim()) {
        el.classList.add('error');
        shakeEl(el);
        ok = false;
      }
    });
    if (!ok) showToast('Iltimos, * bilan belgilangan maydonlarni to\'ldiring!');
    return ok;
  }

  ['fullName', 'grade', 'school', 'dream'].forEach((id) => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', () => el.classList.remove('error'));
    }
  });

  // ===== HELPERS =====
  function shakeEl(el) {
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = 'shake 0.35s ease';
    setTimeout(() => { el.style.animation = ''; }, 350);
  }

  function showToast(msg, type = 'error') {
    document.querySelector('.toast')?.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    Object.assign(t.style, {
      position:     'fixed',
      bottom:       '28px',
      left:         '50%',
      transform:    'translateX(-50%) translateY(20px)',
      background:   type === 'success' ? '#22c55e' : '#ef4444',
      color:        '#fff',
      padding:      '11px 22px',
      borderRadius: '10px',
      fontSize:     '0.9rem',
      fontWeight:   '600',
      zIndex:       '9999',
      boxShadow:    '0 4px 20px rgba(0,0,0,0.2)',
      animation:    'toastIn 0.3s ease forwards',
      fontFamily:   'inherit',
    });
    if (!document.querySelector('#toastKeyframe')) {
      const s = document.createElement('style');
      s.id = 'toastKeyframe';
      s.textContent = `@keyframes toastIn {to{transform:translateX(-50%) translateY(0);opacity:1}}`;
      document.head.appendChild(s);
    }
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity    = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  // ===== INIT =====
  // Bot Integration: Load from URL on page load
  window.addEventListener('DOMContentLoaded', () => {
    loadFromURL();
  });
  
  // Fallback to window.onload
  window.onload = () => {
    loadFromURL();
  };

})(window);
