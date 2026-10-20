# Bitácora de decisiones

Registro de mis decisiones técnicas, las hipótesis que descarté y cómo usé la IA. Cada entrada dice cómo lo verifiqué.

**Cómo trabajé con IA.** Usé Claude (chat y Claude Code) como asistente: para escribir y ejecutar código, hacer
cálculos, redactar borradores de texto y revisar cifras. Las preguntas, los métodos y las decisiones son míos. No
acepté ningún resultado de la IA sin verificarlo con los datos. Al final de cada serie hay una sección "Uso de IA" con
lo que hizo la IA, cómo lo verifiqué y qué sugerencias o errores suyos corregí o descarté.

## Resumen

**Cómo decidí en las tres series.** Cuatro reglas que se repiten:
1. **Auditar los datos antes de modelar.** Cada serie tenía una trampa en el archivo: coma decimal y unidades en
   libras, no toneladas (D1, D2); un archivo con 30 valores inventados (D42); un precio que pega contratos distintos
   (D58).
2. **Probar contra el azar antes de hablar de grupos o ciclos.** En ninguna serie hay grupos naturales (D31, D47,
   D56), y los ciclos del precio no se distinguen de un paseo aleatorio (D59). Uso los grupos como tipologías útiles,
   no como hechos.
3. **Validar como se usaría.** Siempre hacia adelante en el tiempo y sin fuga: por zafra (D22), por día (D48), con
   origen rodante (D61). La validación al azar promete entre 17 % y 51 % menos error del real (H16).
4. **Simple antes que complejo.** En las tres series el modelo lineal o el ingenuo empata o gana a los árboles y al
   ARIMA (D26, H15, H22). Me quedo con el que se explica.

**Las decisiones que más pesan.**

| Serie | Decisión | Por qué |
|---|---|---|
| I · Campo | Comparar cada variedad contra 4 testigos fijos del mismo ensayo y corte (D14) | quita lugar, año y suelo con una regla que no cambia entre años |
| I · Campo | Economía solo con etapa 5 y certeza por bootstrap de ensayos completos (D8, D19) | las parcelas tempranas inflan ~1.5× y las de un ensayo no son independientes |
| I · Campo | Ridge en dos piezas: nivel de la finca + ventaja de la variedad (D24-D26) | empata o gana y se explica con 3 coeficientes |
| II · Caldera | Sensor virtual con la caída de presión domo-colector (D48) | es física de medidor de flujo: 0.30 % de error validado por día |
| II · Caldera | Anomalías en tres capas con diagnóstico sensor/equipo (D50, D51) | un sensor se separa de sus pares; un equipo mueve variables acopladas |
| III · Mercado | Serie de precio ajustada por cambio de contrato (D58) | la mitad de las colas pesadas eran saltos de contrato |
| III · Mercado | Último cierre como pronóstico central y banda según volatilidad (D61) | ningún modelo probado le gana; el valor está en el rango |
| III · Mercado | Permutación de los años del precio como prueba principal de la oferta (D62) | solo hay 20 años de precio; los errores agrupados prometían de más |
| IV · API | La API lee artefactos JSON de las tres series y sus pruebas reproducen las cifras de los notebooks (D63, D70, D76) | sin pickles ni datasets, y comprobable |

**Hipótesis que descarté** (24 en total; las principales):

| Hipótesis | Qué la descartó |
|---|---|
| El costo de corte cambia el ranking de variedades (H1) | Spearman 0.98 entre ranking por azúcar y por margen |
| La cosecha del lote el año pasado es el mejor predictor (H5) | es la peor referencia: el efecto del año no se repite |
| El archivo `data_AutoReg.csv` mejora los datos (H12) | inventa 30 valores y falla justo en un escalón |
| Los picos de corriente del tiro son errores (H13) | la presión del hogar reacciona a ellos: son el control |
| Un ARIMA pronostica mejor que el ingenuo (H22) | solo contra el ingenuo equivocado; contra el último cierre es 28 % peor |
| El área no responde al precio (H24) | sí, con 2-3 años de rezago, pero poco (~0.08) y con evidencia causal débil |

**Uso de IA en números.** 77 decisiones y 24 hipótesis descartadas. Corregí 32 errores de fondo de la IA (método,
cálculo o afirmaciones sin respaldo), agrupé por serie las correcciones menores de texto, redondeo y figuras, y descarté
3 sugerencias suyas. Al cerrar cada serie de análisis pedí una revisión independiente de cifras a un agente separado y
corregí todo lo que encontró. Cada serie se volvió a correr desde cero en Windows antes de su commit, y sus cifras de
control coinciden.

---

## Serie I · Campo — Auditoría y EDA (`notebooks/01_campo_eda.ipynb`)

### Decisiones sobre los datos

**D1. Escribí un loader propio en vez de usar `pd.read_csv` directo.**
El 35.5 % de las filas (10,485; todas de 2010-2019) tenía T_SPACRE con coma decimal (`"1355,63"`), lo que partió el
campo y corrió los decimales a TRS_TON (`"63    202.317"`). Reconstruyo ambos valores.
*Verificación:* tras la reparación, T_SPACRE / (TCA × TRS_TON) tiene mediana 1.0000 y percentiles 1-99 entre 0.997 y
1.003 en todos los años; solo 8 de 29,205 filas se alejan más de 2 %.
*Alternativa descartada:* eliminar las filas corruptas. Habría perdido el 35.5 % de la muestra, incluida más de la mitad
de las filas de 2010-2012.

**D2. Interpreto T_SPACRE como libras de azúcar por acre.**
El PDF de la prueba y la nota incrustada en el propio CSV dicen "toneladas". Sospeché una trampa de unidades y la
verifiqué: la identidad T_SPACRE = TCA × TRS (lb/t × t/acre = lb/acre) se cumple fila por fila en las 29,205 filas, y la
metadata original de USDA-ARS (data.gov) dice libras.
*Impacto:* ingreso por acre = T_SPACRE × US$0.20/lb.

**D3. POPN de 2020-2021 → faltante.**
En 2010-2019 POPN son tallos/acre (TCA = POPN × MSTWT / 2000 exacto). En 2020-2021 la mediana es ~12 y ninguna conversión
simple cumple la identidad. Junto con la fibra (98 % medida vs ~32 %) y el TRS con 2 decimales, indica que el archivo une
dos exportaciones distintas. Igual no uso POPN como predictor (ver D9).

**D4. Reglas de plausibilidad física** (en `src/campo_data.py`, `LIMITS`): TCA ≤ 100 t/acre, MSTWT ≤ 6 lb,
TRS entre 120 y 400 lb/t, fibra entre 6 y 22 %. Afectan 75 filas en total. Caso típico: L03-371, 2014, SGL con
TCA = 518.8 y MSTWT = 20.6 (error de un dígito: ×10). Los ceros en mediciones los paso a faltante (vienen junto a
celdas vacías).

**D5. 'DOMINGUES' = 'DOMINGUE'.** La plantía 2019 aparece como DOMINGUES y sus socas 2020-2021 como DOMINGUE: es el mismo
ensayo.

**D6. Duplicados.** Elimino 126 filas idénticas en llave y mediciones (doble captura). Otras 212 filas comparten llave
con mediciones distintas: son variedades comerciales sembradas en ensayos paralelos en la misma localidad y año (el archivo
no trae ID de ensayo). Las conservo y las promedio a nivel parcela.

**D7. Definición de ensayo y de testigo.**
Ensayo = etapa × localidad × año de siembra (`PLANT_YEAR = YEAR − CROP`).
Testigo = clon sembrado en etapas 2-3 en ≥ 4 cohortes (12 clones). Un candidato pasa por ahí 1-3 veces; solo las
variedades de referencia se resiembran cada año.
*Alternativa descartada:* "clon presente en las 4 etapas". También lo cumplen los candidatos que fueron avanzando
(p. ej. L15-306), así que no separa testigos de candidatos.

### Decisiones para el modelado (derivadas del EDA)

**D8. Calculo la economía de renovación solo con etapa 5.**
El mismo clon en el mismo año rinde ~1.5× más en etapa 2 que en etapa 5 (33 pares; mediana 1.58). Las parcelas tempranas
inflan el rendimiento por acre, así que sus valores absolutos no representan un campo comercial.

**D9. Excluyo como predictores TCA, TRS_TON, POPN, MSTWT y FIBER.**
Se miden en la misma cosecha que el objetivo y T_SPACRE = TCA × TRS. Usarlas sería fuga de información.

**D10. Comparo contra testigos del mismo ensayo y corte.**
En etapa 5, localidad × año explica ~40 % de la variación y la variedad ~9 %. Todos los ensayos tienen testigos.

**D11. Estimo la caída de socas con efectos fijos de ambiente, no con promedios crudos.**
Sospeché sesgo de supervivencia y lo comprobé: en etapas 3-4, dentro del mismo ensayo, los clones que siguen a soca
rendían 12-13 % más en plantía que los que no siguen. El promedio crudo dice que la soca 4 rinde igual que la 3;
ajustado por lugar-año: 93 / 80 / 72 / 65 % de la plantía en socas 1-4.
*Verificación:* 136 de 142 ambientes de etapa 5 tienen ≥ 2 cortes simultáneos, lo que permite separar año de corte.

**D12. Incluyo la longevidad en el ranking.** La interacción clon × corte es significativa (F = 11.1, p ≈ 4e-38):
retención por corte entre 0.83 (HO07-613) y 0.96 (L01-299).

**D13. Mínimo de evidencia para recomendar.** Una parcela sola es ruidosa (r ≈ 0.4 entre repeticiones), y 13 clones de
etapa 5 solo tienen plantía de un año; varios encabezan el ranking crudo. Para el notebook 02 fijo: ≥ 2 años en etapa 5
y socas medidas hasta soca 2.

**D13b. Modelos simples a propósito.** Descarté BLUP, modelos mixtos y GPBoost. La comparación contra testigos y la
regresión con efectos fijos dan el mismo control del ambiente y son más fáciles de explicar a la Gerencia.

### Hipótesis descartadas

**H1 (descartada). "El costo de corte por tonelada cambia el ranking de variedades."**
Los datos no la apoyan: Spearman entre ranking por azúcar y ranking por margen = 0.98. Con TRS típico de ~280 lb/t, una
tonelada de caña genera ~US$56 de azúcar contra US$14 de corte; el corte solo deja de pagarse con TRS < 70 lb/t (mínimo
observado en etapa 5: 142). TCA y TRS relativos no correlacionan (r ≈ −0.07).
Lo que sí queda: una libra extra que viene de tonelaje vale ~25 % menos que una que viene de TRS.

