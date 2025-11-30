-- =====================================================================
-- FUNCIÓN: obtener_metas_usuario
-- CÓDIGO: PROC-MET-001
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Devuelve las metas visibles para el usuario:
--     • metas personales (usuario_id)
--     • metas familiares (familia_id)
--
-- PARÁMETROS:
--   p_usuario_id UUID
--
-- RETORNO:
--   SETOF metas
-- =====================================================================

CREATE OR REPLACE FUNCTION obtener_metas_usuario(
    p_usuario_id UUID
)
RETURNS SETOF metas
LANGUAGE plpgsql
AS $$
DECLARE
    v_familia UUID;
BEGIN
    SELECT familia_id INTO v_familia
    FROM usuarios
    WHERE id = p_usuario_id;

    IF v_familia IS NULL THEN
        RETURN QUERY
        SELECT * FROM metas
        WHERE usuario_id = p_usuario_id
        ORDER BY fecha_creacion DESC;
    END IF;

    RETURN QUERY
    SELECT *
    FROM metas
    WHERE usuario_id = p_usuario_id
       OR familia_id = v_familia
    ORDER BY fecha_creacion DESC;
END;
$$;

-- =====================================================================
-- FUNCIÓN: crear_meta
-- CÓDIGO: PROC-MET-002
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Crea una meta personal o familiar.
--
-- PARÁMETROS:
--   p_nombre TEXT
--   p_monto_objetivo NUMERIC
--   p_fecha_limite DATE
--   p_usuario_id UUID
--   p_familia_id UUID
--   p_es_familiar BOOLEAN
--
-- RETORNO:
--   UUID → ID de la meta creada.
-- =====================================================================

create or replace function crear_meta(
  nombre text,
  monto_objetivo numeric,
  fecha_limite date,
  familia_id uuid,
  usuario_id uuid,
  es_familiar boolean
)
returns jsonb
language plpgsql
security definer
as $$
declare
  nueva_meta jsonb;
begin
  insert into metas(nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar, monto_actual)
  values(nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar, 0)
  returning row_to_json(metas) into nueva_meta;

  return nueva_meta;
end
$$;

-- =====================================================================
-- FUNCIÓN: editar_meta
-- CÓDIGO: PROC-MET-003
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Edita una meta personal o familiar.
--
-- PARÁMETROS:
--   p_meta_id UUID
--   p_nombre TEXT
--   p_monto_objetivo NUMERIC
--   p_fecha_limite DATE
--   p_es_familiar BOOLEAN
--   p_usuario_id UUID
--   p_familia_id UUID
--
-- RETORNO:
--   BOOLEAN
-- =====================================================================

CREATE OR REPLACE FUNCTION editar_meta(
    p_meta_id UUID,
    p_nombre TEXT,
    p_monto_objetivo NUMERIC,
    p_fecha_limite DATE,
    p_es_familiar BOOLEAN,
    p_usuario_id UUID,
    p_familia_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE metas
    SET nombre = p_nombre,
        monto_objetivo = p_monto_objetivo,
        fecha_limite = p_fecha_limite,
        es_familiar = p_es_familiar,
        usuario_id = CASE WHEN p_es_familiar THEN NULL ELSE p_usuario_id END,
        familia_id = CASE WHEN p_es_familiar THEN p_familia_id ELSE NULL END
    WHERE id = p_meta_id;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- FUNCIÓN: eliminar_meta
-- CÓDIGO: PROC-MET-004
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Elimina una meta. No elimina aportes.
--
-- PARÁMETROS:
--   p_meta_id UUID
--
-- RETORNO:
--   BOOLEAN
-- =====================================================================

CREATE OR REPLACE FUNCTION eliminar_meta(
    p_meta_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM metas
    WHERE id = p_meta_id;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- FUNCIÓN: agregar_aporte_meta
-- CÓDIGO: PROC-MET-005
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Registra un aporte a una meta:
--     • valida saldo del usuario
--     • agrega el aporte
--     • actualiza monto_actual
--     • descuenta saldo
--     • opcionalmente vincula movimiento
--
-- PARÁMETROS:
--   p_meta_id UUID
--   p_usuario_id UUID
--   p_monto NUMERIC
--   p_movimiento_id UUID
--
-- RETORNO:
--   BOOLEAN
-- =====================================================================

CREATE OR REPLACE FUNCTION agregar_aporte_meta(
    p_meta_id UUID,
    p_usuario_id UUID,
    p_monto NUMERIC,
    p_movimiento_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_saldo NUMERIC;
    v_actual NUMERIC;
    v_objetivo NUMERIC;
BEGIN
    IF p_monto <= 0 THEN
        RAISE EXCEPTION 'Monto inválido';
    END IF;

    -- saldo disponible
    SELECT saldo_disponible INTO v_saldo
    FROM usuarios WHERE id = p_usuario_id;

    IF v_saldo < p_monto THEN
        RAISE EXCEPTION 'Saldo insuficiente para el aporte';
    END IF;

    -- meta actual
    SELECT monto_actual, monto_objetivo
    INTO v_actual, v_objetivo
    FROM metas WHERE id = p_meta_id;

    IF v_actual + p_monto > v_objetivo THEN
        RAISE EXCEPTION 
            'El aporte excede el objetivo. Disponible: %',
            v_objetivo - v_actual;
    END IF;

    -- registrar aporte
    INSERT INTO ahorro (meta_id, movimiento_id, monto)
    VALUES (p_meta_id, p_movimiento_id, p_monto);

    -- actualizar meta
    UPDATE metas
    SET monto_actual = monto_actual + p_monto
    WHERE id = p_meta_id;

    -- descontar saldo usuario
    UPDATE usuarios
    SET saldo_disponible = saldo_disponible - p_monto
    WHERE id = p_usuario_id;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION obtener_saldo_usuario(
    p_usuario_id UUID
)
RETURNS NUMERIC
LANGUAGE sql
AS $$
    SELECT saldo_disponible
    FROM usuarios
    WHERE id = p_usuario_id;
$$;

-- =====================================================================
-- FUNCIÓN: obtener_aportes_por_meta
-- CÓDIGO: PROC-MET-007
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Devuelve todos los aportes hacia una meta, incluyendo:
--     • datos del movimiento asociado
--     • datos del usuario
--
-- PARÁMETROS:
--   p_meta_id UUID
--
-- RETORNO:
--   TABLE(...)
-- =====================================================================

CREATE OR REPLACE FUNCTION obtener_aportes_por_meta(
    p_meta_id UUID
)
RETURNS TABLE(
    aporte_id UUID,
    monto NUMERIC,
    fecha TIMESTAMP,
    movimiento_id UUID,
    movimiento_monto NUMERIC,
    movimiento_tipo CHAR,
    usuario_nombre TEXT
)
LANGUAGE sql
AS $$
    SELECT 
        a.id,
        a.monto,
        a.fecha_aporte,
        m.id,
        m.monto,
        m.tipo,
        u.nombre
    FROM ahorro a
    LEFT JOIN movimientos m ON m.id = a.movimiento_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE a.meta_id = p_meta_id
    ORDER BY a.fecha_aporte DESC;
$$;