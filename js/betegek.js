/**
 * DrugAssist Record - Betegek Kezelése & Előzmény Lekérdezése
 */

document.addEventListener('DOMContentLoaded', () => {
  let allPatients = [];

  // DOM Elemek
  const searchInput = document.getElementById('patient-search-input');
  const btnRefresh = document.getElementById('btn-refresh-patients');
  const tableBody = document.getElementById('patients-table-body');
  
  const historyModal = document.getElementById('patient-history-modal');
  const btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
  const historyBody = document.getElementById('patient-history-body');
  const hPatientName = document.getElementById('h-patient-name');

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

  // 2. Betegek betöltése
  loadPatients();

  if (btnRefresh) btnRefresh.addEventListener('click', loadPatients);

  async function loadPatients() {
    try {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Betegek betöltése...</td></tr>';

      const { data, error } = await db
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      allPatients = data || [];
      renderPatients(allPatients);
    } catch (err) {
      console.error('Betegek betöltési hibája:', err);
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="6" style="color:red;">Hiba történt a betegek betöltésekor.</td></tr>';
    }
  }

  // Táblázat kirajzolása
  function renderPatients(patientsList) {
    if (patientsList.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Nem található beteg a nyilvántartásban.</td></tr>';
      return;
    }

    tableBody.innerHTML = patientsList.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.taj_number || 'Nincs megadva'}</td>
        <td>${p.ward || '-'}</td>
        <td>${p.bed_number || '-'}</td>
        <td>${new Date(p.created_at).toLocaleString('hu-HU')}</td>
        <td>
          <button type="button" onclick="viewHistory('${p.name}')" class="btn btn-secondary btn-sm">Gyógyszerelési Előzmények</button>
        </td>
      </tr>
    `).join('');
  }

  // Live Search szűrés
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = allPatients.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.ward && p.ward.toLowerCase().includes(q)) ||
        (p.taj_number && p.taj_number.toLowerCase().includes(q)) ||
        (p.bed_number && p.bed_number.toLowerCase().includes(q))
      );
      renderPatients(filtered);
    });
  }

  // 3. Beteg előzményeinek megtekintése (dispensing_records alapján)
  window.viewHistory = async function(patientName) {
    hPatientName.innerText = patientName;
    historyBody.innerHTML = '<tr class="empty-row"><td colspan="4">Előzmények lekérdezése...</td></tr>';
    historyModal.style.display = 'flex';

    try {
      const { data: records, error } = await db
        .from('dispensing_records')
        .select('*')
        .eq('patient_name', patientName)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!records || records.length === 0) {
        historyBody.innerHTML = '<tr class="empty-row"><td colspan="4">Nincsenek rögzített tálcák ehhez a beteghez.</td></tr>';
        return;
      }

      historyBody.innerHTML = records.map(r => {
        const isVerified = r.status === 'verified';
        const badgeStyle = isVerified ? 'background:#28a745; color:white;' : 'background:#ffc107; color:#333;';
        const statusText = isVerified ? '✓ Ellenőrizve' : 'Várakozik';

        return `
          <tr>
            <td>${new Date(r.created_at).toLocaleString('hu-HU')}</td>
            <td>${r.ward} / ${r.bed_number || '-'}</td>
            <td><span class="badge" style="${badgeStyle}">${statusText}</span></td>
            <td>${r.notes || '-'}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Előzmény hibája:', err);
      historyBody.innerHTML = '<tr class="empty-row"><td colspan="4" style="color:red;">Hiba történt az előzmények lekérdezésekor.</td></tr>';
    }
  };

  // Modal bezárás
  if (btnCloseHistoryModal) {
    btnCloseHistoryModal.addEventListener('click', () => {
      historyModal.style.display = 'none';
    });
  }
});
