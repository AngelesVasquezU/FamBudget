/* ================================================================================================
MÓDULO SQL: MOVIMIENTOS
CÓDIGO DEL MÓDULO: SQL-MOV-000
-----------------------------------------------------------------------------------------------
Descripción:
Funciones y procedimientos para la gestión de movimientos financieros.

Gestores relacionados:
- GestorMovimientos (GES-004)
- GestorMetas (GES-003)
- GestorUsuario (GES-001)

Tablas principales:
movimientos, usuarios, conceptos, ahorro, metas

-----------------------------------------------------------------------------------------------
FUNCIONES
-----------------------------------------------------------------------------------------------
PROC-MOV-001 → crear_movimiento()
PROC-MOV-002 → obtener_total_por_tipo()
PROC-MOV-003 → obtener_movimientos_usuario()
PROC-MOV-004 → obtener_balance_rango()
PROC-MOV-005 → obtener_movimientos_conceptos()
PROC-MOV-006 → actualizar_movimiento()
PROC-MOV-007 → filtrar_movimientos()
PROC-MOV-008 → resumen_por_conceptos()
PROC-MOV-009 → obtener_movimiento_por_id()

================================================================================================
*/

/*
FUNCIÓN: crear_movimiento
CÓDIGO:  PROC-MOV-001
-----------------------------------------------------------------------------------------------
Descripción:
Inserta un movimiento financiero y actualiza saldo del usuario y metas asociadas.

Dependencias:
- usuarios(saldo_disponible)
- movimientos(usuario_id, tipo, monto, comentario, fecha, concepto_id)
- ahorro(meta_id, movimiento_id, monto)
- metas(monto_actual)
- Usada por: GestorMovimientos.crearMovimiento() [MGES004-1]
Parámetros:
p_usuario_id   UUID     → ID del usuario
p_tipo         CHAR     → 'ingreso' | 'egreso'
p_monto        NUMERIC  → Monto del movimiento
p_comentario   TEXT     → Comentario opcional
p_fecha        DATE     → Fecha del movimiento
p_concepto_id  UUID     → Concepto asociado
p_meta_id      UUID     → Meta asociada (opcional)
p_monto_meta   NUMERIC  → Monto a la meta (opcional)

Retorno:
UUID → ID del movimiento creado

Excepciones:
- 'El usuario no existe'
- 'Saldo insuficiente' (para egresos)

================================================================================================
*/
CREATE OR REPLACE FUNCTION crear_movimiento(
    p_usuario_id   UUID,
    p_tipo         CHAR,
    p_monto        NUMERIC,
    p_comentario   TEXT,
    p_fecha        DATE,
    p_concepto_id  UUID DEFAULT NULL,
    p_meta_id      UUID DEFAULT NULL,
    p_monto_meta   NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_movimiento_id UUID;
    v_saldo_actual NUMERIC;
BEGIN
    -- Obtener saldo del usuario
    SELECT saldo_disponible
    INTO v_saldo_actual
    FROM usuarios
    WHERE id = p_usuario_id;

    IF v_saldo_actual IS NULL THEN
        RAISE EXCEPTION 'El usuario no existe';
    END IF;

    -- Validar egreso
    IF p_tipo = 'egreso' AND v_saldo_actual < p_monto THEN
        RAISE EXCEPTION 'Saldo insuficiente para realizar el egreso';
    END IF;

    -- Insertar movimiento
    INSERT INTO movimientos (
        usuario_id, tipo, monto, comentario, fecha, concepto_id
    ) VALUES (
        p_usuario_id, p_tipo, p_monto, p_comentario, p_fecha, p_concepto_id
    )
    RETURNING id INTO v_movimiento_id;

    -- Actualizar saldo
    IF p_tipo = 'ingreso' THEN
        UPDATE usuarios
        SET saldo_disponible = saldo_disponible + p_monto
        WHERE id = p_usuario_id;
    ELSE
        UPDATE usuarios
        SET saldo_disponible = saldo_disponible - p_monto
        WHERE id = p_usuario_id;
    END IF;

    -- Manejar aporte a meta
    IF p_meta_id IS NOT NULL AND p_monto_meta IS NOT NULL THEN
        
        -- Insertar registro de ahorro
        INSERT INTO ahorro (meta_id, movimiento_id, monto)
        VALUES (p_meta_id, v_movimiento_id, p_monto_meta);

        -- Actualizar meta
        UPDATE metas
        SET monto_actual = monto_actual + p_monto_meta
        WHERE id = p_meta_id;

    END IF;

    RETURN v_movimiento_id;

END;
$$;

-- =====================================================================
-- FUNCIÓN: obtener_total_por_tipo
-- CÓDIGO: PROC-MOV-002
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Calcula el total de ingresos o egresos para un usuario.
--   Permite filtrar por fecha exacta, mes y año.
--
-- DEPENDENCIAS:
--   Tabla movimientos(monto, tipo, usuario_id, fecha)
--
-- PARÁMETROS:
--   p_usuario_id  (UUID)
--   p_tipo        (CHAR)   → “ingreso” | “egreso”
--   p_fecha       (DATE NULL)
--   p_mes         (INT NULL)
--   p_anio        (INT NULL)
--
-- RETORNO:
--   NUMERIC → Total del tipo solicitado.
-- =====================================================================

CREATE OR REPLACE FUNCTION obtener_total_por_tipo(
    p_usuario_id UUID,
    p_tipo CHAR,
    p_fecha DATE DEFAULT NULL,
    p_mes INT DEFAULT NULL,
    p_anio INT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(monto), 0)
    INTO v_total
    FROM movimientos
    WHERE usuario_id = p_usuario_id
      AND tipo = p_tipo
      AND (
            p_fecha IS NULL OR fecha = p_fecha
          )
      AND (
            p_mes IS NULL 
            OR p_anio IS NULL 
            OR (EXTRACT(MONTH FROM fecha) = p_mes AND EXTRACT(YEAR FROM fecha) = p_anio)
          );

    RETURN ROUND(v_total, 2);
END;
$$;

-- =====================================================================
-- FUNCIÓN: obtener_movimientos_usuario
-- CÓDIGO: PROC-MOV-003
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Lista movimientos de un usuario con filtros opcionales.
--
-- PARÁMETROS:
--   p_usuario_id  UUID
--   p_limit       INT
--   p_orden       TEXT ← 'desc'|'asc'
--   p_mes         INT NULL
--   p_anio        INT NULL
--
-- RETORNO:
--   SETOF movimientos
-- =====================================================================

CREATE OR REPLACE FUNCTION obtener_movimientos_usuario(
    p_usuario_id UUID,
    p_limit INT DEFAULT 50,
    p_orden TEXT DEFAULT 'desc',
    p_mes INT DEFAULT NULL,
    p_anio INT DEFAULT NULL
)
RETURNS SETOF movimientos
LANGUAGE sql
AS $$
    SELECT *
    FROM movimientos
    WHERE usuario_id = p_usuario_id
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM fecha) = p_mes)
      AND (p_anio IS NULL OR EXTRACT(YEAR FROM fecha) = p_anio)
    ORDER BY fecha 
        COLLATE "C" 
        || CASE WHEN p_orden = 'asc' THEN '' ELSE ' DESC' END
    LIMIT p_limit;
