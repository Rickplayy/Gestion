-- Agrega columnas para recordar la última coordenada manual (lat/lon) usada
-- al recalcular distancia por coordenadas (PATCH .../domicilio-coordenadas).
-- Mismos tipos que SIGE_CCOLONIAS.LATITUD / LONGITUD.
ALTER TABLE `SIGE_INFO_DISTANCIA`
  ADD COLUMN `LAT` DECIMAL(8,6) NULL AFTER `NIVEL`,
  ADD COLUMN `LON` DECIMAL(9,6) NULL AFTER `LAT`;
