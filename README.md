# Repaso ADL Villena

Aplicación web de tarjetas tipo test para repasar el temario de la oposición de Agente de Desarrollo Local del Ayuntamiento de Villena.

- 50 preguntas por tema, 4 opciones y una sola correcta.
- Comodines (50%, público y llamada) que se compran con los puntos ganados.
- Las preguntas falladas o acertadas por suerte vuelven entre 5 y 10 preguntas después.
- Se puede instalar en el móvil o la tablet (Añadir a pantalla de inicio).

## Estructura

- `data/NN.json`: preguntas del tema NN. En cada pregunta, `o[0]` es la respuesta correcta (la app baraja el orden).
- `data/temas.json`: índice generado con `tools/build-index.ps1`.
- `tools/serve.ps1`: servidor local para pruebas (`http://localhost:8080`).
