// Supabase Csatlakozási Adatok
const SUPABASE_URL = 'https://mzruehwrolzclkvgyraj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yVnWvuRegTNEnCcv0xl0-A_oAKZNaGl';

// A változó nevét 'db'-re változtatjuk, hogy ne ütközzön a CDN könyvtárral!
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
