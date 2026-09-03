---
name: token-tracker
description: Analiza los registros de conversación (transcript.jsonl), calcula tokens de entrada, pensamiento y salida, y genera reportes de consumo.
---

# Skill de Seguimiento y Cálculo de Tokens

Esta habilidad permite calcular y reportar el consumo de tokens y costos relativos entre modelos de Gemini en Antigravity.

## 1. Fórmulas de Estimación de Tokens
- **Español y Código:** 1 palabra / identificador ≈ 1.33 tokens.
- **Tokens de Entrada:** Longitud del contexto acumulado + archivos leídos.
- **Tokens de Pensamiento (Thinking):** Estimación de razonamiento previo del modelo (Gemini 3.7 Flash High ≈ 800 - 2,000 tokens).
- **Tokens de Salida:** Texto y código generado en la respuesta.

## 2. Inspección del Transcript Local
Los registros completos de cada turno se guardan en:
`<appDataDir>\brain\<conversation-id>\.system_generated\logs\transcript.jsonl`

## 3. Reporte de Métricas por Turno
Al final de cada respuesta importante de código, añade un bloque de telemetría de tokens para mantener al usuario informado del consumo.
