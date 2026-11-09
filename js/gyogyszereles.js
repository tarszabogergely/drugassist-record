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
  const pWard = document.getElementById('p-ward');
  const pBed = document.getElementById('p-bed');
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

  // Karakterkódolási hiba javító segédfunkció
  function fixUtf8Encoding(str) {
    if (!str) return str;
    try {
      return decodeURIComponent(escape(str));
    } catch (e) {
      return str;
    }
  }

  // 2. QR kód beolvasása & feldolgozása (4 és 5 elemes formátum támogatása)
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

    const cleanQr = fixUtf8Encoding(rawVal);
    const parts = cleanQr.split('??').map(p => p.trim());

    if (parts.length === 4) {
      // Régi formátum: Név??Osztály??Ágyszám??Azonosító
      currentPatient = {
        name: parts[0] || 'Névtelen Beteg',
        taj: null,
        ward: parts[1] || 'Ismeretlen Osztály',
        bed: parts[2] || '-',
        timestamp: parts[3] || new Date().toISOString(),
        rawQr: rawVal
      };
    } else if (parts.length >= 5) {
      // Új formátum: Név??TAJ??Osztály??Ágyszám??Azonosító
      currentPatient = {
        name: parts[0] || 'Névtelen Beteg',
        taj: parts[1] || null,
        ward: parts[2] || 'Ismeretlen Osztály',
        bed: parts[3] || '-',
        timestamp: parts[4] || new Date().toISOString(),
        rawQr: rawVal
      };
    }

    if (pName) pName.innerText = currentPatient.name;
    if (pTaj) pTaj.innerText = currentPatient.taj || 'Lekérdezés...';
    if (pWard) pWard.innerText = currentPatient.ward;
    if (pBed) pBed.innerText = currentPatient.bed;
    if (pTime) pTime.innerText = currentPatient.timestamp;

    if (btnOpenScanner) btnOpenScanner.disabled = false;
    if (btnSaveDispensing) btnSaveDispensing.disabled = false;

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
        const tajToUse = patientObj.taj || existingPatient.taj_number || '-';
        if (pTaj) pTaj.innerText = tajToUse;
        currentPatient.taj = tajToUse !== '-' ? tajToUse : null;

        if (!existingPatient.taj_number && patientObj.taj) {
          await db.from('patients').update({ taj_number: patientObj.taj }).eq('id', existingPatient.id);
        }
      } else {
        if (pTaj) pTaj.innerText = patientObj.taj || 'Új beteg (Nincs TAJ)';
        await db.from('patients').insert([{
          name: patientObj.name,
          taj_number: patientObj.taj || null,
          ward: patientObj.ward,
          bed_number: patientObj.bed
        }]);
      }
    } catch (err) {
      console.error('Beteg lekérdezési / mentési hiba:', err);
      if (pTaj && !currentPatient.taj) pTaj.innerText = '-';
    }
  }

  // 3. Modal Nyitása, Esc Bezárás, Ctrl+Enter Lezárás & "+" Gyorsgomb
  if (btnOpenScanner) {
    btnOpenScanner.addEventListener('click', openScanModal);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (scanModal && scanModal.style.display === 'flex') {
        scanModal.style.display = 'none';
      }
    } 
    else if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      if (btnSaveDispensing && !btnSaveDispensing.disabled) {
        btnSaveDispensing.click();
      }
    }
    else if ((e.key === '+' || e.code === 'NumpadAdd') && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (btnOpenScanner && !btnOpenScanner.disabled) {
        openScanModal();
      }
    }
    else if (e.key === 'F3') {
      e.preventDefault();
      if (scanModal && scanModal.style.display === 'flex' && btnAddItem && !btnAddItem.classList.contains('hidden')) {
        btnAddItem.click();
      }
    }
  });

  function openScanModal() {
    resetModal();
    scanModal.style.display = 'flex';
    if (barcodeInput) barcodeInput.focus();
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      scanModal.style.display = 'none';
    });
  }

  function resetModal() {
    if (barcodeInput) barcodeInput.value = '';
    if (medScannedDetails) medScannedDetails.classList.add('hidden');
    if (btnAddItem) btnAddItem.classList.add('hidden');
    currentScannedMed = null;
    batchListForMed = [];
    if (newLotNumber) newLotNumber.value = '';
    if (newExpiryDate) newExpiryDate.value = '';
    if (doseMorning) doseMorning.value = 0;
    if (doseNoon) doseNoon.value = 0;
    if (doseEvening) doseEvening.value = 0;
    if (doseNight) doseNight.value = 0;
    if (lotBubblesWrapper) {
      lotBubblesWrapper.innerHTML = '<span style="color: #94a3b8; font-style: italic; font-size: 0.88rem;">Nincs rögzített korábbi LOT.</span>';
    }
  }

  // 4. Gyógyszer vonalkódolvasása
  if (barcodeInput) {
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
          if (scannedMedName) scannedMedName.innerText = med.name;
          if (scannedMedMorphology) scannedMedMorphology.innerText = med.morphology || 'Nincs leírás megadva';

          const { data: batches } = await db
            .from('batch_records')
            .select('*')
            .eq('medication_id', med.id)
            .order('expiry_date', { ascending: true });

          batchListForMed = batches || [];
          renderLotBubbles(batchListForMed);

          if (medScannedDetails) medScannedDetails.classList.remove('hidden');
          if (btnAddItem) btnAddItem.classList.remove('hidden');
          if (newLotNumber) newLotNumber.focus();
        } catch (err) {
          console.error('Gyógyszerkeresési hiba:', err);
        }
      }
    });
  }

  function renderLotBubbles(batches) {
    if (lotSelect) lotSelect.innerHTML = '<option value="">-- Új LOT felvétele --</option>';

    if (!batches || batches.length === 0) {
      if (lotBubblesWrapper) {
        lotBubblesWrapper.innerHTML = '<span style="color: #94a3b8; font-style: italic; font-size: 0.88rem;">Nincs rögzített korábbi LOT (töltsd ki az alsó mezőket).</span>';
      }
      return;
    }

    if (lotBubblesWrapper) {
      lotBubblesWrapper.innerHTML = batches.map(b => {
        if (lotSelect) lotSelect.innerHTML += `<option value="${b.id}">${b.lot_number} (${b.expiry_date})</option>`;
        return `<div class="lot-bubble" data-batch-id="${b.id}">${b.lot_number} <span style="font-size:0.75rem; opacity:0.8;">(${b.expiry_date})</span></div>`;
      }).join('');
    }

    // Eseménykezelők a LOT buborékokra
    document.querySelectorAll('.lot-bubble').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedId = btn.getAttribute('data-batch-id');
        const isSelected = btn.classList.contains('selected');

        document.querySelectorAll('.lot-bubble').forEach(b => b.classList.remove('selected'));

        if (!isSelected) {
          btn.classList.add('selected');
          if (lotSelect) lotSelect.value = selectedId;
          const selectedBatch = batchListForMed.find(b => b.id === selectedId);
          if (selectedBatch) {
            if (newLotNumber) newLotNumber.value = selectedBatch.lot_number;
            if (newExpiryDate) newExpiryDate.value = selectedBatch.expiry_date;
          }
        } else {
          if (lotSelect) lotSelect.value = '';
          if (newLotNumber) newLotNumber.value = '';
          if (newExpiryDate) newExpiryDate.value = '';
        }
      });
    });

    // AMIKOR PONTOSAN 1 DB LOT RECORD LÉTEZIK: AUTOMATIKUS KIJELÖLÉS ÉS KITÖLTÉS
    if (batches.length === 1) {
      const singleBatch = batches[0];
      const singleBubble = document.querySelector(`.lot-bubble[data-batch-id="${singleBatch.id}"]`);
      if (singleBubble) {
        singleBubble.classList.add('selected');
      }
      if (lotSelect) lotSelect.value = singleBatch.id;
      if (newLotNumber) newLotNumber.value = singleBatch.lot_number;
      if (newExpiryDate) newExpiryDate.value = singleBatch.expiry_date;
    }
  }

  // 5. Gyógyszer Hozzáadása a Tálcához (AddItem)
  if (btnAddItem) {
    btnAddItem.addEventListener('click', async () => {
      if (!currentScannedMed) return;

      const lotNum = newLotNumber ? newLotNumber.value.trim() : '';
      const expDate = newExpiryDate ? newExpiryDate.value : '';

      if (!lotNum || !expDate) {
        alert('Kérjük, adja meg a Gyári számot (LOT) és a lejárati dátumot!');
        return;
      }

      const mDose = parseFloat(doseMorning ? doseMorning.value : 0) || 0;
      const nDose = parseFloat(doseNoon ? doseNoon.value : 0) || 0;
      const eDose = parseFloat(doseEvening ? doseEvening.value : 0) || 0;
      const niDose = parseFloat(doseNight ? doseNight.value : 0) || 0;

      if (mDose + nDose + eDose + niDose === 0) {
        alert('Legalább egy napszakhoz adjon meg adagolási mennyiséget!');
        return;
      }

      let batchId = lotSelect ? lotSelect.value : '';

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
  }

  function renderTrayTable() {
    if (!medTableBody) return;

    if (currentTrayItems.length === 0) {
      medTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Még nincs rögzített gyógyszer ezen a tálcán. Olvassa be a beteg QR kódját, majd nyomja meg a "+" gombot.</td></tr>';
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
  if (btnSaveDispensing) {
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
            notes: dispensingNotes ? dispensingNotes.value.trim() : ''
          }])
          .select()
          .single();

        if (recErr) throw recErr;

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
        
        // Form és adatok ürítése
        resetDispensingPage();

      } catch (err) {
        console.error('Mentési hiba:', err);
        alert(`Hiba történt a tálca mentése során!\n\nRészletek: ${err.message}`);
      } finally {
        btnSaveDispensing.disabled = true;
        btnSaveDispensing.innerText = '✓ Lezárás';
      }
    });
  }

  // 7. Segédfunkció: Form és állapottömbök teljes kiürítése lezárás után
  function resetDispensingPage() {
    currentTrayItems = [];
    currentPatient = null;
    currentScannedMed = null;

    if (qrInput) qrInput.value = '';
    if (dispensingNotes) dispensingNotes.value = '';

    if (pName) pName.innerText = '-';
    if (pTaj) pTaj.innerText = '-';
    if (pWard) pWard.innerText = '-';
    if (pBed) pBed.innerText = '-';
    if (pTime) pTime.innerText = '-';

    if (btnOpenScanner) btnOpenScanner.disabled = true;
    if (btnSaveDispensing) btnSaveDispensing.disabled = true;
    renderTrayTable();

    if (qrInput) qrInput.focus();
  }
});
