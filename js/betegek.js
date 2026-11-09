/**
 * DrugAssist Record - Betegek Kezelése & Előzmény Lekérdezése
 */

document.addEventListener('DOMContentLoaded', () => {
  let allPatients = [];

  // DOM Elemek
  const searchInput = document.getElementById('patient-search-input');
  const tableBody = document.getElementById('patients-table-body');
  
  // Edit Modal DOM
  const patientEditModal = document.getElementById('patient-edit-modal');
  const btnCloseEditModal = document.getElementById('btn-close-edit-modal');
  const btnCancelEditPatient = document.getElementById('btn-cancel-edit-patient');
  const editPatientForm = document.getElementById('edit-patient-form');
  const editPatientId = document.getElementById('edit-patient-id');
  const editPatientName = document.getElementById('edit-patient-name');
  const editPatientTaj = document.getElementById('edit-patient-taj');

  // History Modal DOM
  const historyModal = document.getElementById('patient-history-modal');
  const btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
  const historyBody = document.getElementById('patient-history-body');
  const hPatientName = document.getElementById('h-patient-name');

  // Detail Modal DOM
  const trayDetailModal = document.getElementById('tray-detail-modal');
  const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
  const detailPatient = document.getElementById('detail-patient');
  const detailBarcode = document.getElementById('detail-barcode');
  const detailUser = document.getElementById('detail-user');
  const detailStatus = document.getElementById('detail-status');
  const detailItemsBody = document.getElementById('detail-items-body');

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

  // 2. Betegek betöltése és előzmény-osztályaik összegzése
  loadPatients();

  async function loadPatients() {
    try {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Betegek betöltése...</td></tr>';

      // 1. Betegek lekérése
      const { data: patientsData, error: pErr } = await db
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (pErr) throw pErr;

      // 2. Gyógyszerelési rekordok lekérése a több osztály azonosításához
      const { data: recordsData, error: rErr } = await db
        .from('dispensing_records')
        .select('patient_name, patient_taj, ward, bed_number');

      if (rErr) console.warn('Rekordok lekérdezési figyelmeztetés:', rErr);

      const records = recordsData || [];

      // Mประกอบ patient objektum kiegészítése az eddigi osztályok listájával
      allPatients = (patientsData || []).map(p => {
        // Keressük a beteg rekordjait Név vagy TAJ alapján
        const pRecords = records.filter(r => 
          (p.taj_number && r.patient_taj === p.taj_number) || 
          (r.patient_name && r.patient_name.toLowerCase() === p.name.toLowerCase())
        );

        // Egyedi osztályok és ágyszámok gyűjtése
        const wardSet = new Set();
        const bedSet = new Set();

        if (p.ward) wardSet.add(p.ward);
        if (p.bed_number) bedSet.add(p.bed_number);

        pRecords.forEach(r => {
          if (r.ward) wardSet.add(r.ward);
          if (r.bed_number) bedSet.add(r.bed_number);
        });

        const uniqueWards = Array.from(wardSet);
        const uniqueBeds = Array.from(bedSet);

        // Osztály megjelenítési logika
        let displayWard = p.ward || '-';
        if (uniqueWards.length > 1) {
          displayWard = `<span style="font-weight: bold; color: #0284c7;">Több osztály</span><br><small style="color: #64748b; font-style: italic;">(${uniqueWards.join(', ')})</small>`;
        }

        // Ágyszám megjelenítési logika
        let displayBed = p.bed_number || '-';
        if (uniqueBeds.length > 1) {
          displayBed = `<span style="font-weight: 600; color: #64748b;">Több ágy</span>`;
        }

        return {
          ...p,
          displayWard,
          displayBed,
          allWardsText: uniqueWards.join(' ') // Kereséshez
        };
      });

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
        <td>${p.taj_number || '-'}</td>
        <td>${p.displayWard}</td>
        <td>${p.displayBed}</td>
        <td>${new Date(p.created_at).toLocaleString('hu-HU')}</td>
        <td style="white-space: nowrap;">
          <button type="button" onclick="openEditModal('${p.id}')" class="btn btn-primary btn-sm" style="background:#3b82f6; border:none; margin-right:0.3rem;">✏️ Szerkesztés</button>
          <button type="button" onclick="viewHistory('${p.name}')" class="btn btn-secondary btn-sm">Előzmények</button>
        </td>
      </tr>
    `).join('');
  }

  // 3. Szerkesztő Modal Megnyitása
  window.openEditModal = function(patientId) {
    const target = allPatients.find(p => p.id === patientId);
    if (!target) return;

    editPatientId.value = target.id;
    editPatientName.value = target.name || '';
    editPatientTaj.value = target.taj_number || '';

    patientEditModal.style.display = 'flex';
    editPatientName.focus();
  };

  // Szerkesztett Adatok Mentése (Supabase)
  editPatientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = editPatientId.value;
    const newName = editPatientName.value.trim();
    const newTaj = editPatientTaj.value.trim();

    if (!newName) {
      alert('A beteg neve nem lehet üres!');
      return;
    }

    try {
      const { error } = await db
        .from('patients')
        .update({
          name: newName,
          taj_number: newTaj || null
        })
        .eq('id', id);

      if (error) throw error;

      patientEditModal.style.display = 'none';
      loadPatients();
    } catch (err) {
      console.error('Hiba a beteg mentésekor:', err);
      alert('Hiba történt a beteg adatainak mentése során!');
    }
  });

  // Live Search szűrés (bővítve a több osztályos kereséssel)
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const filtered = allPatients.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.ward && p.ward.toLowerCase().includes(q)) ||
        (p.allWardsText && p.allWardsText.toLowerCase().includes(q)) ||
        (p.taj_number && p.taj_number.toLowerCase().includes(q)) ||
        (p.bed_number && p.bed_number.toLowerCase().includes(q))
      );
      renderPatients(filtered);
    });
  }

  // Segédfunkció a QR azonosító / Gyártási szám kibontására (4 és 5 elemes formátum támogatás)
  function extractBatchIdentifier(qrString) {
    if (!qrString) return '-';
    if (!qrString.includes('??')) return qrString;

    const parts = qrString.split('??').map(p => p.trim());
    if (parts.length === 4) {
      return parts[3] || qrString;
    } else if (parts.length >= 5) {
      return parts[4] || qrString;
    }
    return qrString;
  }

  // 4. Beteg előzményeinek megtekintése
  window.viewHistory = async function(patientName) {
    hPatientName.innerText = patientName;
    historyBody.innerHTML = '<tr class="empty-row"><td colspan="5">Előzmények lekérdezése...</td></tr>';
    historyModal.style.display = 'flex';

    try {
      const { data: records, error } = await db
        .from('dispensing_records')
        .select('*')
        .eq('patient_name', patientName)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!records || records.length === 0) {
        historyBody.innerHTML = '<tr class="empty-row"><td colspan="5">Nincsenek rögzített tálcák ehhez a beteghez.</td></tr>';
        return;
      }

      historyBody.innerHTML = records.map(r => {
        const isVerified = r.status === 'verified';
        const badgeStyle = isVerified ? 'background:#10b981; color:white;' : 'background:#f59e0b; color:white;';
        const statusText = isVerified ? '✓ Ellenőrizve' : 'Várakozik';
        const batchIdDisplay = extractBatchIdentifier(r.qr_identifier);

        return `
          <tr class="clickable-row" onclick="openTrayDetails('${r.id}')">
            <td>${new Date(r.created_at).toLocaleString('hu-HU')}</td>
            <td><code>${batchIdDisplay}</code></td>
            <td>${r.ward} / ${r.bed_number || '-'}</td>
            <td><span class="badge" style="${badgeStyle} padding:0.2rem 0.6rem; border-radius:12px; font-size:0.82rem;">${statusText}</span></td>
            <td>${r.notes || '-'}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Előzmény hibája:', err);
      historyBody.innerHTML = '<tr class="empty-row"><td colspan="5" style="color:red;">Hiba történt az előzmények lekérdezésekor.</td></tr>';
    }
  };

  // 5. Tálca részletes gyógyszerelési adatainak megjelenítése
  window.openTrayDetails = async function(recordId) {
    detailItemsBody.innerHTML = '<tr class="empty-row"><td colspan="7">Részletek betöltése...</td></tr>';
    trayDetailModal.style.display = 'flex';

    try {
      const { data: rec, error: rErr } = await db
        .from('dispensing_records')
        .select(`
          *,
          dispensed_items (
            morning_dose, noon_dose, evening_dose, night_dose,
            medication_master (name, morphology),
            batch_records (lot_number, expiry_date)
          )
        `)
        .eq('id', recordId)
        .single();

      if (rErr) throw rErr;

      detailPatient.innerText = rec.patient_name;
      detailBarcode.innerText = extractBatchIdentifier(rec.qr_identifier);
      detailUser.innerText = rec.dispensed_by || '-';
      detailStatus.innerText = rec.status === 'verified' ? '✓ Ellenőrizve' : 'Várakozik';

      if (!rec.dispensed_items || rec.dispensed_items.length === 0) {
        detailItemsBody.innerHTML = '<tr class="empty-row"><td colspan="7">Nincsenek rögzített tételek.</td></tr>';
        return;
      }

      detailItemsBody.innerHTML = rec.dispensed_items.map(it => {
        const medName = it.medication_master ? it.medication_master.name : 'Ismeretlen gyógyszer';
        const morph = it.medication_master ? (it.medication_master.morphology || '-') : '-';
        const lot = it.batch_records ? it.batch_records.lot_number : '-';
        const exp = it.batch_records ? it.batch_records.expiry_date : '-';

        return `
          <tr>
            <td><strong>${medName}</strong></td>
            <td>${morph}</td>
            <td><code>${lot}</code> <br><small style="color:#64748b;">Exp: ${exp}</small></td>
            <td><span class="detail-dose-badge">${it.morning_dose}</span></td>
            <td><span class="detail-dose-badge">${it.noon_dose}</span></td>
            <td><span class="detail-dose-badge">${it.evening_dose}</span></td>
            <td><span class="detail-dose-badge">${it.night_dose}</span></td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Részletek betöltési hibája:', err);
      detailItemsBody.innerHTML = '<tr class="empty-row"><td colspan="7" style="color:red;">Hiba történt a részletek betöltésekor.</td></tr>';
    }
  };

  // 6. Modalok bezárása (Gombra és Esc billentyűre)
  if (btnCloseEditModal) btnCloseEditModal.addEventListener('click', () => patientEditModal.style.display = 'none');
  if (btnCancelEditPatient) btnCancelEditPatient.addEventListener('click', () => patientEditModal.style.display = 'none');
  if (btnCloseHistoryModal) btnCloseHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
  if (btnCloseDetailModal) btnCloseDetailModal.addEventListener('click', () => trayDetailModal.style.display = 'none');

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (trayDetailModal && trayDetailModal.style.display === 'flex') {
        trayDetailModal.style.display = 'none';
      } else if (patientEditModal && patientEditModal.style.display === 'flex') {
        patientEditModal.style.display = 'none';
      } else if (historyModal && historyModal.style.display === 'flex') {
        historyModal.style.display = 'none';
      }
    }
  });
});
