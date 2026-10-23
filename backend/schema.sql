CREATE TABLE IF NOT EXISTS turnos (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_uid      VARCHAR(128) NOT NULL,          -- uid del usuario en Firebase
  mail             VARCHAR(255) NOT NULL,
  nombre           VARCHAR(60)  NOT NULL,
  apellido         VARCHAR(60)  NOT NULL,
  servicio_id      INT UNSIGNED NOT NULL,
  peluquero_uid    VARCHAR(128) NULL,              -- uid del peluquero en Firebase
  peluquero_nombre VARCHAR(121) NULL,
  dia              DATE         NOT NULL,
  hora             TIME         NOT NULL,
  estado           ENUM('Pendiente','Finalizado') NOT NULL DEFAULT 'Pendiente',
  observaciones    VARCHAR(500) NULL,
  creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluquero_dia_hora (peluquero_uid, dia, hora),  -- un turno por peluquero y horario
  KEY idx_usuario (usuario_uid),
  CONSTRAINT fk_turno_servicio FOREIGN KEY (servicio_id) REFERENCES servicios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;