$$;

-- =====================================================================
-- FUNCIÓN: actualizar_movimiento
-- CÓDIGO: PROC-MOV-004
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Actualiza un movimiento y recalcula el saldo del usuario.
--
-- DEPENDENCIAS:
--   - movimientos
--   - usuarios(saldo_disponible)
--
-- NOTA:
--   Se asegura de NO dejar saldo en negativo.
--
-- PARÁMETROS:
--   p_movimiento_id UUID
--   p_monto         NUMERIC
--   p_fecha         DATE
--   p_comentario    TEXT
--
-- RETORNO:
--   BOOLEAN
-- =====================================================================

CREATE OR REPLACE FUNCTION actualizar_movimiento(
    p_movimiento_id UUID,
    p_monto NUMERIC,
    p_fecha DATE,
    p_comentario TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_user UUID;
    v_old NUMERIC;
    v_tipo CHAR;
    v_saldo NUMERIC;
    v_delta NUMERIC;
BEGIN
    -- valores actuales
    SELECT usuario_id, monto, tipo
    INTO v_user, v_old, v_tipo
    FROM movimientos WHERE id = p_movimiento_id;

    SELECT saldo_disponible INTO v_saldo
    FROM usuarios WHERE id = v_user;

    -- diferencia que se aplicará al saldo
    IF v_tipo = 'ingreso' THEN
        v_delta := p_monto - v_old;
    ELSE
        v_delta := v_old - p_monto;
    END IF;

    IF v_saldo + v_delta < 0 THEN
        RAISE EXCEPTION 'Saldo insuficiente para actualización';
    END IF;

    -- actualizar movimiento
    UPDATE movimientos
    SET monto = p_monto,
        fecha = p_fecha,
        comentario = p_comentario
    WHERE id = p_movimiento_id;

    -- actualizar saldo
    UPDATE usuarios
    SET saldo_disponible = saldo_disponible + v_delta
    WHERE id = v_user;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- FUNCIÓN: eliminar_movimiento
-- CÓDIGO: PROC-MOV-005
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Elimina un movimiento y revierte todos sus efectos:
--     • resta/suma saldo
--     • elimina ahorro asociado a meta
--     • resta monto de la meta
--
-- DEPENDENCIAS:
--   movimientos, ahorro, metas, usuarios
--
-- PARÁMETROS:
--   p_movimiento_id UUID
--
-- RETORNO:
--   BOOLEAN
-- =====================================================================

CREATE OR REPLACE FUNCTION eliminar_movimiento(p_movimiento_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_user UUID;
    v_monto NUMERIC;
    v_tipo CHAR;
    v_meta UUID;
    v_ahorro NUMERIC;
BEGIN
    -- obtener movimiento
    SELECT usuario_id, monto, tipo
    INTO v_user, v_monto, v_tipo
    FROM movimientos WHERE id = p_movimiento_id;

    -- revertir saldo
    IF v_tipo = 'ingreso' THEN
        UPDATE usuarios SET saldo_disponible = saldo_disponible - v_monto WHERE id = v_user;
    ELSE
        UPDATE usuarios SET saldo_disponible = saldo_disponible + v_monto WHERE id = v_user;
    END IF;

    -- revertir ahorro/meta si existe
    SELECT meta_id, monto INTO v_meta, v_ahorro
    FROM ahorro WHERE movimiento_id = p_movimiento_id;

    IF v_meta IS NOT NULL THEN
        UPDATE metas SET monto_actual = monto_actual - v_ahorro WHERE id = v_meta;
        DELETE FROM ahorro WHERE movimiento_id = p_movimiento_id;
    END IF;

    -- eliminar movimiento
    DELETE FROM movimientos WHERE id = p_movimiento_id;

    RETURN TRUE;
END;
$$;

-- =====================================================================
-- FUNCIÓN: obtener_balance_rango
-- CÓDIGO: PROC-MOV-006
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Obtiene totales de ingresos y egresos entre fechas.
--
-- PARÁMETROS:
--   p_usuario_ids UUID[]
--   p_inicio      DATE
--   p_fin         DATE
--
-- RETORNO:
--   TABLE(ingresos NUMERIC, egresos NUMERIC, balance NUMERIC)
-- =====================================================================

CREATE OR REPLACE FUNCTION obtener_balance_rango(
    p_usuario_ids UUID[],
    p_inicio DATE,
    p_fin DATE
)
RETURNS TABLE(ingresos NUMERIC, egresos NUMERIC, balance NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'ingreso' THEN monto END), 0)
        - COALESCE(SUM(CASE WHEN tipo = 'egreso' THEN monto END), 0)
    INTO ingresos, egresos, balance
    FROM movimientos
    WHERE usuario_id = ANY(p_usuario_ids)
      AND fecha BETWEEN p_inicio AND p_fin;

    RETURN NEXT;
END;
$$;

-- =====================================================================
-- FUNCIÓN: resumen_por_conceptos
-- CÓDIGO: PROC-MOV-007
-- ---------------------------------------------------------------------
-- DESCRIPCIÓN:
--   Retorna totales sumados por concepto (ingreso/egreso).
--
-- RETORNO:
--   TABLE(concepto TEXT, tipo TEXT, total NUMERIC)
-- =====================================================================

CREATE OR REPLACE FUNCTION resumen_por_conceptos(
    p_usuario_id UUID,
    p_mes INT DEFAULT NULL,
    p_anio INT DEFAULT NULL
)
RETURNS TABLE(concepto TEXT, tipo TEXT, total NUMERIC)
LANGUAGE sql
AS $$
    SELECT c.nombre, c.tipo, SUM(m.monto) AS total
    FROM movimientos m
    JOIN conceptos c ON c.id = m.concepto_id
    WHERE m.usuario_id = p_usuario_id
      AND (p_mes IS NULL OR EXTRACT(MONTH FROM m.fecha) = p_mes)
      AND (p_anio IS NULL OR EXTRACT(YEAR FROM m.fecha) = p_anio)
    GROUP BY c.nombre, c.tipo
    ORDER BY total DESC;
$$;