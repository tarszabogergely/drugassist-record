/**
 * DrugAssist Record - Felhasználók (Profiles) Kezelése Modul
 */

document.addEventListener('DOMContentLoaded', () => {
  let allUsers = [];

  // DOM elemek
  const usersTableBody = document.getElementById('users-table-body');
  const totalUsersCount = document.getElementById('total-users-count');
  const btnRefreshUsers = document.getElementById('btn-refresh-users');
  const btnOpenAddUser = document.getElementById('btn-open-add-user');

  const userModal = document.getElementById('user-modal');
  const userModalTitle = document.getElementById('user-modal-title');
  const btnCloseUserModal = document.getElementById('btn-close-user-modal');
  const btnCancelUser = document.getElementById('btn-cancel-user');

  const userForm = document.getElementById('user-form');
  const userIdInput = document.getElementById('user-id');
  const usernameInput = document.getElementById('input-username');
  const fullnameInput = document.getElementById('input-fullname');
  const passwordInput = document.getElementById('input-password');
  const roleSelect = document.getElementById('select-role');

  // 1. Munkamenet ellenőrzése
  const savedUser = sessionStorage.getItem('drugassist_user');
  if (!savedUser) {
    alert('Kérjük, jelentkezzen be!');
    window.location.href = '../index.html';
    return;
  }
  const currentUser = JSON.parse(savedUser);
  const userDisp = document.getElementById('user-display');
  if (userDisp) {
    userDisp.innerText = `${currentUser.full_name} (${currentUser.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens'})`;
  }

  // 2. Felhasználók (profiles) betöltése Supabase-ből
  loadUsersData();

  if (btnRefreshUsers) {
    btnRefreshUsers.addEventListener('click', loadUsersData);
  }

  async function loadUsersData() {
    try {
      usersTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Felhasználók betöltése...</td></tr>';

      const { data: profiles, error } = await db
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;

      allUsers = profiles || [];
      renderUsersTable(allUsers);
    } catch (err) {
      console.error('Hiba a felhasználók betöltésekor:', err);
      usersTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Hiba történt a felhasználók betöltése során!</td></tr>';
    }
  }

  function renderUsersTable(list) {
    totalUsersCount.innerText = list.length;

    if (list.length === 0) {
      usersTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Még nincs rögzített felhasználó a rendszerben.</td></tr>';
      return;
    }

    usersTableBody.innerHTML = list.map(u => {
      // Felismerjük mind a password_hash, mind a password mezőneveket
      const pwdVal = u.password_hash || u.password || '';
      return `
        <tr>
          <td><code>${u.username}</code></td>
          <td><strong>${u.full_name || '-'}</strong></td>
          <td>
            <span id="pwd-text-${u.id}">••••••••</span>
            <span class="password-toggle" onclick="togglePasswordVisibility('${u.id}', '${pwdVal}')" title="Jelszó megjelenítése/elrejtése" style="cursor:pointer; margin-left:0.5rem;">👁️</span>
          </td>
          <td>
            <span class="badge" style="background: ${u.role === 'pharmacist' ? '#8b5cf6' : '#3b82f6'}; color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.82rem;">
              ${u.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens'}
            </span>
          </td>
          <td style="white-space: nowrap;">
            <button type="button" onclick="editUser('${u.id}')" class="btn btn-primary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: #3b82f6;">Szerkesztés</button>
            <button type="button" onclick="deleteUser('${u.id}')" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: #dc2626; color: white; border: none;">Törlés</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Jelszó láthatóságának váltása
  window.togglePasswordVisibility = function(userId, realPassword) {
    const pwdSpan = document.getElementById(`pwd-text-${userId}`);
    if (!pwdSpan) return;

    if (pwdSpan.innerText === '••••••••') {
      pwdSpan.innerText = realPassword || '-';
    } else {
      pwdSpan.innerText = '••••••••';
    }
  };

  // 3. Modal Megnyitása (Új felhasználó)
  if (btnOpenAddUser) {
    btnOpenAddUser.addEventListener('click', () => {
      resetUserForm();
      userModalTitle.innerText = 'Új Felhasználó Felvétele';
      userModal.style.display = 'flex';
      usernameInput.focus();
    });
  }

  function resetUserForm() {
    userIdInput.value = '';
    usernameInput.value = '';
    fullnameInput.value = '';
    passwordInput.value = '';
    roleSelect.value = 'assistant';
  }

  // 4. Modal Megnyitása (Szerkesztés)
  window.editUser = function(userId) {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;

    userIdInput.value = targetUser.id;
    usernameInput.value = targetUser.username || '';
    fullnameInput.value = targetUser.full_name || '';
    passwordInput.value = targetUser.password_hash || targetUser.password || '';
    roleSelect.value = targetUser.role || 'assistant';

    userModalTitle.innerText = 'Felhasználó Szerkesztése';
    userModal.style.display = 'flex';
    usernameInput.focus();
  };

  // 5. Form Mentés (Beszúrás vagy Frissítés)
  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = userIdInput.value;
    const username = usernameInput.value.trim();
    const fullname = fullnameInput.value.trim();
    const password = passwordInput.value.trim();
    const role = roleSelect.value;

    if (!username || !fullname || !password) {
      alert('Kérjük, töltsön ki minden mezőt!');
      return;
    }

    try {
      const payload = {
        username: username,
        full_name: fullname,
        password_hash: password,
        role: role
      };

      if (id) {
        // Frissítés
        const { error } = await db
          .from('profiles')
          .update(payload)
          .eq('id', id);

        if (error) throw error;
        alert('Felhasználó sikeresen frissítve!');
      } else {
        // Új rekord beszúrása
        const { error } = await db
          .from('profiles')
          .insert([payload]);

        if (error) throw error;
        alert('Új felhasználó sikeresen hozzáadva!');
      }

      closeUserModal();
      loadUsersData();
    } catch (err) {
      console.error('Hiba a felhasználó mentésekor:', err);
      alert(`Hiba történt a mentés során!\n\nRészletek: ${err.message}`);
    }
  });

  // 6. Felhasználó Törlése
  window.deleteUser = async function(userId) {
    const targetUser = allUsers.find(u => u.id === userId);
    const userNameDisplay = targetUser ? targetUser.full_name : 'ezt a felhasználót';

    if (!confirm(`Biztosan törölni szeretné ${userNameDisplay} felhasználót?`)) return;

    try {
      const { error } = await db
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      alert('Felhasználó törölve!');
      loadUsersData();
    } catch (err) {
      console.error('Hiba a törlés során:', err);
      alert('Hiba történt a felhasználó törlése során!');
    }
  };

  // 7. Modal Bezárása & Esc kezelés
  if (btnCloseUserModal) btnCloseUserModal.addEventListener('click', closeUserModal);
  if (btnCancelUser) btnCancelUser.addEventListener('click', closeUserModal);

  function closeUserModal() {
    userModal.style.display = 'none';
    resetUserForm();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (userModal && userModal.style.display === 'flex') {
        closeUserModal();
      }
    }
  });
});