**H2 (descartada). "La fibra puede ser criterio de selección por su valor para cogeneración."**
Solo hay fibra en el 19 % de las filas de etapa 5. Queda como recomendación de captura para los ensayos propios.

### Uso de IA

- **Qué hizo:** escribió y ejecutó el código de limpieza y del EDA siguiendo mis reglas, y redactó borradores del
  notebook.
- **Cómo lo verifiqué:** toda regla de limpieza deja rastro en `log` (filas afectadas por regla). Las unidades las
  comprobé con la identidad TCA × TRS en las 29,205 filas, no con la palabra de la metadata.
- **Sugerencia descartada:** la IA planteó al inicio que el costo de corte cambiaría el ranking (H1). La descarté con
  Spearman 0.98.
- **Sugerencia descartada:** la IA propuso modelos mixtos (BLUP) y GPBoost. Los descarté por simplicidad (D13b).
- Todas las cifras de esta sección salen de `01_campo_eda.ipynb` y se reproducen corriéndolo.

---

## Serie I · Campo — Pregunta 1: recomendación y renovación (`notebooks/02_campo_recomendacion.ipynb`)

**D14. Regla fija: 4 testigos núcleo.** HOCP04-838, HOCP96-540, L01-283 y L01-299 están en etapa 5 los 12 años. Divido
cada parcela entre el promedio de esos testigos en su mismo ensayo y corte (leave-one-out para los propios testigos).
Los 459 grupos ensayo × corte tienen al menos uno; 451 tienen dos o más.
*Alternativa descartada:* todos los testigos del ensayo. El conjunto cambia con los años (HO12-615 entra en 2016, L03-371
sale en 2017), así que variedades evaluadas en años distintos se medirían con reglas distintas.

**D15. Filtro de evidencia:** ≥ 2 años en etapa 5, plantía medida y socas hasta soca 2. Quedan 23 de 40 (12 testigos y
11 candidatos). Excluidas: 13 con un solo año, 3 variedades antiguas sin plantía en 2010-2021 (LCP85-384, HO95-988,
L97-128) y HOCP13-758 (sin soca 2).

**D16. Modelo por variedad de 2 parámetros:** `log(rel) = a + b × corte` por mínimos cuadrados. `exp(a)` = plantía vs
testigos, `exp(b)` = ventaja que gana o pierde por corte. La curva absoluta = curva de testigos núcleo × exp(a + b·corte);
el tonelaje sale de azúcar / TRS (TRS relativo promedio de la variedad).
*Alternativa descartada:* modelo mixto con BLUP. Da resultados parecidos pero es más difícil de explicar; la comparación
contra testigos del mismo ensayo ya controla el ambiente.

**D17. Extrapolación conservadora.** HOL15-508 y L15-306 solo tienen datos hasta soca 2 y su ventaja crece por corte
(exp(b) ≈ 1.07-1.08). Por defecto congelo la ventaja en el último corte medido. Con extrapolación lineal, su ciclo
óptimo pasaría de 4 a 5 cortes y su margen subiría US$23-31/acre/año; lo reporto como sensibilidad.

**D18. Economía con los supuestos de la prueba** (US$0.20/lb, US$14/t, US$350/acre/año, US$1,100/acre en plantía), sin
barbecho. Ciclo óptimo = número de cortes (1 a 5) con mayor margen promedio anual. No evalúo más de 5 cortes (no hay
datos). Con un año de barbecho el óptimo sube a 5 cortes para 8 de las 23 variedades (entre ellas HOL15-508 y
L15-306); HOCP14-885 se mantiene en 4.

**D19. Certeza: bootstrap por ensayos completos**, 1,000 réplicas, semilla 20261019. Remuestreo ensayos (no parcelas)
porque las parcelas de un ensayo comparten lugar, año y suelo. Cada réplica recalcula todo.
En 48 réplicas (4.8 %) no salen datos de soca 4 de testigos y el ciclo de 5 cortes no se puede evaluar: en esas réplicas
lo dejo fuera (`nanargmax`) y reporto cuántas fueron (ver "Uso de IA").

**D20. Precio.** Grilla de US$0.10 a US$0.30/lb. Las mismas tres variedades encabezan en todo el rango; el precio de
equilibrio de las tres es US$0.113-0.117/lb (testigo núcleo promedio: US$0.131/lb). A precios altos conviene renovar antes
(3-4 cortes); a precios bajos, estirar a 5.

**D21. Ambientes sin geolocalizar.** Quería clasificar las localidades por clima, altitud y precipitación. El dataset no
trae coordenadas ni clima, y la zona cañera de Louisiana es plana y casi al nivel del mar, así que la altitud no
discrimina. Asignar coordenadas a mano a nombres de finca sería una suposición difícil de defender. En su lugar uso un
índice ambiental con los propios datos (rendimiento de testigos en cada localidad-año), que resume clima, suelo y
manejo. Localidad explica ~29 % de su variación y año ~28 %: el potencial de una finca es útil pero no fijo.

### Hipótesis descartada

**H3 (descartada en su mayor parte). "Las mejores variedades rinden relativamente mejor en ambientes pobres."**
Una primera versión comparó la ventaja (variedad ÷ testigos núcleo) contra un índice calculado con esos mismos testigos:
78 % de las pendientes salieron negativas. Es un artefacto de denominador compartido (regresión a la media). Con un
índice independiente (parcelas que no son testigos núcleo, sin la variedad evaluada) la mediana pasa de −0.065 a −0.020.
Lo que sigue en pie: HOL15-508 y L15-306 pierden ventaja en ambientes ricos (pendiente ≈ −0.17, p < 0.05), mientras que
HOCP14-885 y L01-299 la mantienen o la aumentan.

### Uso de IA

- **Qué hizo:** implementó la regla de testigos núcleo, el modelo por variedad, la economía del ciclo y el bootstrap
  según mis definiciones, y redactó borradores del notebook.
- **Cómo lo verifiqué:** cobertura de testigos por ensayo y corte, comparación entre extrapolación lineal y
  conservadora, conteo de réplicas válidas del bootstrap, y el JSON de curvas, que reproduce el ciclo y el margen de las
  23 variedades.
- **Errores de fondo de la IA que corregí:**
  1. En la primera corrida del bootstrap, el margen vacío del ciclo de 5 cortes en 48 réplicas se tomaba como máximo
     (`argmax` con NaN) y la variedad salía sin ranking. Eso subestimaba P(top 3) (HOCP14-885: 94.8 % en vez de
     99.6 %). Se notó porque P(gana a testigos) salía idéntica (0.952) en variedades con intervalos muy distintos.
  2. El primer cálculo de H3 usaba un índice ambiental con los mismos testigos del denominador. Se detectó el
     artefacto y se corrigió con un índice independiente antes de reportar.

---

## Serie I · Campo — Pregunta 2: modelo supervisado (`notebooks/03_campo_modelo.ipynb`)

Definí el alcance: **escenario 1** (variedad conocida, finca conocida) y **escenario 2** (variedad conocida, finca
nueva). El escenario 3 (variedad nueva con historia de etapas 3-4) queda documentado en el README como pendiente.

**D22. Validación como se usaría.** En diciembre se planifica la zafra siguiente con lo que se sabe hasta entonces.
- Escenario 1: ventana creciente por año (entrenar con años < t, predecir t; t = 2013…2021, 9 pruebas).
- Escenario 2: lo mismo, pero la finca predicha se borra de toda la historia (filas, nivel y resultados de variedades).
  14 fincas × 9 años.
- Variables "as-of": cada fila, también las de entrenamiento, se describe solo con años anteriores a la suya.
*Descartado:* k-fold aleatorio. Mezcla años y deja que el modelo aprenda el clima del año a través de los vecinos del
mismo campo; daría un error optimista.

**D23. Variables sin fuga.** Excluyo TCA, TRS_TON, POPN, MSTWT y FIBER del año a predecir: se miden en la cosecha, el
mismo día que el azúcar (T_SPACRE = TCA × TRS_TON). Uso: nivel típico de testigos por corte, ventaja histórica de la
variedad vs testigos (con encogimiento: λ = 3 parcelas para el nivel, 10 para la caída por corte), nivel histórico de la
finca (λ = 1 año) y el corte anterior del mismo lote (ventaja de la variedad y nivel del lote). Fijé los valores de λ
antes de validar.

**D24. Modelo en dos piezas.** log(azúcar) = NIVEL (base del corte + efecto finca, de la historia, sin aprender pesos)
+ VENTAJA de la variedad vs testigos del mismo lote (aprendida). Ver H4: aprender el nivel con ~10 años sobreajusta la
suerte de los años de entrenamiento. La ventaja sí tiene miles de comparaciones limpias dentro de cada lote.

**D25. Algoritmos e hiperparámetros fijos.** Ridge (α = 1; 3 variables: `var_rel`, `lote_ant_rel`, `tiene_lote_ant`),
Random Forest (300 árboles, hojas ≥ 20, max_features 0.5) y XGBoost (300 árboles, profundidad 3, tasa 0.03), estos dos
con 7 variables. No busqué hiperparámetros: con 9 años de prueba, buscarlos sobre ellos sería sobreajustar la
validación. Referencias sin aprendizaje: ingenuo (promedio por corte), regla P1 (nivel + ventaja histórica con peso 1) y
"agrónomo" (cosecha del lote el año pasado × caída típica).

**D26. Resultado y modelo elegido: Ridge.** Escenario 1: MAE 1,488 lb/acre (22 %), R² 0.28, orden de variedades dentro
del lote ρ = 0.44; ingenuo 1,598 (24 %); regla P1 1,497; Random Forest 1,484; XGBoost 1,498. Las diferencias entre Ridge,
regla P1, Random Forest y XGBoost en el error total no son significativas (bootstrap pareado por finca-año); en el error
de la ventaja Ridge gana a los tres (IC90 sin cruzar 0). Escenario 2: Ridge 1,577 (24 %), R² 0.17, ρ = 0.39; no conocer la
finca cuesta +83 lb/acre (IC90 12-154). Elijo Ridge porque empata o gana y se explica con 3 coeficientes:
ventaja = 0.62 × historia de la variedad + 0.49 × ventaja en el mismo lote el año pasado.

