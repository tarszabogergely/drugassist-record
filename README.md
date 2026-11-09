# DrugAssist Record 💊

**DrugAssist Record** egy zárt láncú, beteg- és gyógyszer-azonosításra épülő webes alkalmazás, amely a kórházi és közforgalmú gyógyszertári/osztályos gyógyszerelési folyamatokat digitalizálja és ellenőrzi. A rendszer célja a gyógyszerelési hibák elkerülése, a gyári számok (LOT) és lejárati dátumok pontos nyomon követése, valamint a gyógyszerészi jóváhagyási folyamat gyorsítása.

---

## 🌟 Főbb Funkciók és Modulok

### 1. 📋 Gyógyszerelés (`gyogyszereles.html`)
* **Betegazonosítás QR-kóddal:** Támogatja a 4 és 5 elemes QR-kód formátumokat (Név, TAJ-szám, Osztály, Ágyszám, Gyártási azonosító/Időbélyeg).
* **Billentyűzet-orientált adagolás:** Vonalkód beolvasása után a kurzor **automatikusan a Reggeli adagolási mezőre ugrik**, kijelölve az alapértelmezett értéket a villámgyors adatbevitelhez.
* **Intelligens LOT / Gyári szám kezelés:** 
  * Ha a gyógyszerhez pontosan **1 db aktív LOT** tartozik a törzsben, a rendszer automatikusan kitölti és kijelöli.
  * Korábbi gyári számok kattintható **buborékos felületen** választhatók ki.
  * Új LOT beírása esetén automatikusan elmenti az új rekordot a `batch_records` táblába.
* **Gyorsbillentyűk:**
  * `+` (NumpadAdd / billentyűzet): Gyógyszer hozzáadása modal megnyitása.
  * `F3`: Tétel hozzáadása a tálcához a modalból.
  * `Ctrl + Enter`: Tálca lezárása és mentése.
  * `Esc`: Modal bezárása.

### 2. Check 🟢 Ellenőrzés (`ellenorzes.html`)
* **Gyógyszerészi jóváhagyási modul:** Csoportosítva jeleníti meg az osztályonkénti várakozó tálcákat.
* **Többtételes támogatás:** Dinamikusan görgethető modal elrendezés (rögzített fejléccel és jóváhagyó lábléccel).
* **Biztonsági ellenőrzés:** A tálca jóváhagyásához a gyógyszerésznek be kell olvasnia a tálcához tartozó QR-kódot.
* **Jogosultság-kezelés:** Csak `pharmacist` (gyógyszerész) szerepkörrel rendelkező felhasználó hagyhatja jóvá a rögzített tálcákat.

### 3. 👥 Betegek (`betegek.html`)
* **Nyilvántartás & Live Search:** Gyorskeresés név, TAJ-szám, osztály vagy ágyszám alapján.
* **Betegút nyomon követés:** Ha egy beteg a kórházi tartózkodása során **több osztályra is felvételre került**, a rendszer automatikusan jelzi a listában (*„Több osztály”* és *„Több ágy”*), felsorolva az eddigi részlegeket.
* **Előzmények & Tálca részletek:** Teljes gyógyszerelési történet lekérdezése rögzített tételekkel, adagolással, LOT számokkal és lejárattal.
* **Adatszerkesztés:** Beteg nevének és TAJ-számának frissítése Supabase szinkronizációval.

### 4. 📦 Gyári számok / LOT Kezelés (`batch.html`)
* Gyógyszerekhez tartozó batch rekordok, LOT azonosítók és lejárati dátumok központi kezelése.

---

## 📐 QR-kód Specifikáció

A rendszer elválasztó karakterként a `??` karaktersorozatot használja.

* **5-elemes formátum (Ajánlott):**
  ```text
  [Beteg Neve]??[TAJ szám]??[Osztály]??[Ágyszám]??[Gyártási azonosító / Időbélyeg]
