// Prosta warstwa zapisu — wszystko trzymane lokalnie na urządzeniu (localStorage).
// Appka jest offline: nic nie wysyła nigdzie w sieć.

const STORAGE_KEY = 'trening_app_data_v1';

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function defaultData() {
  return {
    plans: DEFAULT_PLANS.map(deepClone),
    sessions: [],
    activeSession: null
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.plans)) {
        if (!Array.isArray(parsed.sessions)) parsed.sessions = [];
        if (parsed.activeSession === undefined) parsed.activeSession = null;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('loadData error', e);
  }
  const fresh = defaultData();
  saveData(fresh);
  return fresh;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('saveData error', e);
    alert('Nie udało się zapisać danych na urządzeniu (pamięć pełna?).');
    return false;
  }
}
