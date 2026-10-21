-- Tablas de la peluquería.
-- Se ejecuta con:  npm run db:init   (crea la base si no existe y carga esto)
-- Si lo importás a mano (Workbench, etc.), creá antes la base:  CREATE DATABASE peluqueria;

CREATE TABLE IF NOT EXISTS servicios (
  id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(80)  NOT NULL UNIQUE,
  precio  DECIMAL(10,2) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS turnos (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_uid    VARCHAR(128) NOT NULL,          -- uid del usuario en Firebase
  mail           VARCHAR(255) NOT NULL,
  nombre         VARCHAR(60)  NOT NULL,
  apellido       VARCHAR(60)  NOT NULL,
  servicio_id    INT UNSIGNED NOT NULL,
  dia            DATE         NOT NULL,
  hora           TIME         NOT NULL,
  estado         ENUM('Pendiente','Confirmado') NOT NULL DEFAULT 'Pendiente',
  observaciones  VARCHAR(500) NULL,
  creado_en      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dia_hora (dia, hora),            -- un solo turno por horario
  KEY idx_usuario (usuario_uid),
  CONSTRAINT fk_turno_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Servicios iniciales (los mismos 4 que hoy están fijos en el front). Los precios son de ejemplo: cambialos.
INSERT IGNORE INTO servicios (nombre, precio) VALUES
  ('Corte', 15000),
  ('Barba', 10000),
  ('Corte + Barba', 20000),
  ('Coloración + Corte', 35000);
