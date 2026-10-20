# Prueba técnica · Científico de Datos

| Serie | Tema | Estado |
|---|---|---|
| I · Campo | variedades de caña y renovación de lotes | notebooks 01-05 listos |
| II · Fábrica | caldera de cogeneración | notebooks 06-09 listos |
| III · Mercado | producción mundial y precio del azúcar | notebooks 10-13 listos |
| IV · Producción | API de las Series I, II y III con Docker Compose y pruebas | lista |
| V · Presentación | presentación ejecutiva | pendiente |

Estado Serie I · Campo:
- `notebooks/01_campo_eda.ipynb` — auditoría y EDA (listo)
- `notebooks/02_campo_recomendacion.ipynb` — pregunta 1: variedades, ciclo de renovación y certeza (listo; el bootstrap tarda ~3 min)
- `notebooks/03_campo_modelo.ipynb` — pregunta 2: modelo supervisado, escenarios 1 y 2 (listo; ~2 min)
- `notebooks/04_campo_segmentos.ipynb` — pregunta 3: segmentación de variedades (listo; ~1.5 min)
- `notebooks/05_campo_datos_propios.ipynb` — pregunta 4: datos a capturar, auditoría de renovaciones, distancia,
  zonificación y tamaño de ensayos (listo; ~30 s)

Estado Serie II · Fábrica:
- `notebooks/06_fabrica_datos.ipynb` — pregunta 1: confiabilidad de archivos y sensores (listo; ~25 s)
- `notebooks/07_fabrica_regimenes.ipynb` — pregunta 2: regímenes de operación (listo; ~50 s)
- `notebooks/08_fabrica_sensor_virtual.ipynb` — pregunta 3: sensor virtual del flujo de vapor (listo; ~20 s)
- `notebooks/09_fabrica_anomalias_eficiencia.ipynb` — preguntas 4 y 5: anomalías, alertas y eficiencia (listo; ~20 s)

Estado Serie III · Mercado:
- `notebooks/10_mercado_paises.ipynb` — pregunta 1: segmentación de países y datos poco confiables (listo; ~1.5 min)
- `notebooks/11_mercado_precio.ipynb` — pregunta 2: volatilidad, regímenes, extremos y verificación (listo; ~25 s)
- `notebooks/12_mercado_pronostico.ipynb` — pregunta 3: pronóstico a 1 y 3 meses con bandas (listo; ~15 s)
- `notebooks/13_mercado_oferta.ipynb` — pregunta 4: respuesta de la oferta al precio (listo; ~2 min)

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

## Serie II · Resumen para la Gerencia Industrial

Caldera de lecho fluidizado circulante a carbón (≈60 t/h, 9.8 MPa, 540 °C), 30 sensores cada 5 s durante 5 días.
En el ingenio las calderas son de bagazo: se traslada el método, no los valores.

1. **Datos (notebook 06).**
   - `data_AutoReg.csv` inventa 30 valores; uso `data.csv`.
   - El diccionario no trae unidades y describe mal al menos un sensor.
   - Cinco sensores, incluido el flujo de vapor, se actualizan cada 10 s.
   - Un diferencial de presión copia la presión del hogar (toma tapada o tag mal asignado) y una vibración es ruido:
     ambos quedan fuera de los modelos.
   - Los ~70 picos diarios de la corriente del tiro inducido son respuesta del control, no errores.
2. **Regímenes (notebook 07).**
   - No hay estados separados: la carga manda.
   - Hay tres zonas de carga y un eje de operación independiente de ella: los minutos con más O₂ y más atemperación
     tienen el vapor ~7 °C más frío (descriptivo).
   - El efecto que se mide es la atemperación: sus cambios enfrían el vapor ~5 min después.
   - El único régimen discreto es el ciclo del lecho: se llena ~5.4 h y se descarga ~1.5 h, sin afectar la
     producción.
