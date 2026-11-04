/**
 * DrugAssist Record - Felhasználási Statisztikák Modul
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM elemek
  const filterStatus = document.getElementById('filter-status');
  const filterWard = document.getElementById('filter-ward');
  const btnApplyFilter = document.getElementById('btn-apply-filter');

  const kpiTrays = document.getElementById('kpi-trays');
  const kpiMedTypes = document.getElementById('kpi-med-types');
  const kpiTotalDoses = document.getElementById('kpi-total-doses');

  const medSummaryBody = document.getElementById('med-summary-body');
  const wardSummaryBody = document.getElementById('ward-summary-body');

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

  // 2. Statisztikák betöltése
  loadAnalytics();

  if (btnApplyFilter) {
    btnApplyFilter.addEventListener('click', loadAnalytics);
  }

  async function loadAnalytics() {
    try {
      medSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="7">Adatok elemzése...</td></tr>';
      wardSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="3">Adatok elemzése...</td></tr>';

      const statusVal = filterStatus.value;
      const wardVal = filterWard.value.trim().toLowerCase();

      // 2a. Dispensing records lekérdezése
      let recordsQuery = db.from('dispensing_records').select('*');
      if (statusVal !== 'all') {
        recordsQuery = recordsQuery.eq('status', statusVal);
      }

      const { data: records, error: recErr } = await recordsQuery;
      if (recErr) throw recErr;

      let filteredRecords = records || [];
      if (wardVal) {
        filteredRecords = filteredRecords.filter(r => r.ward && r.ward.toLowerCase().includes(wardVal));
      }

      const recordIds = filteredRecords.map(r => r.id);

      if (recordIds.length === 0) {
        kpiTrays.innerText = '0';
        kpiMedTypes.innerText = '0';
        kpiTotalDoses.innerText = '0';
        medSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="7">A megadott szűrésnek nincs megfelelő tálca.</td></tr>';
        wardSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="3">A megadott szűrésnek nincs megfelelő tálca.</td></tr>';
        return;
      }

      // 2b. Dispensed items lekérdezése a rekordokhoz
      const { data: items, error: itemsErr } = await db
        .from('dispensed_items')
        .select(`
          dispensing_record_id,
          morning_dose,
          noon_dose,
          evening_dose,
          night_dose,
          medication_master ( name ),
          batch_records ( lot_number, expiry_date )
        `)
        .in('dispensing_record_id', recordIds);

      if (itemsErr) throw itemsErr;

      const rawItems = items || [];

      // 3. Statisztikák számítása
      
      // KPI-ok
      kpiTrays.innerText = filteredRecords.length;

      let grandTotalDoses = 0;
      const medAggregates = {};
      const wardAggregates = {};

      // Osztályos aggregálás előkészítése
      filteredRecords.forEach(r => {
        const wName = r.ward || 'Ismeretlen Osztály';
        if (!wardAggregates[wName]) {
          wardAggregates[wName] = { trays: 0, doses: 0 };
        }
        wardAggregates[wName].trays += 1;
      });

      // Tételes aggregálás
      rawItems.forEach(it => {
        const medName = it.medication_master?.name || 'Ismeretlen Gyógyszer';
        const batch = it.batch_records;
        const lotKey = batch ? `${batch.lot_number} (Lejárat: ${batch.expiry_date})` : 'Nincs megadva';
        const key = `${medName}__${lotKey}`;

        const mDose = Number(it.morning_dose) || 0;
        const nDose = Number(it.noon_dose) || 0;
        const eDose = Number(it.evening_dose) || 0;
        const niDose = Number(it.night_dose) || 0;
        const itemTotal = mDose + nDose + eDose + niDose;

        grandTotalDoses += itemTotal;

        if (!medAggregates[key]) {
          medAggregates[key] = {
            name: medName,
            lot: lotKey,
            morning: 0,
            noon: 0,
            evening: 0,
            night: 0,
            total: 0
          };
        }

        medAggregates[key].morning += mDose;
        medAggregates[key].noon += nDose;
        medAggregates[key].evening += eDose;
        medAggregates[key].night += niDose;
        medAggregates[key].total += itemTotal;

        // Osztályhoz adagok hozzáadása
        const parentRec = filteredRecords.find(r => r.id === it.dispensing_record_id);
        if (parentRec) {
          const wName = parentRec.ward || 'Ismeretlen Osztály';
          if (wardAggregates[wName]) {
            wardAggregates[wName].doses += itemTotal;
          }
        }
      });

      const medList = Object.values(medAggregates);
      kpiMedTypes.innerText = medList.length;
      kpiTotalDoses.innerText = grandTotalDoses;

      // 4. Gyógyszer összegző táblázat kirajzolása
      if (medList.length === 0) {
        medSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="7">Nincs rögzített gyógyszer a kiválasztott tálcákon.</td></tr>';
      } else {
        medSummaryBody.innerHTML = medList.map(m => `
          <tr>
            <td><strong>${m.name}</strong></td>
            <td>${m.lot}</td>
            <td>${m.morning}</td>
            <td>${m.noon}</td>
            <td>${m.evening}</td>
            <td>${m.night}</td>
            <td><strong style="color: #0056b3;">${m.total}</strong></td>
          </tr>
        `).join('');
      }

      // 5. Osztályos összegző táblázat kirajzolása
      const wardList = Object.entries(wardAggregates);
      if (wardList.length === 0) {
        wardSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="3">Nincsenek osztályos adatok.</td></tr>';
      } else {
        wardSummaryBody.innerHTML = wardList.map(([wName, data]) => `
          <tr>
            <td><strong>${wName}</strong></td>
            <td>${data.trays} tálca</td>
            <td><strong style="color: #fd7e14;">${data.doses} egység</strong></td>
          </tr>
        `).join('');
      }

    } catch (err) {
      console.error('Elemzési hiba:', err);
      medSummaryBody.innerHTML = '<tr class="empty-row"><td colspan="7" style="color:red;">Hiba történt az elemzés során.</td></tr>';
    }
  }
});
