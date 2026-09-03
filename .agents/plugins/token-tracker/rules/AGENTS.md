# Regla de Monitoreo de Tokens (Token Tracker)

- **Pie de métricas opcional:** Al responder consultas de desarrollo, arquitectura o generación de código, incluir al final un pie de página sutil con el desglose de tokens aproximados y el modelo activo.
- **Formato del pie:**
  ```markdown
  ---
  > 📊 **Métricas del Turno:** ~[Tokens Estimados] tokens | **Modelo:** [Nombre del Modelo] | **Fase:** [Pensamiento/Ejecución]
  ```
- **Transparencia:** Si el usuario pregunta por estadísticas o comparación de consumo, utilizar la skill `token-tracker` para calcular el uso exacto a partir del registro del transcript.
