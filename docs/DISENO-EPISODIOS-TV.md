# Episodios de Richiflix

Referencia aplicada: [frontend-design de Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), encontrada con find-skills, y [navegación Samsung](https://developer.samsung.com/smarttv/design/input-methods.html).

Paleta existente: tinta #101827, azul #1d293d, lavanda #c1b0ee, coral #ff977f y mantequilla #f5d58d. Bricolage Grotesque en títulos, Manrope para lectura desde el sofá. Sin fuentes remotas adicionales.

Serie y sinopsis ocupan el tercio izquierdo, con arte integrado en el fondo. A la derecha, una lista continua de miniaturas horizontales agrupada por temporada. Número, duración e historial tienen una función concreta. Las temporadas se identifican mediante títulos, sin selector ni pestañas.

```
Volver
                  Episodios
Título            Temporada 1
Sinopsis          [miniatura] 1  Título             play
Datos TMDB        [miniatura] 2  Título             play
Guardar           [miniatura] 3  Título             play
```

Revisión: una rejilla de pósters repetiría la portada y exigiría demasiado movimiento horizontal. Se elige una lista de una columna, independiente de las temporadas. Texto TV de 24–30 px y secundario de 20–22 px; foco interior sin sombras animadas ni desenfoques. Desplazamiento suave acotado y respeto a movimiento reducido.

Arriba/abajo recorren todos los episodios, pasando directamente a la siguiente temporada. OK reproduce; izquierda lleva a Guardar y derecha devuelve al episodio anterior. Los extremos no hacen bucle. Volver desde reproducción recupera serie, temporada y capítulo. Se desmontan episodios lejanos, conservando un margen limitado y el foco.
