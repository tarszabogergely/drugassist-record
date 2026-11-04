/**
 * DrugAssist Record - Username-based Auth & Session Management
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loginContainer = document.getElementById('login-container');
  const dashboardContainer = document.getElementById('dashboard-container');
  const loginForm = document.getElementById('login-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const userDisplay = document.getElementById('user-email-display');
  const btnLogout = document.getElementById('btn-logout');

  // Munkamenet ellenőrzése betöltéskor
  await checkSession();

  // Bejelentkezés felhasználónévvel
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = loginUsername.value.trim().toLowerCase();
      const password = loginPassword.value.trim();

      if (!username || !password) {
        alert('Kérjük, adja meg a felhasználónevet és a jelszót!');
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Bejelentkezés...';

      try {
        // 1. Felhasználónév alapján az e-mail és adatok lekérdezése a profiles táblából
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, role')
          .eq('username', username)
          .single();

        if (profileError || !profile) {
          alert('Hibás felhasználónév vagy jelszó!');
          return;
        }

        // 2. Belső e-mail behelyettesítése
        const mappedEmail = `${username}@drugassist.local`;

        // 3. Supabase Auth Bejelentkezés
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: mappedEmail,
          password: password,
        });

        if (authError) {
          alert('Hibás felhasználónév vagy jelszó!');
        } else {
          updateUI(data.session?.user, profile);
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

  // Kijelentkezés
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await supabase.auth.signOut();
      updateUI(null, null);
    });
  }

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      updateUI(session.user, profile);
    } else {
      updateUI(null, null);
    }
  }

  function updateUI(user, profile) {
    if (user && profile) {
      if (loginContainer) loginContainer.classList.add('hidden');
      if (dashboardContainer) dashboardContainer.classList.remove('hidden');
      if (userDisplay) {
        const roleName = profile.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens';
        userDisplay.innerText = `${profile.full_name} (${roleName})`;
      }
    } else {
      if (loginContainer) loginContainer.classList.remove('hidden');
      if (dashboardContainer) dashboardContainer.classList.add('hidden');
      if (userDisplay) userDisplay.innerText = '--';
    }
  }
});
