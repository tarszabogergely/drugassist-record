/**
 * DrugAssist Record - Gyógyszerelés Rögzítés, QR Parser & Patients / Batch Sync
 */

document.addEventListener('DOMContentLoaded', () => {
  // Globális állapotok
  let currentUser = null;
  let parsedPatient = null;
  let currentItems = [];
  let activeMedication = null;

  // DOM elemek
  const qrInput = document.getElementById('qr-input');
  const btnParseQr = document.getElementById('btn-parse-qr');
  const btnOpenScanner = document.getElementById('btn-open-scanner');
  const btnSaveDispensing = document.getElementById('btn-save-dispensing');
  
  const modal = document.getElementById('scan-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const barcodeInput = document.getElementById('barcode-input');
  const scannedDetails = document.getElementById('med-scanned-details');
  const lotSelect = document.getElementById('lot-select');
  const btnToggleNewLot = document.getElementById('btn-toggle-new-lot');
  const newLotInputs = document.getElementById('new-lot-inputs');
  const btnAddItem = document.getElementById('btn-add-item');

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

  // 2. Biztonságos QR Kód Szétbontó (Delimiter: ??)
  function parseQR(qrString) {
    if (!qrString || !qrString.includes('??')) return null;
    const parts = qrString.split('??').map(p => p.trim());

    if (parts.length >= 4) {
      return {
        name: parts[0] || 'Ismeretlen beteg',
        taj: parts.length >= 5 ? parts[1] : null,
        ward: parts.length >= 5 ? parts[2] : parts[1],
        bed: parts.length >= 5 ? parts[3] : parts[2],
        timestamp: parts.length >= 5 ? parts[4] : parts[3],
        rawQr: qrString
      };
    }

    return null;
  }

  if (btnParseQr) btnParseQr.addEventListener('click', processQrInput);
  if (qrInput) {
    qrInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') processQrInput();
    });
  }

  function processQrInput() {
    const rawVal = qrInput ? qrInput.value.trim() : '';
    const result = parseQR(rawVal);

    if (!result) {
      alert('Érvénytelen QR kód formátum! Használja a "Név??Osztály??Ágyszám??Idő" struktúrát (pl. Kovács István??Általános Sebészet??12/A??20261104084338).');
      return;
    }

    parsedPatient = result;

    const elName = document.getElementById('p-name');
    const elTaj = document.getElementById('p-taj');
    const elWardBed = document.getElementById('p-ward-bed');
    const elTime = document.getElementById('p-time');

    if (elName) elName.innerText = parsedPatient.name;
    if (elTaj) elTaj.innerText = parsedPatient.taj || 'Nincs megadva';
    if (elWardBed) elWardBed.innerText = `${parsedPatient.ward} / ${parsedPatient.bed}`;
    if (elTime) elTime.innerText = parsedPatient.timestamp;

    if (btnOpenScanner) btnOpenScanner.disabled = false;
    if (btnSaveDispensing) btnSaveDispensing.disabled = false;
    
    renderTable();
  }

  // 3. Modal & Vonalkód Kezelés
  if (btnOpenScanner) btnOpenScanner.addEventListener('click', openModal);
  
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2' && btnOpenScanner && !btnOpenScanner.disabled) {
      e.preventDefault();
      openModal();
    }
  });

  function openModal() {
    if (modal) modal.style.display = 'flex';
    if (barcodeInput) barcodeInput.focus();
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  function closeModal() {
    if (modal) modal.style.display = 'none';
    resetModal();
  }

  // Vonalkód keresése Supabase-ben
  if (barcodeInput) {
    barcodeInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const barcode = barcodeInput.value.trim();
        if (!barcode) return;

        try {
          const { data: med, error } = await db
            .from('medication_master')
            .select('*')
            .eq('barcode', barcode)
            .maybeSingle();

          if (error || !med) {
            alert('A gyógyszer nem található a gyógyszertörzsben!');
            return;
          }

          activeMedication = med;
          document.getElementById('scanned-med-name').innerText = med.name;
          document.getElementById('scanned-med-morphology').innerText = med.morphology || 'Nincs leírás.';

          // Korábbi LOT számok betöltése
          const { data: batches } = await db
            .from('batch_records')
            .select('*')
            .eq('medication_id', med.id)
            .order('expiry_date', { ascending: true });

          lotSelect.innerHTML = '<option value="">-- Válassz korábbi LOT-ot --</option>';
          if (batches && batches.length > 0) {
            batches.forEach(b => {
              lotSelect.innerHTML += `<option value="${b.id}">${b.lot_number} (Lejárat: ${b.expiry_date})</option>`;
            });
          }

          if (scannedDetails) scannedDetails.classList.remove('hidden');
          if (btnAddItem) btnAddItem.classList.remove('hidden');
        } catch (err) {
          console.error('Keresési hiba:', err);
          alert('Hiba történt a gyógyszer keresésekor.');
        }
      }
    });
  }

  if (btnToggleNewLot) {
    btnToggleNewLot.addEventListener('click', () => {
      if (newLotInputs) newLotInputs.classList.toggle('hidden');
    });
  }

  // Tétel Hozzáadása a Tálcához
  if (btnAddItem) {
    btnAddItem.addEventListener('click', async () => {
      if (!activeMedication) return;

      let selectedBatchId = lotSelect.value || null;
      let lotText = 'Nincs megadva';
      let newLotNumberToInsert = document.getElementById('new-lot-number').value.trim();
      let newExpiryDateToInsert = document.getElementById('new-expiry-date').value;

      if (selectedBatchId && lotSelect.selectedIndex > 0) {
        lotText = lotSelect.options[lotSelect.selectedIndex].text;
      }

      if (newLotNumberToInsert && newExpiryDateToInsert) {
        try {
          const { data: insertedBatch } = await db
            .from('batch_records')
            .insert([{
              medication_id: activeMedication.id,
              lot_number: newLotNumberToInsert,
              expiry_date: newExpiryDateToInsert
            }])
            .select()
            .single();

          if (insertedBatch) {
            selectedBatchId = insertedBatch.id;
            lotText = `${insertedBatch.lot_number} (Lejárat: ${insertedBatch.expiry_date})`;
          } else {
            lotText = `${newLotNumberToInsert} (Lejárat: ${newExpiryDateToInsert})`;
          }
        } catch (err) {
          console.error('Batch mentési hiba:', err);
          lotText = `${newLotNumberToInsert} (Lejárat: ${newExpiryDateToInsert})`;
        }
      }

      const item = {
        medication_id: activeMedication.id,
        medication_name: activeMedication.name,
        morphology: activeMedication.morphology,
        batch_id: selectedBatchId,
        lot_text: lotText,
        morning: parseFloat(document.getElementById('dose-morning').value) || 0,
        noon: parseFloat(document.getElementById('dose-noon').value) || 0,
        evening: parseFloat(document.getElementById('dose-evening').value) || 0,
        night: parseFloat(document.getElementById('dose-night').value) || 0
      };

      currentItems.push(item);
      renderTable();
      closeModal();
    });
  }

  function renderTable() {
    const tbody = document.getElementById('med-table-body');
    if (!tbody) return;

    if (currentItems.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Még nincs rögzített gyógyszer ezen a tálcán.</td></tr>';
      return;
    }

    tbody.innerHTML = currentItems.map((item, idx) => `
      <tr>
        <td><strong>${item.medication_name}</strong></td>
        <td>${item.morphology || '-'}</td>
        <td><strong>${item.lot_text}</strong></td>
        <td>${item.morning}</td>
        <td>${item.noon}</td>
        <td>${item.evening}</td>
        <td>${item.night}</td>
        <td><button type="button" onclick="removeItem(${idx})" class="btn-link" style="color:red;">Törlés</button></td>
      </tr>
    `).join('');
  }

  window.removeItem = function(idx) {
    currentItems.splice(idx, 1);
    renderTable();
  };

  function resetModal() {
    if (barcodeInput) barcodeInput.value = '';
    if (scannedDetails) scannedDetails.classList.add('hidden');
    if (btnAddItem) btnAddItem.classList.add('hidden');
    if (newLotInputs) newLotInputs.classList.add('hidden');
    document.getElementById('new-lot-number').value = '';
    document.getElementById('new-expiry-date').value = '';
    document.getElementById('dose-morning').value = '0';
    document.getElementById('dose-noon').value = '0';
    document.getElementById('dose-evening').value = '0';
    document.getElementById('dose-night').value = '0';
    activeMedication = null;
  }

  // 4. Teljes Tálca & Beteg Törzs Mentése Supabase-be
  if (btnSaveDispensing) {
    btnSaveDispensing.addEventListener('click', async () => {
      if (!parsedPatient) {
        alert('Nincs beolvasott beteg QR kód!');
        return;
      }
      if (currentItems.length === 0) {
        alert('Legalább egy gyógyszert rögzíteni kell a lezáráshoz!');
        return;
      }

      btnSaveDispensing.disabled = true;
      btnSaveDispensing.innerText = 'Mentés folyamatban...';

      try {
        let patientId = null;
        try {
          const { data: patientRecord } = await db
            .from('patients')
            .insert([{
              name: parsedPatient.name,
              taj_number: parsedPatient.taj,
              ward: parsedPatient.ward,
              bed_number: parsedPatient.bed
            }])
            .select()
            .single();

          if (patientRecord) patientId = patientRecord.id;
        } catch (pErr) {
          console.warn('Patient beszúrási megjegyzés:', pErr);
        }

        const { data: record, error: recError } = await db
          .from('dispensing_records')
          .insert([{
            qr_identifier: parsedPatient.rawQr,
            patient_id: patientId,
            patient_name: parsedPatient.name,
            patient_taj: parsedPatient.taj,
            ward: parsedPatient.ward,
            bed_number: parsedPatient.bed,
            status: 'draft',
            notes: document.getElementById('dispensing-notes').value.trim()
          }])
          .select()
          .single();

        if (recError) throw recError;

        const itemsToInsert = currentItems.map(it => ({
          dispensing_record_id: record.id,
          medication_id: it.medication_id,
          batch_id: it.batch_id,
          morning_dose: it.morning,
          noon_dose: it.noon,
          evening_dose: it.evening,
          night_dose: it.night
        }));

        const { error: itemsError } = await db
          .from('dispensed_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        alert('Tálca és betegadatok sikeresen elmentve!');
        window.location.href = '../index.html';
      } catch (err) {
        console.error('Mentési hiba:', err);
        alert('Hiba történt a tálca mentése során: ' + err.message);
      } finally {
        btnSaveDispensing.disabled = false;
        btnSaveDispensing.innerText = 'Tálca Lezárása és Mentése Supabase-be';
      }
    });
  }
});
