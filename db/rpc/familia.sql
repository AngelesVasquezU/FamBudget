-- RPC: obtener_mi_familia
-- Objetivo:
--   Devuelve la información de la familia a la que pertenece un usuario,
--   permitiendo conocer el grupo familiar asociado al perfil consultado.
--
-- Parámetros:
--   p_usuario_id → Usuario cuya familia se desea consultar.
--
-- Reglas:
--   - Si el usuario no existe, retorna un error.
--   - Si no tiene familia, la respuesta indica familia nula.
--   - Si la familia existe, se retorna su información completa.
--
-- Retorna:
--   Objeto que representa la familia del usuario o la ausencia de ella.

CREATE OR REPLACE FUNCTION obtener_mi_familia(
  p_usuario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_id UUID;
  v_familia JSONB;
BEGIN
  -- Obtiene la familia asociada al usuario
  SELECT u.familia_id
  INTO v_familia_id
  FROM usuarios u
  WHERE u.id = p_usuario_id;

  -- Usuario inexistente
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Usuario no encontrado');
  END IF;

  -- Usuario sin familia
  IF v_familia_id IS NULL THEN
    RETURN jsonb_build_object('familia', NULL);
  END IF;

  -- Carga la información de la familia
  SELECT to_jsonb(f)
  INTO v_familia
  FROM familias f
  WHERE f.id = v_familia_id;

  -- Familia no encontrada (inconsistencia)
  IF v_familia IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Familia no encontrada',
      'familia_id', v_familia_id
    );
  END IF;

  -- Retorna la familia
  RETURN jsonb_build_object('familia', v_familia);
END;
$$;

-- RPC: obtener_miembros_familia
-- Objetivo:
--   Recupera la lista de miembros pertenecientes a una familia específica,
--   permitiendo conocer la composición del grupo familiar.
--
-- Parámetros:
--   p_familia_id → Identificador de la familia a consultar.
--
-- Reglas:
--   - Verifica que la familia exista antes de procesar.
--   - Incluye todos los miembros registrados dentro de la familia.
--   - Retorna lista vacía cuando no existen usuarios asociados.
--
-- Retorna:
--   Conjunto de miembros pertenecientes a la familia solicitada.

CREATE OR REPLACE FUNCTION obtener_miembros_familia(
  p_familia_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_exists BOOLEAN;
  v_miembros JSONB;
BEGIN
  -- Verifica existencia de la familia
  SELECT EXISTS (
    SELECT 1 FROM familias WHERE id = p_familia_id
  ) INTO v_familia_exists;

  IF NOT v_familia_exists THEN
    RETURN jsonb_build_object(
      'error', 'La familia no existe',
      'familia_id', p_familia_id
    );
  END IF;

  -- Obtiene los miembros asociados
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'nombre', u.nombre,
        'correo', u.correo,
        'rol', u.rol,
        'parentesco', u.parentesco
      )
    ), '[]'::jsonb
  )
  INTO v_miembros
  FROM usuarios u
  WHERE u.familia_id = p_familia_id;

  -- Retorna resultado final
  RETURN jsonb_build_object(
    'familia_id', p_familia_id,
    'miembros', v_miembros
  );
END;
$$;

-- RPC: crear_familia
-- Objetivo:
--   Registra una nueva familia en el sistema y asigna al usuario indicado
--   como miembro de dicha familia.
--
-- Parámetros:
--   p_nombre      → Nombre que tendrá la nueva familia.
--   p_usuario_id  → Usuario que quedará asociado como integrante inicial.
--
-- Reglas:
--   - El usuario debe existir antes de crear la familia.
--   - Una vez creada, el usuario queda vinculado a la familia recién creada.
--
-- Retorna:
--   Información de la familia creada junto con los datos del usuario asignado.

CREATE OR REPLACE FUNCTION crear_familia(
  p_nombre TEXT,
  p_usuario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_usuario RECORD;
  v_familia RECORD;
BEGIN
  -- Valida que el usuario exista
  SELECT *
  INTO v_usuario
  FROM usuarios
  WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Usuario no encontrado',
      'usuario_id', p_usuario_id
    );
  END IF;

  -- Crea la familia
  INSERT INTO familias (nombre)
  VALUES (p_nombre)
  RETURNING * INTO v_familia;

  -- Asigna la familia al usuario
  UPDATE usuarios
  SET familia_id = v_familia.id
  WHERE id = p_usuario_id;

  -- Retorna información final
  RETURN jsonb_build_object(
    'familia', to_jsonb(v_familia),
    'usuario', jsonb_build_object(
      'id', v_usuario.id,
      'nombre', v_usuario.nombre,
      'correo', v_usuario.correo,
      'rol', v_usuario.rol,
      'familia_id', v_familia.id
    )
  );
