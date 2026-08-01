// Cosas que NO están en el itinerario y que quizá quieras encajar.
//
// PROCEDENCIA — importante: esto no sale de la guía verificada. Son datos
// recogidos de webs de turismo en agosto de 2026, así que van marcados como
// «comprobar» y NUNCA sustituyen a lo que dice `datos-viaje.json`. Los precios
// de entradas cambian; trátalos como orden de magnitud y confirma en taquilla
// o en la web oficial antes de pagar.
//
// De momento sólo está Florencia, que es donde el itinerario deja hueco.

export const MAS_QUE_VER = [
  {
    ciudad: 'Florencia',
    dias: [3, 4],
    intro: 'El itinerario te lleva al Duomo, la Accademia, los Uffizi y la Loggia dei Lanzi. ' +
           'Esto es lo demás, por si te sobra tiempo o quieres cambiar algo.',
    gratis: [
      {
        nombre: 'Piazzale Michelangelo',
        que: 'La panorámica de postal: Duomo, Palazzo Vecchio, Ponte Vecchio y el Arno de una vez.',
        nota: 'Abierto 24 h. Ve al atardecer o antes de las 9:00; a media tarde está lleno de autobuses.'
      },
      {
        nombre: 'Ponte Vecchio',
        que: 'Cruzarlo no cuesta nada. El único puente de Florencia que los alemanes no volaron en 1944.',
        nota: 'De día es un río de gente. A primera hora lo tienes casi para ti.'
      },
      {
        nombre: 'Nave de la catedral',
        que: 'Entrar en Santa Maria del Fiore es gratis.',
        nota: 'Lo que se paga es la cúpula, el campanile, el baptisterio y el museo. La nave, no.'
      },
      {
        nombre: 'Giardino delle Rose',
        que: 'Jardín en la ladera, de camino a Piazzale Michelangelo, con esculturas y vistas.',
        nota: 'Buen sitio para el parón de calor: hay sombra y bancos.'
      }
    ],
    pago: [
      {
        nombre: 'Palazzo Vecchio',
        precio: '18 €',
        horario: 'vie-mié 9:00-19:00 · jue 9:00-14:00 (Torre de Arnolfo hasta las 17:00)',
        nota: 'La reducida de 12 € es para 18-25 años: con 29 pagas entera.',
        veredicto: 'condicional'
      },
      {
        nombre: 'Basílica de Santa Croce',
        precio: '10 €',
        horario: 'lun-sáb 9:30-17:30 · domingos sólo por la tarde',
        nota: 'Las tumbas de Miguel Ángel, Galileo y Maquiavelo.',
        veredicto: 'condicional'
      },
      {
        nombre: 'Pases del complejo del Duomo',
        precio: 'Brunelleschi 30 € · Giotto 20 € · Ghiberti 15 €',
        horario: 'reserva obligatoria para la cúpula',
        nota: 'Brunelleschi = cúpula + campanile + baptisterio + museo. Giotto = lo mismo sin cúpula. ' +
              'Ghiberti = baptisterio + museo. El de 30 € ya está en tus reservas como opcional.',
        veredicto: 'condicional'
      },
      {
        nombre: 'Palazzo Pitti y jardines de Boboli',
        precio: 'PassePartout 5 días, 38 € en temporada alta',
        horario: '—',
        nota: 'Caro para un solo día y queda al otro lado del Arno. Con un día en Florencia, no.',
        veredicto: 'no'
      }
    ]
  }
];

export const paraDia = (n) => MAS_QUE_VER.filter(c => c.dias.includes(Number(n)));
export const ciudades = () => MAS_QUE_VER.map(c => c.ciudad);
