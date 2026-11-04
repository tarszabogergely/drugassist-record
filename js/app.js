// Helyi állapot (State)
let currentPatient = null;
let currentItems = [];
let activeMedication = null;

// Elemek kijelölése
const modal = document.getElementById('scan-modal');
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCloseModal = document.querySelector('.close-modal');
const barcodeInput = document.getElementById('barcode-input');
const scannedDetails = document.getElementById('med-scanned-details');
const btnAddItem = document.getElementById('btn-add-item');

// Modal Megnyitás / Bezárás
btnOpenScanner.addEventListener('click', () => {
  modal.style.display = 'flex';
  barcodeInput.focus();
});

btnCloseModal.addEventListener('click', () => {
  modal.style.display = 'none';
  resetModal();
});

// Vonalkódolvasás szimulálása / Enter gomb
barcodeInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const barcode = barcodeInput.value.trim();
    if (!barcode) return;

    const med = await getMedicationByBarcode(barcode);
    if (med) {
      activeMedication = med;
      document.getElementById('scanned-med-name').innerText = med.name;
      document.getElementById('scanned-med-morphology').innerText = med.morphology || 'Nincs leírás.';
      
      // LOT számok betöltése
      const batches = await getBatchesForMedication(med.id);
      const lotSelect = document.getElementById('lot-select');
      lotSelect.innerHTML = '<option value="">-- Válassz korábbi LOT-ot --</option>';
      batches.forEach(b => {
        lotSelect.innerHTML += `<option value="${b.id}">${b.lot_number} (Lejárat: ${b.expiry_date})</option>`;
      });

      scannedDetails.classList.remove('hidden');
      btnAddItem.classList.remove('hidden');
    } else {
      alert('A gyógyszer nem található a törzsben!');
    }
  }
});

// Tétel hozzáadása a tálcához
btnAddItem.addEventListener('click', () => {
  if (!activeMedication) return;

  const newItem = {
    medication_id: activeMedication.id,
    medication_name: activeMedication.name,
    morphology: activeMedication.morphology,
    batch_id: document.getElementById('lot-select').value || null,
    lot_text: document.getElementById('lot-select').selectedOptions[0]?.text || 'Nincs megadva',
    morning_dose: parseFloat(document.getElementById('dose-morning').value) || 0,
    noon_dose: parseFloat(document.getElementById('dose-noon').value) || 0,
    evening_dose: parseFloat(document.getElementById('dose-evening').value) || 0,
    night_dose: parseFloat(document.getElementById('dose-night').value) || 0
  };

  currentItems.push(newItem);
  renderTable();
  modal.style.display = 'none';
  resetModal();
});

// Táblázat kirajzolása
function renderTable() {
  const tbody = document.getElementById('med-table-body');
  if (currentItems.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Még nincs rögzített gyógyszer.</td></tr>';
    return;
  }

  tbody.innerHTML = currentItems.map((item, index) => `
    <tr>
      <td><strong>${item.medication_name}</strong></td>
      <td>${item.morphology || '-'}</td>
      <td>${item.lot_text}</td>
      <td>${item.morning_dose}</td>
      <td>${item.noon_dose}</td>
      <td>${item.evening_dose}</td>
      <td>${item.night_dose}</td>
      <td><button onclick="removeItem(${index})" class="btn-link" style="color:red;">Törlés</button></td>
    </tr>
  `).join('');
}

function removeItem(index) {
  currentItems.splice(index, 1);
  renderTable();
}

function resetModal() {
  barcodeInput.value = '';
  scannedDetails.classList.add('hidden');
  btnAddItem.classList.add('hidden');
  activeMedication = null;
}