3. **Sensor virtual (notebook 08).**
   - La caída de presión domo → colector ya es un medidor de flujo: Q ∝ √(ΔP·ρ), con 0.5 % de error.
   - El Ridge completo llega a 0.30 % (0.18 t/h, R² 0.99), validado hacia adelante por día.
   - El gradient boosting es peor. Sin presiones de vapor, el respaldo da 1.1 %.
   - La caldera responde en 1-2 min.
4. **Anomalías (notebook 09, parte A).** Tres capas: reglas físicas, verificación de sensores por redundancia y un
   monitor PCA (T² y SPE) con ventana móvil.
   - El criterio para separar sensor de equipo: un sensor se separa de sus pares; un equipo mueve variables acopladas
     y los pares coinciden.
   - Con 5 fallas inyectadas, 5 de 5 bien clasificadas.
   - ~9 alarmas por día entre las tres capas, todas con diagnóstico. Los umbrales de las reglas se calibraron con
     estos mismos datos, así que esa cifra sale en parte por construcción.
5. **Eficiencia (notebook 09, parte B).**
   - **Limpieza de superficies:** los gases hacen un serrucho de ~8 h, compatible con ensuciamiento y soplado (o con
     el ciclo del lecho; sin registro de soplados no se distingue). Su base sube ~2 °C/día. Si es ensuciamiento,
     recuperar la deriva vale 0.1-0.3 puntos de eficiencia, unos US$10-23 mil al año con supuestos declarados.
   - **Exceso de aire:** ya está bajo; ahorra menos de 0.1 punto.
   - **Temperatura del vapor:** su valor está en la turbina.
   - Para estimar en absoluto faltan combustible, chimenea y CO.

Explicación visual e interactiva: `docs/serie2_explicacion.html`.

## Serie III · Resumen para la Gerencia General y Comercial

1. **Países (notebook 10).**
   - **Datos poco confiables en FAOSTAT:**
     - Liberia repite el mismo rendimiento 33 años, y Guinea y Papúa Nueva Guinea no tienen datos oficiales.
     - Los departamentos franceses dejan de reportar en 2006.
     - En 2023, menos de la mitad de los datos del panel son oficiales.
     - Guatemala: la producción de 2014-2016 está inflada y el área de 2019-2023 es imputada (el USDA reporta 12-15 %
       más área en 2021-2022).
   - **No hay grupos naturales bien separados.** Uso una tipología de tres: expansión, madurez y datos dudosos.
   - **Guatemala** es uno de 4 países de 71 en el cuartil superior de crecimiento de área **y** de rendimiento. Sus
     pares por trayectoria son El Salvador, Eswatini, Brasil, Nicaragua y Egipto, no Colombia ni México.
2. **Precio (notebook 11).**
   - **La serie pega contratos.** Hay 97 saltos por cambio de contrato que no son mercado; los corrijo.
   - **Dos regímenes de volatilidad:** calma (3.5 % semanal) y turbulencia (5.9 %).
   - **Colas pesadas:** unas 36 veces más días extremos que una normal. Los ciclos de nivel no se distinguen del azar.
   - **La serie es real:** los extremos coinciden al centavo y al día con fuentes públicas, y los promedios anuales
     coinciden con el Banco Mundial y el FMI (−1 % a +3 %).
3. **Pronóstico (notebook 12).**
   - Ningún modelo probado le gana al **último cierre** a 1 y 3 meses: ~5 % y ~12 % de error.
   - La utilidad está en la **banda según volatilidad**, que queda calibrada. Cada ¢/lb equivale a US$22/t.
4. **Oferta (notebook 13).**
   - **Asociación robusta pero pequeña** del área con el precio de 2-3 años antes: elasticidad acumulada de ~0.08.
     Sobrevive a controlar la inercia (ARDL), a quitar cualquier año y a usar solo datos oficiales.
   - **La evidencia causal es débil:**
     - la permutación da p = 0.05-0.08 a una cola;
     - el placebo del año siguiente falla en algunas muestras (la oferta también mueve el precio);
     - la versión ponderada por tamaño (~0.17, p = 0.01) es exploratoria.

Explicación visual e interactiva: `docs/serie3_explicacion.html`.

