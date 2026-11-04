/**
 * DrugAssist Record - Gyógyszerészi Ellenőrző Modul
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let activeRecord = null;
  let pendingRecords = [];

  // DOM elemek
  const verifyQrInput = document.getElementById('verify-qr-input');
  const btnSearchQr = document.getElementById('btn-search-qr');
  const btnRefreshList = document.getElementById('btn-refresh-list');
  const pendingTraysBody = document.getElementById('pending-trays-body');
  const verifyDetailsSection = document.getElementById('verify-details-section');
  const verifyItemsBody = document.getElementById('verify-items-body');
  const btnApproveDispensing = document.getElementById('btn-approve-dispensing');

  // 1. Munkamenet ellenőrzése
  const savedUser = sessionStorage.getItem('drugassist_user');
  if (!savedUser) {
    alert('Kérjük, jelentkezzen be!');
    window.location.href = '../index.html';
    return;
  }
  currentUser = JSON.parse(savedUser);
  
  const userDisp = document.getElementById('user-display');
  if (userDisp) {
    userDisp.innerText = `${currentUser.full_name} (${currentUser.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens'})`;
  }

  // 2. Várakozó (draft) tálcák betöltése
  loadPendingTrays();

  if (btnRefreshList) {
    btnRefreshList.addEventListener('click', loadPendingTrays);
  }

  async function loadPendingTrays() {
    try {
      pendingTraysBody.innerHTML = '<tr class="empty-row"><td colspan="5">Betöltés folyamatban...</td></tr>';

      const { data: records, error } = await db
        .from('dispensing_records')
        .select('*')
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (error) throw error;

      pendingRecords = records || [];

      if (pendingRecords.length === 0) {
        pendingTraysBody.innerHTML = '<tr class="empty-row"><td colspan="5">Nincs ellenőrzésre váró tálca.</td></tr>';
        return;
      }

      pendingTraysBody.innerHTML = pendingRecords.map(rec => `
        <tr>
          <td><strong>${rec.patient_name}</strong></td>
          <td>${rec.ward} / ${rec.bed_number || '-'}</td>
          <td>${rec.patient_taj || 'Nincs megadva'}</td>
          <td>${new Date(rec.created_at).toLocaleString('hu-HU')}</td>
          <td>
            <button type="button" onclick="selectTray('${rec.id}')" class="btn btn-primary btn-sm">Ellenőrzés Megnyitása</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Lista betöltési hiba:', err);
      pendingTraysBody.innerHTML = '<tr class="empty-row"><td colspan="5" style="color:red;">Hiba történt a tálcák betöltésekor.</td></tr>';
    }
  }

  // 3. Tálca megnyitása ID vagy QR alapján
  window.selectTray = async function(recordId) {
    const record = pendingRecords.find(r => r.id === recordId);
    if (record) {
      await displayRecordDetails(record);
    }
  };

  // QR Kódos gyorskeresés
  if (btnSearchQr) {
    btnSearchQr.addEventListener('click', searchByQr);
  }
  if (verifyQrInput) {
    verifyQrInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchByQr();
    });
  }

  async function searchByQr() {
    const qrVal = verifyQrInput.value.trim();
    if (!qrVal) return;

    try {
      const { data: record, error } = await db
        .from('dispensing_records')
        .select('*')
        .eq('qr_identifier', qrVal)
        .eq('status', 'draft')
        .maybeSingle();

      if (error || !record) {
        alert('Nem található ellenőrzésre váró tálca ezzel a QR kóddal!');
        return;
      }

      await displayRecordDetails(record);
    } catch (err) {
      console.error('QR keresési hiba:', err);
      alert('Hiba történt a QR keresés során.');
    }
  }

  // Tálca részleteinek és gyógyszereinek megjelenítése
  async function displayRecordDetails(record) {
    activeRecord = record;

    document.getElementById('v-patient-name').innerText = record.patient_name;
    document.getElementById('v-ward-bed').innerText = `${record.ward} / ${record.bed_number || '-'}`;
    document.getElementById('v-created-at').innerText = new Date(record.created_at).toLocaleString('hu-HU');
    document.getElementById('verify-notes-display').innerText = record.notes || 'Nincs megjegyzés.';

    // Tételek lekérdezése a gyógyszertörzzsel és a batch adatbázissal
    try {
      const { data: items, error } = await db
        .from('dispensed_items')
        .select(`
          id,
          morning_dose,
          noon_dose,
          evening_dose,
          night_dose,
          medication_master ( name, morphology ),
          batch_records ( lot_number, expiry_date )
        `)
        .eq('dispensing_record_id', record.id);

      if (error) throw error;

      if (!items || items.length === 0) {
        verifyItemsBody.innerHTML = '<tr class="empty-row"><td colspan="7">A tálcához nem tartoznak gyógyszerek.</td></tr>';
      } else {
        verifyItemsBody.innerHTML = items.map(it => {
          const med = it.medication_master || {};
          const batch = it.batch_records;
          const lotText = batch ? `${batch.lot_number} (Lejárat: ${batch.expiry_date})` : 'Nincs megadva';

          return `
            <tr>
              <td><strong>${med.name || 'Ismeretlen gyógyszer'}</strong></td>
              <td style="background:#fff3cd; font-weight:600;">${med.morphology || 'Nincs morfológiai leírás!'}</td>
              <td>${lotText}</td>
              <td>${it.morning_dose}</td>
              <td>${it.noon_dose}</td>
              <td>${it.evening_dose}</td>
              <td>${it.night_dose}</td>
            </tr>
          `;
        }).join('');
      }

      verifyDetailsSection.classList.remove('hidden');
      verifyDetailsSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Tételek lekérdezési hibája:', err);
      alert('Nem sikerült betölteni a tálca gyógyszer-részleteit.');
    }
  }

  // 4. Tálca Jóváhagyása & Lezárása
  if (btnApproveDispensing) {
    btnApproveDispensing.addEventListener('click', async () => {
      if (!activeRecord) return;

      const confirmApprove = confirm(`Biztosan jóváhagyja és lezárja ${activeRecord.patient_name} gyógyszerelési tálcáját?`);
      if (!confirmApprove) return;

      btnApproveDispensing.disabled = true;
      btnApproveDispensing.innerText = 'Jóváhagyás folyamatban...';

      try {
        const { error } = await db
          .from('dispensing_records')
          .update({
            status: 'verified',
            verified_by: currentUser.id,
            verified_at: new Date().toISOString()
          })
          .eq('id', activeRecord.id);

        if (error) throw error;

        alert('Tálca sikeresen ellenőrizve és jóváhagyva!');
        verifyDetailsSection.classList.add('hidden');
        activeRecord = null;
        await loadPendingTrays();
      } catch (err) {
        console.error('Jóváhagyási hiba:', err);
        alert('Hiba történt a jóváhagyás során: ' + err.message);
      } finally {
        btnApproveDispensing.disabled = false;
        btnApproveDispensing.innerText = '✓ Tálca Ellenőrizve és Jóváhagyva (Lezárás)';
      }
    });
  }
});
