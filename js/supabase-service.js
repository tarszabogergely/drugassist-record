// 1. Gyógyszer keresése vonalkód alapján
async function getMedicationByBarcode(barcode) {
  const { data, error } = await supabase
    .from('medication_master')
    .select('*')
    .eq('barcode', barcode)
    .single();

  if (error) return null;
  return data;
}

// 2. Gyógyszerhez tartozó korábbi LOT számok lekérése
async function getBatchesForMedication(medicationId) {
  const { data, error } = await supabase
    .from('batch_records')
    .select('*')
    .eq('medication_id', medicationId)
    .order('expiry_date', { ascending: true });

  if (error) return [];
  return data;
}

// 3. Új LOT elmentése
async function createBatchRecord(medicationId, lotNumber, expiryDate) {
  const { data, error } = await supabase
    .from('batch_records')
    .insert([{ medication_id: medicationId, lot_number: lotNumber, expiry_date: expiryDate }])
    .select()
    .single();

  if (error) return null;
  return data;
}

// 4. Teljes gyógyszerelési tálca mentése
async function saveCompleteDispensing(dispensingRecord, items) {
  // 4a. Fejléc mentése
  const { data: recordData, error: recordError } = await supabase
    .from('dispensing_records')
    .insert([dispensingRecord])
    .select()
    .single();

  if (recordError) throw recordError;

  // 4b. Tételek előkészítése és mentése
  const formattedItems = items.map(item => ({
    dispensing_record_id: recordData.id,
    medication_id: item.medication_id,
    batch_id: item.batch_id,
    morning_dose: item.morning_dose,
    noon_dose: item.noon_dose,
    evening_dose: item.evening_dose,
    night_dose: item.night_dose
  }));

  const { error: itemsError } = await supabase
    .from('dispensed_items')
    .insert(formattedItems);

  if (itemsError) throw itemsError;

  return recordData;
}
