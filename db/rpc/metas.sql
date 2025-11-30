-- RPC: obtener_metas
-- Objetivo:
--   Recupera todas las metas visibles para un usuario, incluyendo metas
--   personales y, si corresponde, metas compartidas con su familia.
--
-- Parámetros:
--   usuario_id_input → Usuario cuyas metas deben consultarse.
--
-- Reglas:
--   - Si el usuario pertenece a una familia, se incluyen metas familiares.
--   - Se devuelven únicamente metas vinculadas al usuario o a su familia.
--
-- Retorna:
--   Conjunto de metas accesibles para el usuario.

CREATE OR REPLACE FUNCTION obtener_metas(usuario_id_input uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  familia_id uuid;
  resultado jsonb;
BEGIN
  -- Determina si el usuario pertenece a una familia
  SELECT u.familia_id INTO familia_id
  FROM usuarios u
  WHERE u.id = usuario_id_input;

  -- Recupera metas personales y familiares cuando corresponde
  IF familia_id IS NOT NULL THEN
    SELECT jsonb_agg(row_to_json(m))
    INTO resultado
    FROM (
      SELECT m.*, u.nombre AS usuario_nombre
      FROM metas m
      LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.usuario_id = usuario_id_input
         OR m.familia_id = familia_id
      ORDER BY m.fecha_creacion DESC
    ) m;
  ELSE
    -- Recupera solo metas personales si no pertenece a una familia
    SELECT jsonb_agg(row_to_json(m))
    INTO resultado
    FROM (
      SELECT m.*, u.nombre AS usuario_nombre
      FROM metas m
      LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.usuario_id = usuario_id_input
      ORDER BY m.fecha_creacion DESC
    ) m;
  END IF;

  RETURN resultado;
END;
$$;

-- RPC: crear_meta
-- Objetivo:
--   Registra una nueva meta financiera, ya sea para un usuario o para una familia.
--
-- Parámetros:
--   nombre          → Nombre asignado a la meta.
--   monto_objetivo  → Monto total que se desea alcanzar.
--   fecha_limite    → Fecha estimada para completar la meta.
--   familia_id      → Familia asignada si la meta es compartida.
--   usuario_id      → Usuario creador cuando la meta es personal.
--   es_familiar     → Indica si la meta es familiar o personal.
--
-- Reglas:
--   - La meta inicia con monto acumulado en cero.
--   - Se asigna a familia o usuario según el indicador recibido.
--
-- Retorna:
--   Meta recién creada.

CREATE OR REPLACE FUNCTION crear_meta(
  nombre text,
  monto_objetivo numeric,
  fecha_limite date,
  familia_id uuid,
  usuario_id uuid,
  es_familiar boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  nueva_meta jsonb;
BEGIN
  -- Registra la meta asignándola como familiar o personal según corresponda
  INSERT INTO metas(nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar, monto_actual)
  VALUES(nombre, monto_objetivo, fecha_limite, familia_id, usuario_id, es_familiar, 0)
  RETURNING row_to_json(metas) INTO nueva_meta;

  RETURN nueva_meta;
END
$$;

-- RPC: editar_meta
-- Objetivo:
--   Actualiza una meta existente, permitiendo modificar sus atributos
--   principales y su tipo (personal o familiar).
--
-- Parámetros:
--   p_id             → Identificador de la meta a editar.
--   p_nombre         → Nombre actualizado de la meta.
--   p_monto_objetivo → Nuevo objetivo financiero.
--   p_fecha_limite   → Nueva fecha límite.
--   p_es_familiar    → Define si la meta queda como familiar.
--   p_usuario_id     → Usuario que solicita la modificación.
--
-- Reglas:
--   - Ajusta la relación entre usuario y familia según el tipo de meta.
--   - Solo actualiza metas válidas.
--
-- Retorna:
--   Meta actualizada.

CREATE OR REPLACE FUNCTION editar_meta(
  p_id uuid,
  p_nombre text,
  p_monto_objetivo numeric,
  p_fecha_limite date,
  p_es_familiar boolean,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  familia_id uuid;
  meta_actualizada jsonb;
BEGIN
  -- Obtiene la familia del usuario solicitante
  SELECT familia_id INTO familia_id FROM usuarios WHERE id = p_usuario_id;

  -- Actualiza la meta aplicando los cambios solicitados
  UPDATE metas
  SET
    nombre = p_nombre,
    monto_objetivo = p_monto_objetivo,
    fecha_limite = p_fecha_limite,
    es_familiar = p_es_familiar,
    familia_id = CASE WHEN p_es_familiar THEN familia_id ELSE NULL END,
    usuario_id = CASE WHEN p_es_familiar THEN NULL ELSE p_usuario_id END
  WHERE id = p_id
  RETURNING row_to_json(metas)
  INTO meta_actualizada;

  RETURN meta_actualizada;
END;
$$;

-- RPC: eliminar_meta
-- Objetivo:
--   Elimina una meta del sistema de forma directa.
--
-- Parámetros:
--   meta_id → Meta que se desea eliminar.
--
-- Reglas:
--   - Elimina únicamente el registro de la meta.
--   - No modifica historial ni registros dependientes.
--
-- Retorna:
--   true cuando la eliminación se completa correctamente.

CREATE OR REPLACE FUNCTION eliminar_meta(meta_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Elimina la meta especificada
  DELETE FROM metas WHERE id = meta_id;

  -- Confirma eliminación
  RETURN TRUE;
END;
$$;

-- RPC: agregar_ahorro
-- Objetivo:
--   Registra un aporte a una meta y ajusta el saldo disponible del usuario.
--
-- Parámetros:
--   p_meta_id       → Meta que recibe el aporte.
--   p_monto         → Monto aportado.
--   p_usuario_id    → Usuario que realiza el aporte.
--   p_movimiento_id → Movimiento contable asociado.
--
-- Reglas:
--   - El monto debe ser mayor que cero.
--   - Verifica que el usuario posea saldo suficiente.
--   - No permite superar el objetivo de la meta.
--
-- Retorna:
--   Estado actualizado de la meta y del saldo del usuario.

CREATE OR REPLACE FUNCTION agregar_ahorro(
  p_meta_id uuid,
  p_monto numeric,
  p_usuario_id uuid,
  p_movimiento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  saldo numeric;
  monto_actual numeric;
  monto_objetivo numeric;
  nuevo_monto numeric;
  nuevo_saldo numeric;
BEGIN
  -- Valida que el monto sea permitido
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  -- Obtiene el saldo disponible del usuario
  SELECT saldo_disponible INTO saldo
  FROM usuarios
  WHERE id = p_usuario_id;

  -- Verifica disponibilidad de saldo
  IF p_monto > saldo THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponible: %', saldo;
  END IF;

  -- Recupera información de la meta
  SELECT m.monto_actual, m.monto_objetivo
  INTO monto_actual, monto_objetivo
  FROM metas m
  WHERE m.id = p_meta_id;

  -- Verifica que la meta exista
  IF monto_actual IS NULL THEN
    RAISE EXCEPTION 'Meta no encontrada';
  END IF;

  -- Calcula nuevos valores de meta y saldo
  nuevo_monto := monto_actual + p_monto;

  -- Valida que no se exceda el objetivo
  IF nuevo_monto > monto_objetivo THEN
    RAISE EXCEPTION 'El aporte excede el objetivo';
  END IF;

  -- Actualiza la meta con el nuevo monto acumulado
  UPDATE metas
  SET monto_actual = nuevo_monto
  WHERE id = p_meta_id;

  -- Actualiza saldo del usuario
  nuevo_saldo := saldo - p_monto;

  UPDATE usuarios
  SET saldo_disponible = nuevo_saldo
  WHERE id = p_usuario_id;

  -- Registra el aporte asociado al movimiento
  INSERT INTO ahorro(meta_id, movimiento_id, monto)
  VALUES(p_meta_id, p_movimiento_id, p_monto);

  -- Retorna valores actualizados
  RETURN jsonb_build_object(
    'exito', TRUE,
    'nuevoSaldo', nuevo_saldo,
    'nuevoMonto', nuevo_monto
  );
END;
$$;

-- RPC: obtener_aportes_por_meta
-- Objetivo:
--   Obtiene el historial de aportes realizados a una meta, incluyendo
--   información del movimiento y del usuario que aportó.
--
-- Parámetros:
--   meta_id_input → Meta cuyos aportes se desean consultar.
--
-- Reglas:
--   - Incluye detalles relevantes del aporte, del movimiento y del usuario.
--   - Ordena los aportes del más reciente al más antiguo.
--
-- Retorna:
--   Lista de aportes asociados a la meta.

CREATE OR REPLACE FUNCTION obtener_aportes_por_meta(meta_id_input uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado jsonb;
BEGIN
  -- Recupera todos los aportes con sus detalles relacionados
  SELECT jsonb_agg(row_to_json(q))
  INTO resultado
  FROM (
    SELECT 
      a.id,
      a.monto,
      a.fecha_aporte,
      m.id AS movimiento_id,
      m.monto AS movimiento_monto,
      m.tipo,
      m.fecha,
      u.id AS usuario_id,
      u.nombre,
      u.correo
    FROM ahorro a
    LEFT JOIN movimientos m ON m.id = a.movimiento_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE a.meta_id = meta_id_input
    ORDER BY a.fecha_aporte DESC
  ) q;

  RETURN resultado;
END;
$$;