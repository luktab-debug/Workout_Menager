// Domyślne dane appki — wczytywane tylko przy pierwszym uruchomieniu
// (albo po "Przywróć domyślny plan"). Później wszystko żyje w localStorage.

const GROUP_COLORS = {
  'NOGI':    '#e35d5d',
  'PLECY':   '#f0954a',
  'KLATKA':  '#f2ce4a',
  'BARKI':   '#f7e35f',
  'TRICEPS': '#54c1c8',
  'BICEPS':  '#4f8ff0',
  'BRZUCH':  '#63c76a',
  'INNE':    '#9b8bd4'
};

const DEFAULT_WARMUP = [
  { name: 'Kręcenie biodrami', target: '90s - 120s' },
  { name: 'Skłony tułowia w przód stojąc', target: '1 x 25' },
  { name: 'Przysiady z wymachem ramion', target: '1 x 25' },
  { name: 'Rozgrzewanie nadgarstków', target: '60s - 90s' },
  { name: 'Rozgrzewanie rotatorów barku', target: '1 x 25' },
  { name: 'Pompki klasyczne', target: '2 x 8 - 10' }
];

function ex(id, group, name, sets) {
  return { id, group, color: GROUP_COLORS[group] || GROUP_COLORS.INNE, name, sets };
}

const DEFAULT_PLANS = [
  {
    id: 'A',
    name: 'A',
    subtitle: '',
    restBetweenSets: '60s - 90s',
    warmupRest: '30s - 45s',
    warmup: DEFAULT_WARMUP.map(w => ({ ...w })),
    exercises: [
      ex('a1', 'NOGI', 'Przysiad + wspięcia na palce hantlą trzymaną z przodu', [12, 12, 12]),
      ex('a2', 'PLECY', 'Wiosłowanie hantlą w podporze o ławkę', [12, 12, 12]),
      ex('a3', 'KLATKA', 'Wyciskanie hantli na ławce płaskiej', [12, 12, 12]),
      ex('a4', 'BARKI', 'OHP hantlami siedząc', [12, 12, 12]),
      ex('a5', 'TRICEPS', 'Francuskie wyciskanie hantli za głowę leżąc', [12, 12, 12]),
      ex('a6', 'BICEPS', 'Uginanie ramion siedząc na ławce', [12, 12, 12]),
      ex('a7', 'BRZUCH', 'Roller', [20, 20, 20])
    ]
  },
  {
    id: 'B',
    name: 'B',
    subtitle: '',
    restBetweenSets: '60s - 90s',
    warmupRest: '30s - 45s',
    warmup: DEFAULT_WARMUP.map(w => ({ ...w })),
    exercises: [
      ex('b1', 'NOGI', 'Martwy ciąg hantlami', [12, 12, 12]),
      ex('b2', 'PLECY', 'Wiosłowanie hantlą szeroko leżąc na ławce skośnej', [12, 12, 12]),
      ex('b3', 'KLATKA', 'Wyciskanie hantli na ławce skośnej dodatnio', [12, 12, 12]),
      ex('b4', 'BARKI', 'Wznosy hantli bokiem', [12, 12, 12]),
      ex('b5', 'TRICEPS', 'Francuskie wyciskanie hantli oburącz siedząc', [12, 12, 12]),
      ex('b6', 'BICEPS', 'Uginanie ramion naprzemiennie z supinacją stojąc', [12, 12, 12]),
      ex('b7', 'BRZUCH', 'Unoszenie nóg leżąc', [20, 20, 20])
    ]
  },
  {
    id: 'C',
    name: 'C',
    subtitle: '',
    restBetweenSets: '60s - 90s',
    warmupRest: '30s - 45s',
    warmup: DEFAULT_WARMUP.map(w => ({ ...w })),
    exercises: [
      ex('c1', 'NOGI', 'Przysiad + wspięcia na palce hantlą trzymaną z przodu', [12, 12, 12]),
      ex('c2', 'PLECY', 'Szrugsy hantlami', [12, 12, 12]),
      ex('c3', 'KLATKA', 'Przenoszenie hantli nad głowę leżąc', [12, 12, 12]),
      ex('c4', 'BARKI', 'Odwrotne rozpiętki siedząc pochylony do przodu', [12, 12, 12]),
      ex('c5', 'TRICEPS', 'Francuskie wyciskanie hantli za głowę leżąc', [12, 12, 12]),
      ex('c6', 'BICEPS', 'Uginanie ramion młotkowe naprzemiennie', [12, 12, 12]),
      ex('c7', 'BRZUCH', 'Roller', [20, 20, 20])
    ]
  },
  {
    id: 'C2',
    name: 'C/2',
    subtitle: 'alternatywa na piątki w domu',
    restBetweenSets: '60s - 90s',
    warmupRest: '30s - 45s',
    warmup: DEFAULT_WARMUP.map(w => ({ ...w })),
    exercises: [
      ex('c2_1', 'NOGI', 'Martwy ciąg sztangą', [12, 12, 12]),
      ex('c2_2', 'PLECY', 'Szrugsy sztangą', [12, 12, 12]),
      ex('c2_3', 'KLATKA', 'Pompki na małych poręczach', [12, 12, 12]),
      ex('c2_4', 'BARKI', 'Podciąganie sztangi wzdłuż tułowia', [12, 12, 12]),
      ex('c2_5', 'TRICEPS', 'Francuskie wyciskanie sztangi stojąc', [12, 12, 12]),
      ex('c2_6', 'BICEPS', 'Uginanie ramion ze sztangą łamaną', [12, 12, 12]),
      ex('c2_7', 'BRZUCH', 'Roller lub Unoszenie nóg leżąc', [20, 20, 20])
    ]
  }
];