## Cómo ejecutar
1. `pip install -r requirements.txt`
2. Colocar los datasets (no se versionan):
   - Serie I: el CSV de Louisiana en `data/raw/All_Genotypes_2010_onwards.csv` (fuente: data.gov / Ag Data Commons,
     "Louisiana Sugarcane yield data (2010-2021)").
   - Serie II: `data.csv`, `data_AutoReg.csv` y `columns.csv` en `data/raw/serie2/` (dataset *Time-Series of
     Industrial Boiler Operations*).
   - Serie III, en `data/raw/serie3/`: `Production_Crops_Livestock_E_All_Data.csv` y
     `Production_Crops_Livestock_E_All_Data_NOFLAG.csv` (FAOSTAT, *Production: Crops and livestock products*, todos los
     datos), `all_agricultural_products_data.csv` e `individual_data/` con `Sugar_data.csv`, `Coffee_data.csv`,
     `Cocoa_data.csv` y `Cotton_data.csv` (*Agricultural Commodities Futures*).
3. Desde `notebooks/`, en orden, con `jupyter nbconvert --to notebook --execute --inplace <notebook>.ipynb`:
   - Serie I: `01_campo_eda`, `02_campo_recomendacion`, `03_campo_modelo`, `04_campo_segmentos` y
     `05_campo_datos_propios` (del 03 en adelante leen salidas del 02).
   - Serie II: `06_fabrica_datos`, `07_fabrica_regimenes`, `08_fabrica_sensor_virtual` y
     `09_fabrica_anomalias_eficiencia` (el 07 lee el resumen del 06; el 09 lee los del 06 y 08).
   - Serie III: `10_mercado_paises`, `11_mercado_precio`, `12_mercado_pronostico` y `13_mercado_oferta`, en cualquier
     orden (cada uno lee los datos crudos; ninguno depende de otro).
4. Documentos explicativos interactivos (desde la raíz): `python docs/build_serie1_explicacion.py`,
   `python docs/build_serie2_explicacion.py` y `python docs/build_serie3_explicacion.py` regeneran
   `docs/serie1_explicacion.html`, `docs/serie2_explicacion.html` y `docs/serie3_explicacion.html` con las cifras de
   los notebooks. Se abren en cualquier navegador; no necesitan servidor.

## Serie IV · API en producción

Los modelos de la Serie I, y los de la caldera y el mercado de las Series II y III, se exponen como una API REST
(FastAPI), con validación de entradas y documentación OpenAPI. No necesita los datasets: carga los JSON de
`outputs/models/` y calcula igual que los notebooks.
Detalle de cada consulta, ejemplos y para qué sirve: [`docs/api.md`](docs/api.md).

| Qué | Comando (desde la raíz, con Docker Desktop abierto) |
|---|---|
| Levantar la API | `docker compose up --build` → documentación interactiva en `http://localhost:8000/docs` |
| Correr todas las pruebas, incluida PostgreSQL 16 | `docker compose --profile pruebas run --rm pruebas` |
| Sin Docker | `pip install -r requirements.txt`, luego `uvicorn api.main:app --reload` y `pytest` |

| Consulta | Serie y pregunta |
|---|---|
| `GET /campo/variedades`, `POST /campo/ciclo` | I · 1 · ranking, ciclo de renovación y precio de equilibrio |
| `POST /campo/pronostico` | I · 2 · azúcar por acre esperado, con banda |
| `POST /campo/segmento` | I · 3 · grupo de una variedad |
| `POST /campo/auditoria`, `POST /campo/auditoria/csv` | I · 4 · auditoría de renovaciones por lote |
| `GET /caldera/sensores` | II · 1 · diccionario corregido de los 30 sensores |
| `POST /caldera/modo` | II · 2 · zona de carga de una ventana de 5 min |
| `POST /caldera/vapor-virtual` | II · 3 · sensor virtual del flujo de vapor |
| `POST /caldera/verificar` | II · 4 · verificación de sensores: ¿falla el sensor o es el proceso? |
| `GET /mercado/pronostico` | III · 3 · precio del azúcar a 1 y 3 meses con bandas |

