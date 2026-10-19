# Prueba técnica · Científico de Datos

Estado Serie I · Campo:
- `notebooks/01_campo_eda.ipynb` — auditoría y EDA (listo)
- `notebooks/02_campo_recomendacion.ipynb` — pregunta 1: variedades, ciclo de renovación y certeza (listo; el bootstrap tarda ~3 min)
- `notebooks/03_campo_modelo.ipynb` — pregunta 2: modelo supervisado, escenarios 1 y 2 (listo; ~2 min)
- `notebooks/04_campo_segmentos.ipynb` — pregunta 3: segmentación de variedades (listo; ~1.5 min)
- `notebooks/05_campo_datos_propios.ipynb` — pregunta 4: datos a capturar, auditoría de renovaciones, distancia,
  zonificación y tamaño de ensayos (listo; ~30 s)

## Serie I · Resumen para la Gerencia Agrícola

Método común: cada variedad se compara contra 4 testigos fijos en el mismo ensayo y corte, se mide su longevidad y
todo se lleva a dinero con su certeza (bootstrap de ensayos). Datos de Louisiana: se traslada el método, no las
variedades.

1. **Qué ampliar y cuándo renovar (notebook 02).** HOCP14-885 (+US$272/acre/año frente al testigo promedio, IC90
   226-319), HOL15-508 (+250, IC90 183-325) y L15-306 (+207, IC90 166-248). Renovar cada 4 cortes. El precio cambia
   cuánto se gana, no cuál variedad elegir; el equilibrio de las tres está en US$0.11-0.12/lb.
2. **Cuánto azúcar esperar (notebook 03).** Ridge en dos piezas (nivel de la finca + ventaja de la variedad): error
   típico de 22 % por parcela (una variedad en una finca y zafra) contra 24 % del promedio histórico, y ordena variedades dentro del lote (ρ 0.44; 0.51 en
   socas). El 77 % del error es clima y manejo del lote-año: presupuestar con banda (−29 % / +32 %, cubrió 74 %).
3. **Qué rol darle a cada variedad (notebook 04).** No hay grupos naturales, pero 5 perfiles se reproducen al
   remuestrear (ARI 0.62) y explican el 74 % de la ganancia de la pregunta 1. Hay un compromiso entre tonelaje y
   calidad, y la calidad viene con longevidad. Uno de los testigos núcleo es inestable.
4. **Cómo decidir con datos propios (notebook 05).** Auditar renovaciones con los registros que ya existen (número de
   corte obligatorio), calcular el ciclo por zona de costo, zonificar lotes con los estratos de CENGICAÑA y hacer
   ensayos en 20 fincas por cohorte (5 por estrato) con testigos estables. Con el mismo número de parcelas, sumar
   fincas da 2.6 veces más potencia que sumar repeticiones; ventajas de 5 % no se separan del ruido.

Explicación visual e interactiva: `docs/serie1_explicacion.html`.

## Cómo ejecutar
1. `pip install -r requirements.txt`
2. Colocar el CSV original de Louisiana en `data/raw/All_Genotypes_2010_onwards.csv`
   (fuente: data.gov / Ag Data Commons, "Louisiana Sugarcane yield data (2010-2021)"). Los datasets no se versionan.
3. Desde `notebooks/`, en orden: `jupyter nbconvert --to notebook --execute --inplace 01_campo_eda.ipynb`, luego
   `02_campo_recomendacion.ipynb`, `03_campo_modelo.ipynb`, `04_campo_segmentos.ipynb` y `05_campo_datos_propios.ipynb`
   (del 03 en adelante leen salidas del 02)
4. Documento explicativo interactivo: `python docs/build_serie1_explicacion.py` (desde la raíz) regenera
   `docs/serie1_explicacion.html` con las cifras de los notebooks. Se abre en cualquier navegador; no necesita servidor.

## Estructura
- `src/campo_data.py` — carga y limpieza del dataset de campo (reglas documentadas; la usarán notebooks y API)
- `src/campo_economia.py` — comparación contra testigos, curvas por variedad y economía del ciclo de renovación
- `src/campo_modelo.py` — variables "as-of" sin fuga, historia por año, métricas y bootstrap pareado (pregunta 2)
- `outputs/models/serie1_curvas.json` — parámetros por variedad y curva de testigos (insumo de la API, pregunta 1)
- `outputs/models/serie1_modelo_p2.json` — modelo de la pregunta 2 en JSON (coeficientes, bases, fincas, variedades, banda)
- `src/campo_segmentos.py` — indicadores por variedad (caña, calidad, longevidad, estabilidad) y nombres de grupos (pregunta 3)
- `outputs/models/serie1_segmentos.json` — grupos de la pregunta 3: medias, desvíos y centros para asignar variedades nuevas
- `docs/serie1_explicacion.html` — explicación visual e interactiva de la Serie I (EDA y las cuatro preguntas, con calculadoras)
- `src/campo_renovacion.py` — auditoría de renovaciones por lote y regla de reemplazo (pregunta 4)
- `src/campo_ensayos.py` — componentes de varianza, potencia de ensayos y distancia de Gower (pregunta 4)
- `sql/esquema_campo.sql` — modelo de datos de campo para PostgreSQL (pregunta 4)
- `tests/test_esquema_postgres.py` — prueba de punta a punta del esquema (requiere `CAMPO_PG_DSN`; sin ella se omite). Última corrida
  contra PostgreSQL 16: `outputs/tests/pytest_postgres.txt` (5 aprobadas)
- `notebooks/` — un notebook por etapa de análisis
- `outputs/figures`, `outputs/tables` — generados por los notebooks
- `bitacora.md` — decisiones, hipótesis descartadas y uso de IA

## Pendientes y cómo los abordaría

### Serie I · Pregunta 2, escenario 3: variedad nueva (solo historia de etapas 3-4)
No lo desarrollé: decidí priorizar los escenarios 1 y 2. Cómo lo abordaría:
1. **Misma estructura de dos piezas.** El nivel de la finca no cambia; solo cambia de dónde sale la ventaja de la variedad.
2. **Ventaja desde etapas tempranas, corregida por inflación.** En etapas 2-4 las parcelas son más chicas y el rendimiento
   sale ~1.5× (notebook 01). Se calcularía la ventaja vs los testigos del mismo ensayo de etapa 3-4 (la relación ya
   cancela buena parte de la inflación) y se calibraría cuánto de esa ventaja se cumple en etapa 5 con las 39 de 40
   variedades de etapa 5 que también tienen datos de etapas 3-4: una regresión `ventaja_etapa5 ~ ventaja_etapa3_4`
   (se espera una pendiente menor que 1 por regresión a la media y porque solo avanzan las que salieron bien).
3. **Validación.** Dejar fuera variedades completas (todas sus parcelas de etapa 5), en orden de cohorte: predecir las
   variedades que entraron a etapa 5 en el año t con lo aprendido de las que entraron antes.
4. **Riesgo principal.** Sesgo de supervivencia: solo se observa en etapa 5 a las que ganaron en etapas tempranas. La
   pendiente calibrada ya incorpora ese encogimiento; el intervalo debe ser bastante más ancho que en los escenarios 1-2.
