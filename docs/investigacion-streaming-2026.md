> Documento histórico. La selección actual usa únicamente eterboxtv mediante Xtream Codes API. Las fuentes listadas aquí ya no se cargan en Richiflix.

# Comprobación de fuentes para Richiflix

Fecha de consulta: 5 de octubre de 2026, America/Santiago.

Se comprobó el texto de fuentes enviado en el chat mediante peticiones HTTP GET a las direcciones exactas. Esta comprobación verifica acceso y formato de la lista; no verifica la reproducción individual de cada stream. No se revisaron licencias ni se aplicó una selección por género.

## Resultados observados

| Fuente | Dirección comprobada | Resultado | Estado en Richiflix |
| --- | --- | --- | --- |
| IPTV-org, dirección enviada | `https://iptv-org.github.io/iptv/iptv.m3u` | HTTP 404 | Corregir a `index.m3u`. |
| IPTV-org, índice actual | `https://iptv-org.github.io/iptv/index.m3u` | HTTP 200, `audio/x-mpegurl`, cabecera `#EXTM3U`, 11.138 entradas `#EXTINF`, 2.516.602 bytes | Ya incluido como origen del catálogo en `scripts/update-content.mjs`. |
| FlixHQ, películas | `https://raw.githubusercontent.com/FlixHQ/FlixHQ/main/movies.m3u` | HTTP 404 | No se obtuvo una lista ni títulos importables de esta URL. |
| FlixHQ, series | `https://raw.githubusercontent.com/FlixHQ/FlixHQ/main/series.m3u` | HTTP 404 | Se interpretó `series.m3u` como un archivo del mismo repositorio y rama indicados para películas. No se obtuvo una lista. |
| Fútbol Libre | `https://futbol-libre.com/api` | HTTP 404 | No se obtuvo una API ni un stream de fútbol de esta ruta. |
| Stream2Watch, MLB | `https://stream2watch.com/mlb` | HTTP 410 | No se obtuvo una página utilizable, lista o stream MLB de esta ruta. |

Los errores corresponden a esta consulta desde el PC. No prueban que todas las rutas posibles de esas marcas sean inexistentes ni que el estado sea permanente. No se incorporaron otras direcciones suponiendo que fueran equivalentes.

El [README oficial de IPTV-org](https://github.com/iptv-org/iptv#playlists) indica `index.m3u` como lista global. La lista lineal incluye canales de películas, pero no proporciona por sí sola un catálogo de películas elegibles a demanda.

## Configuración real de Richiflix

El texto `App > Live TV > Input URL` / `App > On-Demand > Playlist` no describe los menús actuales de este proyecto.

En el perfil Adulto, abrir **Ajustes → Tus fuentes → Añadir fuente**:

- **Lista IPTV · M3U**: URL de una lista válida, por ejemplo `https://iptv-org.github.io/iptv/index.m3u`. El índice ya está incluido; no es necesario añadirlo de nuevo para ver sus canales.
- **Vídeo directo · MP4, WebM, HLS**: URL de un vídeo reproducible, con su nombre y portada opcional.
- **Señal en vivo · HLS**: URL directa de emisión.
- **Plataforma web**: página que se abre externamente; no se convierte en una película reproducible dentro del player.

También existe **Añadir contenido** para importar una lista M3U por URL, archivo en Windows o texto. Actualmente el importador de listas trata las entradas como canales; no clasifica una lista M3U en películas y temporadas automáticamente.

## Xtream y MagisTV

Richiflix todavía no incluye un formulario Host / User / Pass ni un cliente de catálogo Xtream. No basta con pegar un host en el campo de una lista M3U. El mensaje recibido no incluye un servidor operativo ni documentación verificable para confirmar que MagisTV admita ese acceso desde una app externa. Esta afirmación queda pendiente de comprobar; no se presenta como una integración existente.

## Resultado de integración

Actualización posterior por instrucción del usuario: Richiflix conserva únicamente IPTV-org, FlixHQ, Fútbol Libre y Stream2Watch como fuentes incluidas. El catálogo se regeneró exclusivamente desde IPTV-org (11.129 emisiones únicas). Se retiraron Blender, NASA+, Free-TV y todas las plataformas y accesos MLB/MiLB agregados anteriormente. Las otras tres fuentes seleccionadas se muestran pendientes y no aportan contenido reproducible. Kids queda vacío al no conservarse títulos con evidencia de edad. Las fuentes manuales personales siguen disponibles.

La única lista utilizable de esta comprobación ya era un origen del catálogo. No se añadieron fichas que prometieran reproducción de las direcciones fallidas. Las fuentes propuestas y sus resultados quedan registradas aquí para una comprobación posterior.

Kids conserva la regla existente: únicamente títulos con evidencia de edad apta para hasta 10 años; contenido sin evidencia y emisiones en vivo se ocultan.

El research general de plataformas y contenido permanece en [CONTENIDO_RESEARCH.md](CONTENIDO_RESEARCH.md).
