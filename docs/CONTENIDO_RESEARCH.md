# Richiflix — research de contenido

Actualización del 5 de octubre de 2026: [comprobación de las URLs enviadas de IPTV-org, FlixHQ, Fútbol Libre y Stream2Watch, y configuración real de Richiflix](investigacion-streaming-2026.md).

Este informe es histórico. El usuario pidió retirar sus contenidos y plataformas del catálogo y conservar únicamente esas cuatro fuentes. El catálogo actual carga solo IPTV-org; FlixHQ, Fútbol Libre y Stream2Watch están pendientes por errores de sus direcciones.

Fecha: 4 de octubre de 2026, Chile. Comprobaciones de listas: 5 de octubre de 2026, 02:17–02:18 UTC.

El alcance incluye películas, series, anime, animación, documentales, infantil, deportes, música, cultura, ciencia y noticias de cualquier país. No hay ranking ni selección por gustos. Este informe examina contenido, gratuidad, acceso y posibilidades de reproducción; no incluye una revisión de licencias.

## Qué se comprobó

Se revisaron catálogos, páginas de proveedores y documentación de listas. También se descargó el texto de nueve listas M3U y se contaron sus entradas. No se descargaron películas ni se probó la reproducción de cada señal desde Chile. Una respuesta HTTP 200 de una lista no significa que todos sus vídeos funcionen.

## Listas IPTV y GitHub

Estas fuentes contienen señales lineales: un canal de películas tiene una programación, no necesariamente una película elegible a demanda. Las entradas pueden incluir variantes de una misma señal; las categorías se solapan.

