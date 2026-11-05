/**
 * DrugAssist Record - Modalos Gyógyszerészi Ellenőrző Modul (Osztályonkénti nézet)
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let activeRecord = null;
  let pendingRecords = [];

  // DOM elemek
  const verifyQrInput = document.getElementById('verify-qr-input');
  const btnSearchQr = document.getElementById('btn-search-qr');
  const pendingWardsContainer = document.getElementById('pending-wards-container');
  
  const verifyModal = document.getElementById('verify-modal');
  const btnCloseVerifyModal = document.getElementById('btn-close-verify-modal');
  const verifyItemsBody = document.getElementById('verify-items-body');
  const confirmQrInput = document.getElementById('verify-confirm-qr-input');
  const btnApproveDispensing = document.getElementById('btn-approve-dispensing');
  const roleWarningText = document.getElementById('role-warning-text');

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

  // Asszisztens esetén figyelmeztető szöveg megjelenítése
  if (currentUser.role !== 'pharmacist') {
    if (roleWarningText) roleWarningText.classList.remove('hidden');
  }

  // 2. Várakozó tálcák betöltése és csoportosítása osztályonként
  loadPendingTrays();

  async function loadPendingTrays() {
    try {
      pendingWardsContainer.innerHTML = '<div class="card"><p class="empty-row">Betöltés folyamatban...</p></div>';

      const { data: records, error } = await db
        .from('dispensing_records')
        .select('*')
        .eq('status', 'draft')
        .order('ward', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      pendingRecords = records || [];

      if (pendingRecords.length === 0) {
        pendingWardsContainer.innerHTML = '<div class="card"><p class="empty-row">Nincs ellenőrzésre váró tálca.</p></div>';
        return;
      }

      // Osztályok szerinti csoportosítás
      const wardsGrouped = {};
      pendingRecords.forEach(r => {
        const wName = r.ward || 'Egyéb Osztály';
        if (!wardsGrouped[wName]) wardsGrouped[wName] = [];
        wardsGrouped[wName].push(r);
      });

      // Csoportosított táblázatok kirajzolása (Osztály oszlop nélkül)
      pendingWardsContainer.innerHTML = Object.entries(wardsGrouped).map(([wardName, recordsInWard]) => `
        <section class="card" style="margin-bottom: 1.5rem;">
          <div class="table-header" style="border-bottom: 2px solid #10b981; padding-bottom: 0.5rem; margin-bottom: 1rem;">
            <h2 style="color: #047857; margin:0;">${wardName} (${recordsInWard.length} tálca)</h2>
          </div>

          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Beteg Neve</th>
                  <th>Ágyszám</th>
                  <th>TAJ szám</th>
                  <th>Rögzítés Időpontja</th>
                  <th>Művelet</th>
                </tr>
              </thead>
              <tbody>
                ${recordsInWard.map(rec => `
                  <tr>
                    <td><strong>${rec.patient_name}</strong></td>
                    <td>${rec.bed_number || '-'}</td>
                    <td>${rec.patient_taj || 'Nincs megadva'}</td>
                    <td>${new Date(rec.created_at).toLocaleString('hu-HU')}</td>
                    <td>
                      <button type="button" onclick="openVerifyModal('${rec.id}')" class="btn btn-primary btn-sm" style="background:#10b981; border-color:#059669;">Ellenőrzés Megnyitása</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `).join('');

    } catch (err) {
      console.error('Lista betöltési hiba:', err);
      pendingWardsContainer.innerHTML = '<div class="card"><p class="empty-row" style="color:red;">Hiba történt a tálcák betöltésekor.</p></div>';
    }
  }

  // 3. Modal Nyitás kattintásra
  window.openVerifyModal = async function(recordId) {
    const record = pendingRecords.find(r => r.id === recordId);
    if (record) {
      await setupAndOpenModal(record);
    }
  };

  // QR Kódos Nyitás
  if (btnSearchQr) btnSearchQr.addEventListener('click', searchAndOpenByQr);
  if (verifyQrInput) {
    verifyQrInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchAndOpenByQr();
    });
  }

  async function searchAndOpenByQr() {
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

      await setupAndOpenModal(record);
    } catch (err) {
      console.error('QR keresési hiba:', err);
      alert('Hiba történt a QR keresés során.');
    }
  }

  // Modal Beállítása & Megnyitása
  async function setupAndOpenModal(record) {
    activeRecord = record;

    document.getElementById('v-patient-name').innerText = record.patient_name;
    document.getElementById('v-ward-bed').innerText = `${record.ward} / ${record.bed_number || '-'}`;
    document.getElementById('v-created-at').innerText = new Date(record.created_at).toLocaleString('hu-HU');
    document.getElementById('v-notes-display').innerText = record.notes || 'Nincs megjegyzés.';
    
    // Várt QR kód kiírása segítségként
    document.getElementById('v-expected-qr').innerText = record.qr_identifier;

    // QR ellenőrző mező és gomb alaphelyzetbe állítása
    confirmQrInput.value = '';
    btnApproveDispensing.disabled = true;
    btnApproveDispensing.style.opacity = '0.5';

    // Tételek lekérdezése
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

      verifyModal.style.display = 'flex';
      confirmQrInput.focus();
    } catch (err) {
      console.error('Tételek lekérdezési hibája:', err);
      alert('Nem sikerült betölteni a tálca gyógyszer-részleteit.');
    }
  }

  // Modal Bezárás (Gombra és Esc billentyűre)
  if (btnCloseVerifyModal) {
    btnCloseVerifyModal.addEventListener('click', () => {
      verifyModal.style.display = 'none';
      activeRecord = null;
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && verifyModal && verifyModal.style.display === 'flex') {
      verifyModal.style.display = 'none';
      activeRecord = null;
    }
  });

  // 4. QR Kód Validáció a Modalban
  confirmQrInput.addEventListener('input', checkQrMatch);
  confirmQrInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !btnApproveDispensing.disabled) {
      approveTray();
    }
  });

  function checkQrMatch() {
    if (!activeRecord) return;
    const typedQr = confirmQrInput.value.trim();

    if (typedQr === activeRecord.qr_identifier && currentUser.role === 'pharmacist') {
      btnApproveDispensing.disabled = false;
      btnApproveDispensing.style.opacity = '1';
    } else {
      btnApproveDispensing.disabled = true;
      btnApproveDispensing.style.opacity = '0.5';
    }
  }

  // 5. Tálca Jóváhagyása & Lezárása
  if (btnApproveDispensing) {
    btnApproveDispensing.addEventListener('click', approveTray);
  }

  async function approveTray() {
    if (!activeRecord || currentUser.role !== 'pharmacist') return;

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

      alert('Tálca sikeresen ellenőrizve és lezárva!');
      verifyModal.style.display = 'none';
      activeRecord = null;
      await loadPendingTrays();
    } catch (err) {
      console.error('Jóváhagyási hiba:', err);
      alert('Hiba történt a jóváhagyás során: ' + err.message);
    } finally {
      btnApproveDispensing.innerText = '✓ Tálca Ellenőrizve és Jóváhagyva';
    }
  }
});
