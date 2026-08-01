// Español/catalán → italiano.
//
// OJO, PROCEDENCIA: a diferencia de franjas.json, fichas.json, comer.json,
// acceso.json y rutas.json —que se extraen de la guía verificada— este
// contenido lo aporta la app. Son reglas de pronunciación y frases de uso
// común, no datos del viaje: nada de aquí cambia la ruta, los precios ni los
// horarios. Las cuatro frases marcadas `deLaGuia` sí vienen de la guía.

export const PRONUNCIACION = [
  {
    regla: 'C y G delante de E o I',
    como: 'ce/ci suenan «che/chi» · ge/gi suenan «lle/lli» (como la j francesa)',
    ejemplos: [['cena', 'CHE-na'], ['dolce', 'DOL-che'], ['gelato', 'lle-LA-to'], ['Firenze', 'fi-REN-tse']],
    truco: 'En catalán ya lo tienes: «gelat» se dice casi igual que «gelato».'
  },
  {
    regla: 'CH y GH',
    como: 'suenan K y G duras, nunca «ch» española',
    ejemplos: [['chi', 'ki (quién)'], ['chiesa', 'KIE-sa (iglesia)'], ['spaghetti', 'spa-GUE-ti'], ['funghi', 'FUN-gui']],
    truco: 'Regla espejo de la anterior: la H es lo que endurece.'
  },
  {
    regla: 'GN',
    como: 'es nuestra Ñ',
    ejemplos: [['gnocchi', 'ÑO-ki'], ['bagno', 'BA-ño (baño)'], ['montagna', 'mon-TA-ña']],
    truco: 'Igual que el catalán «ny» de «any».'
  },
  {
    regla: 'GLI',
    como: 'como la LL catalana de «palla», no como la Y',
    ejemplos: [['famiglia', 'fa-MI-lia'], ['aglio', 'A-lio (ajo)'], ['biglietto', 'bi-LLE-to (billete)']],
    truco: 'Aquí el catalán gana al español: «fill» → «figlio», «ull» → «occhio».'
  },
  {
    regla: 'SC delante de E o I',
    como: 'suena «sh»',
    ejemplos: [['pesce', 'PE-she (pescado)'], ['prosciutto', 'pro-SHU-to'], ['uscita', 'u-SHI-ta (salida)']],
    truco: '«Uscita» la vas a ver en cada salida de autopista.'
  },
  {
    regla: 'Z',
    como: 'suena «ts» o «ds», jamás como la Z española',
    ejemplos: [['grazie', 'GRA-tsie'], ['pizza', 'PI-tsa'], ['zero', 'DSE-ro']],
    truco: 'Si la dices como en «zapato», no te entienden.'
  },
  {
    regla: 'Consonantes dobles',
    como: 'se alargan, y cambian el significado',
    ejemplos: [['nonno / nono', 'abuelo / noveno'], ['pena / penna', 'pena / bolígrafo'], ['casa / cassa', 'casa / caja']],
    truco: 'Es el error nº 1 del hispanohablante. Aguanta la consonante un instante.'
  },
  {
    regla: 'El acento',
    como: 'casi siempre en la penúltima sílaba',
    ejemplos: [['aeroporto', 'ae-ro-POR-to'], ['autostrada', 'au-to-STRA-da'], ['parcheggio', 'par-KE-llo']],
    truco: 'Cuando cae en la última, lleva tilde: città, caffè, però.'
  }
];

export const CATALAN = {
  intro: 'El catalán te acerca al italiano más que el español. Palabras que en castellano no se parecen, en catalán sí:',
  palabras: [
    ['formatge', 'formaggio', 'queso'],
    ['menjar', 'mangiare', 'comer'],
    ['parlar', 'parlare', 'hablar'],
    ['matí', 'mattina', 'mañana'],
    ['llet', 'latte', 'leche'],
    ['fill', 'figlio', 'hijo'],
    ['ull', 'occhio', 'ojo'],
    ['escola', 'scuola', 'escuela'],
    ['finestra', 'finestra', 'ventana'],
    ['taula', 'tavola', 'mesa'],
    ['cercar', 'cercare', 'buscar'],
    ['tallar', 'tagliare', 'cortar']
  ],
  gramatica: [
    {
      titulo: 'El «ne» italiano es tu «en» catalán',
      texto: '«Ne voglio due» es exactamente «En vull dos». En español no existe y a los castellanohablantes les cuesta años. Tú ya lo tienes puesto.'
    },
    {
      titulo: 'El «ci» italiano es tu «hi» catalán',
      texto: '«Ci vado domani» = «Hi vaig demà» (voy allí mañana). Mismo mecanismo.'
    },
    {
      titulo: 'Ser y estar funcionan como en catalán',
      texto: '«Essere» y «stare» se reparten el trabajo casi igual que «ser» y «estar». Cuidado: «come stai?» es «¿cómo estás?».'
    }
  ]
};

