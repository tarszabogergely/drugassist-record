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
  document.getElementById('user-display').innerText = `${currentUser.full_name} (${currentUser.role === 'pharmacist' ? 'Gyógyszerész' : 'Asszisztens'})`;

  // 2. QR Kód Szétbontása (Delimiter: ??)
  function parseQR(qrString) {
    if (!qrString || !qrString.includes('??')) return null;
    const parts = qrString.split('??').map(p => p.trim());

    if (parts.length === 4) {
      return {
        name: parts[0],
        taj: null,
        ward: parts[1],
        bed: parts[2],
        timestamp: parts[3],
        rawQr: qrString
      };
    }

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
    document.getElementById('p-taj').innerText = parsedPatient.taj || 'Nincs megadva';
    document.getElementById('p-ward-bed').innerText = `${parsedPatient.ward} /${parsedPatient.bed}`;
    document.getElementById('p-time').innerText = parsedPatient.timestamp;

    btnOpenScanner.disabled = false;
    btnSaveDispensing.disabled = false;
    renderTable();
  }

  // 3. Modal & Vonalkód Kezelés
  btnOpenScanner.addEventListener('click', openModal);
  
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
            lotSelect.innerHTML += `<option value="${b.id}">${
