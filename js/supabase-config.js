// Supabase Csatlakozási Adatok
const SUPABASE_URL = 'https://mzruehwrolzclkvgyraj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yVnWvuRegTNEnCcv0xl0-A_oAKZNaGl';

// Kliens Inicializálása
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