| Lista | Entradas EXTINF observadas | Enlace comprobado |
| --- | ---: | --- |
| IPTV-org global | 11.138 | [index.m3u](https://iptv-org.github.io/iptv/index.m3u) |
| IPTV-org español | 2.322 | [spa.m3u](https://iptv-org.github.io/iptv/languages/spa.m3u) |
| IPTV-org Chile | 242 | [cl.m3u](https://iptv-org.github.io/iptv/countries/cl.m3u) |
| IPTV-org películas | 782 | [movies.m3u](https://iptv-org.github.io/iptv/categories/movies.m3u) |
| IPTV-org deportes | 445 | [sports.m3u](https://iptv-org.github.io/iptv/categories/sports.m3u) |
| IPTV-org animación | 160 | [animation.m3u](https://iptv-org.github.io/iptv/categories/animation.m3u) |
| IPTV-org documentales | 254 | [documentary.m3u](https://iptv-org.github.io/iptv/categories/documentary.m3u) |
| IPTV-org música | 759 | [music.m3u](https://iptv-org.github.io/iptv/categories/music.m3u) |
| Free-TV/IPTV global | 2.080 | [playlist.m3u8](https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8) |

Las nueve URLs respondieron HTTP 200. Los números son una fotografía de la consulta y no deben sumarse. El índice global permite explorar todos los contenidos incluidos por el repositorio; los desgloses sirven para navegar. Fuentes: [directorio IPTV-org](https://github.com/iptv-org/iptv/blob/master/PLAYLISTS.md), [Free-TV/IPTV](https://github.com/Free-TV/IPTV).

La [API de IPTV-org](https://github.com/iptv-org/api) aporta canales, idiomas, países, categorías, logos, streams y referencias a guías. Los streams pueden llevar etiquetas de geobloqueo o emisión intermitente. Una referencia a una guía no garantiza disponer de programación actualizada.

## Catálogos y plataformas

Orden alfabético. «Web/app» significa que se verificó la existencia de la plataforma, no que su vídeo pueda reproducirse directamente en el reproductor de Richiflix.

| Fuente | Contenido encontrado | Costo y disponibilidad | Posible acceso desde Richiflix |
| --- | --- | --- | --- |
| [ARTE](https://www.arte.tv/es/) | Cine, series, documentales, conciertos, cultura y actualidad; programas como Tracks y GEO Reportaje. | Programación gratuita; disponibilidad territorial y ventanas por vídeo. [Disponibilidad](https://faq.arte.tv/hc/en-gb/articles/15318464453916-Why-are-some-videos-unavailable-in-some-countries). | Web/app; reproducción integrada pendiente de comprobar. |
| [Blender Studio](https://studio.blender.org/films/) | Animación, fantasía, ciencia ficción y comedia: Big Buck Bunny, Sintel, Tears of Steel, Spring, Charge, Wing It!, Sprite Fright y Glass Half. | Películas publicadas online; no confundir con materiales de producción de la suscripción Studio. | Vídeos y archivos publicados; comprobar las URLs de cada obra. [Directorio de vídeos](https://download.blender.org/demo/movies/). |
| [Cineteca Nacional online](https://www.cclm.cl/cineteca-nacional-de-chile/cineteca-online-cclm/) | Patrimonio audiovisual, cine y registros históricos chilenos. La página muestra 710 títulos. | Catálogo online; acceso a comprobar por título. | Ficha y reproductor web; sin integración directa probada. |
| [CNTV Infantil](https://cntvinfantil.cl/) | Animación y educación: Camaleón y las naturales ciencias, Plumín, Manos al experimento, Las aventuras de Len y Guaje. | Vídeos gratuitos. [Presentación del CNTV](https://cntv.cl/cntvinfantil/). | Web y descargas ofrecidas por el sitio para reproducir archivos locales. |
| [CNTV Play — entrada institucional](https://cntv.cl/sections/cntv-play/) | Series, películas y documentales nacionales de historia, música, ciencia y naturaleza; la página institucional describe más de 150 series. | Presentado como acceso gratuito; revisar acceso actual por título. | Entrar desde CNTV.cl y verificar el destino actual antes de automatizar. |
| [FIFA+](https://inside.fifa.com/organisation/media-releases/fifa-plus-dazn-global-home-of-football) | Fútbol en vivo, archivo y originales. | Desde junio de 2026 está en DAZN con oferta gratuita; eventos según territorio. No implica que todo DAZN sea gratis. | Web/app DAZN; usar el destino actual, no asumir que los antiguos enlaces FIFA+ siguen vigentes. |
| [France 24 Español](https://www.youtube.com/watch?v=Y-IlMeCCtIg) | Noticias internacionales en directo, 24 horas en español. | Emisión gratuita del canal oficial. | YouTube/web; reproductor oficial o enlace. |
| [Internet Archive — vídeos](https://archive.org/details/movies) | Archivo audiovisual para explorar películas, documentales, animación y otros registros. | Acceso y archivos según elemento; metadatos y formatos variables. | Importación por elemento cuando exista archivo reproducible; sin prueba masiva. |
| [It's Anime / REMOW](https://its-anime.com/) | Canal de anime con acción, fantasía, comedia, romance y aventuras. | FAST gratuito con anuncios; proveedores, títulos y ventanas varían por región. Hay apartado Latinoamérica, pero falta comprobar acceso concreto en Chile. | Proveedor indicado por el sitio; no hay stream directo validado. |
| [Mercado Play Chile](https://play.mercadolibre.cl/) | Películas y series; en la consulta aparecen Enlace mortal, CSI: Miami y Terminator Génesis en el catálogo gratuito. | Conviven contenido gratuito, alquileres y ofertas de pago. Confirmar el estado de cada título. | Web/app; no se verificó una API pública de reproducción externa. |
| [OndaMedia](https://ondamedia.cl/) | Cine chileno, documentales y cortos; fichas observadas de Papá al rescate, Perkin y La Francisca, una juventud chilena. | Gratuito; muchas fichas indican solo Chile, con sección para ver fuera. La [cuenta pública 2026](https://s3.amazonaws.com/gobcl-prod/public_files/Campa%C3%B1as/Cuenta-P%C3%BAblica-2026/Cuentas-por-sector/23._Ministerio_de_las_Culturas_las_Artes_y_el_PatrimonioVF.pdf) describe más de 800 películas. | Web/app; registro y acceso por título pendientes de probar. |
| [Plex](https://www.plex.tv/watch-free/) | Películas, series y TV en vivo gratuitas con anuncios. | Disponibilidad según país y título; Chile no figura entre los países excluidos en su [FAQ](https://support.plex.tv/articles/frequently-asked-questions-vod/). | Web/app; distinguir los títulos reproducibles de las fichas que remiten a otros servicios. |
| [Pluto TV Chile](https://pluto.tv/cl/) | TV en vivo, películas y series a demanda, infantil y otros géneros. | Gratuito con anuncios; catálogo regional. | Web/app; no se verificó reproducción independiente en Richiflix. |
| [Red Bull TV](https://www.redbull.com/us-en/live-events) | Deportes, eventos, replays, películas, música, baile y cultura: MTB, surf, motor, skate, escalada y más. | Acceso gratuito anunciado en su [app oficial](https://play.google.com/store/apps/details?id=com.nousguide.android.rbtv); comprobar cada evento desde Chile. | Web/app; integración directa pendiente. |
| [NASA+](https://www.nasa.gov/ways-to-watch/) | Misiones en vivo, documentales, series, ciencia, contenido infantil y en español. | Gratis, sin suscripción ni anuncios en NASA+. | [Web NASA+](https://plus.nasa.gov/) y app; streams y vídeos a comprobar por elemento. |
| [Tubi](https://tubitv.com/static/devices) | Películas, series y otros contenidos gratuitos. | La [lista de países soportados](https://tubitv.com/help-center/About-Tubi/articles/4409969055259.) no incluye Chile. Se conserva como fuente internacional con esa limitación. | Web/app en territorios soportados; no validado en Chile. |
| [TVN / NTV](https://ww2.tvn.cl/corporativo/como-sintonizar-tvn-y-ntv) | Televisión chilena, cultura y programación infantil. | El sitio institucional enlaza señales online. No se asume que todo TVN Play sea gratuito. | Señal web del canal; reproducción dentro de Richiflix pendiente de comprobar. |

Observación sobre CNTV Play: una página del dominio cntvplay.cl mostró texto ajeno sobre casinos durante la consulta. El registro conserva la entrada institucional CNTV.cl como referencia y deja el acceso operativo por validar. Esto no demuestra por sí solo qué ocurrió con el sitio.

## Béisbol: MLB y MiLB

No se confirmó una fuente gratuita estable que ofrezca todos los partidos MLB desde Chile. Tampoco se validó una señal IPTV gratuita de MLB.

El Game of the Day de ESPN requiere ESPN Unlimited; el acceso internacional sigue por MLB. [Fuente MLB](https://www.mlb.com/live-stream-games/partners/espn).

MLB publica una selección de partidos MiLB gratuitos. Son ligas menores y deben identificarse como MiLB. [Guía 2026](https://www.mlb.com/news/minor-league-opening-day-guide-2026?t=mlb-pipeline-coverage).

La sección de béisbol puede conservar calendario, equipos y accesos por evento. La etiqueta «gratis» debe depender de una emisión comprobada; un enlace promocional antiguo no confirma acceso actual.

## Implicaciones para Richiflix

Estas son conclusiones de integración, no funcionalidades ya implementadas:

- Un catálogo común puede incluir todos los géneros y países. Cada ficha necesita indicar si es película, episodio, canal o evento.
- M3U aporta TV en vivo. Para elegir una película concreta se necesita además una fuente de vídeo a demanda o un archivo local.
- Las plataformas gratuitas pueden aportar contenido aunque su reproducción se abra en su web/app. Eso debe verse claro en el botón, sin presentar el contenido como reproducción local ya disponible.
- Registrar origen, idioma, región, anuncios, registro, costo por título, última comprobación y estado de reproducción. Una fuente que falle puede permanecer visible con su estado, sin desaparecer silenciosamente.
- Deduplicar canales sin descartar sus alternativas de stream. Cargar filas y logos progresivamente para manejar miles de entradas.
- Comprobar formatos, subtítulos, duración y reproducción real antes de declarar que una fuente funciona. Las listas incluyen enlaces que pueden caducar o no emitir las 24 horas.
- Samsung TV / Tizen reutiliza el catálogo y los perfiles locales con navegación por mando y AVPlay. Electron sirve al escritorio; el build Tizen genera un WGT que requiere firma Samsung y pruebas en dispositivo (docs/TIZEN.md).

## Resultado de este research

Hay listas amplias y fuentes de todas las categorías solicitadas. Quedan diferenciadas la existencia de contenido, el acceso gratuito, la disponibilidad desde Chile y la posibilidad de reproducirlo dentro de Richiflix. Se verificaron nueve listas y se documentaron diecisiete plataformas o catálogos. No se modificó la app ni se importaron automáticamente estos contenidos.

