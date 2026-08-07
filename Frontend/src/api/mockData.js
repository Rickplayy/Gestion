export const MOCK_CARRERAS = [
  { id: 1, descripcion: 'Ingeniería en Informática' },
  { id: 2, descripcion: 'Ingeniería Industrial' },
  { id: 3, descripcion: 'Ingeniería en Transporte' },
  { id: 4, descripcion: 'Contador Público' },
  { id: 5, descripcion: 'Licenciatura en Ciencias de la Informática' },
];

export const MOCK_TERMS = [
  { id: 2, descripcion: '2026-1' },
  { id: 1, descripcion: '2025-2' },
];

// termId -> idCarrera -> grupos
export const MOCK_GRUPOS = {
  1: {
    1: [
      { id: 101, secuencia: '1IV1', cupo: 40, turno: 'M' },
      { id: 102, secuencia: '1IV2', cupo: 40, turno: 'V' },
    ],
    2: [{ id: 103, secuencia: '1II1', cupo: 35, turno: 'M' }],
    4: [
      { id: 104, secuencia: '1CP1', cupo: 30, turno: 'M' },
      { id: 105, secuencia: '1CP2', cupo: 30, turno: 'V' },
    ],
  },
  2: {
    1: [{ id: 201, secuencia: '1IV1', cupo: 40, turno: 'M' }],
    3: [{ id: 202, secuencia: '1IT1', cupo: 38, turno: 'M' }],
    5: [{ id: 203, secuencia: '1LI1', cupo: 32, turno: 'V' }],
  },
};

const NOMBRES = [
  'María Fernanda López', 'José Luis Hernández', 'Ana Sofía Ramírez', 'Carlos Eduardo Torres',
  'Daniela Guadalupe Cruz', 'Luis Ángel Morales', 'Paola Vanessa Reyes', 'Jorge Alberto Gómez',
  'Fernanda Itzel Vázquez', 'Diego Armando Sánchez', 'Valeria Nicole Flores', 'Ricardo Iván Castillo',
];

const makeAlumnos = (grupo, idCarrera, carreraNombre, termId) =>
  Array.from({ length: 6 + (grupo.id % 5) }, (_, i) => {
    const genero = i % 2 === 0 ? 'F' : 'M';
    return {
      pr: `${termId}${grupo.id}${String(i + 1).padStart(3, '0')}`,
      nombre: NOMBRES[(grupo.id + i) % NOMBRES.length],
      genero,
      promedio: Math.round((7 + ((grupo.id + i) % 30) / 10) * 10) / 10,
      distanceMeters: 500 + ((grupo.id * 137 + i * 911) % 15000),
      idCarrera,
      carrera: carreraNombre,
      idGrupo: grupo.id,
      secuencia: grupo.secuencia,
      turno: grupo.turno,
    };
  });

// termId -> idGrupo -> alumnos
export const MOCK_ALUMNOS = Object.fromEntries(
  Object.entries(MOCK_GRUPOS).map(([termId, porCarrera]) => [
    termId,
    Object.fromEntries(
      Object.entries(porCarrera).flatMap(([idCarrera, grupos]) => {
        const carreraNombre = MOCK_CARRERAS.find((c) => c.id === Number(idCarrera))?.descripcion ?? '';
        return grupos.map((grupo) => [
          grupo.id,
          makeAlumnos(grupo, Number(idCarrera), carreraNombre, termId),
        ]);
      }),
    ),
  ]),
);
