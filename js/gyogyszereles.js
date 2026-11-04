/**
 * DrugAssist Record - Gyógyszerelés Rögzítés & QR Parser
 */

document.addEventListener('DOMContentLoaded', () => {
  // Aktuális állapot (State)
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
  document.getElementById('user-display').innerText = `${currentUser.full_name} (${currentUser.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens'})`;

  // 2. QR Kód Szétbontása (Delimiter: ??)
  function parseQR(qrString) {
    if (!qrString || !qrString.includes('??')) return null;
    const parts = qrString.split('??').map(p => p.trim());

    // 4 elem esetén: Név, Osztály, Ágyszám, Időbélyeg
    if (parts.length === 4) {
      return {
        name: parts[0],
        taj: 'Nincs megadva',
        ward: parts[1],
        bed: parts[2],
        timestamp: parts[3],
        rawQr: qrString
      };
    }

    // 5 elem esetén (ha később TAJ szám is lesz benne): Név, TAJ, Osztály, Ágyszám, Időbélyeg
    if (parts.length === 5) {
      return {
        name: parts[0],
        taj: parts[1],
        ward: parts[2],
        bed: parts[3],
        timestamp: parts[4],
        rawQr: qrString
      };
    }

    return null;
  }

  // QR Betöltés Esemény
  btnParseQr.addEventListener('click', processQrInput);
  qrInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') processQrInput();
  });

  function processQrInput() {
    const rawVal = qrInput.value.trim();
    const result = parseQR(rawVal);

    if (!result) {
      alert('Érvénytelen QR kód formátum! Használja a "Név??Osztály??Ágyszám??Idő" struktúrát.');
      return;
    }

    parsedPatient = result;
    document.getElementById('p-name').innerText = parsedPatient.name;
    document.getElementById('p-taj').innerText = parsedPatient.taj;
    document.getElementById('p-ward-bed').innerText = `${parsedPatient.ward} / ${parsedPatient.bed}`;
    document.getElementById('p-time').innerText = parsedPatient.timestamp;

    btnOpenScanner.disabled = false;
    btnSaveDispensing.disabled = false;
    renderTable();
  }

  // 3. Modal Kezelés & Vonalkód Olvasás
  btnOpenScanner.addEventListener('click', openModal);
  
  // F2 Gyorsbillentyű a beolvasáshoz
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2' && !btnOpenScanner.disabled) {
      e.preventDefault();
      openModal();
    }
  });

  function openModal() {
    modal.style.display = 'flex';
    barcodeInput.focus();
  }

  btnCloseModal.addEventListener('click', closeModal);

  function closeModal() {
    modal.style.display = 'none';
    resetModal();
  }

  // Vonalkód keresése Supabase-ben
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

        // Korábbi LOT számok betöltése a batch_records táblából
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

        scannedDetails.classList.remove('hidden');
        btnAddItem.classList.remove('hidden');
      } catch (err) {
        console.error('Keresési hiba:', err);
        alert('Hiba történt a gyógyszer keresésekor.');
      }
    }
  });

  // Új LOT mezo váltó
  btnToggleNewLot.addEventListener('click', () => {
    newLotInputs.classList.toggle('hidden');
  });

  // Tétel hozzáadása
  btnAddItem.addEventListener('click', async () => {
    if (!activeMedication) return;

    let selectedBatchId = lotSelect.value;
    let lotText = lotSelect.selectedOptions[0]?.text || 'Nincs megadva';

    // Ha új LOT-ot adott meg
    const newLotNum = document.getElementById('new-lot-number').value.trim();
    const newExpDate = document.getElementById('new-expiry-date').value;

    if (newLotNum && newExpDate) {
      try {
        const { data: newBatch } = await db
          .from('batch_records')
          .insert([{ medication_id: activeMedication.id, lot_number: newLotNum, expiry_date: newExpDate }])
          .select()
          .single();

        if (newBatch) {
          selectedBatchId = newBatch.id;
          lotText = `${newBatch.lot_number} (Lejárat: ${newBatch.expiry_date})`;
        }
      } catch (err) {
        console.error('LOT mentési hiba:', err);
      }
    }

    const item = {
      medication_id: activeMedication.id,
      medication_name: activeMedication.name,
      morphology: activeMedication.morphology,
      batch_id: selectedBatchId || null,
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

  // Táblázat kirajzolása
  function renderTable() {
    const tbody = document.getElementById('med-table-body');
    if (currentItems.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Még nincs rögzített gyógyszer ezen a tálcán.</td></tr>';
      return;
    }

    tbody.innerHTML = currentItems.map((item, idx) => `
      <tr>
        <td><strong>${item.medication_name}</strong></td>
        <td>${item.morphology || '-'}</td>
        <td>${item.lot_text}</td>
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
    barcodeInput.value = '';
    scannedDetails.classList.add('hidden');
    btnAddItem.classList.add('hidden');
    newLotInputs.classList.add('hidden');
    document.getElementById('new-lot-number').value = '';
    document.getElementById('new-expiry-date').value = '';
    document.getElementById('dose-morning').value = '0';
    document.getElementById('dose-noon').value = '0';
    document.getElementById('dose-evening').value = '0';
    document.getElementById('dose-night').value = '0';
    activeMedication = null;
  }

  // 4. Teljes Tálca Mentése Supabase-be
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
      // 4a. Fejléc mentése
      const { data: record, error: recError } = await db
        .from('dispensing_records')
        .insert([{
          qr_identifier: parsedPatient.rawQr,
          patient_name: parsedPatient.name,
          patient_taj: parsedPatient.taj,
          ward: parsedPatient.ward,
          bed_number: parsedPatient.bed,
          status: 'draft',
          notes: document.getElementById('dispensing-notes').value.trim(),
          created_by: currentUser.id
        }])
        .select()
        .single();

      if (recError) throw recError;

      // 4b. Tételek mentése
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

      alert('Tálca sikeresen elmentve!');
      window.location.href = '../index.html';
    } catch (err) {
      console.error('Mentési hiba:', err);
      alert('Hiba történt a tálca mentése során: ' + err.message);
    } finally {
      btnSaveDispensing.disabled = false;
      btnSaveDispensing.innerText = 'Tálca Lezárása és Mentése Supabase-be';
    }
  });
});