Las pruebas llaman a la API y reproducen las cifras de los notebooks:
- `tests/test_api.py` (Serie I): margen de referencia US$526.3/acre/año, las 23 variedades del notebook 02, las 509
  predicciones de 2022 (≤ 1 lb/acre), el 100 % de las asignaciones de grupos y 1,143/1,143 ciclos de la auditoría.
- `tests/test_api_caldera_mercado.py` (Series II y III): el 100 % de las 1,441 ventanas de modo, el Ridge final del
  sensor virtual en 171 minutos, los 12 chequeos de verificación igual que `src/fabrica_anomalias`, el diagnóstico
  sensor contra proceso con fallas inyectadas y las bandas del pronóstico del notebook 12.

Última corrida dentro de Docker, con PostgreSQL 16: 67 pruebas aprobadas (`outputs/tests/pytest_docker.txt`).

## Estructura

Serie I · Campo
- `src/campo_data.py` — carga y limpieza del dataset de campo (reglas documentadas; la usan notebooks y API)
- `src/campo_economia.py` — comparación contra testigos, curvas por variedad y economía del ciclo de renovación
- `src/campo_modelo.py` — variables "as-of" sin fuga, historia por año, métricas y bootstrap pareado (pregunta 2)
- `src/campo_segmentos.py` — indicadores por variedad (caña, calidad, longevidad, estabilidad) y nombres de grupos (pregunta 3)
- `src/campo_renovacion.py` — auditoría de renovaciones por lote y regla de reemplazo (pregunta 4)
- `src/campo_ensayos.py` — componentes de varianza, potencia de ensayos y distancia de Gower (pregunta 4)
- `outputs/models/serie1_curvas.json` — parámetros por variedad y curva de testigos (insumo de la API, pregunta 1)
- `outputs/models/serie1_modelo_p2.json` — modelo de la pregunta 2 en JSON (coeficientes, bases, fincas, variedades, banda)
- `outputs/models/serie1_segmentos.json` — grupos de la pregunta 3: medias, desvíos y centros para asignar variedades nuevas
- `sql/esquema_campo.sql` — modelo de datos de campo para PostgreSQL (pregunta 4)
- `tests/test_esquema_postgres.py` — prueba de punta a punta del esquema (requiere `CAMPO_PG_DSN`; sin ella se omite). Última corrida
  contra PostgreSQL 16: `outputs/tests/pytest_postgres.txt` (5 aprobadas)
- `docs/serie1_explicacion.html` — explicación visual e interactiva de la Serie I (EDA y las cuatro preguntas, con calculadoras)

Serie II · Fábrica
- `src/fabrica_datos.py` — carga, diccionario corregido, auditoría de sensores, banderas, variables derivadas
- `src/fabrica_regimenes.py` — modos (k-means con nulo gaussiano y bootstrap por bloques), residuos a igual carga,
  ciclo del lecho
- `src/fabrica_sensor_virtual.py` — tabla de 1 min, rezagos sin fuga, pliegues hacia adelante, modelos, bootstrap
- `src/fabrica_anomalias.py` — verificación de sensores, sensores congelados, monitor PCA (T² y SPE), reglas, fallas
  sintéticas
- `src/fabrica_eficiencia.py` — supuestos de caldera, calor útil (IAPWS-97), pérdidas y ahorro
- `outputs/models/serie2_*.json` — diccionario corregido, modos, sensor virtual y verificación (insumos para la API)
- `docs/serie2_explicacion.html` — explicación visual e interactiva de la Serie II

Serie III · Mercado
- `src/mercado_faostat.py` — carga, banderas, panel limpio (agregados, China, sucesores), calidad por país,
  descriptores de trayectoria, grupos con nulo gaussiano y bootstrap, y distancia entre trayectorias
- `src/mercado_precio.py` — auditoría, calendario de vencimientos, retornos crudos y ajustados, Markov de volatilidad,
  giros de 20 % contra un paseo aleatorio y extremos
