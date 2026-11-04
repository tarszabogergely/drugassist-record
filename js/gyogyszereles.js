/**
 * DrugAssist Record - Gyógyszerelési Tálca Rögzítése Modul
 */

document.addEventListener('DOMContentLoaded', () => {
  let currentTrayItems = [];
  let currentPatient = null;
  let currentScannedMed = null;
  let batchListForMed = [];

  // DOM elemek
  const qrInput = document.getElementById('qr-input');
  const btnParseQr = document.getElementById('btn-parse-qr');
  const pName = document.getElementById('p-name');
  const pTaj = document.getElementById('p-taj');
  const pWardBed = document.getElementById('p-ward-bed');
  const pTime = document.getElementById('p-time');

  const btnOpenScanner = document.getElementById('btn-open-scanner');
  const medTableBody = document.getElementById('med-table-body');
  const dispensingNotes = document.getElementById('dispensing-notes');
  const btnSaveDispensing = document.getElementById('btn-save-dispensing');

  const scanModal = document.getElementById('scan-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const barcodeInput = document.getElementById('barcode-input');
  const medScannedDetails = document.getElementById('med-scanned-details');
  const scannedMedName = document.getElementById('scanned-med-name');
  const scannedMedMorphology = document.getElementById('scanned-med-morphology');
  
  const lotSelect = document.getElementById('lot-select');
  const lotBubblesWrapper = document.getElementById('lot-bubbles-wrapper');
  const newLotNumber = document.getElementById('new-lot-number');
  const newExpiryDate = document.getElementById('new-expiry-date');

  const doseMorning = document.getElementById('dose-morning');
  const doseNoon = document.getElementById('dose-noon');
  const doseEvening = document.getElementById('dose-evening');
  const doseNight = document.getElementById('dose-night');
  const btnAddItem = document.getElementById('btn-add-item');

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

  // 2. QR kód beolvasása & feldolgozása
  if (btnParseQr) btnParseQr.addEventListener('click', parsePatientQr);
  if (qrInput) {
    qrInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') parsePatientQr();
    });
  }

  function parsePatientQr() {
    const rawVal = qrInput.value.trim();
    if (!rawVal) return;

    if (!rawVal.includes('??')) {
      alert('Érvénytelen QR kód formátum!');
      return;
    }

    const parts = rawVal.split('??');
    currentPatient = {
      name: parts[0] || 'Névtelen Beteg',
      ward: parts[1] || 'Ismeretlen Osztály',
      bed: parts[2] || '-',
      timestamp: parts[3] || new Date().toISOString(),
      rawQr: rawVal
    };

    pName.innerText = currentPatient.name;
    pTaj.innerText = 'Lekérdezés...';
    pWardBed.innerText = `${currentPatient.ward} / ${currentPatient.bed}`;
    pTime.innerText = currentPatient.timestamp;

    btnOpenScanner.disabled = false;
    btnSaveDispensing.disabled = false;

    // TAJ lekérdezése vagy beteg regisztrációja Supabase-ben
    fetchOrCreatePatient(currentPatient);
  }

  async function fetchOrCreatePatient(patientObj) {
    try {
      const { data: existingPatient } = await db
        .from('patients')
        .select('*')
        .eq('name', patientObj.name)
        .maybeSingle();

      if (existingPatient) {
        pTaj.innerText = existingPatient.taj_number || 'Nincs megadva';
        currentPatient.taj = existingPatient.taj_number;
      } else {
        pTaj.innerText = 'Új betegként rögzítve';
        await db.from('patients').insert([{
          name: patientObj.name,
          ward: patientObj.ward,
          bed_number: patientObj.bed
        }]);
      }
    } catch (err) {
      console.error('Beteg lekérdezési hiba:', err);
    }
  }

  // 3. Modal Nyitása & Gyorsgombok (F2 & F3)
  if (btnOpenScanner) {
    btnOpenScanner.addEventListener('click', openScanModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (!btnOpenScanner.disabled) openScanModal();
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (scanModal.style.display === 'flex' && !btnAddItem.classList.contains('hidden')) {
        btnAddItem.click();
      }
    }
  });

  function openScanModal() {
    resetModal();
    scanModal.style.display = 'flex';
    barcodeInput.focus();
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      scanModal.style.display = 'none';
    });
  }

  function resetModal() {
    barcodeInput.value = '';
    medScannedDetails.classList.add('hidden');
    btnAddItem.classList.add('hidden');
    currentScannedMed = null;
    batchListForMed = [];
    newLotNumber.value = '';
    newExpiryDate.value = '';
    doseMorning.value = 0;
    doseNoon.value = 0;
    doseEvening.value = 0;
    doseNight.value = 0;
    lotBubblesWrapper.innerHTML = '<span style="color: #94a3b8; font-style: italic; font-size: 0.88rem;">Nincs rögzített korábbi LOT.</span>';
  }

  // 4. Gyógyszer vonalkódolvasása
  barcodeInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const code = barcodeInput.value.trim();
      if (!code) return;

      try {
        const { data: med, error } = await db
          .from('medication_master')
          .select('*')
          .eq('barcode', code)
          .maybeSingle();

        if (error || !med) {
          alert('A vonalkód nem található a gyógyszertörzsben!');
          return;
        }

        currentScannedMed = med;
        scannedMedName.innerText = med.name;
        scannedMedMorphology.innerText = med.morphology || 'Nincs leírás megadva';

        // LOT rekordok lekérdezése
        const { data: batches } = await db
          .from('batch_records')
          .select('*')
          .eq('medication_id', med.id)
          .order('expiry_date', { ascending: true });

        batchListForMed = batches || [];
        renderLotBubbles(batchListForMed);

        medScannedDetails.classList.remove('hidden');
        btnAddItem.classList.remove('hidden');
        newLotNumber.focus();
      } catch (err) {
        console.error('Gyógyszerkeresési hiba:', err);
      }
    }
  });

  // LOT BUBORÉKOK RENDERELÉSE
  function renderLotBubbles(batches) {
    lotSelect.innerHTML = '<option value="">-- Új LOT felvétele --</option>';

    if (!batches || batches.length === 0) {
      lotBubblesWrapper.innerHTML = '<span style="color: #94a3b8; font-style: italic; font-size: 0.88rem;">Nincs rögzített korábbi LOT (töltsd ki az alsó mezőket).</span>';
      return;
    }

    lotBubblesWrapper.innerHTML = batches.map(b => {
      lotSelect.innerHTML += `<option value="${b.id}">${b.lot_number} (${b.expiry_date})</option>`;
      return `<div class="lot-bubble" data-batch-id="${b.id}">${b.lot_number} <span style="font-size:0.75rem; opacity:0.8;">(${b.expiry_date})</span></div>`;
    }).join('');

    // Buborék kattintás esemény
    document.querySelectorAll('.lot-bubble').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedId = btn.getAttribute('data-batch-id');
        const isSelected = btn.classList.contains('selected');

        document.querySelectorAll('.lot-bubble').forEach(b => b.classList.remove('selected'));

        if (!isSelected) {
          btn.classList.add('selected');
          lotSelect.value = selectedId;
          const selectedBatch = batchListForMed.find(b => b.id === selectedId);
          if (selectedBatch) {
            newLotNumber.value = selectedBatch.lot_number;
            newExpiryDate.value = selectedBatch.expiry_date;
          }
        } else {
          lotSelect.value = '';
          newLotNumber.value = '';
          newExpiryDate.value = '';
        }
      });
    });
  }

  // 5. Gyógyszer Hozzáadása a Tálcához (AddItem)
  btnAddItem.addEventListener('click', async () => {
    if (!currentScannedMed) return;

    const lotNum = newLotNumber.value.trim();
    const expDate = newExpiryDate.value;

    if (!lotNum || !expDate) {
      alert('Kérjük, adja meg a Gyári számot (LOT) és a lejárati dátumot!');
      return;
    }

    const mDose = parseFloat(doseMorning.value) || 0;
    const nDose = parseFloat(doseNoon.value) || 0;
    const eDose = parseFloat(doseEvening.value) || 0;
    const niDose = parseFloat(doseNight.value) || 0;

    if (mDose + nDose + eDose + niDose === 0) {
      alert('Legalább egy napszakhoz adjon meg adagolási mennyiséget!');
      return;
    }

    let batchId = lotSelect.value;

    try {
      if (!batchId) {
        const { data: newBatch, error: bErr } = await db
          .from('batch_records')
          .insert([{
            medication_id: currentScannedMed.id,
            lot_number: lotNum,
            expiry_date: expDate
          }])
          .select()
          .single();

        if (bErr) throw bErr;
        batchId = newBatch.id;
      }

      currentTrayItems.push({
        medication_id: currentScannedMed.id,
        medication_name: currentScannedMed.name,
        morphology: currentScannedMed.morphology,
        batch_id: batchId,
        lot_number: lotNum,
        expiry_date: expDate,
        morning: mDose,
        noon: nDose,
        evening: eDose,
        night: niDose
      });

      renderTrayTable();
      scanModal.style.display = 'none';
    } catch (err) {
      console.error('Tétel hozzáadási hiba:', err);
      alert('Hiba történt a tétel rögzítésekor!');
    }
  });

  // Tálca táblázat renderelése
  function renderTrayTable() {
    if (currentTrayItems.length === 0) {
      medTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Még nincs rögzített gyógyszer ezen a tálcán. Olvassa be a beteg QR kódját, majd nyomja meg a "+ Gyógyszer Hozzáadása" gombot.</td></tr>';
      return;
    }

    medTableBody.innerHTML = currentTrayItems.map((item, index) => `
      <tr>
        <td><strong>${item.medication_name}</strong></td>
        <td>${item.morphology || '-'}</td>
        <td><code>${item.lot_number}</code> <br><small style="color:#666;">Exp: ${item.expiry_date}</small></td>
        <td>${item.morning}</td>
        <td>${item.noon}</td>
        <td>${item.evening}</td>
        <td>${item.night}</td>
        <td>
          <button type="button" onclick="removeTrayItem(${index})" class="btn btn-secondary btn-sm" style="background:#dc2626; color:white; border:none;">Törlés</button>
        </td>
      </tr>
    `).join('');
  }

  window.removeTrayItem = function(index) {
    currentTrayItems.splice(index, 1);
    renderTrayTable();
  };

  // 6. Tálca Lezárása & Mentése
  btnSaveDispensing.addEventListener('click', async () => {
    if (!currentPatient) {
      alert('Hiányzó beteg adatok!');
      return;
    }

    if (currentTrayItems.length === 0) {
      alert('A tálcára még nem vett fel gyógyszert!');
      return;
    }

    btnSaveDispensing.disabled = true;
    btnSaveDispensing.innerText = 'Mentés folyamatban...';

    try {
      // 1. Tálca fejlécrekord beszúrása
      const { data: record, error: recErr } = await db
        .from('dispensing_records')
        .insert([{
          patient_name: currentPatient.name,
          patient_taj: currentPatient.taj || null,
          ward: currentPatient.ward,
          bed_number: currentPatient.bed,
          qr_identifier: currentPatient.rawQr,
          dispensed_by: currentUser.username,
          status: 'draft',
          notes: dispensingNotes.value.trim()
        }])
        .select()
        .single();

      if (recErr) throw recErr;

      // 2. Tételek beszúrása
      const itemsToInsert = currentTrayItems.map(it => ({
        dispensing_record_id: record.id,
        medication_id: it.medication_id,
        batch_id: it.batch_id,
        morning_dose: it.morning,
        noon_dose: it.noon,
        evening_dose: it.evening,
        night_dose: it.night
      }));

      const { error: itemsErr } = await db.from('dispensed_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      alert('Tálca sikeresen lezárva és elmentve!');
      window.location.reload();
    } catch (err) {
      console.error('Mentési hiba:', err);
      alert('Hiba történt a tálca mentése során!');
    } finally {
      btnSaveDispensing.disabled = false;
      btnSaveDispensing.innerText = '✓ Tálca Lezárása és Mentése Supabase-be';
    }
  });
});
