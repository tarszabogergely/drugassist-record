/**
 * DrugAssist Record - Gyógyszertörzs Kezelése & Szerkesztése
 */

document.addEventListener('DOMContentLoaded', () => {
  let allMeds = [];

  // DOM elemek
  const searchInput = document.getElementById('torzs-search-input');
  const btnRefresh = document.getElementById('btn-refresh-torzs');
  const tableBody = document.getElementById('torzs-table-body');
  const totalCountEl = document.getElementById('total-count');

  const modal = document.getElementById('med-modal');
  const modalTitle = document.getElementById('modal-title');
  const btnOpenAddModal = document.getElementById('btn-open-add-modal');
  const btnCloseModal = document.getElementById('btn-close-med-modal');
  const btnCancel = document.getElementById('btn-cancel-med');
  const medForm = document.getElementById('med-form');

  const medIdInput = document.getElementById('med-id');
  const barcodeInput = document.getElementById('med-barcode');
  const nameInput = document.getElementById('med-name');
  const morphologyInput = document.getElementById('med-morphology');

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

  // 2. Gyógyszerlista betöltése Supabase-ből
  loadMedications();

  if (btnRefresh) btnRefresh.addEventListener('click', loadMedications);

  async function loadMedications() {
    try {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">Gyógyszertörzs betöltése...</td></tr>';

      const { data, error } = await db
        .from('medication_master')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      allMeds = data || [];
      if (totalCountEl) totalCountEl.innerText = allMeds.length;
      renderTable(allMeds);
    } catch (err) {
      console.error('Törzs betöltési hiba:', err);
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="4" style="color:red;">Hiba történt a gyógyszertörzs betöltésekor.</td></tr>';
    }
  }

  // Táblázat kirajzolása
  function renderTable(medList) {
    if (medList.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">Nem található gyógyszer a keresési feltételnek megfelelően.</td></tr>';
      return;
    }

    tableBody.innerHTML = medList.map(m => `
      <tr>
        <td><code>${m.barcode}</code></td>
        <td><strong>${m.name}</strong></td>
        <td>${m.morphology || '<span style="color:#999; font-style:italic;">Nincs morfológiai leírás</span>'}</td>
        <td>
          <button type="button" onclick="editMedication('${m.id}')" class="btn btn-secondary btn-sm">Szerkesztés</button>
        </td>
      </tr>
    `).join('');
  }

  // Live Search szűrés
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = allMeds.filter(m => 
        (m.barcode && m.barcode.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.morphology && m.morphology.toLowerCase().includes(q))
      );
      renderTable(filtered);
    });
  }

  // 3. Modal Kezelés (Felvétel & Szerkesztés)
  if (btnOpenAddModal) {
    btnOpenAddModal.addEventListener('click', () => {
      resetForm();
      modalTitle.innerText = 'Új Gyógyszer Felvétele';
      modal.style.display = 'flex';
      barcodeInput.focus();
    });
  }

  window.editMedication = function(medId) {
    const med = allMeds.find(m => m.id === medId);
    if (!med) return;

    medIdInput.value = med.id;
    barcodeInput.value = med.barcode || '';
    nameInput.value = med.name || '';
    morphologyInput.value = med.morphology || '';

    modalTitle.innerText = 'Gyógyszer Szerkesztése';
    modal.style.display = 'flex';
    nameInput.focus();
  };

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  function closeModal() {
    modal.style.display = 'none';
    resetForm();
  }

  function resetForm() {
    medIdInput.value = '';
    barcodeInput.value = '';
    nameInput.value = '';
    morphologyInput.value = '';
  }

  // 4. Form Mentés (Insert vagy Update)
  if (medForm) {
    medForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = medIdInput.value.trim();
      const barcode = barcodeInput.value.trim();
      const name = nameInput.value.trim();
      const morphology = morphologyInput.value.trim();

      if (!barcode || !name) {
        alert('A vonalkód és a gyógyszernév megadása kötelező!');
        return;
      }

      const saveBtn = document.getElementById('btn-save-med');
      saveBtn.disabled = true;
      saveBtn.innerText = 'Mentés...';

      try {
        if (id) {
          // Módosítás (UPDATE)
          const { error } = await db
            .from('medication_master')
            .update({ barcode, name, morphology })
            .eq('id', id);

          if (error) throw error;
          alert('Gyógyszer adatai sikeresen frissítve!');
        } else {
          // Új felvétel (INSERT)
          const { error } = await db
            .from('medication_master')
            .insert([{ barcode, name, morphology }]);

          if (error) throw error;
          alert('Új gyógyszer sikeresen hozzáadva a törzshöz!');
        }

        closeModal();
        await loadMedications();
      } catch (err) {
        console.error('Mentési hiba:', err);
        alert('Hiba történt a mentés során: ' + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Mentés Supabase-be';
      }
    });
  }
});
