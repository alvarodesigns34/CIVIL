# Civilization Engine

Juego de simulación de civilizaciones en 2D. Guías a un pueblo desde su primer fuego (≈3500 a. C.) hasta el umbral de la era industrial, en un mundo generado proceduralmente y compartido con pueblos rivales que siguen exactamente las mismas reglas que tú.

```bash
npm install
npm run dev      # servidor de desarrollo (http://localhost:5173)
npm run build    # compilación de producción en dist/
npm run sim -- <semilla> <años>   # simulación sin interfaz para equilibrar
```

**Jugar online:** cada push a `main` (o a esta rama) se publica en GitHub Pages mediante GitHub Actions (`.github/workflows/deploy.yml`). Requiere activar Pages una vez en *Settings → Pages → Source: GitHub Actions*.

Funciona en escritorio (ratón y teclado), iPad y móvil (táctil: arrastrar, pellizcar y doble toque para confirmar construcciones).

## Bucle de juego

Cada año (de 0,35 a 3,2 segundos según la velocidad) cada pueblo:

1. **Trabaja.** La población activa (≈58 %) ocupa los empleos de los edificios. Primero la comida. Si la comida prevista no basta, se manda gente a recolectar antes de abrir otros oficios. Quien sobra recolecta en las casillas libres. Los asentamientos a menos de 7 casillas comparten trabajadores, con pérdidas.
2. **Produce y consume.** Cada habitante come 1 de comida al año. Desde la Edad del Bronce la gente exige además bienes. Los talleres transforman madera y metal en bienes, y los edificios cuestan mantenimiento.
3. **Crece o mengua.** La natalidad depende de la vivienda libre, de las reservas de comida y de la salud. El hacinamiento, el hambre y la insalubridad matan.
4. **Siente.** Cinco facciones (pueblo, guerreros, clero, mercaderes y eruditos) tienden hacia una aprobación que depende de lo que ocurre. Su peso político, junto con la legitimidad del líder, los lujos, la guerra y el tamaño del territorio, determina la **estabilidad**. Con estabilidad alta llega una edad dorada; con baja, disturbios. Seis años de caos provocan una revolución.
5. **Investiga, crea cultura e influye.** El saber desbloquea 37 tecnologías en 6 eras. La cultura amplía las fronteras y concede tradiciones permanentes, a elegir entre tres. La influencia paga leyes, cambios de régimen, diplomacia y colonias.

## Sistemas

- **Mapa:** rejilla hexagonal con relieve, clima por latitud, ríos que fluyen hacia el mar, marismas, lagos y 17 tipos de recursos (alimento, estratégicos y lujos).
- **Construcción:** 33 edificios y 8 maravillas únicas en el mundo. La ubicación importa: los campos junto a ríos o junto a otros campos rinden más, las canteras rinden más en montaña, la academia junto al archivo, etc.
- **Política:** 8 regímenes, cada uno con su forma de sucesión, 27 leyes agrupadas en 7 ámbitos, 20 rasgos de líder y líderes que envejecen, tienen herederos y mueren. Las sucesiones pueden ser crisis, elecciones o consejos.
- **Diplomacia:** contacto, opinión con sus motivos detallados, regalos, rutas comerciales (dan oro y comparten lujos), alianzas, tributos y tratados de paz.
- **Guerra:** los ejércitos marchan sobre el mapa, saquean, asedian y conquistan ciudades. La fuerza depende de los soldados, del armamento (el bronce y el hierro exigen cobre y hierro reales), de las murallas y de la estabilidad.
- **Eventos:** 57 eventos narrativos ligados al estado del juego, con 13 cadenas de consecuencias a largo plazo, y 11 eventos de sistema (mito fundacional, sucesiones, primer contacto, paz, exigencias, revoluciones, eras y hambrunas). Cada opción muestra antes de elegir sus efectos y sus riesgos.
- **Personajes ilustres:** sabios, artistas, mercaderes, caudillos, profetas e ingenieros nacen de lo que tu pueblo cultiva, y tú decides cómo aprovechar su talento.
- **Decretos:** festivales, reparto de grano, ofrendas, obras públicas, tributos, censos, levas, amnistías y desfiles triunfales, con coste y recarga.
- **Campañas:** en guerra eliges qué ciudad conquistar o saquear, con pronóstico de la batalla. Los aliados piden ayuda y los pueblos amistosos proponen alianzas.
- **Consejo de ancianos:** objetivos guiados con recompensas que enseñan a jugar.
- **Sonido:** música generativa distinta en cada era (más tensa en guerra), ambiente que depende de lo que miras (agua, viento, aves, ciudad, invierno) y efectos para cada acción.
- **Objetivos:** 18 ambiciones y una puntuación de **legado**. La partida termina cuando alguien construye la máquina de vapor, cuando solo queda un pueblo o tras 900 años.
- **IA:** cada rival tiene un carácter (belicoso, mercantil, devoto, expansionista, erudito o pacífico) que guía su investigación, sus leyes, sus construcciones, su expansión y su diplomacia.

## Arquitectura

```
src/
  core/     RNG determinista, ruido, geometría hexagonal
  data/     Contenido: terreno, tecnologías, edificios, política, nombres, eventos, ambiciones
  sim/      Simulación pura y serializable (sin DOM): economía, política, diplomacia, guerra, IA, eventos
  render/   Canvas 2D: terreno por bloques cacheados, sprites vectoriales, habitantes, ejércitos y ambiente
  game/     Controlador (bucle, entrada, acciones del jugador, guardado), audio sintetizado y almacén de UI
  ui/       Interfaz en Preact: HUD, paneles, ficha de casilla, eventos ilustrados y pantalla de título
tools/      Simulación sin interfaz para equilibrar
```

- Todo el estado de la partida es JSON serializable y se guarda en `localStorage` automáticamente cada 10 años.
- La simulación es la misma para el jugador y para la IA, de modo que el mundo es coherente.
- El terreno se pinta por bloques a varias escalas y se cachea, y los edificios se dibujan como sprites vectoriales cacheados.
- Identidad visual: atlas pintado a tinta sobre pergamino (lo inexplorado es papel con trama y garabatos cartográficos), con tipografía Fraunces y Alegreya Sans.
