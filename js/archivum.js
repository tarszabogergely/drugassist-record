/**
 * DrugAssist Record - Archívum & Osztályos Napi PDF Átadó Generáló
 */

document.addEventListener('DOMContentLoaded', () => {
  let selectedDateStr = new Date().toISOString().split('T')[0]; // Mai nap (YYYY-MM-DD)
  let dayRecords = [];
  let currentUser = null;

  // DOM elemek
  const datePicker = document.getElementById('archive-date-picker');
  const btnToday = document.getElementById('btn-today');
  const btnLoadArchive = document.getElementById('btn-load-archive');
  const wardsContainer = document.getElementById('wards-container');

  const historyModal = document.getElementById('patient-history-modal');
  const btnCloseHistoryModal = document.getElementById('btn-close-history-modal');
  const hPatientName = document.getElementById('h-patient-name');
  const modalPatientInfo = document.getElementById('modal-patient-info');
  const patientItemsBody = document.getElementById('patient-items-body');

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

  if (datePicker) datePicker.value = selectedDateStr;

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      selectedDateStr = new Date().toISOString().split('T')[0];
      if (datePicker) datePicker.value = selectedDateStr;
      loadArchiveForDate();
    });
  }

  if (btnLoadArchive) {
    btnLoadArchive.addEventListener('click', () => {
      if (datePicker) selectedDateStr = datePicker.value;
      loadArchiveForDate();
    });
  }

  // QR kód szétbontása az azonosító kinyeréséhez
  function extractTrayId(rawQr) {
    if (!rawQr || !rawQr.includes('??')) return '-';
    const parts = rawQr.split('??');
    return parts[parts.length - 1] || '-';
  }

  // 2. Napi Adatok Betöltése Supabase-ből
  loadArchiveForDate();

  async function loadArchiveForDate() {
    if (!selectedDateStr) return;

    wardsContainer.innerHTML = '<div class="card"><p class="empty-row">Napi adatok betöltése...</p></div>';

    try {
      const startOfDay = `${selectedDateStr}T00:00:00.000Z`;
      const endOfDay = `${selectedDateStr}T23:59:59.999Z`;

      const { data: records, error } = await db
        .from('dispensing_records')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('ward', { ascending: true });

      if (error) throw error;

      dayRecords = records || [];

      if (dayRecords.length === 0) {
        wardsContainer.innerHTML = `
          <div class="card">
            <p class="empty-row">Ezen a napon (${selectedDateStr}) nem található rögzített gyógyszerelési tálca.</p>
          </div>`;
        return;
      }

      // Osztályok szerinti csoportosítás
      const wardsGrouped = {};
      dayRecords.forEach(r => {
        const wName = r.ward || 'Egyéb Osztály';
        if (!wardsGrouped[wName]) wardsGrouped[wName] = [];
        wardsGrouped[wName].push(r);
      });

      // HTML felépítése (Gyógyszerelési azonosító a Státusz elé helyezve)
      wardsContainer.innerHTML = Object.entries(wardsGrouped).map(([wardName, recordsInWard]) => `
        <section class="card" style="margin-bottom: 2rem;">
          <div class="table-header" style="border-bottom: 2px solid #6f42c1; padding-bottom: 0.5rem; margin-bottom: 1rem;">
            <h2 style="color: #593196; margin:0;">${wardName}</h2>
            <button type="button" onclick="generateWardPDF('${wardName}')" class="btn btn-success" style="background: #28a745;">
              📄 Osztályos átadó
            </button>
          </div>

          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Beteg Neve</th>
                  <th>TAJ szám</th>
                  <th>Ágyszám</th>
                  <th>Gyógyszerelési Azonosító</th>
                  <th>Státusz</th>
                  <th>Műveletek</th>
                </tr>
              </thead>
              <tbody>
                ${recordsInWard.map(rec => {
                  const trayId = extractTrayId(rec.qr_identifier);
                  const isVerified = rec.status === 'verified';
                  const badgeStyle = isVerified ? 'background:#28a745; color:white;' : 'background:#ffc107; color:#333;';
                  const statusText = isVerified ? '✓ Ellenőrizve' : 'Piszkozat';

                  return `
                    <tr>
                      <td><strong>${rec.patient_name}</strong></td>
                      <td>${rec.patient_taj || 'Nincs megadva'}</td>
                      <td>${rec.bed_number || '-'}</td>
                      <td><code>${trayId}</code></td>
                      <td><span class="badge" style="${badgeStyle}">${statusText}</span></td>
                      <td>
                        <button type="button" onclick="viewTrayDetails('${rec.id}')" class="btn btn-secondary btn-sm">Gyógyszerelési előzmények</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </section>
      `).join('');

    } catch (err) {
      console.error('Archívum betöltési hiba:', err);
      wardsContainer.innerHTML = '<div class="card"><p class="empty-row" style="color:red;">Hiba történt az archívum betöltésekor.</p></div>';
    }
  }

  // 3. Beteg egyedi tálca előzményeinek megtekintése Modalban
  window.viewTrayDetails = async function(recordId) {
    const rec = dayRecords.find(r => r.id === recordId);
    if (!rec) return;

    const trayId = extractTrayId(rec.qr_identifier);
    hPatientName.innerText = rec.patient_name;
    modalPatientInfo.innerHTML = `
      <div><strong>Gyógyszerelési Azonosító:</strong> <code>${trayId}</code></div>
      <div><strong>Osztály / Ágy:</strong> ${rec.ward} / ${rec.bed_number || '-'}</div>
      <div><strong>TAJ:</strong> ${rec.patient_taj || 'Nincs megadva'} | <strong>Státusz:</strong> ${rec.status === 'verified' ? 'Ellenőrizve' : 'Piszkozat'}</div>
      <div><strong>Megjegyzés:</strong> <em>${rec.notes || 'Nincs megjegyzés.'}</em></div>
    `;

    patientItemsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Gyógyszerek betöltése...</td></tr>';
    historyModal.style.display = 'flex';

    try {
      const { data: items, error } = await db
        .from('dispensed_items')
        .select(`
          morning_dose, noon_dose, evening_dose, night_dose,
          medication_master ( name ),
          batch_records ( lot_number, expiry_date )
        `)
        .eq('dispensing_record_id', recordId);

      if (error) throw error;

      if (!items || items.length === 0) {
        patientItemsBody.innerHTML = '<tr class="empty-row"><td colspan="6">Ehhez a tálcához nincsenek rögzített gyógyszerek.</td></tr>';
        return;
      }

      patientItemsBody.innerHTML = items.map(it => {
        const batch = it.batch_records;
        const lotText = batch ? `${batch.lot_number} (Exp: ${batch.expiry_date})` : 'Nincs megadva';

        return `
          <tr>
            <td><strong>${it.medication_master?.name || 'Ismeretlen'}</strong></td>
            <td>${lotText}</td>
            <td>${it.morning_dose}</td>
            <td>${it.noon_dose}</td>
            <td>${it.evening_dose}</td>
            <td>${it.night_dose}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Modal tételek hibája:', err);
      patientItemsBody.innerHTML = '<tr class="empty-row"><td colspan="6" style="color:red;">Hiba a tételek lekérdezésekor.</td></tr>';
    }
  };

  if (btnCloseHistoryModal) {
    btnCloseHistoryModal.addEventListener('click', () => {
      historyModal.style.display = 'none';
    });
  }

  // 4. OSZTÁLYOS PDF ÁTADÓ GENERÁLÁSA
  window.generateWardPDF = async function(wardName) {
    const wardRecords = dayRecords.filter(r => (r.ward || 'Egyéb Osztály') === wardName);
    if (wardRecords.length === 0) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // FEJLÉC
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("DrugAssist", 14, 15);
    doc.setFont("helvetica", "normal");
    doc.text("Markusovszky Kórház", 14, 20);

    doc.setFontSize(10);
    doc.text(`Dátum: ${selectedDateStr}`, 196, 15, { align: 'right' });

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Osztály: ${wardName}`, 14, 32);

    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    let startY = 42;

    for (const rec of wardRecords) {
      const trayId = extractTrayId(rec.qr_identifier);
      doc.setFontSize(10.5);
      doc.setFont("helvetica", "bold");
      const pHeader = `Azonosító: ${trayId} | Beteg: ${rec.patient_name} | TAJ: ${rec.patient_taj || 'Nincs'} | Ágy: ${rec.bed_number || '-'}`;
      doc.text(pHeader, 14, startY);
      startY += 5;

      const { data: items } = await db
        .from('dispensed_items')
        .select(`
          morning_dose, noon_dose, evening_dose, night_dose,
          medication_master ( name ),
          batch_records ( lot_number, expiry_date )
        `)
        .eq('dispensing_record_id', rec.id);

      const tableRows = (items || []).map(it => {
        const batch = it.batch_records;
        const lotStr = batch ? batch.lot_number : '-';
        const expStr = batch ? batch.expiry_date : '-';
        const doseStr = `${it.morning_dose} - ${it.noon_dose} - ${it.evening_dose} - ${it.night_dose}`;

        return [
          it.medication_master?.name || 'Gyógyszer',
          doseStr,
          lotStr,
          expStr
        ];
      });

      doc.autoTable({
        startY: startY,
        head: [['Gyógyszer neve', 'Adagolás (R - D - E - É)', 'Gyári szám (LOT)', 'Lejárat']],
        body: tableRows.length > 0 ? tableRows : [['Nincs rögzített gyógyszer', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [111, 66, 193], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        margin: { left: 14, right: 14 }
      });

      startY = doc.lastAutoTable.finalY + 8;

      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }
    }

    // ALÁÍRÁSOK
    const pageCount = doc.internal.getNumberOfPages();
    doc.setPage(pageCount);

    const footerY = 270;
    doc.setLineWidth(0.3);

    doc.line(14, footerY, 65, footerY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Átadta (Gyógyszertár)", 39, footerY + 5, { align: 'center' });

    doc.line(77, footerY, 128, footerY);
    doc.text("Átvette (Osztály)", 102.5, footerY + 5, { align: 'center' });

    doc.line(140, footerY, 191, footerY);
    doc.text("Ellenörizte (Osztály)", 165, footerY + 5, { align: 'center' });

    doc.save(`DrugAssist_Atado_${wardName}_${selectedDateStr}.pdf`);
  };
});