**D27. Banda de error con errores de zafras anteriores.** Para predecir la zafra t, tomo la banda 10-90 % de los
errores de validación de las zafras < t (no de los residuos de entrenamiento, que son optimistas). Cobertura real 74 %
(esc. 1) y 71 % (esc. 2): las zafras 2019 y 2021 fueron más variables que las anteriores. La reporto como banda de ~75 %.
Banda para 2022: −29 % / +32 %.

**D28. Salidas para planificar 2022.** `serie1_pronostico_2022_lotes.csv` (467 lotes-variedad en pie, siguiente corte)
y `serie1_pronostico_2022_plantia.csv` (plantía esperada de las 3 recomendadas en cada finca). El artefacto
`serie1_modelo_p2.json` guarda coeficientes, bases, efectos de finca y parámetros por variedad; el notebook verifica que
el JSON reproduce las predicciones (diferencia 0).

### Hipótesis descartadas

**H4. "Una regresión directa con todas las variables basta."** Pierde contra la regla P1 sin aprendizaje (MAE 1,566 vs
1,497). Dos causas, ambas por tener pocos años: (a) la constante aprende la suerte de los años de entrenamiento (2011 y
2012 fueron +11 % y +15 %; en la prueba de 2013 la constante sale +0.13); (b) el peso de la historia de la variedad se
aprende cuando esa historia era de 1-3 años y valía poco (peso real dentro del lote 0.15-0.53 en 2011-2013, 0.7-1.1
desde 2014), así que la regresión le cree 0.3-0.7. Esto me llevó a D24.

**H5. "La cosecha del lote el año pasado es el mejor predictor" (regla del agrónomo).** Es la peor referencia, peor que
el promedio histórico (MAE 1,724 vs 1,598). La cosecha trae el clima de ese año y el efecto año no se repite
(correlación con el año siguiente −0.21). Lo que sí se repite del lote anterior es la ventaja relativa de la variedad.

**H6. "Los árboles encontrarán interacciones variedad × finca."** Random Forest y XGBoost no superan a Ridge. La
importancia por permutación concentra todo en `var_rel` y `lote_ant_rel`; `loc_rel` y `lote_ant_amb` ≈ 0.

**H7. "Contar la evidencia de una variedad en años y no en parcelas."** Mejora marginal (R² de la ventaja 0.357 → 0.365)
probada después de ver la validación. No la adopto: elegirla sobre los mismos años de prueba sería ajustar la
validación. Queda como mejora a probar con datos nuevos.

### Hallazgo para la Gerencia

Tres cuartas partes del error (77 %) lo comparten todas las parcelas del mismo lote y año: clima, suelo, manejo. Ningún
algoritmo lo arregla sin datos de clima y manejo (pregunta 4). Lo que el modelo sí anticipa es la ventaja de una
variedad sobre otra, que es lo que decide qué sembrar. En plantía esa ventaja es poco predecible (R² < 0.1 para todos los
modelos); desde la primera soca, lo que la variedad hizo en el mismo lote la predice mucho mejor (R² 0.40).

### Uso de IA

- **Qué hizo:** implementó la validación por año, las variables as-of, los modelos y el bootstrap pareado según mi
  diseño, y redactó borradores del notebook y del HTML.
- **Cómo lo verifiqué:** diagnóstico de la sección 3 (pesos aprendidos vs pesos reales dentro del lote), bootstrap
  pareado por finca-año, y la calculadora del HTML contra las 509 predicciones del notebook (diferencia máxima
  0.7 lb/acre, por redondeo de las tablas).
- **Sugerencia descartada:** para explicar H4, la IA propuso que los años malos coincidían con más variedades buenas en
  prueba (confusión entre clima y mezcla de variedades). Es falsa: la correlación entre el efecto año y la ventaja media
  de las variedades del año es −0.07, y la pendiente con y sin efectos fijos de lote es casi la misma (0.88 vs 0.91
  desde 2014).
- **Errores de fondo de la IA que corregí:**
  1. La primera descomposición del error usaba el promedio del lote incluyendo la propia parcela (79 % "nivel") y un
     oráculo que veía su propio error (R² 0.84). Lo corregí con el promedio de las otras parcelas (correlación
     intraclase): 77 % y R² 0.81.
  2. La primera banda de 80 % usaba residuos de entrenamiento y cubría 73 %. La cambié por errores de zafras anteriores
     y reporto la cobertura real (74 %) en lugar de prometer 80 %.
- **Correcciones menores (texto, redondeo y figuras):** una figura de "nivel" contra "ventaja" con dos dispersiones de
  r casi igual (0.49 y 0.48) que no mostraba lo que decía el texto (la reemplacé por tres lotes reales); cifras de
  borradores escritos antes de ejecutar ("la banda cubre 8 de cada 10", "ρ de 0.42 a 0.52"); y el HTML redondeaba un
  dato ya redondeado (+6 % contra +5 % en la zafra 2013; ahora el resumen guarda 3 decimales).

---

## Serie I · Campo — Pregunta 3: segmentación (`notebooks/04_campo_segmentos.ipynb`)

**D29. Uso las mismas 23 variedades de D15.** Las otras 17 no se pueden segmentar con honestidad: 13 solo tienen un año
de plantía (no hay longevidad ni estabilidad que medir), 3 son antiguas sin plantía en 2010-2021 y una no llegó a soca 2.

**D30. Cuatro indicadores contra los testigos núcleo del mismo ensayo y corte.**
- Productividad = caña por acre (TCA) en plantía; calidad = TRS promedio. Separo caña y calidad (no azúcar y calidad)
  porque azúcar = caña × calidad: la calidad contaría dos veces.
- Longevidad = cambio de la caña por corte frente a los testigos (correlación 0.99 con la misma medida en azúcar).
- Estabilidad = desvío de la ventaja que no explica la calidad de la finca (Eberhart-Russell, con índice ambiental
  independiente para no repetir la trampa H3) y **sin el ruido de parcela**, medido con las repeticiones y restado.
  En mediana, el ruido es el 67 % de la varianza bruta: sin restarlo, la "estabilidad" mediría cuántas repeticiones
  tuvo cada variedad.
- La respuesta al ambiente (pendiente) y la fibra las reporto como descriptivos; no entran al agrupamiento (la fibra
  falta en 7 de las 23).

**D31. No hay grupos naturales.** La silueta de k-means no supera a la de 200 tablas con cada indicador barajado por
separado (p ≥ 0.065 para k = 2…7). Las variedades forman un continuo con dos ejes (81 % de la varianza): calidad +
longevidad + estabilidad contra tonelaje. Segmento igual, y lo presento como una partición útil de un continuo.

**D32. Número de grupos por reproducibilidad.** Bootstrap de ensayos completos (300 réplicas, semilla 20261019):
recalculo los indicadores y reagrupo; ARI contra la partición original. k = 2 es el más estable (0.91) pero solo
separa tonelaje de calidad. Regla: entre 3 y 7, el más reproducible sin grupos de una sola variedad → **k = 5**
(ARI 0.62; Ward coincide con k-means en ARI 0.76).
*Transparencia:* fijé la regla después de explorar. La primera versión ("mayor k con ARI ≥ 0.6") era frágil: k = 6
quedaba en 0.598. Ver "Uso de IA".

**D33. Nombres con reglas fijas sobre los centros** (`campo_segmentos.nombrar`), certeza por variedad con
co-asignación en las réplicas y por grupo con el Jaccard de Hennig. Grupos firmes (≥ 0.75): "mucha caña, menos
calidad" e "inestables y de vida corta". Con bordes difusos (0.70-0.73): "completas", "calidad sin caña" y "sin ventaja
clara". Asignaciones dudosas (< 60 %): HOCP14-885 (única con mucha caña y mucha calidad), HO13-739, L12-201 y HOL15-508.

**D34. Validación externa con dinero.** No usé la ganancia de la pregunta 1 para agrupar; los grupos explican el 74 % de
su variación (η², prueba de permutación con 10,000 reasignaciones, p < 0.0001).

**D35. Artefacto.** `serie1_segmentos.json` guarda medias, desvíos y centros: una variedad nueva se asigna al centro más
cercano con sus 4 indicadores. El notebook verifica que el JSON reproduce el 100 % de las asignaciones.

### Hipótesis descartadas

**H8. "Hay tipos naturales de variedades."** Descartada (D31). Consecuencia: para las variedades del borde, decidir con
la pregunta 1 y no con la etiqueta del grupo.

**H9. "El desvío de la ventaja entre ambientes mide la estabilidad."** Descartada tal cual: dos tercios de esa varianza
son ruido de parcela. Corregido en D30.

### Hallazgos para la Gerencia

- Compromiso caña-calidad (r = −0.44): no hay variedad que gane en todo. La calidad viene con longevidad (r = 0.48) y
  la longevidad con estabilidad (r = 0.58).
- "Mucha caña, menos calidad" da en plantía tanto azúcar como las completas (+8 %), pero pierde ~3 % por corte: la
  ventaja se va en las socas. Por eso la pregunta 1 no las elige.
