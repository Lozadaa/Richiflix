# Validación en PC · 6 de octubre de 2026

Esta actualización no se instaló ni se probó en el televisor, por indicación del usuario. Las capturas de `screenshots/` usan títulos, puntuaciones y episodios de demostración, sin catálogo ni credenciales personales.

- 182 pruebas unitarias: ventanas virtuales, caché de episodios, caché persistente de puntuaciones, prioridades y concurrencia de precarga, fuentes y reproducción.
- Electron real en Windows con datos temporales: perfiles, configuración, almacenamiento cifrado, catálogo, episodios, reinicio y Kids. Una segunda prueba comprueba los valores preconfigurados personales con red simulada.
- Chromium en PC con el paquete Tizen: mando con keycodes originales, AVPlay simulado, perfiles, player, buffering y Volver. No certifica el decodificador del televisor.
- Experiencia integrada: dos filas próximas precargadas, OK/Volver en búsqueda, composición de texto, búsqueda vacía, temporadas continuas, 610 episodios con un máximo de 12 botones montados, eliminación de nodos lejanos, recuperación del episodio y cabecera a 1366 px.
- Imágenes: spinner durante metadatos o descarga; fallback únicamente al confirmar ausencia/fallo. La portada no usa el póster vertical mientras espera el backdrop.
- Banner bajo CPU limitada a 4×: 30 movimientos, P95 al segundo RAF de 33,5 ms, sin cambios intermedios de portada, arte, vídeo ni consultas de metadatos; un único cambio final y reutilización del iframe. Esta medida es un indicador de presentación en PC, no FPS medidos en Samsung.

La precarga comparte la cola de dos solicitudes con la portada, se pausa al moverse/abrir reproducción y conserva dos filas de datos adicionales sin montarlas en el DOM. Los scores se almacenan aparte, hasta 5.000 entradas durante siete días; el detalle completo conserva su límite de 128 entradas. Las series reutilizan ocho fichas de episodios durante 30 minutos y descartan el caché al cambiar de conexión.

La disponibilidad de tráilers y de emisiones reales depende del origen. Los tráilers de Samsung mantienen pendiente la configuración del puente web; esta comprobación no los da por resueltos en el TV.
