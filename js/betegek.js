/**
 * DrugAssist Record - Betegek Kezelése & Előzmény Lekérdezése
 */

document.addEventListener('DOMContentLoaded', () => {
  let allPatients = [];

  // DOM Elemek
  const searchInput = document.getElementById('patient-search-input');
  const tableBody = document.getElementById('patients-table-body');
  
  const historyModal = document.getElementById('patient-history-modal');
  const btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
  const historyBody = document.getElementById('patient-history-body');
  const hPatientName = document.getElementById('h-patient-name');

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

  // 2. Betegek betöltése
  loadPatients();

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

  // Táblázat kirajzolása (Szerkeszthető Név és TAJ mezőkkel)
  function renderPatients(patientsList) {
    if (patientsList.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Nem található beteg a nyilvántartásban.</td></tr>';
      return;
    }

    tableBody.innerHTML = patientsList.map(p => `
      <tr>
        <td>
          <input type="text" class="patient-input-inline" style="font-weight: bold;" value="${p.name || ''}" onchange="updatePatientField('${p.id}', 'name', this.value)">
        </td>
        <td>
          <input type="text" class="patient-input-inline" value="${p.taj_number || ''}" placeholder="TAJ megadása..." onchange="updatePatientField('${p.id}', 'taj_number', this.value)">
        </td>
        <td>${p.ward || '-'}</td>
        <td>${p.bed_number || '-'}</td>
        <td>${new Date(p.created_at).toLocaleString('hu-HU')}</td>
        <td>
          <button type="button" onclick="viewHistory('${p.name}')" class="btn btn-secondary btn-sm">Gyógyszerelési Előzmények</button>
        </td>
      </tr>
    `).join('');
  }

  // Beteg adatainak azonnali mentése szerkesztéskor
  window.updatePatientField = async function(patientId, field, newValue) {
    try {
      const updateData = {};
      updateData[field] = newValue.trim();

      const { error } = await db
        .from('patients')
        .update(updateData)
        .eq('id', patientId);

      if (error) throw error;

      // Helyi tömb frissítése
      const target = allPatients.find(p => p.id === patientId);
      if (target) target[field] = newValue.trim();

    } catch (err) {
      console.error('Hiba a beteg frissítésekor:', err);
      alert('Hiba történt a beteg adatainak mentése során!');
    }
  };

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

  // 3. Beteg előzményeinek megtekintése (Gyártási azonosítóval és kattintható sorokkal)
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

        // Gyártási azonosító kinyerése a QR kódból (utolsó elem a ?? elválasztás után)
        let batchIdDisplay = '-';
        if (r.qr_identifier && r.qr_identifier.includes('??')) {
          const parts = r.qr_identifier.split('??');
          batchIdDisplay = parts[3] || r.qr_identifier;
        } else if (r.qr_identifier) {
          batchIdDisplay = r.qr_identifier;
        }

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

  // 4. Tálca részletes gyógyszerelési adatainak megjelenítése
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
      
      let bId = '-';
      if (rec.qr_identifier && rec.qr_identifier.includes('??')) {
        bId = rec.qr_identifier.split('??')[3] || rec.qr_identifier;
      } else {
        bId = rec.qr_identifier || '-';
      }

      detailBarcode.innerText = bId;
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

  // 5. Modalok bezárása (Gombra és Esc billentyűre)
  if (btnCloseHistoryModal) {
    btnCloseHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
  }

  if (btnCloseDetailModal) {
    btnCloseDetailModal.addEventListener('click', () => trayDetailModal.style.display = 'none');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (trayDetailModal && trayDetailModal.style.display === 'flex') {
        trayDetailModal.style.display = 'none';
      } else if (historyModal && historyModal.style.display === 'flex') {
        historyModal.style.display = 'none';
      }
    }
  });
});
