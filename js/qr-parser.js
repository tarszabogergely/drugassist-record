/**
 * QR Kód Szétbontása (Delimiter: ??)
 * Formátum 1: Név??Osztály??Ágyszám??Időbélyeg
 * Formátum 2 (Jövőbeli): Név??TAJ??Osztály??Ágyszám??Időbélyeg
 */
function parsePatientQR(qrString) {
  if (!qrString || !qrString.includes('??')) {
    return null;
  }

  const parts = qrString.split('??').map(part => part.trim());

  // Ha 4 elem van: Név, Osztály, Ágyszám, Időbélyeg
  if (parts.length === 4) {
    return {
      name: parts[0],
      taj: 'Nincs megadva',
      ward: parts[1],
      bed: parts[2],
      timestamp: parts[3]
    };
  }

  // Ha 5 elem van (jövőbeli TAJ számmal): Név, TAJ, Osztály, Ágyszám, Időbélyeg
  if (parts.length === 5) {
    return {
      name: parts[0],
      taj: parts[1],
      ward: parts[2],
      bed: parts[3],
      timestamp: parts[4]
    };
  }

  return null;
}