- `src/mercado_pronostico.py` — tabla mensual, modelos, origen rodante sin fuga, bootstrap pareado, Diebold-Mariano y
  bandas fija y según volatilidad
- `src/mercado_oferta.py` — panel de oferta, efectos fijos (con la inercia propia, ARDL), errores por año o
  Driscoll-Kraay, permutación, jackknife por año y agregado mundial
- `outputs/models/serie3_pronostico.json` — centro y banda del pronóstico a 1 y 3 meses (insumo para la API)
- `docs/serie3_explicacion.html` — explicación visual e interactiva de la Serie III

Serie IV · Producción
- `api/` — API: `main.py` (rutas y OpenAPI), `esquemas.py` (validación de entradas), `servicios.py` (cálculos sobre
  los JSON), `requirements.txt` (dependencias de la imagen Docker)
- `Dockerfile`, `docker-compose.yml` — imagen de la API y servicios de pruebas (PostgreSQL 16 temporal)
- `api/caldera.py`, `api/mercado.py` — cálculos de la caldera (Serie II) y del pronóstico del precio (Serie III)
  sobre sus JSON
- `tests/test_api.py` — pruebas de la API con las cifras de control de la Serie I
- `tests/test_api_caldera_mercado.py` — pruebas de la API de la caldera y el mercado, con las muestras que exportan los
  notebooks 07 y 08 (`outputs/tables/serie2_muestra_api_*.csv`)
- `outputs/tests/pytest_docker.txt` — salida de todas las pruebas dentro de Docker (API + PostgreSQL 16: 67 aprobadas)
- `docs/api.md` — documentación de la API: qué es, para qué sirve, cada consulta con ejemplo

General
- `notebooks/` — un notebook por etapa de análisis (con su versión HTML)
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

### Serie II · Caldera
- **Chequeo de gases más fino:** hoy el par izquierda-derecha solo ve derivas de ~27 °C. Un modelo de la temperatura
  de gases (carga, O₂, tiempo desde la última limpieza) lo bajaría a pocos grados.
- **Referencias más largas:** con 2-3 meses, el monitor de proceso puede usar ventanas por zona de carga y fase del
  lecho, y los umbrales se fijan con eventos confirmados.
- **Arranques y paros:** no están en estos 5 días. Serían los regímenes realmente distintos y necesitan su propio
  modelo.
- **Eficiencia absoluta:** con flujo y poder calorífico del combustible, temperatura de chimenea y CO, el balance de
  energía reemplaza los supuestos.

### Serie III · Mercado
- **Respuesta de la oferta con más historia:** extender el precio a 1960-2023 con la serie anual del Banco Mundial
  (*Pink Sheet*, "Sugar, world"). Pasaría de 20 a ~60 años de variación del precio, con más poder para la prueba de
  permutación.
- **Precio que ve cada país:** convertir el No. 11 a moneda local y deflactar (tipo de cambio y precios del Banco
  Mundial). La respuesta medida en dólares probablemente subestima la real.
- **Causalidad:** usar el avance mensual de la zafra brasileña (UNICA) o choques de clima en Brasil como instrumento.
  El rendimiento anual es un instrumento débil (F = 0.2).
- **Pronóstico:** agregar la curva completa de futuros (todos los vencimientos), porque el contrato que vence en la
  fecha objetivo ya es el pronóstico del mercado. También fundamentos: avance de zafra, política de la India, real y
  petróleo.
- **Guatemala:** reemplazar FAOSTAT 2014-2023 por las estadísticas de la gremial y de su centro de investigación.

### Serie IV · Lo que no está en la API
- **Monitor de proceso (PCA, notebook 09):** necesita 24 h de historia y se reentrena cada hora. En producción iría
  como un servicio programado que lee el historiador de la planta, no como una consulta suelta.
- **Sensor congelado:** se detecta con las muestras de 5 s; la API recibe promedios de 1 min.
- **Pronóstico del precio con datos nuevos:** el JSON trae el último cierre de la prueba (31/05/2024). Para usarlo en
  vivo, un proceso diario tendría que recalcular la volatilidad y el último cierre.
