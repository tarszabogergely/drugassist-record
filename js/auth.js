/**
 * DrugAssist Record - Authentication & Session Management Modul
 * Supabase Email / Password Auth & Role-based Session Handling
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elemek kijelölése
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const userEmailDisplay = document.getElementById('user-email-display');
  const btnLogout = document.getElementById('btn-logout');

  // 1. Munkamenet ellenőrzése az oldal betöltésekor
  await checkSession();

  // 2. Bejelentkezési űrlap beküldése
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();

      if (!email || !password) {
        alert('Kérjük, adja meg az e-mail címet és a jelszót!');
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Bejelentkezés...';

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          alert('Sikertelen bejelentkezés: ' + error.message);
        } else {
          // Sikeres bejelentkezés -> Felület frissítése
          updateUI(data.session?.user);
        }
      } catch (err) {
        console.error('Bejelentkezési hiba:', err);
        alert('Rendszerhiba történt a bejelentkezés során.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Bejelentkezés';
      }
    });
  }

  // 3. Kijelentkezés gomb eseménykezelője
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert('Hiba a kijelentkezéskor: ' + error.message);
      } else {
        updateUI(null);
      }
    });
  }

  // 4. Munkamenet állapotának ellenőrzése
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    updateUI(session?.user || null);

    // Munkamenet változások figyelése (pl. lejárat, kijelentkezés más ablakban)
    supabase.auth.onAuthStateChange((_event, session) => {
      updateUI(session?.user || null);
    });
  }

  // 5. Felület dinamikus váltása a munkamenet állapota alapján
  function updateUI(user) {
    if (user) {
      // Bejelentkezve -> Dashboard megjelenítése
      if (loginContainer) loginContainer.classList.add('hidden');
      if (dashboardContainer) dashboardContainer.classList.remove('hidden');
      if (userEmailDisplay) {
        const roleText = user.user_metadata?.role ? ` (${user.user_metadata.role})` : '';
        userEmailDisplay.innerText = user.email + roleText;
      }
    } else {
      // Kijelentkezve -> Login kártya megjelenítése
      if (loginContainer) loginContainer.classList.remove('hidden');
      if (dashboardContainer) dashboardContainer.classList.add('hidden');
      if (userEmailDisplay) userEmailDisplay.innerText = '--';
    }
  }
});