export const FALSOS_AMIGOS = [
  ['burro', 'mantequilla', 'el animal es «asino»'],
  ['aceto', 'vinagre', 'el aceite es «olio» — no lo confundas en la mesa'],
  ['salire', 'subir', 'salir es «uscire»'],
  ['guardare', 'mirar', 'guardar es «tenere» o «conservare»'],
  ['caldo', 'calor / caliente', 'el caldo es «brodo»'],
  ['largo', 'ancho', 'largo es «lungo»'],
  ['topo', 'ratón', 'el topo es «talpa»'],
  ['gamba', 'pierna', 'la gamba es «gambero»'],
  ['prossimo', 'siguiente', 'útil en colas y paradas'],
  ['imbarazzata', 'avergonzada', 'embarazada es «incinta» — el error clásico'],
  ['pronto', '¿diga?', 'así se contesta al teléfono']
];

export const FRASES = [
  {
    grupo: 'Lo que más vas a decir',
    items: [
      ['Buongiorno / Buonasera', 'Buenos días / Buenas tardes', 'El cambio es sobre las 16:00'],
      ['Grazie mille', 'Muchas gracias', ''],
      ['Scusi', 'Perdone', 'A un desconocido. A un amigo, «scusa»'],
      ['Per favore', 'Por favor', ''],
      ['Parla spagnolo?', '¿Habla español?', ''],
      ['Non capisco', 'No entiendo', ''],
      ['Può ripetere, per favore?', '¿Puede repetir?', '']
    ]
  },
  {
    grupo: 'Comer y beber sin pagar de más',
    items: [
      ['Un caffè al banco, per favore', 'Un café en barra', 'De pie cuesta la mitad', true],
      ["C'è il menu fisso a pranzo?", '¿Tienen menú del día?', 'Solo entre semana, 10-14 €', true],
      ['Ci sono sagre qui vicino questa settimana?', '¿Hay alguna fiesta gastronómica cerca?', 'Pregúntalo en el bar del pueblo', true],
      ['Il coperto è indicato nel menu?', '¿El cubierto está indicado en la carta?', 'En el Lazio cobrarlo es ilegal', true],
      ['Vorrei questo, per favore', 'Quería esto, por favor', 'Señalando: resuelve el 80 % de las veces'],
      ['Quanto costa al chilo?', '¿Cuánto cuesta el kilo?', 'La pizza al taglio se vende al peso'],
      ["Un'acqua naturale, per favore", 'Un agua sin gas', '«Frizzante» es con gas'],
      ['Il conto, per favore', 'La cuenta, por favor', ''],
      ['È senza glutine?', '¿Es sin gluten?', 'Cambia «glutine» por lo que necesites']
    ]
  },
  {
    grupo: 'El coche, que es donde te juegas el dinero',
    items: [
      ['Dove posso parcheggiare?', '¿Dónde puedo aparcar?', ''],
      ['È una ZTL?', '¿Es zona de tráfico limitado?', 'La pregunta que evita multas de 80-330 €'],
      ['Si può dormire in macchina qui?', '¿Se puede dormir en el coche aquí?', 'Pregúntalo antes de instalarte'],
      ['Il pieno, self, per favore', 'Lleno, en autoservicio', '«Servito» son 13 cts/l más'],
      ["A che ora chiude la sbarra?", '¿A qué hora cierra la barrera?', 'Fundamental si duermes en un aparcamiento'],
      ['Quanto costa al giorno?', '¿Cuánto cuesta al día?', ''],
      ['Ho un guasto', 'Tengo una avería', '']
    ]
  },
  {
    grupo: 'Orientarse',
    items: [
      ["Dov'è la stazione?", '¿Dónde está la estación?', ''],
      ['Un biglietto per…', 'Un billete para…', ''],
      ['Devo convalidare il biglietto?', '¿Tengo que validar el billete?', 'En los trenes regionales, sí: multa si no'],
      ['A che ora apre / chiude?', '¿A qué hora abre / cierra?', ''],
      ['È gratis?', '¿Es gratis?', ''],
      ["C'è un bagno?", '¿Hay baño?', '']
    ]
  },
  {
    grupo: 'Si algo va mal',
    items: [
      ['Aiuto!', '¡Socorro!', ''],
      ['Chiami la polizia', 'Llame a la policía', 'Emergencias: 112'],
      ['Ho bisogno di un medico', 'Necesito un médico', ''],
      ['Mi hanno rubato il portafoglio', 'Me han robado la cartera', ''],
      ['Sono spagnolo', 'Soy español', '']
    ]
  }
];

export const NUMEROS = [
  ['1 uno', '2 due', '3 tre', '4 quattro', '5 cinque'],
  ['6 sei', '7 sette', '8 otto', '9 nove', '10 dieci'],
  ['20 venti', '30 trenta', '50 cinquanta', '100 cento', '1000 mille']
];
