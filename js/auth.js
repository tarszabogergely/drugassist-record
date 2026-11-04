/**
 * DrugAssist Record - Profiles Table Direct Authentication (No Reload)
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const btnLoginSubmit = document.getElementById('btn-login-submit');
  const userDisplay = document.getElementById('user-email-display');
  const btnLogout = document.getElementById('btn-logout');

  // Munkamenet ellenőrzése az oldal betöltésekor
  checkSession();

  // Bejelentkezés gomb kattintás
  if (btnLoginSubmit) {
    btnLoginSubmit.addEventListener('click', async () => {
      await performLogin();
    });
  }

  // Enter billentyű támogatása a jelszó mezőben
  if (loginPassword) {
    loginPassword.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await performLogin();
      }
    });
  }

  async function performLogin() {
    const username = loginUsername.value.trim().toLowerCase();
    const password = loginPassword.value.trim();

    if (!username || !password) {
      alert('Kérjük, adja meg a felhasználónevet és a jelszót!');
      return;
    }

    btnLoginSubmit.disabled = true;
    btnLoginSubmit.innerText = 'Bejelentkezés...';

    try {
      // Direct Query a Supabase profiles táblából (db használata supabase helyett!)
      const { data: user, error } = await db
        .from('profiles')
        .select('id, username, full_name, role')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();

      if (error) {
        console.error('Supabase hiba:', error);
        alert('Adatbázis hiba: ' + error.message);
      } else if (!user) {
        alert('Hibás felhasználónév vagy jelszó!');
      } else {
        // Sikeres bejelentkezés -> Elmentjük a munkamenetet
        sessionStorage.setItem('drugassist_user', JSON.stringify(user));
        updateUI(user);
      }
    } catch (err) {
      console.error('Rendszerhiba:', err);
      alert('Nem sikerült kapcsolódni a Supabase-hez: ' + err.message);
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.innerText = 'Bejelentkezés';
    }
  }

  // Kijelentkezés
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      sessionStorage.removeItem('drugassist_user');
      updateUI(null);
    });
  }

  function checkSession() {
    const savedUser = sessionStorage.getItem('drugassist_user');
    if (savedUser) {
      updateUI(JSON.parse(savedUser));
    } else {
      updateUI(null);
    }
  }

  function updateUI(user) {
    if (user) {
      if (loginContainer) loginContainer.classList.add('hidden');
      if (dashboardContainer) dashboardContainer.classList.remove('hidden');
      if (userDisplay) {
        const roleName = user.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens';
        userDisplay.innerText = `${user.full_name} (${roleName})`;
      }
    } else {
      if (loginContainer) loginContainer.classList.remove('hidden');
      if (dashboardContainer) dashboardContainer.classList.add('hidden');
      if (userDisplay) userDisplay.innerText = '--';
    }
  }
});
