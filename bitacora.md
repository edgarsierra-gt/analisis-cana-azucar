# Bitácora de decisiones

Registro de mis decisiones técnicas, las hipótesis que descarté y cómo usé la IA. Cada entrada dice cómo lo verifiqué.

**Cómo trabajé con IA.** Usé Claude (chat y Claude Code) como asistente: para escribir y ejecutar código, hacer
cálculos, redactar borradores de texto y revisar cifras. Las preguntas, los métodos y las decisiones son míos. No
acepté ningún resultado de la IA sin verificarlo con los datos. Al final de cada serie hay una sección "Uso de IA" con
lo que hizo la IA, cómo lo verifiqué y qué sugerencias o errores suyos corregí o descarté.

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
- **Errores de la IA que corregí:**
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
- **Errores de la IA que corregí:**
  1. La primera descomposición del error usaba el promedio del lote incluyendo la propia parcela (79 % "nivel") y un
     oráculo que veía su propio error (R² 0.84). Lo corregí con el promedio de las otras parcelas (correlación
     intraclase): 77 % y R² 0.81.
  2. La primera banda de 80 % usaba residuos de entrenamiento y cubría 73 %. La cambié por errores de zafras anteriores
     y reporto la cobertura real (74 %) en lugar de prometer 80 %.
  3. Una primera figura comparaba "nivel" vs "ventaja" con dos dispersiones de r casi igual (0.49 y 0.48), que no
     mostraban lo que el texto decía. La reemplacé por tres lotes reales con orden típico (ρ cercano a la mediana).
  4. Los borradores de texto se escribieron antes de ejecutar; corregí las cifras que no coincidían (p. ej. "la banda
     cubre 8 de cada 10", "ρ de 0.42 a 0.52").
  5. El HTML mostraba +6 % para la zafra 2013 y el notebook +5 %: el HTML redondeaba un dato ya redondeado a un decimal
     (5.5). Ahora el resumen guarda 3 decimales.

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
- **Errores de la IA que corregí:**
  1. Regla de k frágil (ARI ≥ 0.6 con k = 6 en 0.598). La cambié por "más reproducible sin grupos de una variedad" y
     declaro que la fijé después de explorar.
  2. El primer texto decía que HOCP14-885 quedaba "entre completas y mucha caña". La co-asignación muestra que se mezcla
     más con "sin ventaja clara" (20 %); lo corregí: no tiene un grupo firme porque es la única con caña y calidad altas.
  3. El primer texto del grupo "mucha caña" hablaba de "cosecha temprana" y "ciclos cortos". Lo primero no está en los
     datos y lo segundo no se cumple (ciclos óptimos de 3-4 cortes en la pregunta 1); lo reemplacé por lo que sí
     muestran los datos (pierden ~3 % por corte).
  4. Las etiquetas del mapa de variedades se pisaban y una quedaba sobre el punto equivocado; pedí una colocación que
     evita choques.

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
- **Errores de la IA que corregí:**
  1. El primer texto decía que el costo por tonelada "no cambia" el ciclo óptimo; la grilla mostró que sí cambia a
     partir de US$37/t. Lo corregí a "casi no".
  2. La primera grilla de costos llegaba a US$40/t, y el "equilibrio" de las variedades recomendadas era ese tope, no
     un resultado. La amplié a US$60/t.
  3. El primer cálculo de potencia usaba "2 cohortes = 8 años", pero cohortes superpuestas no suman años de cosecha
     distintos. Lo reemplacé por 6 años de cosecha.
  4. El primer intento de componentes de varianza usaba el ambiente finca-año y dejaba la caída por variedad en el
     residuo (inflaba la interacción a 16.5 %). Lo corregí con lote-año y caída propia por variedad: 7.7 %.
  5. El equilibrio por distancia salía de una grilla de US$1/t y el notebook decía "desde ~US$35/t", cuando a US$35 el
     testigo todavía cubre costos. Ahora se calcula por bisección: testigo US$35.9/t; HOCP14-885 43.2, HOL15-508 43.6 y
     L15-306 41.3.
  6. "15-20 fincas por cohorte" solo llega a 80 % de potencia si la interacción no supera 1.5 veces la de Louisiana.
     Lo cambié a 20 fincas (5 por estrato) con la condición explícita (D41).
  7. El 25 % de renovaciones que se pierden sin número de corte se presentaba como un hecho general; sale de la
     simulación y depende de cuántas renovaciones repiten variedad.
  8. El HTML decía "2.6 veces" (interacción de Louisiana) junto a una calculadora que, con su valor inicial (×1.5),
     mostraba 3.6. Ahora el texto se calcula con los valores de la calculadora.
  9. El primer texto de H10 decía "una finca más vale mucho más que una repetición más". Al comparar 1 finca contra 1
     repetición, la repetición sumaba más potencia (2.3 contra 1.5 puntos), porque agrega más parcelas. La comparación
     justa es a igual número de parcelas.

---

## Serie I · Cierre: revisión independiente de cifras

Al cerrar la Serie I pedí a un agente de IA separado, que no participó en el análisis, comparar cada cifra del README,
la bitácora, los notebooks 04-05, `CLAUDE.md` y el HTML contra las salidas (notebooks, JSON y CSV). Encontró 7
diferencias de fondo y 5 menores; las corregí todas:
- "Error típico de 22 % por lote": la métrica es por parcela (una variedad en una finca y zafra).
- "15-20 fincas por cohorte": ver punto 6 de la pregunta 4.
- "La calidad viene con longevidad y estabilidad": calidad-estabilidad tiene r = 0.16, sin significancia. Ahora dice
  "la calidad viene con longevidad, y la longevidad con estabilidad".
- D33 omitía una asignación dudosa (L12-201, 58 %). H9 hablaba de "desvío" donde el 67 % es de la varianza.
- H10 citaba cifras de una versión anterior (1.9 contra 1.6 puntos); con el código actual, 2.3 contra 1.5.
- El 25 % simulado y el equilibrio por distancia: puntos 5 y 7 de la pregunta 4.
- `CLAUDE.md` decía que cada notebook verifica su JSON; el 02 no lo hacía. Agregué la verificación: el JSON de curvas
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
