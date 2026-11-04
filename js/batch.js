/**
 * DrugAssist Record - Gyári Számok (LOT) Modul Logika
 */

document.addEventListener('DOMContentLoaded', () => {
  let allMedications = [];
  let selectedMedication = null;
  let currentMedBatches = [];

  // DOM elemek
  const batchSearchInput = document.getElementById('batch-search-input');
  const batchMedTableBody = document.getElementById('batch-med-table-body');
  const totalMedCount = document.getElementById('total-med-count');
  const btnRefreshBatchList = document.getElementById('btn-refresh-batch-list');

  const batchModal = document.getElementById('batch-modal');
  const btnCloseBatchModal = document.getElementById('btn-close-batch-modal');
  const modalMedName = document.getElementById('modal-med-name');
  const modalMedDetails = document.getElementById('modal-med-details');

  const addBatchForm = document.getElementById('add-batch-form');
  const newBatchLot = document.getElementById('new-batch-lot');
  const newBatchExpiry = document.getElementById('new-batch-expiry');
  const batchItemsBody = document.getElementById('batch-items-body');

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

  // 2. Gyógyszerek és BATCH-ek betöltése Supabase-ből
  loadMedicationData();

  if (btnRefreshBatchList) {
    btnRefreshBatchList.addEventListener('click', loadMedicationData);
  }

  async function loadMedicationData() {
    try {
      batchMedTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Gyógyszertörzs betöltése...</td></tr>';

      // Gyógyszertörzs és a hozzájuk tartozó batch-ek lekérdezése
      const { data: meds, error } = await db
        .from('medication_master')
        .select(`
          *,
          batch_records (id, lot_number, expiry_date)
        `)
        .order('name', { ascending: true });

      if (error) throw error;

      allMedications = meds || [];
      renderMedicationTable(allMedications);
    } catch (err) {
      console.error('Hiba a gyógyszerek betöltésekor:', err);
      batchMedTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Hiba történt az adatok betöltése során!</td></tr>';
    }
  }

  // Táblázat kirajzolása
  function renderMedicationTable(list) {
    totalMedCount.innerText = list.length;

    if (list.length === 0) {
      batchMedTableBody.innerHTML = '<tr class="empty-row"><td colspan="5">Nincs a keresésnek megfelelő gyógyszer.</td></tr>';
      return;
    }

    batchMedTableBody.innerHTML = list.map(med => {
      const batchCount = med.batch_records ? med.batch_records.length : 0;
      return `
        <tr class="clickable-row" onclick="openBatchModal('${med.id}')">
          <td><code>${med.barcode || '-'}</code></td>
          <td><strong>${med.name}</strong></td>
          <td>${med.morphology || '-'}</td>
          <td><span class="badge" style="background: ${batchCount > 0 ? '#10b981' : '#64748b'}; color:white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.85rem;">${batchCount} LOT</span></td>
          <td>
            <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;">Megnyitás</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Keresés eseménykezelő
  batchSearchInput.addEventListener('input', () => {
    const term = batchSearchInput.value.toLowerCase().trim();
    const filtered = allMedications.filter(m => 
      (m.name && m.name.toLowerCase().includes(term)) ||
      (m.barcode && m.barcode.toLowerCase().includes(term)) ||
      (m.morphology && m.morphology.toLowerCase().includes(term))
    );
    renderMedicationTable(filtered);
  });

  // 3. Modal Nyitása & LOT Lista Kezelése
  window.openBatchModal = function(medId) {
    selectedMedication = allMedications.find(m => m.id === medId);
    if (!selectedMedication) return;

    modalMedName.innerText = selectedMedication.name;
    modalMedDetails.innerText = `Vonalkód: ${selectedMedication.barcode || '-'} | Morfológia: ${selectedMedication.morphology || '-'}`;

    newBatchLot.value = '';
    newBatchExpiry.value = '';

    loadBatchesForSelectedMed();
    batchModal.style.display = 'flex';
  };

  async function loadBatchesForSelectedMed() {
    if (!selectedMedication) return;

    try {
      batchItemsBody.innerHTML = '<tr class="empty-row"><td colspan="3">LOT rekordok betöltése...</td></tr>';

      const { data: batches, error } = await db
        .from('batch_records')
        .select('*')
        .eq('medication_id', selectedMedication.id)
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      currentMedBatches = batches || [];
      renderBatchItemsTable(currentMedBatches);
    } catch (err) {
      console.error('Hiba a LOT-ok betöltésekor:', err);
      batchItemsBody.innerHTML = '<tr class="empty-row"><td colspan="3">Hiba történt a gyári számok betöltésekor.</td></tr>';
    }
  }

  function renderBatchItemsTable(batches) {
    if (batches.length === 0) {
      batchItemsBody.innerHTML = '<tr class="empty-row"><td colspan="3">Még nincs rögzített gyári szám ehhez a gyógyszerhez.</td></tr>';
      return;
    }

    batchItemsBody.innerHTML = batches.map(b => `
      <tr>
        <td><input type="text" id="lot-input-${b.id}" value="${b.lot_number}" style="padding: 0.3rem 0.5rem; font-size: 0.9rem; font-weight: bold; width: 100%;"></td>
        <td><input type="date" id="exp-input-${b.id}" value="${b.expiry_date}" style="padding: 0.3rem 0.5rem; font-size: 0.9rem; width: 100%;"></td>
        <td style="white-space: nowrap;">
          <button type="button" onclick="updateBatch('${b.id}')" class="btn btn-primary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: #3b82f6;">Mentés</button>
          <button type="button" onclick="deleteBatch('${b.id}')" class="btn btn-secondary btn-sm" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: #dc2626; color: white; border: none;">Törlés</button>
        </td>
      </tr>
    `).join('');
  }

  // 4. Új LOT Hozzáadása
  addBatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedMedication) return;

    const lot = newBatchLot.value.trim();
    const expiry = newBatchExpiry.value;

    if (!lot || !expiry) {
      alert('Kérjük, adja meg a Gyári számot és a lejárati dátumot!');
      return;
    }

    try {
      const { error } = await db.from('batch_records').insert([{
        medication_id: selectedMedication.id,
        lot_number: lot,
        expiry_date: expiry
      }]);

      if (error) throw error;

      newBatchLot.value = '';
      newBatchExpiry.value = '';
      loadBatchesForSelectedMed();
      loadMedicationData(); // Fő táblázat frissítése a számláló miatt
    } catch (err) {
      console.error('Hiba az új LOT beszúrásakor:', err);
      alert('Hiba történt az új gyári szám rögzítése során!');
    }
  });

  // 5. Meglévő LOT Módosítása
  window.updateBatch = async function(batchId) {
    const lotInput = document.getElementById(`lot-input-${batchId}`);
    const expInput = document.getElementById(`exp-input-${batchId}`);

    if (!lotInput || !expInput) return;

    const updatedLot = lotInput.value.trim();
    const updatedExp = expInput.value;

    if (!updatedLot || !updatedExp) {
      alert('A gyári szám és a lejárati dátum nem lehet üres!');
      return;
    }

    try {
      const { error } = await db
        .from('batch_records')
        .update({
          lot_number: updatedLot,
          expiry_date: updatedExp
        })
        .eq('id', batchId);

      if (error) throw error;

      alert('Gyári szám sikeresen frissítve!');
      loadBatchesForSelectedMed();
    } catch (err) {
      console.error('Hiba a LOT frissítésekor:', err);
      alert('Hiba történt a frissítés során!');
    }
  };

  // 6. LOT Törlése
  window.deleteBatch = async function(batchId) {
    if (!confirm('Biztosan törölni szeretné ezt a gyári számot?')) return;

    try {
      const { error } = await db
        .from('batch_records')
        .delete()
        .eq('id', batchId);

      if (error) throw error;

      loadBatchesForSelectedMed();
      loadMedicationData();
    } catch (err) {
      console.error('Hiba a LOT törlésekor:', err);
      alert('Hiba történt a törlés során!');
    }
  };

  // 7. Modal Bezárása & Esc billentyű kezelése
  if (btnCloseBatchModal) {
    btnCloseBatchModal.addEventListener('click', closeBatchModal);
  }

  function closeBatchModal() {
    batchModal.style.display = 'none';
    selectedMedication = null;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (batchModal && batchModal.style.display === 'flex') {
        closeBatchModal();
      }
    }
  });
});