END;
$$;

-- RPC: agregar_miembro_familia
-- Objetivo:
--   Añade un usuario existente, identificado por correo, a una familia dada,
--   permitiendo incorporar nuevos miembros al grupo familiar.
--
-- Parámetros:
--   p_familia_id → Familia a la cual se desea agregar el usuario.
--   p_correo     → Correo del usuario que será añadido como miembro.
--
-- Reglas:
--   - La familia debe existir.
--   - El usuario debe existir y no tener rol de administrador.
--   - No puede pertenecer ya a otra familia distinta.
--   - Se valida que la asignación no genere inconsistencias de pertenencia.
--
-- Retorna:
--   Información del miembro añadido y la familia a la que fue incorporado.

CREATE OR REPLACE FUNCTION agregar_miembro_familia(
  p_familia_id UUID,
  p_correo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_familia_exists BOOLEAN;
  v_usuario RECORD;
  v_usuario_actualizado RECORD;
BEGIN
  -- Verifica que la familia exista
  SELECT EXISTS (
    SELECT 1 FROM familias f WHERE f.id = p_familia_id
  )
  INTO v_familia_exists;

  IF NOT v_familia_exists THEN
    RETURN jsonb_build_object(
      'error', 'La familia especificada no existe',
      'familia_id', p_familia_id
    );
  END IF;

  -- Obtiene el usuario mediante correo
  SELECT *
  INTO v_usuario
  FROM usuarios
  WHERE correo = p_correo;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Usuario no encontrado',
      'correo', p_correo
    );
  END IF;

  -- Validación del rol del usuario
  IF v_usuario.rol = 'Administrador' THEN
    RETURN jsonb_build_object(
      'error', 'No puedes agregar un administrador al grupo familiar',
      'usuario_id', v_usuario.id
    );
  END IF;

  -- Validación de pertenencia a otra familia
  IF v_usuario.familia_id IS NOT NULL
     AND v_usuario.familia_id <> p_familia_id THEN
    RETURN jsonb_build_object(
      'error', 'Este usuario ya pertenece a otra familia',
      'usuario_id', v_usuario.id,
      'familia_actual', v_usuario.familia_id
    );
  END IF;

  -- Actualiza la familia del usuario (si no tiene o coincide)
  UPDATE usuarios
  SET familia_id = p_familia_id
  WHERE id = v_usuario.id
  RETURNING id, nombre, correo, rol, parentesco
  INTO v_usuario_actualizado;

  -- Retorna la información del miembro agregado
  RETURN jsonb_build_object(
    'exito', TRUE,
    'familia_id', p_familia_id,
    'miembro', to_jsonb(v_usuario_actualizado)
  );
END;
$$;

-- RPC: eliminar_miembro_familia
-- Objetivo:
--   Quita a un usuario de una familia, permitiendo gestionar la composición
--   del grupo familiar por parte de un administrador autorizado.
--
-- Parámetros:
--   p_usuario_id → Usuario que será removido de la familia.
--   p_admin_id   → Usuario que ejecuta la acción.
--
-- Reglas:
--   - El administrador no puede eliminarse a sí mismo.
--   - El usuario debe existir y pertenecer a una familia.
--   - El administrador debe pertenecer a la misma familia del usuario objetivo.
--
-- Retorna:
--   Confirmación de eliminación y el identificador del usuario removido.

CREATE OR REPLACE FUNCTION eliminar_miembro_familia(
  p_usuario_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_target RECORD;
BEGIN
  -- Impide que el administrador se elimine a sí mismo
  IF p_usuario_id = p_admin_id THEN
    RETURN jsonb_build_object(
      'error', 'No puedes eliminarte a ti mismo como administradora'
    );
  END IF;

  -- Verifica que el usuario a eliminar exista
  SELECT id, familia_id
  INTO v_target
  FROM usuarios
  WHERE id = p_usuario_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Usuario a eliminar no encontrado'
    );
  END IF;

  -- Verifica que pertenezca a una familia
  IF v_target.familia_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Este usuario no pertenece a ninguna familia'
    );
  END IF;

  -- Verifica que el administrador pertenezca a la misma familia
  IF (SELECT familia_id FROM usuarios WHERE id = p_admin_id) != v_target.familia_id THEN
    RETURN jsonb_build_object(
      'error', 'No puedes eliminar miembros de otra familia'
    );
  END IF;

  -- Remueve al usuario de la familia
  UPDATE usuarios
  SET familia_id = NULL,
      parentesco = NULL
  WHERE id = p_usuario_id;

  -- Retorna confirmación
  RETURN jsonb_build_object(
    'exito', TRUE,
    'usuario_removido', p_usuario_id
  );