- Dos de los cuatro testigos núcleo caen en grupos débiles: HOCP96-540 ("inestables") y HOCP04-838 ("sin ventaja
  clara"). Un testigo inestable vuelve ruidosa la comparación: insumo para la pregunta 4.
- La estabilidad de las variedades nuevas se midió con 2-4 años y la de las antiguas con 8-12: la de las nuevas puede
  estar sobreestimada.

### Uso de IA

- **Qué hizo:** implementó los indicadores, la prueba contra tablas barajadas, el bootstrap de k y la validación
  externa según mi diseño, y redactó borradores del notebook.
- **Cómo lo verifiqué:** comparé cada cifra del texto contra las salidas del notebook, y el JSON contra el 100 % de las
  asignaciones.
- **Errores de fondo de la IA que corregí:**
  1. Regla de k frágil (ARI ≥ 0.6 con k = 6 en 0.598). La cambié por "más reproducible sin grupos de una variedad" y
     declaro que la fijé después de explorar.
  2. El primer texto decía que HOCP14-885 quedaba "entre completas y mucha caña". La co-asignación muestra que se mezcla
     más con "sin ventaja clara" (20 %); lo corregí: no tiene un grupo firme porque es la única con caña y calidad altas.
  3. El primer texto del grupo "mucha caña" hablaba de "cosecha temprana" y "ciclos cortos". Lo primero no está en los
     datos y lo segundo no se cumple (ciclos óptimos de 3-4 cortes en la pregunta 1); lo reemplacé por lo que sí
     muestran los datos (pierden ~3 % por corte).
- **Correcciones menores (figuras):** las etiquetas del mapa de variedades se pisaban y una quedaba sobre el punto
  equivocado; ahora se colocan evitando choques.

---

## Serie I · Campo — Pregunta 4: datos propios (`notebooks/05_campo_datos_propios.ipynb`)

**D36. Fuentes.** Todo dato de Guatemala sale de fuentes públicas citadas en el notebook: CENGICAÑA (Melgar et al.,
2012, cap. II) para estratos altitudinales, lluvia, viento, suelos y las 44 zonas agroecológicas; Ralda (2015,
Zamorano) para la interacción variedad × estrato; censos varietales de CENGICAÑA publicados por Prensa Libre (2016) y
ASAZGUA (2021) para CP72-2086 y CG02-163. Mi criterio de campo entra como **hipótesis de experto** (E1-E6), cada una con
la prueba que la confirmaría. No encontré una clasificación pública de 7-8 regiones; queda abierta.
*Descartado:* usar registros o análisis que no sean públicos, aunque fuera solo como contexto. No se podrían citar
ni reproducir con el código entregado.

**D37. Modelo de datos en PostgreSQL** (`sql/esquema_campo.sql`): 11 tablas y una vista. Cada regla responde a un
error real del dataset de Louisiana (coma decimal, unidades, duplicados, valores imposibles, nombres). Probado de punta
a punta con PostgreSQL 16 (`tests/test_esquema_postgres.py`, 5 pruebas): rechaza los 4 tipos de error y la vista
reproduce la auditoría de pandas.

**D38. Auditoría de renovaciones** (`src/campo_renovacion.py`). Reconstruye ciclos por lote y los compara con el óptimo
de la pregunta 1 (4 cortes, tolerancia ±1 porque el óptimo es plano). Regla de reemplazo por lote: mantener la soca
mientras el margen esperado del próximo corte supere el margen promedio anual de un ciclo nuevo en ese lote. La caída
del lote se encoge hacia la típica. La economía en unidades métricas reproduce la pregunta 1 (US$526.3/acre/año).
La validé con un portafolio **simulado** de 480 lotes: clasifica bien todos los ciclos cerrados. Sin número de corte,
en la simulación se pierde el 25 % de las renovaciones (las que repiten variedad; en datos reales depende de cuántas
lo hagan): por eso `siembra_id` y `corte` son obligatorios en el esquema.

**D39. Distancia al ingenio.** Recalculé la economía con costos por tonelada de US$10-60/t y de renovación de
US$1,500-4,500/ha. El costo por tonelada casi no cambia el ciclo óptimo (4 cortes hasta US$36/t), pero cada US$1/t
cuesta ~US$62-71/ha/año de margen. El costo de renovar sí lo mueve: 3 cortes si es barato, 5 si es caro. El testigo
deja de cubrir costos a ~US$36/t y las tres recomendadas aguantan hasta US$41-44/t (bisección).

**D40. Zonificación.** Distancia de Gower (altitud, lluvia, viento, grupo de suelo, drenaje) y agrupamiento
jerárquico promedio; el número de zonas se elige por silueta. Dejo fuera la distancia al ingenio: define costos, no
adaptación. Lo validé con lotes **simulados** a partir de los promedios públicos de CENGICAÑA: recupera los 4 perfiles
(ARI 0.90).

**D41. Tamaño de los ensayos con la variabilidad real de Louisiana** (`src/campo_ensayos.py`). Efectos fijos de
lote-año, variedad y caída propia por variedad, más REML sobre el residuo. Desvíos: variedad × finca 4.1 %, variedad ×
año 2.9 %, variedad × lote-año 7.7 %, error de parcela 15.4 % por repetición.
- Detectar 10 % con 80 % de potencia: 14 fincas con una cohorte (25 si la interacción es 1.5× y 49 si es el doble);
  con cohortes anuales y 6 años de cosecha, 10, 15 y 22 fincas.
- 5 % no se alcanza con ningún tamaño razonable, porque la interacción variedad × año pone un piso.
- Una repetición más casi no ayuda.
Recomendación: 20 fincas por cohorte (5 por estrato), con cohortes anuales. Con 6 años de cosecha detectan 10 % con
87 % de potencia si la interacción es 1.5 veces la de Louisiana y con 78 % si es el doble (22 fincas llegan a 80 %).
El tamaño se recalcula con la varianza propia al cerrar la primera cohorte.

### Hipótesis descartadas

**H10. "Más repeticiones dan ensayos más precisos."** Ayudan poco: el error de parcela se divide entre todas las fincas
y años; lo que no se promedia es la interacción variedad × ambiente. Con el mismo número de parcelas extra (+33 %,
desde 15 fincas × 3 repeticiones), sumar 5 fincas da +5.9 puntos de potencia y sumar una repetición +2.3 (2.6 veces
menos).

**H11. "La distancia cambia cuándo renovar."** Casi no, por el costo por tonelada. Lo cambia el costo de renovar, que
también puede subir con la distancia.

### Uso de IA

- **Qué hizo:** implementó el esquema SQL, la auditoría, la regla de reemplazo, la zonificación con Gower y el cálculo
  de potencia según mi diseño; armó los datos simulados para probar el código y redactó borradores del notebook.
- **Cómo lo verifiqué:** con datos simulados, con PostgreSQL real (5 pruebas aprobadas) y contra las cifras de las
  preguntas 1-3 (la economía métrica reproduce US$526.3/acre/año).
- **Errores de fondo de la IA que corregí:**
  1. La primera grilla de costos llegaba a US$40/t, y el "equilibrio" de las variedades recomendadas era ese tope, no
     un resultado. La amplié a US$60/t.
  2. El primer cálculo de potencia usaba "2 cohortes = 8 años", pero cohortes superpuestas no suman años de cosecha
     distintos. Lo reemplacé por 6 años de cosecha.
  3. El primer intento de componentes de varianza usaba el ambiente finca-año y dejaba la caída por variedad en el
     residuo (inflaba la interacción a 16.5 %). Lo corregí con lote-año y caída propia por variedad: 7.7 %.
  4. El equilibrio por distancia salía de una grilla de US$1/t y el notebook decía "desde ~US$35/t", cuando a US$35 el
     testigo todavía cubre costos. Ahora se calcula por bisección: testigo US$35.9/t; HOCP14-885 43.2, HOL15-508 43.6 y
     L15-306 41.3.
  5. "15-20 fincas por cohorte" solo llega a 80 % de potencia si la interacción no supera 1.5 veces la de Louisiana.
     Lo cambié a 20 fincas (5 por estrato) con la condición explícita (D41).
  6. El 25 % de renovaciones que se pierden sin número de corte se presentaba como un hecho general; sale de la
     simulación y depende de cuántas renovaciones repiten variedad.
  7. El primer texto de H10 decía "una finca más vale mucho más que una repetición más". Al comparar 1 finca contra 1
     repetición, la repetición sumaba más potencia (2.3 contra 1.5 puntos), porque agrega más parcelas. La comparación
     justa es a igual número de parcelas.
- **Correcciones menores (texto):** el costo por tonelada "no cambia" el ciclo óptimo pasó a "casi no" (cambia desde
  US$37/t); y el HTML decía "2.6 veces" junto a una calculadora que, con su valor inicial (×1.5), mostraba 3.6 (ahora
  el texto se calcula con los valores de la calculadora).

---

## Serie I · Cierre: revisión independiente de cifras

Al cerrar la Serie I pedí a un agente de IA separado, que no participó en el análisis, comparar cada cifra del README,
la bitácora, los notebooks 04-05, las instrucciones del proyecto y el HTML contra las salidas (notebooks, JSON y CSV). Encontró 7
diferencias de fondo y 5 menores; las corregí todas:
- "Error típico de 22 % por lote": la métrica es por parcela (una variedad en una finca y zafra).
- "15-20 fincas por cohorte": ver punto 5 de la pregunta 4.
- "La calidad viene con longevidad y estabilidad": calidad-estabilidad tiene r = 0.16, sin significancia. Ahora dice
  "la calidad viene con longevidad, y la longevidad con estabilidad".
- D33 omitía una asignación dudosa (L12-201, 58 %). H9 hablaba de "desvío" donde el 67 % es de la varianza.
- H10 citaba cifras de una versión anterior (1.9 contra 1.6 puntos); con el código actual, 2.3 contra 1.5.
- El 25 % simulado y el equilibrio por distancia: puntos 6 y 4 de la pregunta 4.
- Las instrucciones del proyecto decían que cada notebook verifica su JSON; el 02 no lo hacía. Agregué la verificación: el JSON de curvas
  reproduce el ciclo y el margen de las 23 variedades (diferencia máxima < 10⁻⁶).
- Menores: estabilidad de las nuevas medida con 2-4 años (no 3-4); "fibra comparable contra los testigos"; los perfiles
  simulados de zonificación se construyen *a partir de* los promedios de CENGICAÑA (dos combinan estratos vecinos).

No verificable desde el repo: las fuentes externas (citadas con enlace en el notebook 05). La prueba contra
PostgreSQL se volvió a correr y su salida quedó en `outputs/tests/pytest_postgres.txt` (5 pruebas aprobadas); se repite
con `CAMPO_PG_DSN=... pytest tests/`.

## Serie I · Corrida limpia en Windows

Antes del primer commit repetí la Serie I desde cero, con Claude Code, en un entorno nuevo (Windows 11, Python 3.12,
`requirements.txt`): notebooks 01→05, `docs/build_serie1_explicacion.py` y `pytest`. Primero en una copia del repo,
después en el repo mismo.

**Cifras de control: todas iguales.** Margen de referencia US$526.3/acre/año (02 y 05); JSON de curvas con diferencia 0
(02); 509 predicciones del JSON de P2 contra las tablas 2022 con diferencia máxima 0.69 lb/acre (467 lotes + 42 de
plantía; es la misma autoverificación que hace el HTML); 100 % de asignaciones (04); 1,143/1,143 ciclos (05). 20 de las 26
tablas y JSON son idénticos a la corrida original (Linux, Python 3.13), entre ellos todos los de las preguntas 1 y 4 y
las predicciones de P2.

**Diferencias entre sistemas operativos, sin efecto en conclusiones.**
- XGBoost: MAE escenario 1 1,496.6 → 1,498.3 lb/acre. Ridge − XGBoost: −10.2 lb/acre (IC90 −27.3 a 6.2), sigue sin
  ser significativa; en el error de la ventaja Ridge sigue ganando (IC90 −0.71 a −0.34 pp). Ridge, Random Forest y las
  referencias no cambian.
- Bootstrap de k-means (P3): ARI y Jaccard se mueven en la tercera decimal (Jaccard de "completas" 0.700 → 0.698).
  k = 5, ARI 0.62 y las 23 asignaciones no cambian.
- Causa: XGBoost y k-means usan hilos y rutinas numéricas que dependen del sistema. Dos corridas en Windows dan
  exactamente lo mismo.

**Errores que corregí.**
- En Windows, `Path.read_text()` y `write_text()` sin `encoding` usan cp1252, y el notebook 03 se caía al escribir
  "−" en un JSON. Agregué `encoding="utf-8"` en todas las lecturas y escrituras (notebooks 02-05 y la prueba SQL).
- El notebook 02 imprimía la ruta absoluta de la carpeta local; ahora imprime la ruta relativa al repo.
- Decidí publicar el repo: reemplacé el nombre del ingenio por "el ingenio" en notebooks, HTML y SQL.

La prueba del esquema contra PostgreSQL se omite sin `CAMPO_PG_DSN`; su última corrida sigue en
`outputs/tests/pytest_postgres.txt`.

---

## Serie II · Fábrica — Caldera (`notebooks/06` a `09`)

Contexto: caldera de lecho fluidizado circulante (CFB) a carbón de una planta química en Zhejiang, China (Cao et al.,
2025, *A long-tailed distribution time-series dataset in boiler equipment*, Springer Nature/figshare). Son 30
sensores cada 5 s durante 5 días (27/03 al 01/04/2022). El ingenio usa calderas de bagazo: traslado el método, no los
valores.

### Decisiones

**D42. Archivo base: `data.csv`.** `data_AutoReg.csv` es idéntico salvo 30 valores imputados del agua de atemperación
(`YJJWSLL`) en dos huecos. El relleno autorregresivo prolonga la tendencia: en el segundo hueco sigue en ~2 t/h y el
dato real siguiente es 3.9 t/h. Dejo los 30 faltantes como faltantes (0.03 % de un sensor).

**D43. Diccionario corregido con unidades inferidas** (`serie2_sensores.json`). `columns.csv` tiene estos problemas:
- el encabezado anuncia 3 columnas y cada fila trae 2;
- no tiene unidades;
- los nombres y el orden no coinciden con los datos;
- hay traducciones confusas: "Pot pressure" es el domo y `TV_8329ZC` es una válvula (%), no una temperatura.

Inferí las unidades de las magnitudes de una CFB típica de 75 t/h, 9.8 MPa y 540 °C. La de vibración (mm/s o µm) queda
sin confirmar.

**D44. Resolución de análisis ≥ 10 s.** El reloj es perfecto (86,400 filas a 5 s), señal de que el archivo fue
remuestreado. Cinco sensores cambian solo en filas pares, es decir, cada 10 s: `ZZQBCHLL` (el objetivo de la
pregunta 3), `ZCLCCY`, `YCLCCY`, `SXLTCYZ` y `SXLTCYY`. Los modelos usan promedios de 1 min.

**D45. Redundancia:**
- Las seis presiones de hogar forman dos familias (A-B-C y D-E-F; D, E y F con r ≥ 0.996) con desplazamientos fijos
  de hasta ~40 Pa. En los modelos entra su mediana; conservo los seis individuales para detectar fallas.
- Los pares izquierda-derecha coherentes (lecho, O₂, gases) entran promediados.
- **`SXLTCYZ` queda fuera de los modelos:** un diferencial de presión que copia la presión de hogar (r = 0.99, a
  ~12 Pa), mientras su gemelo derecho no se le parece (r = 0.14). Lo más probable es una toma inferior tapada o un tag
  mal asignado.
- **`YFJ3_ZD2` queda fuera de los modelos:** no se relaciona con nada (|r| ≤ 0.24) y su ruido es 4 veces el de su par
  ZD1, que sí sigue la carga del ventilador.

**D46. Los picos de la corriente del tiro inducido son físicos y los conservo.** Son ~70 por día, de ~5 A y una
muestra. La corriente sube cuando la presión del hogar está alta (−139 Pa contra −155 en promedio) y baja cuando está
baja (−200 Pa). Justo después, la presión cambia 2.7 veces más rápido que en un momento cualquiera. Es la respuesta del
control de tiro.

**D47. Regímenes (pregunta 2):**
- **Prueba de modos separados:** comparo la silueta de k-means contra una nube gaussiana con la misma correlación.
  Con k = 2 no la supera; con k ≥ 3 apenas (0.01-0.03).
- **Número de modos:** remuestreo bloques de 2 h (100 réplicas). La regla de la Serie I (el más reproducible entre
  3 y 6, sin modos menores al 5 %) da **k = 3**: tres zonas de carga, ARI 0.71.
- **Eje de operación a igual carga:** residuos contra la carga y su primer componente.
  - Los minutos con más O₂ y más atemperación tienen el vapor ~7 °C más frío. Es descriptivo y en parte sale por
    construcción, porque la temperatura del vapor pesa en el eje.
  - En cambios de 1 min, la atemperación enfría el vapor ~5 min después (r = −0.39).
  - El efecto propio del O₂ en niveles no se distingue de cero.
- **Ciclo del lecho:** 17 ciclos de llenado (~5.4 h; de 2.6 a 9.7 h) y descarga (~1.5 h).

**D48. Sensor virtual (pregunta 3):**
- **Datos y validación:** promedios de 1 min. Validación hacia adelante por día (4 pliegues), con 30 min de
  separación entre entrenamiento y prueba. Nunca uso el propio vapor rezagado: el sensor virtual tiene que funcionar
  cuando el medidor falla.
- **Elegido: Ridge completo** (MAE 0.18 t/h, 0.30 %, R² 0.99). Le gana al modelo hidráulico de una variable,
  Q = a + b·√(ΔP·ρ) (0.33 t/h), y al gradient boosting (0.28 t/h); ambas diferencias son significativas por bootstrap
  de bloques de 1 h.
- **Modelo físico de dos variables** (presión y agua de atemperación, coeficiente ≈ 1.2): 0.23 t/h.
- **Respaldo sin presiones de vapor:** 0.69 t/h.

**D49. El aire de retorno entra como total, no como izquierda y derecha.** Tras la redistribución del 30/03 cada lado
por separado cambia de significado. El total se conserva (1,324 → 1,315 Nm³/h).

**D50. Anomalías (pregunta 4), en tres capas:**
- **Siete reglas físicas** con persistencia, cada 5 s.
- **Verificación de sensores** por pares y por física, con z robusto. El umbral de cada chequeo es el menor de
  5/6/7/8/10 que no alarma en los 2 días de referencia; persistencia de 5 min y apagado tras 15.
- **Monitor de proceso:** PCA reentrenada cada hora con las últimas 24 h, con T² y SPE al percentil 99.9. Los minutos
  en alarma no entran a la referencia siguiente.
- **Confirmación del operador:** un cambio deliberado confirmado, como la redistribución del aire de retorno, pausa
  su chequeo 2 h y lo recentra con la mediana de esas 2 h.
- **Varias presiones a la vez:** si saltan dos o más chequeos de presión de hogar al mismo tiempo, es un evento del
  hogar, no varios sensores dañados.
- **Sensor congelado:** se detecta solo con el pasado (muestras repetidas hasta ese momento), en ~1 min.

**D51. Diagnóstico de sensor contra equipo.** Si salta un chequeo de verificación (o un sensor congelado), es sensor.
Si no, y salta el monitor o una regla, es proceso o equipo. Lo probé con 5 fallas inyectadas (4 de sensor y 1 de
equipo, esta última con efectos físicamente coherentes): 5 de 5 bien clasificadas.

**D52. Eficiencia (pregunta 5):**
- **Supuestos explícitos** en `SupuestosCaldera`, con tablas de vapor IAPWS-97.
- **Limpieza de superficies:** la temperatura de gases hace un serrucho de ~8 h con caídas de ~14 °C, y su base sube
  ~2 °C/día.
  - El serrucho es compatible con ensuciamiento y soplado, pero sus picos siguen ~1.6 h al inicio de las descargas
    del lecho (p ≈ 0.01). Sin registro de soplados, la causa es hipótesis.
  - Si es ensuciamiento, recuperar la deriva vale 0.1-0.3 puntos de eficiencia, unos US$10-23 mil al año. Solo varié
    la fracción del calor que llega a la chimenea (±40 %).
- **Exceso de aire:** menos de 0.1 punto.
- **Temperatura del vapor:** su valor está en la turbina; no se puede cuantificar con estos datos.

### Hipótesis descartadas

**H12. "`data_AutoReg.csv` es una versión mejorada de los datos."** No: inventa 30 valores y falla justo en el escalón.

**H13. "Los picos de 1 muestra en la corriente del tiro son errores de transmisión."** No: son la respuesta del
control de tiro a golpes de presión (D46).

**H14. "La caldera tiene modos de operación discretos."** No en estos 5 días. Hay un continuo dominado por la carga
(un componente explica el 46 %) y un solo ciclo discreto, el del lecho.

**H15. "Un modelo no lineal estima mejor el vapor."** No: el gradient boosting recibe la misma variable física y queda
0.1 t/h peor que el Ridge. La relación es lineal en la variable física correcta.

**H16. "Una validación cruzada al azar sirve para series de tiempo."** No: subestima el error entre 17 % y 51 %. El
boosting es el más engañado.

**H17. "Bajar el exceso de aire es la gran oportunidad."** No en esta caldera: ya opera con ~2.1 % de O₂ y el ahorro
es menor a 0.1 punto. En calderas de bagazo, con más exceso de aire, sí puede serlo.

### Hallazgos para la Gerencia Industrial

- **La caída de presión del sobrecalentador ya es un medidor de flujo:** con ella sola el vapor se estima con 0.5 % de
  error.
- **La redundancia de sensores permite separar un sensor dañado de un problema real.** Donde hay un solo sensor
  crítico, esa distinción no existe.
- **La atemperación pasó 12 h fija** (17 tramos de 30 min o más) y el vapor estuvo 27 % del tiempo bajo 535 °C.
- **Una deriva del medidor de vapor se detecta desde ~1.3 t/h sostenida (~2 %);** en la prueba, a las 1.7 h con
  ~0.9 t/h.
- **El lecho se descarga cada ~7 h sin afectar la producción.** Los picos de temperatura de gases ocurren ~1.6 h
  después de iniciar la descarga (p ≈ 0.01): o la limpieza va en la misma rutina del turno, o el ciclo del lecho
  mueve la temperatura de gases.

### Uso de IA

- **Qué hizo:** implementó la auditoría de sensores, las pruebas de regímenes, el sensor virtual, las tres capas de
  anomalías con inyección de fallas y el cálculo de eficiencia con IAPWS-97 según mi diseño, y redactó borradores de
  los notebooks y del HTML.
- **Cómo lo verifiqué:** comparé cada cifra del texto contra la salida de los notebooks. Los JSON se verifican solos
  (07: 100 % de los modos; 08: Ridge con diferencia 0 en 7,182 minutos).
- **Errores de fondo de la IA que corregí:**
  1. El primer plan trataba los picos de corriente del tiro como errores y los reemplazaba por la mediana. Al mirar la
     presión del hogar alrededor de cada pico apareció la respuesta del control. Los conservo (D46).
  2. El primer filtro de picos (Hampel con desvío local) marcaba miles de puntos en sensores cuantizados, donde el
     desvío local vale 0. Lo cambié a desvío global del residuo y solo eventos de 1-2 muestras.
  3. La importancia por variable del modelo de combustión ponía primero al aire de retorno izquierdo y derecho. Era un
     artefacto del par en espejo tras la redistribución: quitar los dos no costaba nada. Uso el total (D49), y la
     importancia se mide por mecanismo físico.
  4. Los coeficientes por rezago del Ridge eran ilegibles por colinealidad. Los reemplacé por una ablación de rezagos:
     1-2 min bajan el error en ~0.08 t/h, y más atrás no agrega.
  5. La primera comparación con gradient boosting no le daba la variable física, que un árbol no puede formar
     restando dos columnas. Se la di para que la comparación fuera justa; igual pierde.
  6. Una PCA fija entrenada con 36 h ponía en alarma el 75 % de los días 3-5, por la deriva de temperaturas y la
     redistribución. La pasé a ventana móvil de 24 h.
  7. Con umbral único de 8 desvíos no se detectaban una deriva del 3 % en el vapor ni un sesgo de 0.6 puntos en el
     O₂. Fijé un umbral por chequeo con la referencia y publico la falla mínima detectable de cada uno.
  8. El escenario de equipo no lo detectaba el T²: la ventana móvil lo absorbía. Agregué el SPE, excluí de la
     referencia los minutos en alarma y agregué la regla de O₂ alto.
  9. Dos escenarios de prueba coincidían con alarmas naturales del monitor, lo que daba detecciones por casualidad. Los
     moví a ventanas sin alarmas naturales.
  10. Una exploración previa, con otras semillas, daba k = 4 (ARI 0.67) por encima de k = 3 (0.63). Con las semillas
      fijas del notebook, k = 3 gana con 60 o con 100 réplicas (0.71-0.72 contra 0.63-0.67); la diferencia está
      dentro del ruido del bootstrap. Por eso moví el hallazgo del modo ineficiente a un análisis de residuos que no
      depende de k.
  11. La deriva de gases se presentó primero como tendencia lineal. El gráfico por hora mostró un serrucho de
      limpieza; reescribí la oportunidad.
- **Correcciones menores (redondeo):** "tres veces más rápido" (era 2.7), "el triple de ruido" (era 4.3 veces) y
  08:51 en la redistribución (fue ~08:53).

**Revisión independiente de cifras (Serie II).** Pedí a un agente de IA separado comparar cada cifra de los notebooks,
el README y esta bitácora contra las salidas. Encontró 9 diferencias de fondo y 16 menores; las corregí todas. Las de
fondo:
- **El "eje de operación" se presentaba como efecto.** Los ~7 °C entre tercios son descriptivos y en parte salen por
  construcción. El rezago de la atemperación se había medido sobre niveles autocorrelacionados (r = −0.71 a 6 min);
  en cambios de 1 min da r = −0.39 a 5 min. El efecto propio del O₂ en niveles no se distingue de cero.
- **El detector de congelado miraba hacia adelante:** asignaba a cada muestra el largo total de su tramo. Ahora cuenta
  solo hacia atrás y detecta en ~1 min.
- **La confirmación del operador usaba las 2 h posteriores al evento desde el minuto 10.** Ahora el chequeo se pausa
  esas 2 h y se recentra después.
- **Una alarma en tres presiones de hogar a la vez se leía como "sensores individuales".** Por el propio criterio es
  un evento del hogar, y ahora así se clasifica.
- **El serrucho de gases se presentaba como "firma del ensuciamiento"** sin registro de soplados, y con el ciclo del
  lecho como explicación alternativa. Ahora es hipótesis.
- **Afirmaciones sin respaldo:**
  - "Una validación al azar habría elegido el modelo equivocado": el orden no cambia; lo que cambia es el error
    prometido.
  - "Detecta derivas de ~1 % en horas": la sensibilidad es ~1.3 t/h (~2 %).
  - "Intercepto cercano a cero": es −4.9 t/h; la recta vale en el rango observado.
  - "Supuestos ±50 %": solo se varió la fracción a chimenea, ±40 %.
  - "Las alertas por zona se prueban en la pregunta 4": no se probaron.

### Integración al repo y corrida en Windows

Trabajé la Serie II en una sesión aparte y la integré al repo con Claude Code. Corrí los notebooks 06→09 y
`docs/build_serie2_explicacion.py` desde cero en Windows (Python 3.12, `requirements.txt`):
- Las 15 tablas y JSON salen idénticos a la corrida original (solo los coeficientes del Ridge difieren en la octava
  cifra significativa, por redondeo) y se regeneran las 15 figuras.
- Los JSON se verifican solos: 100 % de los modos (07) y Ridge con diferencia 0 en 7,182 minutos (08).

**Errores que corregí al integrar:**
- Las lecturas y escrituras de JSON no indicaban `encoding="utf-8"`; en Windows fallan, igual que en la Serie I. Lo
  agregué en los notebooks 06-09.
- Los notebooks buscaban los datos en `data/raw/`; los moví a `data/raw/serie2/` para que no se mezclen con los de
  otras series (`data.csv` es un nombre muy genérico).

---

## Serie III · Mercado — Producción mundial y precio del azúcar (`notebooks/10` a `13`)

Contexto:
- **FAOSTAT**, *Production: Crops and livestock products*, cultivo *Sugar cane* (código 156), 1961-2023, con banderas
  por dato.
- **`Sugar_data.csv`:** futuro de azúcar No. 11 (ICE), contrato más próximo de Yahoo Finance (`SB=F`), diario de marzo
  de 2000 a junio de 2024, en ¢/lb.

Ningún modelo usa datos fuera de los de la prueba. Las fuentes públicas citadas (ICE, Banco Mundial, FMI, USDA, prensa
financiera) solo sirven para verificar.

### Decisiones

**D53. FAOSTAT: archivo completo y panel limpio.**
- El archivo sin banderas trae exactamente los mismos valores; uso el completo por las banderas.
- Las unidades son únicas (ha, t y kg/ha, sin hg/ha), y el rendimiento es producción / área: difiere más de 1 % solo
  en países de menos de 1,000 ha.
- Ajustes del panel:
  - quito los agregados (código ≥ 5000) y la fila "China", que es la suma de China continental y Taiwán;
  - encadeno Etiopía PDR → Etiopía y Sudán (anterior) → Sudán (Sudán del Sur no reporta caña);
  - recalculo el rendimiento en t/ha.

**D54. Datos poco confiables (pregunta 1).** Cinco alertas por país:
- % no oficial;
- % imputado;
- años seguidos con el mismo rendimiento;
- saltos de más de 50 %;
- variación casi nula.

Lo que encuentran:
- Liberia repite el mismo rendimiento 33 años y Ghana 11; Guinea y Papúa Nueva Guinea no tienen ni un dato oficial de
  producción.
- Reunión, Guadalupe, Martinica y Guayana Francesa desaparecen en 2006 sin cerrar su industria: es un hueco de reporte.
  Puerto Rico, San Cristóbal y Nieves y Trinidad y Tobago sí cerraron.
- **La imputación crece en los años recientes:** los datos oficiales de producción del panel pasan de 73 % en
  1961-2009 a 45 % en 2023.
- **Guatemala:**
  - 1977-1985: producción estimada en cifras redondas.
  - 2014-2016: producción de ~33.5 millones de t. El USDA da ~28 millones para 2016/17 (270 mil ha × 104 t/ha).
  - 2019-2023: área imputada. El USDA reporta 251-258 mil ha en 2020/21-2022/23, contra 224 mil de FAOSTAT en
    2021-2022.

**D55. Segmentación por trayectoria, no por tamaño (pregunta 1).**
- **Panel:** 71 países con producción desde 1976 o antes hasta 2023 (≥ 45 años) y al menos 5,000 ha en 2014-2023.
- **Seis descriptores:**
  - crecimiento del área y del rendimiento (pendiente Theil-Sen del log);
  - rendimiento 2014-2023 frente a la mediana;
  - cambio de ritmo después de 1991 en área y en rendimiento;
  - inestabilidad del rendimiento.
  La producción es la suma de los dos crecimientos y no la agrego aparte.
- **Escala robusta:** mediana e IQR, recortada a ±3.

**D56. Grupos probados contra el azar (misma regla de las Series I y II).**
- **Contra un nulo gaussiano con la misma covarianza:** k-means apenas lo supera con k = 3-5 (p de 0.015 a 0.09), y con
  k = 2 y 6 no lo supera.
- **Estabilidad al remuestrear países:** ARI ~0.5.
- **Elección:** la regla "el k más reproducible entre 3 y 6, sin grupos menores al 5 %" da **k = 3**, que uso como
  tipología. Los nombres se asignan por regla: expansión, madurez o estancamiento, y rendimiento muy bajo o datos
  dudosos. Ward da una partición parecida (ARI 0.75).

**D57. Pares de Guatemala con dos métodos independientes.**
- **Los dos métodos:** cercanía en los descriptores y distancia entre trayectorias por bloques de 5 años (área relativa
  a su nivel actual y rendimiento).
- **Regla:** un par es real si queda entre los 10 más cercanos en los dos. Resultado: **El Salvador, Eswatini, Brasil,
  Nicaragua y Egipto**.
- **Robustez:** se mantienen los cinco al quitar los 21 países con datos dudosos.

**D58. El precio pega contratos: serie ajustada (pregunta 2).**
- **Cuándo cambia de contrato:** el No. 11 vence el último día hábil de febrero, abril, junio y septiembre (ICE).
- **Prueba:**
  - el día siguiente al vencimiento, el precio se mueve 4.4 % contra 1.5 % en un día normal, y 3.9 puntos de eso son
    la brecha nocturna;
  - esos 97 días aportan 11 de los 25 movimientos más grandes;
  - las 11 filas con OHLC imposible caen todas en días de vencimiento.
- **Ajuste:** el día del cambio uso el movimiento de apertura a cierre del contrato nuevo. Solo con eso, la curtosis
  baja de 6.0 a 2.9.
- **Exclusiones:** excluyo los dos días de vencimiento con volumen cero (28/04/2000, −18 %, y 30/06/2000, −8 %). Con
  todo, la curtosis queda en 1.9 y el retorno acumulado pasa de ×3.8 a ×2.6.
- **Uso:** el nivel crudo es la referencia de precio; la serie ajustada, para volatilidad, extremos y errores.

**D59. Regímenes (pregunta 2).**
- **Volatilidad:** Markov sobre retornos semanales; el BIC elige 2 regímenes sobre 1 y 3. Calma: 3.5 % semanal, 76 %
  del tiempo. Turbulencia: 5.9 % semanal, 24 % del tiempo.
- **Nivel:** comparo los giros de 20 % (34) contra un paseo aleatorio con la misma volatilidad (31-47). Los ciclos de
  nivel no se distinguen del azar.

**D60. Verificación contra el mercado real.**
- **Extremos:** el máximo de 2011 (36.08), el mínimo de 2020 (9.05) y el máximo de 2023 (28.14) coinciden al centavo y
  al día con fuentes públicas.
- **Promedios anuales:** difieren entre −1.1 % y +3.2 % contra el FMI, y hasta +4.1 % contra el Banco Mundial (2011).
- **Calendario:** el hueco del 11-17/09/2001 coincide con el cierre de la bolsa.
- **Choques comunes:** coinciden con café, cacao y algodón en 2008 y 2020.

**D61. Pronóstico (pregunta 3).**
- **Objetivo:** el promedio mensual del contrato más próximo a 1 y 3 meses.
- **Validación:** origen rodante desde 12/2008, entrenando solo con pares ya realizados (t' + h ≤ t).
- **Baseline:** el **último cierre**, no el promedio del mes. Promediar crea autocorrelación artificial (0.28 contra
  0.08 en cierres).
- **Criterio:** bootstrap de bloques de 12 meses y Diebold-Mariano.
- **Bandas:** cuantiles de errores pasados realizados, en unidades de volatilidad de 3 meses × √h.

**D62. Respuesta de la oferta (pregunta 4).**
- **Panel:** países de 2000 a 2023 en diferencias de log, con efectos fijos por país y precios rezagados de 1 a 3 años.
- **Placebos:** el precio del mismo año y del siguiente.
- **Inercia:** versión ARDL con los dos rezagos del propio crecimiento.
- **Errores:** agrupados por año y Driscoll-Kraay.
- **Prueba de permutación de los años del precio:** es la prueba principal, porque el precio es común a todos los
  países y solo hay 20 años.
- **Robustez:**
  - solo datos oficiales;
  - sin Brasil, India, China y Tailandia;
  - ponderado por área;
  - agregado mundial;
  - quitando un año a la vez.

### Hipótesis descartadas

**H18. "Hay tipos de países productores bien separados."** No: los grupos apenas superan a datos sin grupos. Son una
tipología útil, no una clasificación natural.

**H19. "Los pares de Guatemala son los productores de su tamaño (Colombia, México)."** No: por trayectoria, sus pares
son El Salvador, Eswatini, Brasil, Nicaragua y Egipto. Colombia y Perú ya tenían su área en los 60, y México no tiene
el rendimiento.

**H20. "La serie de precio es una serie continua del mercado."** No: pega contratos. Sin ajuste, la mitad de las colas
pesadas son cambios de contrato.

**H21. "El precio del azúcar tiene ciclos que se pueden anticipar."** No: los giros de 20 % no se distinguen de un
paseo aleatorio, y a 1 y 3 meses nada le gana al último cierre.

**H22. "Un ARIMA pronostica mejor que el ingenuo."** Solo contra el ingenuo equivocado (el promedio del mes). Contra el
último cierre es 28 % peor a 1 mes.

**H23. "La cosecha de Brasil sirve como instrumento para la causalidad precio → oferta."** No con datos anuales: la
primera etapa tiene F = 0.2.

**H24. "El área no responde al precio."** Hay una asociación robusta con el precio de 2-3 años antes, pequeña
(elasticidad acumulada de ~0.08). La evidencia causal es débil:
- la permutación da p = 0.05-0.08 a una cola, y 0.11 con 4 rezagos;
- el placebo del año siguiente falla en algunas muestras (la oferta también mueve el precio);
- la versión ponderada (~0.17, p = 0.01) es exploratoria.

### Hallazgos para la Gerencia General y Comercial

- **Guatemala combina expansión de área y rendimiento de punta:** solo 4 de 71 países están en el cuartil superior de
  los dos. Como el área ya se frenó, el crecimiento futuro depende del rendimiento y de la calidad de la caña.
- **FAOSTAT no sirve para Guatemala en 2014-2023 sin contraste:** la producción de 2014-2016 está inflada y el área de
  2019-2023 es imputada.
- **El riesgo de precio cambia de régimen:** en turbulencia, una semana de ±10 % pasa 1 de cada 11 semanas; en calma,
  1 de cada 261.
- **La forma de la curva es un indicador comercial:** el contrato próximo cotizó por encima del siguiente en
  2001-2002, 2010-2011 y 2021-2024.
- **El precio no se puede adivinar, pero su rango sí:** con la volatilidad de mayo de 2024, la banda 80 % va de −6 % a
  +7 % a 1 mes y de −14 % a +17 % a 3 meses. Cada ¢/lb equivale a US$22 por tonelada.
- **La oferta mundial se asocia con el precio de 2-3 años antes:** no conviene expandir área por un precio alto de
  hoy.

### Uso de IA

- **Qué hizo:** implementó según mi diseño la auditoría de FAOSTAT, los descriptores de trayectoria con dos métodos de
  pares, la detección y el ajuste del cambio de contrato, el Markov de volatilidad, los giros de 20 % contra un paseo
  aleatorio, el pronóstico con origen rodante y bandas según volatilidad, y el panel de oferta con prueba de
  permutación. También redactó borradores de los notebooks y del HTML.
- **Cómo lo verifiqué:** comparé cada cifra del texto contra la salida de los notebooks, y los eventos y promedios,
  contra fuentes públicas.
- **Errores de fondo de la IA que corregí:**
  1. La IA dio primero como pares de Guatemala a "El Salvador, Nicaragua, Eswatini, Malaui y Zambia", a partir de una
     exploración. Con la regla formal (top 10 en ambos métodos), Malaui y Zambia salen en uno solo y sus datos son
     mayoritariamente no oficiales; los pares son El Salvador, Eswatini, Brasil, Nicaragua y Egipto.
  2. La primera exploración del pronóstico comparaba el AR(1) contra el promedio del mes y parecía ganarle. El baseline
     correcto es el último cierre, contra el que pierde (D61, H22).
  3. El texto de las bandas afirmaba que la banda fija cubría menos en turbulencia. En el período evaluado solo hay 6
     meses turbulentos de 149, así que esa comparación no se puede hacer; la retiré.
  4. En la oferta se afirmó primero que los placebos "dan cero". Con el precio cortado en 2023 (sin el 2024 parcial),
     el precio del año siguiente se asocia negativamente con el área (−0.02). La revisión independiente marcó además
     que varios textos seguían diciendo "pasa placebos" (ver abajo).
  5. Los errores agrupados por año daban t = 3.1 para la respuesta del área. Con solo 20 años de precio, la prueba de
     permutación da p = 0.05 a una cola. Presento la permutación como prueba principal.
  6. En la figura de oferta agregada, los ceros de los dos ejes no coincidían, lo que exageraba la relación. Los
     alineé.
- **Correcciones menores (cifras):** "tres de cada cuatro" datos de producción oficiales (son 66 % en todo el archivo
  y 45 % en 2023); 0.09 → 0.08 en la autocorrelación de cierres; 31-48 → 31-47 en el rango del paseo aleatorio; y
  10-13 % → 12-15 % en la diferencia de área con el USDA.

**Revisión independiente de cifras (Serie III).** Pedí a un agente de IA separado comparar cada cifra de los
notebooks contra sus salidas y revisar el código de pronóstico en busca de fuga de información. Confirmó que no hay
fuga: entrenamiento, bandas y predictores usan solo información disponible en cada origen. Encontró 1 problema de
fondo, 5 medios y varios menores; los corregí todos.
- **Los placebos fallan (fondo).** El texto decía que el placebo "pasa". El precio del año siguiente se asocia
  negativamente con el área (−0.02, p = 0.01) y con la producción. Si la oferta mueve el precio y el área tiene
  inercia, los rezagos podrían recoger esa historia.
  - Agregué un modelo ARDL con los rezagos del propio crecimiento: la respuesta a 2-3 años se mantiene.
  - El placebo deja de ser significativo con 19 años de muestra (−0.013, p = 0.19), pero no con 18.
  - La conclusión pasó de "consistente con una respuesta causal" a "asociación rezagada robusta, evidencia causal
    débil".
- **Certeza sobre la causalidad inversa:** la asociación entre la producción y el precio del mismo año bajó de certeza
  alta a media. Se apoya en errores agrupados de 20 años y también es compatible con causas comunes.
- **Contradicción con las preguntas 2 y 3:** la oferta "explicaba la forma del ciclo" y se recomendaba "esperar más
  competencia". Eso implica una reversión del precio que las preguntas 2 y 3 descartan. La reescribí como rezago de la
  expansión de competidores, no como pronóstico del precio.
- **Especificación elegida después de ver resultados:** la versión ponderada por área (p = 0.01) se presentaba como
  confirmación. Ahora es exploratoria (Brasil e India pesan 55 %). Agregué la sensibilidad con 4 rezagos (p = 0.11).
- **Colas pesadas:** "90 veces" usaba una escala robusta. Con la desviación estándar de la muestra, que es la que usaría
  un modelo normal, son ~36 veces.
- **Artefacto que seguía en la serie ajustada:** el −18 % del 28/04/2000, declarado artefacto, seguía ahí, junto con el
  30/06/2000. Excluí los dos (vencimientos con volumen cero). Cambiaron la curtosis (2.9 → 1.9), el acumulado
  (×2.0 → ×2.6) y los regímenes (turbulencia 6.2 % → 5.9 % semanal; 22 % → 24 % del tiempo).
- **Menores:**
  - la cobertura de las bandas por régimen se presentaba como resultado firme, con solo 8 meses turbulentos;
  - la limitación de "el objetivo mezcla contratos" era falsa. El desajuste real es entre el último cierre (contrato que
    vence) y el mes objetivo: 0.89 contra 0.82 ¢/lb;
  - "no se puede mejorar" pasó a "ninguno de los modelos probados lo mejora";
  - una cita de Bloomberg no se pudo verificar y se quitó;
  - corregí rangos (5-11 ¢/lb en 2000-2004; diferencias de hasta 4.1 % con el Banco Mundial; 21 puntos en la
    correlación agregada);
  - Eswatini no mejoró su rendimiento;
  - la silueta con k = 3 no supera el percentil 95 del nulo;
  - maticé la comparación con el USDA porque las zafras no coinciden con el año de FAOSTAT.
- **Un error propio detectado al corregir:** al agregar los rezagos propios al modelo, la "elasticidad acumulada"
  sumaba también esos coeficientes. Lo corregí antes de reportar.
- **Un error de etiquetado:** el último día de la serie (24/06/2024, mes incompleto) se marcaba como vencimiento. Lo
  corregí.

### Integración al repo y corrida en Windows

Trabajé la Serie III en una sesión aparte y la integré al repo con Claude Code. Corrí los notebooks 10→13 y
`docs/build_serie3_explicacion.py` desde cero en Windows (Python 3.12, `requirements.txt`):
- 11 de las 12 tablas y JSON salen idénticos a la corrida original y se regeneran las 12 figuras.
- El resumen de la pregunta 2 difiere solo en la tercera o cuarta cifra significativa del Markov (por ejemplo, la
  duración esperada de la calma da 59.518, 59.515 o 59.512 semanas según la corrida). El modelo ya usa semilla fija;
  la variación viene del optimizador numérico y del álgebra lineal con varios hilos, y aparece incluso entre dos
  corridas en la misma máquina. Ninguna cifra citada cambia: el BIC sigue eligiendo 2 regímenes, y una semana de
  ±10 % sigue pasando 1 de cada 11 semanas en turbulencia y 1 de cada 261 en calma.
- Esta serie ya leía y escribía todo con `encoding="utf-8"`. Solo moví los datos a `data/raw/serie3/` para que no se
  mezclen con los de otras series.

---

## Serie IV · API en producción (`api/`, `docs/api.md`)

**D63. La API lee los artefactos JSON; no re-entrena ni usa pickles.** Al arrancar carga `serie1_curvas.json`,
`serie1_modelo_p2.json` y `serie1_segmentos.json`, y calcula con los mismos módulos de `src/` que los notebooks. Así
sus respuestas son las cifras de los notebooks y no necesita los datasets.
*Descartado:* pickles de scikit-learn (dependen de la versión exacta y no se pueden leer) y re-entrenar al arrancar
(obligaría a llevar los datasets a la imagen).

**D64. Endpoints por pregunta.** `GET /campo/variedades` y `POST /campo/ciclo` (P1), `POST /campo/pronostico` (P2),
`POST /campo/segmento` (P3), `POST /campo/auditoria` y `/campo/auditoria/csv` (P4), más `GET /salud`. Cada respuesta
trae lo necesario para decidir, no solo el número: ciclo óptimo con el margen de cada ciclo posible, pronóstico con
banda y desglose, grupo con el segundo más cercano, auditoría con decisión por lote.

**D65. Validación de entradas con rangos plausibles** (pydantic): precio US$0.05-1.00/lb, corte 0-4, TCH 0-400 t/ha,
etc. Los errores devuelven 422 con un mensaje en español que dice qué corregir. Una variedad sin historia en etapa 5 se
rechaza: predecirla como si fuera un testigo promedio daría una cifra sin respaldo (es el escenario 3, pendiente).

**D66. Segmento con entradas en %**, como la tabla del notebook 04 (más fácil de llenar que logaritmos); la API las
pasa a logaritmo. Con los valores redondeados de la tabla se reproducen las 23 asignaciones; la menor diferencia entre
el centro más cercano y el segundo es 0.54 desviaciones, así que el redondeo no cambia ninguna. Como no hay grupos
naturales (D31), la respuesta incluye el segundo grupo y las distancias.

**D67. Pronóstico con la cobertura real de la banda** (74 % en escenario 1, 71 % en escenario 2), no el 80 % nominal
(D27). La respuesta da lb/acre y t/ha.

**D68. Auditoría desde JSON o CSV.** El CSV se valida fila por fila con el mismo esquema que el JSON. El óptimo es el
del testigo con los supuestos en unidades métricas (4 cortes), igual que el notebook 05. Sin la columna `corte` la API
responde, pero avisa (`corte_registrado: false`).

**D69. Docker.** Una sola imagen (`python:3.12-slim`, dependencias en `api/requirements.txt`) corre la API y las
pruebas; no lleva datasets, notebooks ni PDF. `docker compose up --build` levanta la API; el perfil `pruebas` agrega un
PostgreSQL 16 temporal (en memoria, sin puertos expuestos) para correr también la prueba del esquema SQL. La imagen lee
`PORT`, así que sirve igual en Cloud Run. `CORS_ORIGINS` limita qué sitios pueden consultarla.
La prueba del esquema ahora crea un esquema temporal y lo borra, para poder repetirla en la misma base.
*Verificación:* `docker compose up --build` levanta la API sana (healthcheck) y responde en `/docs`; dentro de Docker
pasan las 52 pruebas (47 de la API y 5 del esquema contra PostgreSQL 16), también al repetirlas sobre la misma base
(`outputs/tests/pytest_docker.txt`). La imagen pesa 448 MB y corre con un usuario sin privilegios.

**D70. Pruebas de la API** (`tests/test_api.py`): reproducen las cifras de control de la Serie I (US$526.3/acre/año;
ciclo, margen, ganancia y precio de equilibrio de las 23 variedades; 509 predicciones de 2022 con diferencia ≤ 1 lb/acre;
100 % de asignaciones; 1,143/1,143 ciclos y auditoría igual a pandas; CSV igual a JSON), las cifras de los ejemplos de
`docs/api.md` y que las entradas inválidas devuelvan 422.

**D71. La API suma la caldera y el mercado** (versión 1.1.0): `GET /caldera/sensores`, `POST /caldera/modo`,
`POST /caldera/vapor-virtual`, `POST /caldera/verificar` y `GET /mercado/pronostico`. Elegí lo que una persona de
planta o de comercialización consultaría en el momento. Dejé fuera el monitor PCA del notebook 09, porque necesita 24 h
de historia y se reentrena cada hora (en producción sería un servicio programado), y el detector de sensor congelado,
que trabaja con muestras de 5 s.

**D72. La API de la caldera no guarda estado.** Recibe promedios de 1 min, como los notebooks, y quien la llama manda
la ventana que hace falta: al menos 10 minutos para el vapor (el Ridge usa rezagos de 1, 2 y 5 min y la media de
10 min) y 5 o más para que la verificación aplique la persistencia. Los campos son los tags de la caldera y las
variables derivadas del notebook 08 (`presion_hogar`, `lecho`, `o2`, `t_gases`, `retorno_total`); la caída de presión
`raiz_dp_rho` la calcula la API. El sensor virtual nunca usa el vapor medido: si llega, solo se compara.

**D73. Muestras para las pruebas exportadas por los notebooks 07 y 08.** Sin los datasets no se puede probar contra
datos reales, así que cada notebook guarda una muestra junto a su JSON: las 1,441 ventanas de 5 min con su modo y las
últimas 3 h en promedios de 1 min con la predicción del Ridge final y los sensores crudos de la verificación. Son
promedios, como las demás tablas de `outputs/`. Al volver a correr el notebook 07, `serie2_modos.json` cambió solo en
la cifra 16 (ruido de punto flotante): conservé la versión ya versionada.

**D74. Verificación igual que el notebook 09.** Los 12 chequeos usan el centro, la escala robusta y el umbral de
`serie2_verificacion.json`. Un chequeo alarma con 5 minutos seguidos fuera de umbral; si solo alarman dos o más
presiones de hogar, es un evento del hogar. Por defecto uso el centro del aire de retorno después de la
redistribución confirmada del 30/03, que es la operación vigente.

**D75. Pronóstico del precio:** centro = último cierre y banda = exp(log(cierre) + z · vol_3m · √h), con los
cuantiles de `serie3_pronostico.json`. Si se mandan toneladas, devuelve el rango de ingreso (1 ¢/lb = US$22.05/t). El
JSON es del 31/05/2024; actualizarlo pide volver a correr el notebook 12.

**D76. Pruebas de caldera y mercado** (`tests/test_api_caldera_mercado.py`): el 100 % de las 1,441 ventanas de modo;
el Ridge final en 171 minutos (≤ 0.006 t/h, por redondeo de la salida); el z de los 12 chequeos igual al de
`src/fabrica_anomalias` en 180 minutos; fallas inyectadas (una presión desplazada alarma solo con 5 minutos seguidos,
tres presiones a la vez son un evento del hogar, una deriva de 3 t/h la señala el chequeo de vapor); las bandas del
notebook 12 (≤ 0.02 ¢/lb); y las cifras de los ejemplos de `docs/api.md`. Para que la comparación con
`src/fabrica_anomalias` corra también en Docker, la imagen suma scikit-learn: pasa de 448 a 723 MB. Dentro de Docker
pasan las 67 pruebas (62 de la API y 5 del esquema SQL).

### Uso de IA

- **Qué hizo:** escribió el código de la API, las pruebas, el Docker y la documentación según mi diseño de endpoints
  y respuestas.
- **Cómo lo verifiqué:** con las pruebas automáticas contra las cifras de control de los notebooks, y comparando cada
  ejemplo de `docs/api.md` con una llamada real.
- **Errores de fondo de la IA que corregí:**
  1. La primera versión de la prueba de las 509 predicciones mandaba la ventaja del lote como `NaN` en los 8 lotes que
     no la tienen, y fallaba. Ahora se manda como "sin dato", igual que la calculadora del HTML.
- **Correcciones menores:** las decisiones de la auditoría salían con 10 decimales (ahora 2); Docker Compose tomaba
  el nombre del proyecto de la carpeta local, con contenedores de nombre no neutro (ahora `name: analisis-cana`); una
  prueba redondeaba +16.5 % a 16 con `round()` de Python, que redondea al par (ahora redondeo convencional, 17, como en
  el README); y la prueba de verificación no corría en Docker porque la imagen no traía scikit-learn (D76).
