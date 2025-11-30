-- RPC: obtener_conceptos
-- Objetivo:
--   Obtiene todos los conceptos disponibles para la familia del usuario,
--   devolviendo únicamente aquellos asociados al grupo familiar correspondiente.
--
-- Parámetros:
--   p_usuario_id → Usuario desde el cual se determinará la familia.
--
-- Reglas:
--   - Solo retorna conceptos asociados a la familia del usuario.
--   - Si el usuario no tiene familia asignada, retorna una lista vacía.
--
-- Retorna:
--   Conjunto de conceptos visibles para la familia del usuario.

CREATE OR REPLACE FUNCTION obtener_conceptos(
  p_usuario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_id UUID;
  v_result JSONB;
BEGIN
  -- Determina la familia asociada al usuario
  SELECT u.familia_id
  INTO v_familia_id
  FROM usuarios u
  WHERE u.id = p_usuario_id;

  -- Si no pertenece a una familia, retorna lista vacía
  IF v_familia_id IS NULL THEN
    RETURN jsonb_build_object('conceptos', '[]'::jsonb);
  END IF;

  -- Obtiene conceptos vinculados a la familia
  SELECT jsonb_agg(to_jsonb(c) ORDER BY c.nombre)
  INTO v_result
  FROM conceptos c
  WHERE c.familia_id = v_familia_id;

  -- Retorna lista de conceptos, asegurando no nulos
  RETURN jsonb_build_object(
    'conceptos', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- RPC: obtener_conceptos_por_tipo
-- Objetivo:
--   Recupera conceptos de la familia del usuario filtrados por un tipo
--   específico (por ejemplo, ingreso o egreso).
--
-- Parámetros:
--   p_usuario_id → Usuario que determina la familia consultada.
--   p_tipo       → Tipo de concepto a filtrar.
--
-- Reglas:
--   - Solo incluye conceptos correspondientes a la familia del usuario.
--   - Si el usuario no tiene familia, retorna lista vacía.
--   - El filtro por tipo es opcional.
--
-- Retorna:
--   Lista de conceptos que cumplen el filtro solicitado.

CREATE OR REPLACE FUNCTION obtener_conceptos_por_tipo(
  p_usuario_id UUID,
  p_tipo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_id UUID;
  v_result JSONB;
BEGIN
  -- Identifica la familia del usuario
  SELECT familia_id INTO v_familia_id
  FROM usuarios
  WHERE id = p_usuario_id;

  -- Si no tiene familia, retorna lista vacía
  IF v_familia_id IS NULL THEN
    RETURN jsonb_build_object('conceptos', '[]'::jsonb);
  END IF;

  -- Recupera conceptos de la familia aplicando filtro opcional por tipo
  SELECT jsonb_agg(to_jsonb(c) ORDER BY c.nombre)
  INTO v_result
  FROM conceptos c
  WHERE c.familia_id = v_familia_id
    AND (p_tipo IS NULL OR c.tipo = p_tipo);

  -- Retorno uniforme asegurando lista no nula
  RETURN jsonb_build_object(
    'conceptos', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- RPC: crear_concepto
-- Objetivo:
--   Registra un nuevo concepto asociado a la familia del usuario, creando
--   la familia si el usuario aún no pertenece a una.
--
-- Parámetros:
--   p_usuario_id → Usuario que solicita la creación.
--   p_nombre     → Nombre del concepto.
--   p_tipo       → Clasificación del concepto.
--   p_periodo    → Periodicidad relacionada al concepto.
--
-- Reglas:
--   - Asegura que el concepto no exista previamente en la familia.
--   - Si el usuario no tiene familia, se crea una automáticamente.
--   - El concepto queda siempre asignado a la familia.
--
-- Retorna:
--   Concepto recién creado o error si ya existía.

CREATE OR REPLACE FUNCTION crear_concepto(
  p_usuario_id UUID,
  p_nombre TEXT,
  p_tipo TEXT,
  p_periodo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_id UUID;
  v_concepto_id UUID;
  v_usuario_nombre TEXT;
BEGIN
  -- Obtiene la familia del usuario y su nombre
  SELECT familia_id, nombre
  INTO v_familia_id, v_usuario_nombre
  FROM usuarios
  WHERE id = p_usuario_id;

  -- Crea una familia para el usuario si no tiene una asignada
  IF v_familia_id IS NULL THEN
    INSERT INTO familias(nombre)
    VALUES ('Familia de ' || v_usuario_nombre)
    RETURNING id INTO v_familia_id;

    UPDATE usuarios
    SET familia_id = v_familia_id
    WHERE id = p_usuario_id;
  END IF;

  -- Verifica que el concepto no exista en la familia
  IF EXISTS (
    SELECT 1
    FROM conceptos
    WHERE nombre = p_nombre
      AND familia_id = v_familia_id
  ) THEN
    RETURN jsonb_build_object(
      'error', 'El concepto ya existe en esta familia'
    );
  END IF;

  -- Inserta el nuevo concepto en la familia
  INSERT INTO conceptos(nombre, tipo, periodo, familia_id)
  VALUES(p_nombre, p_tipo, p_periodo, v_familia_id)
  RETURNING id INTO v_concepto_id;

  -- Retorna el concepto creado
  RETURN jsonb_build_object(
    'exito', TRUE,
    'id', v_concepto_id,
    'nombre', p_nombre,
    'tipo', p_tipo,
    'periodo', p_periodo
  );
END;
$$;

-- RPC: editar_concepto
-- Objetivo:
--   Actualiza los atributos de un concepto existente garantizando la
--   consistencia dentro de la familia a la que pertenece.
--
-- Parámetros:
--   p_concepto_id → Concepto que se desea modificar.
--   p_nombre      → Nuevo nombre del concepto.
--   p_tipo        → Nueva clasificación del concepto.
--   p_periodo     → Nueva periodicidad asociada.
--
-- Reglas:
--   - Verifica que el concepto exista en una familia válida.
--   - Impide duplicados dentro de la misma familia.
--   - Registra cambios sobre el concepto indicado.
--
-- Retorna:
--   Concepto actualizado o mensaje de error según validaciones.

CREATE OR REPLACE FUNCTION editar_concepto(
  p_concepto_id UUID,
  p_nombre TEXT,
  p_tipo TEXT,
  p_periodo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_id UUID;
BEGIN
  -- Obtiene la familia a la que pertenece el concepto
  SELECT familia_id
  INTO v_familia_id
  FROM conceptos
  WHERE id = p_concepto_id;

  -- Valida existencia del concepto
  IF v_familia_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Concepto no encontrado'
    );
  END IF;

  -- Valida que no exista otro concepto con el mismo nombre en la familia
  IF EXISTS (
    SELECT 1
    FROM conceptos
    WHERE familia_id = v_familia_id
      AND nombre = p_nombre
      AND id <> p_concepto_id
  ) THEN
    RETURN jsonb_build_object(
      'error', 'Ya existe otro concepto con ese nombre en esta familia'
    );
  END IF;

  -- Actualiza el concepto con los datos nuevos
  UPDATE conceptos
  SET nombre = p_nombre,
      tipo = p_tipo,
      periodo = p_periodo,
      actualizado_en = NOW()
  WHERE id = p_concepto_id;

  -- Retorna los datos actualizados
  RETURN jsonb_build_object(
    'exito', TRUE,
    'id', p_concepto_id,
    'nombre', p_nombre,
    'tipo', p_tipo,
    'periodo', p_periodo
  );
END;
$$;