END;
$$;

-- RPC: cambiar_admin_familia
-- Objetivo:
--   Transfiere la administración de una familia a un nuevo usuario,
--   garantizando una transición válida entre miembros del mismo grupo familiar.
--
-- Parámetros:
--   p_familia_id       → Familia cuya administración será transferida.
--   p_nuevo_admin_id   → Usuario que asumirá el rol de administrador.
--   p_admin_actual_id  → Usuario que actualmente posee dicho rol.
--
-- Reglas:
--   - El administrador actual debe ser realmente el administrador.
--   - Ambos usuarios deben pertenecer a la misma familia.
--   - El nuevo administrador debe ser un miembro válido de la familia.
--
-- Retorna:
--   Información sobre la transferencia del rol administrativo.

CREATE OR REPLACE FUNCTION cambiar_admin_familia(
  p_familia_id UUID,
  p_nuevo_admin_id UUID,
  p_admin_actual_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_actual RECORD;
  v_nuevo RECORD;
BEGIN
  -- Obtiene al administrador actual
  SELECT id, familia_id, rol
  INTO v_admin_actual
  FROM usuarios
  WHERE id = p_admin_actual_id;

  -- Valida existencia y rol
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Administrador actual no encontrado');
  END IF;

  IF v_admin_actual.rol != 'Administrador' THEN
    RETURN jsonb_build_object('error', 'El usuario actual no es administrador');
  END IF;

  IF v_admin_actual.familia_id != p_familia_id THEN
    RETURN jsonb_build_object('error', 'El administrador no pertenece a esta familia');
  END IF;

  -- Obtiene al nuevo administrador
  SELECT id, familia_id, rol
  INTO v_nuevo
  FROM usuarios
  WHERE id = p_nuevo_admin_id;

  -- Valida existencia y pertenencia
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Nuevo administrador no encontrado');
  END IF;

  IF v_nuevo.familia_id != p_familia_id THEN
    RETURN jsonb_build_object('error', 'El nuevo administrador no pertenece a esta familia');
  END IF;

  -- Evita transferencia redundante
  IF v_nuevo.rol = 'Administrador' THEN
    RETURN jsonb_build_object('error', 'Este usuario ya es administrador');
  END IF;

  -- Actualiza roles en la familia
  UPDATE usuarios
  SET rol = 'Administrador'
  WHERE id = p_nuevo_admin_id;

  UPDATE usuarios
  SET rol = 'Miembro familiar'
  WHERE id = p_admin_actual_id;

  -- Retorna detalles de la transferencia
  RETURN jsonb_build_object(
    'exito', TRUE,
    'nuevo_admin', p_nuevo_admin_id,
    'admin_anterior', p_admin_actual_id
  );
END;
$$;

-- RPC: eliminar_familia_completa
-- Objetivo:
--   Elimina por completo una familia del sistema, incluidos todos sus
--   vínculos con usuarios, dejando a cada miembro sin familia asignada.
--
-- Parámetros:
--   p_admin_id → Administrador que solicita la eliminación.
--
-- Reglas:
--   - Solo un administrador puede ejecutar esta acción.
--   - El administrador debe pertenecer a la familia que desea eliminar.
--   - Todos los miembros quedan sin familia antes de borrar el registro principal.
--
-- Retorna:
--   Identificador de la familia eliminada como confirmación.

CREATE OR REPLACE FUNCTION eliminar_familia_completa(
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  -- Obtiene datos del administrador
  SELECT id, familia_id, rol
  INTO v_admin
  FROM usuarios
  WHERE id = p_admin_id;

  -- Verifica existencia del administrador
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Administrador no encontrado');
  END IF;

  -- Valida permisos
  IF v_admin.rol != 'Administrador' THEN
    RETURN jsonb_build_object('error', 'Solo un administrador puede eliminar la familia');
  END IF;

  -- Verifica que pertenezca a una familia
  IF v_admin.familia_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No perteneces a ninguna familia');
  END IF;

  -- Limpia relación familiar en todos los miembros
  UPDATE usuarios
  SET familia_id = NULL,
      parentesco = NULL
  WHERE familia_id = v_admin.familia_id;

  -- Elimina la familia del registro principal
  DELETE FROM familias
  WHERE id = v_admin.familia_id;

  -- Retorna confirmación
  RETURN jsonb_build_object(
    'exito', TRUE,
    'familia_eliminada', v_admin.familia_id
  );
END;
$$;